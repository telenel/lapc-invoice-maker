import { prisma } from "@/lib/prisma";
import {
  computeEffectivePredicate,
  type QuickPickSectionPredicateSource,
} from "@/domains/quick-pick-sections/filters";
import { PAGE_SIZE, TAB_ITEM_TYPES } from "./constants";
import { INVALIDATED_PRODUCT_INVENTORY_SYNCED_AT } from "./inventory-mirror-state";
import {
  getPrimaryProductLocationId,
  normalizeProductLocationIds,
  type ProductLocationId,
} from "./location-filters";
import { buildProductQueryPlan } from "./query-plan";
import type {
  ProductBrowseCountResult,
  ProductBrowseRow,
  ProductBrowseSearchResult,
  ProductFilters,
  ProductLocationAbbrev,
  ProductLocationSlice,
  ProductLocationVariance,
} from "./types";

export type ProductInventorySliceRow = ProductLocationSlice;

type ProductBrowseBase = Omit<
  ProductBrowseRow,
  "primary_location_id" | "primary_location_abbrev" | "selected_inventories" | "location_variance"
> & {
  primary_location_requested_id?: ProductLocationId | null;
};

interface ProductBrowseBaseRow {
  sku: number | string | bigint;
  barcode: string | null;
  item_tax_type_id: number | string | null;
  item_type: string;
  description: string | null;
  author: string | null;
  title: string | null;
  isbn: string | null;
  edition: string | null;
  retail_price: unknown;
  cost: unknown;
  stock_on_hand: number | string | null;
  catalog_number: string | null;
  vendor_id: number | string | null;
  dcc_id: number | string | null;
  product_type: string | null;
  color_id: number | string | null;
  created_at: Date | string | null;
  updated_at: Date | string;
  manual_updated_at: Date | string | null;
  last_sale_date: Date | string | null;
  synced_at: Date | string | null;
  dept_num: number | string | null;
  class_num: number | string | null;
  cat_num: number | string | null;
  dept_name: string | null;
  class_name: string | null;
  cat_name: string | null;
  units_sold_30d: unknown;
  units_sold_90d: unknown;
  units_sold_1y: unknown;
  units_sold_3y: unknown;
  units_sold_lifetime: unknown;
  revenue_30d: unknown;
  revenue_90d: unknown;
  revenue_1y: unknown;
  revenue_3y: unknown;
  revenue_lifetime: unknown;
  txns_1y: unknown;
  txns_lifetime: unknown;
  first_sale_date_computed: Date | string | null;
  last_sale_date_computed: Date | string | null;
  sales_aggregates_computed_at: Date | string | null;
  effective_last_sale_date: Date | string | null;
  aggregates_ready: boolean | null;
  edited_since_sync: boolean | null;
  margin_ratio: unknown;
  stock_coverage_days: unknown;
  trend_direction: "accelerating" | "decelerating" | "steady" | null;
  discontinued: boolean | null;
  primary_location_requested_id?: ProductLocationId | null;
}

interface ProductInventoryQueryRow {
  sku: number | string | bigint;
  location_id: ProductLocationId;
  location_abbrev: ProductLocationAbbrev;
  retail_price: unknown;
  cost: unknown;
  stock_on_hand: number | string | null;
  last_sale_date: Date | string | null;
}

interface SqlBuilder {
  params: unknown[];
  add: (value: unknown) => string;
}

export interface SearchProductBrowseRowsOptions {
  countOnly?: boolean;
  role?: string;
  userId?: string | null;
}

function hasVariedValue<T>(values: ReadonlyArray<T | null>): boolean {
  if (values.length <= 1) return false;

  const [first, ...rest] = values;
  return rest.some((value) => value !== first);
}

export function buildProductLocationVariance(
  slices: ReadonlyArray<ProductInventorySliceRow>,
): ProductLocationVariance {
  return {
    retailPriceVaries: hasVariedValue(slices.map((slice) => slice.retailPrice)),
    costVaries: hasVariedValue(slices.map((slice) => slice.cost)),
    stockVaries: hasVariedValue(slices.map((slice) => slice.stockOnHand)),
    lastSaleDateVaries: hasVariedValue(slices.map((slice) => slice.lastSaleDate)),
  };
}

export function buildProductBrowseRow(
  base: ProductBrowseBase,
  slices: ReadonlyArray<ProductInventorySliceRow>,
  locationIds: ReadonlyArray<ProductLocationId>,
): ProductBrowseRow {
  const primaryLocationId = getPrimaryProductLocationId(locationIds);
  const primarySlice = slices.find((slice) => slice.locationId === primaryLocationId) ?? null;
  const selectedInventories = slices.map((slice) => ({ ...slice }));
  const { primary_location_requested_id: _primaryLocationRequestedId, ...publicBase } = base;
  void _primaryLocationRequestedId;
  const requestedPrimaryRowMissingFromLiveSlices =
    primarySlice == null && base.primary_location_requested_id != null;

  return {
    ...publicBase,
    retail_price: primarySlice?.retailPrice ?? base.retail_price,
    cost: primarySlice?.cost ?? base.cost,
    stock_on_hand: primarySlice ? primarySlice.stockOnHand : base.stock_on_hand,
    last_sale_date: primarySlice ? primarySlice.lastSaleDate : base.last_sale_date,
    effective_last_sale_date:
      primarySlice?.lastSaleDate ??
      (
        requestedPrimaryRowMissingFromLiveSlices
          ? (base.effective_last_sale_date ?? null)
          : (
            base.effective_last_sale_date ??
            base.last_sale_date_computed ??
            base.last_sale_date
          )
      ),
    primary_location_id: primarySlice?.locationId ?? null,
    primary_location_abbrev: primarySlice?.locationAbbrev ?? null,
    selected_inventories: selectedInventories,
    location_variance: buildProductLocationVariance(slices),
  };
}

function toNumber(value: unknown, fallback = 0): number {
  if (value === null || value === undefined || value === "") return fallback;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function toNullableInteger(value: number | string | bigint | null): number | null {
  if (value === null || value === undefined) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.trunc(numeric) : null;
}

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

function toNullableIsoString(value: Date | string | null): string | null {
  if (value === null || value === undefined) return null;
  return toIsoString(value);
}

/**
 * Parse a composite DCC code like "30-10-10" / "30.10.10" / "30 10 10" into
 * its three integer segments. Returns null if the input doesn't look like a
 * separator-joined triple. Digits-only input is intentionally excluded here
 * because segment widths vary per bookstore; the search-handler uses a
 * concat-based match for the digits-only case instead.
 */
export function parseDccComposite(raw: string): { dept: number; cls: number; cat: number } | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(/[\s.\-]+/).filter(Boolean);
  if (parts.length !== 3) return null;
  const [dept, cls, cat] = parts.map((p) => Number(p));
  if (![dept, cls, cat].every((n) => Number.isInteger(n) && n >= 0)) return null;
  return { dept, cls, cat };
}

function createSqlBuilder(): SqlBuilder {
  const params: unknown[] = [];

  return {
    params,
    add(value) {
      params.push(value);
      return `$${params.length}`;
    },
  };
}

function addList(builder: SqlBuilder, values: readonly unknown[]): string {
  return values.map((value) => builder.add(value)).join(", ");
}

function windowColumnSql(
  window: ProductFilters["unitsSoldWindow"] | ProductFilters["revenueWindow"] | ProductFilters["txnsWindow"],
  mapping: Record<string, string>,
): string | null {
  return mapping[window] ?? null;
}

const QUICK_PICK_SECTION_SEARCH_SELECT = {
  descriptionLike: true,
  dccIds: true,
  vendorIds: true,
  itemType: true,
  explicitSkus: true,
  includeDiscontinued: true,
} as const;

type FilteredBrowseQuery =
  | {
    isEmpty: true;
  }
  | {
    isEmpty: false;
    cteSql: string;
    params: unknown[];
    orderBySql: string;
    from: number;
  };

function isQuickPicksSectionSearchEnabled(filters: ProductFilters): boolean {
  return filters.tab === "quickPicks";
}

async function loadQuickPickSectionsForBrowse(
  filters: ProductFilters,
  options: SearchProductBrowseRowsOptions,
): Promise<QuickPickSectionPredicateSource[]> {
  if (!isQuickPicksSectionSearchEnabled(filters)) {
    return [];
  }

  const trimmedSectionSlug = filters.sectionSlug?.trim() ?? "";
  const shouldUseAllSections = filters.allSections || trimmedSectionSlug.length === 0;
  const visibilityWhere = options.role === "admin"
    ? {}
    : {
        OR: [
          { isGlobal: true },
          ...(options.userId ? [{ createdByUserId: options.userId }] : []),
        ],
      };

  return prisma.quickPickSection.findMany({
    where: trimmedSectionSlug
      ? {
          ...visibilityWhere,
          slug: trimmedSectionSlug,
        }
      : shouldUseAllSections
        ? visibilityWhere
        : { id: { in: [] } },
    select: QUICK_PICK_SECTION_SEARCH_SELECT,
  });
}

function buildQuickPickSectionsCondition(
  builder: SqlBuilder,
  sections: ReadonlyArray<QuickPickSectionPredicateSource>,
): string | null {
  const sectionPredicates: string[] = [];

  for (const section of sections) {
    const predicate = computeEffectivePredicate(section);
    if (predicate.isEmpty) {
      continue;
    }

    const fragment = predicate.buildSql({
      tableAlias: "pwd",
      paramOffset: builder.params.length,
    });
    builder.params.push(...fragment.params);
    sectionPredicates.push(`(${fragment.sql})`);
  }

  if (sectionPredicates.length === 0) {
    return null;
  }

  if (sectionPredicates.length === 1) {
    return sectionPredicates[0];
  }

  return `(${sectionPredicates.join(" OR ")})`;
}

async function buildFilteredBrowseQuery(
  filters: ProductFilters,
  options: SearchProductBrowseRowsOptions,
): Promise<FilteredBrowseQuery> {
  const locationIds = normalizeProductLocationIds(filters.locationIds);
  const primaryLocationId = getPrimaryProductLocationId(locationIds);
  const basePlan = buildProductQueryPlan(filters);
  const from = (filters.page - 1) * PAGE_SIZE;
  const builder = createSqlBuilder();
  const sourceTable = basePlan.source === "products_with_derived" ? "products_with_derived" : "products";
  const baseEffectiveLastSaleExpr = sourceTable === "products_with_derived"
    ? "pwd.effective_last_sale_date"
    : "COALESCE(pwd.last_sale_date_computed, pwd.last_sale_date)";
  // When a selected location row was explicitly invalidated, keep the SKU
  // visible but surface null primary values instead of silently falling back
  // to the legacy PIER-denormalized columns.
  const emittedRetailExpr =
    "COALESCE(pi.retail_price, CASE WHEN pi_scope.location_id IS NULL THEN pwd.retail_price END)";
  const emittedCostExpr =
    "COALESCE(pi.cost, CASE WHEN pi_scope.location_id IS NULL THEN pwd.cost END)";
  const emittedStockExpr =
    "COALESCE(pi.stock_on_hand, CASE WHEN pi_scope.location_id IS NULL THEN pwd.stock_on_hand END)";
  const emittedLastSaleExpr =
    "COALESCE(pi.last_sale_date, CASE WHEN pi_scope.location_id IS NULL THEN pwd.last_sale_date END)";
  const emittedEffectiveLastSaleExpr =
    `COALESCE(pi.last_sale_date, CASE WHEN pi_scope.location_id IS NULL THEN ${baseEffectiveLastSaleExpr} END)`;
  const lastSaleExpr = basePlan.lastSaleField === "effective_last_sale_date"
    ? emittedEffectiveLastSaleExpr
    : emittedLastSaleExpr;
  const buildTextSearchCondition = (value: string) => `(
    to_tsvector('simple', COALESCE(pwd.description, '')) @@ plainto_tsquery('simple', ${builder.add(value)})
    OR pwd.title ILIKE ${builder.add(`%${value}%`)}
    OR pwd.author ILIKE ${builder.add(`%${value}%`)}
    OR pwd.isbn ILIKE ${builder.add(`%${value}%`)}
    OR pwd.barcode ILIKE ${builder.add(`%${value}%`)}
    OR pwd.catalog_number ILIKE ${builder.add(`%${value}%`)}
  )`;

  const conditions: string[] = [];

  if (filters.tab === "quickPicks") {
    const sections = await loadQuickPickSectionsForBrowse(filters, options);
    const quickPickCondition = buildQuickPickSectionsCondition(builder, sections);
    if (!quickPickCondition) {
      return { isEmpty: true };
    }
    conditions.push(quickPickCondition);
  } else {
    const itemTypes = TAB_ITEM_TYPES[filters.tab];
    conditions.push(`pwd.item_type IN (${addList(builder, itemTypes)})`);
  }

  const searchTerm = filters.search.trim();
  if (searchTerm) {
    const composite = parseDccComposite(searchTerm);
    if (composite) {
      // Separator-joined DCC (e.g. "30-10-10"): extend the existing text
      // search branch with an exact dept/class/cat match instead of replacing
      // it, so catalog-number and other text matches keep working.
      conditions.push(
        `(
          (
            pwd.dept_num = ${builder.add(composite.dept)}
            AND pwd.class_num = ${builder.add(composite.cls)}
            AND pwd.cat_num = ${builder.add(composite.cat)}
          )
          OR ${buildTextSearchCondition(searchTerm)}
        )`,
      );
    } else if (/^\d+$/.test(searchTerm)) {
      const digitBranches: string[] = [
        `pwd.sku = ${builder.add(Number(searchTerm))}`,
        `pwd.barcode ILIKE ${builder.add(`${searchTerm}%`)}`,
        `pwd.isbn ILIKE ${builder.add(`${searchTerm}%`)}`,
        `pwd.catalog_number ILIKE ${builder.add(`${searchTerm}%`)}`,
      ];
      // 4-8 digit input plausibly encodes a DCC composite. Match against a
      // runtime concat of dept/class/cat so variable widths still resolve:
      //   "301010" matches (30,10,10) via exact unpadded concat
      //   "030101" matches (3,1,1) via zero-padded 2-digit concat
      // Performance is a sequential scan on the filtered set — acceptable at
      // current scale; see issue notes for a generated-column follow-up.
      if (searchTerm.length >= 4 && searchTerm.length <= 8) {
        digitBranches.push(
          `(pwd.dept_num::text || pwd.class_num::text || pwd.cat_num::text) = ${builder.add(searchTerm)}`,
        );
        digitBranches.push(
          `(LPAD(pwd.dept_num::text, 2, '0') || LPAD(pwd.class_num::text, 2, '0') || LPAD(pwd.cat_num::text, 2, '0')) = ${builder.add(searchTerm)}`,
        );
      }
      conditions.push(`(\n          ${digitBranches.join("\n          OR ")}\n        )`);
    } else {
      conditions.push(buildTextSearchCondition(searchTerm));
    }
  }

  if (filters.minPrice !== "") conditions.push(`${emittedRetailExpr} >= ${builder.add(Number(filters.minPrice))}`);
  if (filters.maxPrice !== "") conditions.push(`${emittedRetailExpr} <= ${builder.add(Number(filters.maxPrice))}`);
  if (filters.vendorId !== "") conditions.push(`pwd.vendor_id = ${builder.add(Number(filters.vendorId))}`);
  if (filters.hasBarcode) conditions.push("pwd.barcode IS NOT NULL");
  if (filters.lastSaleDateFrom) conditions.push(`${lastSaleExpr} >= ${builder.add(filters.lastSaleDateFrom)}`);
  if (filters.lastSaleDateTo) conditions.push(`${lastSaleExpr} <= ${builder.add(filters.lastSaleDateTo)}`);
  if (filters.minStock !== "") conditions.push(`${emittedStockExpr} >= ${builder.add(Number(filters.minStock))}`);
  if (filters.maxStock !== "") conditions.push(`${emittedStockExpr} <= ${builder.add(Number(filters.maxStock))}`);
  const compositeFilter =
    filters.dccComposite !== "" ? parseDccComposite(filters.dccComposite) : null;
  if (compositeFilter) {
    // dccComposite subsumes the dept/class/cat triple — emitting both would
    // duplicate predicates (and be wrong when the backfill reader sets both).
    conditions.push(`pwd.dept_num = ${builder.add(compositeFilter.dept)}`);
    conditions.push(`pwd.class_num = ${builder.add(compositeFilter.cls)}`);
    conditions.push(`pwd.cat_num = ${builder.add(compositeFilter.cat)}`);
  } else {
    if (filters.deptNum !== "") conditions.push(`pwd.dept_num = ${builder.add(Number(filters.deptNum))}`);
    if (filters.classNum !== "") conditions.push(`pwd.class_num = ${builder.add(Number(filters.classNum))}`);
    if (filters.catNum !== "") conditions.push(`pwd.cat_num = ${builder.add(Number(filters.catNum))}`);
  }
  if (filters.missingBarcode) conditions.push("pwd.barcode IS NULL");
  if (filters.missingIsbn) conditions.push("pwd.isbn IS NULL");
  if (filters.missingTitle) {
    conditions.push(
      `(
        (pwd.item_type IN ('textbook', 'used_textbook') AND pwd.title IS NULL)
        OR (pwd.item_type = 'general_merchandise' AND pwd.description IS NULL)
      )`,
    );
  }
  if (filters.retailBelowCost) conditions.push(`${emittedRetailExpr} < ${emittedCostExpr}`);
  if (filters.zeroPrice) conditions.push(`(${emittedRetailExpr} = 0 OR ${emittedCostExpr} = 0)`);
  if (filters.minMargin !== "") conditions.push(`pwd.margin_ratio >= ${builder.add(Number(filters.minMargin))}`);
  if (filters.maxMargin !== "") conditions.push(`pwd.margin_ratio <= ${builder.add(Number(filters.maxMargin))}`);

  if (filters.lastSaleWithin !== "") {
    const days = filters.lastSaleWithin === "30d" ? 30 : filters.lastSaleWithin === "90d" ? 90 : 365;
    const threshold = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    conditions.push(`${lastSaleExpr} >= ${builder.add(threshold)}`);
  }
  if (filters.lastSaleNever) conditions.push(`${lastSaleExpr} IS NULL`);
  if (filters.lastSaleOlderThan !== "") {
    const years = filters.lastSaleOlderThan === "2y" ? 2 : 5;
    const threshold = new Date(Date.now() - years * 365 * 24 * 60 * 60 * 1000).toISOString();
    conditions.push(`${lastSaleExpr} < ${builder.add(threshold)}`);
  }
  if (filters.editedWithin === "7d") {
    const threshold = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    conditions.push(`pwd.manual_updated_at >= ${builder.add(threshold)}`);
  }
  if (filters.editedSinceSync) conditions.push("pwd.edited_since_sync = true");
  if (filters.discontinued === "yes") {
    conditions.push("pwd.discontinued = true");
  } else if (filters.discontinued === "no") {
    conditions.push("(pwd.discontinued IS NULL OR pwd.discontinued = false)");
  }
  if (filters.itemType !== "") conditions.push(`pwd.item_type = ${builder.add(filters.itemType)}`);

  if (filters.tab === "textbooks") {
    if (filters.author) conditions.push(`pwd.author ILIKE ${builder.add(`%${filters.author}%`)}`);
    if (filters.hasIsbn) conditions.push("pwd.isbn IS NOT NULL");
    if (filters.edition) conditions.push(`pwd.edition ILIKE ${builder.add(`%${filters.edition}%`)}`);
  }

  if (filters.tab === "merchandise") {
    if (filters.catalogNumber) {
      conditions.push(`pwd.catalog_number ILIKE ${builder.add(`%${filters.catalogNumber}%`)}`);
    }
    if (filters.productType) {
      conditions.push(`pwd.product_type ILIKE ${builder.add(`%${filters.productType}%`)}`);
    }
  }

  if (basePlan.requireAggregatesReady) conditions.push("pwd.aggregates_ready = true");

  const unitsSoldColumn = windowColumnSql(filters.unitsSoldWindow, {
    "30d": "pwd.units_sold_30d",
    "90d": "pwd.units_sold_90d",
    "1y": "pwd.units_sold_1y",
    "3y": "pwd.units_sold_3y",
    lifetime: "pwd.units_sold_lifetime",
  });
  if (unitsSoldColumn && (filters.minUnitsSold !== "" || filters.maxUnitsSold !== "")) {
    if (filters.minUnitsSold !== "") conditions.push(`${unitsSoldColumn} >= ${builder.add(Number(filters.minUnitsSold))}`);
    if (filters.maxUnitsSold !== "") conditions.push(`${unitsSoldColumn} <= ${builder.add(Number(filters.maxUnitsSold))}`);
  }

  const revenueColumn = windowColumnSql(filters.revenueWindow, {
    "30d": "pwd.revenue_30d",
    "90d": "pwd.revenue_90d",
    "1y": "pwd.revenue_1y",
    "3y": "pwd.revenue_3y",
    lifetime: "pwd.revenue_lifetime",
  });
  if (revenueColumn && (filters.minRevenue !== "" || filters.maxRevenue !== "")) {
    if (filters.minRevenue !== "") conditions.push(`${revenueColumn} >= ${builder.add(Number(filters.minRevenue))}`);
    if (filters.maxRevenue !== "") conditions.push(`${revenueColumn} <= ${builder.add(Number(filters.maxRevenue))}`);
  }

  const txnsColumn = windowColumnSql(filters.txnsWindow, {
    "1y": "pwd.txns_1y",
    lifetime: "pwd.txns_lifetime",
  });
  if (txnsColumn && (filters.minTxns !== "" || filters.maxTxns !== "")) {
    if (filters.minTxns !== "") conditions.push(`${txnsColumn} >= ${builder.add(Number(filters.minTxns))}`);
    if (filters.maxTxns !== "") conditions.push(`${txnsColumn} <= ${builder.add(Number(filters.maxTxns))}`);
  }

  if (filters.neverSoldLifetime) conditions.push("pwd.txns_lifetime = 0");
  if (filters.firstSaleWithin !== "") {
    const days = filters.firstSaleWithin === "90d" ? 90 : 365;
    const threshold = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    conditions.push(`pwd.first_sale_date_computed >= ${builder.add(threshold)}`);
  }
  if (filters.trendDirection !== "") conditions.push(`pwd.trend_direction = ${builder.add(filters.trendDirection)}`);
  if (filters.maxStockCoverageDays !== "") {
    conditions.push(`pwd.stock_coverage_days <= ${builder.add(Number(filters.maxStockCoverageDays))}`);
  }

  const visibleLocationList = addList(builder, locationIds);
  const primaryLocationParam = builder.add(primaryLocationId);
  const invalidatedInventorySyncedAtParam = builder.add(INVALIDATED_PRODUCT_INVENTORY_SYNCED_AT);
  const cteSql = `
    WITH visible_skus AS (
      SELECT DISTINCT inv.sku
      FROM product_inventory inv
      WHERE inv.location_id IN (${visibleLocationList})
    ),
    filtered AS (
      SELECT
        pwd.*,
        pi_scope.location_id AS primary_location_requested_id,
        pi.location_id AS primary_location_inventory_id,
        pi.location_abbrev AS primary_location_inventory_abbrev,
        ${emittedRetailExpr} AS primary_retail_price,
        ${emittedCostExpr} AS primary_cost,
        ${emittedStockExpr} AS primary_stock_on_hand,
        ${emittedLastSaleExpr} AS primary_last_sale_date,
        ${emittedEffectiveLastSaleExpr} AS primary_effective_last_sale_date
      FROM ${sourceTable} pwd
      INNER JOIN visible_skus visible ON visible.sku = pwd.sku
      LEFT JOIN product_inventory pi_scope
        ON pi_scope.sku = pwd.sku
        AND pi_scope.location_id = ${primaryLocationParam}
      LEFT JOIN product_inventory pi
        ON pi.sku = pwd.sku
        AND pi.location_id = ${primaryLocationParam}
        AND pi.synced_at > ${invalidatedInventorySyncedAtParam}
      WHERE ${conditions.join(" AND ")}
    )
  `;

  const sortFieldSql = ({
    sku: "\"sku\"",
    description: "\"description\"",
    title: "\"title\"",
    author: "\"author\"",
    retail_price: "\"primary_retail_price\"",
    cost: "\"primary_cost\"",
    stock_on_hand: "\"primary_stock_on_hand\"",
    last_sale_date: "\"primary_last_sale_date\"",
    primary_last_sale_date: "\"primary_last_sale_date\"",
    effective_last_sale_date: "\"primary_effective_last_sale_date\"",
    primary_effective_last_sale_date: "\"primary_effective_last_sale_date\"",
    barcode: "\"barcode\"",
    catalog_number: "\"catalog_number\"",
    product_type: "\"product_type\"",
    vendor_id: "\"vendor_id\"",
    isbn: "\"isbn\"",
    edition: "\"edition\"",
    units_sold_30d: "\"units_sold_30d\"",
    units_sold_1y: "\"units_sold_1y\"",
    units_sold_lifetime: "\"units_sold_lifetime\"",
    revenue_30d: "\"revenue_30d\"",
    revenue_1y: "\"revenue_1y\"",
    txns_1y: "\"txns_1y\"",
    updated_at: "\"updated_at\"",
    dept_num: "\"dept_num\"",
    margin_ratio: "\"margin_ratio\"",
  } as Record<string, string>)[
    basePlan.sortField === "effective_last_sale_date"
      ? "primary_effective_last_sale_date"
      : basePlan.sortField === "last_sale_date"
        ? "primary_last_sale_date"
        : basePlan.sortField
  ] ?? "\"sku\"";
  const sortDirectionSql = basePlan.ascending ? "ASC" : "DESC";
  const secondarySortDirectionSql = new Set([
    "retail_price",
    "cost",
    "stock_on_hand",
    "primary_last_sale_date",
    "primary_effective_last_sale_date",
  ]).has(
    basePlan.sortField === "effective_last_sale_date"
      ? "primary_effective_last_sale_date"
      : basePlan.sortField === "last_sale_date"
        ? "primary_last_sale_date"
        : basePlan.sortField,
  )
    ? "ASC"
    : sortDirectionSql;
  const orderBySql = `${sortFieldSql} ${sortDirectionSql} NULLS LAST, "sku" ${secondarySortDirectionSql}`;

  return {
    isEmpty: false,
    cteSql,
    params: builder.params,
    orderBySql,
    from,
  };
}

export async function searchProductBrowseRows(
  filters: ProductFilters,
  options: { countOnly: true },
): Promise<ProductBrowseCountResult>;
export async function searchProductBrowseRows(
  filters: ProductFilters,
  options?: SearchProductBrowseRowsOptions,
): Promise<ProductBrowseSearchResult>;
export async function searchProductBrowseRows(
  filters: ProductFilters,
  options: SearchProductBrowseRowsOptions = {},
): Promise<ProductBrowseSearchResult | ProductBrowseCountResult> {
  const locationIds = normalizeProductLocationIds(filters.locationIds);
  const query = await buildFilteredBrowseQuery(filters, options);

  if (query.isEmpty) {
    return {
      products: [],
      total: 0,
      page: filters.page,
      pageSize: PAGE_SIZE,
    };
  }

  const { cteSql, params, orderBySql, from } = query;

  if (options.countOnly) {
    const totalRows = await prisma.$queryRawUnsafe<Array<{ total: bigint | number | string }>>(
      `
        ${cteSql}
        SELECT COUNT(*) AS total
        FROM filtered
      `,
      ...params,
    );

    return {
      products: [],
      total: toNumber(totalRows[0]?.total ?? 0),
      page: filters.page,
      pageSize: PAGE_SIZE,
    };
  }

  const baseRows = await prisma.$queryRawUnsafe<ProductBrowseBaseRow[]>(
    `
      ${cteSql}
      SELECT *
      FROM filtered
      ORDER BY ${orderBySql}
      OFFSET $${params.length + 1}
      LIMIT $${params.length + 2}
    `,
    ...params,
    from,
    PAGE_SIZE,
  );

  const totalRows = await prisma.$queryRawUnsafe<Array<{ total: bigint | number | string }>>(
    `
      ${cteSql}
      SELECT COUNT(*) AS total
      FROM filtered
    `,
    ...params,
  );

  const pageSkus = baseRows.map((row) => toNumber(row.sku));
  const inventoryRows = pageSkus.length === 0
    ? []
    : await prisma.$queryRawUnsafe<ProductInventoryQueryRow[]>(
      `
        SELECT sku, location_id, location_abbrev, retail_price, cost, stock_on_hand, last_sale_date
        FROM product_inventory
        WHERE sku IN (${pageSkus.map((_, index) => `$${index + 1}`).join(", ")})
          AND location_id IN (${locationIds.map((_, index) => `$${pageSkus.length + index + 1}`).join(", ")})
          AND synced_at > $${pageSkus.length + locationIds.length + 1}
        ORDER BY sku ASC, location_id ASC
      `,
      ...pageSkus,
      ...locationIds,
      INVALIDATED_PRODUCT_INVENTORY_SYNCED_AT,
    );

  const slicesBySku = new Map<number, ProductInventorySliceRow[]>();
  for (const row of inventoryRows) {
    const sku = toNumber(row.sku);
    const existing = slicesBySku.get(sku) ?? [];
    existing.push({
      locationId: row.location_id,
      locationAbbrev: row.location_abbrev,
      retailPrice: toNullableNumber(row.retail_price),
      cost: toNullableNumber(row.cost),
      stockOnHand: toNullableInteger(row.stock_on_hand),
      lastSaleDate: toNullableIsoString(row.last_sale_date),
    });
    slicesBySku.set(sku, existing);
  }

  const products = baseRows.map((row) => {
    const sku = toNumber(row.sku);
    const base: ProductBrowseBase = {
      sku,
      barcode: row.barcode,
      itemTaxTypeId: toNullableInteger(row.item_tax_type_id),
      item_type: row.item_type,
      description: row.description,
      author: row.author,
      title: row.title,
      isbn: row.isbn,
      edition: row.edition,
      retail_price: toNullableNumber(row.retail_price),
      cost: toNullableNumber(row.cost),
      stock_on_hand: toNullableInteger(row.stock_on_hand),
      catalog_number: row.catalog_number,
      vendor_id: toNullableInteger(row.vendor_id),
      dcc_id: toNullableInteger(row.dcc_id),
      product_type: row.product_type,
      color_id: toNullableInteger(row.color_id),
      created_at: toNullableIsoString(row.created_at),
      updated_at: toIsoString(row.updated_at),
      manual_updated_at: toNullableIsoString(row.manual_updated_at),
      last_sale_date: toNullableIsoString(row.last_sale_date),
      synced_at: toNullableIsoString(row.synced_at) ?? toIsoString(row.updated_at),
      dept_num: toNullableInteger(row.dept_num),
      class_num: toNullableInteger(row.class_num),
      cat_num: toNullableInteger(row.cat_num),
      dept_name: row.dept_name,
      class_name: row.class_name,
      cat_name: row.cat_name,
      units_sold_30d: toNumber(row.units_sold_30d),
      units_sold_90d: toNumber(row.units_sold_90d),
      units_sold_1y: toNumber(row.units_sold_1y),
      units_sold_3y: toNumber(row.units_sold_3y),
      units_sold_lifetime: toNumber(row.units_sold_lifetime),
      revenue_30d: toNumber(row.revenue_30d),
      revenue_90d: toNumber(row.revenue_90d),
      revenue_1y: toNumber(row.revenue_1y),
      revenue_3y: toNumber(row.revenue_3y),
      revenue_lifetime: toNumber(row.revenue_lifetime),
      txns_1y: toNumber(row.txns_1y),
      txns_lifetime: toNumber(row.txns_lifetime),
      first_sale_date_computed: toNullableIsoString(row.first_sale_date_computed),
      last_sale_date_computed: toNullableIsoString(row.last_sale_date_computed),
      sales_aggregates_computed_at: toNullableIsoString(row.sales_aggregates_computed_at),
      effective_last_sale_date: toNullableIsoString(row.effective_last_sale_date),
      aggregates_ready: row.aggregates_ready ?? undefined,
      edited_since_sync: row.edited_since_sync ?? undefined,
      margin_ratio: toNullableNumber(row.margin_ratio),
      stock_coverage_days: toNullableNumber(row.stock_coverage_days),
      trend_direction: row.trend_direction,
      discontinued: row.discontinued,
      primary_location_requested_id: row.primary_location_requested_id ?? null,
    };

    return buildProductBrowseRow(base, slicesBySku.get(sku) ?? [], locationIds);
  });

  return {
    products,
    total: toNumber(totalRows[0]?.total ?? 0),
    page: filters.page,
    pageSize: PAGE_SIZE,
  };
}
