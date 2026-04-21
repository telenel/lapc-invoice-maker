"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Minimal wrapper that pairs a shadcn `<Label>` with its form control. Lifted
 * to module scope from inside the v2 dialog's render function so that React
 * does not recreate the component type on every parent render (which was
 * causing focus loss and unwanted remounts).
 */
export function Field({
  id,
  label,
  children,
}: {
  id?: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

/** Read-only labeled input used to display (non-editable) inventory values. */
export function ReadOnlyValueField({
  id,
  label,
  value,
}: {
  id: string;
  label: string;
  value: string;
}) {
  return (
    <Field id={id} label={label}>
      <Input id={id} value={value} disabled readOnly />
    </Field>
  );
}

/**
 * Bordered-row checkbox with an inline label. Used for the Discontinue toggle
 * today; will be restyled with a warning tint in Phase 4.
 */
export function ReadOnlyCheckbox({
  checked,
  label,
  disabled,
  onCheckedChange,
}: {
  checked: boolean;
  label: string;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 rounded-lg border border-border/60 bg-background/70 px-3 py-2.5 text-sm">
      <Checkbox
        checked={checked}
        onCheckedChange={(next) => onCheckedChange(next === true)}
        disabled={disabled}
        aria-label={label}
      />
      <span className="leading-5">{label}</span>
    </label>
  );
}
