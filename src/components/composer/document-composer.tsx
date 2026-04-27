"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ComposerHeader } from "./composer-header";
import { ComposerLayout } from "./composer-layout";
import { PeopleSection } from "./sections/people-section";
import { DepartmentAccountSection } from "./sections/department-account";
import { DocumentDetailsSection } from "./sections/document-details";
import { ItemsAndPricingSection } from "./sections/items-pricing";
import { NotesSection } from "./sections/notes-section";
import { ApprovalOutputSection } from "./sections/approval-output";
import { CatalogDrawer } from "./drawers/catalog-drawer";
import { TemplatesDrawer } from "./drawers/templates-drawer";
import { useComposerValidation } from "./hooks/use-composer-validation";
import type { ComposerStatus, DocType, SectionAnchor } from "./types";
import type { useInvoiceForm } from "@/components/invoice/invoice-form";
import type { useQuoteForm } from "@/components/quote/quote-form";
import { templateApi } from "@/domains/template/api-client";
import type { TemplateResponse } from "@/domains/template/types";
import { openDeferredRegisterPrintWindow } from "@/components/shared/register-print-loader";
import { formatDateLong as formatDate } from "@/lib/formatters";

type ComposerForm =
  | { docType: "invoice"; form: ReturnType<typeof useInvoiceForm> }
  | { docType: "quote"; form: ReturnType<typeof useQuoteForm> };

export interface DocumentComposerProps {
  composer: ComposerForm;
  mode: "create" | "edit";
  status?: ComposerStatus;
  /** Toolbar visibility based on viewer permissions. */
  canManageActions?: boolean;
  documentNumber?: string;
}

export function DocumentComposer({
  composer,
  mode,
  status = "DRAFT",
  canManageActions = true,
  documentNumber,
}: DocumentComposerProps) {
  const docType: DocType = composer.docType;
  const form = composer.form.form;

  const validation = useComposerValidation(form, docType);

  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [templatesMode, setTemplatesMode] = useState<"load" | "save">("load");
  const [catalogFilter, setCatalogFilter] = useState<string | undefined>(undefined);
  const [drawer, setDrawer] = useState<"catalog" | "templates" | null>(null);
  // consumed by P6 BlockerSummary
  const [, setShowBlockers] = useState(false);

  function statusForAnchor(anchor: SectionAnchor): "default" | "complete" | "blocker" {
    if (validation.blockers.some((b) => b.anchor === anchor)) return "blocker";
    const items = validation.checklist.filter((c) => c.anchor === anchor);
    if (items.length > 0 && items.every((i) => i.complete)) return "complete";
    return "default";
  }

  function handlePrimaryAction() {
    if (validation.blockers.length > 0) {
      setAttemptedSubmit(true);
      setShowBlockers(true);
      return;
    }
    if (composer.docType === "invoice") {
      composer.form.saveAndFinalize();
    } else {
      composer.form.saveQuote().then((ok) => {
        if (ok && composer.form.existingId) {
          window.open(`/api/quotes/${composer.form.existingId}/pdf`, "_blank");
        }
      });
    }
  }

  function handleSaveDraft() {
    if (!validation.canSaveDraft) {
      setAttemptedSubmit(true);
      return;
    }
    if (composer.docType === "invoice") {
      composer.form.saveDraft();
    } else {
      composer.form.saveQuote();
    }
  }

  async function handlePrintRegister() {
    if (form.items.length === 0) return;
    if (composer.docType === "invoice") {
      const inv = composer.form;
      await openDeferredRegisterPrintWindow({
        documentNumber: inv.form.invoiceNumber || inv.form.runningTitle || "Draft Invoice",
        documentType: "Invoice",
        status: "DRAFT",
        date: inv.form.date ? formatDate(inv.form.date) : "—",
        staffName: inv.form.contactName || "—",
        department: inv.form.department || "—",
        items: inv.form.items.map((item) => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          extendedPrice: item.extendedPrice,
          sku: item.sku ?? null,
        })),
        subtotal: inv.subtotal,
        taxAmount: inv.taxAmount,
        total: inv.grandTotal,
      });
      return;
    }
    // Quote branch — derive subtotal/tax locally because useQuoteForm doesn't
    // expose them on its return; mirrors src/app/quotes/new/page.tsx so PDFs
    // match. P7 may extract a shared helper.
    const q = composer.form;
    const displayItems = q.form.marginEnabled ? q.itemsWithMargin : q.form.items;
    const subtotal = displayItems.reduce((sum, item) => sum + Number(item.extendedPrice), 0);
    const taxRate = q.form.taxEnabled ? Number(q.form.taxRate) : 0;
    const taxableTotal = displayItems
      .filter((item) => item.isTaxable)
      .reduce((sum, item) => sum + Number(item.extendedPrice), 0);
    const taxAmount = taxableTotal * taxRate;
    await openDeferredRegisterPrintWindow({
      documentNumber: "Draft Quote",
      documentType: "Quote",
      status: "DRAFT",
      date: q.form.date ? formatDate(q.form.date) : "—",
      staffName: q.form.contactName || "—",
      department: q.form.department || "—",
      items: q.form.items.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        extendedPrice: item.extendedPrice,
        sku: item.sku ?? null,
      })),
      subtotal,
      taxAmount,
      total: subtotal + taxAmount,
    });
  }

  function handleLoadTemplate(template: TemplateResponse) {
    const items = template.items.map((it, i) => ({
      _key: crypto.randomUUID(),
      sku: it.sku ?? null,
      description: it.description,
      quantity: Number(it.quantity),
      unitPrice: Number(it.unitPrice),
      extendedPrice: Number(it.quantity) * Number(it.unitPrice),
      sortOrder: i,
      isTaxable: it.isTaxable ?? true,
      marginOverride: it.marginOverride ?? null,
      costPrice: it.costPrice != null ? Number(it.costPrice) : null,
    }));
    // Branch on docType so each setForm call resolves to a concrete generic
    // signature; the union otherwise widens `prev` to `any`. isCateringEvent
    // only exists on the quote form, so only the quote arm applies it.
    if (composer.docType === "invoice") {
      composer.form.setForm((prev) => ({
        ...prev,
        items,
        category: template.category || prev.category,
        notes: template.notes || prev.notes,
        marginEnabled: template.marginEnabled,
        marginPercent: Number(template.marginPercent ?? prev.marginPercent),
        taxEnabled: template.taxEnabled,
        taxRate: Number(template.taxRate ?? prev.taxRate),
      }));
    } else {
      composer.form.setForm((prev) => ({
        ...prev,
        items,
        category: template.category || prev.category,
        notes: template.notes || prev.notes,
        marginEnabled: template.marginEnabled,
        marginPercent: Number(template.marginPercent ?? prev.marginPercent),
        taxEnabled: template.taxEnabled,
        taxRate: Number(template.taxRate ?? prev.taxRate),
        isCateringEvent: template.isCateringEvent,
      }));
    }
    toast.success(`Loaded template "${template.name}"`);
  }

  async function handleSaveTemplate(payload: { name: string; category: string; notes: string }) {
    const f = composer.form.form;
    await templateApi.create({
      name: payload.name,
      type: composer.docType === "invoice" ? "INVOICE" : "QUOTE",
      category: payload.category,
      notes: payload.notes,
      marginEnabled: f.marginEnabled,
      marginPercent: f.marginEnabled ? f.marginPercent : undefined,
      taxEnabled: f.taxEnabled,
      taxRate: f.taxRate,
      isCateringEvent: "isCateringEvent" in f ? f.isCateringEvent : false,
      items: f.items
        .filter((i) => i.description.trim() && Number(i.quantity) > 0)
        .map((i, idx) => ({
          description: i.description,
          quantity: Number(i.quantity),
          unitPrice: Number(i.unitPrice),
          sortOrder: idx,
          isTaxable: i.isTaxable,
          costPrice: i.costPrice ?? undefined,
          marginOverride: i.marginOverride ?? undefined,
          sku: i.sku ?? undefined,
        })),
    });
    toast.success("Template saved");
    setDrawer(null);
  }

  return (
    <>
      <ComposerHeader
        docType={docType}
        mode={mode}
        status={status}
        documentNumber={documentNumber}
        date={form.date}
        isRunning={"isRunning" in form ? form.isRunning : false}
      />
      <ComposerLayout
        workflow={
          <>
            {composer.docType === "invoice" ? (
              <PeopleSection
                docType="invoice"
                composer={composer.form}
                sectionStatus={statusForAnchor("section-people")}
              />
            ) : (
              <PeopleSection
                docType="quote"
                composer={composer.form}
                sectionStatus={statusForAnchor("section-people")}
              />
            )}
            <DepartmentAccountSection
              composer={composer.form}
              sectionStatus={statusForAnchor("section-department")}
            />
            {composer.docType === "invoice" ? (
              <DocumentDetailsSection
                docType="invoice"
                composer={composer.form}
                sectionStatus={statusForAnchor("section-details")}
              />
            ) : (
              <DocumentDetailsSection
                docType="quote"
                composer={composer.form}
                sectionStatus={statusForAnchor("section-details")}
              />
            )}
            <ItemsAndPricingSection
              composer={composer.form}
              sectionStatus={statusForAnchor("section-items")}
              onOpenCatalog={(filter) => {
                setCatalogFilter(filter);
                setDrawer("catalog");
              }}
              showCateringPreset={
                composer.docType === "quote" && composer.form.form.isCateringEvent
              }
            />
            <NotesSection
              composer={composer.form}
              sectionStatus={statusForAnchor("section-notes")}
            />
            {composer.docType === "invoice" ? (
              <ApprovalOutputSection
                docType="invoice"
                composer={composer.form}
                sectionStatus={statusForAnchor("section-approval")}
                attemptedSubmit={attemptedSubmit}
                canManageActions={canManageActions}
                primaryDisabled={validation.blockers.length > 0 || composer.form.saving}
                canSaveDraft={validation.canSaveDraft}
                onOpenTemplates={() => {
                  setTemplatesMode("save");
                  setDrawer("templates");
                }}
                onPrimaryAction={handlePrimaryAction}
                onSaveDraft={handleSaveDraft}
                onPrintRegister={handlePrintRegister}
              />
            ) : (
              <ApprovalOutputSection
                docType="quote"
                composer={composer.form}
                sectionStatus={statusForAnchor("section-approval")}
                attemptedSubmit={attemptedSubmit}
                canManageActions={canManageActions}
                primaryDisabled={validation.blockers.length > 0 || composer.form.saving}
                canSaveDraft={validation.canSaveDraft}
                onOpenTemplates={() => {
                  setTemplatesMode("save");
                  setDrawer("templates");
                }}
                onPrimaryAction={handlePrimaryAction}
                onSaveDraft={handleSaveDraft}
                onPrintRegister={handlePrintRegister}
              />
            )}
          </>
        }
        rail={
          <div className="rounded-lg border border-border bg-card p-4 shadow-rail">
            <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              Readiness
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums">
              {Math.round(validation.readiness * 100)}%
            </p>
            <p className="mt-2 text-[12.5px] text-muted-foreground">
              {validation.blockers.length} blocker(s) · {validation.totals.itemCount} item(s)
            </p>
          </div>
        }
      />
      <CatalogDrawer
        open={drawer === "catalog"}
        onOpenChange={(o) => setDrawer(o ? "catalog" : null)}
        categoryFilter={catalogFilter}
        onAddItems={(items) => composer.form.addItems(items)}
      />
      <TemplatesDrawer
        open={drawer === "templates"}
        type={composer.docType === "invoice" ? "INVOICE" : "QUOTE"}
        mode={templatesMode}
        initialPayload={{
          name: "",
          category: composer.form.form.category,
          notes: composer.form.form.notes,
        }}
        onOpenChange={(o) => setDrawer(o ? "templates" : null)}
        onLoadTemplate={handleLoadTemplate}
        onSaveTemplate={handleSaveTemplate}
      />
    </>
  );
}
