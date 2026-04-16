"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { PAGE_SIZE, TAB_ITEM_TYPES } from "./constants";
import type { Product, ProductFilters, ProductSearchResult, ProductSortField } from "./types";

/** Whitelist of columns that can be sorted — prevents arbitrary column injection */
const ALLOWED_SORT_FIELDS: Set<string> = new Set<ProductSortField>([
  "sku", "description", "title", "author", "retail_price", "cost",
  "last_sale_date", "barcode", "catalog_number", "product_type",
  "vendor_id", "isbn", "edition",
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

  let query = client
    .from("products")
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

  // Sorting — validate against whitelist to prevent arbitrary column injection
  const sortField = ALLOWED_SORT_FIELDS.has(filters.sortBy) ? filters.sortBy : "sku";
  const ascending = filters.sortDir !== "desc";
  query = query.order(sortField, { ascending, nullsFirst: false }).range(from, to);

  const { data, count, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return {
    products: (data ?? []) as Product[],
    total: count ?? 0,
    page: filters.page,
    pageSize: PAGE_SIZE,
  };
}
