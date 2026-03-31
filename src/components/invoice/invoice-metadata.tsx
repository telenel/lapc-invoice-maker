"use client";

import type { Ref } from "react";
import { Input } from "@/components/ui/input";
import { InlineCombobox } from "@/components/ui/inline-combobox";
import type { ComboboxItem } from "@/components/ui/inline-combobox";
import { cn } from "@/lib/utils";
import { AccountNumberSelect } from "./account-number-select";
import { FormError } from "@/components/ui/form-error";
import type { InvoiceFormData, StaffAccountNumber } from "./invoice-form";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Category {
  id: string;
  name: string;
  label: string;
  active: boolean;
}

interface InvoiceMetadataProps {
  form: Pick<
    InvoiceFormData,
    | "staffId"
    | "accountNumber"
    | "accountCode"
    | "invoiceNumber"
    | "date"
    | "category"
    | "semesterYearDept"
    | "isRunning"
    | "runningTitle"
  >;
  updateField: <K extends keyof InvoiceFormData>(
    key: K,
    value: InvoiceFormData[K]
  ) => void;
  categories: Category[];
  categoriesLoading: boolean;
  staffAccountNumbers: StaffAccountNumber[];
  isPendingCharge: boolean;
  invoiceNumberRef: Ref<HTMLInputElement>;
  validationErrors?: Record<string, string>;
  clearValidationError?: (key: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function InvoiceMetadata({
  form,
  updateField,
  categories,
  categoriesLoading,
  staffAccountNumbers,
  isPendingCharge,
  invoiceNumberRef,
  validationErrors = {},
  clearValidationError,
}: InvoiceMetadataProps) {
  const categoryItems: ComboboxItem[] = categories
    .filter((c) => c.active)
    .map((c) => ({
      id: c.name,
      label: c.label,
      searchValue: `${c.name} ${c.label}`,
    }));

  const selectedCategory = categories.find((c) => c.name === form.category);

  function handleCategorySelect(item: ComboboxItem) {
    updateField("category", item.id);
  }

  return (
    <>
      <div className="space-y-3">
        {/* Account Number */}
        <AccountNumberSelect
          form={form}
          updateField={updateField}
          staffAccountNumbers={staffAccountNumbers}
        />

        {/* Account Code */}
        <div className="space-y-1">
          <label className="text-sm font-medium">Account Code</label>
          <Input
            value={form.accountCode}
            onChange={(e) => updateField("accountCode", e.target.value)}
            placeholder="Account code…"
            name="accountCode"
          />
        </div>

        {/* Invoice Number */}
        <div
          id="field-invoiceNumber"
          className={cn(
            "space-y-1",
            isPendingCharge && !form.invoiceNumber &&
              "rounded-lg border-l-4 border-l-primary bg-primary/5 p-2 -ml-2"
          )}
        >
          <label className="text-sm font-medium">
            Invoice Number <span className="text-destructive">*</span>
          </label>
          <Input
            ref={invoiceNumberRef}
            value={form.invoiceNumber}
            onChange={(e) => {
              updateField("invoiceNumber", e.target.value);
              clearValidationError?.("invoiceNumber");
            }}
            placeholder="AG-XXXXXX (leave blank if not yet charged)"
            name="invoiceNumber"
            aria-invalid={!!validationErrors.invoiceNumber}
          />
          <FormError message={validationErrors.invoiceNumber} />
        </div>

        {/* Date */}
        <div id="field-date" className="space-y-1">
          <label className="text-sm font-medium">
            Date <span className="text-destructive">*</span>
          </label>
          <Input
            type="date"
            value={form.date}
            onChange={(e) => {
              updateField("date", e.target.value);
              clearValidationError?.("date");
            }}
            name="date"
            aria-invalid={!!validationErrors.date}
          />
          <FormError message={validationErrors.date} />
        </div>

        {/* Category */}
        <div id="field-category" className="space-y-1">
          <label className="text-sm font-medium">
            Category <span className="text-destructive">*</span>
          </label>
          <InlineCombobox
            items={categoryItems}
            value={form.category}
            displayValue={selectedCategory?.label ?? ""}
            onSelect={(item) => {
              handleCategorySelect(item);
              clearValidationError?.("category");
            }}
            placeholder="Search categories…"
            loading={categoriesLoading}
          />
          <FormError message={validationErrors.category} />
        </div>

        {/* Semester / Year / Dept */}
        <div className="space-y-1">
          <label className="text-sm font-medium">
            Semester / Year / Dept
          </label>
          <Input
            value={form.semesterYearDept}
            onChange={(e) =>
              updateField("semesterYearDept", e.target.value)
            }
            placeholder="e.g. Fall 2025 - Math…"
            name="semesterYearDept"
          />
        </div>
      </div>

      {/* Running Invoice Toggle */}
      <div className="flex items-center gap-3 pt-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.isRunning}
            onChange={(e) => updateField("isRunning", e.target.checked)}
            className="rounded border-border"
          />
          <span className="text-sm font-medium">Running Invoice</span>
        </label>
        {form.isRunning && (
          <Input
            value={form.runningTitle}
            onChange={(e) => updateField("runningTitle", e.target.value)}
            placeholder="Title (e.g. Music Dept Fall 2026 Supplies)"
            className="flex-1"
          />
        )}
      </div>
    </>
  );
}
