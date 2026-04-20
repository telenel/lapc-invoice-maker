"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { PAGE_SIZE, TAB_ITEM_TYPES } from "./constants";
export { buildProductQueryPlan, hasAnalyticsProductFilters } from "./query-plan";
import { buildProductQueryPlan } from "./query-plan";
import type { Product, ProductFilters, ProductSearchResult, ProductSortField } from "./types";

/** Whitelist of columns that can be sorted — prevents arbitrary column injection */
const ALLOWED_SORT_FIELDS: Set<string> = new Set<ProductSortField>([
  "sku", "description", "title", "author", "retail_price", "cost",
  "last_sale_date", "barcode", "catalog_number", "product_type",
  "vendor_id", "isbn", "edition",
  "stock_on_hand",
  "units_sold_30d", "units_sold_1y", "units_sold_lifetime",
  "revenue_30d", "revenue_1y",
  "txns_1y",
  "updated_at",
  "dept_num",
]);

const ALLOWED_DERIVED_SORT_FIELDS = new Set<string>([
  ...Array.from(ALLOWED_SORT_FIELDS),
  "effective_last_sale_date",
  "margin_ratio",
]);

/**
 * Escape a value for safe interpolation into a PostgREST `.or()` filter string.
 * If the value contains any PostgREST metacharacters (, . ( ) " \), it is
 * wrapped in double quotes with inner quotes escaped.
 */
function quotePostgrestValue(value: string): string {
  if (/[,.()"\\]/.test(value)) {
    return `"${value.replace(/["\\]/g, "\\$&")}"`;
  }
  return value;
}

/**
 * Build a safe tsquery string from user input.
 * Only alphanumeric word tokens are kept; everything else is stripped.
 * Tokens are joined with & (AND) for Postgres full-text search.
 */
function buildTsquery(input: string): string | null {
  const tokens = input
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 0);
  if (tokens.length === 0) return null;
  return tokens.map((w) => `'${w}'`).join(" & ");
}

export interface SearchProductsOptions {
  /** When true, the query skips selecting row data and returns only the count. */
  countOnly?: boolean;
}

export async function searchProducts(
  filters: ProductFilters,
  options: SearchProductsOptions = {},
): Promise<ProductSearchResult> {
  const client = getSupabaseBrowserClient();
  const from = (filters.page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  const plan = buildProductQueryPlan(filters);
  let query = client
    .from(plan.source)
    .select(options.countOnly ? "sku" : "*", {
      count: "exact",
      head: !!options.countOnly,
    })
    .in("item_type", TAB_ITEM_TYPES[filters.tab]);

  // Full-text search on description + prefix match on identifiers
  if (filters.search.trim()) {
    const term = filters.search.trim();
    const isNumeric = /^\d+$/.test(term);

    if (isNumeric) {
      const safe = quotePostgrestValue(term);
      query = query.or(
        `sku.eq.${safe},barcode.ilike.${safe}%,isbn.ilike.${safe}%,catalog_number.ilike.${safe}%`
      );
    } else {
      const safeIlike = quotePostgrestValue(`%${term}%`);
      const tsquery = buildTsquery(term);

      const conditions: string[] = [];
      if (tsquery) {
        conditions.push(`description.fts.${quotePostgrestValue(tsquery)}`);
      }
      conditions.push(
        `title.ilike.${safeIlike}`,
        `author.ilike.${safeIlike}`,
        `isbn.ilike.${safeIlike}`,
        `barcode.ilike.${safeIlike}`,
        `catalog_number.ilike.${safeIlike}`
      );
      query = query.or(conditions.join(","));
    }
  }

  if (filters.minPrice) {
    query = query.gte("retail_price", Number(filters.minPrice));
  }
  if (filters.maxPrice) {
    query = query.lte("retail_price", Number(filters.maxPrice));
  }
  if (filters.vendorId) {
    query = query.eq("vendor_id", Number(filters.vendorId));
  }
  if (filters.hasBarcode) {
    query = query.not("barcode", "is", null);
  }
  if (filters.lastSaleDateFrom) {
    query = query.gte(plan.lastSaleField, filters.lastSaleDateFrom);
  }
  if (filters.lastSaleDateTo) {
    query = query.lte(plan.lastSaleField, filters.lastSaleDateTo);
  }

  // Stock range
  if (filters.minStock !== "") {
    query = query.gte("stock_on_hand", Number(filters.minStock));
  }
  if (filters.maxStock !== "") {
    query = query.lte("stock_on_hand", Number(filters.maxStock));
  }

  // Classification (deptNum -> classNum -> catNum, each narrows the prior)
  if (filters.deptNum !== "") {
    query = query.eq("dept_num", Number(filters.deptNum));
  }
  if (filters.classNum !== "") {
    query = query.eq("class_num", Number(filters.classNum));
  }
  if (filters.catNum !== "") {
    query = query.eq("cat_num", Number(filters.catNum));
  }

  // Data quality
  if (filters.missingBarcode) {
    query = query.is("barcode", null);
  }
  if (filters.missingIsbn) {
    query = query.is("isbn", null);
  }
  if (filters.missingTitle) {
    // Textbook rows with no title OR merchandise rows with no description.
    query = query.or("and(item_type.in.(textbook,used_textbook),title.is.null),and(item_type.eq.general_merchandise,description.is.null)");
  }
  if (filters.retailBelowCost) {
    query = query.filter("retail_price", "lt", "cost");
  }
  if (filters.zeroPrice) {
    query = query.or("retail_price.eq.0,cost.eq.0");
  }

  if (filters.minMargin !== "" || filters.maxMargin !== "") {
    if (filters.minMargin !== "") query = query.gte("margin_ratio", Number(filters.minMargin));
    if (filters.maxMargin !== "") query = query.lte("margin_ratio", Number(filters.maxMargin));
  }

  // Activity: last-sale windows
  if (filters.lastSaleWithin !== "") {
    const now = new Date();
    const days = filters.lastSaleWithin === "30d" ? 30 : filters.lastSaleWithin === "90d" ? 90 : 365;
    const threshold = new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
    query = query.gte(plan.lastSaleField, threshold);
  }
  if (filters.lastSaleNever) {
    query = query.is(plan.lastSaleField, null);
  }
  if (filters.lastSaleOlderThan !== "") {
    const years = filters.lastSaleOlderThan === "2y" ? 2 : 5;
    const threshold = new Date(Date.now() - years * 365 * 24 * 60 * 60 * 1000).toISOString();
    query = query.lt(plan.lastSaleField, threshold);
  }

  // Activity: edited
  if (filters.editedWithin === "7d") {
    const threshold = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    query = query.gte("updated_at", threshold);
  }
  if (filters.editedSinceSync) {
    query = query.eq("edited_since_sync", true);
  }

  // Status
  if (filters.discontinued === "yes") {
    query = query.eq("discontinued", true);
  } else if (filters.discontinued === "no") {
    query = query.or("discontinued.is.null,discontinued.eq.false");
  }
  if (filters.itemType !== "") {
    query = query.eq("item_type", filters.itemType);
  }

  if (filters.tab === "textbooks") {
    if (filters.author) {
      query = query.ilike("author", `%${filters.author}%`);
    }
    if (filters.hasIsbn) {
      query = query.not("isbn", "is", null);
    }
    if (filters.edition) {
      query = query.ilike("edition", `%${filters.edition}%`);
    }
  }

  if (filters.tab === "merchandise") {
    if (filters.catalogNumber) {
      query = query.ilike("catalog_number", `%${filters.catalogNumber}%`);
    }
    if (filters.productType) {
      query = query.ilike("product_type", `%${filters.productType}%`);
    }
  }

  if (plan.requireAggregatesReady) {
    query = query.eq("aggregates_ready", true);
  }

  // Units sold window (filters map to the per-window denormalized columns
  // on products — no derived view needed for these)
  if (filters.unitsSoldWindow !== "" && (filters.minUnitsSold !== "" || filters.maxUnitsSold !== "")) {
    const col = `units_sold_${filters.unitsSoldWindow}`;
    if (filters.minUnitsSold !== "") query = query.gte(col, Number(filters.minUnitsSold));
    if (filters.maxUnitsSold !== "") query = query.lte(col, Number(filters.maxUnitsSold));
  }
  if (filters.revenueWindow !== "" && (filters.minRevenue !== "" || filters.maxRevenue !== "")) {
    const col = `revenue_${filters.revenueWindow}`;
    if (filters.minRevenue !== "") query = query.gte(col, Number(filters.minRevenue));
    if (filters.maxRevenue !== "") query = query.lte(col, Number(filters.maxRevenue));
  }
  if (filters.txnsWindow !== "" && (filters.minTxns !== "" || filters.maxTxns !== "")) {
    const col = `txns_${filters.txnsWindow}`;
    if (filters.minTxns !== "") query = query.gte(col, Number(filters.minTxns));
    if (filters.maxTxns !== "") query = query.lte(col, Number(filters.maxTxns));
  }
  if (filters.neverSoldLifetime) {
    query = query.eq("txns_lifetime", 0);
  }
  if (filters.firstSaleWithin !== "") {
    const days = filters.firstSaleWithin === "90d" ? 90 : 365;
    const threshold = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    query = query.gte("first_sale_date_computed", threshold);
  }
  // Derived-view-only filters
  if (filters.trendDirection !== "") {
    query = query.eq("trend_direction", filters.trendDirection);
  }
  if (filters.maxStockCoverageDays !== "") {
    query = query.lte("stock_coverage_days", Number(filters.maxStockCoverageDays));
  }

  if (!options.countOnly) {
    const sortField = ALLOWED_DERIVED_SORT_FIELDS.has(plan.sortField) ? plan.sortField : "sku";
    query = query.order(sortField, { ascending: plan.ascending, nullsFirst: false }).range(from, to);
  }

  const { data, count, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  const products = options.countOnly ? [] : ((data ?? []) as Product[]);

  return {
    products,
    total: count ?? 0,
    page: filters.page,
    pageSize: PAGE_SIZE,
  };
}
