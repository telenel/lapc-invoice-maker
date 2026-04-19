import type { ProductRollupGroup, ProductRollupRow } from "@/domains/product/summary-types";

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function ProductsRollupsPanel({
  group,
  rows,
  onGroupChange,
}: {
  group: ProductRollupGroup;
  rows: ProductRollupRow[];
  onGroupChange: (group: ProductRollupGroup) => void;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold">Where value is concentrated</h3>
          <p className="text-xs text-muted-foreground">
            Exact rollups for the current filtered result set.
          </p>
        </div>
        <div className="inline-flex w-fit rounded-full border bg-background p-1 text-xs">
          <button
            type="button"
            onClick={() => onGroupChange("dcc")}
            className={
              group === "dcc"
                ? "rounded-full bg-primary px-3 py-1 font-medium text-primary-foreground"
                : "rounded-full px-3 py-1 text-muted-foreground transition-colors hover:text-foreground"
            }
          >
            DCC
          </button>
          <button
            type="button"
            onClick={() => onGroupChange("vendor")}
            className={
              group === "vendor"
                ? "rounded-full bg-primary px-3 py-1 font-medium text-primary-foreground"
                : "rounded-full px-3 py-1 text-muted-foreground transition-colors hover:text-foreground"
            }
          >
            Vendor
          </button>
        </div>
      </div>

      <div className="space-y-2 text-sm">
        {rows.slice(0, 8).map((row) => (
          <div
            key={row.key}
            className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 rounded-lg bg-muted/40 px-3 py-2"
          >
            <div className="min-w-0">
              <div className="truncate font-medium">{row.label}</div>
              <div className="text-xs text-muted-foreground">
                {row.skuCount} SKUs · {row.stockUnits.toLocaleString()} units
              </div>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              {Math.round(row.shareOfStockCost * 100)}% of stock cost
            </div>
            <div className="text-right font-medium">{formatMoney(row.stockCost)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
