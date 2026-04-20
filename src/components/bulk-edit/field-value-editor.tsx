"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDccLabel, normalizePackageTypeLabel, type PrismRefs } from "@/domains/product/ref-data";
import { getBulkEditFieldDefinition } from "@/domains/bulk-edit/field-registry";
import type { BulkEditFieldId, BulkEditFieldValue } from "@/domains/bulk-edit/types";

interface FieldValueEditorProps {
  fieldId: BulkEditFieldId;
  value: BulkEditFieldValue | undefined;
  onChange: (value: BulkEditFieldValue) => void;
  refs: PrismRefs | null;
  refsLoading: boolean;
  refsAvailable: boolean;
  disabled?: boolean;
}

export function FieldValueEditor({
  fieldId,
  value,
  onChange,
  refs,
  refsLoading,
  refsAvailable,
  disabled = false,
}: FieldValueEditorProps) {
  const definition = getBulkEditFieldDefinition(fieldId);
  const selectOptions = getSelectOptions(fieldId, refs);
  const selectDisabled = disabled || (definition.refOptionKey !== undefined && (refsLoading || !refsAvailable));
  const inputValue = value == null ? "" : String(value);

  if (fieldId === "description") {
    return (
      <div className="space-y-1.5">
        <Label htmlFor={`bulk-edit-value-${fieldId}`}>{definition.label}</Label>
        <Textarea
          id={`bulk-edit-value-${fieldId}`}
          rows={3}
          value={inputValue}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
        />
      </div>
    );
  }

  if (isBooleanField(fieldId)) {
    return (
      <div className="space-y-1.5">
        <Label htmlFor={`bulk-edit-value-${fieldId}`}>{definition.label}</Label>
        <select
          id={`bulk-edit-value-${fieldId}`}
          aria-label={definition.label}
          value={inputValue}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          className="h-9 w-full rounded border bg-transparent px-2"
        >
          <option value="">Choose…</option>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      </div>
    );
  }

  if (definition.refOptionKey) {
    return (
      <div className="space-y-1.5">
        <Label htmlFor={`bulk-edit-value-${fieldId}`}>{definition.label}</Label>
        <select
          id={`bulk-edit-value-${fieldId}`}
          aria-label={definition.label}
          value={inputValue}
          onChange={(event) => onChange(event.target.value)}
          disabled={selectDisabled}
          className="h-9 w-full rounded border bg-transparent px-2"
        >
          <option value="">
            {refsLoading
              ? "Loading reference data..."
              : refsAvailable
                ? "Choose…"
                : "Reference data unavailable"}
          </option>
          {selectOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (isNumericField(fieldId)) {
    return (
      <div className="space-y-1.5">
        <Label htmlFor={`bulk-edit-value-${fieldId}`}>{definition.label}</Label>
        <Input
          id={`bulk-edit-value-${fieldId}`}
          aria-label={definition.label}
          type="number"
          step={fieldId === "unitsPerPack" || fieldId === "estSales" ? "1" : "0.01"}
          autoComplete="off"
          value={inputValue}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
        />
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor={`bulk-edit-value-${fieldId}`}>{definition.label}</Label>
      <Input
        id={`bulk-edit-value-${fieldId}`}
        aria-label={definition.label}
        autoComplete="off"
        value={inputValue}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
      />
    </div>
  );
}

function isBooleanField(fieldId: BulkEditFieldId): boolean {
  return [
    "fListPriceFlag",
    "fPerishable",
    "fIdRequired",
    "fInvListPriceFlag",
    "fTxWantListFlag",
    "fTxBuybackListFlag",
    "fNoReturns",
    "fDiscontinue",
  ].includes(fieldId);
}

function isNumericField(fieldId: BulkEditFieldId): boolean {
  return [
    "weight",
    "mfgId",
    "styleId",
    "itemSeasonCodeId",
    "orderIncrement",
    "minOrderQtyItem",
    "unitsPerPack",
    "retail",
    "cost",
    "expectedCost",
    "estSales",
  ].includes(fieldId);
}

function getSelectOptions(fieldId: BulkEditFieldId, refs: PrismRefs | null): Array<{ value: string; label: string }> {
  if (!refs) return [];

  switch (fieldId) {
    case "vendorId":
      return refs.vendors.map((row) => ({ value: String(row.vendorId), label: row.name }));
    case "dccId":
      return refs.dccs.map((row) => ({ value: String(row.dccId), label: formatDccLabel(row) }));
    case "itemTaxTypeId":
      return refs.taxTypes.map((row) => ({ value: String(row.taxTypeId), label: row.description }));
    case "bindingId":
      return refs.bindings.map((row) => ({ value: String(row.bindingId), label: row.label }));
    case "tagTypeId":
      return refs.tagTypes.map((row) => ({ value: String(row.tagTypeId), label: row.label }));
    case "statusCodeId":
      return refs.statusCodes.map((row) => ({ value: String(row.statusCodeId), label: row.label }));
    case "usedDccId":
      return refs.dccs.map((row) => ({ value: String(row.dccId), label: formatDccLabel(row) }));
    case "packageType":
      return refs.packageTypes.map((row) => ({ value: row.code, label: normalizePackageTypeLabel(row) }));
    case "colorId":
      return refs.colors.map((row) => ({ value: String(row.colorId), label: row.label }));
    default:
      return [];
  }
}
