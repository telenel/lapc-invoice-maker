"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import type { PrismRefs } from "@/domains/product/api-client";
import { buildProductRefSelectOptions } from "@/domains/product/ref-data";

export interface ItemRefSelectsProps {
  refs: PrismRefs | null;
  vendorId: string;
  dccId: string;
  itemTaxTypeId: string;
  onChange: (field: "vendorId" | "dccId" | "itemTaxTypeId", value: string) => void;
  /** Bulk-mode: render a "Leave unchanged" placeholder as the default value. */
  bulkMode?: boolean;
  disabled?: boolean;
  /**
   * "stacked" (default) renders each select as its own field with a label, one
   * per row. "inline" drops the labels and lays them out as a 3-column grid —
   * for compact toolbars like the batch-add "Apply to all" strip.
   */
  layout?: "stacked" | "inline";
}

type ItemRefSelectKind = "vendor" | "dcc" | "taxType" | "tagType" | "statusCode" | "packageType" | "color";

const FIELD_CONFIG: Record<
  ItemRefSelectKind,
  { label: string; inlineLabel: string; optionsKey: keyof ReturnType<typeof buildProductRefSelectOptions> }
> = {
  vendor: { label: "Vendor", inlineLabel: "Vendor", optionsKey: "vendors" },
  dcc: { label: "Department / Class", inlineLabel: "Department / Class", optionsKey: "dccs" },
  taxType: { label: "Tax Type", inlineLabel: "Tax Type", optionsKey: "taxTypes" },
  tagType: { label: "Tag Type", inlineLabel: "Tag Type", optionsKey: "tagTypes" },
  statusCode: { label: "Status Code", inlineLabel: "Status Code", optionsKey: "statusCodes" },
  packageType: { label: "Package Type", inlineLabel: "Package Type", optionsKey: "packageTypes" },
  color: { label: "Color", inlineLabel: "Color", optionsKey: "colors" },
};

export interface ItemRefSelectFieldProps {
  refs: PrismRefs | null;
  kind: ItemRefSelectKind;
  value: string;
  onChange: (value: string) => void;
  label?: string;
  id?: string;
  placeholder?: string;
  bulkMode?: boolean;
  disabled?: boolean;
  size?: "default" | "sm";
}

export function ItemRefSelectField({
  refs,
  kind,
  value,
  onChange,
  label,
  id,
  placeholder,
  bulkMode = false,
  disabled = false,
  size = "default",
}: ItemRefSelectFieldProps) {
  const options = buildProductRefSelectOptions(refs)[FIELD_CONFIG[kind].optionsKey];
  const resolvedPlaceholder = placeholder ?? (bulkMode ? "Leave unchanged" : "Select…");
  const triggerClass = "w-full";
  const contentClass = "min-w-[var(--anchor-width)] sm:min-w-80 max-w-[min(32rem,90vw)]";

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label ?? FIELD_CONFIG[kind].label}</Label>
      <Select value={value} onValueChange={(next) => onChange(next ?? "")} disabled={disabled}>
        <SelectTrigger id={id} aria-label={label ?? FIELD_CONFIG[kind].label} className={triggerClass} size={size}>
          <SelectValue placeholder={resolvedPlaceholder} />
        </SelectTrigger>
        <SelectContent className={contentClass}>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function ItemRefSelects({
  refs,
  vendorId,
  dccId,
  itemTaxTypeId,
  onChange,
  bulkMode = false,
  disabled = false,
  layout = "stacked",
}: ItemRefSelectsProps) {
  const placeholder = bulkMode ? "Leave unchanged" : "Select…";
  const selectOptions = buildProductRefSelectOptions(refs);

  if (layout === "inline") {
    return (
      <div className="grid min-w-0 grid-cols-3 gap-2">
        <Select value={vendorId} onValueChange={(v) => onChange("vendorId", v ?? "")} disabled={disabled}>
          <SelectTrigger aria-label={FIELD_CONFIG.vendor.inlineLabel} size="sm" className="w-full">
            <SelectValue placeholder={bulkMode ? "Any vendor" : placeholder} />
          </SelectTrigger>
          <SelectContent className="min-w-[var(--anchor-width)] sm:min-w-80 max-w-[min(32rem,90vw)]">
            {selectOptions.vendors.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={dccId} onValueChange={(v) => onChange("dccId", v ?? "")} disabled={disabled}>
          <SelectTrigger aria-label={FIELD_CONFIG.dcc.inlineLabel} size="sm" className="w-full">
            <SelectValue placeholder={bulkMode ? "Any dept / class" : placeholder} />
          </SelectTrigger>
          <SelectContent className="min-w-[var(--anchor-width)] sm:min-w-80 max-w-[min(32rem,90vw)]">
            {selectOptions.dccs.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={itemTaxTypeId} onValueChange={(v) => onChange("itemTaxTypeId", v ?? "")} disabled={disabled}>
          <SelectTrigger aria-label={FIELD_CONFIG.taxType.inlineLabel} size="sm" className="w-full">
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent className="min-w-[var(--anchor-width)] sm:min-w-80 max-w-[min(32rem,90vw)]">
            {selectOptions.taxTypes.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  return (
    <>
      <ItemRefSelectField
        id="vendor-select"
        refs={refs}
        kind="vendor"
        value={vendorId}
        onChange={(value) => onChange("vendorId", value)}
        disabled={disabled}
        bulkMode={bulkMode}
        placeholder={placeholder}
      />
      <ItemRefSelectField
        id="dcc-select"
        refs={refs}
        kind="dcc"
        value={dccId}
        onChange={(value) => onChange("dccId", value)}
        disabled={disabled}
        bulkMode={bulkMode}
        placeholder={placeholder}
      />
      <ItemRefSelectField
        id="tax-select"
        refs={refs}
        kind="taxType"
        value={itemTaxTypeId}
        onChange={(value) => onChange("itemTaxTypeId", value)}
        disabled={disabled}
        bulkMode={bulkMode}
        placeholder={placeholder}
      />
    </>
  );
}
