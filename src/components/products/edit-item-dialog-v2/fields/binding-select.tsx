"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { PrismRefs } from "@/domains/product/api-client";
import { Field } from "./field";

/**
 * Labeled binding select. Previously defined inside `EditItemDialogV2`'s
 * render function which meant React recreated the component type on every
 * parent render — a well-known anti-pattern that causes focus loss inside
 * the trigger and breaks TypeScript inference across the prop boundary.
 * Lifted to module scope as part of the Phase 1 extraction.
 */
export function BindingSelectField({
  id,
  label,
  value,
  onChange,
  disabled = false,
  refs,
  isBulk,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  refs: PrismRefs | null;
  isBulk: boolean;
}) {
  const options = refs?.bindings ?? [];
  const selectedOption = options.find((option) => String(option.bindingId) === value);
  const fallbackLabel = selectedOption?.label ?? (value !== "" ? `Binding #${value}` : null);

  return (
    <Field id={id} label={label}>
      <Select
        value={value}
        onValueChange={(nextValue) => onChange(nextValue ?? "")}
        disabled={disabled}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue placeholder={isBulk ? "Leave unchanged" : "Select…"}>
            {fallbackLabel}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="min-w-[var(--anchor-width)]">
          <SelectItem value="__clear__">Clear selection</SelectItem>
          {!selectedOption && value !== "" ? <SelectItem value={value}>Binding #{value}</SelectItem> : null}
          {options.map((option) => (
            <SelectItem key={option.bindingId} value={String(option.bindingId)}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}
