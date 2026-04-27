"use client";

import { useRef } from "react";
import { SectionCard } from "./section-card";
import { StaffSelect } from "@/components/invoice/staff-select";
import { StaffSummaryEditor } from "@/components/invoice/staff-summary-editor";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { useInvoiceForm } from "@/components/invoice/invoice-form";
import type { useQuoteForm } from "@/components/quote/quote-form";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SectionStatus = "default" | "complete" | "blocker";

type Props =
  | { docType: "invoice"; composer: ReturnType<typeof useInvoiceForm>; sectionStatus: SectionStatus }
  | { docType: "quote";   composer: ReturnType<typeof useQuoteForm>;   sectionStatus: SectionStatus };

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function RequestorLabel() {
  return (
    <Label className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
      Requestor
    </Label>
  );
}

function AutofillCaption() {
  return <p className="text-[12px] text-muted-foreground">Autofills department &amp; contact</p>;
}

function InvoiceContactCard({ composer }: { composer: ReturnType<typeof useInvoiceForm> }) {
  const f = composer.form;
  const set = composer.updateField;

  if (!f.staffId) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/40 p-4 text-[12.5px] text-muted-foreground">
        — select a staff member —
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-2 text-[12.5px]">
      <div className="grid gap-2">
        <Input value={f.contactName}      onChange={(e) => set("contactName",      e.target.value)} placeholder="Name" />
        <Input value={f.contactExtension} onChange={(e) => set("contactExtension", e.target.value)} placeholder="Ext" className="font-mono" />
        <Input value={f.contactEmail}     onChange={(e) => set("contactEmail",     e.target.value)} placeholder="Email" type="email" className="font-mono" />
        <Input value={f.contactPhone}     onChange={(e) => set("contactPhone",     e.target.value)} placeholder="Phone" className="font-mono tabular-nums" />
      </div>
    </div>
  );
}

function QuoteRecipientCard({ composer }: { composer: ReturnType<typeof useQuoteForm> }) {
  const f = composer.form;
  const isInternal = !!f.staffId;
  const internalRef = useRef<HTMLButtonElement>(null);
  const externalRef = useRef<HTMLButtonElement>(null);

  const setMode = (mode: "internal" | "external") => {
    if (mode === "internal") {
      composer.updateField("recipientName", "");
      composer.updateField("recipientEmail", "");
      composer.updateField("recipientOrg", "");
    } else {
      composer.clearStaffSelection();
    }
  };

  return (
    <div className="space-y-2">
      <div
        role="radiogroup"
        aria-label="Recipient type"
        className="inline-flex rounded-md border border-border bg-muted p-0.5"
        onKeyDown={(e) => {
          if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
            e.preventDefault();
            const next = isInternal ? "external" : "internal";
            setMode(next);
            (next === "internal" ? internalRef : externalRef).current?.focus();
          }
        }}
      >
        <button
          ref={internalRef}
          type="button"
          role="radio"
          aria-checked={isInternal}
          aria-label="Internal department"
          onClick={() => setMode("internal")}
          className={`px-2.5 py-1 text-[11px] rounded-sm font-medium uppercase tracking-wider ${isInternal ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
        >
          Internal dept.
        </button>
        <button
          ref={externalRef}
          type="button"
          role="radio"
          aria-checked={!isInternal}
          aria-label="External party"
          onClick={() => setMode("external")}
          className={`px-2.5 py-1 text-[11px] rounded-sm font-medium uppercase tracking-wider ${!isInternal ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
        >
          External party
        </button>
      </div>
      {isInternal ? (
        <p className="text-[12px] text-muted-foreground">Quote will be sent to the requestor&apos;s email.</p>
      ) : (
        <div className="space-y-2">
          <Input
            value={f.recipientName}
            onChange={(e) => composer.updateField("recipientName", e.target.value)}
            placeholder="Recipient name"
          />
          <Input
            value={f.recipientEmail}
            onChange={(e) => composer.updateField("recipientEmail", e.target.value)}
            placeholder="Recipient email (optional)"
            type="email"
          />
          <Input
            value={f.recipientOrg}
            onChange={(e) => composer.updateField("recipientOrg", e.target.value)}
            placeholder="Organization (optional)"
          />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PeopleSection
// ---------------------------------------------------------------------------

export function PeopleSection(props: Props) {
  const description =
    props.docType === "invoice"
      ? "Who is the requestor of these items / services, and what are we charging them for?"
      : "Who is requesting these items, and who will receive this quote?";

  return (
    <SectionCard
      step={1}
      title="People"
      description={description}
      anchor="section-people"
      status={props.sectionStatus}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {props.docType === "invoice" ? (
          <>
            <div className="space-y-2">
              <RequestorLabel />
              {/*
                Invoice's handleStaffSelect accepts StaffDetailResponse (which
                extends StaffResponse). StaffSelect calls onSelect with a
                StaffResponse, so function-parameter contravariance flags
                this. Cast to bridge — runtime-safe because the handler
                reads only fields present on StaffResponse plus the optional
                accountNumbers field.
              */}
              <StaffSelect
                selectedId={props.composer.form.staffId}
                onSelect={props.composer.handleStaffSelect as Parameters<typeof StaffSelect>[0]["onSelect"]}
              />
              <AutofillCaption />
              <StaffSummaryEditor
                form={props.composer.form}
                updateField={props.composer.updateField}
              />
            </div>
            <InvoiceContactCard composer={props.composer} />
          </>
        ) : (
          <>
            <div className="space-y-2">
              <RequestorLabel />
              <StaffSelect
                selectedId={props.composer.form.staffId}
                onSelect={props.composer.handleStaffSelect}
              />
              <AutofillCaption />
              {/*
                StaffSummaryEditor's updateField generic is keyed on InvoiceFormData,
                but the 5 fields it touches (staffId, department, contactExtension,
                contactEmail, contactPhone) all exist on QuoteFormData with the same
                string type. Cast to bridge the generic mismatch — runtime-safe.
              */}
              <StaffSummaryEditor
                form={props.composer.form}
                updateField={
                  props.composer.updateField as Parameters<typeof StaffSummaryEditor>[0]["updateField"]
                }
              />
            </div>
            <QuoteRecipientCard composer={props.composer} />
          </>
        )}
      </div>
    </SectionCard>
  );
}
