# Action: Add a new General Merchandise item via WPAdmin → Item Maintenance

**Source binaries:** `ItemMnt.dll` (primary), `WPUtility.dll` (linker symbol only)
**Method:** Originally static-only from `docs/prism/strings/*.txt`. **Now ground-truthed against plan-cache-recovered proc body** (see [`../plan-cache-method.md`](../plan-cache-method.md) and [`../proc-bodies/P_Item_Add_GM.sql`](../proc-bodies/P_Item_Add_GM.sql)).
**Confidence levels in this doc:** ✅ confirmed by recovered proc body · 🔵 confirmed by literal binary string · 🔍 inference · ❓ unknown.

> **Update 2026-04-24:** The plan-cache probe technique recovered the actual `INSERT` statements inside `P_Item_Add_GM`. Sections previously marked 🔍 with parameter inferences are now ✅ with the confirmed mapping below. The original static-only inferences are preserved at the end of the doc for methodology comparison.

## TL;DR

Adding a GM item from WPAdmin's Item Maintenance fires **a single ODBC stored-procedure call** with 15 parameters:

```
{ call P_Item_Add_GM(0, '%s', %d, %d, '%s', '%s', %d, %d, %d, '%s', %d, %.4f, '%s', %d, '%s') }
```

— `ItemMnt.dll.strings.txt:3486`

The proc body (recovered from plan cache) does exactly two `INSERT` statements:

```sql
INSERT INTO Item (Sku, DccId, VendorId, SubSystem, TypeId, UUID, ItemTaxTypeId,
                  txComment, BarCode, UsedDCCID, fDiscontinue, fListPriceFlag,
                  MinOrderQty, DiscCodeId)
VALUES (@Sku, @DccId, @VendorId, 1, 1, @GMUID, @ItemTaxTypeId, @Comment,
        @BarCode, 0, 0, 0, 0, @DiscCodeId);

INSERT INTO GeneralMerchandise (Sku, MfgId, Description, Color, SizeId,
                                 CatalogNumber, PackageType, UnitsPerPack,
                                 AlternateVendorId, Type, Weight, ImageURL)
VALUES (@Sku, @MfgId, @Description, @Color, @SizeId, @CatalogNumber,
        @PackageType, @UnitsPerPack, 0, '', @Weight, @ImageURL);
```

— `proc-bodies/P_Item_Add_GM.sql`

Confirmed: **`P_Item_Add_GM` does NOT touch `ItemMaster` or `Inventory`.** Just the two tables above. The "Save to Location(s)" follow-up dialog in WPAdmin is what creates `Inventory` rows separately. (laportal handles this correctly — see Section 5.)

Hard-coded constants the proc forces:

| Column | Hard-coded value | Meaning |
|---|---|---|
| `Item.SubSystem` | `1` | The GM subsystem (vs Textbook=2, Tradebook=3) |
| `Item.TypeId` | `1` | GM type marker |
| `Item.UsedDCCID` | `0` | New items never start as "used" |
| `Item.fDiscontinue` | `0` | New items are active by default |
| `Item.fListPriceFlag` | `0` | List-price flag off by default |
| `Item.MinOrderQty` | `0` | No min-order constraint |
| `GeneralMerchandise.AlternateVendorId` | `0` | No alternate vendor |
| `GeneralMerchandise.Type` | `''` | Empty type marker |

## 1. The entrypoint

### What is literally in the binary

`ItemMnt.dll.strings.txt` contains exactly two adjacent lines that match the GM-add pattern:

| Line | String |
|---|---|
| 3485 | `{ call P_Item_Add_GM(%d, '%s', %d, %d, '%s', '%s', %d, %d, %d, '%s', %d, %.4f, '%s', %d, '%s') }` |
| 3486 | `{ call P_Item_Add_GM(0, '%s', %d, %d, '%s', '%s', %d, %d, %d, '%s', %d, %.4f, '%s', %d, '%s') }` |

The two variants differ only in parameter 1 — generic `%d` vs literal `0`. Both are present because the binary holds two distinct codepaths through the dialog: one that passes whatever SKU the user typed in (or auto-allocates), and one that hard-wires `0` to force allocation. The **second form is the new-item path.**

### Parameter signature — confirmed

✅ All 15 parameters now confirmed by aligning the recovered proc body against laportal's existing call site at [`src/domains/product/prism-server.ts:96-110`](../../../../src/domains/product/prism-server.ts):

| # | Format | Confirmed binding | Notes |
|---:|---|---|---|
| 1 | `%d` (literal `0`) | `@MfgId` → `GeneralMerchandise.MfgId` | Often passed equal to `@VendorId` since most Pierce GM is direct-from-vendor |
| 2 | `'%s'` | `@Description` → `GeneralMerchandise.Description` | VarChar(128) |
| 3 | `%d` | `@Color` → `GeneralMerchandise.Color` | Pierce always passes `0` |
| 4 | `%d` | `@SizeId` → `GeneralMerchandise.SizeId` | Pierce always passes `0` |
| 5 | `'%s'` | `@CatalogNumber` → `GeneralMerchandise.CatalogNumber` | VarChar(30) |
| 6 | `'%s'` | `@PackageType` → `GeneralMerchandise.PackageType` | VarChar(3) |
| 7 | `%d` | `@UnitsPerPack` → `GeneralMerchandise.UnitsPerPack` | SmallInt |
| 8 | `%d` | `@DccId` → `Item.DccId` | DCC surrogate from `DeptClassCat` |
| 9 | `%d` | `@ItemTaxTypeId` → `Item.ItemTaxTypeId` | Pierce default = 6 |
| 10 | `'%s'` | `@Comment` → `Item.txComment` | VarChar(25) |
| 11 | `%d` | `@VendorId` → `Item.VendorId` | The actual ordering vendor |
| 12 | `%.4f` | `@Weight` → `GeneralMerchandise.Weight` | Decimal(9,4). **Not `Inventory.Cost`** — that lives in `Inventory`, which this proc does not touch. |
| 13 | `'%s'` | `@ImageURL` → `GeneralMerchandise.ImageURL` | VarChar(128) |
| 14 | `%d` | `@DiscCodeId` → `Item.DiscCodeId` | Pierce passes `0` |
| 15 | `'%s'` | `@BarCode` → `Item.BarCode` | VarChar(20). Note: also lands in `Item.BarCode` directly, NOT in `Item_Xref`. |

The proc also internally sets `@GMUID` and `@Sku`; neither is one of the 15 ODBC params. `@GMUID` populates `Item.UUID` and `@Sku` is allocated by the proc and returned as the first column of the first recordset. The SKU-allocation statement was not in the captured plan-cache slice — the proc body has additional pre-INSERT logic that wasn't in the cache at probe time. Re-running the probe after the proc fires again should fill that gap.

### Why we believe this is the real entrypoint

Three independent signals from the strings extract:

1. **No literal `INSERT INTO Item` in `ItemMnt.dll`.** The Item / GeneralMerchandise / Inventory inserts visible elsewhere (`WPBuyBack.dll.strings.txt:4568-4571`) are buyback-flow item creation, not Item-Maintenance creation. ItemMnt's own writes are the secondary tables — `Item_Xref`, `Inventory_NonMerch`, `OnHold`, `Inv_POVendor`, etc. (see Section 2). The primary Item / GM rows must therefore be created elsewhere — and the only proc-call signature in ItemMnt that could plausibly do it is `P_Item_Add_GM`.
2. **No literal `SP_G3GetNewSKU` call in `ItemMnt.dll`.** Other binaries (`WPBuyBack.dll.strings.txt:2850`, `WinPrism.exe.strings.txt:6918`) explicitly call `{ call SP_G3GetNewSKU(%ld) }` before building their Item row. ItemMnt does not. This is consistent with `P_Item_Add_GM` allocating the SKU internally.
3. **C++ symbol traces.** `ItemMnt.dll.strings.txt:1872` contains `?GetNewSKU@CItemTXView@@MAEJXZ` — `CItemTXView::GetNewSKU` — a method on the Textbook view class. There is **no equivalent symbol on a GM view class**. The TX path explicitly fetches a SKU client-side (presumably to display it before save); the GM path does not.

## 2. What the action visibly does

### Definitely written (literal SQL in `ItemMnt.dll.sql.txt`)

These are the secondary writes that fire *around* the core proc call. They are visible because they are simple string-template inserts that did not warrant being wrapped in a proc.

| Table | Operation | Statement |
|---|---|---|
| `Item_Xref` | INSERT | `INSERT INTO Item_Xref (SKU, Barcode, SortOrder) VALUES (%d, '%s', %d)` (line 36 / 37) |
| `Inv_POVendor` | INSERT | Two forms (lines 33–34): direct VALUES, and a SELECT-from-template that copies vendor settings from a sibling SKU |
| `Inventory_NonMerch` | INSERT | `insert into Inventory_NonMerch (SKU, LocationId, FeeCodeId) values (%d, %d, %d)` (line 35) |
| `Matrix_Attrib_Order` | INSERT | `INSERT INTO Matrix_Attrib_Order VALUES (%d, %d, '%s', %d)` (line 38) — only fires when item is part of a matrix/style |
| `OnHold` | INSERT | `insert into OnHold (SKU, LocationID, OnHoldTypeId) values(%d, %d, %d)` (line 39) — only when user explicitly puts a hold on it during create |
| `OnHoldType` | INSERT | `insert into OnHoldType (Name) values('%s')` (line 40) — only if user creates a new hold type inline |

These secondary writes are conditional, not unconditional. Most newly-created GM items will trigger only the `P_Item_Add_GM` proc and (if the user entered a barcode) `Item_Xref`.

### Confirmed (recovered from plan cache)

✅ The proc body inserts into exactly two tables:

**`Item`** (14 columns):
```
Sku, DccId, VendorId, SubSystem, TypeId, UUID, ItemTaxTypeId, txComment,
BarCode, UsedDCCID, fDiscontinue, fListPriceFlag, MinOrderQty, DiscCodeId
```

**`GeneralMerchandise`** (12 columns):
```
Sku, MfgId, Description, Color, SizeId, CatalogNumber, PackageType,
UnitsPerPack, AlternateVendorId, Type, Weight, ImageURL
```

Confirmed NOT touched by `P_Item_Add_GM`:

- ❌ `ItemMaster` — laportal's docstring at [prism-server.ts:78](../../../../src/domains/product/prism-server.ts) currently claims this is created. **It is not** — at least not directly by the proc. If `ItemMaster` rows materialize for new GM items, it must be via a trigger on `Item` or a separate proc call. Worth verifying with a snapshot/diff or with a follow-up plan-cache probe targeting trigger names like `tr_Item_*`.
- ❌ `Inventory` — laportal's `createGmItem` correctly inserts these rows separately after the proc returns; the proc itself does not populate them.

🔍 The SKU-allocation step (which sets `@Sku` to a fresh value before the inserts run) was not captured in the plan cache slice. A second probe after recent activity should expose the `SELECT NEXT VALUE FOR ...` or counter-table read+update.

### Save-to-Locations follow-up step

✅ The UI string `Save to Location(s) cancelled by the user.` (`ItemMnt.dll.strings.txt:5748`) confirms there is a distinct, post-create dialog where the user picks which additional locations to stock the new SKU at. The corresponding writes happen via the runtime-composed fragment:

- `update inventory set ` — `ItemMnt.dll.sql.txt:207` — **the SET clause is composed at runtime and is invisible to this method.** The literal in the binary ends right after `set `.

This is a major static-analysis blind spot. We know the action *does something* to `Inventory`, we know it lets the user do it for multiple locations, but we cannot enumerate which columns are touched without a dynamic-analysis pass.

## 3. Workflow reconstruction

🔍 Combining the literal entrypoint, the visible secondary writes, and the UI strings, the most likely sequence is:

1. **User opens Item Maintenance, clicks "New"** → ItemMnt.dll dialog (likely `CG3InvView` or `CInvTXView` based on the symbol `?OnAddItem@CInvTXView@@IAEXXZ`) is presented with a blank form.
2. **User fills in: Description, DCC, Vendor, Tax Type, Tag Type, Cost, Barcode, optional matrix style, etc.** → the form binds to local state, no DB calls yet.
3. **User clicks Save** → ItemMnt fires `{ call P_Item_Add_GM(0, ...) }` with the 15 form values. The proc returns the new SKU (probably as an OUT parameter or as a result row, not visible from the call signature alone).
4. **If barcode supplied** → ItemMnt fires `INSERT INTO Item_Xref (SKU, Barcode, SortOrder) VALUES (...)`. The barcode column on `Item` itself may also be set inline by the proc.
5. **If matrix item** → `INSERT INTO Matrix_Attrib_Order` fires; if a style template is involved, `{ call E_CreateItemsFromStyle(%d) }` cascades to create matrix children.
6. **If user opted to copy vendor settings from a sibling SKU** → `INSERT INTO Inv_POVendor (...) SELECT ... FROM Inv_POVendor WHERE SKU = %d` fires.
7. **"Save to Locations" dialog appears** → user checks additional locations. ItemMnt fires per-location `update inventory set <runtime-composed>` statements (and/or additional inserts; not visible from static analysis).
8. **If hold types or shelf-locations were edited inline** → `INSERT INTO OnHoldType` / `UPDATE ShelfLocations` etc. fire.

Steps 1, 2, 4–6, 8 are all confirmed by literal strings. Step 3 is confirmed by the `P_Item_Add_GM` literal. Step 7 is partially confirmed by the cancellation message and the truncated `update inventory set` fragment.

## 4. What static analysis cannot tell us

Honest enumeration of the limits of this method:

- ❓ **The body of `P_Item_Add_GM`.** Without `VIEW DEFINITION` we cannot read it. Specifically: the column-to-parameter mapping, default values for blank fields, which `Inventory` row(s) get created, whether the proc returns an output param.
- ❓ **The Save-to-Locations SET clause.** Composed at runtime; only the prefix `update inventory set ` is in the binary.
- ❓ **Trigger side-effects.** `SCHEMA.md` records 475 triggers across the database. We have no visibility into which fire on `Item` / `GeneralMerchandise` / `Inventory` insert-update.
- ❓ **Whether `P_Item_Add_GM` returns the new SKU to the client.** The ODBC `{call ...}` form does not encode return / OUT parameters in the printable string.
- ❓ **Audit / log rows.** No `Audit_*` table appears in `ItemMnt.dll`'s write surface; if WPAdmin writes audit rows, they happen inside the proc.
- ❓ **Validation logic.** Form validation, default population, dropdown loading — all happen in compiled C++ class methods, not in the strings.

## 5. Implications for laportal item-create parity

Where laportal already supports GM item create (PR #162's path), this analysis suggests:

- **Calling `P_Item_Add_GM` directly is the simplest, most-faithful integration**, since it is the same call WPAdmin makes. The 15-parameter signature is fully visible; we just need to confirm the binding by running one or two test inserts and diffing.
- **Per-location inventory rows almost certainly require a separate set of writes after the proc returns**, mirroring the Save-to-Locations dialog. Static analysis cannot tell us the shape of those writes; this is a place where the snapshot/diff approach is required to learn the contract.
- **`Item_Xref` is the canonical place for additional barcodes** — a literal insert is visible, so we know exactly how to mirror this write.

## 6. How to verify the unknowns

The ❓-tagged blind spots in this doc all resolve via a dynamic-analysis pass:

1. Snapshot Prism (`scripts/prism-snapshot.ts before-add-gm`).
2. Marcos opens WPAdmin, creates one GM item with all fields populated, saves, picks 2 locations in Save-to-Locations.
3. Snapshot again (`scripts/prism-snapshot.ts after-add-gm`).
4. Diff (`scripts/prism-diff.ts before-add-gm after-add-gm`) — every column written, every trigger residue, every audit row will appear in the diff.

The result of that experiment would let us collapse this entire doc's ❓ list to ✅. Until then, the proc signature and the secondary writes above are an excellent starting point for the laportal mirror.
