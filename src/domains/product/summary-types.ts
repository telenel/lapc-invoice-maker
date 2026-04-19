export type ProductAnalysisWindow = "30d" | "90d" | "1y";

export interface ProductSummaryMetrics {
  resultCount: number;
  stockUnits: number;
  stockCost: number;
  stockRetailValue: number;
  revenueWindowValue: number;
  grossProfit1y: number;
  inventoryAtRiskCost: number;
  noSalesCount1y: number;
  stockoutRiskCount: number;
  unitsPerReceipt1y: number | null;
}

export interface ProductSummaryFreshness {
  latestSyncStatus: "ok" | "partial" | "failed" | "unknown";
  latestSyncCompletedAt: string | null;
  analyticsPendingCount: number;
  staleAnalyticsCount: number;
  analyticsTrust: "ready" | "partial" | "stale" | "unknown";
}

export interface ProductSummaryResponse {
  analysisWindow: ProductAnalysisWindow;
  metrics: ProductSummaryMetrics;
  freshness: ProductSummaryFreshness;
}

export type ProductRollupGroup = "dcc" | "vendor";

export interface ProductRollupRow {
  key: string;
  label: string;
  skuCount: number;
  stockUnits: number;
  stockCost: number;
  revenue1y: number;
  averageMargin: number | null;
  shareOfStockCost: number;
}

export interface ProductRollupsResponse {
  group: ProductRollupGroup;
  rows: ProductRollupRow[];
}

export interface ProductSummaryRow {
  sku: number;
  stock_on_hand: number | null;
  cost: number | null;
  retail_price: number | null;
  revenue_30d: number | null;
  revenue_90d: number | null;
  revenue_1y: number | null;
  units_sold_30d: number | null;
  units_sold_90d: number | null;
  units_sold_1y: number | null;
  txns_1y: number | null;
  last_sale_date: string | null;
  effective_last_sale_date?: string | null;
  aggregates_ready?: boolean | null;
  margin_ratio?: number | null;
  stock_coverage_days?: number | null;
  sales_aggregates_computed_at: string | null;
}

export interface ProductRollupInputRow {
  sku: number;
  dept_num: number | null;
  class_num: number | null;
  cat_num: number | null;
  dept_name: string | null;
  class_name: string | null;
  cat_name: string | null;
  vendor_id: number | null;
  stock_on_hand: number | null;
  cost: number | null;
  retail_price?: number | null;
  revenue_1y: number | null;
  margin_ratio?: number | null;
}
