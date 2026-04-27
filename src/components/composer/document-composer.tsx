"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
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
import { PreviewDrawer } from "./drawers/preview-drawer";
import { BlockerSummary } from "./drawers/blocker-summary";
import { SummaryRail } from "./rail/summary-rail";
import { DraftRestoreBanner } from "./primitives/draft-restore-banner";
import { BottomActionBar } from "./primitives/bottom-action-bar";
import { useComposerValidation } from "./hooks/use-composer-validation";
import { useSectionJump } from "./hooks/use-section-jump";
import { Button } from "@/components/ui/button";
import type { ComposerStatus, DocType, SectionAnchor } from "./types";
import type { useInvoiceForm } from "@/components/invoice/invoice-form";
import type { useQuoteForm } from "@/components/quote/quote-form";
import { templateApi } from "@/domains/template/api-client";
import type { TemplateResponse } from "@/domains/template/types";
import { openDeferredRegisterPrintWindow } from "@/components/shared/register-print-loader";
import { formatDateLong as formatDate } from "@/lib/formatters";
import { CREATE_PAGE_DRAFT_MAX_AGE_MS, useAutoSave, loadDraft } from "@/lib/use-auto-save";
import type { InvoiceFormData } from "@/components/invoice/hooks/use-invoice-form-state";
import type { QuoteFormData } from "@/components/quote/quote-form";

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
  const existingId = composer.form.existingId;

  const validation = useComposerValidation(form, docType);
  const { jump } = useSectionJump();

  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [templatesMode, setTemplatesMode] = useState<"load" | "save">("load");
  const [catalogFilter, setCatalogFilter] = useState<string | undefined>(undefined);
  const [drawer, setDrawer] = useState<"catalog" | "templates" | "preview" | null>(null);
  const [showBlockers, setShowBlockers] = useState(false);

  // Auto-save + draft recovery — mirrors the legacy KeyboardMode/QuoteMode wiring
  // so /invoices/new keeps draft persistence after P5.7's repoint.
  const { data: session } = useSession();
  const userId = (session?.user as { id?: string } | undefined)?.id ?? null;
  const routeKey = existingId
    ? (docType === "invoice" ? `/invoices/${existingId}/edit` : `/quotes/${existingId}/edit`)
    : (docType === "invoice" ? "/invoices/new" : "/quotes/new");
  const { clearDraft, isDirty, savingDraft, lastSavedAt } = useAutoSave(form, routeKey, userId);
  const [draftEntry, setDraftEntry] = useState<{ data: InvoiceFormData | QuoteFormData; savedAt: number } | null>(null);

  useEffect(() => {
    if (!userId) {
      setDraftEntry(null);
      return;
    }
    let cancelled = false;
    void loadDraft<InvoiceFormData | QuoteFormData>(routeKey, userId, {
      maxAgeMs: existingId ? null : CREATE_PAGE_DRAFT_MAX_AGE_MS,
    }).then((entry) => {
      if (!cancelled) setDraftEntry(entry);
    });
    return () => {
      cancelled = true;
    };
  }, [existingId, userId, routeKey]);

  // Derive item count + total preview values for <DraftRestoreBanner>. Total
  // uses extendedPrice when present (matches what the user saw before reload).
  const draftPreview = useMemo(() => {
    if (!draftEntry) return null;
    const items = draftEntry.data.items ?? [];
    const total = items.reduce(
      (sum, it) => sum + Number(it.extendedPrice ?? 0),
      0,
    );
    return { itemCount: items.length, total };
  }, [draftEntry]);

  function statusForAnchor(anchor: SectionAnchor): "default" | "complete" | "blocker" {
    if (validation.blockers.some((b) => b.anchor === anchor)) return "blocker";
    const items = validation.checklist.filter((c) => c.anchor === anchor);
    if (items.length > 0 && items.every((i) => i.complete)) return "complete";
    return "default";
  }

  async function handlePrimaryAction() {
    if (validation.blockers.length > 0) {
      setAttemptedSubmit(true);
      setShowBlockers(true);
      return;
    }
    if (composer.docType === "invoice") {
      const ok = await composer.form.saveAndFinalize();
      if (ok) await clearDraft();
    } else {
      const ok = await composer.form.saveQuote();
      if (ok) {
        await clearDraft();
        if (composer.form.existingId) {
          window.open(`/api/quotes/${composer.form.existingId}/pdf`, "_blank");
        }
      }
    }
  }

  async function handleSaveDraft() {
    if (!validation.canSaveDraft) {
      setAttemptedSubmit(true);
      return;
    }
    const ok = composer.docType === "invoice"
      ? await composer.form.saveDraft()
      : await composer.form.saveQuote();
    if (ok) await clearDraft();
  }

  function handleResumeDraft() {
    if (!draftEntry) return;
    if (composer.docType === "invoice") {
      composer.form.setForm(() => draftEntry.data as InvoiceFormData);
    } else {
      composer.form.setForm(() => draftEntry.data as QuoteFormData);
    }
    setDraftEntry(null);
  }

  function handleDiscardDraft() {
    void clearDraft();
    setDraftEntry(null);
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
    try {
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
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save template");
    }
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
        actionsRight={
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setTemplatesMode("load");
                setDrawer("templates");
              }}
            >
              Templates
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDrawer("preview")}
            >
              Preview
            </Button>
            <span className="h-4 w-px bg-border" aria-hidden />
            <Button variant="outline" size="sm" onClick={handlePrintRegister}>
              Print Register
            </Button>
          </>
        }
      />
      <ComposerLayout
        banners={
          <>
            {draftEntry && draftPreview && (
              <DraftRestoreBanner
                savedAt={draftEntry.savedAt}
                itemCount={draftPreview.itemCount}
                total={draftPreview.total}
                onResume={handleResumeDraft}
                onDiscard={handleDiscardDraft}
              />
            )}
            {showBlockers && validation.blockers.length > 0 && (
              <BlockerSummary
                blockers={validation.blockers}
                onClose={() => setShowBlockers(false)}
                onJump={(a) => {
                  jump(a);
                  setShowBlockers(false);
                }}
              />
            )}
          </>
        }
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
          <SummaryRail
            readiness={validation.readiness}
            blockerCount={validation.blockers.length}
            docType={composer.docType}
            totals={validation.totals}
            marginEnabled={composer.form.form.marginEnabled}
            taxEnabled={composer.form.form.taxEnabled}
            taxRate={composer.form.form.taxRate}
            accountNumber={composer.form.form.accountNumber}
            department={composer.form.form.department}
            saving={composer.form.saving}
            primaryDisabled={validation.blockers.length > 0 || composer.form.saving}
            canSaveDraft={validation.canSaveDraft}
            checklist={validation.checklist}
            isDirty={isDirty}
            savingDraft={savingDraft}
            lastSavedAt={lastSavedAt}
            onPrimaryAction={handlePrimaryAction}
            onSaveDraft={handleSaveDraft}
            onPrintRegister={handlePrintRegister}
            onJumpToBlockers={() => setShowBlockers(true)}
            onJump={jump}
          />
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
      <PreviewDrawer
        open={drawer === "preview"}
        onOpenChange={(o) => setDrawer(o ? "preview" : null)}
        docType={composer.docType}
        date={composer.form.form.date}
        department={composer.form.form.department}
        category={composer.form.form.category}
        items={composer.form.form.items.map((i) => {
          // When margin is enabled, the displayed unit price must reflect the
          // charged price (cost basis × (1 + margin)), not the cost. Mirrors
          // chargedPrice() in use-composer-validation.ts so totals and per-line
          // numbers agree. Without this, a margin-on preview underprices items.
          const f = composer.form.form;
          const cost = i.costPrice ?? Number(i.unitPrice);
          const m = i.marginOverride ?? f.marginPercent;
          const charged =
            f.marginEnabled && m > 0
              ? Math.round(cost * (1 + m / 100) * 100) / 100
              : Number(i.unitPrice);
          return {
            description: i.description,
            sku: i.sku,
            quantity: Number(i.quantity),
            unitPrice: charged,
            isTaxable: i.isTaxable,
          };
        })}
        totals={validation.totals}
        taxEnabled={composer.form.form.taxEnabled}
        taxRate={composer.form.form.taxRate}
        signatures={
          composer.docType === "invoice"
            ? [
                composer.form.form.signatures.line1,
                composer.form.form.signatures.line2,
                composer.form.form.signatures.line3,
              ]
                .filter(Boolean)
                .map((s) => {
                  const [name, title] = s.split(" — ");
                  return { name: name ?? s, title };
                })
            : []
        }
        notes={composer.form.form.notes}
        onPrimaryAction={() => {
          setDrawer(null);
          void handlePrimaryAction();
        }}
      />
      <BottomActionBar
        primaryLabel={composer.docType === "invoice" ? "Generate PDF" : "Save Quote"}
        primaryDisabled={validation.blockers.length > 0 || composer.form.saving}
        grandTotal={validation.totals.grandTotal}
        onPrimaryAction={handlePrimaryAction}
        onOpenSummary={() => {
          // P6: rail is desktop-only; placeholder until a bottom-sheet rail lands.
          toast.info("Summary view coming soon — rotate to a wider screen for now.");
        }}
      />
    </>
  );
}
