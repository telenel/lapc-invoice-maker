"use client";

import { SectionCard } from "./section-card";
import { ApproverSlotCard } from "../primitives/approver-slot-card";
import { Button } from "@/components/ui/button";
import { StaffSignatureSelect } from "@/components/invoice/staff-signature-select";
import { PrismcoreUpload } from "@/components/invoice/prismcore-upload";
import type { useInvoiceForm } from "@/components/invoice/invoice-form";
import type { useQuoteForm } from "@/components/quote/quote-form";
import type { DocType } from "../types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BaseProps {
  sectionStatus: "default" | "complete" | "blocker";
  attemptedSubmit: boolean;
  canManageActions: boolean;
  primaryDisabled: boolean;
  canSaveDraft: boolean;
  onOpenTemplates: () => void;
  onPrimaryAction: () => void;
  onSaveDraft: () => void;
  onPrintRegister: () => void;
}

type ApprovalOutputSectionProps =
  | (BaseProps & { docType: "invoice"; composer: ReturnType<typeof useInvoiceForm> })
  | (BaseProps & { docType: "quote"; composer: ReturnType<typeof useQuoteForm> });

export type { ApprovalOutputSectionProps };

// ---------------------------------------------------------------------------
// ApprovalOutputSection
// ---------------------------------------------------------------------------

export function ApprovalOutputSection(props: ApprovalOutputSectionProps) {
  const title = props.docType === "invoice" ? "Approval & Output" : "Output & Reuse";
  return (
    <SectionCard
      step={6}
      title={title}
      anchor="section-approval"
      status={props.sectionStatus}
    >
      {props.docType === "invoice" && (
        <ApproverGrid
          composer={props.composer}
          attemptedSubmit={props.attemptedSubmit}
          disabled={!props.canManageActions}
        />
      )}
      {props.docType === "invoice" && props.canManageActions && (
        <div className="pt-3">
          <PrismcoreUpload
            value={props.composer.form.prismcorePath}
            onChange={(path) => props.composer.updateField("prismcorePath", path)}
          />
        </div>
      )}
      <ActionToolbar
        docType={props.docType}
        canManageActions={props.canManageActions}
        primaryDisabled={props.primaryDisabled}
        canSaveDraft={props.canSaveDraft}
        onOpenTemplates={props.onOpenTemplates}
        onPrimaryAction={props.onPrimaryAction}
        onSaveDraft={props.onSaveDraft}
        onPrintRegister={props.onPrintRegister}
      />
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// ApproverGrid (invoice-only)
// ---------------------------------------------------------------------------

interface ApproverGridProps {
  composer: ReturnType<typeof useInvoiceForm>;
  attemptedSubmit: boolean;
  disabled: boolean;
}

function ApproverGrid({ composer, attemptedSubmit, disabled }: ApproverGridProps) {
  const slots: Array<0 | 1 | 2> = [0, 1, 2];
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {slots.map((idx) => {
        const lineKey = `line${idx + 1}` as "line1" | "line2" | "line3";
        const staffId = composer.form.signatureStaffIds[lineKey];
        const display = composer.form.signatures[lineKey] || "";
        return (
          <ApproverSlotCard
            key={idx}
            slotIndex={idx}
            required={idx < 2}
            staffId={staffId}
            display={display}
            disabled={disabled}
            attemptedSubmit={attemptedSubmit}
          >
            <StaffSignatureSelect
              selectedId={staffId}
              displayValue={display}
              onSelect={(staff) => {
                const newDisplay = staff.title
                  ? `${staff.name} — ${staff.title}`
                  : staff.name;
                composer.updateField("signatureStaffIds", {
                  ...composer.form.signatureStaffIds,
                  [lineKey]: staff.id,
                });
                composer.updateField("signatures", {
                  ...composer.form.signatures,
                  [lineKey]: newDisplay,
                });
              }}
            />
          </ApproverSlotCard>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ActionToolbar (both variants)
// ---------------------------------------------------------------------------

interface ActionToolbarProps {
  docType: DocType;
  canManageActions: boolean;
  primaryDisabled: boolean;
  canSaveDraft: boolean;
  onOpenTemplates: () => void;
  onPrimaryAction: () => void;
  onSaveDraft: () => void;
  onPrintRegister: () => void;
}

function ActionToolbar(props: ActionToolbarProps) {
  if (!props.canManageActions) return null;
  const primaryLabel =
    props.docType === "invoice" ? "Generate PDF" : "Save Quote & Generate PDF";

  return (
    <div className="pt-4">
      <div className="flex flex-wrap items-stretch gap-4">
        <div className="space-y-1">
          <p className="text-[10.5px] font-mono uppercase tracking-wider text-muted-foreground">
            Output
          </p>
          <div className="flex gap-2">
            <Button onClick={props.onPrimaryAction} disabled={props.primaryDisabled}>
              {primaryLabel}
            </Button>
            <Button variant="outline" onClick={props.onPrintRegister}>
              Print for Register
            </Button>
          </div>
        </div>
        <div className="space-y-1 border-l border-border pl-4">
          <p className="text-[10.5px] font-mono uppercase tracking-wider text-muted-foreground">
            Save
          </p>
          <Button
            variant="outline"
            onClick={props.onSaveDraft}
            disabled={!props.canSaveDraft}
          >
            Save Draft
          </Button>
        </div>
        <div className="space-y-1 border-l border-border pl-4">
          <p className="text-[10.5px] font-mono uppercase tracking-wider text-muted-foreground">
            Reuse
          </p>
          <Button variant="ghost" onClick={props.onOpenTemplates}>
            Save as Template
          </Button>
        </div>
      </div>
    </div>
  );
}
