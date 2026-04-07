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
  form: Pick<InvoiceFormData, "staffId" | "accountNumber">;
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
  const [pendingAccountNumber, setPendingAccountNumber] = useState("");

  const accountNumberItems: ComboboxItem[] = staffAccountNumbers.map((an) => ({
    id: an.id,
    label: an.accountCode,
    sublabel: an.description,
  }));

  function handleAccountNumberSelect(item: ComboboxItem) {
    if (item.isCustom) {
      if (!form.staffId) {
        toast.error("Select a requestor before adding a custom account number");
        return;
      }
      const raw = item.label.replace(/^Add new:\s*/, "");
      setPendingAccountNumber(raw);
      setNewAccountDescription("");
      setShowAccountDescInput(true);
      // Don't update form.accountNumber yet — wait until POST succeeds
    } else {
      updateField("accountNumber", item.label);
      setShowAccountDescInput(false);
    }
  }

  async function handleSaveNewAccountNumber() {
    if (!form.staffId || !pendingAccountNumber) return;
    try {
      const res = await fetch(
        `/api/staff/${form.staffId}/account-numbers`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accountCode: pendingAccountNumber,
            description: newAccountDescription,
          }),
        }
      );
      if (!res.ok) throw new Error("Failed to save");
      // POST succeeded — now safe to update the form
      updateField("accountNumber", pendingAccountNumber);
      toast.success("Account number saved");
      setShowAccountDescInput(false);
      setPendingAccountNumber("");
      setNewAccountDescription("");
    } catch {
      toast.error("Failed to save account number");
    }
  }

  return (
    <div className="space-y-1">
      <label className="text-sm font-medium">Account Number</label>
      <InlineCombobox
        items={accountNumberItems}
        value={form.accountNumber}
        displayValue={form.accountNumber}
        onSelect={handleAccountNumberSelect}
        placeholder="Search or add account number…"
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
