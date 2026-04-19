import type { ProductFilters } from "./types";

export function shouldRequireAggregatesReady(filters: ProductFilters): boolean {
  return (
    (filters.unitsSoldWindow !== "" && (filters.minUnitsSold !== "" || filters.maxUnitsSold !== ""))
    || (filters.revenueWindow !== "" && (filters.minRevenue !== "" || filters.maxRevenue !== ""))
    || (filters.txnsWindow !== "" && (filters.minTxns !== "" || filters.maxTxns !== ""))
    || filters.neverSoldLifetime
    || filters.firstSaleWithin !== ""
    || filters.trendDirection !== ""
    || filters.maxStockCoverageDays !== ""
  );
}

export const hasAnalyticsProductFilters = shouldRequireAggregatesReady;

function hasLastSaleProductFilters(filters: ProductFilters): boolean {
  return (
    filters.lastSaleDateFrom !== ""
    || filters.lastSaleDateTo !== ""
    || filters.lastSaleWithin !== ""
    || filters.lastSaleNever
    || filters.lastSaleOlderThan !== ""
    || filters.sortBy === "last_sale_date"
    || filters.sortBy === "days_since_sale"
  );
}

export function buildProductQueryPlan(filters: ProductFilters): {
  source: "products" | "products_with_derived";
  lastSaleField: "last_sale_date" | "effective_last_sale_date";
  requireAggregatesReady: boolean;
  sortField: string;
  ascending: boolean;
} {
  const requireAggregatesReady = shouldRequireAggregatesReady(filters);
  const needsDerived = requireAggregatesReady
    || filters.minMargin !== ""
    || filters.maxMargin !== ""
    || filters.sortBy === "margin"
    || hasLastSaleProductFilters(filters);
  const source = needsDerived ? "products_with_derived" : "products";
  const lastSaleField = needsDerived ? "effective_last_sale_date" : "last_sale_date";

  let sortField = filters.sortBy;
  let ascending = filters.sortDir !== "desc";
  if (filters.sortBy === "days_since_sale") {
    sortField = lastSaleField;
    ascending = !ascending;
  } else if (filters.sortBy === "last_sale_date" && needsDerived) {
    sortField = "effective_last_sale_date";
  } else if (filters.sortBy === "margin") {
    sortField = "margin_ratio";
  }

  return {
    source,
    lastSaleField,
    requireAggregatesReady,
    sortField,
    ascending,
  };
}
