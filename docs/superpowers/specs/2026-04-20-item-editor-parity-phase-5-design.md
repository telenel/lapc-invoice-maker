# Item Editor Parity — Phase 5 Design Spec

**Date:** 2026-04-20
**Branch (planned):** `feat/item-editor-parity-phase-5`
**Status:** Drafted for execution
**Parent spec:** `docs/superpowers/specs/2026-04-19-item-editor-parity-design.md`
**Prerequisite:** Phase 4 merged to `main` as PR #219 on April 20, 2026

---

## Goal

Ship the first real multi-location inventory editor inside the Phase 4 dialog shell.

Phase 5 adds:
- an `Inventory` tab on `EditItemDialogV2`
- a per-location sub-switcher for `PIER`, `PCOP`, and `PFS`
- copy-to-other-locations shortcuts for the highest-cadence inventory fields
- a typed multi-location inventory patch path from client to route to Prism
- Supabase detail hydration that reads all three Pierce inventory rows for the selected SKU

Phase 5 explicitly does **not** add:
- textbook-field expansion
- add-item redesign
- inline row edits
- bulk-edit field picking
- any `PBO` (`LocationID = 5`) data

This phase is about making the single-item editor genuinely multi-location without pulling the textbook/add/bulk scopes forward.

---

## Why This Phase Exists

Phase 4 gave us the right shell:
- a real `v2` dialog path
- typed write buckets
- single-item detail hydration
- a safe legacy fallback

But it still writes inventory fields through a Pierce-only abstraction:
- `ProductEditPatchV2` only carries `primaryInventory`
- `prism-updates.ts` hardcodes `LocationID = 2`
- the detail route only hydrates one flat retail/cost snapshot
- the dialog has no place to inspect or edit `PCOP` and `PFS`

That means the browse surface now understands multiple locations while the editor still collapses the item back to one location. Phase 5 is the seam where reads and writes finally meet.

---

## Hard Rules

These remain non-negotiable throughout Phase 5:

1. `PBO` (`LocationID = 5`) stays excluded from reads, writes, and UI.
2. Inventory editing stays single-item only in this phase. Bulk edit remains on the existing path until Phase 8.
3. Textbook selections still stay on the legacy path until Phase 6.
4. Labels, never numeric IDs, for tag types and status codes.
5. The server must reject any out-of-scope location or textbook `v2` inventory write even if the UI tries to send one.

---

## Current Code Reality

Phase 5 has to work with the code merged in Phase 4:

- `src/components/products/edit-item-dialog-v2.tsx` only renders `Primary`, `More`, and `Advanced`.
- `FormState` is flat and only models one `retail` / `cost` pair.
- `src/app/products/page.tsx` does not pass the selected top-of-page location scope into the dialog.
- `src/domains/product/types.ts` defines `ProductEditPatchV2` with `item`, `gm`, and `primaryInventory` only.
- `src/app/api/products/[sku]/route.ts` reads detail from `products` alone and PATCH-normalizes only a single-location inventory write bucket.
- `src/domains/product/prism-updates.ts` writes inventory fields only to `PIERCE_LOCATION_ID`.
- `product_inventory` already has the Phase 1 schema we need: `retail_price`, `cost`, `expected_cost`, `tag_type_id`, `status_code_id`, `est_sales`, `est_sales_locked`, `f_inv_list_price_flag`, `f_tx_want_list_flag`, `f_tx_buyback_list_flag`, and `f_no_returns`.

That is good news: the storage model already exists. Phase 5 is mostly a contract and UI cutover.

---

## Recommended Approach

Keep the current wrapper and legacy fallback intact, but expand the `v2` single-item path in four coordinated layers:

1. Extend the detail read model so the dialog gets all three inventory slices from Supabase in one response.
2. Replace the Pierce-only `primaryInventory` write bucket with a location-aware inventory patch list while keeping backward compatibility for the Phase 4 client contract.
3. Add an `Inventory` tab to `EditItemDialogV2` for single-item GM flows only.
4. Teach the `Primary` tab to treat retail/cost as the current page's primary location instead of always meaning Pierce.

Why this approach:
- it preserves the safe fallback from Phase 4
- it lets the page stay the owner of location scope
- it avoids inventing a second route just for inventory details
- it keeps the inventory-tab scope cleanly separated from later textbook/add/bulk work

---

## Scope

### In scope

- Extend `ProductEditDetails` with per-location inventory slices for `PIER`, `PCOP`, and `PFS`
- Add a typed `InventoryPatchPerLocation[]` contract for `v2` single-item saves
- Keep Phase 4 `primaryInventory` payload support as a backward-compatible alias during rollout
- Add `Inventory` to the `v2` tab list for single-item non-textbook edits
- Add a location sub-switcher inside the inventory tab
- Add copy-to-other-locations actions for:
  - retail
  - cost
  - tag type
  - status code
- Show label-backed controls for tag type and status code
- Show the location scope indicator that makes it clear `Primary` retail/cost edits affect only the current primary location
- Mirror successful inventory writes back into Supabase `product_inventory`

### Out of scope

- textbook author/title/ISBN/binding editing
- add-item multi-location creation
- inventory advanced fields beyond the core high-cadence set
- inline table-cell editing
- bulk multi-location editing

---

## Data Contract

### Detail read model

Phase 5 should keep the existing global `ProductEditDetails` fields but add a per-location inventory array:

```ts
interface ProductInventoryEditDetails {
  locationId: 2 | 3 | 4;
  locationAbbrev: "PIER" | "PCOP" | "PFS";
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

And:

```ts
interface ProductEditDetails {
  // existing Phase 4 fields...
  inventoryByLocation: ProductInventoryEditDetails[];
}
```

Detail reads should return all three Pierce locations in canonical order, even if some values are null. That keeps the UI deterministic and makes copy actions straightforward.

### Write model

Add a real location-aware inventory patch type:

```ts
interface InventoryPatchPerLocation {
  locationId: 2 | 3 | 4;
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
interface ProductEditPatchV2 {
  item?: ItemPatch;
  gm?: GmDetailsPatch;
  primaryInventory?: PrimaryInventoryPatch; // backward-compatible alias
  inventory?: InventoryPatchPerLocation[];
}
```

Server normalization rule:
- if `inventory` is present, use it
- otherwise, map `primaryInventory` to one patch entry for `locationId = 2`

That preserves the Phase 4 client behavior while letting Phase 5 expand safely.

---

## UI Behavior

### Single-item only

The new inventory tab should render only when:
- `mode === "v2"`
- exactly one item is selected
- the selected SKU is not a textbook

Bulk mode stays on the existing sparse-edit flow. That keeps Phase 5 focused and avoids inventing bulk semantics before Phase 8.

### Inventory tab layout

Top strip:
- `PIER`
- `PCOP`
- `PFS`

The active button controls which location slice is being edited.

Core fields for the active location:
- Retail
- Cost
- Expected Cost
- Stock on Hand (read-only)
- Last Sale Date (read-only)
- Tag Type
- Status Code
- Estimated Sales
- Estimated Sales Locked
- Use inventory list price on price tag
- Want List
- Buyback List
- No Returns

Copy controls:
- next to retail, cost, tag type, and status code
- one click copies the current location's value to the other two Pierce locations in local form state
- copy is UI-only; the server still receives explicit per-location patches

### Primary-tab location semantics

Phase 4 still treats `Primary` retail/cost as a flat pair. Phase 5 should make that pair correspond to the page's primary location:

- if top-of-page picker is `PIER, PCOP, PFS`, `Primary` retail/cost edits `PIER`
- if the picker is `PCOP, PFS`, `Primary` retail/cost edits `PCOP`
- if the picker is `PFS`, `Primary` retail/cost edits `PFS`

The page should pass the current canonical `locationIds` into the dialog so the dialog can compute the primary location without guessing.

The `Primary` tab should show a short scope note, for example:
- `Editing retail/cost for PIER`

---

## Server Behavior

### Detail GET

`GET /api/products/[sku]` should:
- keep the existing auth and SKU validation behavior
- read the global fields from `products`
- read `product_inventory` rows for `location_id IN (2, 3, 4)`
- return `inventoryByLocation` in canonical order

This route must remain Supabase-only and must not import Prism on `GET`.

### PATCH

`PATCH /api/products/[sku]` should:
- keep rejecting textbook `v2` writes
- reject any `inventory` entry whose `locationId` is not `2`, `3`, or `4`
- reject duplicate `locationId` entries in the same payload
- reject a `v2` body that has no writable fields across `item`, `gm`, and `inventory`

Successful writes should:
- dispatch item/global fields exactly as Phase 4 does
- dispatch each inventory patch entry to Prism by location
- mirror touched per-location fields back into `product_inventory`
- keep mirroring Pierce (`LocationID = 2`) retail/cost into the legacy flat `products` columns for compatibility

---

## Testing

Phase 5 needs focused coverage in four places:

1. `tests/app/api/product-detail-route.test.ts`
   - inventory detail rows come back in canonical order
   - GET stays Prism-free

2. `tests/app/api/product-patch-route-v2.test.ts`
   - location-aware `inventory` payloads normalize correctly
   - invalid/duplicate locations are rejected
   - Supabase mirror writes the right `(sku, location_id)` rows

3. `src/components/products/edit-item-dialog-v2.test.tsx`
   - `Inventory` tab renders for eligible single-item `v2`
   - primary location note reflects page scope
   - copy-to-other-locations updates the other slices in form state
   - tag/status selects keep labels visible when refs are available

4. `src/__tests__/products-page-edit-dialog-mode.test.tsx`
   - page passes location scope into the dialog
   - single-item v2 save still triggers browse refetch after multi-location edits

---

## Risks And Guardrails

### Risk 1: Phase 5 quietly reintroduces Pierce-only semantics

Guardrail:
- any single-item `v2` inventory save test should include at least one non-PIER location patch

### Risk 2: The dialog loses edits when switching locations

Guardrail:
- keep inventory form state keyed by location and test switching back and forth before save

### Risk 3: Flat-column mirror becomes misleading

Guardrail:
- only update `products.retail_price` / `products.cost` from the Pierce slice
- do not let `PCOP` / `PFS` writes rewrite the legacy flat columns

### Risk 4: Phase 5 expands into textbook or bulk-edit scope

Guardrail:
- keep textbook on legacy
- keep bulk on the existing sparse-edit path

---

## Done Means

Phase 5 is done when:
- a single GM SKU can open the `Inventory` tab in `v2`
- the operator can switch among `PIER`, `PCOP`, and `PFS`
- retail/cost on the `Primary` tab map to the page's primary location
- inventory edits can touch one or multiple Pierce locations in one save
- copy-to-other-locations works for the four target fields
- `ship-check` passes
- the PR merges and production is verified live on the new build SHA
