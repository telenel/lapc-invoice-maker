# Item Editor Parity — Phase 6 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship textbook-capable single-item editing in `EditItemDialogV2` and a short-by-default GM add dialog that can create inventory rows for `PIER`, `PCOP`, and `PFS`.

**Architecture:** Extend the existing Phase 5 `v2` path instead of inventing a second textbook editor. The detail route grows to hydrate textbook metadata already mirrored into `products`, the PATCH route grows a typed `textbook` bucket, and the add flow stays GM-only while the create route and Prism transaction expand to accept multiple location inventory rows.

**Tech Stack:** Next.js 14 route handlers, React client components, TypeScript strict, Supabase admin reads/writes, Prism SQL transactional writes, Vitest, Testing Library.

---

## File map

Files created:
- `docs/superpowers/specs/2026-04-20-item-editor-parity-phase-6-design.md`
- `docs/superpowers/plans/2026-04-20-item-editor-parity-phase-6.md`
- `tests/app/api/products-create-route.test.ts`

Files modified:
- `src/components/products/edit-item-dialog-mode.ts`
- `src/components/products/edit-item-dialog.tsx`
- `src/components/products/edit-item-dialog-v2.tsx`
- `src/components/products/new-item-dialog.tsx`
- `src/domains/product/api-client.ts`
- `src/domains/product/types.ts`
- `src/domains/product/prism-updates.ts`
- `src/domains/product/prism-server.ts`
- `src/app/api/products/[sku]/route.ts`
- `src/app/api/products/route.ts`
- `src/components/products/edit-item-dialog-v2.test.tsx`
- `tests/app/api/product-detail-route.test.ts`
- `tests/app/api/product-patch-route-v2.test.ts`
- `tests/domains/product/ref-data.test.ts`

Files read for reference:
- `docs/superpowers/specs/2026-04-19-item-editor-parity-design.md`
- `docs/superpowers/specs/2026-04-20-item-editor-parity-phase-5-design.md`
- `src/components/products/edit-item-dialog-legacy.tsx`
- `src/domains/product/prism-sync.ts`

---

## Task 1: Hydrate textbook detail fields and route single textbook selections into `v2`

**Files:**
- Modify: `src/components/products/edit-item-dialog-mode.ts`
- Modify: `src/domains/product/types.ts`
- Modify: `src/app/api/products/[sku]/route.ts`
- Test: `tests/app/api/product-detail-route.test.ts`

**Purpose:** Make textbook rows eligible for the `v2` path and give the editor the textbook metadata it needs.

- [ ] **Step 1: Write the failing detail-route and mode-routing tests.**

Add assertions that:

```ts
expect(resolveEditDialogMode({
  featureFlagEnabled: true,
  override: null,
  hasTextbookSelection: true,
  selectionCount: 1,
})).toBe("v2");
```

And in `tests/app/api/product-detail-route.test.ts` add a textbook row expecting:

```ts
expect(body).toEqual(expect.objectContaining({
  itemType: "textbook",
  author: "Jane Doe",
  title: "Intro Biology",
  isbn: "9781234567890",
  edition: "3",
  bindingId: 15,
  imprint: "PEARSON",
  copyright: "26",
}));
```

- [ ] **Step 2: Run the focused tests and confirm they fail on the current textbook gaps.**

Run:

```bash
npm test -- tests/app/api/product-detail-route.test.ts src/components/products/edit-item-dialog-v2.test.tsx
```

Expected: FAIL because `resolveEditDialogMode` still forces legacy textbooks and the detail route does not serialize textbook fields.

- [ ] **Step 3: Extend the `ProductEditDetails` contract with textbook metadata.**

In `src/domains/product/types.ts`, add:

```ts
author: string | null;
title: string | null;
isbn: string | null;
edition: string | null;
bindingId: number | null;
imprint: string | null;
copyright: string | null;
textStatusId: number | null;
statusDate: string | null;
bookKey: string | null;
```

- [ ] **Step 4: Update mode routing and detail serialization.**

In `src/components/products/edit-item-dialog-mode.ts`, change the resolver so textbook rows stay on `v2` only when `selectionCount === 1`.

In `src/app/api/products/[sku]/route.ts`:
- add textbook columns to `PRODUCT_EDIT_DETAIL_SELECT`
- include them in `toProductEditDetails`
- leave Phase 5 inventory hydration unchanged

- [ ] **Step 5: Re-run the focused tests.**

Run:

```bash
npm test -- tests/app/api/product-detail-route.test.ts src/components/products/edit-item-dialog-v2.test.tsx
```

Expected: PASS for the new detail and routing assertions.

- [ ] **Step 6: Commit the textbook detail seam.**

```bash
git add src/components/products/edit-item-dialog-mode.ts \
        src/domains/product/types.ts \
        src/app/api/products/[sku]/route.ts \
        tests/app/api/product-detail-route.test.ts \
        src/components/products/edit-item-dialog-v2.test.tsx
git commit -m "feat(products): hydrate textbook detail fields for phase 6"
```

---

## Task 2: Extend the `v2` PATCH contract for textbook metadata and server mirroring

**Files:**
- Modify: `src/domains/product/types.ts`
- Modify: `src/domains/product/prism-updates.ts`
- Modify: `src/app/api/products/[sku]/route.ts`
- Test: `tests/app/api/product-patch-route-v2.test.ts`

**Purpose:** Allow textbook SKUs to save through the `v2` route with a typed textbook patch bucket.

- [ ] **Step 1: Write the failing route test for textbook `v2` payloads.**

Add a new case in `tests/app/api/product-patch-route-v2.test.ts` that sends:

```ts
{
  mode: "v2",
  patch: {
    textbook: {
      author: "Jane Doe",
      title: "Intro Biology",
      isbn: "9781234567890",
      edition: "3",
      bindingId: 15,
      imprint: "PEARSON",
      copyright: "26",
    },
    inventory: [{ locationId: 2, retail: 89.5, cost: 52.25 }],
  },
}
```

and expects the route to call `updateTextbookPricing` instead of returning the current textbook rejection error.

- [ ] **Step 2: Run the focused PATCH-route test and confirm it fails on the textbook `v2` rejection.**

Run:

```bash
npm test -- tests/app/api/product-patch-route-v2.test.ts
```

Expected: FAIL because textbook `v2` is still rejected.

- [ ] **Step 3: Add the typed textbook patch bucket.**

In `src/domains/product/types.ts`, add:

```ts
export interface TextbookDetailsPatch {
  author?: string | null;
  title?: string | null;
  isbn?: string | null;
  edition?: string | null;
  bindingId?: number | null;
  imprint?: string | null;
  copyright?: string | null;
  textStatusId?: number | null;
  statusDate?: string | null;
}
```

Then extend:

```ts
export interface ProductEditPatchV2 {
  item?: ItemPatch;
  gm?: GmDetailsPatch;
  textbook?: TextbookDetailsPatch;
  inventory?: InventoryPatchPerLocation[];
  primaryInventory?: PrimaryInventoryPatch;
}
```

- [ ] **Step 4: Update the route and Prism updater for textbook `v2` writes.**

In `src/app/api/products/[sku]/route.ts`:
- remove the blanket textbook `v2` rejection
- keep the kind lookup so textbook rows still route to `updateTextbookPricing`
- extend the Supabase mirror payload to include textbook fields from `patch.textbook`

In `src/domains/product/prism-updates.ts`:
- teach `updateTextbookPricing` to update the textbook table fields that map to the synced mirror
- keep the existing item + inventory update behavior and concurrency check

- [ ] **Step 5: Re-run the focused PATCH-route test.**

Run:

```bash
npm test -- tests/app/api/product-patch-route-v2.test.ts
```

Expected: PASS

- [ ] **Step 6: Commit the textbook write contract.**

```bash
git add src/domains/product/types.ts \
        src/domains/product/prism-updates.ts \
        src/app/api/products/[sku]/route.ts \
        tests/app/api/product-patch-route-v2.test.ts
git commit -m "feat(products): add phase 6 textbook v2 patch support"
```

---

## Task 3: Add textbook-aware `v2` dialog UI

**Files:**
- Modify: `src/components/products/edit-item-dialog.tsx`
- Modify: `src/components/products/edit-item-dialog-v2.tsx`
- Modify: `src/domains/product/api-client.ts`
- Test: `src/components/products/edit-item-dialog-v2.test.tsx`

**Purpose:** Make the `v2` editor actually usable for textbook rows once the route contract exists.

- [ ] **Step 1: Write the failing component tests for textbook UI and payload shape.**

Add tests that:

1. render a single textbook item in `v2` and expect:

```ts
expect(screen.getByLabelText("Title")).toBeInTheDocument();
expect(screen.getByLabelText("Author")).toBeInTheDocument();
expect(screen.getByLabelText("ISBN")).toBeInTheDocument();
expect(screen.getByRole("tab", { name: "Textbook" })).toBeInTheDocument();
```

2. save a changed textbook field and expect:

```ts
expect(productApi.update).toHaveBeenCalledWith(1001, expect.objectContaining({
  mode: "v2",
  patch: expect.objectContaining({
    textbook: expect.objectContaining({ title: "Updated title" }),
  }),
}));
```

- [ ] **Step 2: Run the focused dialog test and confirm it fails.**

Run:

```bash
npm test -- src/components/products/edit-item-dialog-v2.test.tsx
```

Expected: FAIL because the current form has no textbook fields or `textbook` patch bucket.

- [ ] **Step 3: Extend the dialog form state for textbook rows.**

In `src/components/products/edit-item-dialog-v2.tsx`:
- add textbook form fields to the local state
- initialize them from `detail`
- make the `Primary` tab switch between GM identity fields and textbook identity fields based on `detail.itemType`

- [ ] **Step 4: Add the `Textbook` tab and save-path diffing.**

Implement:
- `Textbook` tab visible only for textbook or used textbook items
- binding select using the existing ref directory
- patch builder that includes a `textbook` bucket only for changed fields
- keep inventory behavior from Phase 5 unchanged

- [ ] **Step 5: Re-run the focused dialog test.**

Run:

```bash
npm test -- src/components/products/edit-item-dialog-v2.test.tsx
```

Expected: PASS

- [ ] **Step 6: Commit the textbook dialog UI.**

```bash
git add src/components/products/edit-item-dialog.tsx \
        src/components/products/edit-item-dialog-v2.tsx \
        src/domains/product/api-client.ts \
        src/components/products/edit-item-dialog-v2.test.tsx
git commit -m "feat(products): add textbook support to the v2 editor"
```

---

## Task 4: Redesign the add dialog UI around a short default form and multi-location create state

**Files:**
- Modify: `src/components/products/new-item-dialog.tsx`
- Test: `tests/domains/product/ref-data.test.ts`

**Purpose:** Make the common GM add flow shorter by default while preparing the create route for multiple location inventory rows.

- [ ] **Step 1: Write the failing dialog tests for collapsed state, expand, and location copy.**

Add tests that:

1. with the dialog open, the default surface shows:

```ts
expect(screen.getByLabelText("Description")).toBeInTheDocument();
expect(screen.getByLabelText("Retail")).toBeInTheDocument();
expect(screen.queryByLabelText("Barcode")).not.toBeInTheDocument();
```

2. clicking the expand control reveals the optional fields
3. checking `PCOP` reveals extra retail/cost inputs and `Copy from PIER` copies the Pierce values

- [ ] **Step 2: Run the focused new-item test and confirm it fails.**

Run:

```bash
npm test -- tests/domains/product/ref-data.test.ts
```

Expected: FAIL because the dialog is still always expanded and has no location UI.

- [ ] **Step 3: Reshape `NewItemDialog` form state.**

In `src/components/products/new-item-dialog.tsx`:
- keep the existing GM fields
- split them into `default` and `expanded` presentation groups
- add location selection state for `PIER`, `PCOP`, `PFS`
- add per-location retail/cost state for any non-Pierce selected location

- [ ] **Step 4: Render the short default surface plus expand and location controls.**

Implement:
- a collapsed-by-default optional section
- a location selector that requires at least one checked location
- `Copy from PIER` actions for `PCOP` and `PFS`
- submit payload assembly into an explicit `inventory[]` array

- [ ] **Step 5: Re-run the focused new-item test.**

Run:

```bash
npm test -- tests/domains/product/ref-data.test.ts
```

Expected: PASS

- [ ] **Step 6: Commit the add-dialog UI redesign.**

```bash
git add src/components/products/new-item-dialog.tsx \
        tests/domains/product/ref-data.test.ts
git commit -m "feat(products): redesign the add-item dialog for phase 6"
```

---

## Task 5: Expand GM creation to multiple locations and mirror `product_inventory`

**Files:**
- Modify: `src/domains/product/api-client.ts`
- Modify: `src/domains/product/prism-server.ts`
- Modify: `src/app/api/products/route.ts`
- Test: `tests/app/api/products-create-route.test.ts`

**Purpose:** Back the Phase 6 add-dialog UI with a real multi-location create path that still preserves the legacy single-location contract.

- [ ] **Step 1: Write the failing create-route tests for multi-location inventory.**

Add a new test file `tests/app/api/products-create-route.test.ts` that covers:

1. accepting:

```ts
inventory: [
  { locationId: 2, retail: 12.99, cost: 6.25 },
  { locationId: 3, retail: 13.49, cost: 6.75 },
]
```

and forwarding that unchanged to `createGmItem`

2. rejecting duplicate or out-of-scope locations with `400`

3. mirroring the created rows into `product_inventory`

- [ ] **Step 2: Run the focused create-route test and confirm it fails.**

Run:

```bash
npm test -- tests/app/api/products-create-route.test.ts
```

Expected: FAIL because the route has no `inventory[]` support yet.

- [ ] **Step 3: Extend client, route, and Prism input types.**

In `src/domains/product/api-client.ts`, add:

```ts
inventory?: Array<{
  locationId: 2 | 3 | 4;
  retail: number;
  cost: number;
}>;
```

Mirror that shape in `src/app/api/products/route.ts` and `src/domains/product/prism-server.ts`.

- [ ] **Step 4: Implement multi-location create end to end.**

In `src/app/api/products/route.ts`:
- validate `inventory[]`
- preserve the legacy `retail`/`cost` fallback when `inventory` is absent
- mirror every created inventory row into `product_inventory`

In `src/domains/product/prism-server.ts`:
- insert one `Inventory` row per requested location inside the existing transaction
- keep single-location callers working by normalizing to Pierce-only when needed

- [ ] **Step 5: Re-run the focused create-route test.**

Run:

```bash
npm test -- tests/app/api/products-create-route.test.ts
```

Expected: PASS

- [ ] **Step 6: Commit the multi-location create path.**

```bash
git add src/domains/product/api-client.ts \
        src/domains/product/prism-server.ts \
        src/app/api/products/route.ts \
        tests/app/api/products-create-route.test.ts
git commit -m "feat(products): add multi-location item creation"
```

---

## Task 6: Run focused regressions, ship-check, and publish the Phase 6 branch

**Files:**
- Verify only

**Purpose:** Prove the merged Phase 6 surface is stable before push and PR.

- [ ] **Step 1: Run the focused Phase 6 suites.**

Run:

```bash
npm test -- tests/app/api/product-detail-route.test.ts \
           tests/app/api/product-patch-route-v2.test.ts \
           tests/app/api/products-create-route.test.ts \
           src/components/products/edit-item-dialog-v2.test.tsx \
           tests/domains/product/ref-data.test.ts
```

Expected: PASS

- [ ] **Step 2: Run diff hygiene.**

Run:

```bash
git diff --check
```

Expected: no output

- [ ] **Step 3: Run the full repo gate.**

Run:

```bash
npx prisma generate
npm run ship-check
```

Expected: PASS

- [ ] **Step 4: Push the branch and open the PR.**

Run:

```bash
git push --set-upstream origin feat/item-editor-parity-phase-6
gh pr create --base main --head feat/item-editor-parity-phase-6 --title "feat(products): add phase 6 textbook editing and add dialog v2" --body "## Summary
- add textbook support to the v2 item editor
- redesign the add-item dialog around a short default flow
- support multi-location GM creation for PIER, PCOP, and PFS

## Testing
- npm test -- tests/app/api/product-detail-route.test.ts tests/app/api/product-patch-route-v2.test.ts tests/app/api/products-create-route.test.ts src/components/products/edit-item-dialog-v2.test.tsx tests/domains/product/ref-data.test.ts
- npm run ship-check"
```

- [ ] **Step 5: Watch CI, merge, and verify production.**

Run:

```bash
gh pr checks --watch
gh pr merge --squash --delete-branch
gh run list --limit 5 --json databaseId,workflowName,status,conclusion,headBranch,headSha,url
curl -sS https://laportal.montalvo.io/api/version
```

Expected:
- CI green
- PR merged
- deploy workflow green
- `/api/version` reports the merge SHA
