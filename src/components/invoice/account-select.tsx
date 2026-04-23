"use client";

import { useState, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { StaffAccountNumber } from "./invoice-form";

interface AccountSelectProps {
  value: string;
  onChange: (value: string) => void;
  staffId: string;
  accountNumbers: StaffAccountNumber[];
}

export function AccountSelect({
  value,
  onChange,
  staffId,
  accountNumbers,
}: AccountSelectProps) {
  const [showDesc, setShowDesc] = useState(false);
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const chipRefs = useRef<(HTMLButtonElement | null)[]>([]);

  async function saveAccountNumber() {
    if (!value.trim() || !staffId) return;
    setSaving(true);
    await fetch(`/api/staff/${staffId}/account-numbers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accountCode: value.trim(),
        description: description.trim(),
      }),
    });
    setSaving(false);
    setShowDesc(false);
    setDescription("");
  }

  const isNewAccount =
    value.trim() !== "" &&
    !accountNumbers.some((a) => a.accountCode === value.trim());
  const selectedSavedAccount = accountNumbers.find((a) => a.accountCode === value.trim());
  const pickerAccountNumbers = accountNumbers.filter((a) => a.accountCode !== value.trim());

  // Arrow-key navigation between chips
  function handleChipKeyDown(
    e: React.KeyboardEvent<HTMLButtonElement>,
    index: number
  ) {
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      const next = chipRefs.current[index + 1];
      if (next) next.focus();
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      const prev = chipRefs.current[index - 1];
      if (prev) prev.focus();
    }
  }

  return (
    <div className="space-y-2">
      <Label>Account Number</Label>

      {/* Saved account chips */}
      {selectedSavedAccount && (
        <p className="text-xs text-muted-foreground">
          Using a saved account{selectedSavedAccount.description ? ` (${selectedSavedAccount.description})` : ""}.
          Edit the field below if this invoice needs a different number.
        </p>
      )}

      {pickerAccountNumbers.length > 0 && (
        <div
          className="flex flex-wrap gap-1 mb-1"
          role="group"
          aria-label="Choose another saved account number"
        >
          {pickerAccountNumbers.map((acc, index) => (
            <button
              key={acc.id}
              ref={(el) => {
                chipRefs.current[index] = el;
              }}
              type="button"
              onClick={() => onChange(acc.accountCode)}
              onKeyDown={(e) => handleChipKeyDown(e, index)}
              className="px-2 py-0.5 rounded text-xs border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring bg-muted text-muted-foreground border-border hover:bg-accent"
              title={acc.description || undefined}
            >
              {acc.accountCode}
              {acc.description && (
                <span className="ml-1 opacity-70">({acc.description})</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Input for typing/editing */}
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Enter account number…"
        name="accountNumber"
        className="focus-visible:ring-2 focus-visible:ring-ring"
      />

      {/* Save new account number */}
      {isNewAccount && (
        <div className="flex gap-2 items-end">
          {showDesc ? (
            <>
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground">
                  Description (optional)
                </Label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      saveAccountNumber();
                    } else if (e.key === "Escape") {
                      setShowDesc(false);
                    }
                  }}
                  placeholder="e.g., ASB Fund, Grant #1234…"
                  name="accountDescription"
                  className="text-sm focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <Button
                type="button"
                size="sm"
                onClick={saveAccountNumber}
                disabled={saving}
                className="focus-visible:ring-2 focus-visible:ring-ring"
              >
                {saving ? "Saving..." : "Save"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setShowDesc(false)}
                className="focus-visible:ring-2 focus-visible:ring-ring"
              >
                Cancel
              </Button>
            </>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="text-xs focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => setShowDesc(true)}
            >
              Save this account number
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
