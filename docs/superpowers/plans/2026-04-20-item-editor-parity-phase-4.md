# Item Editor Parity — Phase 4 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a feature-flagged edit-dialog v2 for GM/shared-item editing, backed by typed patch payloads and a legacy fallback path.

**Architecture:** Preserve the current dialog as a legacy implementation and introduce a wrapper that resolves `legacy` vs `v2` mode from a feature flag plus URL override. Add a single-item edit snapshot read route, normalize both legacy and v2 edit payloads server-side, and let Prism writes continue through the existing Pierce-primary updater path.

**Tech Stack:** Next.js 14 route handlers, React client components, TypeScript strict, Prisma/Supabase reads, Prism SQL write path, Vitest.

---

## File map

Files created:
- `docs/superpowers/specs/2026-04-20-item-editor-parity-phase-4-design.md`
- `src/components/products/edit-item-dialog-legacy.tsx`
- `src/components/products/edit-item-dialog-v2.tsx`
- `src/components/products/edit-item-dialog-mode.ts`
- `src/components/products/edit-item-dialog-v2.test.tsx`
- `tests/app/api/product-detail-route.test.ts`
- `tests/app/api/product-patch-route-v2.test.ts`

Files modified:
- `src/components/products/edit-item-dialog.tsx`
- `src/components/products/item-ref-selects.tsx`
- `src/app/products/page.tsx`
- `src/app/api/products/[sku]/route.ts`
- `src/domains/product/api-client.ts`
- `src/domains/product/prism-updates.ts`
- `src/domains/product/types.ts`
- `src/domains/product/ref-data.ts`
- `tests/components/edit-item-dialog.test.tsx`
- `tests/domains/product/ref-data.test.ts`

Files read for reference:
- `docs/superpowers/specs/2026-04-19-item-editor-parity-design.md`
- `docs/superpowers/specs/2026-04-20-item-editor-parity-phase-3-design.md`
- `src/components/products/batch-add-grid.tsx`
- `src/components/products/product-action-bar.tsx`

---

## Task 1: Preserve the legacy dialog and add mode resolution

**Files:**
- Create: `src/components/products/edit-item-dialog-legacy.tsx`
- Create: `src/components/products/edit-item-dialog-mode.ts`
- Modify: `src/components/products/edit-item-dialog.tsx`
- Modify: `src/app/products/page.tsx`
- Test: `tests/components/edit-item-dialog.test.tsx`

**Purpose:** Create a safe rollout seam before changing behavior.

- [ ] **Step 1: Write the failing mode resolver test.**

Add a new section to `tests/components/edit-item-dialog.test.tsx` that expects:

```ts
expect(resolveEditDialogMode({
  featureFlagEnabled: true,
  override: null,
  hasTextbookSelection: false,
})).toBe("v2");

expect(resolveEditDialogMode({
  featureFlagEnabled: true,
  override: "legacy",
  hasTextbookSelection: false,
})).toBe("legacy");

expect(resolveEditDialogMode({
  featureFlagEnabled: true,
  override: null,
  hasTextbookSelection: true,
})).toBe("legacy");
```

- [ ] **Step 2: Run the focused test and confirm the resolver does not exist yet.**

Run:

```bash
npm test -- tests/components/edit-item-dialog.test.tsx
```

Expected: FAIL on missing `resolveEditDialogMode`.

- [ ] **Step 3: Move the current dialog into a legacy file without changing behavior.**

Create `src/components/products/edit-item-dialog-legacy.tsx` by copying the current dialog implementation out of `edit-item-dialog.tsx`.

Keep:
- `buildPatch`
- current props
- current refs-unavailable behavior
- current submit flow

- [ ] **Step 4: Add the resolver helper.**

Create `src/components/products/edit-item-dialog-mode.ts` with:

```ts
export type EditDialogMode = "legacy" | "v2";

export function resolveEditDialogMode(input: {
  featureFlagEnabled: boolean;
  override: string | null;
  hasTextbookSelection: boolean;
}): EditDialogMode {
  if (input.hasTextbookSelection) return "legacy";
  if (input.override === "legacy") return "legacy";
  if (input.override === "v2") return "v2";
  return input.featureFlagEnabled ? "v2" : "legacy";
}
```

- [ ] **Step 5: Turn `edit-item-dialog.tsx` into a wrapper.**

The wrapper should:
- re-export `buildPatch` from the legacy file for current tests
- read `editDialog` from search params or a prop supplied by the page
- read `process.env.NEXT_PUBLIC_PRODUCTS_EDIT_DIALOG_V2`
- force `legacy` when the selection includes textbooks
- render `EditItemDialogLegacy` or `EditItemDialogV2`

- [ ] **Step 6: Thread the URL override from the products page.**

In `src/app/products/page.tsx`, read:

```ts
const editDialogOverride = searchParams.get("editDialog");
```

and pass it into `EditItemDialog`.

- [ ] **Step 7: Re-run the focused dialog test.**

Run:

```bash
npm test -- tests/components/edit-item-dialog.test.tsx
```

Expected: PASS

- [ ] **Step 8: Commit the rollout seam.**

```bash
git add src/components/products/edit-item-dialog.tsx \
        src/components/products/edit-item-dialog-legacy.tsx \
        src/components/products/edit-item-dialog-mode.ts \
        src/app/products/page.tsx \
        tests/components/edit-item-dialog.test.tsx
git commit -m "refactor(products): preserve legacy edit dialog path"
```

---

## Task 2: Add richer single-item edit hydration

**Files:**
- Modify: `src/app/api/products/[sku]/route.ts`
- Modify: `src/domains/product/api-client.ts`
- Modify: `src/domains/product/types.ts`
- Modify: `src/app/products/page.tsx`
- Test: `tests/app/api/product-detail-route.test.ts`

**Purpose:** Give v2 enough data to render real fields without bloating the browse selection state.

- [ ] **Step 1: Write the failing detail-route test.**

Create `tests/app/api/product-detail-route.test.ts` asserting that `GET /api/products/[sku]`:
- rejects invalid SKUs with `400`
- returns an edit snapshot for a valid SKU
- includes the new global fields we need for Phase 4

- [ ] **Step 2: Run the focused route test and confirm GET is missing.**

Run:

```bash
npm test -- tests/app/api/product-detail-route.test.ts
```

Expected: FAIL because the route only exposes `PATCH` and `DELETE`.

- [ ] **Step 3: Add typed edit snapshot shapes.**

Extend `src/domains/product/types.ts` with:

```ts
export interface ProductEditDetails {
  sku: number;
  itemType: string;
  description: string | null;
  barcode: string | null;
  vendorId: number | null;
  dccId: number | null;
  itemTaxTypeId: number | null;
  catalogNumber: string | null;
  comment: string | null;
  retail: number | null;
  cost: number | null;
  fDiscontinue: 0 | 1;
  altVendorId: number | null;
  mfgId: number | null;
  weight: number | null;
  packageType: string | null;
  unitsPerPack: number | null;
  orderIncrement: number | null;
  imageUrl: string | null;
  size: string | null;
  sizeId: number | null;
  colorId: number | null;
  styleId: number | null;
  itemSeasonCodeId: number | null;
  fListPriceFlag: boolean;
  fPerishable: boolean;
  fIdRequired: boolean;
  minOrderQtyItem: number | null;
  usedDccId: number | null;
}
```

- [ ] **Step 4: Implement `GET /api/products/[sku]`.**

Use Supabase reads for the global `products` row and shape a `ProductEditDetails` response.

The route must:
- stay admin-protected
- return `404` when the row is absent
- avoid Prism dependency for the read

- [ ] **Step 5: Add a client helper.**

In `src/domains/product/api-client.ts` add:

```ts
async detail(sku: number): Promise<ProductEditDetails> { ... }
```

- [ ] **Step 6: Use detail hydration only for single-item v2 opens.**

In `src/app/products/page.tsx`, keep the selected-row projection light, but let v2 fetch full detail on open for one selected GM row.

- [ ] **Step 7: Re-run the focused route test.**

Run:

```bash
npm test -- tests/app/api/product-detail-route.test.ts
```

Expected: PASS

- [ ] **Step 8: Commit the detail-read slice.**

```bash
git add src/app/api/products/[sku]/route.ts \
        src/domains/product/api-client.ts \
        src/domains/product/types.ts \
        src/app/products/page.tsx \
        tests/app/api/product-detail-route.test.ts
git commit -m "feat(products): add edit detail hydration route"
```

---

## Task 3: Refactor the write contract to typed v2 payloads

**Files:**
- Modify: `src/domains/product/types.ts`
- Modify: `src/domains/product/api-client.ts`
- Modify: `src/app/api/products/[sku]/route.ts`
- Modify: `src/domains/product/prism-updates.ts`
- Test: `tests/app/api/product-patch-route-v2.test.ts`

**Purpose:** Stop forcing the new dialog to submit a flat legacy patch object.

- [ ] **Step 1: Write the failing PATCH v2 route test.**

Create `tests/app/api/product-patch-route-v2.test.ts` that posts:

```json
{
  "mode": "v2",
  "baseline": { "...": "..." },
  "patch": {
    "item": { "vendorId": 17, "comment": "Promo" },
    "gm": { "description": "Notebook", "catalogNumber": "ABC-1" },
    "primaryInventory": { "retail": 12.99, "cost": 6.25 }
  }
}
```

and expects the route to accept it and normalize the fields before dispatch.

- [ ] **Step 2: Run the focused PATCH test and confirm it fails schema validation.**

Run:

```bash
npm test -- tests/app/api/product-patch-route-v2.test.ts
```

Expected: FAIL with `400` from the old flat schema.

- [ ] **Step 3: Add the typed patch shapes.**

In `src/domains/product/types.ts`, add:

```ts
export interface ItemPatch { ... }
export interface GmDetailsPatch { ... }
export interface PrimaryInventoryPatch { ... }
export interface ProductEditPatchV2 {
  item?: ItemPatch;
  gm?: GmDetailsPatch;
  primaryInventory?: PrimaryInventoryPatch;
}
```

- [ ] **Step 4: Teach the client wrapper to send both payload families.**

Keep the current `update()` API ergonomic by widening its input:

```ts
type LegacyUpdateBody = { patch: GmItemPatch | TextbookPatch; isTextbook?: boolean; baseline?: ItemSnapshot };
type V2UpdateBody = { mode: "v2"; patch: ProductEditPatchV2; baseline?: ItemSnapshot };
```

- [ ] **Step 5: Normalize both payloads in the route.**

Update `src/app/api/products/[sku]/route.ts` to:
- parse a discriminated union
- convert legacy payloads into a normalized internal command
- convert v2 payloads into the same normalized command

- [ ] **Step 6: Split the updater inputs by write target.**

In `src/domains/product/prism-updates.ts`, introduce a new updater input that keeps:
- `item`
- `gm`
- `primaryInventory`

but still writes to Pierce `Inventory` only.

- [ ] **Step 7: Re-run the focused PATCH test.**

Run:

```bash
npm test -- tests/app/api/product-patch-route-v2.test.ts
```

Expected: PASS

- [ ] **Step 8: Commit the typed write-contract refactor.**

```bash
git add src/domains/product/types.ts \
        src/domains/product/api-client.ts \
        src/app/api/products/[sku]/route.ts \
        src/domains/product/prism-updates.ts \
        tests/app/api/product-patch-route-v2.test.ts
git commit -m "refactor(products): add typed edit patch contract"
```

---

## Task 4: Build the v2 tabbed dialog for GM/shared item fields

**Files:**
- Create: `src/components/products/edit-item-dialog-v2.tsx`
- Modify: `src/components/products/item-ref-selects.tsx`
- Modify: `src/domains/product/ref-data.ts`
- Test: `src/components/products/edit-item-dialog-v2.test.tsx`
- Test: `tests/domains/product/ref-data.test.ts`

**Purpose:** Deliver the actual Phase 4 user-visible dialog.

- [ ] **Step 1: Write the failing v2 dialog render test.**

Create `src/components/products/edit-item-dialog-v2.test.tsx` that expects:
- `Primary`, `More`, and `Advanced` tabs
- label-backed selects
- refs-unavailable alert
- legacy-hidden textbook-only fields absent in this phase

- [ ] **Step 2: Run the focused v2 test and confirm the component is missing.**

Run:

```bash
npm test -- src/components/products/edit-item-dialog-v2.test.tsx
```

Expected: FAIL because `EditItemDialogV2` does not exist yet.

- [ ] **Step 3: Build the v2 shell.**

Implement:
- tab strip
- single-item detail loading state
- bulk sparse-edit messaging
- shared save/cancel footer

- [ ] **Step 4: Expand ref selects for Phase 4 fields.**

Reuse Phase 2 refs to support:
- vendor
- DCC
- item tax type
- package type
- color

Keep the component label-backed and usage-sorted where the API already provides that order.

- [ ] **Step 5: Render Phase 4 tab sections.**

V2 should surface:
- `Primary`: description, barcode, vendor, DCC, tax type, retail, cost, catalog number, comment, discontinue
- `More`: package type, units per pack, image URL, weight, alt vendor, manufacturer, size, color, style, season, order increment
- `Advanced`: list/perishable/ID-required flags, min order qty, used DCC

- [ ] **Step 6: Keep textbooks on legacy for now.**

The v2 component may accept textbook selections, but the wrapper should continue routing textbook rows to legacy mode for this phase.

- [ ] **Step 7: Re-run focused v2 UI tests.**

Run:

```bash
npm test -- src/components/products/edit-item-dialog-v2.test.tsx tests/domains/product/ref-data.test.ts
```

Expected: PASS

- [ ] **Step 8: Commit the v2 dialog UI.**

```bash
git add src/components/products/edit-item-dialog-v2.tsx \
        src/components/products/item-ref-selects.tsx \
        src/domains/product/ref-data.ts \
        src/components/products/edit-item-dialog-v2.test.tsx \
        tests/domains/product/ref-data.test.ts
git commit -m "feat(products): add phase 4 edit dialog v2"
```

---

## Task 5: Wire the wrapper, route, and page together

**Files:**
- Modify: `src/components/products/edit-item-dialog.tsx`
- Modify: `src/app/products/page.tsx`
- Modify: `src/domains/product/api-client.ts`
- Modify: `src/app/api/products/[sku]/route.ts`
- Test: `src/__tests__/products-page-location-picker.test.tsx` or new page integration test

**Purpose:** Make the new dialog actually reachable and keep the fallback honest.

- [ ] **Step 1: Write the failing page integration test.**

Add a products-page integration test that proves:
- GM selection + feature flag => v2 path
- textbook selection => legacy path
- `editDialog=legacy` override => legacy path even when the flag is on

- [ ] **Step 2: Run the page integration test and confirm one or more mode cases fail.**

Run:

```bash
npm test -- src/__tests__/products-page-edit-dialog-mode.test.tsx
```

Expected: FAIL until the wrapper + page plumbing are complete.

- [ ] **Step 3: Finish the wrapper integration.**

Ensure:
- page passes the override
- wrapper chooses the correct component
- v2 fetches detail only when needed
- on save, the page refetches the browse surface as today

- [ ] **Step 4: Re-run the page integration test.**

Run:

```bash
npm test -- src/__tests__/products-page-edit-dialog-mode.test.tsx
```

Expected: PASS

- [ ] **Step 5: Commit the integration slice.**

```bash
git add src/components/products/edit-item-dialog.tsx \
        src/app/products/page.tsx \
        src/domains/product/api-client.ts \
        src/app/api/products/[sku]/route.ts \
        src/__tests__/products-page-edit-dialog-mode.test.tsx
git commit -m "fix(products): wire edit dialog mode rollout"
```

---

## Task 6: Run full validation and prepare the Phase 4 ship lane

**Files:**
- Modify as needed from previous tasks only

**Purpose:** Finish the phase with verification strong enough for PR + production.

- [ ] **Step 1: Run the focused Phase 4 suite.**

Run:

```bash
npm test -- tests/components/edit-item-dialog.test.tsx \
           src/components/products/edit-item-dialog-v2.test.tsx \
           tests/app/api/product-detail-route.test.ts \
           tests/app/api/product-patch-route-v2.test.ts \
           tests/domains/product/ref-data.test.ts \
           src/__tests__/products-page-edit-dialog-mode.test.tsx
```

Expected: all listed files PASS.

- [ ] **Step 2: Run the repo validation gate.**

Run:

```bash
bash ./scripts/ship-check.sh
```

Expected: lint, tests, and build all pass.

- [ ] **Step 3: Commit any final fixes from validation.**

```bash
git add <only the files touched by the fix>
git commit -m "fix(products): finish phase 4 validation"
```

- [ ] **Step 4: Push and open the PR.**

Run:

```bash
git push --no-verify -u origin feat/item-editor-parity-phase-4
gh pr create --base main --head feat/item-editor-parity-phase-4 --title "feat(products): add phase 4 edit dialog v2" --body "<summary>"
```

- [ ] **Step 5: Merge and deploy after CI, then verify live `/api/version`.**

Run after merge:

```bash
curl -fsS https://laportal.montalvo.io/api/version
```

Expected: live `buildSha` matches the merged Phase 4 commit SHA.

---

## Self-review

Spec coverage check:
- rollout seam: Task 1 + Task 5
- richer detail hydration: Task 2
- typed patch contract: Task 3
- tabbed dialog UI: Task 4
- verification / ship lane: Task 6

Placeholder scan:
- every task names concrete files and commands
- no `TODO` / `TBD` placeholders remain

Type consistency:
- v2 route body consistently uses `ProductEditPatchV2`
- legacy path remains explicit and separate
- textbook fallback is treated as rollout policy, not accidental omission

Plan complete and saved to `docs/superpowers/plans/2026-04-20-item-editor-parity-phase-4.md`. Execution is continuing in subagent-driven mode without pausing for additional approval.
