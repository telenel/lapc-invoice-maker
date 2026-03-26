"use client";

import { useState } from "react";
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

  return (
    <div className="space-y-2">
      <Label>Account Code</Label>

      {/* Dropdown of saved accounts */}
      {accountNumbers.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1">
          {accountNumbers.map((acc) => (
            <button
              key={acc.id}
              type="button"
              onClick={() => onChange(acc.accountCode)}
              className={`px-2 py-0.5 rounded text-xs border transition-colors ${
                value === acc.accountCode
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted text-muted-foreground border-border hover:bg-accent"
              }`}
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
        placeholder="Enter account code"
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
                  placeholder="e.g., ASB Fund, Grant #1234"
                  className="text-sm"
                />
              </div>
              <Button
                type="button"
                size="sm"
                onClick={saveAccountNumber}
                disabled={saving}
              >
                {saving ? "Saving..." : "Save"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setShowDesc(false)}
              >
                Cancel
              </Button>
            </>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="text-xs"
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
