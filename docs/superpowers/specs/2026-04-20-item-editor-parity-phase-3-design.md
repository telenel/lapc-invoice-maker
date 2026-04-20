# Item Editor Parity — Phase 3 Design Spec

**Date:** 2026-04-20
**Branch (planned):** `feat/item-editor-parity-phase-3`
**Status:** Drafted for review
**Parent spec:** `docs/superpowers/specs/2026-04-19-item-editor-parity-design.md`
**Prerequisite:** Phase 2 merged to `main` as PR #217 on April 20, 2026

---

## Goal

Ship the first real multi-location browse experience for the products page without changing any write behavior yet.

Phase 3 adds:
- a top-of-page location picker for `PIER`, `PCOP`, and `PFS`
- URL and saved-view persistence for the selected locations
- a multi-location read surface that shows one row per SKU when it exists in any selected location
- location-aware retail, cost, stock, and last-sale presentation in the products table

Phase 3 explicitly does **not** add:
- multi-location edit behavior
- inventory write-path changes
- per-location edit payloads
- any PBO data

This phase is read-only by design. It validates that the Phase 1 schema split and Phase 2 ref work support real multi-location catalog browsing before we expand the editor.

---

## Why This Phase Exists

The sync now mirrors `PIER`, `PCOP`, and `PFS` into `product_inventory`, but the products page still reads the old flat `products` columns for retail, cost, stock, and last-sale behavior. That means the current UI is still effectively Pierce-only even though the underlying data model is now multi-location capable.

Phase 3 is the clean seam where that changes:
- browsing becomes location-aware
- table values become explainable per selected location
- saved views can carry location scope
- the editor stays untouched so any regressions are isolated to the read surface

This sequencing is safer than combining browse-state changes with write-path changes in the same PR.

---

## Hard Rules

These remain non-negotiable throughout Phase 3:

1. `PBO` (`LocationID = 5`) stays strictly excluded.
2. Multi-location scope is only `PIER (2)`, `PCOP (3)`, and `PFS (4)`.
3. The read surface must prefer labels over IDs wherever labels already exist.
4. The editor remains effectively PIER-only in this phase; no write semantics change.
5. The UI should optimize for the common case first: all three locations selected, PIER leading display values by default.

---

## Current Code Reality

Phase 3 is constrained by the current implementation shape:

- `src/domains/product/queries.ts` browser-queries either `products` or `products_with_derived`.
- `products_with_derived` is still a view over `products`, not over `product_inventory`.
- Location-aware values like `retail_price`, `cost`, and `stock_on_hand` still come from the flat columns on `products`, which currently mirror PIER.
- The page already has strong URL-state and saved-view plumbing via `ProductFilters`, `view-serializer.ts`, `SavedViewsBar`, and `SaveViewDialog`.

Because of that, a client-only overlay would be misleading: filters, counts, sorting, and pagination would remain PIER-based under the hood even if the rendered values changed visually. Phase 3 therefore needs a dedicated location-aware read path rather than a thin UI patch.

---

## Recommended Approach

Use a dedicated read-only products search route for the products page, with selected-location semantics implemented server-side.

This is better than:
- bolting `product_inventory` embeds directly onto the existing browser-side Supabase query flow, which would get awkward once the page flips between `products` and `products_with_derived`
- overlaying location-specific values client-side after an initial PIER-shaped query, which would produce wrong counts, paging, and sort behavior

The route gives one place to define:
- what makes a SKU visible
- how location-sensitive filters work
- how the primary display location is chosen
- how `varies` metadata is computed
- how counts stay correct

---

## Scope

### In scope

- Add location selection to `ProductFilters`
- Persist location selection in the URL and saved views
- Add a compact location picker above the filters area
- Replace the current products-page read path with a location-aware server route
- Return one row per SKU plus per-location read metadata for the selected locations
- Use the primary selected location for location-sensitive display and sort behavior
- Show a `+N varies` indicator when values differ across selected locations
- Keep all existing search/filter affordances working with the new location scope

### Out of scope

- New editor tabs
- Inventory sub-switcher inside the edit dialog
- multi-location bulk edit
- multi-location create behavior
- any mutation to Prism write paths
- any PBO reads

---

## Data Model For Phase 3 Reads

Phase 3 should introduce a location-aware response contract for the products page rather than forcing the page to derive it from the raw `products` and `product_inventory` tables on the client.

### Route-level row shape

Each returned row should still represent one SKU, but now include:
- the existing global catalog fields from `products`
- one `primaryInventory` object for the first selected location
- one `selectedInventories` array for the chosen locations
- one `variance` object that precomputes whether location-sensitive fields disagree

Proposed shape:

```ts
interface ProductLocationSlice {
  locationId: 2 | 3 | 4;
  locationAbbrev: "PIER" | "PCOP" | "PFS";
  retailPrice: number | null;
  cost: number | null;
  stockOnHand: number | null;
  lastSaleDate: string | null;
}

interface ProductLocationVariance {
  retailPriceVaries: boolean;
  costVaries: boolean;
  stockVaries: boolean;
  lastSaleDateVaries: boolean;
}

interface ProductBrowseRow {
  sku: number;
  itemType: string;
  description: string | null;
  title: string | null;
  author: string | null;
  barcode: string | null;
  isbn: string | null;
  vendorId: number;
  vendorLabel: string | null;
  dccId: number;
  deptName: string | null;
  className: string | null;
  unitsSold30d: number;
  revenue30d: number;
  txns1y: number;
  updatedAt: string;
  discontinued: boolean | null;

  primaryInventory: ProductLocationSlice | null;
  selectedInventories: ProductLocationSlice[];
  variance: ProductLocationVariance;
}
```

This keeps the table simple:
- global columns stay global
- location-sensitive columns read from `primaryInventory`
- the popover can render from `selectedInventories`
- the badge uses `variance`

---

## Primary Location Semantics

The primary location is the first selected location in a fixed canonical order:

1. `PIER`
2. `PCOP`
3. `PFS`

Examples:
- `loc=2,3,4` → primary location is `PIER`
- `loc=3,4` → primary location is `PCOP`
- `loc=4` → primary location is `PFS`

Why this rule:
- it is deterministic
- it matches the existing expectation that Pierce leads the default display
- it makes sort behavior explainable
- it avoids introducing a separate “primary location” control in Phase 3

Phase 3 should normalize location state to canonical order rather than treating URL order as meaningful.

---

## Visibility Rule

A SKU is visible if it has at least one `product_inventory` row in any selected location.

Examples:
- if `loc=2,3,4`, any SKU stocked in at least one of those three appears
- if `loc=3`, only SKUs with a `product_inventory` row for `PCOP` appear
- if `loc=3,4`, a SKU stocked only at `PIER` does not appear

This is the key rule that makes the location picker meaningful. It cannot be faked on the client after a Pierce-only query.

---

## URL And Saved View Model

Phase 3 extends the existing filter model.

### `ProductFilters`

Add:

```ts
locationIds: Array<2 | 3 | 4>;
```

Default:

```ts
locationIds: [2, 3, 4]
```

### URL encoding

Use:

```txt
loc=2,3,4
```

Rules:
- omit `loc` only when the filter is at the default all-three selection, if that matches the current serializer pattern
- normalize parsed values into canonical order `2,3,4`
- reject invalid values by falling back to the default safe set `[2,3,4]`
- never allow an empty location selection; if parsing yields none, restore the default safe set

### Saved views

Saved views should store `locationIds` inside the serialized filter payload exactly like other filters.

That means:
- a user can save `PCOP only`
- presets can later opt into location-specific defaults if desired
- shared links and saved views behave consistently

No separate saved-view schema field is needed.

---

## UI Design

### 1. Location picker placement

Place the location picker in the products-page header area above the main filters bar, close to the existing inventory framing and sync affordances.

Recommended structure:
- title row stays as-is
- below it, add a compact segmented multi-toggle control:
  - `PIER`
  - `PCOP`
  - `PFS`
- include a small muted caption such as `Locations`

Behavior:
- all three selected by default
- clicking a selected location toggles it off unless it is the last selected location
- visual order stays fixed as `PIER`, `PCOP`, `PFS`
- selected state is normalized to that same order

That yields a stable primary-location rule without introducing reorder UI.

### 2. Table display behavior

Location-sensitive columns:
- Retail
- Cost
- Stock
- Last sale

These columns display the primary location’s value.

When multiple selected locations disagree on a value:
- show the primary value as normal
- add a subtle `+N varies` badge in the same cell
- clicking or hovering opens a small popover listing `PIER`, `PCOP`, and `PFS` values for the currently selected locations only

Example retail cell:

```txt
$24.99  +2 varies
```

Popover:

```txt
PIER  $24.99
PCOP  $26.99
PFS   $24.99
```

If only one location is selected, no variance badge appears.

### 3. Empty state language

If a location-scoped search returns no rows, the empty state should mention location scope.

Example:

`No products found for the selected locations and filters.`

This prevents the user from thinking the catalog is globally empty.

---

## Search, Filter, Sort, And Pagination Semantics

### Search and global filters

Global fields continue filtering against `products`, for example:
- search text
- vendor
- DCC
- barcode presence
- ISBN presence
- item type
- analytics windows

### Location-sensitive filters

Location-sensitive filters should apply against the primary selected location:
- `minPrice` / `maxPrice`
- `minStock` / `maxStock`
- `lastSaleDateFrom` / `lastSaleDateTo`
- `lastSaleWithin`
- `lastSaleOlderThan`
- `lastSaleNever`

This matches the displayed table values and keeps the page explainable.

### Sorting

Location-sensitive sorts should also use the primary selected location:
- `retail_price`
- `cost`
- `stock_on_hand`
- `last_sale_date`
- `days_since_sale`

Global sorts remain global:
- `sku`
- `description`
- `vendor_id`
- analytics fields
- `updated_at`

### Pagination and counts

Counts and pagination must be computed after location visibility is applied.

That means:
- the total count is the number of SKUs visible in the selected locations after all filters
- the current page should never page over duplicate `(sku, location)` rows
- all grouping to one row per SKU must happen before pagination is finalized

This is another reason the route should own the read logic instead of the browser querying raw location rows directly.

---

## API Design

Add a dedicated route for the products-page browse surface instead of overloading the existing generic browser-side Supabase query helper.

Suggested route:

```txt
GET /api/products/search
```

Responsibilities:
- parse the existing filter set plus `locationIds`
- query `products` and `product_inventory`
- enforce `LocationID IN (2,3,4)` only
- collapse to one row per SKU
- compute primary-location display values
- compute variance metadata
- return paginated results and total count

The current client hook can keep the same outer shape:

```ts
{
  products,
  total,
  page,
  pageSize
}
```

but the `products` row type will become Phase-3-specific instead of mirroring the raw `products` table exactly.

---

## Implementation Boundaries

Phase 3 should **not** rewrite every products-page component.

Boundaries:
- `ProductsPage` owns picker state and URL updates
- a new server route owns location-aware search/count logic
- the existing `useProductSearch` hook can be adapted to call that route
- `ProductTable` gains awareness of `primaryInventory`, `selectedInventories`, and `variance`
- write dialogs (`NewItemDialog`, `EditItemDialog`, bulk edit) remain unchanged in behavior

That keeps the PR tightly scoped to browse-state and read rendering.

---

## Error Handling

### Invalid `loc` params

If the URL contains invalid location IDs:
- ignore invalid values
- if none remain, reset to `[2,3,4]`
- do not throw

### Missing inventory slices

If a row is visible through one selected location but lacks a slice for the primary location due to inconsistent data:
- `primaryInventory` may be `null`
- the table should show `—`
- the variance badge should suppress itself if there is no meaningful comparison

This should be rare, but the API contract should permit it.

### API failure

If the new browse route fails:
- the page should show the existing product-search failure treatment
- saved views and picker state should remain intact in the URL
- no fallback to Pierce-only reads should happen silently, because that would misrepresent scope

---

## Testing Strategy

### Unit

- `parseFiltersFromSearchParams` parses `loc`
- `serializeFiltersToSearchParams` writes `loc`
- defaulting and invalid-location fallback behavior
- primary-location selection helper
- variance helper logic

### Integration

- route returns one row per SKU when multiple selected locations exist
- `loc=3` excludes PIER-only SKUs
- location-sensitive filters apply to the primary location
- total count matches grouped SKU visibility, not raw inventory-row count

### Component

- location picker updates state and URL
- retail/cost/stock cells show primary-location values
- `+N varies` badge appears only when selected locations disagree
- popover lists only selected locations

### Manual smoke

- all three selected
- `PCOP only`
- `PFS only`
- a saved view with a non-default location scope
- search text + price filter + location filter combined

---

## Risks And Mitigations

### Risk 1: Route complexity grows too large

Mitigation:
- keep the route read-only
- split helpers for filter planning, row grouping, and variance calculation
- do not mix in write-shape concerns

### Risk 2: Counts drift from rendered rows

Mitigation:
- group to one row per SKU at the route layer
- test count and page results explicitly

### Risk 3: Users misunderstand which location a value represents

Mitigation:
- use the fixed location picker
- define primary location by canonical selected order
- show explicit `+N varies` badges
- label popover rows by location abbreviation

### Risk 4: Phase 3 accidentally becomes Phase 5

Mitigation:
- do not change editor payloads
- do not add inventory write APIs
- do not add location switching inside the edit dialog yet

---

## Non-Goals Reaffirmed

Phase 3 is successful even if:
- the edit dialog still writes Pierce-only values
- bulk edit remains single-location in practice
- add-item stays unchanged

Those are later phases. The point of Phase 3 is to make the browse surface tell the truth about multi-location inventory.

---

## Decision Summary

Phase 3 should:
- start from fresh `main` after Phase 2 merge
- remain read-only
- introduce `locationIds` as a first-class filter
- use a dedicated server search route for location-aware browse behavior
- display primary-location values plus explicit variance affordances
- leave editor and write behavior alone

This is the narrowest phase that proves the multi-location data model is real in the user-facing catalog without tangling that proof with editor complexity.
