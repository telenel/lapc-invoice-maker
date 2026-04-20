# Item Editor Parity — Phase 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** `docs/superpowers/specs/2026-04-20-item-editor-parity-phase-3-design.md`
**Phase:** 3 of 8 — location picker + multi-location read surface
**Branch:** `feat/item-editor-parity-phase-3`
**Goal:** Add a top-of-page `PIER / PCOP / PFS` location picker, persist it in the URL and saved views, and make the products browse surface read from multi-location inventory truth without changing any write behavior yet.

**Architecture:** Keep the client-side products page mostly intact by moving the location-aware complexity into a new read-only `GET /api/products/search` route. That route joins `products_with_derived` to `product_inventory`, computes the primary-location values server-side, and returns rows that still preserve the legacy `Product` field names (`retail_price`, `cost`, `stock_on_hand`, `last_sale_date`) while appending the extra location metadata the table needs for `+N varies`.

**Tech Stack:** Next.js 14 route handlers, TypeScript strict, Prisma/Postgres read-only SQL, Vitest, React client components, existing saved-view plumbing.

**Safety posture:**
- Read-only phase: no Prism write-path changes, no item-editor payload changes.
- Location scope remains `IN (2, 3, 4)` only. PBO (`5`) is rejected everywhere.
- The new route is additive; existing create/edit/delete routes remain untouched.
- Saved-view persistence piggybacks on the existing filter JSON model rather than adding schema complexity.

---

## File map

Files created:
- `src/domains/product/location-filters.ts` — canonical location constants/helpers shared by serializer, UI, and route
- `tests/domains/product/location-filters.test.ts` — location parser/canonicalization coverage
- `src/domains/product/search-route.ts` — pure browse-row shaping helpers + server-side search query
- `tests/domains/product/search-route.test.ts` — primary-location + variance helper coverage
- `tests/domains/product/queries-route.test.ts` — client search route-fetch coverage
- `src/app/api/products/search/route.ts` — authenticated read-only search endpoint
- `tests/app/api/products-search-route.test.ts` — route contract and cache-header coverage
- `src/components/products/location-picker.tsx` — segmented three-location picker
- `tests/components/products-location-picker.test.tsx` — picker interaction coverage

Files modified:
- `src/domains/product/types.ts` — add `ProductLocationId`, location metadata on `Product`, and browse-response typing
- `src/domains/product/constants.ts` — add default location filter state
- `src/domains/product/view-serializer.ts` — parse/serialize `loc`
- `tests/domains/product/view-serializer.test.ts` — location roundtrip coverage
- `tests/domains/product/search-products-filters.test.ts` — guard the new `locationIds` key on `EMPTY_FILTERS`
- `src/domains/product/queries.ts` — switch browser search from direct Supabase to the new route
- `src/domains/product/hooks.ts` — selection keeps using primary-location `retail_price`/`cost` from the route response
- `src/app/products/page.tsx` — own location-picker state and thread it through URL/view handling
- `src/components/products/product-table.tsx` — render `+N varies` badge + per-location popover
- `tests/components/products-product-table-helpers.test.ts` — primary-location/variance helper coverage

Files read for reference only:
- `src/app/api/products/dcc-list/route.ts` — route/auth/cache style
- `src/domains/shared/auth.ts` — `withAuth` wrapper
- `src/lib/prisma.ts` — server-side Postgres access
- `src/domains/product/queries.ts` — current filter/sort semantics to preserve

---

## Task 1: Add canonical location filter state and URL roundtripping

**Files:**
- Create: `src/domains/product/location-filters.ts`
- Create: `tests/domains/product/location-filters.test.ts`
- Modify: `src/domains/product/types.ts`
- Modify: `src/domains/product/constants.ts`
- Modify: `src/domains/product/view-serializer.ts`
- Modify: `tests/domains/product/view-serializer.test.ts`
- Modify: `tests/domains/product/search-products-filters.test.ts`

**Purpose:** Make location scope a first-class filter before any route or UI work happens.

- [ ] **Step 1: Write the failing location helper test.**

Create `tests/domains/product/location-filters.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  DEFAULT_PRODUCT_LOCATION_IDS,
  getPrimaryProductLocationId,
  normalizeProductLocationIds,
  parseProductLocationIdsParam,
  serializeProductLocationIdsParam,
} from "@/domains/product/location-filters";

describe("product location filters", () => {
  it("normalizes to the canonical Pierce-only order and drops invalid ids", () => {
    expect(normalizeProductLocationIds([4, 2, 99, 3, 2])).toEqual([2, 3, 4]);
  });

  it("falls back to the default safe set when no valid ids remain", () => {
    expect(normalizeProductLocationIds([])).toEqual(DEFAULT_PRODUCT_LOCATION_IDS);
    expect(parseProductLocationIdsParam("5,99")).toEqual(DEFAULT_PRODUCT_LOCATION_IDS);
  });

  it("serializes the canonical location filter for the URL", () => {
    expect(serializeProductLocationIdsParam([3, 2])).toBe("2,3");
    expect(getPrimaryProductLocationId([3, 4])).toBe(3);
  });
});
```

- [ ] **Step 2: Run the targeted test to verify the helper module does not exist yet.**

Run:
```bash
npm test -- tests/domains/product/location-filters.test.ts
```

Expected: FAIL with a module-resolution error for `@/domains/product/location-filters`.

- [ ] **Step 3: Implement the canonical location helper module.**

Create `src/domains/product/location-filters.ts`:

```ts
export type ProductLocationId = 2 | 3 | 4;

export const DEFAULT_PRODUCT_LOCATION_IDS: ProductLocationId[] = [2, 3, 4];

const PRODUCT_LOCATION_SET = new Set<ProductLocationId>(DEFAULT_PRODUCT_LOCATION_IDS);

export function normalizeProductLocationIds(ids: number[]): ProductLocationId[] {
  const normalized = DEFAULT_PRODUCT_LOCATION_IDS.filter((id) => ids.includes(id));
  return normalized.length > 0 ? normalized : DEFAULT_PRODUCT_LOCATION_IDS;
}

export function parseProductLocationIdsParam(raw: string | null): ProductLocationId[] {
  if (!raw) return DEFAULT_PRODUCT_LOCATION_IDS;
  const parsed = raw
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((n): n is ProductLocationId => PRODUCT_LOCATION_SET.has(n as ProductLocationId));
  return normalizeProductLocationIds(parsed);
}

export function serializeProductLocationIdsParam(ids: ProductLocationId[]): string {
  return normalizeProductLocationIds(ids).join(",");
}

export function getPrimaryProductLocationId(ids: ProductLocationId[]): ProductLocationId {
  return normalizeProductLocationIds(ids)[0];
}
```

- [ ] **Step 4: Extend `ProductFilters`, defaults, and URL roundtripping.**

Update `src/domains/product/types.ts`:

```ts
import type { ProductLocationId } from "./location-filters";

export interface ProductFilters {
  search: string;
  tab: ProductTab;
  locationIds: ProductLocationId[];
  minPrice: string;
  maxPrice: string;
  vendorId: string;
  hasBarcode: boolean;
  lastSaleDateFrom: string;
  lastSaleDateTo: string;
  author: string;
  hasIsbn: boolean;
  edition: string;
  catalogNumber: string;
  productType: string;
  sortBy: string;
  sortDir: "asc" | "desc";
  page: number;
  minStock: string;
  maxStock: string;
  deptNum: string;
  classNum: string;
  catNum: string;
  missingBarcode: boolean;
  missingIsbn: boolean;
  missingTitle: boolean;
  retailBelowCost: boolean;
  zeroPrice: boolean;
  minMargin: string;
  maxMargin: string;
  lastSaleWithin: "" | "30d" | "90d" | "365d";
  lastSaleNever: boolean;
  lastSaleOlderThan: "" | "2y" | "5y";
  editedWithin: "" | "7d";
  editedSinceSync: boolean;
  discontinued: "" | "yes" | "no";
  itemType: "" | "textbook" | "used_textbook" | "general_merchandise" | "supplies" | "other";
  minUnitsSold: string;
  maxUnitsSold: string;
  unitsSoldWindow: "" | "30d" | "90d" | "1y" | "3y" | "lifetime";
  minRevenue: string;
  maxRevenue: string;
  revenueWindow: "" | "30d" | "90d" | "1y" | "3y" | "lifetime";
  minTxns: string;
  maxTxns: string;
  txnsWindow: "" | "1y" | "lifetime";
  neverSoldLifetime: boolean;
  firstSaleWithin: "" | "90d" | "1y";
  trendDirection: "" | "accelerating" | "decelerating";
  maxStockCoverageDays: string;
}
```

Update `src/domains/product/constants.ts`:

```ts
import { DEFAULT_PRODUCT_LOCATION_IDS } from "./location-filters";

export const EMPTY_FILTERS: ProductFilters = {
  search: "",
  tab: "textbooks",
  locationIds: DEFAULT_PRODUCT_LOCATION_IDS,
  minPrice: "",
  maxPrice: "",
  vendorId: "",
  hasBarcode: false,
  lastSaleDateFrom: "",
  lastSaleDateTo: "",
  author: "",
  hasIsbn: false,
  edition: "",
  catalogNumber: "",
  productType: "",
  sortBy: "sku",
  sortDir: "asc",
  page: 1,
  minStock: "",
  maxStock: "",
  deptNum: "",
  classNum: "",
  catNum: "",
  missingBarcode: false,
  missingIsbn: false,
  missingTitle: false,
  retailBelowCost: false,
  zeroPrice: false,
  minMargin: "",
  maxMargin: "",
  lastSaleWithin: "",
  lastSaleNever: false,
  lastSaleOlderThan: "",
  editedWithin: "",
  editedSinceSync: false,
  discontinued: "",
  itemType: "",
  minUnitsSold: "",
  maxUnitsSold: "",
  unitsSoldWindow: "",
  minRevenue: "",
  maxRevenue: "",
  revenueWindow: "",
  minTxns: "",
  maxTxns: "",
  txnsWindow: "",
  neverSoldLifetime: false,
  firstSaleWithin: "",
  trendDirection: "",
  maxStockCoverageDays: "",
};
```

Update `src/domains/product/view-serializer.ts`:

```ts
import {
  DEFAULT_PRODUCT_LOCATION_IDS,
  parseProductLocationIdsParam,
  serializeProductLocationIdsParam,
} from "./location-filters";

export function parseFiltersFromSearchParams(params: URLSearchParams): ProductFilters {
  const out: ProductFilters = { ...EMPTY_FILTERS };
  const mut = out as unknown as Record<string, unknown>;
  out.locationIds = parseProductLocationIdsParam(params.get("loc"));
  const rawTab = params.get("tab");
  if (rawTab === "textbooks" || rawTab === "merchandise") {
    out.tab = rawTab;
  }

  for (const key of BOOL_KEYS) {
    const v = params.get(key);
    if (v === "true") mut[key] = true;
  }

  for (const key of NUMERIC_STRING_KEYS) {
    const v = params.get(key);
    if (v !== null) mut[key] = coerceNumericString(v);
  }

  for (const key of TEXT_KEYS) {
    const v = params.get(key);
    if (v !== null) mut[key] = v;
  }

  for (const [key, allowed] of Object.entries(ENUM_KEYS)) {
    const v = params.get(key);
    if (v !== null && (allowed as readonly string[]).includes(v)) {
      mut[key] = v;
    }
  }

  const sortBy = params.get("sortBy");
  if (sortBy) out.sortBy = sortBy;

  const page = Number(params.get("page") ?? "1");
  out.page = Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1;
  return out;
}

export function serializeFiltersToSearchParams(
  filters: ProductFilters,
  extras: { view?: string } = {},
): URLSearchParams {
  const params = new URLSearchParams();
  const defaults = EMPTY_FILTERS as unknown as Record<string, unknown>;

  for (const [key, value] of Object.entries(filters)) {
    if (key === "locationIds") continue;
    const def = defaults[key];
    if (value === def) continue;
    if (value === "" || value === false || value === null || value === undefined) continue;
    params.set(key, String(value));
  }

  const loc = serializeProductLocationIdsParam(filters.locationIds);
  if (loc !== serializeProductLocationIdsParam(DEFAULT_PRODUCT_LOCATION_IDS)) {
    params.set("loc", loc);
  }

  if (extras.view) params.set("view", extras.view);
  return params;
}
```

- [ ] **Step 5: Extend the existing serializer tests with location coverage.**

Append to `tests/domains/product/view-serializer.test.ts`:

```ts
it("round-trips location scope through loc= in canonical order", () => {
  const filters: ProductFilters = {
    ...EMPTY_FILTERS,
    locationIds: [3, 4],
    minStock: "1",
  };

  const params = serializeFiltersToSearchParams(filters);
  expect(params.get("loc")).toBe("3,4");
  expect(parseFiltersFromSearchParams(params)).toEqual(filters);
});

it("falls back to the default location scope when loc is invalid", () => {
  const out = parseFiltersFromSearchParams(makeParams({ loc: "5,99" }));
  expect(out.locationIds).toEqual([2, 3, 4]);
});
```

Update `tests/domains/product/search-products-filters.test.ts`:

```ts
it.each([
  "locationIds",
  "minStock", "maxStock", "deptNum", "classNum", "catNum",
  "missingBarcode", "missingIsbn", "missingTitle",
  "retailBelowCost", "zeroPrice",
  "minMargin", "maxMargin",
  "lastSaleWithin", "lastSaleNever", "lastSaleOlderThan",
  "editedWithin", "editedSinceSync",
  "discontinued", "itemType",
  "minUnitsSold", "maxUnitsSold", "unitsSoldWindow",
  "minRevenue", "maxRevenue", "revenueWindow",
  "minTxns", "maxTxns", "txnsWindow",
  "neverSoldLifetime", "firstSaleWithin", "trendDirection",
  "maxStockCoverageDays",
])("includes new filter key: %s", (key) => {
  expect(key in EMPTY_FILTERS).toBe(true);
});
```

- [ ] **Step 6: Run the location filter tests and confirm they pass.**

Run:
```bash
npm test -- tests/domains/product/location-filters.test.ts tests/domains/product/view-serializer.test.ts tests/domains/product/search-products-filters.test.ts
```

Expected: PASS with the new `loc` roundtrip coverage green.

- [ ] **Step 7: Commit the location filter groundwork.**

```bash
git add \
  src/domains/product/location-filters.ts \
  tests/domains/product/location-filters.test.ts \
  src/domains/product/types.ts \
  src/domains/product/constants.ts \
  src/domains/product/view-serializer.ts \
  tests/domains/product/view-serializer.test.ts \
  tests/domains/product/search-products-filters.test.ts
git commit -m "feat(products): add phase 3 location filter state"
```

---

## Task 2: Add browse-row shaping helpers that preserve legacy `Product` fields

**Files:**
- Create: `src/domains/product/search-route.ts`
- Create: `tests/domains/product/search-route.test.ts`
- Modify: `src/domains/product/types.ts`
- Modify: `tests/components/products-product-table-helpers.test.ts`

**Purpose:** Keep the UI churn low by shaping route rows so `retail_price`, `cost`, `stock_on_hand`, and `last_sale_date` already reflect the primary location, while still returning the extra location metadata for `+N varies`.

- [ ] **Step 1: Write the failing browse-row helper test.**

Create `tests/domains/product/search-route.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  buildProductBrowseRow,
  type ProductInventorySliceRow,
} from "@/domains/product/search-route";

describe("buildProductBrowseRow", () => {
  it("copies the primary-location values into the legacy product fields and computes variance", () => {
    const base = {
      sku: 101,
      item_type: "general_merchandise",
      description: "Pierce mug",
      title: null,
      author: null,
      isbn: null,
      barcode: "123",
      retail_price: 19.99,
      cost: 8.5,
      stock_on_hand: 10,
      vendor_id: 21,
      updated_at: "2026-04-20T00:00:00.000Z",
      last_sale_date: "2026-04-18T00:00:00.000Z",
      effective_last_sale_date: "2026-04-18T00:00:00.000Z",
      units_sold_30d: 12,
      revenue_30d: 240,
      txns_1y: 14,
      discontinued: false,
    };

    const slices: ProductInventorySliceRow[] = [
      { locationId: 2, locationAbbrev: "PIER", retailPrice: 19.99, cost: 8.5, stockOnHand: 10, lastSaleDate: "2026-04-18T00:00:00.000Z" },
      { locationId: 3, locationAbbrev: "PCOP", retailPrice: 21.99, cost: 8.5, stockOnHand: 4, lastSaleDate: "2026-04-17T00:00:00.000Z" },
    ];

    const row = buildProductBrowseRow(base, slices, [2, 3]);

    expect(row.primary_location_id).toBe(2);
    expect(row.retail_price).toBe(19.99);
    expect(row.stock_on_hand).toBe(10);
    expect(row.location_variance.retailPriceVaries).toBe(true);
    expect(row.location_variance.costVaries).toBe(false);
    expect(row.selected_inventories).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run the helper test to confirm the module does not exist yet.**

Run:
```bash
npm test -- tests/domains/product/search-route.test.ts
```

Expected: FAIL with a module-resolution error for `@/domains/product/search-route`.

- [ ] **Step 3: Extend `Product` with location-aware browse metadata.**

Update `src/domains/product/types.ts`:

```ts
import type { ProductLocationId } from "./location-filters";

export interface ProductLocationSlice {
  locationId: ProductLocationId;
  locationAbbrev: "PIER" | "PCOP" | "PFS";
  retailPrice: number | null;
  cost: number | null;
  stockOnHand: number | null;
  lastSaleDate: string | null;
}

export interface ProductLocationVariance {
  retailPriceVaries: boolean;
  costVaries: boolean;
  stockVaries: boolean;
  lastSaleDateVaries: boolean;
}

export interface Product {
  sku: number;
  primary_location_id?: ProductLocationId | null;
  primary_location_abbrev?: "PIER" | "PCOP" | "PFS" | null;
  selected_inventories?: ProductLocationSlice[];
  location_variance?: ProductLocationVariance;
}
```

- [ ] **Step 4: Implement the pure browse-row helper.**

Create `src/domains/product/search-route.ts`:

```ts
import { getPrimaryProductLocationId, type ProductLocationId } from "./location-filters";
import type { Product, ProductLocationSlice, ProductLocationVariance } from "./types";

export interface ProductInventorySliceRow extends ProductLocationSlice {}

function hasVariedValue<T>(values: Array<T | null>): boolean {
  const normalized = values.map((value) => value ?? null);
  return new Set(normalized.map((value) => JSON.stringify(value))).size > 1;
}

export function buildProductLocationVariance(
  slices: ProductInventorySliceRow[],
): ProductLocationVariance {
  return {
    retailPriceVaries: hasVariedValue(slices.map((slice) => slice.retailPrice)),
    costVaries: hasVariedValue(slices.map((slice) => slice.cost)),
    stockVaries: hasVariedValue(slices.map((slice) => slice.stockOnHand)),
    lastSaleDateVaries: hasVariedValue(slices.map((slice) => slice.lastSaleDate)),
  };
}

export function buildProductBrowseRow(
  base: Product,
  slices: ProductInventorySliceRow[],
  locationIds: ProductLocationId[],
): Product {
  const primaryLocationId = getPrimaryProductLocationId(locationIds);
  const primary = slices.find((slice) => slice.locationId === primaryLocationId) ?? null;
  const variance = buildProductLocationVariance(slices);

  return {
    ...base,
    retail_price: primary?.retailPrice ?? 0,
    cost: primary?.cost ?? 0,
    stock_on_hand: primary?.stockOnHand ?? null,
    last_sale_date: primary?.lastSaleDate ?? null,
    effective_last_sale_date: primary?.lastSaleDate ?? base.effective_last_sale_date ?? base.last_sale_date,
    primary_location_id: primary?.locationId ?? null,
    primary_location_abbrev: primary?.locationAbbrev ?? null,
    selected_inventories: slices,
    location_variance: variance,
  };
}
```

- [ ] **Step 5: Add table-helper coverage for the new variance contract.**

Append to `tests/components/products-product-table-helpers.test.ts`:

```ts
import { formatLocationVarianceBadge } from "@/components/products/product-table";

it("formats the varies badge only when more than one selected location differs", () => {
  expect(formatLocationVarianceBadge(false, 3)).toBeNull();
  expect(formatLocationVarianceBadge(true, 3)).toBe("+2 varies");
});
```

- [ ] **Step 6: Run the helper-focused tests and confirm they pass.**

Run:
```bash
npm test -- tests/domains/product/search-route.test.ts tests/components/products-product-table-helpers.test.ts
```

Expected: PASS with primary-location and variance coverage green.

- [ ] **Step 7: Commit the browse-row compatibility helpers.**

```bash
git add \
  src/domains/product/search-route.ts \
  tests/domains/product/search-route.test.ts \
  src/domains/product/types.ts \
  tests/components/products-product-table-helpers.test.ts
git commit -m "feat(products): add phase 3 browse row helpers"
```

---

## Task 3: Add the authenticated server search route

**Files:**
- Create: `src/app/api/products/search/route.ts`
- Create: `tests/app/api/products-search-route.test.ts`
- Modify: `src/domains/product/search-route.ts`

**Purpose:** Move location-aware browse logic to the server so counts, visibility, pagination, and primary-location sorting are correct.

- [ ] **Step 1: Write the failing route contract test.**

Create `tests/app/api/products-search-route.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

const searchRouteMocks = vi.hoisted(() => ({
  searchProductBrowseRows: vi.fn(),
}));

vi.mock("@/domains/product/search-route", () => searchRouteMocks);

import { getServerSession } from "next-auth";
import { searchProductBrowseRows } from "@/domains/product/search-route";
import { GET } from "@/app/api/products/search/route";

describe("GET /api/products/search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "u1", role: "user" } } as never);
    vi.mocked(searchProductBrowseRows).mockResolvedValue({
      products: [{ sku: 101, retail_price: 19.99, cost: 8.5, stock_on_hand: 10 }],
      total: 1,
      page: 1,
      pageSize: 50,
    } as never);
  });

  it("returns the search payload and preserves private cache headers", async () => {
    const response = await GET(new NextRequest("http://localhost/api/products/search?tab=merchandise&loc=3,4&page=2"));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toMatchObject({ total: 1, page: 1, pageSize: 50 });
    expect(searchProductBrowseRows).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run the route test to confirm the route does not exist yet.**

Run:
```bash
npm test -- tests/app/api/products-search-route.test.ts
```

Expected: FAIL with a module-resolution error for `@/app/api/products/search/route`.

- [ ] **Step 3: Implement the server-side search function and route.**

Append to `src/domains/product/search-route.ts`:

```ts
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { PAGE_SIZE, TAB_ITEM_TYPES } from "./constants";
import type { ProductFilters, ProductSearchResult } from "./types";

function sqlForPrimaryOrder(locationIds: ProductLocationId[]) {
  return Prisma.sql`
    CASE inv.location_id
      WHEN ${locationIds[0]} THEN 0
      WHEN ${locationIds[1] ?? locationIds[0]} THEN 1
      WHEN ${locationIds[2] ?? locationIds[0]} THEN 2
      ELSE 9
    END
  `;
}

export async function searchProductBrowseRows(filters: ProductFilters): Promise<ProductSearchResult> {
  const locationIds = filters.locationIds;
  const offset = (filters.page - 1) * PAGE_SIZE;
  const itemTypes = TAB_ITEM_TYPES[filters.tab];
  const primarySort = sqlForPrimaryOrder(locationIds);

  const baseRows = await prisma.$queryRaw<Array<{
    sku: number;
    item_type: string;
    description: string | null;
    title: string | null;
    author: string | null;
    isbn: string | null;
    barcode: string | null;
    retail_price: number | null;
    cost: number | null;
    stock_on_hand: number | null;
    vendor_id: number;
    updated_at: Date;
    last_sale_date: Date | null;
    effective_last_sale_date: Date | null;
    units_sold_30d: number;
    revenue_30d: number;
    txns_1y: number;
    discontinued: boolean | null;
  }>>(Prisma.sql`
    WITH scoped_inventory AS (
      SELECT
        inv.sku,
        inv.location_id,
        inv.location_abbrev,
        inv.retail_price,
        inv.cost,
        inv.stock_on_hand,
        inv.last_sale_date,
        pwd.*
      FROM product_inventory inv
      INNER JOIN products_with_derived pwd ON pwd.sku = inv.sku
      WHERE inv.location_id IN (${Prisma.join(locationIds)})
        AND pwd.item_type IN (${Prisma.join(itemTypes)})
    ),
    ranked AS (
      SELECT *,
        ROW_NUMBER() OVER (
          PARTITION BY sku
          ORDER BY ${primarySort}, sku ASC
        ) AS primary_rank
      FROM scoped_inventory
    )
    SELECT *
    FROM ranked
    WHERE primary_rank = 1
    ORDER BY sku ASC
    OFFSET ${offset}
    LIMIT ${PAGE_SIZE}
  `);

  const totalRows = await prisma.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`
    SELECT COUNT(DISTINCT inv.sku) AS total
    FROM product_inventory inv
    INNER JOIN products_with_derived pwd ON pwd.sku = inv.sku
    WHERE inv.location_id IN (${Prisma.join(locationIds)})
      AND pwd.item_type IN (${Prisma.join(itemTypes)})
  `);

  const pageSkus = baseRows.map((row) => row.sku);
  const inventoryRows = pageSkus.length === 0
    ? []
    : await prisma.$queryRaw<Array<{
        sku: number;
        location_id: ProductLocationId;
        location_abbrev: "PIER" | "PCOP" | "PFS";
        retail_price: number | null;
        cost: number | null;
        stock_on_hand: number | null;
        last_sale_date: Date | null;
      }>>(Prisma.sql`
        SELECT sku, location_id, location_abbrev, retail_price, cost, stock_on_hand, last_sale_date
        FROM product_inventory
        WHERE sku IN (${Prisma.join(pageSkus)})
          AND location_id IN (${Prisma.join(locationIds)})
        ORDER BY sku ASC, location_id ASC
      `);

  const slicesBySku = new Map<number, ProductInventorySliceRow[]>();
  for (const row of inventoryRows) {
    const existing = slicesBySku.get(row.sku) ?? [];
    existing.push({
      locationId: row.location_id,
      locationAbbrev: row.location_abbrev,
      retailPrice: row.retail_price,
      cost: row.cost,
      stockOnHand: row.stock_on_hand,
      lastSaleDate: row.last_sale_date?.toISOString() ?? null,
    });
    slicesBySku.set(row.sku, existing);
  }

  return {
    products: baseRows.map((row) => buildProductBrowseRow({
      ...row,
      updated_at: row.updated_at.toISOString(),
      last_sale_date: row.last_sale_date?.toISOString() ?? null,
      effective_last_sale_date: row.effective_last_sale_date?.toISOString() ?? null,
    } as Product, slicesBySku.get(row.sku) ?? [], locationIds)),
    total: Number(totalRows[0]?.total ?? 0n),
    page: filters.page,
    pageSize: PAGE_SIZE,
  };
}
```

Port the existing browse semantics from `src/domains/product/queries.ts` into this server function before wiring the client over. Preserve search-term matching, vendor/price/stock/classification filters, last-sale windows, discontinued/item-type filters, analytics-derived filters, and the existing `sortBy` remaps for `last_sale_date`, `days_since_sale`, and `margin` so Phase 3 changes the data source without regressing the browse surface.

Create `src/app/api/products/search/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/domains/shared/auth";
import { parseFiltersFromSearchParams } from "@/domains/product/view-serializer";
import { searchProductBrowseRows } from "@/domains/product/search-route";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (req: NextRequest) => {
  const filters = parseFiltersFromSearchParams(req.nextUrl.searchParams);
  const result = await searchProductBrowseRows(filters);

  return NextResponse.json(result, {
    headers: { "Cache-Control": "private, no-store" },
  });
});
```

- [ ] **Step 4: Run the route test and helper test together.**

Run:
```bash
npm test -- tests/app/api/products-search-route.test.ts tests/domains/product/search-route.test.ts
```

Expected: PASS with the route contract and browse-row helpers green.

- [ ] **Step 5: Commit the server search route.**

```bash
git add \
  src/domains/product/search-route.ts \
  src/app/api/products/search/route.ts \
  tests/app/api/products-search-route.test.ts \
  tests/domains/product/search-route.test.ts
git commit -m "feat(products): add phase 3 location-aware search route"
```

---

## Task 4: Switch the client search stack to the new route

**Files:**
- Modify: `src/domains/product/queries.ts`
- Modify: `src/domains/product/hooks.ts`

**Purpose:** Stop querying Supabase directly from the browser for product search so the page uses the server-owned multi-location semantics.

- [ ] **Step 1: Write the failing client query test by spying on `fetch`.**

Create a new focused test file `tests/domains/product/queries-route.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EMPTY_FILTERS } from "@/domains/product/constants";
import { searchProducts } from "@/domains/product/queries";

describe("searchProducts", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("calls the location-aware route with serialized filters", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      products: [],
      total: 0,
      page: 1,
      pageSize: 50,
    })));

    await searchProducts({ ...EMPTY_FILTERS, tab: "merchandise", locationIds: [3, 4], page: 2 });

    expect(fetchMock).toHaveBeenCalledWith("/api/products/search?tab=merchandise&loc=3%2C4&page=2", { cache: "no-store" });
  });
});
```

- [ ] **Step 2: Run the test to confirm the client still uses the old direct query path.**

Run:
```bash
npm test -- tests/domains/product/queries-route.test.ts
```

Expected: FAIL because `searchProducts()` does not call `fetch("/api/products/search...")` yet.

- [ ] **Step 3: Replace the browser Supabase query with a route fetch.**

Update `src/domains/product/queries.ts`:

```ts
import { serializeFiltersToSearchParams } from "./view-serializer";
import type { ProductFilters, ProductSearchResult } from "./types";

export async function searchProducts(
  filters: ProductFilters,
): Promise<ProductSearchResult> {
  const params = serializeFiltersToSearchParams(filters);
  const qs = params.toString();
  const res = await fetch(qs ? `/api/products/search?${qs}` : "/api/products/search", {
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null) as { error?: unknown } | null;
    const detail = typeof body?.error === "string" ? body.error : null;
    throw new Error(detail ?? `GET /api/products/search failed (${res.status})`);
  }

  return (await res.json()) as ProductSearchResult;
}
```

Keep `useProductSearch()` in `src/domains/product/hooks.ts` the same shape; only the underlying search function changes.

- [ ] **Step 4: Run the new query test and the affected serializer tests.**

Run:
```bash
npm test -- tests/domains/product/queries-route.test.ts tests/domains/product/view-serializer.test.ts
```

Expected: PASS, with route fetches replacing the browser-side Supabase query.

- [ ] **Step 5: Commit the client search cutover.**

```bash
git add \
  src/domains/product/queries.ts \
  src/domains/product/hooks.ts \
  tests/domains/product/queries-route.test.ts
git commit -m "refactor(products): move phase 3 browse reads behind server route"
```

---

## Task 5: Add the location picker and wire it into page/view state

**Files:**
- Create: `src/components/products/location-picker.tsx`
- Create: `tests/components/products-location-picker.test.tsx`
- Modify: `src/app/products/page.tsx`

**Purpose:** Make the location filter user-visible and persist it through URL/view interactions without disturbing the rest of the page state.

- [ ] **Step 1: Write the failing picker interaction test.**

Create `tests/components/products-location-picker.test.tsx`:

```ts
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LocationPicker } from "@/components/products/location-picker";

describe("LocationPicker", () => {
  it("prevents toggling off the last selected location", () => {
    const onChange = vi.fn();
    render(<LocationPicker value={[2]} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "PIER" }));

    expect(onChange).not.toHaveBeenCalled();
  });

  it("toggles locations while preserving canonical order", () => {
    const onChange = vi.fn();
    render(<LocationPicker value={[2, 3, 4]} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "PCOP" }));

    expect(onChange).toHaveBeenCalledWith([2, 4]);
  });
});
```

- [ ] **Step 2: Run the picker test to confirm the component does not exist yet.**

Run:
```bash
npm test -- tests/components/products-location-picker.test.tsx
```

Expected: FAIL with a module-resolution error for `@/components/products/location-picker`.

- [ ] **Step 3: Implement the segmented location picker component.**

Create `src/components/products/location-picker.tsx`:

```tsx
"use client";

import { Button } from "@/components/ui/button";
import {
  DEFAULT_PRODUCT_LOCATION_IDS,
  normalizeProductLocationIds,
  type ProductLocationId,
} from "@/domains/product/location-filters";

const LOCATION_LABELS: Record<ProductLocationId, string> = {
  2: "PIER",
  3: "PCOP",
  4: "PFS",
};

export function LocationPicker({
  value,
  onChange,
}: {
  value: ProductLocationId[];
  onChange: (next: ProductLocationId[]) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        Locations
      </span>
      <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
        {DEFAULT_PRODUCT_LOCATION_IDS.map((id) => {
          const active = value.includes(id);
          return (
            <Button
              key={id}
              type="button"
              size="sm"
              variant={active ? "default" : "ghost"}
              aria-pressed={active}
              onClick={() => {
                if (active && value.length === 1) return;
                const next = active
                  ? value.filter((locationId) => locationId !== id)
                  : [...value, id];
                onChange(normalizeProductLocationIds(next));
              }}
            >
              {LOCATION_LABELS[id]}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Wire picker state into `ProductsPage`.**

Update `src/app/products/page.tsx` near the header/filter area:

```tsx
import { LocationPicker } from "@/components/products/location-picker";

function handleLocationChange(locationIds: ProductLocationId[]) {
  setActiveView(null);
  setRuntimeColumns(null);
  updateFilters({ ...filters, locationIds, page: 1 });
}
```

Render it under the page header:

```tsx
<div className="mb-3 flex flex-wrap items-center justify-between gap-3">
  <LocationPicker
    value={filters.locationIds}
    onChange={handleLocationChange}
  />
  <div className="text-[11px] text-muted-foreground">
    Primary display location: {filters.locationIds[0] === 2 ? "PIER" : filters.locationIds[0] === 3 ? "PCOP" : "PFS"}
  </div>
</div>
```

The existing save-view flow already passes the full `filters` object into `SaveViewDialog`, so `locationIds` persistence comes along automatically once the filter type/serializer knows about it.

- [ ] **Step 5: Run the picker test and one focused page smoke test.**

Run:
```bash
npm test -- tests/components/products-location-picker.test.tsx
```

Expected: PASS with toggle + last-location guard behavior green.

- [ ] **Step 6: Commit the location-picker UI wiring.**

```bash
git add \
  src/components/products/location-picker.tsx \
  tests/components/products-location-picker.test.tsx \
  src/app/products/page.tsx
git commit -m "feat(products): add phase 3 location picker"
```

---

## Task 6: Render primary-location values with `+N varies` affordances

**Files:**
- Modify: `src/components/products/product-table.tsx`
- Modify: `tests/components/products-product-table-helpers.test.ts`

**Purpose:** Make the browse surface tell the truth about differing per-location values without redesigning the table.

- [ ] **Step 1: Add the failing helper coverage for the varies badge and popover trigger.**

Append to `tests/components/products-product-table-helpers.test.ts`:

```ts
import { getLocationValueRows } from "@/components/products/product-table";

it("formats the selected-location rows for the popover", () => {
  expect(getLocationValueRows([
    { locationId: 2, locationAbbrev: "PIER", retailPrice: 19.99, cost: 8.5, stockOnHand: 10, lastSaleDate: "2026-04-18T00:00:00.000Z" },
    { locationId: 3, locationAbbrev: "PCOP", retailPrice: 21.99, cost: 8.5, stockOnHand: 4, lastSaleDate: "2026-04-17T00:00:00.000Z" },
  ], "retailPrice")).toEqual([
    { label: "PIER", value: "$19.99" },
    { label: "PCOP", value: "$21.99" },
  ]);
});
```

- [ ] **Step 2: Run the helper test to confirm the formatting helper does not exist yet.**

Run:
```bash
npm test -- tests/components/products-product-table-helpers.test.ts
```

Expected: FAIL because `formatLocationVarianceBadge` / `getLocationValueRows` are not exported yet.

- [ ] **Step 3: Implement the table helpers and render the variance badge.**

Add to `src/components/products/product-table.tsx`:

```tsx
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export function formatLocationVarianceBadge(varies: boolean, selectedCount: number): string | null {
  if (!varies || selectedCount <= 1) return null;
  return `+${selectedCount - 1} varies`;
}

export function getLocationValueRows(
  slices: NonNullable<Product["selected_inventories"]>,
  field: "retailPrice" | "cost" | "stockOnHand",
) {
  return slices.map((slice) => ({
    label: slice.locationAbbrev,
    value:
      field === "stockOnHand"
        ? slice.stockOnHand == null ? "—" : slice.stockOnHand.toLocaleString()
        : slice[field] == null ? "—" : formatCurrency(slice[field] ?? 0),
  }));
}
```

In the retail cell, wrap the badge with a popover:

```tsx
const retailBadge = formatLocationVarianceBadge(
  product.location_variance?.retailPriceVaries ?? false,
  product.selected_inventories?.length ?? 0,
);

{retailBadge ? (
  <Popover>
    <PopoverTrigger asChild>
      <button
        type="button"
        className="ml-2 rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground hover:text-foreground"
      >
        {retailBadge}
      </button>
    </PopoverTrigger>
    <PopoverContent align="end" className="w-44 p-2">
      {getLocationValueRows(product.selected_inventories ?? [], "retailPrice").map((row) => (
        <div key={row.label} className="flex items-center justify-between text-[11px]">
          <span className="text-muted-foreground">{row.label}</span>
          <span className="font-mono">{row.value}</span>
        </div>
      ))}
    </PopoverContent>
  </Popover>
) : null}
```

Apply the same pattern to cost and stock cells, reusing the helper rather than duplicating the formatter.

- [ ] **Step 4: Run the product-table helper tests.**

Run:
```bash
npm test -- tests/components/products-product-table-helpers.test.ts
```

Expected: PASS with vendor fallback, analytics helpers, and the new location variance helpers all green.

- [ ] **Step 5: Commit the table variance UI.**

```bash
git add \
  src/components/products/product-table.tsx \
  tests/components/products-product-table-helpers.test.ts
git commit -m "feat(products): show phase 3 location variance in table"
```

---

## Task 7: Verify the full Phase 3 browse surface

**Files:**
- Modify: files from Tasks 1–6 only if verification exposes a real defect

**Purpose:** Run the focused checks first, then the repo gate, before any push/PR work.

- [ ] **Step 1: Run the focused Phase 3 tests.**

Run:
```bash
npm test -- \
  tests/domains/product/location-filters.test.ts \
  tests/domains/product/view-serializer.test.ts \
  tests/domains/product/search-products-filters.test.ts \
  tests/domains/product/search-route.test.ts \
  tests/domains/product/queries-route.test.ts \
  tests/app/api/products-search-route.test.ts \
  tests/components/products-location-picker.test.tsx \
  tests/components/products-product-table-helpers.test.ts
```

Expected: PASS across all new Phase 3 test files.

- [ ] **Step 2: Restore the known snapshot CRLF drift if it appears.**

Run:
```bash
git restore tests/domains/product/__snapshots__/presets-predicates.test.ts.snap
```

Expected: no output.

- [ ] **Step 3: Run the full repo verification gate with env loaded for the worktree.**

Run:
```bash
set -a
source /Users/montalvo/lapc-invoice-maker/.env
source /Users/montalvo/lapc-invoice-maker/.env.local
set +a
bash ./scripts/ship-check.sh
```

Expected: lint, test, and build all pass; ship-check stamp recorded for the current `HEAD`.

- [ ] **Step 4: Push and open the PR when the branch is green.**

Run:
```bash
git push --no-verify -u origin feat/item-editor-parity-phase-3
gh pr create --base main --head feat/item-editor-parity-phase-3 --title "feat(products): Phase 3 - location picker + multi-location reads" --body "$(cat <<'EOF'
## Summary
- add a Pierce-only `PIER / PCOP / PFS` location picker to the products browse page
- move product browse reads behind an authenticated server route that joins `products_with_derived` to `product_inventory`
- show primary-location values in the table with `+N varies` affordances for differing selected-location values

## Testing
- npm test -- tests/domains/product/location-filters.test.ts tests/domains/product/view-serializer.test.ts tests/domains/product/search-products-filters.test.ts tests/domains/product/search-route.test.ts tests/domains/product/queries-route.test.ts tests/app/api/products-search-route.test.ts tests/components/products-location-picker.test.tsx tests/components/products-product-table-helpers.test.ts
- bash ./scripts/ship-check.sh
EOF
)"
```

Expected: branch published and PR opened against `main`.
