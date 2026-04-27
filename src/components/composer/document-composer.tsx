"use client";

import { ComposerHeader } from "./composer-header";
import { ComposerLayout } from "./composer-layout";
import { SectionCard } from "./sections/section-card";
import { PeopleSection } from "./sections/people-section";
import { DepartmentAccountSection } from "./sections/department-account";
import { DocumentDetailsSection } from "./sections/document-details";
import { ItemsAndPricingSection } from "./sections/items-pricing";
import { useComposerValidation } from "./hooks/use-composer-validation";
import type { ComposerStatus, DocType, SectionAnchor } from "./types";
import type { useInvoiceForm } from "@/components/invoice/invoice-form";
import type { useQuoteForm } from "@/components/quote/quote-form";

type ComposerForm =
  | { docType: "invoice"; form: ReturnType<typeof useInvoiceForm> }
  | { docType: "quote"; form: ReturnType<typeof useQuoteForm> };

export interface DocumentComposerProps {
  composer: ComposerForm;
  mode: "create" | "edit";
  status?: ComposerStatus;
  /** Reserved for P5/P6 — toolbar visibility based on viewer permissions. */
  canManageActions?: boolean;
  documentNumber?: string;
}

export function DocumentComposer({
  composer,
  mode,
  status = "DRAFT",
  documentNumber,
}: DocumentComposerProps) {
  const docType: DocType = composer.docType;
  const form = composer.form.form;

  const validation = useComposerValidation(form, docType);

  function statusForAnchor(anchor: SectionAnchor): "default" | "complete" | "blocker" {
    if (validation.blockers.some((b) => b.anchor === anchor)) return "blocker";
    const items = validation.checklist.filter((c) => c.anchor === anchor);
    if (items.length > 0 && items.every((i) => i.complete)) return "complete";
    return "default";
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
              onOpenCatalog={() => {
                /* catalog drawer wires up in P5 */
              }}
              showCateringPreset={
                composer.docType === "quote" && composer.form.form.isCateringEvent
              }
            />
            <SectionCard
              step={5}
              title="Notes"
              anchor="section-notes"
              status={statusForAnchor("section-notes")}
            >
              <p className="text-sm text-muted-foreground">P5 places content here.</p>
            </SectionCard>
            <SectionCard
              step={6}
              title={docType === "invoice" ? "Approval & Output" : "Output & Reuse"}
              anchor="section-approval"
              status={statusForAnchor("section-approval")}
            >
              <p className="text-sm text-muted-foreground">P5 places content here.</p>
            </SectionCard>
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
    </>
  );
}
