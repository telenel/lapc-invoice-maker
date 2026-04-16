# Product Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a searchable product catalog page that queries Supabase directly from the browser, with tabbed views for textbooks vs general merchandise, multi-select, and bulk actions (create invoice, create quote, print Code 128 barcodes).

**Architecture:** Browser-direct Supabase queries — no API routes, no Prisma. The existing Supabase browser client (`src/lib/supabase/browser.ts`) provides authenticated access via JWT. A lightweight domain module (`src/domains/product/`) contains types, query functions, and React hooks. Components follow the existing list page pattern (search input, collapsible filters, paginated table, URL param sync).

**Tech Stack:** Next.js 14 App Router, Supabase JS client, shadcn/ui v4, Tailwind CSS 4, JsBarcode (Code 128), framer-motion

**Spec:** `docs/superpowers/specs/2026-04-15-product-catalog-design.md`

---

## File Map

### New files

| File | Responsibility |
|---|---|
| `src/domains/product/types.ts` | `Product`, `ProductFilters`, `ProductSearchResult`, `SelectedProduct`, `ProductTab` types |
| `src/domains/product/constants.ts` | Tab definitions, page size, default filters, item type mappings |
| `src/domains/product/queries.ts` | `searchProducts()` — builds and executes Supabase queries with full-text search, filters, pagination |
| `src/domains/product/hooks.ts` | `useProductSearch()` — debounced search hook; `useProductSelection()` — multi-select cart state |
| `src/app/products/page.tsx` | Page component — orchestrates search, tabs, filters, table, action bar |
| `src/components/products/product-filters.tsx` | Collapsible filter panel with tab-specific filters |
| `src/components/products/product-table.tsx` | Tab-specific table with checkboxes, pagination, mobile cards |
| `src/components/products/product-action-bar.tsx` | Sticky bottom bar — Create Invoice, Create Quote, Print Barcodes |
| `src/components/products/barcode-print-view.tsx` | Print-optimized barcode page with JsBarcode Code 128 rendering |
| `tests/domains/product/queries.test.ts` | Unit tests for Supabase query construction |

### Modified files

| File | Change |
|---|---|
| `src/components/nav.tsx` | Add "Products" link between Requisitions and Calendar |
| `src/app/invoices/new/page.tsx` | Read `sessionStorage` catalog items on mount, pass as `initial` to `useInvoiceForm` |
| `src/app/quotes/new/page.tsx` | Same — read `sessionStorage` catalog items on mount, pass as `initial` to `useQuoteForm` |

---

## Task 1: Install JsBarcode and enable RLS

**Files:**
- Modify: `package.json`
- Supabase SQL (run via MCP or SQL Editor)

- [ ] **Step 1: Install jsbarcode**

```bash
cd /Users/montalvo/lapc-invoice-maker && npm install jsbarcode
```

- [ ] **Step 2: Enable RLS and add SELECT policy on the products table**

Run via Supabase MCP `execute_sql` or SQL Editor:

```sql
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read products"
  ON products
  FOR SELECT
  TO authenticated
  USING (true);
```

- [ ] **Step 3: Verify RLS is active**

Run via Supabase MCP:

```sql
SELECT relname, relrowsecurity
FROM pg_class
WHERE relname = 'products';
```

Expected: `relrowsecurity = true`

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install jsbarcode for product catalog barcodes"
```

---

## Task 2: Domain module — types and constants

**Files:**
- Create: `src/domains/product/types.ts`
- Create: `src/domains/product/constants.ts`

- [ ] **Step 1: Create `src/domains/product/types.ts`**

```typescript
/** Raw product row from Supabase products table */
export interface Product {
  sku: number;
  barcode: string | null;
  item_type: string;
  description: string | null;
  author: string | null;
  title: string | null;
  isbn: string | null;
  edition: string | null;
  retail_price: number;
  cost: number;
  catalog_number: string | null;
  vendor_id: number;
  dcc_id: number;
  product_type: string | null;
  color_id: number;
  created_at: string | null;
  last_sale_date: string | null;
  synced_at: string;
}

export type ProductTab = "textbooks" | "merchandise";

export interface ProductFilters {
  search: string;
  tab: ProductTab;
  minPrice: string;
  maxPrice: string;
  vendorId: string;
  hasBarcode: boolean;
  lastSaleDateFrom: string;
  lastSaleDateTo: string;
  // Textbook-only
  author: string;
  hasIsbn: boolean;
  edition: string;
  // Merchandise-only
  catalogNumber: string;
  productType: string;
  // Pagination
  page: number;
}

export interface ProductSearchResult {
  products: Product[];
  total: number;
  page: number;
  pageSize: number;
}

/** A product selected for cart actions (invoice/quote creation or barcode printing) */
export interface SelectedProduct {
  sku: number;
  description: string;
  retailPrice: number;
  cost: number;
  barcode: string | null;
  author: string | null;
  title: string | null;
  isbn: string | null;
  edition: string | null;
  catalogNumber: string | null;
  vendorId: number;
  itemType: string;
}
```

- [ ] **Step 2: Create `src/domains/product/constants.ts`**

```typescript
import type { ProductFilters, ProductTab } from "./types";

export const PAGE_SIZE = 50;

export const TABS: { value: ProductTab; label: string }[] = [
  { value: "textbooks", label: "Textbooks" },
  { value: "merchandise", label: "General Merchandise" },
];

/** item_type values that map to each tab */
export const TAB_ITEM_TYPES: Record<ProductTab, string[]> = {
  textbooks: ["textbook"],
  merchandise: ["general_merchandise", "supplies", "other"],
};

export const EMPTY_FILTERS: ProductFilters = {
  search: "",
  tab: "textbooks",
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
  page: 1,
};

/** sessionStorage key for transferring selected products to invoice/quote forms */
export const CATALOG_ITEMS_STORAGE_KEY = "catalog-selected-items";
```

- [ ] **Step 3: Commit**

```bash
git add src/domains/product/types.ts src/domains/product/constants.ts
git commit -m "feat(product): add domain types and constants"
```

---

## Task 3: Domain module — Supabase query functions

**Files:**
- Create: `src/domains/product/queries.ts`
- Create: `tests/domains/product/queries.test.ts`

- [ ] **Step 1: Write the failing test for `searchProducts`**

Create `tests/domains/product/queries.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the Supabase browser client module
const mockRange = vi.fn().mockResolvedValue({ data: [], count: 0, error: null });
const mockOrder = vi.fn().mockReturnValue({ range: mockRange });
const mockLte = vi.fn().mockReturnValue({ order: mockOrder });
const mockGte = vi.fn().mockReturnValue({ lte: mockLte, order: mockOrder });
const mockNot = vi.fn().mockReturnValue({ gte: mockGte, lte: mockLte, order: mockOrder });
const mockIn = vi.fn().mockReturnValue({ not: mockNot, gte: mockGte, lte: mockLte, order: mockOrder });
const mockTextSearch = vi.fn().mockReturnValue({ in: mockIn });
const mockIlike = vi.fn().mockReturnValue({ in: mockIn });
const mockOr = vi.fn().mockReturnValue({ in: mockIn });
const mockSelect = vi.fn().mockReturnValue({
  textSearch: mockTextSearch,
  ilike: mockIlike,
  or: mockOr,
  in: mockIn,
});
const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });
const mockClient = { from: mockFrom };

vi.mock("@/lib/supabase/browser", () => ({
  getSupabaseBrowserClient: vi.fn(() => mockClient),
}));

// Import after mock
const { searchProducts } = await import("@/domains/product/queries");

describe("searchProducts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRange.mockResolvedValue({ data: [], count: 0, error: null });
  });

  it("queries the products table with correct item_type filter for textbooks tab", async () => {
    await searchProducts({
      search: "",
      tab: "textbooks",
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
      page: 1,
    });

    expect(mockFrom).toHaveBeenCalledWith("products");
    expect(mockSelect).toHaveBeenCalledWith("*", { count: "exact" });
    expect(mockIn).toHaveBeenCalledWith("item_type", ["textbook"]);
  });

  it("queries with merchandise item types for merchandise tab", async () => {
    await searchProducts({
      search: "",
      tab: "merchandise",
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
      page: 1,
    });

    expect(mockIn).toHaveBeenCalledWith("item_type", ["general_merchandise", "supplies", "other"]);
  });

  it("returns typed ProductSearchResult on success", async () => {
    const mockProducts = [
      { sku: 100, description: "TEST ITEM", retail_price: 10.00, cost: 5.00, item_type: "textbook" },
    ];
    mockRange.mockResolvedValue({ data: mockProducts, count: 1, error: null });

    const result = await searchProducts({
      search: "",
      tab: "textbooks",
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
      page: 1,
    });

    expect(result).toEqual({
      products: mockProducts,
      total: 1,
      page: 1,
      pageSize: 50,
    });
  });

  it("throws on Supabase error", async () => {
    mockRange.mockResolvedValue({ data: null, count: null, error: { message: "RLS denied" } });

    await expect(
      searchProducts({
        search: "",
        tab: "textbooks",
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
        page: 1,
      })
    ).rejects.toThrow("RLS denied");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/domains/product/queries.test.ts
```

Expected: FAIL — module `@/domains/product/queries` not found

- [ ] **Step 3: Implement `src/domains/product/queries.ts`**

```typescript
"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { PAGE_SIZE, TAB_ITEM_TYPES } from "./constants";
import type { Product, ProductFilters, ProductSearchResult } from "./types";

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
      // Numeric input: match SKU exactly or barcode/isbn/catalog_number as prefix
      query = query.or(
        `sku.eq.${term},barcode.ilike.${term}%,isbn.ilike.${term}%,catalog_number.ilike.${term}%`
      );
    } else {
      // Text input: full-text search on description, ilike on title/author/isbn/catalog_number
      const escaped = term.replace(/'/g, "''");
      const tsquery = term
        .split(/\s+/)
        .filter(Boolean)
        .map((w) => `'${w}'`)
        .join(" & ");
      query = query.or(
        `description.fts.${tsquery},title.ilike.%${escaped}%,author.ilike.%${escaped}%,isbn.ilike.%${escaped}%,barcode.ilike.%${escaped}%,catalog_number.ilike.%${escaped}%`
      );
    }
  }

  // Price range
  if (filters.minPrice) {
    query = query.gte("retail_price", Number(filters.minPrice));
  }
  if (filters.maxPrice) {
    query = query.lte("retail_price", Number(filters.maxPrice));
  }

  // Vendor
  if (filters.vendorId) {
    query = query.eq("vendor_id", Number(filters.vendorId));
  }

  // Has barcode
  if (filters.hasBarcode) {
    query = query.not("barcode", "is", null);
  }

  // Last sale date range
  if (filters.lastSaleDateFrom) {
    query = query.gte("last_sale_date", filters.lastSaleDateFrom);
  }
  if (filters.lastSaleDateTo) {
    query = query.lte("last_sale_date", filters.lastSaleDateTo);
  }

  // Textbook-specific filters
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

  // Merchandise-specific filters
  if (filters.tab === "merchandise") {
    if (filters.catalogNumber) {
      query = query.ilike("catalog_number", `%${filters.catalogNumber}%`);
    }
    if (filters.productType) {
      query = query.ilike("product_type", `%${filters.productType}%`);
    }
  }

  // Ordering and pagination
  query = query.order("sku", { ascending: true }).range(from, to);

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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/domains/product/queries.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/domains/product/queries.ts tests/domains/product/queries.test.ts
git commit -m "feat(product): add Supabase query functions with tests"
```

---

## Task 4: Domain module — React hooks

**Files:**
- Create: `src/domains/product/hooks.ts`

- [ ] **Step 1: Create `src/domains/product/hooks.ts`**

```typescript
"use client";

import { useState, useEffect, useCallback, useDeferredValue } from "react";
import { toast } from "sonner";
import { searchProducts } from "./queries";
import { EMPTY_FILTERS, CATALOG_ITEMS_STORAGE_KEY } from "./constants";
import type {
  Product,
  ProductFilters,
  ProductSearchResult,
  ProductTab,
  SelectedProduct,
} from "./types";

// ---------------------------------------------------------------------------
// useProductSearch — debounced search with Supabase
// ---------------------------------------------------------------------------

export function useProductSearch(filters: ProductFilters) {
  const [data, setData] = useState<ProductSearchResult | null>(null);
  const [loading, setLoading] = useState(true);
  const deferredSearch = useDeferredValue(filters.search);

  const effectiveFilters: ProductFilters = {
    ...filters,
    search: deferredSearch,
  };

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const result = await searchProducts(effectiveFilters);
      setData(result);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to search products";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(effectiveFilters)]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, refetch };
}

// ---------------------------------------------------------------------------
// useProductSelection — multi-select cart persisted across tabs/pages
// ---------------------------------------------------------------------------

function productToSelected(product: Product): SelectedProduct {
  return {
    sku: product.sku,
    description: (product.title ?? product.description ?? "").toUpperCase(),
    retailPrice: Number(product.retail_price),
    cost: Number(product.cost),
    barcode: product.barcode,
    author: product.author,
    title: product.title,
    isbn: product.isbn,
    edition: product.edition,
    catalogNumber: product.catalog_number,
    vendorId: product.vendor_id,
    itemType: product.item_type,
  };
}

export function useProductSelection() {
  const [selected, setSelected] = useState<Map<number, SelectedProduct>>(
    () => new Map()
  );

  const toggle = useCallback((product: Product) => {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(product.sku)) {
        next.delete(product.sku);
      } else {
        next.set(product.sku, productToSelected(product));
      }
      return next;
    });
  }, []);

  const toggleAll = useCallback((products: Product[]) => {
    setSelected((prev) => {
      const next = new Map(prev);
      const allOnPage = products.every((p) => next.has(p.sku));
      if (allOnPage) {
        products.forEach((p) => next.delete(p.sku));
      } else {
        products.forEach((p) => next.set(p.sku, productToSelected(p)));
      }
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setSelected(new Map());
  }, []);

  const isSelected = useCallback(
    (sku: number) => selected.has(sku),
    [selected]
  );

  /** Write selected items to sessionStorage for invoice/quote form pre-population */
  const saveToSession = useCallback(() => {
    const items = Array.from(selected.values());
    sessionStorage.setItem(CATALOG_ITEMS_STORAGE_KEY, JSON.stringify(items));
  }, [selected]);

  return {
    selected,
    selectedCount: selected.size,
    toggle,
    toggleAll,
    clear,
    isSelected,
    saveToSession,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/domains/product/hooks.ts
git commit -m "feat(product): add search and selection hooks"
```

---

## Task 5: Nav link

**Files:**
- Modify: `src/components/nav.tsx`

- [ ] **Step 1: Add Products link to the nav**

In `src/components/nav.tsx`, find the `links` array and add the Products entry between Requisitions and Calendar:

```typescript
const links: NavLink[] = [
  { href: "/", label: "Dashboard" },
  { href: "/invoices", label: "Invoices" },
  { href: "/quotes", label: "Quotes" },
  { href: "/archive", label: "Deleted Archive", matchPrefix: "/archive" },
  { href: "/textbook-requisitions", label: "Requisitions", matchPrefix: "/textbook-requisitions" },
  { href: "/products", label: "Products" },
  { href: "/calendar", label: "Calendar" },
  { href: "/staff", label: "Staff" },
];
```

- [ ] **Step 2: Commit**

```bash
git add src/components/nav.tsx
git commit -m "feat(product): add Products link to nav"
```

---

## Task 6: Product filters component

**Files:**
- Create: `src/components/products/product-filters.tsx`

- [ ] **Step 1: Create `src/components/products/product-filters.tsx`**

```typescript
"use client";

import { useState } from "react";
import { ChevronDownIcon, FilterIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import type { ProductFilters, ProductTab } from "@/domains/product/types";

interface ProductFiltersBarProps {
  filters: ProductFilters;
  onChange: (filters: ProductFilters) => void;
  onClear: () => void;
}

export function ProductFiltersBar({
  filters,
  onChange,
  onClear,
}: ProductFiltersBarProps) {
  const [open, setOpen] = useState(false);

  function set(key: keyof ProductFilters, value: string | boolean) {
    onChange({ ...filters, [key]: value, page: 1 });
  }

  const activeCount = [
    filters.minPrice,
    filters.maxPrice,
    filters.vendorId,
    filters.hasBarcode,
    filters.lastSaleDateFrom,
    filters.lastSaleDateTo,
    filters.tab === "textbooks" && filters.author,
    filters.tab === "textbooks" && filters.hasIsbn,
    filters.tab === "textbooks" && filters.edition,
    filters.tab === "merchandise" && filters.catalogNumber,
    filters.tab === "merchandise" && filters.productType,
  ].filter(Boolean).length;

  return (
    <div className="space-y-3">
      {/* Search row — always visible */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="grid gap-1.5 flex-1">
          <Label htmlFor="product-search" className="sr-only">Search</Label>
          <Input
            id="product-search"
            name="search"
            placeholder={
              filters.tab === "textbooks"
                ? "Search textbooks by title, author, ISBN, SKU..."
                : "Search merchandise by description, barcode, catalog #, SKU..."
            }
            value={filters.search}
            onChange={(e) => set("search", e.target.value)}
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setOpen((o) => !o)}
          className="w-full shrink-0 gap-1.5 sm:w-auto"
        >
          <FilterIcon className="size-3.5" />
          Filters
          {activeCount > 0 && (
            <Badge
              variant="secondary"
              className="ml-0.5 px-1.5 py-0 text-[10px] font-bold rounded-full"
            >
              {activeCount}
            </Badge>
          )}
          <ChevronDownIcon
            className={`size-3.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          />
        </Button>
      </div>

      {/* Collapsible filter panel */}
      {open && (
        <div className="space-y-3 rounded-xl border border-border/50 bg-card p-4 shadow-sm animate-in fade-in-0 slide-in-from-top-1 duration-200">
          {/* Shared filters */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="grid gap-1.5">
              <Label htmlFor="pf-min-price">Min Price</Label>
              <Input
                id="pf-min-price"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={filters.minPrice}
                onChange={(e) => set("minPrice", e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="pf-max-price">Max Price</Label>
              <Input
                id="pf-max-price"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={filters.maxPrice}
                onChange={(e) => set("maxPrice", e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="pf-vendor">Vendor ID</Label>
              <Input
                id="pf-vendor"
                type="number"
                placeholder="e.g. 21"
                value={filters.vendorId}
                onChange={(e) => set("vendorId", e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>&nbsp;</Label>
              <Button
                variant={filters.hasBarcode ? "default" : "outline"}
                size="sm"
                className="h-9 w-full"
                onClick={() => set("hasBarcode", !filters.hasBarcode)}
              >
                Has Barcode
              </Button>
            </div>
          </div>

          {/* Date range */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="grid gap-1.5">
              <Label htmlFor="pf-sale-from">Last Sale From</Label>
              <Input
                id="pf-sale-from"
                type="date"
                value={filters.lastSaleDateFrom}
                onChange={(e) => set("lastSaleDateFrom", e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="pf-sale-to">Last Sale To</Label>
              <Input
                id="pf-sale-to"
                type="date"
                value={filters.lastSaleDateTo}
                onChange={(e) => set("lastSaleDateTo", e.target.value)}
              />
            </div>

            {/* Textbook-only filters */}
            {filters.tab === "textbooks" && (
              <>
                <div className="grid gap-1.5">
                  <Label htmlFor="pf-author">Author</Label>
                  <Input
                    id="pf-author"
                    placeholder="e.g. HUXLEY"
                    value={filters.author}
                    onChange={(e) => set("author", e.target.value)}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="pf-edition">Edition</Label>
                  <Input
                    id="pf-edition"
                    placeholder="e.g. 7"
                    value={filters.edition}
                    onChange={(e) => set("edition", e.target.value)}
                  />
                </div>
              </>
            )}

            {/* Merchandise-only filters */}
            {filters.tab === "merchandise" && (
              <>
                <div className="grid gap-1.5">
                  <Label htmlFor="pf-catalog">Catalog #</Label>
                  <Input
                    id="pf-catalog"
                    placeholder="e.g. 37655"
                    value={filters.catalogNumber}
                    onChange={(e) => set("catalogNumber", e.target.value)}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="pf-type">Product Type</Label>
                  <Input
                    id="pf-type"
                    placeholder="e.g. CAPPED"
                    value={filters.productType}
                    onChange={(e) => set("productType", e.target.value)}
                  />
                </div>
              </>
            )}

            {/* Has ISBN toggle — textbook only */}
            {filters.tab === "textbooks" && (
              <div className="grid gap-1.5">
                <Label>&nbsp;</Label>
                <Button
                  variant={filters.hasIsbn ? "default" : "outline"}
                  size="sm"
                  className="h-9 w-full"
                  onClick={() => set("hasIsbn", !filters.hasIsbn)}
                >
                  Has ISBN
                </Button>
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={onClear}>
              Clear Filters
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/products/product-filters.tsx
git commit -m "feat(product): add collapsible filter panel"
```

---

## Task 7: Product table component

**Files:**
- Create: `src/components/products/product-table.tsx`

- [ ] **Step 1: Create `src/components/products/product-table.tsx`**

```typescript
"use client";

import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SearchIcon } from "lucide-react";
import type { Product, ProductTab } from "@/domains/product/types";
import { PAGE_SIZE } from "@/domains/product/constants";

interface ProductTableProps {
  tab: ProductTab;
  products: Product[];
  total: number;
  page: number;
  loading: boolean;
  isSelected: (sku: number) => boolean;
  onToggle: (product: Product) => void;
  onToggleAll: (products: Product[]) => void;
  onPageChange: (page: number) => void;
}

function formatCurrency(value: number): string {
  return `$${Number(value).toFixed(2)}`;
}

function formatSaleDate(date: string | null): string {
  if (!date) return "—";
  const d = new Date(date);
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export function ProductTable({
  tab,
  products,
  total,
  page,
  loading,
  isSelected,
  onToggle,
  onToggleAll,
  onPageChange,
}: ProductTableProps) {
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);
  const allOnPageSelected = products.length > 0 && products.every((p) => isSelected(p.sku));

  if (!loading && products.length === 0) {
    return (
      <EmptyState
        icon={SearchIcon}
        title="No products found"
        description="Try adjusting your search or filters"
      />
    );
  }

  return (
    <div>
      {/* Desktop table */}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={allOnPageSelected}
                  onCheckedChange={() => onToggleAll(products)}
                  aria-label="Select all on page"
                />
              </TableHead>
              <TableHead>SKU</TableHead>
              {tab === "textbooks" ? (
                <>
                  <TableHead>Title</TableHead>
                  <TableHead>Author</TableHead>
                  <TableHead>ISBN</TableHead>
                  <TableHead>Edition</TableHead>
                  <TableHead>Barcode</TableHead>
                </>
              ) : (
                <>
                  <TableHead>Description</TableHead>
                  <TableHead>Barcode</TableHead>
                  <TableHead>Catalog #</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Vendor</TableHead>
                </>
              )}
              <TableHead className="text-right">Retail</TableHead>
              <TableHead className="text-right">Cost</TableHead>
              <TableHead>Last Sale</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading
              ? Array.from({ length: 10 }).map((_, i) => (
                  <TableRow key={`skeleton-${i}`}>
                    {Array.from({ length: tab === "textbooks" ? 10 : 10 }).map((_, j) => (
                      <TableCell key={j}>
                        <div className="h-4 w-full animate-pulse rounded bg-muted" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              : products.map((product) => (
                  <TableRow
                    key={product.sku}
                    className={isSelected(product.sku) ? "bg-primary/5" : ""}
                  >
                    <TableCell>
                      <Checkbox
                        checked={isSelected(product.sku)}
                        onCheckedChange={() => onToggle(product)}
                        aria-label={`Select SKU ${product.sku}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium text-primary">
                      {product.sku}
                    </TableCell>
                    {tab === "textbooks" ? (
                      <>
                        <TableCell className="font-medium max-w-[300px] truncate">
                          {product.title ?? product.description ?? "—"}
                        </TableCell>
                        <TableCell>{product.author ?? "—"}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {product.isbn ?? "—"}
                        </TableCell>
                        <TableCell>{product.edition ?? "—"}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {product.barcode ?? "—"}
                        </TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell className="font-medium max-w-[300px] truncate">
                          {product.description ?? "—"}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {product.barcode ?? "—"}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {product.catalog_number ?? "—"}
                        </TableCell>
                        <TableCell className="text-xs">
                          {product.product_type ?? "—"}
                        </TableCell>
                        <TableCell className="text-xs">
                          Vendor #{product.vendor_id}
                        </TableCell>
                      </>
                    )}
                    <TableCell className="text-right font-medium">
                      {formatCurrency(product.retail_price)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatCurrency(product.cost)}
                    </TableCell>
                    <TableCell className="text-xs">
                      {formatSaleDate(product.last_sale_date)}
                    </TableCell>
                  </TableRow>
                ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile cards */}
      <div className="space-y-2 md:hidden">
        {loading
          ? Array.from({ length: 5 }).map((_, i) => (
              <div key={`mobile-skeleton-${i}`} className="rounded-lg border p-3">
                <div className="h-4 w-3/4 animate-pulse rounded bg-muted mb-2" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
              </div>
            ))
          : products.map((product) => (
              <div
                key={product.sku}
                className={`rounded-lg border p-3 ${isSelected(product.sku) ? "border-primary bg-primary/5" : ""}`}
                onClick={() => onToggle(product)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {product.title ?? product.description ?? "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      SKU: {product.sku}
                      {product.author && ` · ${product.author}`}
                    </p>
                  </div>
                  <Checkbox
                    checked={isSelected(product.sku)}
                    onCheckedChange={() => onToggle(product)}
                    className="ml-2 mt-0.5"
                    aria-label={`Select SKU ${product.sku}`}
                  />
                </div>
                <div className="mt-1.5 flex gap-3 text-xs">
                  <span className="font-medium">{formatCurrency(product.retail_price)}</span>
                  <span className="text-muted-foreground">{formatCurrency(product.cost)}</span>
                  {product.barcode && (
                    <span className="font-mono text-muted-foreground">{product.barcode}</span>
                  )}
                </div>
              </div>
            ))}
      </div>

      {/* Pagination */}
      {total > 0 && (
        <div className="flex items-center justify-between border-t pt-4 mt-4">
          <p className="text-sm text-muted-foreground">
            Showing {from}–{to} of {total.toLocaleString()}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/products/product-table.tsx
git commit -m "feat(product): add product table with tab-specific columns"
```

---

## Task 8: Action bar and barcode print view

**Files:**
- Create: `src/components/products/product-action-bar.tsx`
- Create: `src/components/products/barcode-print-view.tsx`

- [ ] **Step 1: Create `src/components/products/product-action-bar.tsx`**

```typescript
"use client";

import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { FileTextIcon, PrinterIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SelectedProduct } from "@/domains/product/types";
import { CATALOG_ITEMS_STORAGE_KEY } from "@/domains/product/constants";
import { openBarcodePrintWindow } from "./barcode-print-view";

interface ProductActionBarProps {
  selected: Map<number, SelectedProduct>;
  selectedCount: number;
  onClear: () => void;
  saveToSession: () => void;
}

export function ProductActionBar({
  selected,
  selectedCount,
  onClear,
  saveToSession,
}: ProductActionBarProps) {
  const router = useRouter();

  function handleCreateInvoice() {
    saveToSession();
    router.push("/invoices/new?from=catalog");
  }

  function handleCreateQuote() {
    saveToSession();
    router.push("/quotes/new?from=catalog");
  }

  function handlePrintBarcodes() {
    const items = Array.from(selected.values());
    openBarcodePrintWindow(items);
  }

  return (
    <AnimatePresence>
      {selectedCount > 0 && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
        >
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">
                {selectedCount} item{selectedCount !== 1 ? "s" : ""} selected
              </span>
              <button
                onClick={onClear}
                className="text-xs text-muted-foreground hover:text-foreground underline"
              >
                Clear
              </button>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={handlePrintBarcodes}>
                <PrinterIcon className="mr-1.5 size-3.5" />
                Print Barcodes
              </Button>
              <Button size="sm" variant="outline" onClick={handleCreateQuote}>
                <FileTextIcon className="mr-1.5 size-3.5" />
                Create Quote
              </Button>
              <Button size="sm" onClick={handleCreateInvoice}>
                <FileTextIcon className="mr-1.5 size-3.5" />
                Create Invoice
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

- [ ] **Step 2: Create `src/components/products/barcode-print-view.tsx`**

```typescript
import type { SelectedProduct } from "@/domains/product/types";

/**
 * Opens a new browser window with a print-optimized barcode sheet.
 * Each selected item displays full product info + a Code 128 barcode of the SKU.
 * JsBarcode renders into SVG elements after the window loads.
 */
export function openBarcodePrintWindow(items: SelectedProduct[]): void {
  const win = window.open("", "_blank", "width=800,height=600");
  if (!win) return;

  const rows = items
    .map(
      (item) => `
    <div class="row">
      <div class="info">
        <div class="desc">${escapeHtml(item.description)}</div>
        <div class="details">
          <span>SKU: ${item.sku}</span>
          ${item.barcode ? `<span>Barcode: ${escapeHtml(item.barcode)}</span>` : ""}
          ${item.catalogNumber ? `<span>Catalog: ${escapeHtml(item.catalogNumber)}</span>` : ""}
          <span>Vendor: #${item.vendorId}</span>
          ${item.author ? `<span>Author: ${escapeHtml(item.author)}</span>` : ""}
          ${item.edition ? `<span>Edition: ${escapeHtml(item.edition)}</span>` : ""}
          <span>Retail: $${item.retailPrice.toFixed(2)}</span>
          <span>Cost: $${item.cost.toFixed(2)}</span>
        </div>
      </div>
      <div class="barcode-cell">
        <svg class="barcode" data-sku="${item.sku}"></svg>
      </div>
    </div>
  `
    )
    .join("");

  win.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>Product Barcodes</title>
  <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3/dist/JsBarcode.all.min.js"><\/script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; padding: 20px; }
    h1 { font-size: 18px; margin-bottom: 16px; }
    .row {
      display: flex;
      align-items: center;
      gap: 20px;
      padding: 12px 0;
      border-bottom: 1px solid #ddd;
    }
    .info { flex: 1; }
    .desc { font-weight: 700; font-size: 14px; margin-bottom: 4px; }
    .details {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 2px;
      font-size: 11px;
      color: #555;
    }
    .barcode-cell { flex-shrink: 0; text-align: center; }
    @media print {
      body { padding: 10px; }
      .row { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <h1>Product Barcodes — ${items.length} item${items.length !== 1 ? "s" : ""}</h1>
  ${rows}
  <script>
    document.querySelectorAll('.barcode').forEach(function(svg) {
      JsBarcode(svg, String(svg.dataset.sku), {
        format: 'CODE128',
        width: 1.5,
        height: 50,
        displayValue: true,
        fontSize: 12,
        margin: 5,
      });
    });
  <\/script>
</body>
</html>`);

  win.document.close();
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/products/product-action-bar.tsx src/components/products/barcode-print-view.tsx
git commit -m "feat(product): add action bar and barcode print view"
```

---

## Task 9: Products page

**Files:**
- Create: `src/app/products/page.tsx`

- [ ] **Step 1: Create `src/app/products/page.tsx`**

```typescript
"use client";

import { useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { useProductSearch, useProductSelection } from "@/domains/product/hooks";
import { EMPTY_FILTERS, TABS, TAB_ITEM_TYPES } from "@/domains/product/constants";
import type { ProductFilters, ProductTab } from "@/domains/product/types";
import { ProductFiltersBar } from "@/components/products/product-filters";
import { ProductTable } from "@/components/products/product-table";
import { ProductActionBar } from "@/components/products/product-action-bar";

function parseFiltersFromParams(
  searchParams: ReturnType<typeof useSearchParams>
): ProductFilters {
  return {
    ...EMPTY_FILTERS,
    tab: (searchParams.get("tab") as ProductTab) || "textbooks",
    search: searchParams.get("q") ?? "",
    minPrice: searchParams.get("minPrice") ?? "",
    maxPrice: searchParams.get("maxPrice") ?? "",
    vendorId: searchParams.get("vendorId") ?? "",
    hasBarcode: searchParams.get("hasBarcode") === "true",
    lastSaleDateFrom: searchParams.get("lastSaleDateFrom") ?? "",
    lastSaleDateTo: searchParams.get("lastSaleDateTo") ?? "",
    author: searchParams.get("author") ?? "",
    hasIsbn: searchParams.get("hasIsbn") === "true",
    edition: searchParams.get("edition") ?? "",
    catalogNumber: searchParams.get("catalogNumber") ?? "",
    productType: searchParams.get("productType") ?? "",
    page: Number(searchParams.get("page") ?? "1") || 1,
  };
}

function filtersToParams(filters: ProductFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.tab !== "textbooks") params.set("tab", filters.tab);
  if (filters.search) params.set("q", filters.search);
  if (filters.minPrice) params.set("minPrice", filters.minPrice);
  if (filters.maxPrice) params.set("maxPrice", filters.maxPrice);
  if (filters.vendorId) params.set("vendorId", filters.vendorId);
  if (filters.hasBarcode) params.set("hasBarcode", "true");
  if (filters.lastSaleDateFrom) params.set("lastSaleDateFrom", filters.lastSaleDateFrom);
  if (filters.lastSaleDateTo) params.set("lastSaleDateTo", filters.lastSaleDateTo);
  if (filters.author) params.set("author", filters.author);
  if (filters.hasIsbn) params.set("hasIsbn", "true");
  if (filters.edition) params.set("edition", filters.edition);
  if (filters.catalogNumber) params.set("catalogNumber", filters.catalogNumber);
  if (filters.productType) params.set("productType", filters.productType);
  if (filters.page > 1) params.set("page", String(filters.page));
  return params;
}

export default function ProductsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<ProductFilters>(() =>
    parseFiltersFromParams(searchParams)
  );

  const { data, loading } = useProductSearch(filters);
  const {
    selected,
    selectedCount,
    toggle,
    toggleAll,
    clear,
    isSelected,
    saveToSession,
  } = useProductSelection();

  const updateFilters = useCallback(
    (next: ProductFilters) => {
      setFilters(next);
      const params = filtersToParams(next);
      const qs = params.toString();
      router.replace(qs ? `/products?${qs}` : "/products", { scroll: false });
    },
    [router]
  );

  function handleTabChange(tab: ProductTab) {
    updateFilters({ ...filters, tab, page: 1 });
  }

  function handlePageChange(page: number) {
    updateFilters({ ...filters, page });
  }

  function handleClearFilters() {
    updateFilters({ ...EMPTY_FILTERS, tab: filters.tab });
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      {/* Header */}
      <div className="page-enter page-enter-1 mb-5">
        <h1 className="text-3xl font-bold tracking-tight">Product Catalog</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Search the Pierce College bookstore inventory
          {data ? ` · ${data.total.toLocaleString()} results` : ""}
        </p>
      </div>

      {/* Search + Filters */}
      <div className="page-enter page-enter-2 mb-4">
        <ProductFiltersBar
          filters={filters}
          onChange={updateFilters}
          onClear={handleClearFilters}
        />
      </div>

      {/* Tabs */}
      <div className="page-enter page-enter-3 mb-4 flex gap-0 border-b">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => handleTabChange(tab.value)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              filters.tab === tab.value
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
            {data && filters.tab === tab.value && (
              <Badge
                variant="secondary"
                className="ml-2 px-1.5 py-0 text-[10px] font-bold rounded-full"
              >
                {data.total.toLocaleString()}
              </Badge>
            )}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="page-enter page-enter-4">
        <ProductTable
          tab={filters.tab}
          products={data?.products ?? []}
          total={data?.total ?? 0}
          page={filters.page}
          loading={loading}
          isSelected={isSelected}
          onToggle={toggle}
          onToggleAll={toggleAll}
          onPageChange={handlePageChange}
        />
      </div>

      {/* Action bar */}
      <ProductActionBar
        selected={selected}
        selectedCount={selectedCount}
        onClear={clear}
        saveToSession={saveToSession}
      />

      {/* Spacer so content isn't hidden behind the sticky action bar */}
      {selectedCount > 0 && <div className="h-16" />}
    </div>
  );
}
```

- [ ] **Step 2: Verify the dev server loads the page**

```bash
# With the dev server running, navigate to http://localhost:3000/products
# Expected: page loads with search input, tabs, and table (may show empty or error if RLS not applied yet)
```

- [ ] **Step 3: Commit**

```bash
git add src/app/products/page.tsx
git commit -m "feat(product): add products page with search, tabs, filters, and selection"
```

---

## Task 10: Pre-populate invoice/quote forms from catalog selection

**Files:**
- Modify: `src/app/invoices/new/page.tsx`
- Modify: `src/app/quotes/new/page.tsx`

- [ ] **Step 1: Update `src/app/invoices/new/page.tsx` to read catalog items from sessionStorage**

Replace the file content with:

```typescript
"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useInvoiceForm } from "@/components/invoice/invoice-form";
import { KeyboardMode } from "@/components/invoice/keyboard-mode";
import { CATALOG_ITEMS_STORAGE_KEY } from "@/domains/product/constants";
import type { SelectedProduct } from "@/domains/product/types";

function readCatalogItems(): { description: string; quantity: number; unitPrice: number }[] | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = sessionStorage.getItem(CATALOG_ITEMS_STORAGE_KEY);
    if (!raw) return undefined;
    sessionStorage.removeItem(CATALOG_ITEMS_STORAGE_KEY);
    const items = JSON.parse(raw) as SelectedProduct[];
    return items.map((item, i) => ({
      description: item.description.toUpperCase(),
      quantity: 1,
      unitPrice: item.retailPrice,
    }));
  } catch {
    return undefined;
  }
}

export default function NewInvoicePage() {
  const searchParams = useSearchParams();
  const fromCatalog = searchParams.get("from") === "catalog";

  const initial = useMemo(() => {
    if (!fromCatalog) return undefined;
    const catalogItems = readCatalogItems();
    if (!catalogItems || catalogItems.length === 0) return undefined;
    return {
      items: catalogItems.map((item, i) => ({
        _key: `catalog-${i}`,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        extendedPrice: item.quantity * item.unitPrice,
        sortOrder: i,
        isTaxable: true,
        marginOverride: null,
        costPrice: null,
      })),
    };
  }, [fromCatalog]);

  const invoiceForm = useInvoiceForm(initial);

  return (
    <div className="mx-auto max-w-5xl px-0 py-4 sm:px-4 sm:py-8">
      <div className="page-enter page-enter-1 mb-5 sm:mb-7">
        <h1 className="text-3xl font-bold tracking-tight">New Invoice</h1>
        <p className="mt-1 text-sm text-muted-foreground">Fill in the details below to create an invoice</p>
      </div>
      <div className="page-enter page-enter-2">
        <KeyboardMode {...invoiceForm} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update `src/app/quotes/new/page.tsx` with the same pattern**

Read the current file first, then add the same `readCatalogItems()` and `useMemo` pattern. The quote form uses `useQuoteForm(initial)` from `@/components/quote/quote-form`. Apply the same pattern:

```typescript
"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { CATALOG_ITEMS_STORAGE_KEY } from "@/domains/product/constants";
import type { SelectedProduct } from "@/domains/product/types";
```

Add the same `readCatalogItems()` function. In the component, check `searchParams.get("from") === "catalog"`, read items, and pass them as `initial` to `useQuoteForm`. The quote line item shape matches the invoice pattern (description, quantity, unitPrice, isTaxable, etc.).

- [ ] **Step 3: Commit**

```bash
git add src/app/invoices/new/page.tsx src/app/quotes/new/page.tsx
git commit -m "feat(product): pre-populate invoice/quote forms from catalog selection"
```

---

## Task 11: End-to-end verification

- [ ] **Step 1: Start the dev server and navigate to `/products`**

```bash
npm run dev
```

Open `http://localhost:3000/products`. Verify:
- Page loads with "Product Catalog" heading
- Textbooks tab is active by default
- Search input works — type a term and results update after debounce
- Switch to General Merchandise tab — columns change, results update
- Filters panel opens/closes, active count badge updates
- Pagination works — Previous/Next buttons, total count displays

- [ ] **Step 2: Test selection and actions**

- Check a few items via checkboxes
- Verify the sticky action bar appears with correct count
- Switch tabs — selected items persist
- Click "Print Barcodes" — new window opens with Code 128 barcodes
- Click "Create Invoice" — navigates to `/invoices/new` with items pre-filled
- Go back, re-select, click "Create Quote" — same pre-population

- [ ] **Step 3: Test mobile layout**

Use browser DevTools to resize to mobile width. Verify card-based layout renders with checkboxes.

- [ ] **Step 4: Run ship-check**

```bash
npm run ship-check
```

Expected: passes lint, type check, and tests.

- [ ] **Step 5: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix(product): address issues found during verification"
```

---

## Summary

| Task | What it delivers |
|---|---|
| 1 | JsBarcode installed, RLS enabled on products table |
| 2 | Domain types and constants |
| 3 | Supabase query functions with tests |
| 4 | React hooks for search and selection |
| 5 | Nav link |
| 6 | Collapsible filter panel |
| 7 | Product table with tab-specific columns |
| 8 | Action bar + barcode print view |
| 9 | Products page orchestration |
| 10 | Invoice/quote form pre-population from catalog |
| 11 | End-to-end verification |
