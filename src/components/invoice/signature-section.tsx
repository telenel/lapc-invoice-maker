"use client";

import { InlineCombobox } from "@/components/ui/inline-combobox";
import type { ComboboxItem } from "@/components/ui/inline-combobox";
import type { InvoiceFormData } from "./invoice-form";
import type { StaffResponse } from "@/domains/staff/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SignatureSectionProps {
  form: Pick<InvoiceFormData, "signatureStaffIds" | "signatures">;
  updateField: <K extends keyof InvoiceFormData>(
    key: K,
    value: InvoiceFormData[K]
  ) => void;
  staff: StaffResponse[];
  staffLoading: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SignatureSection({
  form,
  updateField,
  staff,
  staffLoading,
}: SignatureSectionProps) {
  const signatureItems: ComboboxItem[] = staff.map((s) => ({
    id: s.id,
    label: s.name,
    sublabel: s.title,
    searchValue: `${s.name} ${s.title} ${s.department}`,
  }));

  function handleSignatureSelect(
    line: "line1" | "line2" | "line3",
    item: ComboboxItem
  ) {
    const found = staff.find((s) => s.id === item.id);
    if (!found) return;
    updateField("signatureStaffIds", {
      ...form.signatureStaffIds,
      [line]: found.id,
    });
    updateField("signatures", {
      ...form.signatures,
      [line]: `${found.name}, ${found.title}`,
    });
  }

  return (
    <div className="space-y-3">
      {(["line1", "line2", "line3"] as const).map((line, idx) => (
        <div key={line} className="space-y-1">
          <label className="text-sm font-medium">
            Signature {idx + 1}
          </label>
          <InlineCombobox
            items={signatureItems}
            value={form.signatureStaffIds[line]}
            displayValue={form.signatures[line]}
            onSelect={(item) => handleSignatureSelect(line, item)}
            placeholder={`Signature line ${idx + 1}…`}
            loading={staffLoading}
          />
        </div>
      ))}
    </div>
  );
}
