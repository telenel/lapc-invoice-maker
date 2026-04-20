# Item Editor Parity — Phase 7 Design Spec

**Date:** 2026-04-20
**Branch (planned):** `feat/item-editor-parity-phase-7`
**Status:** Drafted for execution
**Parent spec:** `docs/superpowers/specs/2026-04-19-item-editor-parity-design.md`
**Prerequisite:** Phase 6 merged to `main` as PR #221 on April 20, 2026

---

## Goal

Ship keyboard-first inline row edits on the products table for the five high-cadence fields the master spec called out:

- retail
- cost
- barcode
- discontinue
- tax type

Phase 7 should let an operator stay in the table for quick corrections instead of selecting a row, opening the dialog, editing one field, and closing it again.

---

## Why This Phase Exists

Phases 4–6 brought the modal editor close to PrismCore parity, but the products page still forces a full dialog round-trip for the most common one-field fixes. That keeps laportal slower than the legacy workflow in exactly the moments where it should feel fastest:

1. correcting a retail or cost typo
2. pasting a barcode onto one row
3. toggling discontinue without leaving the browse context
4. flipping tax type after spotting a misclassified row

Phase 7 closes that gap without touching the larger bulk-edit redesign from Phase 8.

---

## Hard Rules

These stay non-negotiable throughout Phase 7:

1. `PBO` (`LocationID = 5`) remains excluded.
2. Inline edits use the existing `PATCH /api/products/[sku]` transactional paths. No new ad-hoc write surface.
3. Retail and cost inline edits are scoped to the current primary location from the page location picker.
4. Barcode, discontinue, and item tax type remain global item fields.
5. Labels, never numeric IDs, for tax types.
6. Mobile stays read-only in this phase; desktop table gets the inline edit surface.
7. Only one inline cell may be editing at a time.

---

## Current Code Reality

Phase 7 starts from the Phase 6 `main` state:

- `src/components/products/product-table.tsx` renders a read-only desktop table plus selection behavior, but no cell-level interaction beyond sorting, row selection, and variance popovers.
- `src/app/products/page.tsx` already knows the current `primaryLocationId`, the selected rows, Prism availability, and the `v2` edit route.
- `src/domains/product/api-client.ts` already exposes `productApi.update()` and the `v2` payload shape needed for single-field saves.
- `PATCH /api/products/[sku]` already supports `primaryInventory.retail`, `primaryInventory.cost`, `item.barcode`, `item.fDiscontinue`, and `item.itemTaxTypeId`.
- There is no row-level inline edit state, keyboard traversal model, or pending/saving affordance for per-cell writes.
- The table does not currently surface tax type or discontinue as visible columns, so Phase 7 has to add a compact affordance for both.

That means the write path is already there. Phase 7 is almost entirely a products-page UI/state-management phase.

---

## Recommended Approach

Add inline editing as a focused controller layer on top of the existing table instead of trying to teach `EditItemDialogV2` to masquerade as a row editor.

Use three seams:

1. a page-owned inline edit controller that knows the current table rows, current primary location, and how to save one field through `productApi.update()`
2. compact cell renderers in `ProductTable` for money, text, boolean, and tax-type edits
3. a keyboard-navigation model that commits one cell and advances to the next editable cell without opening a dialog

Why this approach:

- it reuses the already-shipped `v2` write path
- it keeps ProductTable declarative while moving the save/focus orchestration into a smaller unit
- it lets Phase 8 reuse the same “single field, single patch” thinking for the bulk-edit field picker

---

## Scope

### In scope

- Desktop-table inline edit affordances for:
  - retail
  - cost
  - barcode
  - discontinue
  - item tax type
- Compact tax-type and discontinue columns in the desktop table
- Row-level save state with pending/saving affordances
- Keyboard flow:
  - `Enter` commits the current cell
  - `Esc` cancels and restores the original value
  - `Tab` commits and moves to the next editable cell
  - `Shift+Tab` commits and moves to the previous editable cell
- Primary-location-aware retail and cost updates
- Refetch after save so location variance badges and derived values stay truthful
- Regression coverage for selection-vs-edit interaction and keyboard behavior

### Out of scope

- Mobile inline editing
- DCC, vendor, textbook metadata, or inventory advanced fields as inline edits
- Multi-cell draft mode or spreadsheet-style mass editing
- Any bulk-edit redesign work from Phase 8
- Creating new save pipelines beyond the existing `PATCH /api/products/[sku]`

---

## Data Contract

Phase 7 intentionally reuses the Phase 6 `v2` payload.

### Inline save payloads

Retail / cost:

```ts
{
  mode: "v2",
  patch: {
    primaryInventory: {
      retail?: number;
      cost?: number;
    },
  },
  baseline: {
    sku,
    retail,
    cost,
    barcode,
    fDiscontinue,
  },
}
```

Barcode / discontinue / tax type:

```ts
{
  mode: "v2",
  patch: {
    item: {
      barcode?: string | null;
      fDiscontinue?: 0 | 1;
      itemTaxTypeId?: number | null;
    },
  },
  baseline: {
    sku,
    retail,
    cost,
    barcode,
    fDiscontinue,
  },
}
```

Phase 7 should not invent a separate inline-edit endpoint.

---

## UI Behavior

### Editable cells

Each editable desktop cell has two states:

- resting: value rendered as a compact button-like surface with subtle hover affordance
- editing: an input, toggle, or select replaces the static value in-place

Clicking an editable cell enters edit mode and must **not** toggle row selection.

### Column treatment

Retail and cost remain where they are today and become editable.

Barcode remains the identity column for merchandise rows and becomes editable where visible.

Tax type and discontinue become compact always-visible columns on desktop:

- `Tax Type` uses the ref-data label, not the numeric ID
- `Disc` is a narrow yes/no control showing current state clearly

These columns should stay compact enough that the table remains browse-first.

### Save and failure behavior

Text-like cells (`retail`, `cost`, `barcode`):

- open with the current value selected
- `Enter` saves
- `Esc` cancels
- `Tab` / `Shift+Tab` save then move focus

Discrete controls:

- tax type commits immediately when a new option is selected
- discontinue commits immediately when toggled

While saving:

- the active cell is disabled
- a compact spinner or muted “saving” affordance appears in-cell
- no second cell can enter edit mode

If save fails:

- show a toast with the route error
- keep the editor open with the draft value intact so the operator can retry or cancel

### Keyboard traversal

Editable desktop columns follow visual order:

1. Tax Type
2. Cost
3. Retail
4. Barcode
5. Disc

`Tab` advances through that order on the current row.

If the current cell is the last editable cell on a row and the next table row exists, `Tab` should open the first editable cell on the next row.

`Shift+Tab` mirrors that behavior in reverse.

If there is no next or previous editable cell, commit and exit edit mode.

### Location semantics

Retail and cost inline edits always target the current primary location from the page picker.

If multiple locations are selected and the row shows a `+N varies` badge, Phase 7 still edits only the primary location value. The variance popover remains read-only context.

Global fields (`barcode`, `tax type`, `discontinue`) do not depend on location scope.

---

## Testing Strategy

Follow TDD. Required coverage:

- ProductTable render tests for the new tax-type and discontinue columns
- inline-edit interaction tests proving editable-cell clicks do not toggle row selection
- keyboard tests for `Enter`, `Esc`, `Tab`, and `Shift+Tab`
- page-level integration tests showing the correct `productApi.update()` payload per field type
- regression tests proving retail/cost writes use the current primary location instead of hard-coding `PIER`

---

## Ship Notes

Phase 7 still ships through the normal path:

- `npx prisma generate`
- `bash ./scripts/ship-check.sh`
- push branch
- PR to `main`
- merge after green CI
- verify `https://laportal.montalvo.io/api/version`

No Prisma migration is expected in this phase.
