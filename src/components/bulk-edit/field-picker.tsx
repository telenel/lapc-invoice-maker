"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { bulkEditFieldPickerSections } from "@/domains/bulk-edit/field-registry";
import type { BulkEditFieldDefinition, BulkEditFieldId } from "@/domains/bulk-edit/types";

interface FieldPickerProps {
  selectedFieldIds: BulkEditFieldId[];
  onChange: (next: BulkEditFieldId[]) => void;
  maxFields?: number;
  disabled?: boolean;
}

export function FieldPicker({
  selectedFieldIds,
  onChange,
  maxFields = 5,
  disabled = false,
}: FieldPickerProps) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();

  const visibleSections = useMemo(() => {
    return bulkEditFieldPickerSections
      .map((section) => ({
        ...section,
        fields: section.fields.filter((field) => matchesField(field, normalizedQuery)),
      }))
      .filter((section) => section.fields.length > 0);
  }, [normalizedQuery]);

  function toggleField(fieldId: BulkEditFieldId, checked: boolean) {
    if (checked) {
      if (selectedFieldIds.includes(fieldId) || selectedFieldIds.length >= maxFields) return;
      onChange([...selectedFieldIds, fieldId]);
      return;
    }

    onChange(selectedFieldIds.filter((selectedFieldId) => selectedFieldId !== fieldId));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h3 className="text-sm font-medium">Choose fields</h3>
          <p className="text-xs text-muted-foreground">
            Selected {selectedFieldIds.length} of {maxFields} fields
          </p>
        </div>
        <div className="w-full sm:max-w-xs">
          <label htmlFor="bulk-edit-field-search" className="mb-1 block text-sm font-medium">
            Search fields
          </label>
          <Input
            id="bulk-edit-field-search"
            type="search"
            autoComplete="off"
            placeholder="Search by field name..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            disabled={disabled}
          />
        </div>
      </div>

      <p className="rounded border border-muted bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        Choose up to {maxFields} fields per run to keep previews reviewable. Fill-rate hints show how often each field is populated in the current catalog mirror.
      </p>

      {visibleSections.length === 0 ? (
        <p className="rounded border border-dashed px-3 py-6 text-sm text-muted-foreground">
          No fields match that search.
        </p>
      ) : (
        <div className="space-y-4">
          {visibleSections.map((section) => (
            <div key={section.group} className="space-y-2">
              <div>
                <h4 className="text-sm font-medium capitalize">{section.group}</h4>
                <p className="text-xs text-muted-foreground">
                  {section.group === "inventory"
                    ? "Location-aware inventory fields"
                    : section.group === "primary"
                      ? "Shared item and detail fields"
                      : "Additional fields"}
                </p>
              </div>

              <div className="grid gap-2 md:grid-cols-2">
                {section.fields.map((field) => {
                  const checked = selectedFieldIds.includes(field.id);
                  const capReached = !checked && selectedFieldIds.length >= maxFields;

                  return (
                    <label
                      key={field.id}
                      className={`flex cursor-pointer items-start gap-3 rounded border px-3 py-2 text-sm ${
                        checked ? "border-foreground/20 bg-muted/40" : "border-border"
                      } ${capReached || disabled ? "cursor-not-allowed opacity-60" : ""}`}
                    >
                      <input
                        type="checkbox"
                        aria-label={`Select ${field.label}`}
                        checked={checked}
                        disabled={disabled || capReached}
                        onChange={(event) => toggleField(field.id, event.target.checked)}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{field.label}</span>
                          {field.requiresLocation ? (
                            <span className="rounded bg-blue-500/10 px-1.5 py-0.5 text-[11px] text-blue-700 dark:text-blue-300">
                              inventory scope
                            </span>
                          ) : null}
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          Fill rate: {field.fillRateLabel}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function matchesField(field: BulkEditFieldDefinition, normalizedQuery: string): boolean {
  if (normalizedQuery.length === 0) return true;

  return (
    field.label.toLowerCase().includes(normalizedQuery) ||
    field.id.toLowerCase().includes(normalizedQuery) ||
    field.group.toLowerCase().includes(normalizedQuery)
  );
}
