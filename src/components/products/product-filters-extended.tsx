"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ProductFilters } from "@/domains/product/types";

interface ProductFiltersExtendedProps {
  filters: ProductFilters;
  onChange: (patch: Partial<ProductFilters>) => void;
}

/**
 * Extended filter sub-sections: Stock, Classification, Data Quality, Margin,
 * Activity, Status. Emits a PARTIAL patch on every change; the parent merges
 * it into the current filters object.
 *
 * Classification currently renders three numeric inputs for deptNum/classNum/
 * catNum. Task 23 will replace these with a DccPicker typeahead.
 */
export function ProductFiltersExtended({
  filters,
  onChange,
}: ProductFiltersExtendedProps) {
  return (
    <div className="space-y-4 border-t border-border/50 pt-4">
      {/* Stock */}
      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Stock
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="grid gap-1.5">
            <Label htmlFor="pf-min-stock">Min stock</Label>
            <Input
              id="pf-min-stock"
              type="number"
              inputMode="numeric"
              min="0"
              placeholder="0"
              value={filters.minStock}
              onChange={(e) => onChange({ minStock: e.target.value })}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="pf-max-stock">Max stock</Label>
            <Input
              id="pf-max-stock"
              type="number"
              inputMode="numeric"
              min="0"
              placeholder="0"
              value={filters.maxStock}
              onChange={(e) => onChange({ maxStock: e.target.value })}
            />
          </div>
        </div>
      </section>

      {/* Classification */}
      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Classification
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="grid gap-1.5">
            <Label htmlFor="pf-dept-num">Department #</Label>
            <Input
              id="pf-dept-num"
              type="number"
              inputMode="numeric"
              placeholder="e.g. 100"
              value={filters.deptNum}
              onChange={(e) => onChange({ deptNum: e.target.value })}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="pf-class-num">Class #</Label>
            <Input
              id="pf-class-num"
              type="number"
              inputMode="numeric"
              placeholder="e.g. 10"
              value={filters.classNum}
              onChange={(e) => onChange({ classNum: e.target.value })}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="pf-cat-num">Category #</Label>
            <Input
              id="pf-cat-num"
              type="number"
              inputMode="numeric"
              placeholder="e.g. 1"
              value={filters.catNum}
              onChange={(e) => onChange({ catNum: e.target.value })}
            />
          </div>
        </div>
      </section>

      {/* Data Quality */}
      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Data quality
        </h3>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <label
            htmlFor="pf-missing-barcode"
            className="flex items-center gap-2 text-sm"
          >
            <input
              id="pf-missing-barcode"
              type="checkbox"
              className="size-4 rounded border-border"
              checked={filters.missingBarcode}
              onChange={(e) => onChange({ missingBarcode: e.target.checked })}
            />
            Missing barcode
          </label>
          <label
            htmlFor="pf-missing-isbn"
            className="flex items-center gap-2 text-sm"
          >
            <input
              id="pf-missing-isbn"
              type="checkbox"
              className="size-4 rounded border-border"
              checked={filters.missingIsbn}
              onChange={(e) => onChange({ missingIsbn: e.target.checked })}
            />
            Missing ISBN
          </label>
          <label
            htmlFor="pf-missing-title"
            className="flex items-center gap-2 text-sm"
          >
            <input
              id="pf-missing-title"
              type="checkbox"
              className="size-4 rounded border-border"
              checked={filters.missingTitle}
              onChange={(e) => onChange({ missingTitle: e.target.checked })}
            />
            Missing title
          </label>
          <label
            htmlFor="pf-retail-below-cost"
            className="flex items-center gap-2 text-sm"
          >
            <input
              id="pf-retail-below-cost"
              type="checkbox"
              className="size-4 rounded border-border"
              checked={filters.retailBelowCost}
              onChange={(e) => onChange({ retailBelowCost: e.target.checked })}
            />
            Retail below cost
          </label>
          <label
            htmlFor="pf-zero-price"
            className="flex items-center gap-2 text-sm"
          >
            <input
              id="pf-zero-price"
              type="checkbox"
              className="size-4 rounded border-border"
              checked={filters.zeroPrice}
              onChange={(e) => onChange({ zeroPrice: e.target.checked })}
            />
            Zero price
          </label>
        </div>
      </section>

      {/* Margin */}
      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Margin{" "}
          <span className="font-normal normal-case text-muted-foreground/80">
            (decimal, e.g. 0.4 for 40%)
          </span>
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="grid gap-1.5">
            <Label htmlFor="pf-min-margin">Min margin</Label>
            <Input
              id="pf-min-margin"
              type="number"
              inputMode="decimal"
              step="0.01"
              placeholder="0.00"
              value={filters.minMargin}
              onChange={(e) => onChange({ minMargin: e.target.value })}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="pf-max-margin">Max margin</Label>
            <Input
              id="pf-max-margin"
              type="number"
              inputMode="decimal"
              step="0.01"
              placeholder="1.00"
              value={filters.maxMargin}
              onChange={(e) => onChange({ maxMargin: e.target.value })}
            />
          </div>
        </div>
      </section>

      {/* Activity */}
      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Activity
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="grid gap-1.5">
            <Label htmlFor="pf-last-sale-within">Last sale within</Label>
            <select
              id="pf-last-sale-within"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              value={filters.lastSaleWithin}
              onChange={(e) =>
                onChange({
                  lastSaleWithin: e.target
                    .value as ProductFilters["lastSaleWithin"],
                })
              }
            >
              <option value="">Any</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="365d">Last 365 days</option>
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="pf-last-sale-older-than">Last sale older than</Label>
            <select
              id="pf-last-sale-older-than"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              value={filters.lastSaleOlderThan}
              onChange={(e) =>
                onChange({
                  lastSaleOlderThan: e.target
                    .value as ProductFilters["lastSaleOlderThan"],
                })
              }
            >
              <option value="">Any</option>
              <option value="2y">Over 2 years</option>
              <option value="5y">Over 5 years</option>
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="pf-edited-within">Edited within</Label>
            <select
              id="pf-edited-within"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              value={filters.editedWithin}
              onChange={(e) =>
                onChange({
                  editedWithin: e.target
                    .value as ProductFilters["editedWithin"],
                })
              }
            >
              <option value="">Any</option>
              <option value="7d">Last 7 days</option>
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label className="invisible">Flags</Label>
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="pf-last-sale-never"
                className="flex items-center gap-2 text-sm"
              >
                <input
                  id="pf-last-sale-never"
                  type="checkbox"
                  className="size-4 rounded border-border"
                  checked={filters.lastSaleNever}
                  onChange={(e) =>
                    onChange({ lastSaleNever: e.target.checked })
                  }
                />
                Never sold
              </label>
              <label
                htmlFor="pf-edited-since-sync"
                className="flex items-center gap-2 text-sm"
              >
                <input
                  id="pf-edited-since-sync"
                  type="checkbox"
                  className="size-4 rounded border-border"
                  checked={filters.editedSinceSync}
                  onChange={(e) =>
                    onChange({ editedSinceSync: e.target.checked })
                  }
                />
                Edited since sync
              </label>
            </div>
          </div>
        </div>
      </section>

      {/* Status */}
      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Status
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="grid gap-1.5">
            <Label htmlFor="pf-discontinued">Discontinued</Label>
            <select
              id="pf-discontinued"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              value={filters.discontinued}
              onChange={(e) =>
                onChange({
                  discontinued: e.target
                    .value as ProductFilters["discontinued"],
                })
              }
            >
              <option value="">Any</option>
              <option value="yes">Discontinued</option>
              <option value="no">Active</option>
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="pf-item-type">Item type</Label>
            <select
              id="pf-item-type"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              value={filters.itemType}
              onChange={(e) =>
                onChange({
                  itemType: e.target.value as ProductFilters["itemType"],
                })
              }
            >
              <option value="">Any</option>
              <option value="textbook">Textbook</option>
              <option value="used_textbook">Used textbook</option>
              <option value="general_merchandise">General merchandise</option>
              <option value="supplies">Supplies</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>
      </section>
    </div>
  );
}
