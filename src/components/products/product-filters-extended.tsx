"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DccPicker } from "./dcc-picker";
import type { ProductFilters } from "@/domains/product/types";

interface ProductFiltersExtendedProps {
  filters: ProductFilters;
  onChange: (patch: Partial<ProductFilters>) => void;
}

export function getLastSaleNeverPatch(
  enabled: boolean,
): Partial<ProductFilters> {
  if (!enabled) {
    return { lastSaleNever: false };
  }

  return {
    lastSaleNever: true,
    lastSaleWithin: "",
    lastSaleOlderThan: "",
    lastSaleDateFrom: "",
    lastSaleDateTo: "",
  };
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
            <DccPicker
              deptNum={filters.deptNum}
              classNum={filters.classNum}
              catNum={filters.catNum}
              onChange={onChange}
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
              onChange={(e) => {
                const next = e.target.value as ProductFilters["lastSaleWithin"];
                // Clear mutually exclusive sale-state filters so the window
                // can't form an impossible conjunction with lastSaleNever /
                // lastSaleOlderThan or a stale absolute date bound.
                if (next) {
                  onChange({
                    lastSaleWithin: next,
                    lastSaleOlderThan: "",
                    lastSaleNever: false,
                    lastSaleDateFrom: "",
                    lastSaleDateTo: "",
                  });
                } else {
                  onChange({ lastSaleWithin: next });
                }
              }}
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
              onChange={(e) => {
                const next = e.target.value as ProductFilters["lastSaleOlderThan"];
                if (next) {
                  onChange({
                    lastSaleOlderThan: next,
                    lastSaleWithin: "",
                    lastSaleNever: false,
                    lastSaleDateFrom: "",
                    lastSaleDateTo: "",
                  });
                } else {
                  onChange({ lastSaleOlderThan: next });
                }
              }}
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
                    onChange(getLastSaleNeverPatch(e.target.checked))
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

      {/* Sales analytics */}
      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Sales analytics
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="grid gap-1.5">
            <Label htmlFor="pf-units-window">Units sold window</Label>
            <select
              id="pf-units-window"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              value={filters.unitsSoldWindow}
              onChange={(e) =>
                onChange({
                  unitsSoldWindow: e.target.value as ProductFilters["unitsSoldWindow"],
                })
              }
            >
              <option value="">Any</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="1y">Last year</option>
              <option value="3y">Last 3 years</option>
              <option value="lifetime">Lifetime</option>
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="pf-min-units">Min units sold</Label>
            <Input
              id="pf-min-units"
              type="number"
              inputMode="numeric"
              min="0"
              placeholder="0"
              value={filters.minUnitsSold}
              onChange={(e) => onChange({ minUnitsSold: e.target.value })}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="pf-max-units">Max units sold</Label>
            <Input
              id="pf-max-units"
              type="number"
              inputMode="numeric"
              min="0"
              placeholder="0"
              value={filters.maxUnitsSold}
              onChange={(e) => onChange({ maxUnitsSold: e.target.value })}
            />
          </div>
          <div className="grid gap-1.5">
            <Label className="invisible">Lifetime</Label>
            <label
              htmlFor="pf-never-sold-lifetime"
              className="flex h-9 items-center gap-2 text-sm"
            >
              <input
                id="pf-never-sold-lifetime"
                type="checkbox"
                className="size-4 rounded border-border"
                checked={filters.neverSoldLifetime}
                onChange={(e) => onChange({ neverSoldLifetime: e.target.checked })}
              />
              Never sold lifetime
            </label>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="grid gap-1.5">
            <Label htmlFor="pf-revenue-window">Revenue window</Label>
            <select
              id="pf-revenue-window"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              value={filters.revenueWindow}
              onChange={(e) =>
                onChange({
                  revenueWindow: e.target.value as ProductFilters["revenueWindow"],
                })
              }
            >
              <option value="">Any</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="1y">Last year</option>
              <option value="3y">Last 3 years</option>
              <option value="lifetime">Lifetime</option>
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="pf-min-revenue">Min revenue</Label>
            <Input
              id="pf-min-revenue"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={filters.minRevenue}
              onChange={(e) => onChange({ minRevenue: e.target.value })}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="pf-max-revenue">Max revenue</Label>
            <Input
              id="pf-max-revenue"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={filters.maxRevenue}
              onChange={(e) => onChange({ maxRevenue: e.target.value })}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="grid gap-1.5">
            <Label htmlFor="pf-txns-window">Receipt window</Label>
            <select
              id="pf-txns-window"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              value={filters.txnsWindow}
              onChange={(e) =>
                onChange({
                  txnsWindow: e.target.value as ProductFilters["txnsWindow"],
                })
              }
            >
              <option value="">Any</option>
              <option value="1y">Last year</option>
              <option value="lifetime">Lifetime</option>
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="pf-min-txns">Min receipts</Label>
            <Input
              id="pf-min-txns"
              type="number"
              inputMode="numeric"
              min="0"
              placeholder="0"
              value={filters.minTxns}
              onChange={(e) => onChange({ minTxns: e.target.value })}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="pf-max-txns">Max receipts</Label>
            <Input
              id="pf-max-txns"
              type="number"
              inputMode="numeric"
              min="0"
              placeholder="0"
              value={filters.maxTxns}
              onChange={(e) => onChange({ maxTxns: e.target.value })}
            />
          </div>
        </div>
      </section>

      {/* Derived signals */}
      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Derived signals
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="grid gap-1.5">
            <Label htmlFor="pf-first-sale-within">First sale within</Label>
            <select
              id="pf-first-sale-within"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              value={filters.firstSaleWithin}
              onChange={(e) =>
                onChange({
                  firstSaleWithin: e.target.value as ProductFilters["firstSaleWithin"],
                })
              }
            >
              <option value="">Any</option>
              <option value="90d">Last 90 days</option>
              <option value="1y">Last year</option>
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="pf-trend-direction">Trend</Label>
            <select
              id="pf-trend-direction"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              value={filters.trendDirection}
              onChange={(e) =>
                onChange({
                  trendDirection: e.target.value as ProductFilters["trendDirection"],
                })
              }
            >
              <option value="">Any</option>
              <option value="accelerating">Accelerating</option>
              <option value="decelerating">Decelerating</option>
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="pf-max-stock-coverage-days">Max stock coverage days</Label>
            <Input
              id="pf-max-stock-coverage-days"
              type="number"
              inputMode="numeric"
              min="0"
              placeholder="30"
              value={filters.maxStockCoverageDays}
              onChange={(e) => onChange({ maxStockCoverageDays: e.target.value })}
            />
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
