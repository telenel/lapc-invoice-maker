# Item Editor Parity — Design Spec

**Date:** 2026-04-19
**Branch (proposed):** `feat/item-editor-parity` (cut from `main` at implementation time; not started yet)
**Status:** Design drafted, awaiting Marcos's review before the plan is written
**Prerequisite:** Current products page (PRs #162, #170, #173, #175, #180)
**Supersedes scope of:** the "edit is the gap" bullet from the 2026-04-16 session notes

---

## Goal

Make laportal's products page the **preferred** tool for managing Pierce's item catalog — faster, quieter, and more pleasant than PrismCore for the common tasks (add, edit one, edit many, browse, search) while retaining the full editing surface PrismCore provides for the rare ones.

Concretely:
- Expand the editable field set from today's ~14 fields to the **full Item + Inventory + Textbook surface** (~60 editable fields).
- Surface the **Pierce-populated** fields first (primary tab, inline row edits). Tuck rarely-used fields under **More** and **Advanced** toggles — still editable, just not in the way.
- Support **multi-location** editing across PIER (2), PCOP (3), and PFS (4). PBO (5) stays excluded.
- Preserve the read-only-Prism safety posture: writes go through existing `prism-updates.ts` / `prism-server.ts` transactional paths, never as ad-hoc SQL.

Non-goals (explicitly deferred):
- Multi-location UI for PBO or any non-Pierce location.
- Style/Matrix parent SKU editing (size × color grid expansion) — own spec later.
- Warranty tab — own spec later.
- Package (Pkg) sub-items as a distinct concept — own spec later.
- GM Advanced Item Maintenance flows (rental agreement, serial-number enrollment, margin recalc wizard) — own spec later.
- EDI / PO / MR receiving — separate domain, separate spec.
- Textbook adoption / buyback / rental workflows — separate domain.

---

## Background and context

### How the current editor falls short

Today's `EditItemDialog` edits 14 of the ~60 fields Prism exposes. The `NewItemDialog` asks for 11. Operators who need a field that isn't there fall back to PrismCore, which is the problem the whole product exists to solve. Edits are modal-only — no inline row editing. Bulk edit dumps every field into one form and asks the user to fill what they want changed, which doesn't scale past a handful of fields.

### What PrismCore looks like

The WinPRISM desktop client and WPAdmin admin tool, together, expose an Item Maintenance screen with hundreds of fields across tabs (Item, Inventory, Textbook-specific, Warranty, Pkg, Style, Matrix, GM-Advanced). The field catalog is documented in the bundled `.chm` help files (`Field_Definitions/Item_Field_Definitions/` has 94 field pages, `Inventory_Field_Definitions/` has ~83, `GM_Advanced_Item_Maintenance/` has 34). Capability is enormous; UX is 1990s-era.

### What Pierce actually edits

A read-only fill-rate snapshot (`docs/prism/field-usage.md`, generated 2026-04-19) measured every candidate editable column on Item / GeneralMerchandise / Textbook / Inventory against the Pierce-scoped universe (LocationID IN 2, 3, 4). Output: which fields are populated on what fraction of Pierce rows. This is the source of truth for the primary-vs-advanced partition below.

Key findings:
- **33,340 GM items, 572 active textbooks** (textbook = sold at Pierce within 18 months).
- A small cluster of fields is populated on >90% of items (description, vendor, DCC, tax type, barcode, retail, cost).
- A tail of ~20 fields is effectively unused (<1%) but must remain editable for PrismCore-parity edge cases.
- 100%-populated fields like `TagType` and `PackageType` are **not** pure defaults — they show real distribution of values, so they merit a labeled dropdown rather than a hide-behind-advanced.

---

## Principles

These override any implementation instinct toward mirroring PrismCore:

1. **Narrow before wide.** Populate the primary tab with the fields Pierce uses every day. Rarely-used fields are still editable, just behind **More** or **Advanced** toggles.
2. **Full capability, narrow default surface.** Every PrismCore field stays editable in the portal. Only the prominent display differs.
3. **Inline row edits for high-cadence fields.** Retail, cost, barcode, discontinue — editable directly in the products table row. One click, one keystroke, one Enter. No modal.
4. **Short forms by default.** The add-item form opens with 5 fields; "Expand" reveals more. The edit dialog shows ~10 fields on primary; tabs reveal the rest.
5. **Field-picker for bulk edit.** Never show the user 60 blank inputs. Pick the field first, then fill only that.
6. **Labels, not IDs.** Tag types, tax types, status codes, package types, vendors, DCCs, colors, bindings — always display the Description, never the numeric ID. (See `feedback_show_labels_not_ids.md` in global memory.)
7. **Keyboard-first.** Tab through forms, Enter to save, Esc to cancel, Cmd+K to search items, J/K to navigate rows.
8. **Read-only Prism by default.** The shipped write paths (`createGmItem`, `updateGmItem`, `discontinueItem`, `deleteTestItem`) stay. No new arbitrary-SQL write surfaces. (See `feedback_prism_readonly.md`.)
9. **PBO excluded, always.** `LocationID IN (2, 3, 4)`. Never 5. (See `feedback_pbo_excluded.md`.)

---

## Scope

### In scope (this spec)

- **Multi-location portal** — PIER + PCOP + PFS stocked, synced, edited. Top-of-page location picker. PBO hard-excluded.
- **Normalized schema** — split `products` (global) from `product_inventory` (per-SKU-per-location).
- **Expanded sync** — `prism-sync.ts` pulls all three Pierce locations, shreds into the two Supabase tables. Reap logic updated.
- **Edit dialog, tabbed** — Primary / Inventory / (Textbook, when applicable) / More / Advanced. All ~60 fields addressable.
- **Add dialog, short-by-default** — 5-field default, Expand reveals additional optional fields. Multi-location checkbox row.
- **Inline row edits** — retail, cost, barcode, discontinue toggle, tax-type dropdown on the products table.
- **Bulk edit, field-picker** — pick fields, then fill only those, apply to selected rows.
- **Ref data expansion** — `/api/products/refs` returns labeled TagType, StatusCode, PackageType, Color, Binding in addition to the current Vendor/DCC/TaxType.
- **Textbook-specific editing** — author, title, ISBN, edition, binding, imprint, copyright become editable (were read-only). Guarded by `isTextbook`.

### Out of scope (deferred)

- Style parent / Item Matrix editing (size × color grid) — ~18% of GM have SizeID/Color but they're entered flat today. Grid-style parent creation is its own workflow.
- Warranty tab (4 fields, <1% fill).
- Pkg (package) sub-items as their own concept (the PackageType + UnitsPerPack field pair *is* in scope; creating/editing a Package master item is not).
- GM Advanced Item Maintenance flows (rental agreement activation, serial-number enrollment, bulk margin recalc, bulk cost-from-PO).
- PO / MR / Receiving workflows.
- Textbook adoption / buyback / rental.
- Any location outside Pierce (PBO excluded per hard rule; non-Pierce campuses out of scope).

---

## Architecture

### 1. Location picker (top of products page)

Three-checkbox control above the filters bar: `[✓] PIER   [✓] PCOP   [✓] PFS`. Defaults to all on. Changes are persisted via saved view + URL query param (`loc=2,3,4`), so sharing a URL carries scope.

- **Table rows**: SKU appears if it has a `product_inventory` row at any selected location.
- **Retail / Cost / Stock columns**: show the value for the **single** selected location; when multiple are selected, show PIER's value and render a "+N" badge indicating values vary (hover or click expands to a 3-location popover).
- **Saved views** persist location selection in their filter payload. System presets default to all three but users can save their own "PCOP only" view.
- **Sync status chip** next to the location picker aggregates per-location freshness.

### 2. Schema split

**Before** (current):
- `products` table: one row per SKU, flat. `retail_price`, `cost`, `stock_on_hand`, `last_sale_date`, `vendor_id`, `dcc_id`, `item_tax_type_id`, metadata — all on one row. PIER-only.

**After**:
- `products` table — one row per SKU. **Global** catalog fields only: `sku`, `barcode`, `item_type`, `description`, `author`, `title`, `isbn`, `edition`, `binding_id`, `binding_label`, `copyright`, `imprint`, `vendor_id`, `alt_vendor_id`, `mfg_id`, `dcc_id`, `dept_num`/`class_num`/`cat_num` and labels, `item_tax_type_id`, `item_tax_type_label`, `catalog_number`, `comment`, `weight`, `image_url`, `size`, `size_id`, `color_id`, `units_per_pack`, `package_type`, `package_type_label`, `order_increment`, `style_id`, `item_season_code_id`, `type_gm`, `f_list_price_flag`, `f_perishable`, `f_id_required`, `disc_code_id`, `used_dcc_id`, `used_sku`, `text_status_id`, `status_date`, `book_key`, `type_textbook`, `discontinued`, `created_at`, `updated_at`, `synced_at`. Sales-aggregate columns (`units_sold_30d`, `revenue_30d`, etc.) stay here since they're SKU-global.
- `product_inventory` table — one row per `(sku, location_id)`. **Per-location** fields: `sku`, `location_id`, `location_abbrev`, `retail_price`, `cost`, `expected_cost`, `stock_on_hand`, `tag_type_id`, `tag_type_label`, `status_code_id`, `status_code_label`, `tax_type_override_id`, `disc_code_id`, `min_stock`, `max_stock`, `auto_order_qty`, `min_order_qty`, `hold_qty`, `reserved_qty`, `rental_qty`, `est_sales`, `est_sales_locked`, `royalty_cost`, `min_royalty_cost`, `f_inv_list_price_flag`, `f_tx_want_list_flag`, `f_tx_buyback_list_flag`, `f_rent_only`, `f_no_returns`, `text_comment_inv`, `last_sale_date`, `last_inventory_date`, `create_date`, `synced_at`. Primary key `(sku, location_id)`; foreign key to `products(sku) ON DELETE CASCADE`.

Migration: backfill from the existing `products` flat table into both, preserving all current PIER data verbatim. Then the sync can start populating PCOP and PFS rows. No data loss.

The label columns (`*_label`, e.g., `tag_type_label`, `item_tax_type_label`, `status_code_label`, `package_type_label`, `binding_label`) are **denormalized copies** of the Description from Prism ref tables, refreshed each sync. This keeps the product queries cheap (no join to ref tables at read time) and keeps UI fast without a separate ref-lookup round trip. Trade-off: slight duplication; refreshed on every sync so drift is bounded to one sync interval.

### 3. Sync expansion

`src/domains/product/prism-sync.ts` changes:
- **SELECT scope broadens** from `Inventory.LocationID = @loc` (hard-coded 2) to `Inventory.LocationID IN (2, 3, 4)`.
- **Join the ref tables** for Description labels: `TagType`, `Item_Tax_Type`, `Status_Codes` (discover exact table name during implementation), `PackageType`, `Textbook_Binding` (discover) — denormalize the trimmed Description into the `*_label` columns.
- **Hash-compare** per row uses a canonical JSON that includes the location_id so per-location rows hash independently.
- **Reap** — a SKU+location combo that was present last sync and missing this sync → delete that `product_inventory` row. A SKU that has zero Pierce inventory rows after reap → delete the `products` row (existing reap logic, same trigger).
- **Textbook-active refresh window** stays 18 months (matches the fill-rate snapshot definition, and mirrors operational reality — Pierce's textbook activity is dominated by the last few terms).

Expected sync runtime: +30–60s over today's PIER-only sync (rough estimate, based on the PCOP/PFS row counts — ~36k additional inventory rows). Acceptable; still well under the existing sync-health budget.

### 4. Edit dialog — tabbed, `EditItemDialog` v2

Single dialog, one flat patch object on submit. Tabs are pure UI scaffolding; the patch is a flat `GmItemPatch` or `TextbookPatch` plus a new per-location `InventoryPatch` (see §5 Data model).

**Tab: Primary** (always visible; first to open)

10 fields, one screen, no scrolling needed at 1280×800:

- Description (GM) **or** Title + Author + ISBN + Edition + Binding dropdown (Textbook) — type switch at top of dialog
- Barcode
- DCC (labeled dropdown, type-ahead)
- Vendor (labeled dropdown, type-ahead)
- Item Tax Type (labeled dropdown; **sorted by Pierce usage** — "STATE" (79%) first, then "NOT TAXABLE" (21%), then "10.50% TAX", then "9.75%")
- Retail (primary location; see §4.1 below)
- Cost (primary location)
- Discontinue toggle
- Catalog # (GM only) / Imprint + Copyright (Textbook optional)
- Item comment (`txComment`, 25 char)

**Tab: Inventory** (location-scoped; visible when editor is open for any item)

Displays a **location sub-switcher** at the top of the tab — three buttons "PIER • PCOP • PFS". All three switchable without leaving the dialog. Patch accumulates location-keyed changes. "Copy to other locations" button on retail, cost, tag type, status code for quick replication.

Fields (labeled, always showing Description not ID):
- Retail (per location)
- Cost (per location)
- Expected Cost
- Stock on Hand (read-only)
- Last Sale Date (read-only)
- Tag Type (labeled dropdown, sorted by Pierce usage — `LARGE w/Price/Color` first at 40%, then the top ~10 Pierce-used tags; rest under "Show all")
- Status Code (labeled dropdown)
- Estimated Sales + Locked flag (textbook-leaning; shown for all)
- List-price toggle (`fInvListPriceFlag`) — **open question on label**, see §13; interim label: "Use inventory list price on price tag" with a ? tooltip noting behavior is under verification
- Want List flag (`fTXWantListFlag`) — textbook only
- Buyback List flag (`fTXBuybackListFlag`) — textbook only
- No Returns flag
- Package Type + Units per Pack (GM only, labeled dropdown sorted EA > CS > BX > PK > CT > DZ > JR > RL > TB > YD)

**Tab: Textbook** (visible only for textbook items — `item_type` starts with `textbook` or `used_textbook`)

Fields the textbook universe populates (per the snapshot):
- Author, Title, ISBN, Edition (all 90%+ filled)
- Binding (labeled dropdown)
- Imprint (39% filled — on this tab, not Primary, since it's secondary-importance)
- Copyright
- Used SKU linkage (if this is a new textbook with a paired used SKU)
- Text Status (for lifecycle tracking) + Status Date
- Image URL (rare, 0.3%)
- Bookkey (read-only; system-generated)
- Type (book-type label, rare on active textbooks)

**Section: More** (toggle inside the Primary tab, expands in place)

Medium-fill fields:
- Size + Color (GM)
- Manufacturer (labeled; only shows if distinct from vendor)
- Alternate Vendor
- Style ID
- GM Type (fabric/variant label)
- Weight
- Image URL
- Order Increment (default 1; expose when > 1)

**Section: Advanced** (collapsed by default, toggle inside the Inventory tab for per-location rare fields, and inside More for per-item rare fields)

Rare fields — still editable, just never in the way:
- Min Stock, Max Stock, Auto-Order Qty, Min Order Qty, Hold Qty
- Royalty Cost, Min Royalty Cost, Use Location Royalty
- Discount Code ID
- Reserved Qty (read-only; shows pending allocations), Rental Qty
- Used DCC ID
- Tax type override per location (`Inventory.TaxTypeID`) — noted as rarely used, label unknown for value 2/3 (open question §13)
- Perishable flag, ID Required flag, Rent Only flag
- Season Code
- List Price Flag on Item (`fListPriceFlag` — distinct from the Inventory version, 0% filled on GM)
- Text Comment (inventory-level, 256 char, 0% filled — hidden unless empty-state-tolerant)

#### 4.1 Retail / Cost handling across tabs

Retail and Cost appear on **both** Primary and Inventory tabs. The Primary tab shows the "primary location" values (which is the first checked location in the top-of-page picker — usually PIER). Editing retail on Primary writes to that single location. Editing retail on Inventory writes to whichever location the sub-switcher is pointed at, and a "Copy to other locations" button one-clicks the current value into the other two.

Why both: 80% of edits are "change PIER retail" — making Primary carry that field means most edits never touch the Inventory tab. But users who need to set different prices per location can still use Inventory's sub-switcher without mode-switching.

### 5. Data model — patch shapes

Current `GmItemPatch` and `TextbookPatch` in `src/domains/product/types.ts` are flat and conflate Item, GM, and Inventory columns. Refactor:

```ts
interface ItemPatch { // global, no location
  barcode?: string | null;
  vendorId?: number;
  altVendorId?: number;
  mfgId?: number;
  dccId?: number;
  usedDccId?: number;
  itemTaxTypeId?: number;
  txComment?: string | null;
  fDiscontinue?: 0 | 1;
  styleId?: number;
  itemSeasonCodeId?: number;
  fPerishable?: 0 | 1;
  fIdRequired?: 0 | 1;
  fListPriceFlag?: 0 | 1;
  discCodeId?: number;
  weight?: number;
  minOrderQty?: number;
}

interface GmPatch {
  description?: string;
  type?: string | null;
  colorId?: number;
  size?: string | null;
  sizeId?: number;
  catalogNumber?: string | null;
  packageType?: string | null;
  unitsPerPack?: number;
  imageUrl?: string | null;
  orderIncrement?: number;
  useScaleInterface?: 0 | 1;
  tare?: number;
  weight?: number;
  alternateVendorId?: number;
  mfgId?: number;
}

interface TextbookPatch {
  author?: string;
  title?: string;
  isbn?: string | null;
  edition?: string | null;
  bindingId?: number;
  imprint?: string | null;
  copyright?: string | null;
  textStatusId?: number;
  statusDate?: string | null;
  usedSku?: number;
  type?: string | null;
  bookkey?: string | null;
  weight?: number;
  imageUrl?: string | null;
}

interface InventoryPatchPerLocation { // one per (sku, locationId) touched
  locationId: 2 | 3 | 4;
  retail?: number;
  cost?: number;
  expectedCost?: number;
  tagTypeId?: number;
  statusCodeId?: number;
  taxTypeId?: number;
  discCodeId?: number;
  minStock?: number;
  maxStock?: number;
  autoOrderQty?: number;
  minOrderQty?: number;
  holdQty?: number;
  estSales?: number;
  estSalesLocked?: 0 | 1;
  royaltyCost?: number;
  minRoyaltyCost?: number;
  fInvListPriceFlag?: 0 | 1;
  fTxWantListFlag?: 0 | 1;
  fTxBuybackListFlag?: 0 | 1;
  fRentOnly?: 0 | 1;
  fNoReturns?: 0 | 1;
  textCommentInv?: string | null;
}

interface ItemSnapshotV2 {
  sku: number;
  barcode: string | null;
  fDiscontinue: 0 | 1;
  itemTaxTypeId: number;
  // Per-location retail / cost / tagTypeId / statusCodeId for any location
  // whose inventory is being edited in this payload.
  locations: Array<{
    locationId: 2 | 3 | 4;
    retail: number;
    cost: number;
    tagTypeId: number;
    statusCodeId: number;
  }>;
}

interface EditItemPayload {
  sku: number;
  baseline: ItemSnapshotV2; // concurrency check, extended from today's global shape
  item?: ItemPatch;
  gm?: GmPatch;
  textbook?: TextbookPatch;
  inventory?: InventoryPatchPerLocation[]; // 0-3 entries; locationId must be in {2,3,4}
}
```

The server (`prism-updates.ts`) runs a single transaction that updates Item / GM / Textbook / Inventory in order, identical to today's pattern but with a broader field set and multiple Inventory UPDATEs. Existing verify-then-assume (row exists before update, commit implies success because Item triggers break `@@ROWCOUNT`) stays.

### 6. Add dialog — `NewItemDialog` v2

Default-visible fields (5):
- Description
- DCC
- Vendor
- Retail
- Cost

"Expand for more options" reveals:
- Barcode (auto-gen if blank + system param set)
- Tax Type (default: STATE)
- Catalog #
- Package Type + Units per Pack (GM)
- Image URL
- Size / Color (GM)
- For textbooks: Title, Author, ISBN, Edition, Binding, Imprint, Copyright

**Location checkboxes** (always visible at bottom of dialog): `[✓] PIER  [ ] PCOP  [ ] PFS`. Default PIER only. When PCOP or PFS are checked, additional retail/cost fields appear per location with a "Copy from PIER" shortcut button.

On submit: one transaction creating Item + GM (or + Textbook) + N Inventory rows (one per checked location).

### 7. Bulk edit — `BulkEditDialog` v2 (field-picker)

Launched from a selection (existing "N selected" bar gains a "Bulk edit" button).

Flow:
1. User clicks Bulk edit with 5+ rows selected.
2. Dialog opens with a searchable field picker: "Which fields do you want to change?" Shows all ~60 fields grouped (Primary / Inventory / More / Advanced), with the fill-rate % next to each as a hint.
3. User ticks 1–5 fields (practical cap enforced; more than 5 is usually a sign you want a CSV import).
4. Inputs appear only for the ticked fields.
5. User fills values; "Apply to N items" button runs the batch update.
6. Result screen shows success count + any per-row errors.

For Inventory fields, the dialog asks "Which location?" and applies the change only to that location (or all three, if "All locations" is selected). The existing `prism-batch.ts` path extends to handle the location dimension.

### 8. Inline row edits in `ProductTable`

High-cadence fields (retail, cost, barcode, discontinue toggle, tax type dropdown) become click-to-edit directly in the table cell:

- Click cell → input appears in-place with current value selected.
- Enter → save via `PATCH /api/products/[sku]` with a minimal patch object. Cell optimistically updates; row highlights green on success, red + revert on error.
- Esc → cancel.
- Tab/Shift-Tab → move focus to next/previous editable cell.
- Cmd+S on a field also saves.

Concurrency check: the baseline snapshot in the patch is the value the user saw before editing. If Prism's row has changed since (someone else edited via PrismCore), server returns 409 + current values, cell revert + toast "someone else changed this — reloaded."

The retail and cost cells require a location context — since the selected location picker at the top of the page determines which location's value is shown, it also determines which location the inline edit writes to.

### 9. Reference-data API expansion

`GET /api/products/refs` today returns `{ vendors, dccs, taxTypes }`. Add:
- `tagTypes: { id, label, subsystem }[]` — joined from `TagType`, trimmed Description, filtered to those Pierce actually uses (by the fill-rate snapshot) then rest; sorted by Pierce usage.
- `statusCodes: { id, label }[]` — joined from `Status_Codes` (or whichever ref table survives discovery).
- `packageTypes: { code, label, defaultQty }[]` — from `PackageType` table.
- `colors: { id, label }[]` — discover table; `GeneralMerchandise.Color` is int, so there's a Color ref somewhere.
- `bindings: { id, label }[]` — for textbooks; discover `Textbook_Binding` or similar.

Cached with the existing `Cache-Control: private, max-age=60` — these change rarely.

---

## User flows

### Flow A — Edit retail on 3 items (the daily case)

1. Operator filters products page to a preset.
2. Clicks the retail cell on row 1 → types new value → Enter → row flashes green.
3. Clicks next row's retail cell (or Tab) → types → Enter.
4. Repeats for row 3.
5. Total keystrokes: ~12 (3 × 4 keystrokes per edit including navigation). Total clicks: 3 (one per cell), Tab can replace clicks.

Today (PrismCore): open Item, open Inventory tab, change retail, save, close; repeat 3x.

### Flow B — Add a new GM item (Pierce-only, common)

1. Operator clicks "Add item" → dialog opens with 5 fields focused on Description.
2. Types description, Tab → DCC search, Enter → Vendor search, Enter → retail → cost → Enter.
3. Dialog closes; new item appears in table.
4. Total keystrokes: ~20 (name + 4 field values).

Today (PrismCore): Item Maintenance → Hammer menu → Add New Item → 12-field dialog → Copy/Add Inventory dialog → Update → Close. ~40 keystrokes + several mouse waypoints.

### Flow C — Bulk-change tag type on 50 items (end-of-term relabeling)

1. Operator filters to DCC "textbooks" → select all visible → Bulk edit.
2. Field picker: search "tag" → tick "Tag Type".
3. Dropdown shows 10 Pierce-used tag types; picks "SMALL w/Price".
4. Location: "All locations" (default).
5. Apply to 50 items → confirmation → done.

Today (PrismCore): tag type bulk is not easy in PrismCore — typically requires a SQL script or 50 manual edits.

### Flow D — Edit a textbook's author + ISBN (uncommon but matters)

1. Row click → Edit dialog opens on Primary tab.
2. Because `item_type = 'textbook'`, Primary tab shows Title + Author + ISBN + Edition + Binding instead of Description + Catalog#.
3. User edits Author and ISBN → Save.
4. Textbook tab was never needed (Primary covered it); if they'd wanted to edit Imprint or Copyright, they'd click into Textbook tab.

---

## Validation and errors

Reuse the existing batch-validation and edit-validation paths in `src/domains/product/batch-validation.ts` — extend them for the new fields rather than writing a parallel validator. Key additions:
- Length caps on varchar fields (per the schema dump — e.g., Description 128, CatalogNumber 30, txComment 25, Author 45, Title 80).
- Numeric bounds: negative cost/retail rejected, negative stock tolerated (shrinkage), royalty > retail rejected.
- Referential integrity: vendor/dcc/tax-type/tag-type/status-code IDs must exist (server-side check against current refs).
- Concurrency: `baseline` field in the patch must match current values; 409 on mismatch, UI reverts.
- Location: `locationId` in any InventoryPatch must be in `{2, 3, 4}` (hard-coded reject on any other value as a PBO safety rail).

Errors propagate as `{ errors: [{ rowIndex, field, code, message }] }` as today.

---

## Testing strategy

Rigorously follow **TDD** per `superpowers:test-driven-development`. Key coverage:

- **Unit — patch builders** — `buildPatch(baseline, current)` for each of ItemPatch / GmPatch / TextbookPatch / InventoryPatchPerLocation.
- **Unit — validators** — every new validation rule, positive + negative.
- **Unit — ref-data sort order** — confirm tag types / tax types / package types come back sorted by Pierce usage.
- **Integration — sync** — mock Prism rows, confirm `products` vs `product_inventory` splits correctly, reaps work per-location.
- **Integration — edit API** — single-location edit, multi-location edit, no-op edit (empty patch returns fast), 409 on stale baseline.
- **E2E (Playwright) — inline edit flow** — click cell, type, Enter, confirm DB state.
- **E2E — Add dialog with multi-location** — check two locations, fill, confirm both `product_inventory` rows created.
- **E2E — Bulk edit field-picker** — select rows, pick field, fill, apply, verify.
- **Manual smoke** — exercise every primary-tab field once end-to-end against the dev Prism (read-only observation, see §Skills below — TDD handles most of it; this is the human-eyes check).

PR gate: `npm run ship-check` green, same as today.

---

## Phasing

Each phase is independently shippable and review-able:

**Phase 1 — Schema split + sync expansion** (2–3 PRs)
- 1a: `product_inventory` table migration; shred existing `products` rows into both tables; keep old `products` columns temporarily as a fallback (PIER values).
- 1b: `prism-sync.ts` expanded to LocationID IN (2,3,4) + ref-table joins for labels.
- 1c: Delete the old duplicated columns on `products` (once read path migrates to `product_inventory`).

**Phase 2 — Ref data expansion**
- `/api/products/refs` adds tagTypes / statusCodes / packageTypes / colors / bindings.
- All currently-shown IDs in the products table (if any) become labels.

**Phase 3 — Location picker + multi-location read surface**
- Top-of-page picker; URL state; saved views carry location.
- Products table columns reflect selected location; "+N varies" badge.
- No write changes yet — editor still PIER-only.

**Phase 4 — Edit dialog v2 (primary + more + advanced tabs)**
- Refactored patch types; server accepts new payload shape.
- Tabbed dialog with all new fields; labels-not-IDs everywhere.
- Behind a feature flag initially — old dialog stays reachable for fallback for one release.

**Phase 5 — Inventory tab (multi-location editor)**
- Per-location sub-switcher.
- "Copy to other locations" shortcut.
- `InventoryPatchPerLocation[]` path in API + server.

**Phase 6 — Textbook tab + Add dialog v2**
- Textbook-specific fields editable.
- Add dialog shrunk to 5 fields with Expand.
- Multi-location checkboxes on Add.

**Phase 7 — Inline row edits**
- Retail, cost, barcode, discontinue, tax-type all click-to-edit.
- Keyboard nav (Tab / Shift-Tab / Enter / Esc).

**Phase 8 — Bulk edit v2 (field picker)**
- Replace the current field-dump dialog.
- Location-aware for Inventory fields.

Total expected duration: 2–4 weeks of focused work; longer if interrupted. Each phase gets its own branch, PR, and ship-check gate.

---

## Skills to invoke during implementation

Once the spec is approved and the plan is written, the following skills guide implementation quality:

- **`superpowers:writing-plans`** — next, to produce a step-by-step implementation plan across the 8 phases.
- **`superpowers:test-driven-development`** — every phase. No implementation code without a failing test first.
- **`frontend-design:frontend-design`** — Phases 3–8, to produce distinctive, production-grade UI for the dialogs, inline edits, location picker, and bulk-edit flow. Avoids generic-AI aesthetics.
- **`web-design-guidelines`** — run against each UI PR before merge to check accessibility, keyboard-first behavior, touch-target sizing.
- **`vercel-react-best-practices`** — Phases 4–8, for performance (no unnecessary rerenders when typing in inline edit cells; React 19 patterns where applicable).
- **`vercel-composition-patterns`** — the tabbed `EditItemDialog`, `BulkEditDialog`, and location-scoped sub-switcher benefit from compound-component patterns.
- **`superpowers:systematic-debugging`** — when the sync-split migration hits an edge case or a Prism trigger behaves unexpectedly.
- **`superpowers:verification-before-completion`** — before every PR, run the checks and confirm output before claiming done.
- **`superpowers:requesting-code-review`** — request review on each phase PR.
- **`code-review:code-review`** and **`security-review`** — on each PR touching the write path or multi-location auth.

None of these is invoked during this brainstorm session. They attach to the implementation plan, not the spec.

---

## Open questions

**Q1. `Inventory.fInvListPriceFlag` semantics.**
The field is an 82%/18% flag. I don't know what toggling it controls — candidates: "use the Inventory.Retail value on the price tag vs a different source", "treat this item as list-priced for Buyer's Guide", "enable list-price discounting chain." Interim behavior: label the checkbox "Use inventory list price on price tag" with a ? tooltip. Confirm label and semantics during Phase 5 by observing a toggle from 1 → 0 in PrismCore on a test item and checking which downstream Prism table changes. (Read-only observation; no writes by the agent.)

**Q2. `Inventory.TaxTypeID = 2 / 3` labels.**
`Tax_Type` ref table only carries IDs 0 and 1. Pierce's Inventory rows overwhelmingly have TaxTypeID=2. The label source is unclear. Spec carries this as a discovery item; default Advanced-tab behavior labels it "Inventory tax override (raw ID)" with a ? noting the label is under discovery.

**Q3. How sort-stable are the Pierce usage rankings?**
The fill-rate snapshot is a point-in-time sort hint. If usage shifts significantly (hypothetically Pierce starts tagging every item with a warranty), the primary-tab content doesn't auto-rebalance. This is intentional per the "snapshot as source of truth" principle — re-run the script when we revisit. Confirm this cadence is acceptable.

**Q4. Color and Size ref tables.**
`GeneralMerchandise.ColorID` and `SizeID` are ints; the ref tables are named by convention but we haven't confirmed. During implementation, discover via `INFORMATION_SCHEMA` and `sys.foreign_keys`. If no FK exists, the color/size dropdowns may need a DISTINCT query off the GM table itself.

**Q5. Inline edit scope.**
Retail, cost, barcode, discontinue, tax type — confirmed. What about adding **DCC** as an inline edit (dropdown in a cell)? It's edited less often but when edited it's a natural "wait, this shouldn't be in Food, it's in Supplies" quick-fix. Open to add; defer to implementation if it becomes obvious.

**Q6. Location scope for flag fields on the inline/primary tab.**
Some flags (`fDiscontinue`, `fListPriceFlag`) live on the global Item row and apply to every location. Others (`fInvListPriceFlag`, `fNoReturns`) live per-location. Need to make clear to the user whether they're changing one location or all. UI: a small location scope indicator next to each flag when it's location-specific; Primary tab flags are item-global.

---

## Appendix A — Primary tab field table

Ordered by role, with fill-rate from the 2026-04-19 snapshot:

| # | Field | Table | GM fill | Textbook fill | Primary? | Notes |
|---|---|---|---:|---:|---|---|
| 1 | Description | GM | 100% | — | yes (GM) | Required on Add. |
| 1 | Title | Textbook | — | 100% | yes (Textbook) | Replaces Description on textbook rows. |
| 2 | Author | Textbook | — | 100% | yes (Textbook) | |
| 3 | ISBN | Textbook | — | 92% | yes (Textbook) | |
| 4 | Edition | Textbook | — | 65% | yes (Textbook) | |
| 5 | Binding | Textbook | — | 83% | yes (Textbook) | Labeled dropdown. |
| 6 | Barcode | Item | 70% | 94% | yes | Inline-editable from row. |
| 7 | DCC | Item | 100% | 100% | yes | Labeled, type-ahead. |
| 8 | Vendor | Item | 100% | 100% | yes | Labeled, type-ahead. |
| 9 | Item Tax Type | Item | 100% | 100% | yes | Labeled, sorted STATE → NOT TAXABLE → 10.50% → 9.75. |
| 10 | Retail | Inventory | 98% | 99% | yes | Inline + tab. Primary-location value. |
| 11 | Cost | Inventory | 97% | 98% | yes | Inline + tab. Primary-location value. |
| 12 | Discontinue | Item | 0.2% | 0.7% | yes | Inline toggle. Global (not per-location). |
| 13 | Catalog # | GM | 71% | — | yes (GM) | |
| 14 | Imprint | Textbook | — | 39% | textbook-only primary | |
| 15 | Copyright | Textbook | — | 55% | textbook-only primary | |
| 16 | Item comment | Item | 7% | 21% | yes | 25-char limit. |

## Appendix B — Fill-rate snapshot pointer

Full data: `docs/prism/field-usage.md` and `docs/prism/field-usage-snapshot-2026-04-19.json`. Generated 2026-04-19 via `scripts/analyze-prism-field-usage.ts` (read-only, repeatable). PBO excluded. Textbook universe = sold at Pierce within 18 months.

Summary:
- GM universe: n = 33,340 SKUs, 49,940 Inventory rows.
- Textbook-active universe: n = 572 SKUs, 609 Inventory rows.
- 7 fields >95% populated on GM; 9 fields >80% on active textbooks.
- ~20 fields <1% populated on either; they live in Advanced.

---

## Acceptance for handoff to writing-plans

The plan will be written when Marcos confirms:
- [ ] Overall spec approach is sound.
- [ ] Schema split (`products` + `product_inventory`) is acceptable.
- [ ] Primary tab field list (Appendix A) matches what he wants as the default.
- [ ] Phase ordering is acceptable.
- [ ] Open questions Q1–Q6 are either answered or agreed to remain discovery items.

Once green-lit, next step is `superpowers:writing-plans` to produce the step-by-step implementation plan across Phases 1–8.
