import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/domains/shared/auth";
import { TAB_ITEM_TYPES } from "@/domains/product/constants";
import { buildProductQueryPlan } from "@/domains/product/query-builder";
import { accumulateGroupedRollups } from "@/domains/product/summary";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { parseFiltersFromSearchParams } from "@/domains/product/view-serializer";
import type { ProductRollupGroup, ProductRollupInputRow } from "@/domains/product/summary-types";
import type { ProductFilters } from "@/domains/product/types";

export const dynamic = "force-dynamic";

const ROLLUP_SELECT_BASE = [
  "sku",
  "dept_num",
  "class_num",
  "cat_num",
  "dept_name",
  "class_name",
  "cat_name",
  "vendor_id",
  "stock_on_hand",
  "cost",
  "retail_price",
  "revenue_1y",
].join(",");

const ROLLUP_SELECT_DERIVED = `${ROLLUP_SELECT_BASE},margin_ratio`;
const CHUNK_SIZE = 1000;

interface RollupQueryChain {
  or(filters: string): this;
  gte(column: string, value: string | number): this;
  lte(column: string, value: string | number): this;
  lt(column: string, value: string | number): this;
  eq(column: string, value: string | number | boolean): this;
  not(column: string, operator: string, value: string | null): this;
  ilike(column: string, value: string): this;
  is(column: string, value: null): this;
  filter(column: string, operator: string, value: string): this;
}

interface RollupChunkQuery extends RollupQueryChain {
  order(
    column: string,
    options: { ascending: boolean; nullsFirst: boolean },
  ): {
    range(
      from: number,
      to: number,
    ): Promise<{ data: unknown[] | null; error: { message: string } | null }>;
  };
}

function quotePostgrestValue(value: string): string {
  if (/[,.()"\\]/.test(value)) {
    return `"${value.replace(/["\\]/g, "\\$&")}"`;
  }
  return value;
}

function buildTsquery(input: string): string | null {
  const tokens = input
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 0);
  if (tokens.length === 0) return null;
  return tokens.map((word) => `'${word}'`).join(" & ");
}

function parseGroup(searchParams: URLSearchParams): ProductRollupGroup {
  return searchParams.get("group") === "vendor" ? "vendor" : "dcc";
}

function applyRollupFilters<T extends RollupQueryChain>(
  query: T,
  filters: ProductFilters,
  plan: ReturnType<typeof buildProductQueryPlan>,
): T {
  if (filters.search.trim()) {
    const term = filters.search.trim();
    const isNumeric = /^\d+$/.test(term);

    if (isNumeric) {
      const safe = quotePostgrestValue(term);
      query = query.or(
        `sku.eq.${safe},barcode.ilike.${safe}%,isbn.ilike.${safe}%,catalog_number.ilike.${safe}%`,
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
        `catalog_number.ilike.${safeIlike}`,
      );

      query = query.or(conditions.join(","));
    }
  }

  if (filters.minPrice !== "") query = query.gte("retail_price", Number(filters.minPrice));
  if (filters.maxPrice !== "") query = query.lte("retail_price", Number(filters.maxPrice));
  if (filters.vendorId !== "") query = query.eq("vendor_id", Number(filters.vendorId));
  if (filters.hasBarcode) query = query.not("barcode", "is", null);
  if (filters.lastSaleDateFrom !== "") query = query.gte(plan.lastSaleField, filters.lastSaleDateFrom);
  if (filters.lastSaleDateTo !== "") query = query.lte(plan.lastSaleField, filters.lastSaleDateTo);
  if (filters.minStock !== "") query = query.gte("stock_on_hand", Number(filters.minStock));
  if (filters.maxStock !== "") query = query.lte("stock_on_hand", Number(filters.maxStock));
  if (filters.deptNum !== "") query = query.eq("dept_num", Number(filters.deptNum));
  if (filters.classNum !== "") query = query.eq("class_num", Number(filters.classNum));
  if (filters.catNum !== "") query = query.eq("cat_num", Number(filters.catNum));
  if (filters.missingBarcode) query = query.is("barcode", null);
  if (filters.missingIsbn) query = query.is("isbn", null);
  if (filters.missingTitle) {
    query = query.or(
      "and(item_type.in.(textbook,used_textbook),title.is.null),and(item_type.eq.general_merchandise,description.is.null)",
    );
  }
  if (filters.retailBelowCost) query = query.filter("retail_price", "lt", "cost");
  if (filters.zeroPrice) query = query.or("retail_price.eq.0,cost.eq.0");
  if (filters.minMargin !== "") query = query.gte("margin_ratio", Number(filters.minMargin));
  if (filters.maxMargin !== "") query = query.lte("margin_ratio", Number(filters.maxMargin));

  if (filters.lastSaleWithin !== "") {
    const days = filters.lastSaleWithin === "30d" ? 30 : filters.lastSaleWithin === "90d" ? 90 : 365;
    const threshold = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    query = query.gte(plan.lastSaleField, threshold);
  }
  if (filters.lastSaleNever) query = query.is(plan.lastSaleField, null);
  if (filters.lastSaleOlderThan !== "") {
    const years = filters.lastSaleOlderThan === "2y" ? 2 : 5;
    const threshold = new Date(Date.now() - years * 365 * 24 * 60 * 60 * 1000).toISOString();
    query = query.lt(plan.lastSaleField, threshold);
  }
  if (filters.editedWithin === "7d") {
    const threshold = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    query = query.gte("updated_at", threshold);
  }
  if (filters.editedSinceSync) query = query.filter("updated_at", "gt", "synced_at");
  if (filters.discontinued === "yes") query = query.eq("discontinued", true);
  if (filters.discontinued === "no") query = query.or("discontinued.is.null,discontinued.eq.false");
  if (filters.itemType !== "") query = query.eq("item_type", filters.itemType);

  if (filters.tab === "textbooks") {
    if (filters.author) query = query.ilike("author", `%${filters.author}%`);
    if (filters.hasIsbn) query = query.not("isbn", "is", null);
    if (filters.edition) query = query.ilike("edition", `%${filters.edition}%`);
  }

  if (filters.tab === "merchandise") {
    if (filters.catalogNumber) query = query.ilike("catalog_number", `%${filters.catalogNumber}%`);
    if (filters.productType) query = query.ilike("product_type", `%${filters.productType}%`);
  }

  if (plan.requireAggregatesReady) query = query.eq("aggregates_ready", true);

  if (filters.unitsSoldWindow !== "" && (filters.minUnitsSold !== "" || filters.maxUnitsSold !== "")) {
    const column = `units_sold_${filters.unitsSoldWindow}`;
    if (filters.minUnitsSold !== "") query = query.gte(column, Number(filters.minUnitsSold));
    if (filters.maxUnitsSold !== "") query = query.lte(column, Number(filters.maxUnitsSold));
  }
  if (filters.revenueWindow !== "" && (filters.minRevenue !== "" || filters.maxRevenue !== "")) {
    const column = `revenue_${filters.revenueWindow}`;
    if (filters.minRevenue !== "") query = query.gte(column, Number(filters.minRevenue));
    if (filters.maxRevenue !== "") query = query.lte(column, Number(filters.maxRevenue));
  }
  if (filters.txnsWindow !== "" && (filters.minTxns !== "" || filters.maxTxns !== "")) {
    const column = `txns_${filters.txnsWindow}`;
    if (filters.minTxns !== "") query = query.gte(column, Number(filters.minTxns));
    if (filters.maxTxns !== "") query = query.lte(column, Number(filters.maxTxns));
  }
  if (filters.neverSoldLifetime) query = query.eq("txns_lifetime", 0);
  if (filters.firstSaleWithin !== "") {
    const days = filters.firstSaleWithin === "90d" ? 90 : 365;
    const threshold = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    query = query.gte("first_sale_date_computed", threshold);
  }
  if (filters.trendDirection !== "") query = query.eq("trend_direction", filters.trendDirection);
  if (filters.maxStockCoverageDays !== "") {
    query = query.lte("stock_coverage_days", Number(filters.maxStockCoverageDays));
  }

  return query;
}

async function fetchAllRollupRows(filters: ProductFilters): Promise<ProductRollupInputRow[]> {
  const supabase = getSupabaseAdminClient();
  const plan = buildProductQueryPlan(filters);
  const select = plan.source === "products_with_derived" ? ROLLUP_SELECT_DERIVED : ROLLUP_SELECT_BASE;
  const rows: ProductRollupInputRow[] = [];

  for (let offset = 0; ; offset += CHUNK_SIZE) {
    const query = applyRollupFilters(
      supabase
      .from(plan.source)
      .select(select)
      .in("item_type", TAB_ITEM_TYPES[filters.tab]) as unknown as RollupChunkQuery,
      filters,
      plan,
    );

    const { data, error } = await query
      .order("sku", { ascending: true, nullsFirst: false })
      .range(offset, offset + CHUNK_SIZE - 1);

    if (error) throw new Error(error.message);

    const chunk = (data ?? []) as ProductRollupInputRow[];
    rows.push(...chunk);

    if (chunk.length < CHUNK_SIZE) break;
  }

  return rows;
}

export const GET = withAuth(async (request: NextRequest) => {
  const params = new URLSearchParams();
  request.nextUrl.searchParams.forEach((value, key) => params.set(key, value));
  const filters = parseFiltersFromSearchParams(params);
  const group = parseGroup(request.nextUrl.searchParams);
  const rows = await fetchAllRollupRows(filters);

  return NextResponse.json({
    group,
    rows: accumulateGroupedRollups(rows, group),
  });
});
