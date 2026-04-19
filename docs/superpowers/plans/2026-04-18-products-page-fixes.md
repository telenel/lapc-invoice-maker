# Products Page Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the preset-reverts-to-textbooks bug, promote Stock On Hand to a permanent column, make every column sortable, give optional columns inline X-out + a clear add path, and make the page fit without horizontal scroll on a typical Pierce workstation.

**Architecture:** Pure logic and data-layer changes (`src/domains/product/*`) are TDD'd against the existing Vitest suite. UI changes (`src/components/products/*`, `src/app/products/page.tsx`) are layered on top, with React Testing Library smoke tests where they add value. CSS `@container` queries handle responsive hiding — no JS measurement loop. No schema changes.

**Tech Stack:** Next.js 14, React 18, Vitest 4, @testing-library/react 16, Tailwind, Supabase JS client.

**Spec:** [`docs/superpowers/specs/2026-04-18-products-page-fixes-design.md`](../specs/2026-04-18-products-page-fixes-design.md)

**Branch:** `fix/products-presets-and-layout`

---

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `src/domains/product/view-serializer.ts` | Modify | `applyPreset` signature + body change |
| `src/domains/product/constants.ts` | Modify | Remove `stock` from optional column constants |
| `src/domains/product/presets.ts` | Modify | Strip `"stock"` from preset `columnPreferences.visible` |
| `src/domains/product/queries.ts` | Modify | Extend `ALLOWED_SORT_FIELDS`, support inverted `days_since_sale` |
| `src/domains/product/types.ts` | Modify | Widen `ProductSortField` |
| `src/components/products/product-table.tsx` | Modify | Hard-code Stock column; SortHeader on every header; `data-priority` attrs; X button on optional headers; client-side margin sort |
| `src/components/products/column-visibility-toggle.tsx` | Modify | Trigger label → "+ Add column"; remove stock row; expose `hideColumn` |
| `src/app/products/page.tsx` | Modify | Drop `max-w-7xl`; pass current filters to `applyPreset`; merge preset columns into base |
| `src/app/products/products-table.css` | Create | `@container` query rules for priority tiers |
| `tests/domains/product/view-serializer.test.ts` | Modify | Update + extend tests for new `applyPreset` contract |
| `src/__tests__/products-page-presets.test.tsx` | Create | Component-level smoke for the merge + tab-preserving behavior |

---

## Task 0: Branch + baseline

**Files:**
- None (git only)

- [ ] **Step 1: Verify clean main and up-to-date**

```bash
git status
git fetch origin
git log --oneline origin/main -1
```

Expected: clean working tree on `main`, local HEAD matches `origin/main`.

- [ ] **Step 2: Start the feature branch**

```bash
npm run git:start-branch -- fix/products-presets-and-layout
```

Expected: branch created from fresh `main`, switched onto it.

- [ ] **Step 3: Confirm test baseline is green**

```bash
npm run test -- tests/domains/product/view-serializer.test.ts
```

Expected: all 7 existing tests pass. (If they don't, stop — we need a green baseline.)

---

## Task 1: Fix preset-tab bug (TDD)

**Files:**
- Modify: `tests/domains/product/view-serializer.test.ts` (the existing `applyPreset` block)
- Modify: `src/domains/product/view-serializer.ts:127-136`
- Modify: `src/app/products/page.tsx:113-119` (call site)

- [ ] **Step 1: Replace the existing `applyPreset` test block with the new contract**

Open `tests/domains/product/view-serializer.test.ts`. Replace the `describe("applyPreset", …)` block (lines 57–70) with:

```ts
describe("applyPreset", () => {
  const baseTextbook: ProductFilters = { ...EMPTY_FILTERS, tab: "textbooks", search: "calculus" };
  const baseMerch: ProductFilters = { ...EMPTY_FILTERS, tab: "merchandise", search: "" };

  it("preserves the user's current tab when the preset does not specify one", () => {
    const preset = SYSTEM_PRESET_VIEWS.find((v) => v.slug === "trend-accelerating")!;
    const result = applyPreset(preset, baseMerch);
    expect(result.filters.tab).toBe("merchandise");
    expect(result.filters.trendDirection).toBe("accelerating");
  });

  it("preserves the user's current search when the preset does not specify one", () => {
    const preset = SYSTEM_PRESET_VIEWS.find((v) => v.slug === "dead-never-sold-authoritative")!;
    const result = applyPreset(preset, baseTextbook);
    expect(result.filters.search).toBe("calculus");
    expect(result.filters.neverSoldLifetime).toBe(true);
  });

  it("lets a preset override tab when it sets one explicitly", () => {
    const preset = SYSTEM_PRESET_VIEWS.find((v) => v.slug === "pricing-gm-under-5")!;
    const result = applyPreset(preset, baseTextbook);
    expect(result.filters.tab).toBe("merchandise");
    expect(result.filters.maxPrice).toBe("5");
  });

  it("returns the preset column preferences (filtered to known optional keys)", () => {
    const preset = SYSTEM_PRESET_VIEWS.find((v) => v.slug === "dead-discontinued-with-stock")!;
    const result = applyPreset(preset, baseTextbook);
    // "stock" is permanent now — it gets filtered out of the optional column set.
    expect(result.visibleColumns).toEqual(["updated"]);
  });
});
```

- [ ] **Step 2: Run the tests — they should fail**

```bash
npm run test -- tests/domains/product/view-serializer.test.ts
```

Expected: 4 failures in the `applyPreset` block — the function still has the old single-arg signature and old behavior.

- [ ] **Step 3: Update `applyPreset` signature + body**

In `src/domains/product/view-serializer.ts`, replace the `applyPreset` function (lines 127–136) with:

```ts
export function applyPreset(view: SavedView, current: ProductFilters): AppliedPreset {
  const filters: ProductFilters = {
    ...EMPTY_FILTERS,
    tab: current.tab,
    search: current.search,
    ...view.filter,
  } as ProductFilters;
  let visibleColumns: OptionalColumnKey[] | null = null;
  if (view.columnPreferences) {
    visibleColumns = view.columnPreferences.visible.filter(
      (k): k is OptionalColumnKey => (OPTIONAL_COLUMNS as readonly string[]).includes(k),
    );
  }
  return { filters, visibleColumns };
}
```

- [ ] **Step 4: Update the call site in `page.tsx`**

In `src/app/products/page.tsx:113-119`, change `handlePresetClick`:

```ts
function handlePresetClick(view: SavedView) {
  const { filters: next, visibleColumns } = applyPreset(view, filters);
  const withPage = { ...next, page: 1 } as ProductFilters;
  setActiveView(view);
  setRuntimeColumns(visibleColumns);
  updateFilters(withPage, { view: view.slug ?? view.id });
}
```

(The `setRuntimeColumns` line is updated again in Task 4 — leaving the simple replace here keeps this commit focused on the bug fix.)

- [ ] **Step 5: Run the tests — they should pass**

```bash
npm run test -- tests/domains/product/view-serializer.test.ts
```

Expected: all `applyPreset` tests pass; the rest stay green.

- [ ] **Step 6: Commit**

```bash
git add tests/domains/product/view-serializer.test.ts src/domains/product/view-serializer.ts src/app/products/page.tsx
git commit -m "fix(products): preset clicks no longer snap tab back to textbooks"
```

---

## Task 2: Promote Stock — data layer

**Files:**
- Modify: `src/domains/product/constants.ts`
- Modify: `src/domains/product/presets.ts`

- [ ] **Step 1: Remove `stock` from optional column constants**

In `src/domains/product/constants.ts`:

Edit `OPTIONAL_COLUMNS` (lines 71–80) — remove `"stock"`:

```ts
export const OPTIONAL_COLUMNS = [
  "dcc",
  "units_1y",
  "revenue_1y",
  "txns_1y",
  "margin",
  "days_since_sale",
  "updated",
] as const;
```

Edit `DEFAULT_COLUMN_SET` (line 84) — remove `"stock"`:

```ts
export const DEFAULT_COLUMN_SET: OptionalColumnKey[] = ["units_1y", "dcc"];
```

Edit `COLUMN_LABELS` (lines 86–95) — remove the `stock:` entry:

```ts
export const COLUMN_LABELS: Record<OptionalColumnKey, string> = {
  dcc: "DCC",
  units_1y: "Units 1y",
  revenue_1y: "Revenue 1y",
  txns_1y: "Receipts 1y",
  margin: "Margin %",
  days_since_sale: "Days since sale",
  updated: "Updated",
};
```

- [ ] **Step 2: Strip `"stock"` from every preset's `columnPreferences.visible`**

In `src/domains/product/presets.ts`, walk the `SYSTEM_PRESETS` array and remove `"stock"` from every `columnPreferences.visible` array. Resulting changes by slug:

```ts
// dead-discontinued-with-stock          → ["updated"]
// dead-never-sold-authoritative         → ["updated"]
// dead-never-sold-with-stock            → ["updated"]
// dead-no-sales-1y-stock                → ["units_1y", "updated"]
// dead-no-sales-2y-stock                → ["days_since_sale"]
// dead-discontinued-with-recent-sales   → ["units_1y", "updated"]
// movers-top-units-30d                  → ["units_1y", "revenue_1y"]
// movers-top-units-1y                   → ["units_1y", "revenue_1y"]
// trend-accelerating                    → ["units_1y"]
// trend-decelerating                    → ["units_1y"]
// trend-new-arrivals                    → ["units_1y", "revenue_1y"]
// stock-stockout-risk                   → ["units_1y"]
// stock-less-than-30d-cover             → ["units_1y"]
// stock-stale-stock                     → ["days_since_sale"]
// price-high-margin-dead                → ["margin", "units_1y"]
// price-low-revenue-high-stock          → ["revenue_1y"]
// textbook-current-semester-active      → ["units_1y"]
// textbook-faded-this-year              → ["units_1y"]
```

(Presets that didn't list `"stock"` are unchanged. Don't touch their other entries.)

- [ ] **Step 3: Run the existing tests**

```bash
npm run test -- tests/domains/product/view-serializer.test.ts
```

Expected: still green. The Task 1 test for `dead-discontinued-with-stock` already expects `["updated"]`, which matches.

- [ ] **Step 4: Type-check**

```bash
npm run lint
```

Expected: pass. (TypeScript will surface anywhere a stale `"stock"` reference still types as `OptionalColumnKey` — there shouldn't be any after this step, but `column-visibility-toggle.tsx` consumes the popover map and is the most likely surface.)

- [ ] **Step 5: Commit**

```bash
git add src/domains/product/constants.ts src/domains/product/presets.ts
git commit -m "refactor(products): drop stock from optional column constants and preset prefs"
```

---

## Task 3: Promote Stock — table layer

**Files:**
- Modify: `src/components/products/product-table.tsx`

- [ ] **Step 1: Add a hard-coded sortable Stock header**

In `src/components/products/product-table.tsx`, the Last Sale header sits at line 142. Immediately after it (before the optional column conditionals at line 143), add the permanent Stock header:

```tsx
<SortHeader
  field="stock_on_hand"
  label="Stock"
  sortBy={sortBy}
  sortDir={sortDir}
  onSort={onSort}
  className="text-right"
/>
```

- [ ] **Step 2: Remove the now-redundant optional Stock header block**

Delete the conditional Stock header block at lines 143–145:

```tsx
{visibleColumns?.includes("stock") && (
  <TableHead className="text-right">Stock</TableHead>
)}
```

- [ ] **Step 3: Add a hard-coded Stock cell to every row**

In the body, the Last Sale cell ends at line 230. Immediately after it (before the optional cell conditionals at line 231), add:

```tsx
<TableCell className="text-right tabular-nums">
  {product.stock_on_hand ?? "—"}
</TableCell>
```

- [ ] **Step 4: Remove the now-redundant optional Stock cell block**

Delete lines 231–235:

```tsx
{visibleColumns?.includes("stock") && (
  <TableCell className="text-right tabular-nums">
    {product.stock_on_hand ?? "—"}
  </TableCell>
)}
```

- [ ] **Step 5: Update the skeleton column count**

Find the skeleton row generator near line 167. The original was `(tab === "textbooks" ? 10 : 10) + extraCols`. Stock is now permanent, so bump the constant by 1:

```tsx
{Array.from({ length: (tab === "textbooks" ? 11 : 11) + extraCols }).map((_, j) => (
```

- [ ] **Step 6: Run dev and load the page**

```bash
npm run dev
```

Then in the browser open `http://localhost:3000/products`. Verify Stock column appears between Last Sale and any optional measure columns, on both Textbooks and General Merchandise tabs.

(Once verified, stop the dev server with Ctrl+C.)

- [ ] **Step 7: Commit**

```bash
git add src/components/products/product-table.tsx
git commit -m "feat(products): make Stock a permanent sortable column"
```

---

## Task 4: Additive preset columns

**Files:**
- Modify: `src/app/products/page.tsx:113-119`

- [ ] **Step 1: Update `handlePresetClick` to merge instead of replace**

In `src/app/products/page.tsx`, replace `handlePresetClick`:

```ts
function handlePresetClick(view: SavedView) {
  const { filters: next, visibleColumns } = applyPreset(view, filters);
  const merged = visibleColumns
    ? Array.from(new Set([...baseColumns, ...visibleColumns]))
    : null;
  const withPage = { ...next, page: 1 } as ProductFilters;
  setActiveView(view);
  setRuntimeColumns(merged);
  updateFilters(withPage, { view: view.slug ?? view.id });
}
```

- [ ] **Step 2: Manual smoke**

```bash
npm run dev
```

In the browser:
1. Open `/products`. In the Columns picker, toggle on `Margin %` and `Receipts 1y`.
2. Click the "Top sellers (units) last year" preset (under 📊 Movers).
3. Verify Margin % and Receipts 1y are still visible alongside Units 1y and Revenue 1y (the preset's contributions).

Stop the dev server.

- [ ] **Step 3: Commit**

```bash
git add src/app/products/page.tsx
git commit -m "feat(products): preset columns add to user defaults instead of replacing"
```

---

## Task 5: Extend sort whitelist + types

**Files:**
- Modify: `src/domains/product/types.ts:111`
- Modify: `src/domains/product/queries.ts:8-12`

- [ ] **Step 1: Widen the `ProductSortField` union**

In `src/domains/product/types.ts`, replace line 111:

```ts
export type ProductSortField =
  | "sku" | "description" | "title" | "author"
  | "retail_price" | "cost"
  | "last_sale_date" | "barcode" | "catalog_number" | "product_type"
  | "vendor_id" | "isbn" | "edition"
  | "stock_on_hand"
  | "units_sold_30d" | "units_sold_1y" | "units_sold_lifetime"
  | "revenue_30d" | "revenue_1y"
  | "txns_1y"
  | "updated_at"
  | "dept_num";
```

- [ ] **Step 2: Extend the runtime whitelist**

In `src/domains/product/queries.ts`, replace lines 8–12:

```ts
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
```

- [ ] **Step 3: Lint + type-check**

```bash
npm run lint
```

Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add src/domains/product/types.ts src/domains/product/queries.ts
git commit -m "feat(products): widen sort whitelist for stock, sales, and metadata columns"
```

---

## Task 6: SortHeader on every column

**Files:**
- Modify: `src/components/products/product-table.tsx`

- [ ] **Step 1: Wrap the merch-tab Barcode header in SortHeader**

Find the merch branch (line 134 in the post-Task-3 file). Replace `<TableHead>Barcode</TableHead>` with:

```tsx
<SortHeader field="barcode" label="Barcode" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
```

(The textbook-tab Barcode header at the equivalent line should get the same treatment.)

- [ ] **Step 2: Replace each optional `<TableHead>` with a SortHeader**

For every optional column header in the post-Task-3 file, swap the plain `<TableHead>label</TableHead>` for a `SortHeader`. Field mappings:

```tsx
{visibleColumns?.includes("dcc") && (
  <SortHeader field="dept_num" label="DCC" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
)}
{visibleColumns?.includes("units_1y") && (
  <SortHeader field="units_sold_1y" label="Units 1y" sortBy={sortBy} sortDir={sortDir} onSort={onSort} className="text-right" />
)}
{visibleColumns?.includes("revenue_1y") && (
  <SortHeader field="revenue_1y" label="Revenue 1y" sortBy={sortBy} sortDir={sortDir} onSort={onSort} className="text-right" />
)}
{visibleColumns?.includes("txns_1y") && (
  <SortHeader field="txns_1y" label="Receipts 1y" sortBy={sortBy} sortDir={sortDir} onSort={onSort} className="text-right" />
)}
{visibleColumns?.includes("margin") && (
  <SortHeader field="margin" label="Margin %" sortBy={sortBy} sortDir={sortDir} onSort={onSort} className="text-right" />
)}
{visibleColumns?.includes("days_since_sale") && (
  <SortHeader field="days_since_sale" label="Days since sale" sortBy={sortBy} sortDir={sortDir} onSort={onSort} className="text-right" />
)}
{visibleColumns?.includes("updated") && (
  <SortHeader field="updated_at" label="Updated" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
)}
```

(`field="margin"` and `field="days_since_sale"` are *not* in the server whitelist — they are handled in Tasks 7 + 8 below.)

- [ ] **Step 3: Add `days_since_sale` translation in queries.ts**

In `src/domains/product/queries.ts`, just before the existing `// Sorting` block at line 241, insert a translation step:

```ts
// "days_since_sale" is a presentation alias for last_sale_date with inverted direction:
// more days = older = ascending in days = descending in date.
let effectiveSortBy = filters.sortBy;
let effectiveAscending = filters.sortDir !== "desc";
if (filters.sortBy === "days_since_sale") {
  effectiveSortBy = "last_sale_date";
  effectiveAscending = !effectiveAscending;
}
```

Then update the existing sort line to use these:

```ts
const sortField = ALLOWED_SORT_FIELDS.has(effectiveSortBy) ? effectiveSortBy : "sku";
query = query.order(sortField, { ascending: effectiveAscending, nullsFirst: false }).range(from, to);
```

- [ ] **Step 4: Smoke test**

```bash
npm run dev
```

In the browser, click each header and confirm the arrow flips and the data reorders. Test Stock, Last Sale, DCC, Units 1y, Revenue 1y, Receipts 1y, Days since sale, Updated. (Margin is intentionally still broken — Task 7 fixes it.)

Stop the dev server.

- [ ] **Step 5: Commit**

```bash
git add src/components/products/product-table.tsx src/domains/product/queries.ts
git commit -m "feat(products): sortable headers for every column except margin"
```

---

## Task 7: Client-side margin sort

**Files:**
- Modify: `src/domains/product/queries.ts` (after fetch, before return)
- Modify: `src/components/products/product-table.tsx` (Margin SortHeader hint)

- [ ] **Step 1: Apply margin sort after fetch**

In `src/domains/product/queries.ts`, just before the `return { products, total, …}` block at the bottom of `searchProducts`, add:

```ts
if (filters.sortBy === "margin") {
  const dir = filters.sortDir === "desc" ? -1 : 1;
  products = [...products].sort((a, b) => {
    const ma = a.retail_price > 0 ? (a.retail_price - a.cost) / a.retail_price : -Infinity;
    const mb = b.retail_price > 0 ? (b.retail_price - b.cost) / b.retail_price : -Infinity;
    return (ma - mb) * dir;
  });
}
```

(Document inline that this is page-local — server-side sort isn't possible without a generated column.)

- [ ] **Step 2: Add a "(page)" hint when margin is the active sort**

In `product-table.tsx`, the Margin SortHeader from Task 6 becomes:

```tsx
{visibleColumns?.includes("margin") && (
  <SortHeader
    field="margin"
    label={sortBy === "margin" ? "Margin % (page)" : "Margin %"}
    sortBy={sortBy}
    sortDir={sortDir}
    onSort={onSort}
    className="text-right"
  />
)}
```

- [ ] **Step 3: Smoke test**

```bash
npm run dev
```

Toggle Margin % on, click the header, confirm rows on the current page reorder by margin and the header shows "Margin % (page)".

Stop the dev server.

- [ ] **Step 4: Commit**

```bash
git add src/domains/product/queries.ts src/components/products/product-table.tsx
git commit -m "feat(products): client-side margin sort within the current page"
```

---

## Task 8: Hide-from-header X + rename picker trigger

**Files:**
- Modify: `src/components/products/column-visibility-toggle.tsx`
- Modify: `src/components/products/product-table.tsx`
- Modify: `src/app/products/page.tsx`

- [ ] **Step 1: Expose `hideColumn` from the toggle**

Refactor `src/components/products/column-visibility-toggle.tsx` so the component owns the persisted `base` array AND publishes a `hideColumn` callback. Replace the existing component with:

```tsx
"use client";

import { useEffect, useImperativeHandle, useState, forwardRef } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { COLUMN_LABELS, COLUMN_PREFS_STORAGE_KEY, DEFAULT_COLUMN_SET, OPTIONAL_COLUMNS } from "@/domains/product/constants";
import type { OptionalColumnKey } from "@/domains/product/constants";

export interface ColumnVisibilityHandle {
  hideColumn: (key: OptionalColumnKey) => void;
}

interface Props {
  runtimeOverride: OptionalColumnKey[] | null;
  onUserChange: (visible: OptionalColumnKey[]) => void;
  onResetRuntime: () => void;
}

export const ColumnVisibilityToggle = forwardRef<ColumnVisibilityHandle, Props>(
  function ColumnVisibilityToggle({ runtimeOverride, onUserChange, onResetRuntime }, ref) {
    const [base, setBase] = useState<OptionalColumnKey[]>(() => {
      if (typeof window === "undefined") return DEFAULT_COLUMN_SET;
      try {
        const raw = window.localStorage.getItem(COLUMN_PREFS_STORAGE_KEY);
        if (!raw) return DEFAULT_COLUMN_SET;
        const parsed = JSON.parse(raw) as { visible?: string[] };
        if (!parsed?.visible) return DEFAULT_COLUMN_SET;
        return parsed.visible.filter((k): k is OptionalColumnKey =>
          (OPTIONAL_COLUMNS as readonly string[]).includes(k),
        );
      } catch {
        return DEFAULT_COLUMN_SET;
      }
    });

    useEffect(() => {
      if (typeof window === "undefined") return;
      window.localStorage.setItem(COLUMN_PREFS_STORAGE_KEY, JSON.stringify({ visible: base }));
      onUserChange(base);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [base]);

    const active = runtimeOverride ?? base;

    function toggle(key: OptionalColumnKey) {
      const next = active.includes(key) ? active.filter((k) => k !== key) : [...active, key];
      if (runtimeOverride) {
        setBase(next);
        onResetRuntime();
      } else {
        setBase(next);
      }
    }

    useImperativeHandle(ref, () => ({
      hideColumn(key: OptionalColumnKey) {
        const next = active.filter((k) => k !== key);
        setBase(next);
        if (runtimeOverride) onResetRuntime();
      },
    }), [active, runtimeOverride, onResetRuntime]);

    return (
      <Popover>
        <PopoverTrigger
          render={
            <Button variant="outline" size="sm">
              + Add column
            </Button>
          }
        />
        <PopoverContent align="end" className="w-56 p-2">
          <ul className="space-y-1">
            {OPTIONAL_COLUMNS.map((key) => (
              <li key={key} className="flex items-center gap-2">
                <input
                  id={`col-${key}`}
                  type="checkbox"
                  checked={active.includes(key)}
                  onChange={() => toggle(key)}
                  className="h-4 w-4"
                />
                <label htmlFor={`col-${key}`} className="text-sm cursor-pointer">
                  {COLUMN_LABELS[key]}
                </label>
              </li>
            ))}
          </ul>
          {runtimeOverride && (
            <Button size="sm" variant="ghost" className="mt-2 w-full" onClick={onResetRuntime}>
              Reset to my default
            </Button>
          )}
        </PopoverContent>
      </Popover>
    );
  },
);
```

- [ ] **Step 2: Wire a ref through `page.tsx` and pass `onHideColumn` to the table**

In `src/app/products/page.tsx`:

Add the ref import + ref:

```tsx
import { useRef } from "react";
import { ColumnVisibilityToggle, type ColumnVisibilityHandle } from "@/components/products/column-visibility-toggle";
// ...
const columnsRef = useRef<ColumnVisibilityHandle>(null);
```

Update the `<ColumnVisibilityToggle>` usage to pass the ref:

```tsx
<ColumnVisibilityToggle
  ref={columnsRef}
  runtimeOverride={runtimeColumns}
  onUserChange={setBaseColumns}
  onResetRuntime={() => setRuntimeColumns(null)}
/>
```

Pass a hide callback to `<ProductTable>`:

```tsx
<ProductTable
  // ...existing props
  onHideColumn={(key) => columnsRef.current?.hideColumn(key)}
/>
```

- [ ] **Step 3: Add the X button to optional headers in `product-table.tsx`**

Add `onHideColumn?: (key: OptionalColumnKey) => void;` to `ProductTableProps` and destructure it.

Define a helper component above `ProductTable`:

```tsx
function OptionalSortHeader(props: {
  field: string;
  label: string;
  columnKey: OptionalColumnKey;
  sortBy: string;
  sortDir: "asc" | "desc";
  onSort: (field: string) => void;
  onHide?: (key: OptionalColumnKey) => void;
  className?: string;
}) {
  const { field, label, columnKey, sortBy, sortDir, onSort, onHide, className } = props;
  const isActive = sortBy === field;
  return (
    <TableHead className={className}>
      <div className="group inline-flex items-center gap-1">
        <button
          className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
          onClick={() => onSort(field)}
        >
          {label}
          {isActive ? (
            sortDir === "asc" ? <ArrowUpIcon className="size-3" /> : <ArrowDownIcon className="size-3" />
          ) : (
            <ArrowUpDownIcon className="size-3 opacity-30" />
          )}
        </button>
        {onHide && (
          <button
            type="button"
            aria-label={`Hide ${label}`}
            className="ml-1 opacity-0 group-hover:opacity-60 hover:opacity-100 transition-opacity"
            onClick={(e) => { e.stopPropagation(); onHide(columnKey); }}
          >
            <XIcon className="size-3" />
          </button>
        )}
      </div>
    </TableHead>
  );
}
```

Add `XIcon` to the lucide import at the top:

```tsx
import { ArrowDownIcon, ArrowUpIcon, ArrowUpDownIcon, SearchIcon, XIcon } from "lucide-react";
```

Replace each optional `SortHeader` from Task 6 with `OptionalSortHeader`, adding `columnKey` and `onHide={onHideColumn}`:

```tsx
{visibleColumns?.includes("dcc") && (
  <OptionalSortHeader field="dept_num" columnKey="dcc" label="DCC" sortBy={sortBy} sortDir={sortDir} onSort={onSort} onHide={onHideColumn} />
)}
{visibleColumns?.includes("units_1y") && (
  <OptionalSortHeader field="units_sold_1y" columnKey="units_1y" label="Units 1y" sortBy={sortBy} sortDir={sortDir} onSort={onSort} onHide={onHideColumn} className="text-right" />
)}
// ...repeat for revenue_1y, txns_1y, margin, days_since_sale, updated
```

(Permanent headers stay as `SortHeader`; only the optional ones become `OptionalSortHeader`.)

- [ ] **Step 4: Smoke test**

```bash
npm run dev
```

Toggle some optional columns on, hover the headers, click the X, verify the column disappears, the popover reopens with that column unchecked, and clicking it brings the column back.

Stop the dev server.

- [ ] **Step 5: Commit**

```bash
git add src/components/products/column-visibility-toggle.tsx src/components/products/product-table.tsx src/app/products/page.tsx
git commit -m "feat(products): hide-from-header X plus '+ Add column' picker rename"
```

---

## Task 9: Full-bleed page width

**Files:**
- Modify: `src/app/products/page.tsx:129`

- [ ] **Step 1: Drop `max-w-7xl mx-auto`**

In `src/app/products/page.tsx`, change line 129:

```tsx
<div className="px-4 py-6">
```

(was `<div className="mx-auto max-w-7xl px-4 py-6">`)

- [ ] **Step 2: Smoke test**

```bash
npm run dev
```

Open `/products` in a wide browser window. Confirm the table fills the viewport.

Stop the dev server.

- [ ] **Step 3: Commit**

```bash
git add src/app/products/page.tsx
git commit -m "feat(products): full-bleed page width for catalog"
```

---

## Task 10: Priority-tier responsive hiding

**Files:**
- Create: `src/components/products/product-table.css`
- Modify: `src/components/products/product-table.tsx`

- [ ] **Step 1: Create the CSS file**

Create `src/components/products/product-table.css`:

```css
.product-table-wrap {
  container-type: inline-size;
}

@container (max-width: 1280px) {
  .product-table th[data-priority="low"],
  .product-table td[data-priority="low"] {
    display: none;
  }
}

@container (max-width: 1024px) {
  .product-table th[data-priority="medium"],
  .product-table td[data-priority="medium"] {
    display: none;
  }
}
```

- [ ] **Step 2: Import the CSS in the table component**

At the top of `src/components/products/product-table.tsx`:

```tsx
import "./product-table.css";
```

- [ ] **Step 3: Wrap the desktop table in the container element**

The desktop table currently lives inside `<div className="hidden md:block">`. Change it to:

```tsx
<div className="hidden md:block product-table-wrap">
  <Table className="product-table">
```

- [ ] **Step 4: Tag optional headers + cells with `data-priority`**

Priority assignments:

| Column | Priority |
|---|---|
| `units_1y` | high |
| `revenue_1y` | high |
| `margin` | medium |
| `txns_1y` | medium |
| `dcc` | medium |
| `days_since_sale` | low |
| `updated` | low |

For each optional column, add `data-priority="…"` to BOTH the header `<TableHead>` (inside `OptionalSortHeader` — pass through via a `priority` prop) AND the body `<TableCell>`.

Update `OptionalSortHeader` to accept and forward `priority`:

```tsx
function OptionalSortHeader(props: {
  field: string;
  label: string;
  columnKey: OptionalColumnKey;
  priority: "high" | "medium" | "low";
  // ...rest
}) {
  // ...
  return (
    <TableHead className={className} data-priority={priority}>
      {/* existing inner content */}
    </TableHead>
  );
}
```

For body cells, add `data-priority` to each optional `<TableCell>`. Example for the units_1y cell:

```tsx
{visibleColumns?.includes("units_1y") && (
  <TableCell className="text-right tabular-nums" data-priority="high">
    {product.units_sold_1y > 0 ? product.units_sold_1y.toLocaleString() : "—"}
  </TableCell>
)}
```

Apply the matching priority from the table above to every other optional cell.

- [ ] **Step 5: Smoke test at multiple widths**

```bash
npm run dev
```

In the browser, toggle on every optional column. Resize the window from wide to ~900px and confirm:
- At full width (1920px+): everything visible.
- Below ~1280px container width: Updated and Days-since-sale disappear.
- Below ~1024px container width: Margin %, Receipts 1y, DCC also disappear.
- Stock and Last Sale never disappear.

Stop the dev server.

- [ ] **Step 6: Commit**

```bash
git add src/components/products/product-table.css src/components/products/product-table.tsx
git commit -m "feat(products): priority-tier responsive column hiding via @container queries"
```

---

## Task 11: "N column hidden" pill

**Files:**
- Create: `src/components/products/use-hidden-columns.ts`
- Modify: `src/components/products/product-table.tsx` (expose hidden count via callback)
- Modify: `src/app/products/page.tsx` (render the pill in the toolbar)

- [ ] **Step 1: Create a width-aware hook that mirrors the CSS thresholds**

Create `src/components/products/use-hidden-columns.ts`:

```ts
"use client";

import { useEffect, useRef, useState } from "react";

const MED_BREAKPOINT = 1024;
const LOW_BREAKPOINT = 1280;

export interface HiddenSummary {
  count: number;
  tiers: Array<"medium" | "low">;
}

export function useHiddenColumns(): {
  ref: React.RefObject<HTMLDivElement>;
  summary: HiddenSummary;
} {
  const ref = useRef<HTMLDivElement>(null);
  const [summary, setSummary] = useState<HiddenSummary>({ count: 0, tiers: [] });

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0].contentRect.width;
      const tiers: Array<"medium" | "low"> = [];
      if (w < LOW_BREAKPOINT) tiers.push("low");
      if (w < MED_BREAKPOINT) tiers.push("medium");
      // count is computed by the table since it knows which optional columns are active
      setSummary((prev) => ({ ...prev, tiers }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return { ref, summary };
}
```

- [ ] **Step 2: In `product-table.tsx`, attach the ref and report active hidden count up**

Add prop `onHiddenChange?: (count: number) => void;` to `ProductTableProps` and import the hook.

In the component body:

```tsx
const { ref: wrapRef, summary } = useHiddenColumns();

useEffect(() => {
  if (!onHiddenChange) return;
  const optionalActive = visibleColumns ?? [];
  const PRIORITY: Record<OptionalColumnKey, "high" | "medium" | "low"> = {
    units_1y: "high", revenue_1y: "high",
    margin: "medium", txns_1y: "medium", dcc: "medium",
    days_since_sale: "low", updated: "low",
  };
  const hidden = optionalActive.filter((k) => summary.tiers.includes(PRIORITY[k] as "medium" | "low"));
  onHiddenChange(hidden.length);
}, [summary.tiers, visibleColumns, onHiddenChange]);
```

Attach the ref to the wrap div:

```tsx
<div ref={wrapRef} className="hidden md:block product-table-wrap">
```

- [ ] **Step 3: Render the pill in `page.tsx`**

Add state + pass-through:

```tsx
const [hiddenCount, setHiddenCount] = useState(0);
// ...inside the toolbar row, next to the ColumnVisibilityToggle:
{hiddenCount > 0 && (
  <span className="text-xs text-muted-foreground rounded-full bg-muted px-2 py-1">
    {hiddenCount} hidden — narrow window
  </span>
)}
// ...on <ProductTable>:
onHiddenChange={setHiddenCount}
```

- [ ] **Step 4: Smoke test**

```bash
npm run dev
```

Toggle several optional columns on, resize the window narrow, confirm the pill appears with the right count and disappears when the window widens again.

Stop the dev server.

- [ ] **Step 5: Commit**

```bash
git add src/components/products/use-hidden-columns.ts src/components/products/product-table.tsx src/app/products/page.tsx
git commit -m "feat(products): show 'N hidden' pill when responsive hiding is active"
```

---

## Task 12: Verify, ship-check, open PR

**Files:**
- None (verification + git only)

- [ ] **Step 1: Run the full test suite**

```bash
npm run test
```

Expected: green. If anything else broke, fix it before continuing.

- [ ] **Step 2: Run lint**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 3: Manual end-to-end smoke against `/products`**

```bash
npm run dev
```

Walk through this checklist in the browser:

- [ ] On Textbooks: click "Accelerating" — tab stays Textbooks, Units 1y appears alongside Stock and Last Sale.
- [ ] Switch to General Merchandise: click "Accelerating" — tab stays General Merchandise.
- [ ] Click "GM under $5" from Textbooks — tab switches to General Merchandise (preset explicitly named the tab).
- [ ] Toggle Margin % + Receipts 1y on. Click "Top sellers (units) last year" — Margin % and Receipts 1y stay; Units 1y, Revenue 1y added.
- [ ] Click each header — sort arrow flips, data reorders (Margin label says "(page)" when active).
- [ ] Hover an optional header, click the ×, confirm the column hides and the picker shows it unchecked.
- [ ] Click "+ Add column" → re-check the hidden column → it returns.
- [ ] Resize window narrow — low-priority columns drop without horizontal scroll. Permanent + high-priority stay.
- [ ] When narrow enough to hide columns, the "N hidden — narrow window" pill appears in the toolbar and updates as you resize.

Stop the dev server.

- [ ] **Step 4: Run ship-check**

```bash
npm run ship-check
```

Expected: green (lint + tests + build).

- [ ] **Step 5: Open the PR**

```bash
npm run git:publish-pr
```

PR title and body should reference the spec and call out the five fixes:

- preset reverts to textbooks
- stock-on-hand permanent column
- sort on every column
- hide-from-header + "+ Add column"
- full-bleed + priority-tier hiding

- [ ] **Step 6: Wait for CI + CodeRabbit, address review, merge**

Per project convention (`docs/GIT-WORKFLOW.md`): only push review fixes with `CR_FIX=1 git push`. Do not start the next feature until this PR is merged.

---

## Out of Scope (Deferred — see spec § Out of Scope)

- Two-line stacked cell layout
- Generated `margin_pct` column for true server-side margin sort
- Mobile redesign
- Per-tab column persistence
- Column reordering by drag
