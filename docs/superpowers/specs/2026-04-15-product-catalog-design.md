# Product Catalog — Design Spec

Date: 2026-04-15

## Overview

A searchable product catalog page for LAPortal that gives any authenticated user fast access to the Pierce College bookstore's 58,529-item inventory. The page supports full-text search-on-type, tabbed views for textbooks vs general merchandise, multi-select with bulk actions (create invoice, create quote, print Code 128 barcodes), and server-side pagination.

The key architectural decision: this feature queries Supabase directly from the browser — no Prisma, no API routes. The `products` table was imported outside of Prisma and is read-only from the app's perspective. Supabase's JS client handles search, filtering, and pagination against Postgres full-text indexes.

## Data Source

### The `products` table (Supabase Postgres)

- **58,529 rows** — not managed by Prisma, queried via Supabase JS client
- **Primary key:** `sku` (integer)
- **No foreign key tables** for `vendor_id`, `color_id`, or `dcc_id` — displayed as raw IDs

| Column | Type | Coverage | Notes |
|---|---|---|---|
| sku | int4 (PK) | 100% | Unique product identifier |
| barcode | text | 80% | UPC/EAN codes |
| item_type | text | 100% | `general_merchandise`, `textbook`, `supplies`, `other` |
| description | text | 77% | Product name/description |
| author | text | 22% | Textbook authors |
| title | text | 22% | Textbook titles |
| isbn | text | 20% | Textbook ISBNs |
| edition | text | 14% | Textbook editions |
| retail_price | numeric | 100% | $0.01–$48,761, avg $43.30 |
| cost | numeric | 100% | $0.00–$48,761, avg $30.16 |
| catalog_number | text | 39% | Vendor catalog numbers |
| image_url | text | <1% | Mostly empty, not displayed |
| vendor_id | int4 | 100% | Vendor reference (ID only) |
| dcc_id | int4 | 100% | Department/class code reference |
| product_type | text | 3% | Packaging/variant info |
| color_id | int4 | 100% | Color reference (many are 0) |
| size | text | 0% | Empty, not displayed |
| created_at | timestamptz | — | Item creation date |
| last_sale_date | timestamptz | 54% | Last sale timestamp |
| synced_at | timestamptz | 100% | Import sync timestamp |

### Existing indexes

1. `products_pkey` — btree on `sku`
2. `idx_products_item_type` — btree on `item_type`
3. `idx_products_barcode` — btree on `barcode`
4. `idx_products_description` — GIN full-text search on `description` using `to_tsvector('english', ...)`

### Item type breakdown

| Type | Count | Tab |
|---|---|---|
| general_merchandise | 32,188 | General Merchandise |
| textbook | 24,754 | Textbooks |
| supplies | 1,581 | General Merchandise |
| other | 6 | General Merchandise |

Supplies and other fold into the General Merchandise tab.

## Architecture

### Browser-direct Supabase queries

```
Browser (React component)
  → useProductSearch() hook
    → Supabase JS client (.from('products').textSearch().filter().range())
      → Postgres (GIN index, btree indexes)
        → typed results back to component
```

No API routes. No Prisma. No domain service layer. The existing Supabase browser client (`src/lib/supabase/browser.ts`) handles authentication via the realtime token bridge. The `accessToken` callback provides a valid JWT for every request.

### Module structure

```
src/domains/product/
├── types.ts          # Product types, filter interfaces, cart item type
├── queries.ts        # Supabase query functions (search, filter, paginate)
├── hooks.ts          # useProductSearch(), useProductCart()
└── constants.ts      # Column configs, filter options, tab definitions, defaults
```

This is intentionally lighter than a full domain module — no `repository.ts`, `service.ts`, or `api-client.ts` since there is no server-side code path for this feature.

### RLS security

- Enable RLS on the `products` table
- Single policy: `SELECT` for any request with a valid JWT (authenticated users only)
- No insert/update/delete policies — read-only from the app
- Future inventory updates happen through Supabase dashboard, SQL scripts, or a future admin upload page

## Page Structure

### URL and navigation

- **Route:** `/products`
- **Nav placement:** between "Requisitions" and "Calendar" in the main nav bar
- **URL params preserve state:**
  - `?tab=textbooks` or `?tab=merchandise` (defaults to `textbooks`)
  - `?q=search+term` for search text
  - `?minPrice=10&maxPrice=50` for price filters
  - `?page=3` for pagination
  - Searches and filters are shareable/bookmarkable

### Layout

Single page with:

1. **Page header** — "Product Catalog" title with item count
2. **Search input** — always visible at the top, shared across tabs
3. **Tab bar** — "Textbooks" and "General Merchandise" with item counts as badges
4. **Filter row** — collapsible, tab-specific filters (same pattern as invoice/quote list pages)
5. **Results table** — tab-specific columns with selection checkboxes
6. **Pagination** — Previous/Next with "showing 1–50 of 24,754"
7. **Sticky action bar** — appears at the bottom when items are selected

## Search

### Behavior

- **Search-on-type** with 300ms debounce using `useDeferredValue`
- Single search input queries all relevant fields simultaneously
- Full-text search via GIN index for text fields (`description`, `title`, `author`)
- Prefix/exact match for identifier fields (`sku`, `barcode`, `isbn`, `catalog_number`)
- No special input parsing — whatever the user types gets matched against all fields

### Filters

Collapsible filter panel below the tab bar, with active-filter count badge on the toggle button.

| Filter | Textbooks | General Merchandise |
|---|---|---|
| Price range (min/max) | ✓ | ✓ |
| Has barcode | ✓ | ✓ |
| Vendor ID | ✓ | ✓ |
| Last sale date range | ✓ | ✓ |
| Author | ✓ | — |
| Has ISBN | ✓ | — |
| Edition | ✓ | — |
| Catalog number | — | ✓ |
| Product type | — | ✓ |

### Pagination

- Server-side pagination, 50 rows per page
- Previous/Next buttons with total count display
- Larger page size than invoices/quotes (20) since this is a lookup tool where users want to scan more results

## Table Columns

### Textbooks tab

| Column | Source field | Notes |
|---|---|---|
| ☐ | — | Selection checkbox |
| SKU | `sku` | Styled as link/accent color |
| Title | `title` | Falls back to `description` if `title` is null |
| Author | `author` | |
| ISBN | `isbn` | Monospace, truncated |
| Edition | `edition` | |
| Barcode | `barcode` | Monospace |
| Retail | `retail_price` | Right-aligned, formatted as currency |
| Cost | `cost` | Right-aligned, muted color |
| Last Sale | `last_sale_date` | Formatted as "Mon YYYY", dash if null |

### General Merchandise tab

| Column | Source field | Notes |
|---|---|---|
| ☐ | — | Selection checkbox |
| SKU | `sku` | Styled as link/accent color |
| Description | `description` | |
| Barcode | `barcode` | Monospace |
| Catalog # | `catalog_number` | Monospace |
| Type | `product_type` | |
| Vendor | `vendor_id` | Displayed as "Vendor #N" |
| Retail | `retail_price` | Right-aligned, formatted as currency |
| Cost | `cost` | Right-aligned, muted color |
| Last Sale | `last_sale_date` | Formatted as "Mon YYYY", dash if null |

### Mobile layout

Card-based layout (same `md:` breakpoint pattern as existing list pages). Each card shows the key fields stacked vertically with the checkbox in the top-right corner.

## Selection and Actions

### Selection behavior

- Checkboxes on each row for multi-select
- "Select all on page" checkbox in the table header
- Selection stored in React state as `Map<number, SelectedProduct>` keyed by SKU
- **Selection persists across tab switches and page changes** — the map is not cleared when switching tabs or paginating
- Selected count displayed in the action bar

### Sticky action bar

Appears at the bottom of the viewport when ≥1 item is selected:

- **Left side:** "N items selected" count + "Clear" link
- **Right side:** three action buttons:
  1. **Create Invoice** — navigates to `/invoices/new` with selected items pre-loaded as line items (description mapped to line item description, retail_price to unit price, SKU to SKU field)
  2. **Create Quote** — navigates to `/quotes/new` with the same pre-loading
  3. **Print Barcodes** — opens the barcode print view

### Data transfer to invoice/quote creation

Selected items are serialized to `sessionStorage` before navigation. The invoice/quote creation forms check for the presence of this data on mount and pre-populate the line items array. Each selected product maps to one line item:

- `description` → line item description (uppercased per existing convention)
- `retail_price` → unit price
- `sku` → SKU field
- `quantity` → defaults to 1

## Barcode Print View

### Layout

Opens in a new browser window via `window.open()` with print-optimized styles.

Each selected item renders as a row:

- **Left side:** full item information in a two-column grid
  - Description (bold, larger font)
  - SKU, barcode, catalog number, vendor
  - Author, edition (if textbook)
  - Retail price, cost
- **Right side:** Code 128 barcode generated from the SKU number

### Technical implementation

- **Library:** JsBarcode (lightweight, renders Code 128 to SVG)
- **Barcode value:** the SKU number (integer, rendered as string)
- **Format:** Code 128 (standard retail barcode format)
- **Styling:** white background, `@media print` styles, no nav/chrome, clean grid layout
- **User prints** via Cmd+P / Ctrl+P from the opened window

## Dependencies

### New npm packages

- `jsbarcode` — Code 128 barcode generation (renders to SVG/canvas)

### Existing dependencies used

- `@supabase/supabase-js` — browser client for direct queries
- `sonner` — toast notifications for errors
- `lucide-react` — icons (Search, Filter, Printer, FileText, etc.)
- `framer-motion` — action bar entrance animation

### No new infrastructure

- No new API routes
- No Prisma schema changes
- No new database tables
- One RLS policy added to the existing `products` table

## Files to create

| File | Purpose |
|---|---|
| `src/domains/product/types.ts` | Product, TextbookProduct, MerchandiseProduct, ProductFilters, SelectedProduct types |
| `src/domains/product/queries.ts` | `searchProducts()`, `countProducts()` — Supabase query functions |
| `src/domains/product/hooks.ts` | `useProductSearch(tab, filters)`, `useProductCart()` |
| `src/domains/product/constants.ts` | Tab definitions, column configs, default filters, page size |
| `src/app/products/page.tsx` | Page component with tabs, search, filters, table, action bar |
| `src/components/products/product-table.tsx` | Table component with tab-specific columns |
| `src/components/products/product-filters.tsx` | Collapsible filter panel |
| `src/components/products/product-action-bar.tsx` | Sticky bottom bar with Create Invoice/Quote/Print actions |
| `src/components/products/barcode-print-view.tsx` | Print-optimized barcode page component |

## Files to modify

| File | Change |
|---|---|
| `src/components/nav.tsx` | Add "Products" link to nav between Requisitions and Calendar |
| `src/middleware.ts` | No change needed — `/products` is a standard authenticated page |

## Testing

### Unit tests

- `tests/domains/product/queries.test.ts` — mock Supabase client, verify query construction for each tab, filter, search term, and pagination
- `tests/domains/product/hooks.test.ts` — verify debounce, selection state, cart persistence across tabs

### Component tests

- `src/__tests__/product-table.test.tsx` — verify correct columns render per tab, checkbox selection, empty state
- `src/__tests__/product-filters.test.tsx` — verify tab-specific filters, active count badge
- `src/__tests__/barcode-print-view.test.tsx` — verify JsBarcode renders for each selected SKU

## Out of scope

- Inventory management (stock levels, reordering)
- Vendor/color/DCC lookup tables — displayed as raw IDs for now
- Admin product editing or CSV upload — future feature
- Real-time updates to the products table — static catalog, synced externally
- Column sorting (clickable headers) — search and filters are the primary navigation. Can be added later.
