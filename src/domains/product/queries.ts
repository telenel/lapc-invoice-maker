"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { PAGE_SIZE, TAB_ITEM_TYPES } from "./constants";
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

export async function searchProducts(
  filters: ProductFilters
): Promise<ProductSearchResult> {
  const client = getSupabaseBrowserClient();
  const from = (filters.page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const needsDerived = filters.trendDirection !== "" || filters.maxStockCoverageDays !== "";
  let query = client
    .from(needsDerived ? "products_with_derived" : "products")
    .select("*", { count: "exact" })
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
    query = query.gte("last_sale_date", filters.lastSaleDateFrom);
  }
  if (filters.lastSaleDateTo) {
    query = query.lte("last_sale_date", filters.lastSaleDateTo);
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

  // Margin range (computed client-side via a view would be better long-term;
  // for now approximate with (retail - cost) using Supabase's filter on computed
  // expression — fall back to client-side filter for rows missing retail).
  if (filters.minMargin !== "" || filters.maxMargin !== "") {
    // Supabase/PostgREST can't filter on computed expressions directly, so for
    // high/thin margin we rely on a Postgres view created in this migration
    // phase OR filter client-side. For MVP we filter on the server by issuing
    // a zero-margin proxy: `retail > cost` when minMargin > 0, and apply
    // exact bounds client-side after fetch.
    if (filters.minMargin !== "" && Number(filters.minMargin) > 0) {
      query = query.filter("retail_price", "gt", "cost");
    }
  }

  // Activity: last-sale windows
  if (filters.lastSaleWithin !== "") {
    const now = new Date();
    const days = filters.lastSaleWithin === "30d" ? 30 : filters.lastSaleWithin === "90d" ? 90 : 365;
    const threshold = new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
    query = query.gte("last_sale_date", threshold);
  }
  if (filters.lastSaleNever) {
    query = query.is("last_sale_date", null);
  }
  if (filters.lastSaleOlderThan !== "") {
    const years = filters.lastSaleOlderThan === "2y" ? 2 : 5;
    const threshold = new Date(Date.now() - years * 365 * 24 * 60 * 60 * 1000).toISOString();
    query = query.lt("last_sale_date", threshold);
  }

  // Activity: edited
  if (filters.editedWithin === "7d") {
    const threshold = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    query = query.gte("updated_at", threshold);
  }
  if (filters.editedSinceSync) {
    query = query.filter("updated_at", "gt", "synced_at");
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

  // Sorting — validate against whitelist to prevent arbitrary column injection.
  // "days_since_sale" is a presentation alias for last_sale_date with inverted
  // direction: more days = older = ascending in days is descending in date.
  let effectiveSortBy: string = filters.sortBy;
  let effectiveAscending = filters.sortDir !== "desc";
  if (filters.sortBy === "days_since_sale") {
    effectiveSortBy = "last_sale_date";
    effectiveAscending = !effectiveAscending;
  }
  const sortField = ALLOWED_SORT_FIELDS.has(effectiveSortBy) ? effectiveSortBy : "sku";
  query = query.order(sortField, { ascending: effectiveAscending, nullsFirst: false }).range(from, to);

  const { data, count, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  let products = (data ?? []) as Product[];

  // Margin bound is applied client-side because PostgREST can't filter on a
  // computed expression. Server-side retail>cost already cut zero/negative
  // cases when minMargin>0.
  if (filters.minMargin !== "" || filters.maxMargin !== "") {
    const min = filters.minMargin === "" ? -Infinity : Number(filters.minMargin);
    const max = filters.maxMargin === "" ? Infinity : Number(filters.maxMargin);
    products = products.filter((p) => {
      if (p.retail_price <= 0) return false;
      const margin = (p.retail_price - p.cost) / p.retail_price;
      return margin >= min && margin <= max;
    });
  }

  return {
    products,
    total: count ?? 0,
    page: filters.page,
    pageSize: PAGE_SIZE,
  };
}
