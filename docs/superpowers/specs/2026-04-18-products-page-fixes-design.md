# Products Page Fixes — Design Spec

Date: 2026-04-18

## Overview

Five fixes to the `/products` page after the analytics refactor (PRs #175, #178–#180):

1. **Bug:** clicking most presets snaps the active tab back to "Textbooks".
2. **Stock On Hand becomes a permanent column** — never hide-able.
3. **Sort on every column header** — currently only the identifier and price columns sort.
4. **Hide-a-column from its header** with a clear path to bring it back.
5. **No horizontal scrolling** on typical Pierce workstation widths (1080p+).

These changes touch four files in `src/domains/product/` and `src/components/products/` plus one query whitelist. No schema changes, no new tables, no new API endpoints.

## Goals & Non-Goals

**Goals**
- Presets work the same on either tab unless the preset itself names a tab.
- `stock_on_hand` is always visible alongside SKU / Title / Retail / Cost / Last Sale.
- Every column header has a click-to-sort affordance.
- Optional columns can be removed in one click and re-added from a single, discoverable picker.
- Default products page width and tier-based hiding combine so the typical view fits without horizontal scroll.

**Non-Goals**
- No new metrics. (Stock On Hand already exists as `products.stock_on_hand`; we are promoting it, not adding it.)
- No row-shape redesign (two-line stacked cells were considered and deferred).
- No new server-side computation for margin or "days since sale" — both stay derived in the client.
- No mobile redesign. The existing card view stays as-is.

## 1. Preset → Tab Bug

### Root cause

`applyPreset` in `src/domains/product/view-serializer.ts:127–136` builds the next filter set with:

```ts
const filters = { ...EMPTY_FILTERS, ...view.filter } as ProductFilters;
```

`EMPTY_FILTERS.tab` is `"textbooks"` (`src/domains/product/constants.ts:18`). Any preset whose `filter` does not explicitly set `tab` therefore inherits the `"textbooks"` default. That includes "Accelerating", "Decelerating", every dead-weight, mover, stock-health, and most data-quality presets — i.e. most of them.

### Fix

`applyPreset` keeps the user's current `tab` and `search` unless the preset explicitly overrides them. Signature changes from `applyPreset(view)` to `applyPreset(view, current)`:

```ts
export function applyPreset(view: SavedView, current: ProductFilters): AppliedPreset {
  const filters: ProductFilters = {
    ...EMPTY_FILTERS,
    tab: current.tab,
    search: current.search,
    ...view.filter,
  } as ProductFilters;
  // visibleColumns logic unchanged
}
```

Call site in `src/app/products/page.tsx:113` updates to pass `filters` as the second argument.

The six presets that already set `tab` explicitly (`pricing-gm-under-5`, `pricing-gm-over-50`, `pricing-textbooks-over-100`, `textbook-current-semester-active`, `textbook-faded-this-year`, `data-missing-isbn-textbook`) keep their behavior because their `tab:` survives the spread.

## 2. Permanent Stock Column

### Current state

`stock` is in `OPTIONAL_COLUMNS` (`src/domains/product/constants.ts:71-80`) and `DEFAULT_COLUMN_SET` (`:84`). The column toggle popover lets a user uncheck it, and presets can omit it from `columnPreferences.visible`, hiding it.

### Change

- Remove `stock` from `OPTIONAL_COLUMNS`, `DEFAULT_COLUMN_SET`, and `COLUMN_LABELS` (`constants.ts`).
- Hard-code the Stock cell into `src/components/products/product-table.tsx`, rendered immediately after the Last Sale column for both tabs:

```tsx
<TableHead className="text-right">
  <SortHeader field="stock_on_hand" label="Stock" .../>
</TableHead>
// ...body cell:
<TableCell className="text-right tabular-nums">
  {product.stock_on_hand ?? "—"}
</TableCell>
```

- Strip `"stock"` entries from every preset's `columnPreferences.visible` array in `src/domains/product/presets.ts` (becomes redundant — Stock is always shown).

### Persistence

`COLUMN_PREFS_STORAGE_KEY` payloads from existing users may still contain `"stock"`. The filter in `column-visibility-toggle.tsx:23` already discards anything not in `OPTIONAL_COLUMNS`, so legacy `"stock"` entries are silently dropped. No migration needed.

## 3. Additive Presets

### Current state

`src/app/products/page.tsx:113-119` `handlePresetClick` calls `setRuntimeColumns(visibleColumns)`, which **replaces** the active visible set. If the user had `units_1y` and `revenue_1y` toggled on, clicking a preset whose `visibleColumns` is `["margin"]` drops them.

### Change

Merge the preset's columns into the user's current base columns:

```ts
function handlePresetClick(view: SavedView) {
  const { filters: next, visibleColumns } = applyPreset(view, filters);
  const merged = visibleColumns
    ? Array.from(new Set([...baseColumns, ...visibleColumns]))
    : null;
  setActiveView(view);
  setRuntimeColumns(merged);
  updateFilters({ ...next, page: 1 }, { view: view.slug ?? view.id });
}
```

The "Reset to my default" button on the columns popover stays the escape hatch — it clears the runtime override and reverts to `baseColumns` exactly.

## 4. Sort on Every Column

### Server-side whitelist

Extend `ALLOWED_SORT_FIELDS` in `src/domains/product/queries.ts:8-12` with:

```ts
"stock_on_hand",
"units_sold_30d", "units_sold_1y", "units_sold_lifetime",
"revenue_30d", "revenue_1y",
"txns_1y",
"updated_at",
"dept_num",
```

`ProductSortField` in `types.ts:111` widens to match.

### Header changes

Every `<TableHead>` in `product-table.tsx` becomes a `<SortHeader>`. The `field` for each:

| Header | Sort field |
|---|---|
| Stock | `stock_on_hand` |
| DCC | `dept_num` (lexical via dept→class→cat is not feasible server-side; sort by dept only) |
| Units 1y | `units_sold_1y` |
| Revenue 1y | `revenue_1y` |
| Receipts 1y | `txns_1y` |
| Margin % | *client-side, see below* |
| Days since sale | `last_sale_date` (descending = oldest = most days) — flip `sortDir` semantics in `SortHeader` for this column only |
| Updated | `updated_at` |
| Barcode | `barcode` (already in whitelist) |

### Margin client-side note

Margin is `(retail - cost) / retail`. PostgREST cannot sort on a computed expression. Two options were considered:

- **(a)** Add a generated column or view exposing `margin_pct`.
- **(b)** Sort the current page client-side after fetch.

We pick (b): margin sort applies *within the visible page* and a small "(page)" hint appears next to the sort arrow so the user knows it's not a global sort. Adding a generated column risks recompute storms during the next sync; not worth it for a column users rarely sort.

## 5. Hide-from-Header + "+ Add Column" Picker

### Hide affordance

Each *optional* column header (not the permanent ones) renders a small `×` button on hover, adjacent to the sort caret. Click semantics:

```ts
function hideColumn(key: OptionalColumnKey) {
  const next = active.filter((k) => k !== key);
  setBase(next);          // persists to localStorage
  onResetRuntime();       // clears any preset's runtime override
}
```

### Add affordance

The existing `ColumnVisibilityToggle` popover stays — re-skin only:

- Trigger label changes from `Columns ▾` to `+ Add column`.
- Trigger lives inline next to the column chips area in the toolbar (currently in the right-side toolbar; stays there but with stronger affordance).
- Inside the popover, optional columns currently visible show as checked; hidden ones unchecked. Permanent columns do not appear in the list.

## 6. Full-Bleed Layout + Priority-Tier Hiding

### Page width

`src/app/products/page.tsx:129` — drop `max-w-7xl mx-auto`. Replace with `mx-auto px-3 lg:px-4` and let the table fill the viewport.

### Priority tiers

Each optional column gets a priority tag:

| Column | Priority |
|---|---|
| Units 1y | high |
| Revenue 1y | high |
| Margin % | medium |
| Receipts 1y | medium |
| DCC | medium |
| Days since sale | low |
| Updated | low |

Permanent columns (SKU, Title/Description, Author/Barcode, ISBN, Edition, Barcode (textbook)/Catalog#/Type/Vendor (merch), Retail, Cost, Last Sale, Stock) have no priority — they always render.

### Hiding mechanism

CSS `@container` queries on the table wrapper:

```css
.product-table { container-type: inline-size; }

@container (max-width: 1280px) {
  .product-table th[data-priority="low"],
  .product-table td[data-priority="low"] { display: none; }
}

@container (max-width: 1024px) {
  .product-table th[data-priority="medium"],
  .product-table td[data-priority="medium"] { display: none; }
}
```

The breakpoints (1280, 1024) are starting values; tune after a Pierce-workstation pass. Permanent columns and high-priority optionals always render.

### "+ N column hidden" pill

When responsive hiding is active, a small badge appears in the toolbar (next to "+ Add column"): "2 columns hidden — narrow window". Clicking it opens the picker. Detection uses a `ResizeObserver` on the table container computing which `[data-priority]` rules are active at the current size.

## File-Level Change Summary

| File | Change |
|---|---|
| `src/domains/product/view-serializer.ts` | `applyPreset` signature + body — preserve current `tab`/`search`. |
| `src/domains/product/constants.ts` | Remove `stock` from OPTIONAL_COLUMNS / DEFAULT_COLUMN_SET / COLUMN_LABELS. |
| `src/domains/product/presets.ts` | Strip `"stock"` from every `columnPreferences.visible`. |
| `src/domains/product/queries.ts` | Extend `ALLOWED_SORT_FIELDS`. |
| `src/domains/product/types.ts` | Widen `ProductSortField`. |
| `src/components/products/product-table.tsx` | Hard-code Stock column; SortHeader on every column; `data-priority` attrs; client-side margin sort; X button on optional headers; full-bleed-friendly classes. |
| `src/components/products/column-visibility-toggle.tsx` | Trigger label → "+ Add column"; remove `stock` row; add `hideColumn` exposed for header-X. |
| `src/app/products/page.tsx` | Drop `max-w-7xl`; pass current filters into `applyPreset`; merge preset columns into base; pass `hideColumn` callback to table. |

Net delta: ~8 files, ~250 lines, no schema changes.

## Testing

- **Manual smoke:**
  - On Textbooks tab: click Accelerating → still on Textbooks, columns now include Units 1y + whatever was already toggled, Stock visible.
  - On General Merchandise tab: click Accelerating → still on General Merchandise, same columns rule.
  - Pricing presets that name a tab still switch tabs.
  - Sort on every header round-trips through the URL and stays after refresh.
  - X out a column → gone, persists across refresh, returns from "+ Add column".
  - Resize window narrow → low-priority columns drop, "N hidden" pill appears, no horizontal scrollbar.
- **`npm run ship-check`** must pass before PR.
- **Probe scripts** referenced by the user (`scripts/probe-prism-*.ts`, `scripts/test-sales-txn-sync.ts`) are not affected — they run against the data layer, not the UI.

## Out of Scope / Deferred

- Two-line stacked cell layout (option C from brainstorm) — revisit only if A+B still feel cramped after deployment.
- Generated `margin_pct` column for true server-side margin sort.
- Mobile / sub-768px redesign.
- Persisting per-tab column sets (current persistence is global across tabs).
- Column reordering by drag.

## Risks

- **Sort whitelist widening** is a server-side trust boundary; the new fields are all real columns on `products`, but reviewers should confirm the list in code review.
- **Container queries** browser support is fine on evergreen Chrome/Edge (Pierce workstation default). Documented for future maintainers in case the floor moves.
- **Removing `max-w-7xl`** changes the visual feel of every existing bookmark; not breaking, just wider. Worth a screenshot in the PR.
