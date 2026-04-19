import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type {
  ProductAnalysisWindow,
  ProductSummaryResponse,
} from "@/domains/product/summary-types";
import { ProductsFreshnessBanner } from "./products-freshness-banner";

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function SummaryCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "danger" | "warning" | "muted";
}) {
  const toneClass =
    tone === "danger"
      ? "border-red-200/70 bg-red-50/70"
      : tone === "warning"
        ? "border-amber-200/70 bg-amber-50/70"
        : tone === "muted"
          ? "border-border/70 bg-muted/30"
          : "border-border/70";

  return (
    <Card size="sm" className={`border ${toneClass}`}>
      <CardHeader className="gap-1">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}

export function ProductsSummaryStrip({
  summary,
  analysisWindow,
  onAnalysisWindowChange,
}: {
  summary: ProductSummaryResponse;
  analysisWindow: ProductAnalysisWindow;
  onAnalysisWindowChange: (window: ProductAnalysisWindow) => void;
}) {
  const windows: ProductAnalysisWindow[] = ["30d", "90d", "1y"];

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground">Analysis summary</h2>
          <p className="text-xs text-muted-foreground">
            Exact metrics for the full filtered result set.
          </p>
        </div>
        <div className="inline-flex w-fit rounded-full border bg-background p-1 text-xs">
          {windows.map((window) => (
            <button
              key={window}
              type="button"
              onClick={() => onAnalysisWindowChange(window)}
              className={
                window === analysisWindow
                  ? "rounded-full bg-primary px-3 py-1 font-medium text-primary-foreground"
                  : "rounded-full px-3 py-1 text-muted-foreground transition-colors hover:text-foreground"
              }
            >
              {window}
            </button>
          ))}
        </div>
      </div>

      <ProductsFreshnessBanner
        trust={summary.freshness.analyticsTrust}
        latestSyncCompletedAt={summary.freshness.latestSyncCompletedAt}
        latestSyncStatus={summary.freshness.latestSyncStatus}
      />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <SummaryCard label="Rows" value={summary.metrics.resultCount.toLocaleString()} />
        <SummaryCard label="Stock Units" value={summary.metrics.stockUnits.toLocaleString()} />
        <SummaryCard label="Stock Cost" value={formatMoney(summary.metrics.stockCost)} />
        <SummaryCard label="Retail Value" value={formatMoney(summary.metrics.stockRetailValue)} />
        <SummaryCard label={`Revenue ${analysisWindow}`} value={formatMoney(summary.metrics.revenueWindowValue)} />
        <SummaryCard label="Gross Profit 1y" value={formatMoney(summary.metrics.grossProfit1y)} />
        <SummaryCard label="Inventory At Risk" value={formatMoney(summary.metrics.inventoryAtRiskCost)} tone="danger" />
        <SummaryCard label="No Sales 1y" value={summary.metrics.noSalesCount1y.toLocaleString()} tone="muted" />
        <SummaryCard label="Stockout Risk" value={summary.metrics.stockoutRiskCount.toLocaleString()} tone="warning" />
        <SummaryCard
          label="Units / Receipt 1y"
          value={summary.metrics.unitsPerReceipt1y == null ? "—" : summary.metrics.unitsPerReceipt1y.toFixed(1)}
        />
      </div>
    </div>
  );
}
