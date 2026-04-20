"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { BulkEditSelection, ProductFilters } from "@/domains/bulk-edit/types";

export interface BulkEditSelectionSummaryItem {
  sku: number;
  displayName: string;
  barcode: string | null;
  vendorLabel: string | null;
  dccLabel: string | null;
  typeLabel: string;
}

interface SelectionPanelProps {
  selection: BulkEditSelection;
  onChange: (next: BulkEditSelection) => void;
  matchingCount: number | null;
  onSaveSearch: () => void;
  selectedItems?: BulkEditSelectionSummaryItem[];
  selectedItemsLoading?: boolean;
  selectedItemsError?: string | null;
}

export function SelectionPanel({
  selection,
  onChange,
  matchingCount,
  onSaveSearch,
  selectedItems = [],
  selectedItemsLoading = false,
  selectedItemsError = null,
}: SelectionPanelProps) {
  const [pasteValue, setPasteValue] = useState("");

  function setFilter<K extends keyof ProductFilters>(key: K, value: ProductFilters[K] | undefined) {
    onChange({
      ...selection,
      skus: undefined,
      filter: { ...(selection.filter ?? {}), [key]: value },
    });
  }

  function applyPaste() {
    const parsed = pasteValue
      .split(/[\s,]+/)
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isInteger(n) && n > 0);
    onChange({ ...selection, skus: parsed, filter: undefined });
  }

  function clear() {
    onChange({ scope: selection.scope });
    setPasteValue("");
  }

  const filter = selection.filter ?? {};

  return (
    <section aria-labelledby="selection-heading" className="space-y-3 rounded border p-4">
      <div className="flex items-baseline justify-between">
        <h2 id="selection-heading" className="text-base font-semibold">1. Select</h2>
        <span className="text-sm tabular-nums text-muted-foreground">
          {matchingCount === null ? "-" : `${matchingCount.toLocaleString()} matching`}
          {selection.skus?.length ? ` / ${selection.skus.length} pasted` : ""}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Label className="flex items-center gap-2">
          <span>Scope:</span>
          <select
            name="scope"
            value={selection.scope}
            onChange={(e) => onChange({ ...selection, scope: e.target.value as BulkEditSelection["scope"] })}
            className="h-8 rounded border bg-transparent px-2"
          >
            <option value="pierce">Pierce only</option>
            <option value="district">All campuses</option>
          </select>
        </Label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="q">Search description</Label>
          <Input
            id="q"
            name="q"
            autoComplete="off"
            value={filter.q ?? ""}
            onChange={(e) => setFilter("q", e.target.value || undefined)}
            placeholder="e.g. mug..."
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="vendorId">Vendor ID</Label>
          <Input
            id="vendorId"
            name="vendorId"
            type="number"
            min="0"
            autoComplete="off"
            value={filter.vendorId ?? ""}
            onChange={(e) => setFilter("vendorId", e.target.value ? Number(e.target.value) : undefined)}
            placeholder="21"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="dccId">DCC ID</Label>
          <Input
            id="dccId"
            name="dccId"
            type="number"
            min="0"
            autoComplete="off"
            value={filter.dccId ?? ""}
            onChange={(e) => setFilter("dccId", e.target.value ? Number(e.target.value) : undefined)}
            placeholder="1968650"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="itemType">Item type</Label>
          <select
            id="itemType"
            name="itemType"
            value={filter.itemType ?? ""}
            onChange={(e) => setFilter("itemType", (e.target.value || undefined) as ProductFilters["itemType"])}
            className="h-9 w-full rounded border bg-transparent px-2"
          >
            <option value="">Any</option>
            <option value="general_merchandise">Merchandise</option>
            <option value="textbook">Textbook</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="minRetail">Min retail</Label>
          <Input
            id="minRetail"
            name="minRetail"
            type="number"
            step="0.01"
            min="0"
            autoComplete="off"
            value={filter.minRetail ?? ""}
            onChange={(e) => setFilter("minRetail", e.target.value ? Number(e.target.value) : undefined)}
            placeholder="0.00"
            className="tabular-nums"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="maxRetail">Max retail</Label>
          <Input
            id="maxRetail"
            name="maxRetail"
            type="number"
            step="0.01"
            min="0"
            autoComplete="off"
            value={filter.maxRetail ?? ""}
            onChange={(e) => setFilter("maxRetail", e.target.value ? Number(e.target.value) : undefined)}
            placeholder="-"
            className="tabular-nums"
          />
        </div>
      </div>

      <details>
        <summary className="cursor-pointer text-sm text-muted-foreground">Paste SKU list (overrides filters)</summary>
        <div className="mt-2 space-y-2">
          <Textarea
            name="pasteSkus"
            rows={3}
            placeholder="Paste SKUs separated by whitespace or commas..."
            value={pasteValue}
            onChange={(e) => setPasteValue(e.target.value)}
          />
          <Button variant="outline" size="sm" onClick={applyPaste} disabled={pasteValue.trim().length === 0}>
            Use this list
          </Button>
        </div>
      </details>

      {selection.skus?.length ? (
        <div className="space-y-2 rounded border border-muted bg-muted/20 p-3">
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <h3 className="text-sm font-medium">Selected items</h3>
              <p className="text-xs text-muted-foreground">
                {selectedItems.length > 0
                  ? `${selectedItems.length} item${selectedItems.length === 1 ? "" : "s"} resolved from the current SKU selection.`
                  : `${selection.skus.length} SKU${selection.skus.length === 1 ? "" : "s"} selected.`}
              </p>
            </div>
          </div>

          {selectedItemsLoading ? (
            <p role="status" className="text-sm text-muted-foreground">
              Resolving selected item identities…
            </p>
          ) : null}

          {selectedItemsError ? (
            <p role="alert" className="text-sm text-destructive">
              {selectedItemsError}
            </p>
          ) : null}

          {!selectedItemsLoading && !selectedItemsError && selectedItems.length > 0 ? (
            <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
              {selectedItems.map((item) => (
                <div key={item.sku} className="rounded border bg-background px-3 py-2 text-sm">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div>
                      <div className="font-mono text-xs text-muted-foreground">SKU {item.sku}</div>
                      <div className="font-medium">{item.displayName}</div>
                    </div>
                    <span className="rounded bg-muted px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      {item.typeLabel}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    {item.barcode ? <span>{item.barcode}</span> : null}
                    {item.vendorLabel ? <span>{item.vendorLabel}</span> : null}
                    {item.dccLabel ? <span>{item.dccLabel}</span> : null}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={clear}>Clear</Button>
        <Button variant="outline" size="sm" onClick={onSaveSearch}>Save Search</Button>
      </div>
    </section>
  );
}
