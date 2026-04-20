"use client";

import { FieldPicker } from "@/components/bulk-edit/field-picker";
import { FieldValueEditor } from "@/components/bulk-edit/field-value-editor";
import { Button } from "@/components/ui/button";
import type { BulkEditFieldEditRequest, BulkEditFieldId } from "@/domains/bulk-edit/types";
import { getBulkEditFieldDefinition } from "@/domains/bulk-edit/field-registry";
import { useProductRefDirectory } from "@/domains/product/vendor-directory";

interface TransformPanelProps {
  transform: BulkEditFieldEditRequest["transform"];
  onChange: (next: BulkEditFieldEditRequest["transform"]) => void;
  onPreview: () => void;
  previewing: boolean;
  disabled: boolean;
}

export function TransformPanel({ transform, onChange, onPreview, previewing, disabled }: TransformPanelProps) {
  const { refs, loading, available } = useProductRefDirectory();
  const refsUnavailable = !loading && !available;
  const selectedFields = transform.fieldIds.map((fieldId) => getBulkEditFieldDefinition(fieldId));
  const needsInventoryScope = selectedFields.some((field) => field.requiresLocation);
  const needsReferenceData = selectedFields.some((field) => field.refOptionKey !== undefined);
  const missingInventoryScope = needsInventoryScope && transform.inventoryScope === null;

  return (
    <section aria-labelledby="transform-heading" className="space-y-3 rounded border p-4">
      <h2 id="transform-heading" className="text-base font-semibold">2. Transform</h2>

      <FieldPicker
        selectedFieldIds={transform.fieldIds}
        onChange={(fieldIds) => {
          const allowedFields = new Set(fieldIds);
          const nextValues = Object.fromEntries(
            Object.entries(transform.values).filter(([fieldId]) => allowedFields.has(fieldId as BulkEditFieldId)),
          );
          const nextNeedsInventoryScope = fieldIds.some((fieldId) => getBulkEditFieldDefinition(fieldId).requiresLocation);

          onChange({
            fieldIds,
            inventoryScope: nextNeedsInventoryScope ? transform.inventoryScope : null,
            values: nextValues,
          });
        }}
        disabled={disabled}
      />

      {transform.fieldIds.length > 0 ? (
        <div className="space-y-3 rounded border border-muted bg-muted/20 p-3">
          <div>
            <h3 className="text-sm font-medium">Field values</h3>
            <p className="text-xs text-muted-foreground">
              Set only the values you want applied. Selected fields without a meaningful value become a no-op for that field.
            </p>
          </div>

          {needsReferenceData && loading ? (
            <div role="status" aria-live="polite" className="rounded border border-amber-300/70 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800/70 dark:bg-amber-950/30 dark:text-amber-200">
              Loading reference data...
            </div>
          ) : null}
          {needsReferenceData && refsUnavailable ? (
            <div role="alert" aria-live="polite" className="rounded border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              Reference data is unavailable right now. Reference-backed editors are temporarily disabled.
            </div>
          ) : null}

          {needsInventoryScope ? (
            <div className="space-y-1.5">
              <label htmlFor="bulk-edit-inventory-scope" className="text-sm font-medium">
                Inventory scope
              </label>
              <select
                id="bulk-edit-inventory-scope"
                aria-label="Inventory scope"
                value={transform.inventoryScope === null ? "" : String(transform.inventoryScope)}
                onChange={(event) => {
                  const value = event.target.value;
                  onChange({
                    ...transform,
                    inventoryScope:
                      value === ""
                        ? null
                        : value === "primary" || value === "all"
                          ? value
                          : Number(value) as 2 | 3 | 4,
                  });
                }}
                disabled={disabled}
                className="h-9 w-full rounded border bg-transparent px-2"
              >
                <option value="">Choose inventory scope…</option>
                <option value="primary">Primary location only</option>
                <option value="all">All inventory rows</option>
                <option value="2">Pierce (2)</option>
                <option value="3">PCOP (3)</option>
                <option value="4">PFS (4)</option>
              </select>
              {missingInventoryScope ? (
                <p role="alert" className="text-xs text-destructive">
                  Choose an inventory scope before previewing location-aware field changes.
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            {transform.fieldIds.map((fieldId) => (
              <FieldValueEditor
                key={fieldId}
                fieldId={fieldId}
                value={transform.values[fieldId]}
                onChange={(value) =>
                  onChange({
                    ...transform,
                    values: {
                      ...transform.values,
                      [fieldId]: value,
                    },
                  })
                }
                refs={refs}
                refsLoading={loading}
                refsAvailable={available}
                disabled={disabled}
              />
            ))}
          </div>
        </div>
      ) : (
        <p className="rounded border border-dashed px-3 py-6 text-sm text-muted-foreground">
          Pick at least one field to unlock the Phase 8 value editors.
        </p>
      )}

      <div className="flex justify-end">
        <Button onClick={onPreview} disabled={previewing || disabled || transform.fieldIds.length === 0 || missingInventoryScope}>
          {previewing ? "Building preview..." : "Preview ->"}
        </Button>
      </div>
    </section>
  );
}
