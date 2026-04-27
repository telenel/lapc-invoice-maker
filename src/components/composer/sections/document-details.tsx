"use client";

import { useEffect, useState } from "react";
import { SectionCard } from "./section-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  categoryApi,
  type CategoryResponse,
} from "@/domains/category/api-client";
import type { useInvoiceForm } from "@/components/invoice/invoice-form";
import type { useQuoteForm } from "@/components/quote/quote-form";
import type { CateringDetails } from "@/domains/quote/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Props =
  | {
      docType: "invoice";
      composer: ReturnType<typeof useInvoiceForm>;
      sectionStatus: "default" | "complete" | "blocker";
    }
  | {
      docType: "quote";
      composer: ReturnType<typeof useQuoteForm>;
      sectionStatus: "default" | "complete" | "blocker";
    };

// FieldWriter bridge: composer is a union of two generic-keyed updateField
// functions (one keyed on InvoiceFormData, one on QuoteFormData), which TS
// cannot call directly even with `as never` casts (TS2349 "union of generic
// functions is not callable"). Both forms have "category" and "date" as
// string fields, so casting to a constrained-key writer is runtime-safe
// while preserving compile-time typo protection on the keys. Same pattern
// as DepartmentAccountSection.
type DetailsFieldKey = "category" | "date" | "invoiceNumber";
type FieldWriter = { updateField: (key: DetailsFieldKey, value: string) => void };

// ---------------------------------------------------------------------------
// DocumentDetailsSection
// ---------------------------------------------------------------------------

export function DocumentDetailsSection(props: Props) {
  const f = props.composer.form;
  const write = (props.composer as unknown as FieldWriter).updateField;

  const [categories, setCategories] = useState<CategoryResponse[]>([]);

  useEffect(() => {
    let cancelled = false;
    categoryApi
      .list()
      .then((data) => {
        if (!cancelled) setCategories(data);
      })
      .catch((err) => {
        if (!cancelled)
          console.error("[DocumentDetails] category fetch failed", err);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <SectionCard
      step={3}
      title="Document Details"
      anchor="section-details"
      status={props.sectionStatus}
    >
      {/* Invoice variant: AG invoice number — required by saveAndFinalize. */}
      {props.docType === "invoice" && (
        <div className="mb-3.5 space-y-1.5">
          <Label
            htmlFor="composer-invoice-number"
            className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground"
          >
            Invoice number
          </Label>
          <Input
            id="composer-invoice-number"
            value={props.composer.form.invoiceNumber}
            onChange={(e) => write("invoiceNumber", e.target.value)}
            placeholder="AG-XXXXXX (enter when ready to finalize)"
            name="invoiceNumber"
            autoComplete="off"
          />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        {/* Category */}
        <div className="space-y-1.5">
          <Label className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
            Category
          </Label>
          <Select
            value={f.category}
            onValueChange={(v) => write("category", v ?? "")}
          >
            <SelectTrigger aria-label="Category" className="w-full">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((c) => (
                <SelectItem key={c.name} value={c.name}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Date */}
        <div className="space-y-1.5">
          <Label className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
            Date
          </Label>
          <Input
            type="date"
            value={f.date}
            onChange={(e) => write("date", e.target.value)}
          />
        </div>

        {/* Mode toggle */}
        <div className="space-y-1.5">
          <ModeToggle {...props} />
        </div>
      </div>

      {/* Invoice variant: running title input */}
      {props.docType === "invoice" && props.composer.form.isRunning && (
        <div className="pt-2">
          <Input
            placeholder="Running invoice title"
            value={props.composer.form.runningTitle}
            onChange={(e) =>
              props.composer.updateField("runningTitle", e.target.value)
            }
          />
        </div>
      )}

      {/* Quote variant: catering panel */}
      {props.docType === "quote" && props.composer.form.isCateringEvent && (
        <CateringPanel composer={props.composer} />
      )}
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// ModeToggle
// ---------------------------------------------------------------------------

function ModeToggle(props: Props) {
  if (props.docType === "invoice") {
    const f = props.composer.form;
    return (
      <div className="flex items-center justify-between rounded-lg border border-border p-3">
        <div>
          <Label className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
            Running invoice
          </Label>
          <p className="text-[12px] text-muted-foreground">
            Aggregates multiple charges
          </p>
        </div>
        <Switch
          aria-label="Running invoice"
          checked={f.isRunning}
          onCheckedChange={(v) =>
            props.composer.updateField("isRunning", v)
          }
        />
      </div>
    );
  }

  const f = props.composer.form;
  return (
    <div className="flex items-center justify-between rounded-lg border border-border p-3">
      <div>
        <Label className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
          Catering quote
        </Label>
        <p className="text-[12px] text-muted-foreground">
          Surfaces event details
        </p>
      </div>
      <Switch
        aria-label="Catering"
        checked={f.isCateringEvent}
        onCheckedChange={(v) =>
          props.composer.updateField("isCateringEvent", v)
        }
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// CateringPanel
// ---------------------------------------------------------------------------

function CateringPanel({
  composer,
}: {
  composer: ReturnType<typeof useQuoteForm>;
}) {
  const c = composer.form.cateringDetails;

  function updateDetail<K extends keyof CateringDetails>(
    k: K,
    v: CateringDetails[K]
  ) {
    composer.updateField("cateringDetails", { ...c, [k]: v });
  }

  return (
    <div className="mt-3 rounded-lg border border-border bg-muted/40 p-3 space-y-3">
      {/* Primary 4-column block */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="space-y-1">
          <Label className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
            Event name
          </Label>
          <Input
            aria-label="Event name"
            value={c.eventName ?? ""}
            onChange={(e) => updateDetail("eventName", e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
            Date
          </Label>
          <Input
            aria-label="Event date"
            type="date"
            value={c.eventDate}
            onChange={(e) => updateDetail("eventDate", e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
            Attendees
          </Label>
          <Input
            aria-label="Attendees"
            type="number"
            min={0}
            value={c.headcount ?? ""}
            onChange={(e) =>
              updateDetail(
                "headcount",
                e.target.value === "" ? undefined : Number(e.target.value)
              )
            }
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
            Location
          </Label>
          <Input
            aria-label="Location"
            value={c.location}
            onChange={(e) => updateDetail("location", e.target.value)}
          />
        </div>
      </div>

      {/* Collapsible "More catering details" */}
      <details>
        <summary className="cursor-pointer text-[12px] font-mono uppercase tracking-wider text-muted-foreground">
          More catering details
        </summary>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input
            placeholder="Start time"
            value={c.startTime}
            onChange={(e) => updateDetail("startTime", e.target.value)}
          />
          <Input
            placeholder="End time"
            value={c.endTime}
            onChange={(e) => updateDetail("endTime", e.target.value)}
          />
          <Input
            placeholder="Contact name"
            value={c.contactName}
            onChange={(e) => updateDetail("contactName", e.target.value)}
          />
          <Input
            placeholder="Contact phone"
            value={c.contactPhone}
            onChange={(e) => updateDetail("contactPhone", e.target.value)}
          />
          <Input
            placeholder="Contact email"
            type="email"
            value={c.contactEmail ?? ""}
            onChange={(e) => updateDetail("contactEmail", e.target.value)}
          />
          <Input
            placeholder="Special instructions"
            value={c.specialInstructions ?? ""}
            onChange={(e) =>
              updateDetail("specialInstructions", e.target.value)
            }
          />
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={c.setupRequired}
              onChange={(e) =>
                updateDetail("setupRequired", e.target.checked)
              }
            />
            Setup required
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={c.takedownRequired}
              onChange={(e) =>
                updateDetail("takedownRequired", e.target.checked)
              }
            />
            Takedown required
          </label>
          <Input
            placeholder="Setup time"
            value={c.setupTime ?? ""}
            onChange={(e) => updateDetail("setupTime", e.target.value)}
          />
          <Input
            placeholder="Setup instructions"
            value={c.setupInstructions ?? ""}
            onChange={(e) =>
              updateDetail("setupInstructions", e.target.value)
            }
          />
          <Input
            placeholder="Takedown time"
            value={c.takedownTime ?? ""}
            onChange={(e) => updateDetail("takedownTime", e.target.value)}
          />
          <Input
            placeholder="Takedown instructions"
            value={c.takedownInstructions ?? ""}
            onChange={(e) =>
              updateDetail("takedownInstructions", e.target.value)
            }
          />
        </div>
      </details>
    </div>
  );
}
