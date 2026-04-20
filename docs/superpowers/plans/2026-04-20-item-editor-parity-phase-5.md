# Item Editor Parity — Phase 5 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the multi-location inventory tab for the `v2` item editor, backed by a typed per-location inventory patch path and Supabase detail hydration for `PIER`, `PCOP`, and `PFS`.

**Architecture:** Extend the existing Phase 4 `v2` single-item path instead of inventing a second editor. The page remains the owner of top-level location scope, the detail route grows to return `inventoryByLocation`, and the route/updater contract grows from Pierce-only `primaryInventory` into a real `inventory[]` patch list while keeping Phase 4 compatibility.

**Tech Stack:** Next.js 14 route handlers, React client components, TypeScript strict, Supabase admin reads/writes, Prism SQL transactional writes, Vitest, Testing Library.

---

## File map

Files created:
- `docs/superpowers/specs/2026-04-20-item-editor-parity-phase-5-design.md`
- `tests/app/api/product-detail-route.test.ts` (extended for Phase 5 detail assertions)
- `tests/app/api/product-patch-route-v2.test.ts` (extended for Phase 5 inventory assertions)

Files modified:
- `docs/superpowers/plans/2026-04-20-item-editor-parity-phase-5.md`
- `src/app/products/page.tsx`
- `src/components/products/edit-item-dialog.tsx`
- `src/components/products/edit-item-dialog-v2.tsx`
- `src/components/products/item-ref-selects.tsx`
- `src/domains/product/api-client.ts`
- `src/domains/product/location-filters.ts`
- `src/domains/product/prism-updates.ts`
- `src/domains/product/types.ts`
- `src/app/api/products/[sku]/route.ts`
- `src/components/products/edit-item-dialog-v2.test.tsx`
- `src/__tests__/products-page-edit-dialog-mode.test.tsx`

Files read for reference:
- `docs/superpowers/specs/2026-04-19-item-editor-parity-design.md`
- `docs/superpowers/specs/2026-04-20-item-editor-parity-phase-4-design.md`
- `prisma/migrations/20260419180000_product_inventory_table/migration.sql`
- `src/domains/product/prism-sync.ts`

---

## Task 1: Extend single-item detail hydration to include all Pierce inventory slices

**Files:**
- Modify: `src/domains/product/types.ts`
- Modify: `src/app/api/products/[sku]/route.ts`
- Test: `tests/app/api/product-detail-route.test.ts`

**Purpose:** Give the dialog a canonical, Supabase-backed inventory view for `PIER`, `PCOP`, and `PFS`.

- [ ] **Step 1: Write the failing detail-route assertions for Phase 5 inventory hydration.**

Add a new test in `tests/app/api/product-detail-route.test.ts` that mocks one `products` row plus three `product_inventory` rows and expects:

```ts
expect(body.inventoryByLocation).toEqual([
  expect.objectContaining({ locationId: 2, locationAbbrev: "PIER", retail: 12.99, tagTypeId: 17 }),
  expect.objectContaining({ locationId: 3, locationAbbrev: "PCOP", retail: 13.49, tagTypeId: 18 }),
  expect.objectContaining({ locationId: 4, locationAbbrev: "PFS", retail: null, tagTypeId: null }),
]);
```

- [ ] **Step 2: Run the focused detail-route test and confirm it fails on the missing `inventoryByLocation` contract.**

Run:

```bash
npm test -- tests/app/api/product-detail-route.test.ts
```

Expected: FAIL because the current response shape has no `inventoryByLocation`.

- [ ] **Step 3: Add the Phase 5 detail types.**

In `src/domains/product/types.ts`, add:

```ts
export interface ProductInventoryEditDetails {
  locationId: ProductLocationId;
  locationAbbrev: ProductLocationAbbrev;
  retail: number | null;
  cost: number | null;
  expectedCost: number | null;
  stockOnHand: number | null;
  lastSaleDate: string | null;
  tagTypeId: number | null;
  statusCodeId: number | null;
  estSales: number | null;
  estSalesLocked: boolean;
  fInvListPriceFlag: boolean;
  fTxWantListFlag: boolean;
  fTxBuybackListFlag: boolean;
  fNoReturns: boolean;
}
```

And extend `ProductEditDetails` with:

```ts
inventoryByLocation: ProductInventoryEditDetails[];
```

- [ ] **Step 4: Teach the detail route to load `product_inventory` rows in canonical order.**

Update `src/app/api/products/[sku]/route.ts` so `GET`:
- still loads global fields from `products`
- additionally selects `product_inventory` rows with `location_id IN (2, 3, 4)`
- returns canonical `inventoryByLocation` entries for all three locations

Use a helper that fills missing rows with null-valued slices so the client always gets `PIER`, `PCOP`, `PFS` in order.

- [ ] **Step 5: Re-run the focused detail-route test.**

Run:

```bash
npm test -- tests/app/api/product-detail-route.test.ts
```

Expected: PASS

- [ ] **Step 6: Commit the detail hydration seam.**

```bash
git add src/domains/product/types.ts \
        src/app/api/products/[sku]/route.ts \
        tests/app/api/product-detail-route.test.ts
git commit -m "feat(products): hydrate phase 5 inventory detail slices"
```

---

## Task 2: Expand the v2 PATCH contract into real per-location inventory writes

**Files:**
- Modify: `src/domains/product/types.ts`
- Modify: `src/app/api/products/[sku]/route.ts`
- Modify: `src/domains/product/prism-updates.ts`
- Test: `tests/app/api/product-patch-route-v2.test.ts`

**Purpose:** Replace the Pierce-only `primaryInventory` abstraction with a typed location-aware contract while preserving backward compatibility.

- [ ] **Step 1: Write the failing route tests for multi-location inventory payloads.**

Extend `tests/app/api/product-patch-route-v2.test.ts` with two new cases:

1. Accepts:

```ts
patch: {
  inventory: [
    { locationId: 3, retail: 14.25, cost: 7.5, tagTypeId: 17, statusCodeId: 3 },
    { locationId: 4, retail: 15.0, cost: 8.0 },
  ],
}
```

and dispatches those exact locations to the updater.

2. Rejects:

```ts
patch: {
  inventory: [
    { locationId: 5, retail: 14.25 },
  ],
}
```

with `400`.

- [ ] **Step 2: Run the focused PATCH-route test and confirm it fails on the unknown `inventory` field.**

Run:

```bash
npm test -- tests/app/api/product-patch-route-v2.test.ts
```

Expected: FAIL because `inventory` is not part of the current schema.

- [ ] **Step 3: Add typed per-location inventory patches.**

In `src/domains/product/types.ts`, add:

```ts
export interface InventoryPatchPerLocation {
  locationId: ProductLocationId;
  retail?: number;
  cost?: number;
  expectedCost?: number;
  tagTypeId?: number;
  statusCodeId?: number;
  estSales?: number;
  estSalesLocked?: boolean;
  fInvListPriceFlag?: boolean;
  fTxWantListFlag?: boolean;
  fTxBuybackListFlag?: boolean;
  fNoReturns?: boolean;
}
```

Then extend:

```ts
export interface ProductEditPatchV2 {
  item?: ItemPatch;
  gm?: GmDetailsPatch;
  primaryInventory?: PrimaryInventoryPatch;
  inventory?: InventoryPatchPerLocation[];
}
```

- [ ] **Step 4: Update the route schema and normalization logic.**

In `src/app/api/products/[sku]/route.ts`:
- add `inventory` to the `v2` schema
- reject invalid locations and duplicate `locationId` entries
- normalize `primaryInventory` into a single Pierce entry only when `inventory` is absent

- [ ] **Step 5: Update Prism write routing to respect per-location inventory patches.**

In `src/domains/product/prism-updates.ts`:
- add a location-aware inventory bucket
- update the SQL writer so each inventory patch entry targets its own `LocationID`
- keep item/gm writes unchanged

Mirror rule:
- if `locationId === 2`, continue syncing `products.retail_price` / `products.cost`
- always mirror touched inventory rows into `product_inventory`

- [ ] **Step 6: Re-run the focused PATCH-route test.**

Run:

```bash
npm test -- tests/app/api/product-patch-route-v2.test.ts
```

Expected: PASS

- [ ] **Step 7: Commit the multi-location write contract.**

```bash
git add src/domains/product/types.ts \
        src/app/api/products/[sku]/route.ts \
        src/domains/product/prism-updates.ts \
        tests/app/api/product-patch-route-v2.test.ts
git commit -m "feat(products): add phase 5 inventory patch routing"
```

---

## Task 3: Add inventory-tab UI primitives and location-scoped form state

**Files:**
- Modify: `src/components/products/edit-item-dialog-v2.tsx`
- Modify: `src/components/products/item-ref-selects.tsx`
- Test: `src/components/products/edit-item-dialog-v2.test.tsx`

**Purpose:** Give the `v2` dialog a real per-location inventory editing surface without touching textbooks or bulk-edit scope.

- [ ] **Step 1: Write the failing component tests for the Inventory tab.**

Extend `src/components/products/edit-item-dialog-v2.test.tsx` with cases that assert:

1. single-item GM renders an `Inventory` tab
2. clicking `PCOP` reveals the PCOP retail/cost values
3. clicking `Copy retail to other locations` copies the active retail value into `PIER` and `PFS`

- [ ] **Step 2: Run the focused component test and confirm it fails because the tab and controls do not exist yet.**

Run:

```bash
npm test -- src/components/products/edit-item-dialog-v2.test.tsx
```

Expected: FAIL because `Inventory` is not rendered.

- [ ] **Step 3: Expand the ref select primitives for inventory families.**

In `src/components/products/item-ref-selects.tsx`, extend `ItemRefSelectField` support to include:

```ts
type ItemRefSelectKind =
  | "vendor"
  | "dcc"
  | "taxType"
  | "packageType"
  | "color"
  | "tagType"
  | "statusCode";
```

Wire `tagTypes` and `statusCodes` to `buildProductRefSelectOptions(refs)`.

- [ ] **Step 4: Add location-keyed inventory form state to the dialog.**

In `src/components/products/edit-item-dialog-v2.tsx`:
- keep the current item/global form state
- add a keyed inventory state structure for `2`, `3`, and `4`
- track the active inventory location separately

The inventory state should hold:
- retail
- cost
- expectedCost
- tagTypeId
- statusCodeId
- estSales
- estSalesLocked
- fInvListPriceFlag
- fTxWantListFlag
- fTxBuybackListFlag
- fNoReturns

- [ ] **Step 5: Render the Inventory tab for eligible single-item dialogs only.**

Add:
- an `Inventory` tab trigger
- a three-button location switcher
- read-only stock / last sale
- editable fields listed in the Phase 5 spec
- copy buttons for retail, cost, tag type, and status code

Do **not** render the inventory tab in bulk mode.

- [ ] **Step 6: Re-run the focused component test.**

Run:

```bash
npm test -- src/components/products/edit-item-dialog-v2.test.tsx
```

Expected: PASS

- [ ] **Step 7: Commit the inventory-tab UI primitives.**

```bash
git add src/components/products/edit-item-dialog-v2.tsx \
        src/components/products/item-ref-selects.tsx \
        src/components/products/edit-item-dialog-v2.test.tsx
git commit -m "feat(products): add phase 5 inventory tab UI"
```

---

## Task 4: Wire page location scope into the dialog and save multi-location inventory edits

**Files:**
- Modify: `src/app/products/page.tsx`
- Modify: `src/components/products/edit-item-dialog.tsx`
- Modify: `src/components/products/edit-item-dialog-v2.tsx`
- Modify: `src/domains/product/api-client.ts`
- Modify: `src/domains/product/location-filters.ts`
- Test: `src/__tests__/products-page-edit-dialog-mode.test.tsx`

**Purpose:** Make `Primary` retail/cost respect the page's current primary location and ensure single-item save sends the correct multi-location payload.

- [ ] **Step 1: Write the failing page/dialog integration test for primary-location scope.**

Extend `src/__tests__/products-page-edit-dialog-mode.test.tsx` to assert that when the page is opened with `loc=3,4`, the dialog receives `primaryLocationId=3` and the single-item `v2` save still triggers `refetch()`.

- [ ] **Step 2: Run the focused page integration test and confirm it fails because the dialog does not receive location scope yet.**

Run:

```bash
npm test -- src/__tests__/products-page-edit-dialog-mode.test.tsx
```

Expected: FAIL on missing location-scope plumbing.

- [ ] **Step 3: Pass canonical location scope from the page into the dialog.**

In `src/app/products/page.tsx`:
- derive `primaryLocationId` from `filters.locationIds`
- pass `locationIds` and `primaryLocationId` into `EditItemDialog`

Use the existing canonical helpers from `src/domains/product/location-filters.ts`.

- [ ] **Step 4: Teach the dialog wrapper and v2 component to use that scope.**

In `src/components/products/edit-item-dialog.tsx` and `src/components/products/edit-item-dialog-v2.tsx`:
- surface the primary-location note
- make `Primary` retail/cost read/write the active primary location slice for single-item `v2`
- keep bulk mode on the existing sparse-edit flow

- [ ] **Step 5: Build the final single-item `v2` payload from changed item/global fields plus changed inventory slices.**

`handleSave()` should:
- collect changed location slices into `patch.inventory`
- keep item/gm writes in their existing buckets
- only include locations that actually changed

- [ ] **Step 6: Re-run the focused page/dialog integration test.**

Run:

```bash
npm test -- src/__tests__/products-page-edit-dialog-mode.test.tsx
```

Expected: PASS

- [ ] **Step 7: Commit the location-scoped save wiring.**

```bash
git add src/app/products/page.tsx \
        src/components/products/edit-item-dialog.tsx \
        src/components/products/edit-item-dialog-v2.tsx \
        src/domains/product/api-client.ts \
        src/domains/product/location-filters.ts \
        src/__tests__/products-page-edit-dialog-mode.test.tsx
git commit -m "feat(products): wire phase 5 location-scoped inventory saves"
```

---

## Task 5: Run Phase 5 validation and ship it

**Files:**
- Review all Task 1–4 changes
- Restore any incidental snapshot drift before validation if present

**Purpose:** Confirm the phase is production-ready, then publish it.

- [ ] **Step 1: Run the focused Phase 5 suites together.**

Run:

```bash
npm test -- tests/app/api/product-detail-route.test.ts \
           tests/app/api/product-patch-route-v2.test.ts \
           src/components/products/edit-item-dialog-v2.test.tsx \
           src/__tests__/products-page-edit-dialog-mode.test.tsx
```

Expected: PASS

- [ ] **Step 2: Run ship-check with the repo env loaded.**

Run:

```bash
set -a && source /Users/montalvo/lapc-invoice-maker/.env && \
source /Users/montalvo/lapc-invoice-maker/.env.local && \
set +a && bash ./scripts/ship-check.sh
```

Expected: PASS (`next lint`, full Vitest, `next build`)

- [ ] **Step 3: Commit any final test or polish fixes if needed.**

If ship-check required follow-up edits:

```bash
git add <relevant-files>
git commit -m "fix(products): close phase 5 validation findings"
```

- [ ] **Step 4: Push the branch.**

```bash
git push -u origin feat/item-editor-parity-phase-5
```

- [ ] **Step 5: Open the PR.**

```bash
gh pr create \
  --base main \
  --head feat/item-editor-parity-phase-5 \
  --title "feat(products): add phase 5 multi-location inventory editor" \
  --body "## Summary\n- add the phase 5 inventory tab for single-item v2 edits\n- route inventory writes per location through the typed v2 contract\n- hydrate all Pierce inventory slices for the editor\n\n## Testing\n- npm test -- tests/app/api/product-detail-route.test.ts tests/app/api/product-patch-route-v2.test.ts src/components/products/edit-item-dialog-v2.test.tsx src/__tests__/products-page-edit-dialog-mode.test.tsx\n- bash ./scripts/ship-check.sh"
```

- [ ] **Step 6: Merge, deploy, and verify production.**

After CI is green:

```bash
gh pr merge --squash --delete-branch
gh run watch --workflow deploy.yml
curl -sS https://laportal.montalvo.io/api/version
```

Expected:
- merged PR on `main`
- deploy workflow success
- live `buildSha` matches the merge SHA

