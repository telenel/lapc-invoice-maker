"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InlineCombobox } from "@/components/ui/inline-combobox";
import type { ComboboxItem } from "@/components/ui/inline-combobox";
import type { InvoiceFormData, StaffAccountNumber } from "./invoice-form";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AccountNumberSelectProps {
  form: Pick<InvoiceFormData, "staffId" | "accountNumber" | "accountCode">;
  updateField: <K extends keyof InvoiceFormData>(
    key: K,
    value: InvoiceFormData[K]
  ) => void;
  staffAccountNumbers: StaffAccountNumber[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AccountNumberSelect({
  form,
  updateField,
  staffAccountNumbers,
}: AccountNumberSelectProps) {
  const [newAccountDescription, setNewAccountDescription] = useState("");
  const [showAccountDescInput, setShowAccountDescInput] = useState(false);
  const [pendingAccountCode, setPendingAccountCode] = useState("");

  const accountNumberItems: ComboboxItem[] = staffAccountNumbers.map((an) => ({
    id: an.id,
    label: an.accountCode,
    sublabel: an.description,
  }));

  function handleAccountNumberSelect(item: ComboboxItem) {
    if (item.isCustom) {
      if (!form.staffId) {
        toast.error("Select a staff member before adding a custom account code");
        return;
      }
      const raw = item.label.replace(/^Add new:\s*/, "");
      setPendingAccountCode(raw);
      setNewAccountDescription("");
      setShowAccountDescInput(true);
      // Don't update form.accountCode yet — wait until POST succeeds
    } else {
      updateField("accountCode", item.label);
      setShowAccountDescInput(false);
    }
  }

  async function handleSaveNewAccountNumber() {
    if (!form.staffId || !pendingAccountCode) return;
    try {
      const res = await fetch(
        `/api/staff/${form.staffId}/account-numbers`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accountCode: pendingAccountCode,
            description: newAccountDescription,
          }),
        }
      );
      if (!res.ok) throw new Error("Failed to save");
      // POST succeeded — now safe to update the form
      updateField("accountCode", pendingAccountCode);
      toast.success("Account number saved");
      setShowAccountDescInput(false);
      setPendingAccountCode("");
      setNewAccountDescription("");
    } catch {
      toast.error("Failed to save account number");
    }
  }

  return (
    <div className="space-y-1">
      <label className="text-sm font-medium">Account Code</label>
      <InlineCombobox
        items={accountNumberItems}
        value={form.accountCode}
        displayValue={form.accountCode}
        onSelect={handleAccountNumberSelect}
        placeholder="Search or add account code…"
        allowCustom={Boolean(form.staffId)}
        customPrefix="Add new:"
      />
      {showAccountDescInput && (
        <div className="flex items-center gap-2 mt-1">
          <Input
            className="h-7 flex-1 text-sm"
            value={newAccountDescription}
            onChange={(e) => setNewAccountDescription(e.target.value)}
            placeholder="Description for this account number…"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSaveNewAccountNumber();
              }
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={handleSaveNewAccountNumber}
          >
            Save
          </Button>
        </div>
      )}
    </div>
  );
}
