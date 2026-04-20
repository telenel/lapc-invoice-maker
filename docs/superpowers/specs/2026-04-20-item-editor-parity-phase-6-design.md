# Item Editor Parity — Phase 6 Design Spec

**Date:** 2026-04-20
**Branch (planned):** `feat/item-editor-parity-phase-6`
**Status:** Drafted for execution
**Parent spec:** `docs/superpowers/specs/2026-04-19-item-editor-parity-design.md`
**Prerequisite:** Phase 5 merged to `main` as PR #220 on April 20, 2026

---

## Goal

Ship the first textbook-capable `v2` editor path and redesign the add-item dialog so the common GM creation flow is shorter by default while supporting extra Pierce locations at create time.

Phase 6 adds:
- textbook detail hydration for the `v2` dialog
- a `Textbook` patch bucket from client to route to Prism
- a textbook-aware `Primary` + `Textbook` tab experience in `EditItemDialogV2`
- single-item textbook selections on the `v2` path instead of the legacy textbook-safe dialog
- a collapsed-by-default `NewItemDialog` with 5 primary fields and an expand section
- multi-location GM creation for `PIER`, `PCOP`, and `PFS`

Phase 6 explicitly does **not** add:
- inline row edits
- bulk-edit field picking
- textbook creation as a distinct new-item flow
- `PBO` (`LocationID = 5`) reads or writes

This phase is about widening the editor to cover textbook metadata and shortening the add flow without dragging inline or bulk mechanics forward.

---

## Why This Phase Exists

Phase 5 completed the multi-location inventory seam, but two visible gaps remain:

- any single textbook selection still falls back to the legacy dialog even though the `v2` editor is now the main editing surface
- the add dialog still opens in a long merchandise form with the high-friction fields mixed together, and it can only create Pierce inventory

That leaves two important parity holes:

1. operators still leave the new editor for textbook metadata changes
2. adding a new item still feels like the old products launch rather than the narrowed, keyboard-first path the master spec describes

Phase 6 closes both without introducing the heavier Phase 7 and Phase 8 interaction work.

---

## Hard Rules

These remain non-negotiable throughout Phase 6:

1. `PBO` (`LocationID = 5`) stays excluded from reads, writes, and UI.
2. Bulk edit stays on the existing path until Phase 8.
3. Inline row edits stay out of scope until Phase 7.
4. Labels, never numeric IDs, for bindings and any ref-backed textbook fields.
5. Single-item textbook edits may use `v2`, but bulk textbook selections stay on the existing legacy path for this phase.
6. Add-item creation remains general-merchandise-only unless a real textbook create path already exists. Do not invent a speculative textbook insert path in Phase 6.

---

## Current Code Reality

Phase 6 has to work with the Phase 5 code now on `main`:

- `src/components/products/edit-item-dialog-mode.ts` hard-forces any textbook selection to `legacy`
- `src/components/products/edit-item-dialog-v2.tsx` only models GM/global + inventory fields; it never renders textbook metadata
- `src/domains/product/types.ts` has no textbook detail or `textbook` patch bucket for `v2`
- `src/app/api/products/[sku]/route.ts` explicitly rejects `v2` PATCH requests for textbook SKUs
- `src/domains/product/prism-updates.ts` already has a narrow `updateTextbookPricing` writer, but it only covers barcode, discontinue, and inventory pricing fields
- `src/components/products/new-item-dialog.tsx` is a merchandise-only full form with one retail/cost pair and no location selection
- `src/app/api/products/route.ts` and `src/domains/product/prism-server.ts` only create one Pierce inventory row

That is good news: the editor shell, route shape, inventory detail contract, and Prism transaction pattern already exist. Phase 6 mostly needs new typed fields, textbook routing, and a slimmer creation UI.

---

## Recommended Approach

Keep the Phase 5 `v2` architecture intact and extend it in three coordinated seams:

1. Extend the single-item detail contract so textbook rows hydrate the global textbook columns already mirrored into `products`.
2. Grow the `v2` PATCH contract with a dedicated `textbook` bucket and let textbook SKUs use the same route path instead of the legacy fallback.
3. Redesign `NewItemDialog` around a short default form plus an expanded section, then upgrade the create route and Prism server call to accept 1-3 inventory rows for `PIER`, `PCOP`, and `PFS`.

Why this approach:
- it preserves the Phase 5 write path instead of splitting textbook updates into a second `v2` route
- it keeps textbook support single-item-only, which matches the current rollout boundary
- it reuses the existing Prism create transaction rather than inventing a parallel create pipeline
- it keeps the add dialog GM-focused, which matches the real server capability today

---

## Scope

### In scope

- Extend `ProductEditDetails` with textbook metadata already synced into `products`
- Add a typed `TextbookDetailsPatch` bucket for `v2` saves
- Allow `v2` PATCH for textbook SKUs on single-item edits
- Add textbook UI to `EditItemDialogV2`:
  - textbook-aware `Primary` fields
  - `Textbook` tab for secondary metadata
  - binding dropdown backed by `/api/products/refs`
- Keep mixed or bulk textbook selections on the legacy path
- Redesign `NewItemDialog` so the default surface is:
  - Description
  - DCC
  - Vendor
  - Retail
  - Cost
- Add an expand section for the existing optional GM fields
- Add location toggles for `PIER`, `PCOP`, and `PFS`, defaulting to `PIER` only
- Support per-location retail/cost overrides for extra selected locations with a one-click copy-from-PIER action
- Mirror successful creates into both `products` and `product_inventory`

### Out of scope

- textbook creation as a new-item type
- inline row edit affordances or keyboard grid navigation
- bulk-edit field picking
- inventory advanced-field expansion beyond what Phase 5 already shipped
- any location outside `2`, `3`, and `4`

---

## Data Contract

### Detail read model

Add textbook fields to `ProductEditDetails`:

```ts
interface ProductEditDetails {
  // existing Phase 5 fields...
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
}
```

These values come from the existing `products` mirror columns, not a new live Prism read.

### Write model

Add a textbook-specific `v2` bucket:

```ts
interface TextbookDetailsPatch {
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

interface ProductEditPatchV2 {
  item?: ItemPatch;
  gm?: GmDetailsPatch;
  textbook?: TextbookDetailsPatch;
  inventory?: InventoryPatchPerLocation[];
  primaryInventory?: PrimaryInventoryPatch;
}
```

Server rule:
- if the row is GM, ignore `textbook`
- if the row is textbook or used textbook, allow `textbook`
- still reject bulk `v2` textbook writes in this phase by keeping textbook `v2` to the single-item path only

### Create model

Extend create input to carry explicit location rows:

```ts
interface CreateInventoryInput {
  locationId: 2 | 3 | 4;
  retail: number;
  cost: number;
}

interface CreateItemInput {
  description: string;
  vendorId: number;
  dccId: number;
  itemTaxTypeId?: number;
  barcode?: string | null;
  catalogNumber?: string | null;
  comment?: string | null;
  inventory?: CreateInventoryInput[];
}
```

Backward-compatibility rule:
- if `inventory` is absent, keep today’s Pierce-only behavior using the existing `retail`/`cost` payload
- the Phase 6 UI should send `inventory`

---

## UI Behavior

### Edit dialog

#### Mode routing

`resolveEditDialogMode` should stop forcing single-item textbook selections to `legacy`.

Target behavior:
- single-item GM selection → `v2`
- single-item textbook or used textbook selection → `v2`
- multi-select containing any textbook row → `legacy`
- explicit override still wins

#### Primary tab

For textbook rows, the `Primary` tab swaps the GM identity fields for textbook-first fields:
- Title
- Author
- ISBN
- Edition
- Binding
- Barcode
- DCC
- Vendor
- Tax Type
- location-scoped Retail / Cost
- Discontinue

That keeps the daily textbook edits on the first screen.

#### Textbook tab

Visible only for textbook or used textbook rows.

Fields:
- Imprint
- Copyright
- Text status
- Status date
- Book key (read-only)

The tab exists so lower-frequency textbook fields do not crowd the Primary tab.

### Add dialog

#### Default-visible fields

- Description
- DCC
- Vendor
- Retail
- Cost

#### Expand section

Collapsed by default. Reveals the existing optional GM fields already supported by the create route:
- Barcode
- Tax Type
- Catalog #
- Internal note

If Phase 6 needs to surface more optional GM fields that are already wired server-side, they live here rather than on the default face.

#### Location section

Always visible near the pricing area:
- `[x] PIER`
- `[ ] PCOP`
- `[ ] PFS`

Rules:
- at least one location must remain selected
- `PIER` starts checked
- when only `PIER` is selected, the dialog behaves like today
- when `PCOP` or `PFS` are checked, location cards appear with retail/cost inputs and a `Copy from PIER` action

This remains GM-only in Phase 6. The dialog title can keep the merchandise wording so we do not imply textbook creation support that does not exist.

---

## Server Behavior

### Detail GET

`GET /api/products/[sku]` should:
- add the textbook columns to the `products` select list
- serialize them into `ProductEditDetails`
- leave inventory hydration unchanged from Phase 5

### PATCH

`PATCH /api/products/[sku]` should:
- stop rejecting `v2` textbook rows outright
- route textbook rows to `updateTextbookPricing` only after that writer understands the new `textbook` patch bucket
- keep the current concurrency and mirror behavior
- mirror textbook field changes back into `products`

### Prism update path

`updateTextbookPricing` should expand from pricing-only to textbook-safe metadata updates on the tables the existing product sync reads from.

Phase 6 should only touch fields we can map confidently from the synced mirror:
- `Textbook.Author`
- `Textbook.Title`
- `Textbook.ISBN`
- `Textbook.Edition`
- `Textbook.BindingID`
- `Textbook.Imprint`
- `Textbook.Copyright`
- `Textbook.TextStatusID`
- `Textbook.StatusDate`

Keep the same transaction pattern as the GM updater:
- verify baseline
- update `Item` if needed
- update textbook table fields
- update inventory rows
- commit or roll back as one unit

### Create route

`POST /api/products` should:
- accept the new `inventory[]` array
- reject any location outside `2`, `3`, `4`
- reject duplicate locations
- require at least one inventory row when `inventory` is present
- mirror every created row into `product_inventory`
- keep `products.retail_price` / `products.cost` mirrored from the Pierce row so older read paths remain sane

### Prism create path

`createGmItem` should:
- keep using `P_Item_Add_GM`
- insert one `Inventory` row per requested location inside the same transaction
- default to the legacy single Pierce row when callers do not opt into the Phase 6 contract

---

## Testing Strategy

Follow TDD. Key coverage:

- unit / integration tests for `resolveEditDialogMode` textbook routing
- route tests for textbook detail hydration
- route tests for `v2` textbook PATCH acceptance and rejection boundaries
- dialog tests for textbook field rendering and textbook patch submission
- create-route tests for multi-location create validation and mirror payloads
- add-dialog tests for:
  - collapsed default state
  - expand toggle
  - multi-location copy-from-PIER
  - disabled submit when no locations are selected
- full `ship-check` before push

---

## Phasing Note

Phase 6 intentionally keeps the new textbook support and add-dialog changes separate from inline edits and bulk edit redesign. That keeps the review surface narrow:

- Phase 6: textbook edit parity + add flow improvement
- Phase 7: inline row edits
- Phase 8: bulk edit field picker

If Phase 6 discovers missing textbook write-table knowledge, stop at the smallest safe subset that still removes the single-item textbook `legacy` fallback, rather than guessing at a broader write path.
