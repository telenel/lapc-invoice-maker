# Item Editor Parity — Phase 7 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship keyboard-first inline row edits on the desktop products table for retail, cost, barcode, discontinue, and tax type.

**Architecture:** Keep the existing Phase 6 `v2` patch route as the only write path. Add a page-owned inline-edit controller plus compact table-cell editors so ProductTable can save one field at a time without opening the dialog. Retail and cost always write through the current primary location; barcode, discontinue, and tax type stay item-global.

**Tech Stack:** Next.js 14 client components, React state/hooks, TypeScript strict, existing `/api/products/[sku]` `v2` route, Vitest, Testing Library.

---

## File map

Files created:
- `docs/superpowers/specs/2026-04-20-item-editor-parity-phase-7-design.md`
- `docs/superpowers/plans/2026-04-20-item-editor-parity-phase-7.md`
- `src/components/products/use-product-inline-edit.ts`
- `src/__tests__/products-page-inline-edit.test.tsx`

Files modified:
- `src/app/products/page.tsx`
- `src/components/products/product-table.tsx`
- `src/domains/product/types.ts`
- `tests/components/products-product-table-helpers.test.ts`

Files read for reference:
- `docs/superpowers/specs/2026-04-19-item-editor-parity-design.md`
- `docs/superpowers/specs/2026-04-20-item-editor-parity-phase-7-design.md`
- `src/components/products/edit-item-dialog-v2.tsx`
- `src/components/ui/inline-combobox.tsx`
- `src/components/admin/hooks/use-inline-edit.ts`

---

## Task 1: Add the inline-edit controller and products-page wiring

**Files:**
- Create: `src/components/products/use-product-inline-edit.ts`
- Modify: `src/app/products/page.tsx`
- Create: `src/__tests__/products-page-inline-edit.test.tsx`

**Purpose:** Give the products page one focused place to manage editing state, build one-field `v2` patches, and refetch after saves.

- [ ] **Step 1: Write the failing products-page integration tests.**

Add tests that prove:

```ts
await user.click(screen.getByRole("button", { name: /edit retail for sku 1001/i }));
await user.type(screen.getByRole("textbox", { name: /retail editor for sku 1001/i }), "44.99{enter}");

expect(updateMock).toHaveBeenCalledWith(1001, {
  mode: "v2",
  patch: { primaryInventory: { retail: 44.99 } },
  baseline: expect.objectContaining({ sku: 1001 }),
});
```

and:

```ts
expect(refetchMock).toHaveBeenCalled();
```

- [ ] **Step 2: Run the focused test and confirm it fails.**

Run:

```bash
npm test -- src/__tests__/products-page-inline-edit.test.tsx
```

Expected: FAIL because the page does not expose any inline-edit controller props yet.

- [ ] **Step 3: Create the inline-edit controller.**

In `src/components/products/use-product-inline-edit.ts`, add a focused hook that owns:

- the currently editing cell
- the current draft value
- the pending save state
- helpers to start, cancel, commit, and move to the next editable cell

The hook should expose a narrow interface back to `page.tsx`, not raw route details.

- [ ] **Step 4: Wire the products page to the controller.**

In `src/app/products/page.tsx`:

- build the per-row baseline from the scoped search results
- pass `primaryLocationId`
- pass the controller output into `ProductTable`
- refetch after successful save

- [ ] **Step 5: Re-run the focused page integration test.**

Run:

```bash
npm test -- src/__tests__/products-page-inline-edit.test.tsx
```

Expected: PASS

- [ ] **Step 6: Commit the inline-edit controller seam.**

```bash
git add src/components/products/use-product-inline-edit.ts \
        src/app/products/page.tsx \
        src/__tests__/products-page-inline-edit.test.tsx
git commit -m "feat(products): add phase 7 inline edit controller"
```

---

## Task 2: Add inline retail, cost, and barcode cells without breaking row selection

**Files:**
- Modify: `src/components/products/product-table.tsx`
- Modify: `tests/components/products-product-table-helpers.test.ts`

**Purpose:** Turn the existing money and barcode cells into in-place editors while preserving the browse/select behavior around them.

- [ ] **Step 1: Write the failing table interaction tests.**

Add tests that prove:

```ts
await user.click(screen.getByRole("button", { name: /edit retail for sku 101/i }));
expect(onToggle).not.toHaveBeenCalled();
expect(screen.getByRole("textbox", { name: /retail editor for sku 101/i })).toBeTruthy();
```

and:

```ts
await user.keyboard("{Escape}");
expect(screen.queryByRole("textbox", { name: /retail editor for sku 101/i })).toBeNull();
```

- [ ] **Step 2: Run the focused table test and confirm it fails.**

Run:

```bash
npm test -- tests/components/products-product-table-helpers.test.ts
```

Expected: FAIL because the cells are static text today.

- [ ] **Step 3: Render inline editors for retail, cost, and barcode.**

In `src/components/products/product-table.tsx`:

- replace the static cell content with button-like resting surfaces
- swap to input editors when the controller marks the cell as active
- stop event propagation so cell clicks do not toggle row selection
- keep the variance badge popovers working for retail/cost

- [ ] **Step 4: Hook up keyboard and cancel behavior for text-like cells.**

Implement:

- `Enter` saves
- `Esc` cancels
- `Tab` / `Shift+Tab` defer to the shared controller navigation

- [ ] **Step 5: Re-run the focused table test.**

Run:

```bash
npm test -- tests/components/products-product-table-helpers.test.ts
```

Expected: PASS

- [ ] **Step 6: Commit the text-cell inline editors.**

```bash
git add src/components/products/product-table.tsx \
        tests/components/products-product-table-helpers.test.ts
git commit -m "feat(products): add inline retail cost and barcode edits"
```

---

## Task 3: Add inline tax-type and discontinue controls

**Files:**
- Modify: `src/components/products/product-table.tsx`
- Modify: `src/app/products/page.tsx`
- Modify: `tests/components/products-product-table-helpers.test.ts`
- Modify: `src/__tests__/products-page-inline-edit.test.tsx`

**Purpose:** Complete the Phase 7 field list with compact discrete controls for global item fields.

- [ ] **Step 1: Write the failing tests for tax type and discontinue.**

Add assertions that:

```ts
expect(screen.getByRole("columnheader", { name: /tax type/i })).toBeTruthy();
expect(screen.getByRole("columnheader", { name: /disc/i })).toBeTruthy();
```

and:

```ts
await user.click(screen.getByRole("button", { name: /toggle discontinue for sku 1001/i }));
expect(updateMock).toHaveBeenCalledWith(1001, {
  mode: "v2",
  patch: { item: { fDiscontinue: 1 } },
  baseline: expect.objectContaining({ sku: 1001 }),
});
```

- [ ] **Step 2: Run the focused tests and confirm they fail.**

Run:

```bash
npm test -- tests/components/products-product-table-helpers.test.ts src/__tests__/products-page-inline-edit.test.tsx
```

Expected: FAIL because neither column/control exists yet.

- [ ] **Step 3: Add the tax-type and discontinue columns.**

In `src/components/products/product-table.tsx`:

- add a compact `Tax Type` column that renders the current label
- add a compact `Disc` column with a clear live/discontinued control
- make tax type commit on selection
- make discontinue commit on toggle

In `src/app/products/page.tsx`:

- map the current row tax-type data into the controller props the table needs

- [ ] **Step 4: Re-run the focused tests.**

Run:

```bash
npm test -- tests/components/products-product-table-helpers.test.ts src/__tests__/products-page-inline-edit.test.tsx
```

Expected: PASS

- [ ] **Step 5: Commit the discrete inline controls.**

```bash
git add src/components/products/product-table.tsx \
        src/app/products/page.tsx \
        tests/components/products-product-table-helpers.test.ts \
        src/__tests__/products-page-inline-edit.test.tsx
git commit -m "feat(products): add inline tax type and discontinue edits"
```

---

## Task 4: Finish keyboard traversal and row-to-row navigation

**Files:**
- Modify: `src/components/products/use-product-inline-edit.ts`
- Modify: `src/components/products/product-table.tsx`
- Modify: `tests/components/products-product-table-helpers.test.ts`
- Modify: `src/__tests__/products-page-inline-edit.test.tsx`

**Purpose:** Make the inline surface actually faster than the modal by supporting commit-and-advance keyboard flow.

- [ ] **Step 1: Write the failing keyboard traversal tests.**

Add tests that prove:

```ts
await user.click(screen.getByRole("button", { name: /edit cost for sku 101/i }));
await user.type(screen.getByRole("textbox", { name: /cost editor for sku 101/i }), "10.25{tab}");

expect(updateMock).toHaveBeenCalledWith(101, expect.objectContaining({
  patch: { primaryInventory: { cost: 10.25 } },
}));
expect(screen.getByRole("textbox", { name: /retail editor for sku 101/i })).toHaveFocus();
```

and:

```ts
await user.keyboard("{Shift>}{Tab}{/Shift}");
expect(screen.getByRole("textbox", { name: /cost editor for sku 1002/i })).toHaveFocus();
```

- [ ] **Step 2: Run the focused keyboard tests and confirm they fail.**

Run:

```bash
npm test -- tests/components/products-product-table-helpers.test.ts src/__tests__/products-page-inline-edit.test.tsx
```

Expected: FAIL because there is no next/previous editable-cell model yet.

- [ ] **Step 3: Implement editable-cell ordering and traversal.**

In `src/components/products/use-product-inline-edit.ts`:

- define the editable-column order for Phase 7
- compute next/previous targets from the visible row order
- save current draft before moving
- exit edit mode cleanly at table boundaries

In `src/components/products/product-table.tsx`:

- make the active editor focus target stable
- let `Tab` / `Shift+Tab` delegate to the controller

- [ ] **Step 4: Re-run the focused keyboard tests.**

Run:

```bash
npm test -- tests/components/products-product-table-helpers.test.ts src/__tests__/products-page-inline-edit.test.tsx
```

Expected: PASS

- [ ] **Step 5: Commit the keyboard-first inline flow.**

```bash
git add src/components/products/use-product-inline-edit.ts \
        src/components/products/product-table.tsx \
        tests/components/products-product-table-helpers.test.ts \
        src/__tests__/products-page-inline-edit.test.tsx
git commit -m "feat(products): add phase 7 keyboard inline edits"
```

---

## Verification

After Task 4:

- [ ] Run the focused inline-edit suite

```bash
npm test -- src/__tests__/products-page-inline-edit.test.tsx tests/components/products-product-table-helpers.test.ts
```

Expected: PASS

- [ ] Run the broader products regression set

```bash
npm test -- src/__tests__/products-page-edit-dialog-mode.test.tsx src/__tests__/products-page-location-picker.test.tsx src/__tests__/products-page-inline-edit.test.tsx tests/components/products-product-table-helpers.test.ts src/components/products/edit-item-dialog-v2.test.tsx tests/components/edit-item-dialog.test.tsx tests/app/api/product-patch-route-v2.test.ts
```

Expected: PASS

- [ ] Run formatting / type hygiene

```bash
git diff --check
npx prisma generate
```

Expected: no output from `git diff --check`; Prisma client generates successfully

- [ ] Run ship gate

```bash
bash ./scripts/ship-check.sh
```

Expected: PASS
