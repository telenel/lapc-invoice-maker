# Products Page Interactive Redesign — Design Spec

**Date:** 2026-04-17
**Branch:** `feat/products-interactive` (from main at `5b9d66c`)
**Status:** Design approved, ready for implementation plan

## Goal

Turn the products page from a flat filter + grid into a workspace that lets admins jump straight to the questions they actually ask of the catalog — dead weight, data-quality gaps, pricing outliers, recent activity — via one-click deterministic presets, and lets them save their own combined filter + column layouts. Surface DCC classification, stock on hand, and Prism's precomputed annual-sales estimates as first-class columns and filters.

## Background & context

Recent work (PR #162, #170, #173) landed Prism-backed item CRUD, classification-correct sync, and a stock + updated-at mirror. Operators now have a trustworthy catalog view but still page through 61k rows by hand when they want to answer questions like "which items are dead inventory?" or "which textbooks are missing an ISBN?" The filter bar is capable but unstructured — every question is a fresh filter combo, and there is no way to save a useful combo for reuse.

What's missing is two things:
- A shelf of **named, deterministic queries** for the questions that get asked every week.
- A way to **save and share combined filter + column layouts** (presets bundle both).

DCC classification and Prism's `Inventory_EstSales` velocity estimate are already in Prism but haven't been pulled into the mirror. They're the minimum set that unlocks real catalog insight without the much heavier `ItemHistory` aggregation (captured as PR #2 follow-up).

## Architectural direction (locked in brainstorming)

**Prism stays the source of truth.** Supabase is a read-side mirror. This spec only extends the read path — sync adds columns, UI reads them. No new write paths to Prism.

**Presets bundle filter + column set.** Clicking a preset replaces both the active filter and the visible columns. Users who want to see the underlying filter tweak it in the filters panel as usual; the URL reflects the explicit state, not the preset name.

**System presets and user views share one table.** `saved_searches` already has `is_system` and `owner_user_id`. System presets seed with `is_system=true, owner_user_id=NULL`; user-saved views use `is_system=false, owner_user_id=<user>`. One endpoint lists both, scoped correctly.

**Pierce-only scope is preserved.** All new sync JOINs filter to Pierce LocationIDs (2 PIER, 3 PCOP, 4 PFS, 5 PBO) per the existing safety rail. `Inventory_EstSales` specifically pulls LocationID=2.

## Scope

### In scope (this PR)

- **Sync extensions** in `src/domains/product/prism-sync.ts`:
  - JOIN `DeptClassCat` + `DCC_Department` + `DCC_Class` + `DCC_Category` for `(dept_num, class_num, cat_num)` smallints and `(dept_name, class_name, cat_name)` strings.
  - LEFT JOIN `Inventory_EstSales` (most recent `CalculationDate` per SKU where `LocationID=2`) for `one_year_sales`, `look_back_sales`, `sales_to_avg_ratio`, `est_sales_calc`, and `est_sales_prev` (the prior row's `est_sales_calc` for trend arrows).
- **Mirror schema migration** (`prisma/migrations/<YYYYMMDDHHMMSS>_products_dcc_and_est_sales/migration.sql`, timestamp picked at implementation time) adding those columns nullable on `products`.
- **System preset seed migration** inserting the 22 presets below into `saved_searches` with `is_system=true`. Upsert by `(name, is_system=true)`, not blind INSERT, so re-runs are safe and prior seeds are not duplicated.
- **Saved Views API** at `/api/products/views`: `GET` returns system presets + the caller's user views, `POST` saves a new user view, `DELETE /:id` removes a user view. System presets are read-only.
- **Schema extension** on `saved_searches`: add `description` (text, nullable), `column_preferences` (jsonb, nullable), `slug` (text, nullable — set for system presets, NULL for user views), `preset_group` (text, nullable — set for system presets), and `sort_order` (smallint, nullable — set for system presets for display ordering). `filter` already exists and holds the filter payload. Also add a partial unique index on `slug` where `slug IS NOT NULL` so the seed migration can `ON CONFLICT (slug) DO UPDATE` idempotently.
- **UI**
  - `SavedViewsBar` chip row above the filters panel: system presets left (grouped by the 6 icon-prefixed groups — 💀 Dead, 📊 Movers, 🔍 Data, 💰 Pricing, 📝 Recent, 📚 Textbook), user views right, trailing "+ Save view" button.
  - `SaveViewDialog` with name (required, unique per owner) and optional description.
  - `ColumnVisibilityToggle` popover; `localStorage` persistence under `products:columns:v1`; preset overrides live in React state only and reset on next preset pick.
  - `DccPicker` typeahead matching numeric (`10.10.20`) and name (`drinks`). Session-cached from `/api/products/dcc-list`.
  - `PierceAssuranceBadge` in header; reads latest `sync_runs` row; green dot if ok and <24h old, amber otherwise; click opens existing sync history dialog.
  - Extended filters panel: Stock range, DCC picker, Data Quality checkboxes, Activity windows, Margin range.
  - Extended `ProductTable` columns (optional, toggled via `ColumnVisibilityToggle` and overridden by presets): Stock, DCC (monospace `10.10.20` prefix + `Drinks › Bottled › Sodas` name path), Est. annual sales, Margin %, Days since last sale, Updated (relative).

### Out of scope (captured for later)

- **Sales history velocity (PR #2)** — aggregating `ItemHistory` in 30/90/365-day windows, 3-year cap, new velocity columns, 8 additional velocity-driven presets (Fast movers, Rising stars, Slowing sellers, Smart reorder, Profit winners, Stockout-prone, Capital sitting, Margin bleeders). Adds 5–15s to sync; deferred because `Inventory_EstSales` covers the immediate need with near-zero sync cost.
- **Sharing user views between operators.** Owner-scoped only for now.
- **Export selection from a preset.** Existing CSV export stays separate.
- **Mutable system presets.** System rows are read-only; operators can save their own copy.
- **Multi-campus preset scope.** All presets are Pierce-only.

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│ /products                                                        │
│                                                                  │
│  Header ─ [Pierce Assurance ●] [Sync Database] [+ New Item]      │
│                                                                  │
│  ┌─ SavedViewsBar ────────────────────────────────────────────┐ │
│  │ 💀 Dead  📊 Movers  🔍 Data  💰 Pricing  📝 Recent  📚 Text│ │
│  │                                        ⋯  [+ Save view]    │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ProductFiltersBar (extended)                                    │
│    ├─ Search | Tab | Vendor | Status                             │
│    ├─ Stock range | DCC picker                                   │
│    ├─ Data Quality (missing barcode / ISBN / title / retail<cost)│
│    ├─ Activity (last sale window, edited window)                 │
│    └─ Margin range                                               │
│                                                                  │
│  [ColumnVisibilityToggle ▾]                                      │
│                                                                  │
│  ProductTable (extended columns: Stock, DCC, Est. sales,         │
│                 Margin %, Days since sale, Updated)              │
└──────────────────────────────────────────────────────────────────┘
            │                                        ▲
            ▼                                        │
  /api/products (existing list endpoint)   /api/products/views
  /api/products/dcc-list (new)             (GET list, POST save,
                                            DELETE /:id)
```

### Sync pipeline additions

`prism-sync.ts` today selects Pierce items with a WHERE on `LocationID IN (2,3,4,5)`. The extended query adds:

```sql
LEFT JOIN DeptClassCat dcc ON i.DCCID = dcc.DCCID
LEFT JOIN DCC_Department dep ON dcc.Department = dep.Department
LEFT JOIN DCC_Class      cls ON dcc.Department = cls.Department
                             AND dcc.Class      = cls.Class
LEFT JOIN DCC_Category   cat ON dcc.Department = cat.Department
                             AND dcc.Class      = cat.Class
                             AND dcc.Category   = cat.Category
LEFT JOIN (
  SELECT es.SKU, es.OneYearSales, es.LookBackSales,
         es.SalesToAvgSalesRatio, es.EstSalesCalc,
         ROW_NUMBER() OVER (PARTITION BY es.SKU
                            ORDER BY es.CalculationDate DESC) AS rn
  FROM Inventory_EstSales es
  WHERE es.LocationID = 2
) es ON es.SKU = i.SKU AND es.rn = 1
```

Degrade gracefully: every name column is nullable (Category especially — many rows have no cat_name in Prism). Numeric triple is always set if `DCCID` is set.

For `est_sales_prev`, fetch the second-most-recent `EstSalesCalc` row in the same subquery (`rn = 2`) and carry it into the upsert so the trend arrow in the table is one column, not a recompute.

### Mirror schema

```sql
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS dept_num          SMALLINT,
  ADD COLUMN IF NOT EXISTS class_num         SMALLINT,
  ADD COLUMN IF NOT EXISTS cat_num           SMALLINT,
  ADD COLUMN IF NOT EXISTS dept_name         TEXT,
  ADD COLUMN IF NOT EXISTS class_name        TEXT,
  ADD COLUMN IF NOT EXISTS cat_name          TEXT,
  ADD COLUMN IF NOT EXISTS one_year_sales    NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS look_back_sales   NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS sales_to_avg_ratio NUMERIC(8,4),
  ADD COLUMN IF NOT EXISTS est_sales_calc    NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS est_sales_prev    NUMERIC(12,2);

CREATE INDEX IF NOT EXISTS products_dcc_num_idx
  ON products (dept_num, class_num, cat_num);
CREATE INDEX IF NOT EXISTS products_est_sales_calc_idx
  ON products (est_sales_calc);
```

All columns nullable, no Prisma model change (`products` stays admin-client-only). Index on the numeric DCC triple for the picker's range queries and on `est_sales_calc` for the Est.-sales column sort.

### `saved_searches` extension

```sql
ALTER TABLE saved_searches
  ADD COLUMN IF NOT EXISTS description         TEXT,
  ADD COLUMN IF NOT EXISTS column_preferences  JSONB,
  ADD COLUMN IF NOT EXISTS slug                TEXT,
  ADD COLUMN IF NOT EXISTS preset_group        TEXT,
  ADD COLUMN IF NOT EXISTS sort_order          SMALLINT;

CREATE UNIQUE INDEX IF NOT EXISTS saved_searches_slug_unique
  ON saved_searches (slug) WHERE slug IS NOT NULL;
```

All nullable. System presets populate `slug`, `preset_group`, and `sort_order`; user views leave them NULL. The four existing seeded rows from migration `20260417000002` are scoped to the bulk-edit workspace, not this products-page redesign. Backfill step: set `preset_group='legacy-bulk-edit'` and a stable `slug` on each so they coexist without colliding. The products-page `GET /api/products/views` filters on `preset_group IN (<new-groups>)` to exclude them; the bulk-edit workspace keeps querying them unchanged.

Add a partial unique index on `(owner_user_id, name)` for user views so the POST handler can rely on DB-level duplicate detection:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS saved_searches_owner_name_unique
  ON saved_searches (owner_user_id, name) WHERE owner_user_id IS NOT NULL;
```

### Preset payload shape

```ts
type SavedViewPayload = {
  filter: ProductFilters;          // same shape the existing API accepts
  columnPreferences?: {
    visible: string[];             // column keys in display order
  };
};
```

Presets store this in `saved_searches.filter` + `saved_searches.column_preferences`. Loading a preset calls `applyPreset(view)`:

```ts
function applyPreset(view: SavedView) {
  setFilters(view.filter);
  if (view.columnPreferences) {
    setRuntimeColumns(view.columnPreferences.visible);
  }
  router.replace(serializeFiltersToUrl(view.filter, { view: view.slug }));
}
```

URL carries either `?view=<slug-or-id>&<filter-params>` (on preset click the URL includes BOTH so a hard-reload still reconstructs the filter even if the preset row is deleted later) or just the explicit filter params. Explicit filter edit drops the `view` param. This keeps shared URLs self-describing. `<slug-or-id>` resolves to the `slug` column for system presets and to the UUID `id` for user views.

### API surface

- `GET /api/products/views` → `{ system: SavedView[], mine: SavedView[] }`. System rows filtered to products-page `preset_group` values (excluding `'legacy-bulk-edit'`), grouped by `preset_group`, sorted by `sort_order` within each group; user views sorted by `updated_at DESC`.
- `POST /api/products/views` → body `{ name, description?, filter, columnPreferences? }`. `owner_user_id` set from session. 409 on duplicate `(owner_user_id, name)`.
- `DELETE /api/products/views/:id` → only succeeds when the row's `owner_user_id` matches the session user and `is_system=false`.
- `GET /api/products/dcc-list` → `{ items: Array<{ deptNum, classNum, catNum, deptName, classNum, catName }> }`. Served from the mirror (`SELECT DISTINCT`), cached one hour via `Cache-Control: private, max-age=3600` and client-cached per session.

## Components

- **`SavedViewsBar`** (`src/components/products/saved-views-bar.tsx`)
  - Real `<button>` chips in an `<ol>`. Groups separated by subtle vertical dividers (not panels). Leading emoji per group (`aria-hidden`), label text is the sole accessible name.
  - Keyboard nav: Tab into bar, arrow-left/right moves focus within, Enter activates. Focus ring via `focus-visible`.
  - Overflow: after N chips fit, collapse remainder into a "More ▾" popover. Never horizontal-scroll.
  - `aria-pressed="true"` on the active chip.
  - "+ Save view" button far-right, opens `SaveViewDialog`.
- **`SaveViewDialog`** (`src/components/products/save-view-dialog.tsx`)
  - Fields: Name (required, unique per owner, inline validation), Description (optional). Submit disabled until name present and unique.
  - Saves current `filters` + current `runtimeColumns` (if any) via POST. Closes on success, toasts the new view name, selects it.
  - Errors stay inline; focus jumps to first error field.
- **`DccPicker`** (`src/components/products/dcc-picker.tsx`)
  - Combobox (downshift-style). Single-select for MVP.
  - Match logic: parse input as numeric triple first (`/^\d+(\.\d+(\.\d+)?)?$/`), filter by prefix; otherwise case-insensitive substring match on the name path.
  - Session-cached list from `/api/products/dcc-list`. If fetch fails, degrade to numeric-only text input with a discreet "name lookup unavailable" hint.
- **`ColumnVisibilityToggle`** (`src/components/products/column-toggle.tsx`)
  - Popover with a checklist of all optional columns. Required columns (SKU, title, tab) not listed.
  - Persists user's base preference to `localStorage` under `products:columns:v1` as `{ visible: string[] }`.
  - Preset-applied overrides live in React state only. "Reset to my default" button clears the override.
- **`ProductFiltersBar`** (extended — `src/components/products/product-filters.tsx`)
  - New subsections grouped under collapsible panels: Stock, DCC, Data Quality, Activity, Margin.
  - Stock: `minStock`/`maxStock` numeric inputs (`inputmode="numeric"`). Empty = no bound.
  - Data Quality: checkbox grid mapping to existing filter keys (`missingBarcode`, `missingIsbn`, `missingTitle`, `retailBelowCost`, `zeroPrice`).
  - Activity: two grouped selects — Last sale (any, ≤30d, ≤90d, ≤1y, ≤2y, never, >5y) and Edited (any, ≤7d, since last sync).
  - Margin: `minMargin`/`maxMargin` percentage inputs.
- **`ProductTable`** (extended — `src/components/products/product-table.tsx`)
  - New optional columns, all `font-variant-numeric: tabular-nums` on numerics:
    - Stock — integer, right-aligned. Renders "—" when null.
    - DCC — two-row cell: monospace `10.10.20` (non-breaking, `translate="no"`) + `Drinks › Bottled › Sodas` name path. Truncate name path with tooltip.
    - Est. annual sales — `Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })`. Trend arrow (▲/▼/=) based on `est_sales_calc` vs `est_sales_prev`.
    - Margin % — `(retail - cost) / retail`, formatted as percent. Red text when `<10%`, normal ≥10%.
    - Days since last sale — integer from `last_sale_date`, or "Never" when null.
    - Updated — relative ("3 days ago") via `Intl.RelativeTimeFormat`, exact timestamp in tooltip.
- **`PierceAssuranceBadge`** (`src/components/products/pierce-assurance-badge.tsx`)
  - Reads latest `sync_runs` row. Dot color: green if `status='ok'` and `finished_at > now() - 24h`, amber otherwise. Pulse animation honors `prefers-reduced-motion`.
  - `role="status" aria-live="polite"`. `sr-only` text: "Pierce catalog in sync, last checked 3 hours ago" / "Pierce catalog sync stale, last success 28 hours ago."
  - Clicking opens the existing sync history dialog.

## Data flow

1. **Initial page load**
   - Server reads search params, normalizes into `ProductFilters` via `parseFiltersFromParams`.
   - Server-side product query runs against Supabase with the extended filter translator (new keys: `minStock`, `maxStock`, `deptNum`, `classNum`, `catNum`, `retailBelowCost`, `minMargin`, etc.).
   - Saved views are fetched client-side on mount (not blocking first paint).
2. **Preset click**
   - `applyPreset(view)` sets filter state, runtime columns, and replaces the URL with `?view=<slug>` plus the explicit filter params from the preset payload (so hard-reload on a preset URL still reconstructs correctly if the preset is later deleted).
   - React Query invalidates the products list with the new filter.
3. **Filter tweak after a preset**
   - Explicit filter change drops the `view` URL param. Active chip loses its `aria-pressed`.
4. **Save view**
   - POST with current filter + runtime columns. On success, refetch views list, select the new one, close dialog.
5. **Delete view**
   - Confirm modal. On success, refetch views list, clear selection if the deleted view was active.
6. **Pierce badge**
   - Reads `sync_runs` latest row on mount + after any manual sync trigger. SWR revalidation every 5 minutes while the tab is focused.

### Filter → SQL mapping (new keys)

| Filter key | SQL translation |
|---|---|
| `minStock`, `maxStock` | `stock_on_hand >= ? AND stock_on_hand <= ?` |
| `deptNum`, `classNum`, `catNum` | `dept_num = ? [AND class_num = ?] [AND cat_num = ?]` |
| `retailBelowCost` | `retail_price < cost` |
| `zeroPrice` | `retail_price = 0 OR cost = 0` |
| `missingTitle` | `(item_type IN ('textbook','used_textbook') AND title IS NULL) OR (item_type = 'general_merchandise' AND description IS NULL)` |
| `minMargin`, `maxMargin` | `(retail_price - cost) / NULLIF(retail_price, 0) BETWEEN ? AND ?` |
| `lastSaleWithin` (30/90/365d) | `last_sale_date >= now() - interval '?'` |
| `lastSaleNever` | `last_sale_date IS NULL` |
| `lastSaleOlderThan` (2y/5y) | `last_sale_date < now() - interval '?'` |
| `editedWithin` (7d) | `updated_at >= now() - interval '?'` |
| `editedSinceSync` | `updated_at > synced_at` |

All new keys add to the existing filter translator in `src/app/api/products/route.ts`. Unknown keys silently stripped.

## System preset catalog

22 rows seeded into `saved_searches` with `is_system=true`, `owner_user_id=NULL`, and the `slug`/`preset_group`/`sort_order` columns populated. Seed migration uses `ON CONFLICT (slug) DO UPDATE` so re-running is safe (the query matches on `slug`, not `(owner_user_id, name)`). Each preset also carries a `column_preferences` payload so the visible columns match the question being asked.

| Group | Preset | Filter predicate | Column overrides |
|---|---|---|---|
| 💀 Dead weight | Discontinued with stock | `discontinued=true AND stock_on_hand>0` | Stock, Updated |
| 💀 Dead weight | Never sold | `lastSaleNever=true` | Stock, Est. sales, Updated |
| 💀 Dead weight | No sales in 2 years | `lastSaleOlderThan='2y'` | Days since sale, Stock |
| 💀 Dead weight | No sales in 5 years | `lastSaleOlderThan='5y'` | Days since sale, Stock |
| 💀 Dead weight | Zero stock + never sold | `stock_on_hand=0 AND lastSaleNever=true` | Updated |
| 💀 Dead weight | Discontinued | `discontinued=true` | Stock, Updated |
| 📊 Movers | Sold in last 30 days | `lastSaleWithin='30d'` | Est. sales, Stock |
| 📊 Movers | Sold in last 90 days | `lastSaleWithin='90d'` | Est. sales, Stock |
| 📊 Movers | Proven sellers | `lastSaleWithin='90d' AND discontinued=false AND stock_on_hand>0` | Est. sales, Stock, Margin % |
| 🔍 Data quality | Missing barcode | `missingBarcode=true` | Updated |
| 🔍 Data quality | Missing ISBN (textbooks) | `tab=textbooks AND missingIsbn=true` | Updated |
| 🔍 Data quality | Missing description/title | `missingTitle=true` | Updated |
| 🔍 Data quality | Retail < cost | `retailBelowCost=true` | Margin %, Updated |
| 🔍 Data quality | Retail or cost = 0 | `zeroPrice=true` | Updated |
| 💰 Pricing | GM under $5 | `tab=merchandise AND maxRetail=5` | Margin %, Est. sales |
| 💰 Pricing | GM over $50 | `tab=merchandise AND minRetail=50` | Margin %, Est. sales |
| 💰 Pricing | Textbooks over $100 | `tab=textbooks AND minRetail=100` | Margin %, Est. sales |
| 💰 Pricing | High margin | `minMargin=0.4` | Margin %, Est. sales |
| 💰 Pricing | Thin margin | `maxMargin=0.1` | Margin %, Est. sales |
| 📝 Recent activity | Edited in last 7 days | `editedWithin='7d'` | Updated |
| 📝 Recent activity | Edited since last sync | `editedSinceSync=true` | Updated |
| 📚 Textbook | Used textbooks only | `itemType='used_textbook'` | Est. sales |

## Error handling

- **Views API failure.** UI falls back to embedded system presets (bundled as a constant). Toast with `aria-live="polite"`: "Couldn't load your saved views — showing system presets only." User views hidden until retry succeeds.
- **Save-view failure.** Dialog stays open, inline error message, focus first error field. 409 duplicate name triggers: "A view named 'Foo' already exists — pick another name."
- **Delete-view failure.** Modal stays open, inline error. Network retry once, then surface.
- **DCC picker API failure.** Degrade to numeric-only text input. Discreet hint under the input: "Name lookup unavailable — enter DCC as 10.10.20."
- **Invalid numeric filter input.** Client-side zod parser strips invalid values during URL serialization. Never sends NaN to the server.
- **Zero-result preset.** Named empty state: "No dead-weight items found — good news." With a small "Clear preset" action.
- **Filter schema drift.** Unknown keys in the filter payload are stripped silently; log once per session to console with the key name.
- **Destructive delete.** Confirmation modal: "Delete 'My Textbook Gaps'? This can't be undone." Escape cancels, Enter confirms only when focus is on the destructive button.
- **Sync-history read failure on the Pierce badge.** Badge renders amber with `title="Couldn't read sync status"` — never green by default.

## Testing

- **Unit** (`src/domains/product/__tests__/`)
  - `filter-serialization.test.ts` — filter ↔ URL roundtrip for every new key.
  - `apply-preset.test.ts` — `applyPreset` merge semantics, explicit filter override behavior, column override semantics.
  - `preset-predicates.test.ts` — each of the 22 presets evaluated against a shared fixture product set; assert expected SKUs returned.
  - `margin-bucketing.test.ts` — high/thin/normal margin boundary cases including `retail=0` (excluded).
  - `dcc-parser.test.ts` — numeric triple parsing, ambiguous inputs, degenerate cases (trailing dot, letters mixed in).
- **Integration** (`scripts/test-prism-sync-classification.ts`, extended)
  - New DCC name + `Inventory_EstSales` columns populated on a known SKU after a Pierce-only sync.
  - Null Category rows degrade cleanly (name NULL, numeric still set).
- **API** (`src/app/api/products/views/__tests__/`)
  - `GET` returns system rows + caller's user rows, not other users' rows.
  - `POST` 409 on duplicate (owner, name).
  - `DELETE` rejects deleting a system preset; rejects deleting another user's view.
- **E2E** (`tests/e2e/products-interactive.spec.ts`, Playwright)
  - Preset click updates URL, filter panel state, and visible columns.
  - Save view persists across reload.
  - Keyboard-only navigation from Tab into the SavedViewsBar through to activating a chip.
  - Delete-view flow with confirmation.
- **Accessibility**
  - axe run on `/products` with system preset active — zero violations.
  - Tab order audit: skip-to-main → header actions → SavedViewsBar → Filters → Column toggle → Table.
  - Screen reader reads preset activation ("Pressed, Dead weight, Never sold, now showing 127 results" via live region after apply).
- **Performance**
  - Supabase query p95 under 200ms with all filters on for the 61k-row table (measured via explicit `\timing` tests against staging).
  - DCC list fetch: single network request per session, ≤50KB gzipped.
  - Bundle size delta: under 15KB gzipped for the new components.

## Visual treatment

Applies the Vercel Web Interface Guidelines. Committed details:

**Numerics.** `font-variant-numeric: tabular-nums` on every numeric column and on the chip counts. Currency via `Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })` for Est. sales, two decimals for prices in the existing columns. No hardcoded `.toFixed()`, no string concatenation of currency symbols.

**Dates.** `Intl.DateTimeFormat('en-US', { dateStyle: 'medium' })` for absolute timestamps in tooltips. `Intl.RelativeTimeFormat('en-US', { numeric: 'auto' })` for the Updated column.

**Typography.** Non-breaking spaces in unit pairs (`3&nbsp;days`). Ellipsis character `…` in placeholders and loading states, not three dots. Curly quotes in copy.

**Truncation.** `truncate` + `min-w-0` on Title, Description, and DCC name path cells. Full value in `title` attribute.

**DCC cell.** Two-row layout: monospace `10.10.20` prefix (`font-mono text-xs tabular-nums translate="no"`) over the name path (`Drinks › Bottled › Sodas`) with truncate + tooltip. The numeric prefix is never translated.

**Chips.** Real `<button>`. `touch-action: manipulation`. Leading emoji `aria-hidden`. Focus ring via `focus-visible`, never on mouse-click. `aria-pressed` toggles per active state. Overflow collapses into "More ▾" — no horizontal scroll.

**Filter inputs.** Correct `type`/`inputmode`/`autocomplete` per field. `spellCheck={false}` on search. Every input has a `<label htmlFor>` (visible or `sr-only`). Placeholders end with `…` when they suggest continuation ("Search SKU, title, or barcode…"). Paste-to-filter works on all numeric inputs (strip `$`, `,`, etc. in onPaste).

**Pierce badge.** Green/amber dot + `sr-only` context text. `role="status" aria-live="polite"`. Dot uses CSS only, no SVG animation when `prefers-reduced-motion: reduce`.

**Motion.** Every animation honors `prefers-reduced-motion`. Only `transform` and `opacity` animated — no layout-affecting animations. Interruptible via `view-transition-name` on preset swap (via `vercel-react-view-transitions` skill during implementation).

**Copy.** Active voice. Title Case on buttons ("Save View," not "save view"). Specific labels: "Save View," "Delete View," "Clear Preset" — never generic "Save" / "Delete" / "Clear." Error messages always include the fix.

## Tech gotchas (mapped during brainstorming)

- `DeptClassCat` is keyed by `DCCID` but the human-facing triple is `(Department, Class, Category)` smallints. Names come from three separate tables that cascade. Category names are frequently NULL — degrade gracefully.
- `Inventory_EstSales` is keyed by `(SKU, LocationID, CalculationDate)`. We take the most recent row for LocationID=2 and the second-most-recent for `est_sales_prev`. Rows without a prior calc get `est_sales_prev=NULL` (no trend arrow).
- Products has no Prisma model — migrations are raw SQL, not `npx prisma migrate dev`. See `prisma/migrations/20260418040000_products_stock_and_updated_at/migration.sql` for the pattern.
- Existing `saved_searches` table already has 4 seeded rows from migration `20260417000002`. The new seed migration must upsert by `(name, is_system=true)`, not blind-insert, to stay idempotent and to avoid duplicates on re-run.
- `sync_runs` already exists and is read by the existing sync status dialog. The Pierce badge reuses that read path.

## Implementation order (for writing-plans)

1. Mirror schema migrations (DCC + EstSales columns, saved_searches extension).
2. Sync extensions in `prism-sync.ts` (DCC joins, EstSales subquery).
3. Seed migration for the 22 system presets.
4. Filter translator extensions in `/api/products/route.ts`.
5. Views API endpoints (GET/POST/DELETE).
6. DCC list endpoint + session cache.
7. `SavedViewsBar` + `SaveViewDialog`.
8. `ColumnVisibilityToggle`.
9. Extended filters panel subsections.
10. Extended `ProductTable` columns.
11. `PierceAssuranceBadge`.
12. `DccPicker`.
13. Visual polish pass (`frontend-design` + `web-design-guidelines`).
14. View Transitions polish (`vercel-react-view-transitions`).
15. Tests at each layer as components land.
