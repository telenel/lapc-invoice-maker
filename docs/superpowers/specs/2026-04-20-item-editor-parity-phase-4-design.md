# Item Editor Parity — Phase 4 Design Spec

**Date:** 2026-04-20
**Branch (planned):** `feat/item-editor-parity-phase-4`
**Status:** Drafted for execution
**Parent spec:** `docs/superpowers/specs/2026-04-19-item-editor-parity-design.md`
**Prerequisite:** Phase 3 merged to `main` as PR #218 and verified live on April 20, 2026

---

## Goal

Ship the first tabbed `EditItemDialog` that feels like the real parity push instead of a widened pricing form.

Phase 4 adds:
- a new edit-dialog shell with `Primary`, `More`, and `Advanced` tabs
- typed patch payloads that stop conflating Item, GM, and Inventory writes
- a feature-flagged rollout path where the legacy dialog stays reachable for one release
- label-backed dropdowns for the already-available refs API families that belong on the Phase 4 dialog

Phase 4 explicitly does **not** add:
- multi-location inventory editing
- a per-location inventory tab or copy-to-other-locations shortcuts
- textbook-specific editing beyond the existing narrow pricing-safe path
- add-item redesign
- inline row edits

This phase is about dialog architecture, write-path typing, and safer rollout. Multi-location edit semantics stay deferred to Phase 5, and textbook/add redesign stays deferred to Phase 6.

---

## Why This Phase Exists

Phase 3 made browse reads location-aware, but the edit dialog is still structurally the old Phase 0 form:
- one flat component
- one flat patch object
- one small set of visible fields
- no clean seam for phased rollout

That shape is now the bottleneck. Before we can add inventory editing, textbook editing, or inline cell edits safely, we need:
- a typed edit contract
- a dialog shell that can grow without collapsing into one giant form
- a reversible rollout path

Phase 4 is the seam where we pay down that structural debt while still shipping user-visible value.

---

## Hard Rules

These remain non-negotiable throughout Phase 4:

1. `PBO` (`LocationID = 5`) stays excluded.
2. Writes remain Pierce-primary only in this phase. No new per-location write semantics yet.
3. Labels, never raw IDs, wherever ref labels already exist.
4. The legacy dialog must remain reachable for one release as an explicit fallback.
5. Textbook-specific expansion remains out of scope for this phase even if the new shell is shared.

---

## Current Code Reality

Phase 4 has to work with the code that exists today:

- `src/components/products/edit-item-dialog.tsx` owns the whole dialog, diff logic, and submit flow.
- `src/components/products/item-ref-selects.tsx` only knows about vendor / DCC / item tax type.
- `src/domains/product/types.ts` still uses a single `GmItemPatch` shape that mixes Item, GM, and Inventory fields.
- `src/app/api/products/[sku]/route.ts` accepts one broad patch schema and dispatches directly to `updateGmItem()` or `updateTextbookPricing()`.
- `src/domains/product/prism-updates.ts` contains the real write routing between `Item`, `GeneralMerchandise`, and `Inventory`.
- The products page still passes a thin `selected` projection into the edit dialog, so the dialog does not have enough data to render a real parity form without fetching richer detail.

Those seams are good news: the work is concentrated and the live behavior is already easy to compare against.

---

## Recommended Approach

Phase 4 should ship as a wrapper-based rollout:

1. Preserve the current dialog as a `legacy` implementation.
2. Introduce a new `v2` dialog implementation behind an explicit mode resolver.
3. Keep the page importing `EditItemDialog`, but make that component choose `legacy` or `v2`.
4. Let the mode come from:
   - a feature flag default (`NEXT_PUBLIC_PRODUCTS_EDIT_DIALOG_V2`)
   - an emergency query-param override (`editDialog=legacy` / `editDialog=v2`)

This gives us:
- safe fallback during the first live release
- no need to revert the branch just to toggle the experience
- a clean place to keep textbook rows on the legacy path until Phase 6

---

## Scope

### In scope

- New `EditItemDialog` wrapper that can route between legacy and v2 implementations
- Feature-flag + query-param rollout control for dialog mode
- Typed patch refactor:
  - `ItemPatch`
  - `GmDetailsPatch`
  - `PrimaryInventoryPatch`
  - `ProductEditPatchV2`
- Backward-compatible route handling so legacy dialog payloads still work
- Richer edit hydration for single-item dialog opens
- `Primary`, `More`, and `Advanced` tabs for GM/shared item fields
- Existing refs API reused for label-backed selects
- Focused route, dialog, and page integration coverage

### Out of scope

- `Inventory` tab
- `InventoryPatchPerLocation[]`
- per-location toggles / copy shortcuts
- textbook author/title/ISBN/binding editing
- add-item dialog redesign
- inline row edit cells

---

## Dialog Scope For This Phase

### `Primary`

Visible for GM rows on v2:
- Description
- Barcode
- Vendor
- DCC
- Item tax type
- Retail (still Pierce-primary in this phase)
- Cost (still Pierce-primary in this phase)
- Catalog #
- Item comment
- Discontinue toggle

### `More`

GM/shared-item fields that already exist in the schema and route naturally to Item/GM:
- Alternate vendor
- Manufacturer
- Weight
- Package type
- Units per pack
- Order increment
- Image URL
- Size
- Size ID
- Color ID
- Style ID
- Item season code
- GM type

### `Advanced`

Rare global fields that still belong to the item-level editor before Phase 5:
- `fListPriceFlag`
- `fPerishable`
- `fIdRequired`
- `minOrderQtyItem`
- `usedDccId`
- `usedSku`
- `textStatusId`
- `statusDate`
- `typeTextbook`
- `bookKey` (read-only if surfaced)

### Textbook behavior in Phase 4

Textbook rows do **not** get their full field expansion yet.

Safe rollout rule:
- if the selection contains any textbook row, route to the legacy dialog for this phase

That keeps Phase 4 aligned with the master phasing:
- Phase 4: dialog shell + typed write contract
- Phase 6: textbook tab + add-dialog redesign

---

## Data Flow

### 1. Mode resolution

The page continues to render `<EditItemDialog />`, but the component resolves:
- `legacy`
- `v2`

Resolution order:
1. `editDialog` URL param if present
2. feature flag default
3. force `legacy` if selection contains a textbook row

### 2. Richer dialog hydration

The current selected-row projection is too thin for v2.

Phase 4 should add a single-item detail read path:
- `GET /api/products/[sku]`
- returns an edit snapshot shaped for the dialog

Source of truth:
- Supabase `products` row for global catalog fields
- current Pierce-primary price/cost/discontinue snapshot from existing write-safe sources

Bulk edit remains a sparse patch flow and does not need every field hydrated.

### 3. Typed patch normalization

The route should accept:
- legacy payloads from the existing dialog
- v2 payloads from the new tabbed dialog

It should normalize both into one server-side write command structure before touching Prism.

### 4. Write behavior

Writes still target:
- `Item`
- `GeneralMerchandise`
- Pierce `Inventory` row only

No multi-location write fanout yet.

---

## API Contract Direction

### V2 client payload

```ts
interface ProductEditPatchV2 {
  item?: ItemPatch;
  gm?: GmDetailsPatch;
  primaryInventory?: PrimaryInventoryPatch;
}
```

### Route body

```ts
interface ProductEditRequestV2 {
  mode: "v2";
  baseline?: ItemSnapshot;
  patch: ProductEditPatchV2;
}
```

Legacy payloads continue to work for one release:

```ts
interface ProductEditRequestLegacy {
  mode?: "legacy";
  baseline?: ItemSnapshot;
  patch: GmItemPatch | TextbookPatch;
  isTextbook?: boolean;
}
```

The route parses both, normalizes once, and only then calls the Prism updater.

---

## Testing Strategy

Phase 4 should add coverage in four layers:

- unit: mode resolver and patch normalization
- unit: v2 field builders / tab defaults
- route integration: `GET /api/products/[sku]` and `PATCH /api/products/[sku]` v2 request handling
- component integration: page -> dialog mode selection, refs-unavailable fallback, and v2 tab rendering

At least one page-level test should prove:
- v2 is used when the flag is on and the selection is GM-only
- legacy remains used for textbook selections

---

## Rollout / Fallback

This phase intentionally ships with two fallback paths:

1. environment default can keep legacy on by default until we want to flip it
2. `?editDialog=legacy` gives an operator-level emergency escape hatch during the first release

After one release cycle with no meaningful regressions, the legacy implementation can be removed in a later cleanup pass.

---

## Acceptance

Phase 4 is done when:

- GM selections open a tabbed v2 dialog when the flag is enabled
- textbook selections still have a safe legacy path
- the route accepts the new typed payload shape
- label-backed selects are used for the refs already available in Phase 2
- local `ship-check` passes
- the branch is merged and live in production with a documented fallback still available
