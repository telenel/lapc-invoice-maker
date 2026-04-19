import type {
  ProductAnalysisWindow,
  ProductRollupGroup,
  ProductRollupInputRow,
  ProductRollupRow,
  ProductSummaryResponse,
  ProductSummaryRow,
} from "./summary-types";

const STALE_ANALYTICS_MS = 36 * 60 * 60 * 1000;

function getRevenueForWindow(row: ProductSummaryRow, analysisWindow: ProductAnalysisWindow): number {
  if (analysisWindow === "30d") return Number(row.revenue_30d ?? 0);
  if (analysisWindow === "90d") return Number(row.revenue_90d ?? 0);
  return Number(row.revenue_1y ?? 0);
}

function getMarginRatio(row: ProductSummaryRow): number | null {
  if (row.margin_ratio != null) return Number(row.margin_ratio);

  const retail = Number(row.retail_price ?? 0);
  const cost = Number(row.cost ?? 0);
  if (retail <= 0) return null;
  return (retail - cost) / retail;
}

function getRollupMarginRatio(row: ProductRollupInputRow): number | null {
  if (row.margin_ratio != null) return Number(row.margin_ratio);

  const retail = Number(row.retail_price ?? 0);
  const cost = Number(row.cost ?? 0);
  if (retail <= 0) return null;
  return (retail - cost) / retail;
}

export function accumulateProductSummary(
  rows: ProductSummaryRow[],
  analysisWindow: ProductAnalysisWindow = "1y",
  nowMs = Date.now(),
): ProductSummaryResponse {
  let stockUnits = 0;
  let stockCost = 0;
  let stockRetailValue = 0;
  let revenueWindowValue = 0;
  let grossProfit1y = 0;
  let inventoryAtRiskCost = 0;
  let noSalesCount1y = 0;
  let stockoutRiskCount = 0;
  let units1y = 0;
  let txns1y = 0;
  let analyticsPendingCount = 0;
  let staleAnalyticsCount = 0;

  for (const row of rows) {
    const stock = Number(row.stock_on_hand ?? 0);
    const cost = Number(row.cost ?? 0);
    const retail = Number(row.retail_price ?? 0);
    const unitsSold30d = Number(row.units_sold_30d ?? 0);
    const unitsSold1y = Number(row.units_sold_1y ?? 0);
    const txns = Number(row.txns_1y ?? 0);
    const revenue1y = Number(row.revenue_1y ?? 0);
    const marginRatio = getMarginRatio(row);
    const analyticsReady = row.aggregates_ready ?? row.sales_aggregates_computed_at !== null;

    stockUnits += stock;
    stockCost += stock * cost;
    stockRetailValue += stock * retail;
    revenueWindowValue += getRevenueForWindow(row, analysisWindow);
    grossProfit1y += revenue1y * Number(marginRatio ?? 0);
    units1y += unitsSold1y;
    txns1y += txns;

    if (unitsSold1y === 0) {
      noSalesCount1y += 1;
      if (stock > 0) inventoryAtRiskCost += stock * cost;
    }

    if (stock <= 2 && unitsSold30d >= 5) {
      stockoutRiskCount += 1;
    }

    if (!analyticsReady) {
      analyticsPendingCount += 1;
    }

    if (
      row.sales_aggregates_computed_at
      && nowMs - new Date(row.sales_aggregates_computed_at).getTime() > STALE_ANALYTICS_MS
    ) {
      staleAnalyticsCount += 1;
    }
  }

  let analyticsTrust: ProductSummaryResponse["freshness"]["analyticsTrust"] = "unknown";
  if (analyticsPendingCount > 0) {
    analyticsTrust = "partial";
  } else if (staleAnalyticsCount > 0) {
    analyticsTrust = "stale";
  } else if (rows.length > 0) {
    analyticsTrust = "ready";
  }

  return {
    analysisWindow,
    metrics: {
      resultCount: rows.length,
      stockUnits,
      stockCost,
      stockRetailValue,
      revenueWindowValue,
      grossProfit1y,
      inventoryAtRiskCost,
      noSalesCount1y,
      stockoutRiskCount,
      unitsPerReceipt1y: txns1y > 0 ? units1y / txns1y : null,
    },
    freshness: {
      latestSyncStatus: "unknown",
      latestSyncCompletedAt: null,
      analyticsPendingCount,
      staleAnalyticsCount,
      analyticsTrust,
    },
  };
}

export function accumulateGroupedRollups(
  rows: ProductRollupInputRow[],
  group: ProductRollupGroup,
): ProductRollupRow[] {
  const buckets = new Map<string, {
    label: string;
    skuCount: number;
    stockUnits: number;
    stockCost: number;
    revenue1y: number;
    marginWeightedSum: number;
    marginWeight: number;
  }>();

  for (const row of rows) {
    const stock = Number(row.stock_on_hand ?? 0);
    const cost = Number(row.cost ?? 0);
    const revenue1y = Number(row.revenue_1y ?? 0);
    const marginRatio = getRollupMarginRatio(row);
    const key = group === "dcc"
      ? `${row.dept_num ?? ""}.${row.class_num ?? ""}.${row.cat_num ?? ""}`
      : String(row.vendor_id ?? "unknown");
    const label = group === "dcc"
      ? `${key} · ${[row.dept_name, row.class_name, row.cat_name].filter(Boolean).join(" › ")}`
      : `Vendor #${row.vendor_id ?? "unknown"}`;
    const bucket = buckets.get(key) ?? {
      label,
      skuCount: 0,
      stockUnits: 0,
      stockCost: 0,
      revenue1y: 0,
      marginWeightedSum: 0,
      marginWeight: 0,
    };

    bucket.skuCount += 1;
    bucket.stockUnits += stock;
    bucket.stockCost += stock * cost;
    bucket.revenue1y += revenue1y;
    if (marginRatio != null) {
      const weight = Math.max(revenue1y, 1);
      bucket.marginWeightedSum += marginRatio * weight;
      bucket.marginWeight += weight;
    }

    buckets.set(key, bucket);
  }

  const totalStockCost = Array.from(buckets.values()).reduce((sum, bucket) => sum + bucket.stockCost, 0);

  return Array.from(buckets.entries())
    .map(([key, bucket]) => ({
      key,
      label: bucket.label,
      skuCount: bucket.skuCount,
      stockUnits: bucket.stockUnits,
      stockCost: bucket.stockCost,
      revenue1y: bucket.revenue1y,
      averageMargin: bucket.marginWeight > 0 ? bucket.marginWeightedSum / bucket.marginWeight : null,
      shareOfStockCost: totalStockCost > 0 ? bucket.stockCost / totalStockCost : 0,
    }))
    .sort((left, right) => right.stockCost - left.stockCost);
}
