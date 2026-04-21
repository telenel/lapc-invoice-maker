"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field } from "./field";

/**
 * Enabled/Disabled `<Select>` bound to a boolean. Used for inventory and
 * item-level flags. Lifted to module scope from the v2 dialog render
 * function so the component identity is stable across parent re-renders.
 */
export function BooleanSelectField({
  id,
  label,
  value,
  onChange,
  disabled = false,
}: {
  id: string;
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <Field id={id} label={label}>
      <Select value={value ? "1" : "0"} onValueChange={(next) => onChange(next === "1")} disabled={disabled}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="min-w-[var(--anchor-width)]">
          <SelectItem value="1">Enabled</SelectItem>
          <SelectItem value="0">Disabled</SelectItem>
        </SelectContent>
      </Select>
    </Field>
  );
}
