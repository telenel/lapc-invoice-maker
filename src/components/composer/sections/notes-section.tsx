"use client";

import { SectionCard } from "./section-card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { useInvoiceForm } from "@/components/invoice/invoice-form";
import type { useQuoteForm } from "@/components/quote/quote-form";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Props {
  composer: ReturnType<typeof useInvoiceForm> | ReturnType<typeof useQuoteForm>;
  sectionStatus: "default" | "complete" | "blocker";
}

// FieldWriter bridge: composer is a union of two generic-keyed updateField
// functions (one keyed on InvoiceFormData, one on QuoteFormData), which TS
// cannot call directly through the union (TS2349 "union of generic functions
// is not callable"). Both forms have "notes" and "internalNotes" as string
// fields, so casting to a constrained-key writer is runtime-safe while
// preserving compile-time typo protection on the keys. Same pattern as
// DocumentDetailsSection / DepartmentAccountSection.
type NotesFieldKey = "notes" | "internalNotes";
type FieldWriter = { updateField: (key: NotesFieldKey, value: string) => void };

const NOTES_MAX = 500;
const NOTES_WARN_THRESHOLD = NOTES_MAX - 20;

// ---------------------------------------------------------------------------
// NotesSection
// ---------------------------------------------------------------------------

export function NotesSection({ composer, sectionStatus }: Props) {
  const f = composer.form;
  const write = (composer as unknown as FieldWriter).updateField;
  const len = f.notes.length;
  const counterTone =
    len > NOTES_MAX
      ? "text-destructive"
      : len >= NOTES_WARN_THRESHOLD
        ? "text-warn"
        : "text-muted-foreground";

  return (
    <SectionCard
      step={5}
      title="Notes & Internal Details"
      anchor="section-notes"
      status={sectionStatus}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        <div className="space-y-1.5">
          <Label
            className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground"
            htmlFor="notes-public"
          >
            Notes (visible on PDF)
          </Label>
          <Textarea
            id="notes-public"
            rows={4}
            value={f.notes}
            onChange={(e) => write("notes", e.target.value)}
          />
          <p className={cn("text-[11px] text-right tabular-nums", counterTone)}>
            {len} / {NOTES_MAX}
          </p>
        </div>
        <div className="space-y-1.5">
          <Label
            className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground"
            htmlFor="notes-internal"
          >
            Internal notes (not on PDF)
          </Label>
          <Textarea
            id="notes-internal"
            rows={4}
            value={f.internalNotes}
            onChange={(e) => write("internalNotes", e.target.value)}
          />
        </div>
      </div>
    </SectionCard>
  );
}
