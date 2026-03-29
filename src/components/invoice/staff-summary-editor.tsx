"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import type { InvoiceFormData } from "./invoice-form";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type EditableField =
  | "department"
  | "contactExtension"
  | "contactEmail"
  | "contactPhone";

interface StaffSummaryEditorProps {
  form: Pick<
    InvoiceFormData,
    | "staffId"
    | "department"
    | "contactExtension"
    | "contactEmail"
    | "contactPhone"
  >;
  updateField: <K extends keyof InvoiceFormData>(
    key: K,
    value: InvoiceFormData[K]
  ) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function StaffSummaryEditor({
  form,
  updateField,
}: StaffSummaryEditorProps) {
  const [editingField, setEditingField] = useState<EditableField | null>(null);

  function handleSummaryClick(field: EditableField) {
    setEditingField(field);
  }

  function handleSummaryBlur() {
    setEditingField(null);
  }

  function handleSummaryKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === "Escape") {
      setEditingField(null);
    }
  }

  if (!form.staffId) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground px-1">
      {editingField === "department" ? (
        <Input
          className="h-6 w-40 text-sm"
          aria-label="Department"
          value={form.department}
          onChange={(e) => updateField("department", e.target.value)}
          onBlur={handleSummaryBlur}
          onKeyDown={handleSummaryKeyDown}
          tabIndex={-1}
          autoFocus
        />
      ) : (
        <span
          className="auto-filled-summary"
          tabIndex={0}
          onClick={() => handleSummaryClick("department")}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleSummaryClick("department"); } }}
          role="button"
        >
          {form.department || "Department"}
        </span>
      )}
      <span aria-hidden="true">&middot;</span>

      {editingField === "contactExtension" ? (
        <Input
          className="h-6 w-24 text-sm"
          aria-label="Extension"
          value={form.contactExtension}
          onChange={(e) =>
            updateField("contactExtension", e.target.value)
          }
          onBlur={handleSummaryBlur}
          onKeyDown={handleSummaryKeyDown}
          tabIndex={-1}
          autoFocus
        />
      ) : (
        <span
          className="auto-filled-summary"
          tabIndex={0}
          onClick={() => handleSummaryClick("contactExtension")}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleSummaryClick("contactExtension"); } }}
          role="button"
        >
          ext. {form.contactExtension || "—"}
        </span>
      )}
      <span aria-hidden="true">&middot;</span>

      {editingField === "contactEmail" ? (
        <Input
          className="h-6 w-48 text-sm"
          aria-label="Email"
          type="email"
          value={form.contactEmail}
          onChange={(e) => updateField("contactEmail", e.target.value)}
          onBlur={handleSummaryBlur}
          onKeyDown={handleSummaryKeyDown}
          tabIndex={-1}
          autoFocus
        />
      ) : (
        <span
          className="auto-filled-summary"
          tabIndex={0}
          onClick={() => handleSummaryClick("contactEmail")}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleSummaryClick("contactEmail"); } }}
          role="button"
        >
          {form.contactEmail || "email"}
        </span>
      )}
      <span aria-hidden="true">&middot;</span>

      {editingField === "contactPhone" ? (
        <Input
          className="h-6 w-36 text-sm"
          aria-label="Phone"
          type="tel"
          value={form.contactPhone}
          onChange={(e) => updateField("contactPhone", e.target.value)}
          onBlur={handleSummaryBlur}
          onKeyDown={handleSummaryKeyDown}
          tabIndex={-1}
          autoFocus
        />
      ) : (
        <span
          className="auto-filled-summary"
          tabIndex={0}
          onClick={() => handleSummaryClick("contactPhone")}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleSummaryClick("contactPhone"); } }}
          role="button"
        >
          {form.contactPhone || "phone"}
        </span>
      )}
    </div>
  );
}
