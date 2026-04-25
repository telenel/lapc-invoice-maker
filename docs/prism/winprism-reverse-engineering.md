# WinPRISM Reverse-Engineering Log

Running narrative of every experiment where we observe the WinPRISM /
PrismCore Admin client in action and diff the Prism database before/after.
Goal: map every write-path the client software uses so laportal can replicate,
replace, or out-compete any piece of that behavior safely.

This doc covers the **dynamic-analysis** track: observe what WPAdmin actually writes by snapshotting the DB, performing a UI action, and diffing. It is one of three complementary tracks. See [`README.md`](README.md) for the full knowledge-base index, [`SCHEMA.md`](SCHEMA.md) for the static catalog of every Prism table/proc/view, and [`static/README.md`](static/README.md) for the static-analysis pass that extracts embedded SQL directly from the WPAdmin client binaries (the upper bound of what each module _can_ do, complementing the lower bound of what we have observed it _doing_ here).

If a finding is load-bearing for laportal, it ends up in `MEMORY.md`-style auto-memory too; this log is the primary record.

## Table of contents

- [Why this exists](#why-this-exists)
- [Method](#method)
- Experiments
  - [Experiment 1 — Create a new top-level DCC via WPAdmin](#experiment-1--create-a-new-top-level-dcc-via-wpadmin)
    - [Attempt 1.1 — Dept 30 / Class 30 / Cat 30 (FAILED, PK violation)](#attempt-11--dept-30--class-30--cat-30-system-type--general-merchandise)
    - [Attempt 1.2 — Dept 30 / Class 30 / Cat 32 (FAILED, same PK violation)](#attempt-12--dept-30--class-30--cat-32-system-type--general-merchandise)
    - [Attempt 1.3 — Category under existing Dept+Class (SUCCESS)](#attempt-13--add-category-30-copytech-under-existing-dept-30--class-30)
    - [Full inspection of DCC 30-30-30 (DCCID 1973790)](#full-inspection-of-dcc-30-30-30-dccid-1973790)
  - [Experiment 2 — Create a new GM item via Item Maintenance (close before Update)](#experiment-2--create-a-new-gm-item-via-item-maintenance-close-before-update)
- [Open questions / experiment backlog](#open-questions--experiment-backlog)
- [Appendix A — Confirmed schema reference (DCC + Item domains)](#appendix-a--confirmed-schema-reference-dcc--item-domains)
- [Appendix B — Quick references (DCC 30-30-30, TEST ITEM)](#appendix-b--quick-references-dcc-30-30-30-copytech)
- [Appendix C — Noise tables to ignore in future diffs](#appendix-c--noise-tables-to-ignore-in-future-diffs)
- [Appendix D — laportal vs. WPAdmin item-create: what matches, what's missing](#appendix-d--laportal-vs-wpadmin-item-create-what-matches-whats-missing)

## Why this exists

- `pdt` lacks `VIEW DEFINITION` on Prism, so we cannot read stored proc source.
- PrismRBS doesn't publish a schema reference under our license tier.
- The only way to learn what a WPAdmin / PrismCore action actually writes to
  the DB is to observe the residue: snapshot the DB, trigger the action,
  snapshot again, diff.
- Any finding in here is **observed behavior**, not documented behavior.
  Sources of truth are the JSON snapshots under `tmp/prism-snapshots/` (local
  only; gitignored) and the diff output.

## Method

Tooling:

- [`scripts/prism-snapshot.ts`](../../scripts/prism-snapshot.ts) — takes a
  labeled, read-only snapshot of every user table in Prism. Captures:
  `row_count`, `CHECKSUM_AGG(BINARY_CHECKSUM(*))`, primary key metadata, and
  the full row set for every table at or below the
  `--capture-rows-under=<N>` threshold (default 1000).
- [`scripts/prism-diff.ts`](../../scripts/prism-diff.ts) — loads two snapshots
  and reports tables whose row count or checksum changed, with row-level
  NEW/DELETED/UPDATED diffs (keyed on PK) for any table where full row data
  was captured in both snapshots.

Guardrails:

- **Strictly SELECT-only.** Every query is `SELECT ... WITH (NOLOCK)` or a
  `sys.*` DMV read. No INSERT, UPDATE, DELETE, MERGE, DDL, or writing-proc
  call. This respects the standing Prism read-only rule.
- We run snapshots from a laptop against winprism-la over the intranet using
  the `pdt` login. No server-side state is changed.

Procedure for each experiment:

1. `npx tsx scripts/prism-snapshot.ts before-<topic>` — establish baseline.
2. Marcos performs ONE focused action in the target client (WPAdmin,
   PrismCore, POS, etc.).
3. `npx tsx scripts/prism-snapshot.ts after-<topic>` — capture residue.
4. `npx tsx scripts/prism-diff.ts before-<topic> after-<topic>` — identify
   the smallest footprint of the write.
5. Interpret, record findings here, and move what's useful into laportal
   (code + `MEMORY.md` notes + domain docs).

Caveats / known noise sources:

- Prism is multi-user; other operators posting sales/receipts during the
  experiment window will show up as diff noise. Run off-hours when possible.
- Large fact tables (Transaction_Header/Detail, Acct_ARInvoice_*, ItemHistory,
  Stock_Adjustment_Table, Customer_Address) skip checksum by default
  (`--max-checksum-rows=500000`). Row-count delta is still captured.
- SQL Server rolls back a failed INSERT automatically, but the client may
  issue multiple inserts in sequence without a transaction — partial writes
  are possible if a later insert fails. Always diff the failed state too.

## Experiments

### Experiment 1 — Create a new top-level DCC via WPAdmin

- **Date**: 2026-04-22
- **Client**: PrismCore Admin (WPAdmin)
- **Path in UI**: Inventory Control → Store Set Up → Department/Class/Category → "Add New DCC" button
- **Goal**: Create a dedicated DCC for CopyTech materials so the print-shop
  activity can be classified separately from GENERAL MERCH.
- **Baseline snapshot**: `tmp/prism-snapshots/before-dcc-create.json`
  (captured 2026-04-22, 3.4 s, 962 tables, 767 with full row data, 32
  checksum-skipped, 0 errors)

#### Known state before any attempt

At baseline, `dbo.DCC_Department` has 25 rows. Department numbers in use:

```
10, 11, 12, 13, 19, 20, 30, 31, 35, 40, 41, 42, 43, 44, 46, 50,
60, 61, 70, 75, 80, 81, 90, 95, 99
```

Free Dept numbers 1–99 (candidates for new top-level):

```
1-9, 14-18, 21-29, 32-34, 36-39, 45, 47-49, 51-59, 62-69,
71-74, 76-79, 82-89, 91-94, 96-98
```

#### Attempt 1.1 — Dept 30 / Class 30 / Cat 30, System Type = General Merchandise

**Input** in the "Add New DCC" dialog:

| Field | Number | Name |
|---|---|---|
| Department | 30 | GENERAL MERCH |
| Class | 30 | PAPER PRODUCTS |
| Category | 30 | COPYTECH |
| System Type | — | General Merchandise |

**Outcome**: FAILED at SQL level. WPAdmin surfaced a native SQL Server error:

> Violation of PRIMARY KEY constraint 'PK_DCC_Department'. Cannot insert
> duplicate key in object 'dbo.DCC_Department'. The duplicate key value is (30).
> The statement has been terminated.

No row was written (Marcos confirmed the UI aborted on this error; no partial
state). Before-snapshot remains the valid baseline for subsequent attempts.

**Findings — schema**

1. Table `dbo.DCC_Department`:
   - Columns: `Department` (int), `DeptName`, `Subsystem`
   - Primary key: `PK_DCC_Department` on `Department` column (single int,
     user-supplied, NOT identity)
2. Existing Dept 30 row has `DeptName = "GENERAL MERCH"` — so the collision
   is on the PK alone regardless of name.

**Findings — WPAdmin client behavior**

3. The "Add New DCC" dialog issues an **unconditional INSERT into
   DCC_Department** as its first step. It does not UPSERT, does not
   pre-SELECT to check existence, and does not wrap the DCC create in a
   logical "find-or-create" at the Department level.
4. Therefore the "Add New DCC" dialog is exclusively for creating a
   **brand-new top-level Department/Class/Category hierarchy**. Adding a new
   Class or Category under an existing Department must be a different
   workflow (likely right-click or a different button on the main
   Department/Class/Category panel).
5. When the first INSERT fails, the dialog surfaces the raw SQL error verbatim
   (no wrapping / no translation). This is useful for us — it tells us
   constraint names directly.

**Implications for laportal**

- If we ever want to surface a "create DCC" feature in laportal, we cannot
  naively copy WPAdmin's pattern. We'd want:
  - Pre-check existence of Dept/Class/Cat numbers and surface friendly
    conflict messages.
  - Support "add under existing Department" as a first-class flow.
  - Keep the same underlying tables (DCC_Department, etc.) so POS/PRISM
    round-trips still work.
- The PK-on-Department design means Dept numbers are a district-wide
  resource; coordinating across Pierce locations means we'd need to claim an
  unused number and document why. laportal should expose free-number helpers.

#### Attempt 1.2 — Dept 30 / Class 30 / Cat 32, System Type = General Merchandise

**Input** in the "Add New DCC" dialog:

| Field | Number | Name |
|---|---|---|
| Department | 30 | GENERAL MERCH |
| Class | 30 | PAPER PRODUCTS |
| Category | 32 | COPYTECH |
| System Type | — | General Merchandise |

**Outcome**: FAILED with the identical error as 1.1:

> Violation of PRIMARY KEY constraint 'PK_DCC_Department'. Cannot insert
> duplicate key in object 'dbo.DCC_Department'. The duplicate key value is (30).
> The statement has been terminated.

**Finding — confirmed**

6. The "Add New DCC" dialog has **no skip-existing-Department fallback
   logic**. Even when the user intent is clearly "reuse existing Dept 30,
   add new Class/Category underneath", the dialog still attempts the top-
   level `INSERT INTO DCC_Department` first, and bails on the PK collision
   before ever touching DCC_Class or DCC_Category. Attempt 1.1's Finding 3
   is now confirmed beyond reasonable doubt.

**Implication**: To add a CopyTech Class/Category under existing Dept 30,
the "Add New DCC" dialog cannot be used at all. A different WPAdmin workflow
is required (likely via the tree-view context menu on the Dept 30 node).
Identifying that alternative workflow is its own experiment (pending).

#### Attempt 1.3 — Add Category 30 COPYTECH under existing Dept 30 / Class 30

**How Marcos got here**: The "Add New DCC" dialog was abandoned. Instead he
expanded the Dept 30 GENERAL MERCH node in the main tree view on the left
side of the `103 Department/Class/Category` panel, which revealed that
Class 30 "PAPER PRODUCTS" already existed with sibling Categories
10 GENERAL PAPER, 15 FILLER PAPER, 20 PAPER PADS. He then added a new
Category 30 "COPYTECH" under that existing Class. The exact UI gesture
(right-click → Add? keyboard shortcut? toolbar button?) is worth mapping
separately but not critical for the byte-diff.

**Net input**:

| Field | Value | Pre-existing? |
|---|---|---|
| Department | 30 GENERAL MERCH | YES — pre-existed in DCC_Department |
| Class | 30 PAPER PRODUCTS | YES — pre-existed in DCC_Class |
| Category | 30 COPYTECH | NO — newly created |
| Tag Type (right-hand panel) | Small GM | (default for this Dept/Class?) |
| Desired Margin | 50.00% | (default) |
| Discounts | unchecked | (default) |
| Transmit Electronic Shelf Tags | unchecked | (default) |
| Digital Content Mass Adopt Default | unchecked | (default) |
| Inventory Turnover scope | Applies to All Locations (0.00) | (default) |

**Outcome**: SUCCESS. DCC 30-30-30 now exists and appears in the tree.

**Snapshots**:
- Before: `tmp/prism-snapshots/before-dcc-create.json`
- After: `tmp/prism-snapshots/after-dcc-create-30-30-30.json`
- Diff JSON: `tmp/prism-snapshots/diff-before-dcc-create-vs-after-dcc-create-30-30-30.json`
- Diff text: `tmp/prism-snapshots/diff-dcc-30-30-30.txt`

##### Signal: tables directly written by the DCC-create action

Filtering the 62 changed tables down to those whose change maps unambiguously
to the single user action (and excluding noise from other district activity
and lazy POS-update / audit-log queues), the actual write footprint is:

| Table | Action | Rows | Details |
|---|---|--:|---|
| `dbo.DCC_Category` | INSERT | 1 | `(Department=30, Class=30, Category=30, CatName='COPYTECH       ')` |
| `dbo.DeptClassCat` | INSERT | 1 | `(DCCID=1973790, Department=30, Class=30, Category=30, DCCType=3)` |
| `dbo.DCCLocation` | INSERT | 1 | `(DCCLocID=471, LocationID=0, DCCID=1973790, DCCMask=16777215, TaxTypeID=0, TagTypeID=10000121, DefaultMargin=50, SortID=0, fDiscountFlag=0, Pos_Flag=0, ItemTaxTypeID=0, fESTIncludeDCC=false, fDefaultDigitalDCC=false)` |
| `dbo.DCCLocationExt` | INSERT | 17 | One row per LACCD location (1-13, 15-18), all `DCCLocID=471` |
| `dbo.DccLocationRoyalty` | INSERT | 17 | One row per LACCD location, default `RoyaltyPercentage=0, RoyaltyMinimum=0` |

**Total write footprint: 37 rows across 5 tables.**

##### Tables NOT written (and what that tells us)

- `dbo.DCC_Department` **unchanged** — confirms no top-level INSERT when Dept
  already exists.
- `dbo.DCC_Class` **unchanged** — confirms no mid-level INSERT when Class
  already exists under that Department.
- No `Royalty_*` header table write (royalty defaults live in
  `DccLocationRoyalty` only).
- No GL-code write despite the "GL Codes" tab being visible — the tab is
  lazy-populated, the tab click was not exercised in this experiment.
- No `ItemHistory` / `Item` / `GeneralMerchandise` write (no items yet).

##### Findings — DCC data model

7. **Table layering**:
   - `DCC_Department` (PK: Department) — top-level department dictionary.
   - `DCC_Class` (PK: Department, Class) — class dictionary scoped to Dept.
   - `DCC_Category` (PK: Department, Class, Category) — leaf category dict.
   - `DeptClassCat` (PK: DCCID) — the **junction table** that gives each
     (Dept, Class, Cat) triplet a single surrogate `DCCID`. Every item in
     `Item.DCCID` foreign-keys here. The triplet columns are redundantly
     stored on this table for join convenience.
   - `DCCLocation` (PK: DCCLocID) — per-DCC-per-location settings record.
     When "Applies to All Locations" is selected, one row is written with
     `LocationID=0` and the DCCLocationExt mapping fans that out to every
     location. When a specific location gets overrides, additional rows
     are inserted with specific `LocationID`s.
   - `DCCLocationExt` (PK: DCCID, LocationID) — **resolution/mapping**
     table. For any (DCCID, LocationID) pair it points to the DCCLocID in
     `DCCLocation` that governs the pair's settings. Lets PrismCore resolve
     "what settings apply to DCC X at Location Y" without scanning.
   - `DccLocationRoyalty` (PK: DccLocationRoyaltyId, surrogate) — per-DCC-
     per-location royalty percentage/minimum. Not strictly needed for
     General Merchandise DCCs (always 0), but written unconditionally.
8. **DCCID is an IDENTITY column on DeptClassCat.** The sample sequence
   under (30,30,*) is 1973770, 1973775, 1973780, 1973790 — non-uniform
   gaps (5, 5, 10) which suggest the IDENTITY is global and allocations are
   interleaved with other DCC inserts across the district.
9. **DCCType field on DeptClassCat encodes hierarchy level:**
   - Type 3 = leaf category (254 of 256 rows, matches DCC_Category count
     ±1 for our newly inserted row that post-dates the sample query)
   - Type 4 = 1 row (special case, unknown)
   - Type 5 = 1 row (special case, unknown)
   - No Type 1 or 2 rows observed — Dept-only and Class-only entries may
     not be represented in DeptClassCat at all, or they use other types.
     Investigate separately.
10. **LACCD has 17 active locations**: 1-13 and 15-18. Location 14 is
    missing from all location-keyed tables we examined (DCCLocationExt,
    DccLocationRoyalty). This matches what we already have in memory
    (`reference_prism_database.md`). Pierce = (2, 3, 4); PBO excluded = 5.
11. **DCC_Category.CatName is `CHAR(15)` fixed-width, space-padded.**
    Observed: `'COPYTECH       '` (7 chars + 8 spaces). Any laptop-side
    reader of these values needs to `TRIM` or `.trim()` before display.
12. **TagTypeID 10000121 = "Small GM"** — the dropdown label in the UI maps
    to this numeric ID in DCCLocation. Must be resolved from `Tag_Type` or
    similar ref table at display time. (Existing rule from
    `feedback_show_labels_not_ids.md` already covers this.)
13. **DCCMask is a bitmask column on DCCLocation.** Observed values:
    - `16777215` (0xFFFFFF, all 24 low bits set) on the new all-locations row
    - `16776960` (0xFFFF00, low byte cleared) on the noise-update row for
      another DCC
    Decoding which bits mean what is a separate follow-up.
14. **Boolean columns default `false` on INSERT but existing rows carry `NULL`** — the "mystery" UPDATE on `DCCLocID=380` (unrelated DCCID=1973760)
    flipped `fESTIncludeDCC` and `fDefaultDigitalDCC` from `null` to `false`.
    Only one such row flipped during our window. Most likely interpretation:
    an ambient background task or post-commit trigger opportunistically
    normalizes NULL booleans to `false` on nearby rows. Worth confirming by
    re-running an experiment and checking whether any "noise" updates
    consistently appear for unrelated DCCLocation rows.

##### Noise analysis (to filter out on future experiments)

The 62 changed tables include substantial noise from concurrent district
activity during the ~1 hour window between snapshots. Confident noise:

- **Live POS activity**: `Transaction_Header` (+176), `Transaction_Detail`
  (+482), `Transaction_Tax` (+205), `Transaction_Tender` (+187),
  `Transaction_Detail_Tender` (+549), `TransactionTaxTenderDetail` (+549),
  `Transaction_Tax_Detail` (+482), `Transaction_Tender_Adtnl` (+93),
  `Transaction_AVS` (+1), `SalesTable` (+796), `TempSalesTable` (-638),
  `SalesHistoryHeader` (+2), `POS_Open_History` (+1, 3 updated),
  `POS_ProcessPaymentReports` (+1), `POS_ProcessPaymentReportDetails` (+1)
- **POS push queue / sync**: `Pos_Update` (+399/-566), `Pos_Update_Raw`
  (-3204), `SortHeader` (-87669), `Web_Transfer` (+322),
  `Web_Transfer_History` (+26), `Web_Transfer_History_Raw` (-6202)
- **AR posting**: `Acct_ARInvoice_Header` (+10), `Acct_ARInvoice_Detail`
  (+10), `Acct_ARInvoice_Tender` (+11), `Acct_Apply` (+15)
- **Item creation elsewhere**: `Item` (+1), `ItemMaster` (+1),
  `GeneralMerchandise` (+1), `Inventory` (+3), `Inv_POVendor` (+3),
  `SKUSequence` (1 row updated, PK-less — counter bumped 1198980 → 1198981,
  consistent with one item created somewhere)
- **PO activity**: `PO_Header` (checksum only), `PO_Detail` (+84),
  `PO_Location` (+84), `MO_Address` (+4)
- **Catalog activity**: `Catalog_Sales_Header/Detail/Tender` (+2 each),
  `CatalogInventory` (checksum only), `Customer_Address` (+2),
  `Customer_Location` (+1)
- **Price/event churn**: `PriceChange` (+35), `SalesEventItems` (+31),
  `SalesEventItemLocations` (+31), `ItemFindSettingsItems` (+31),
  `ItemFindSettingsQueue` (-136, queue drain), `LocationSelections`
  (-39), `LocationSelectionLocations` (-39)
- **Logs / audits**: `SystemLog` (+7776), `ModuleAccessHistory` (+9),
  `ModuleAuditLog` (+5), `AppAccessHistory` (checksum only),
  `POS_Register_Access_History` (checksum only), `Stock_Ledger_Reverse`
  (+18), `GblComment` (+2), `Course_Selection` (+1),
  `Transaction_Detail_Tend_Tmp` (+1)

**Recommendation**: Run future experiments off-hours (after POS closes at
all Pierce locations) to cut the noise sharply. Next-best option: build a
`--ignore-noise-tables` flag on prism-diff that masks a canonical noise
list, with a `--show-ignored` inverse for when we want to audit it.

##### Implications for laportal

- **Laportal can cleanly replicate a "create Category under existing
  Dept+Class" flow** by issuing exactly the 5 writes shown in the Signal
  section above. No opaque stored-proc call required. A transaction
  wrapping all 37 row writes is advisable for atomicity (WPAdmin does not
  appear to wrap this in a transaction — the DCCLocation update on
  DCCLocID=380 landed before the DCC create, suggesting loose ordering).
- **For the full "create Dept + Class + Cat from scratch" flow**, we also
  need a successful experiment that writes DCC_Department and DCC_Class.
  Queued as Attempt 1.4 (pick an unused Dept number like 32 or 82 and do a
  full triplet create).
- **Free-number helpers**: laportal's future "Create DCC" UI should list
  free Dept numbers (already computable from `DCC_Department` via the
  products mirror), free Class numbers under a chosen Dept, and free
  Category numbers under a chosen Class — dramatically better than
  WPAdmin's "guess and see what PK collides" experience.
- **Tag Type / Tax Type / Margin / Inventory Turnover defaults**: these
  come from *somewhere* in the WPAdmin form. The right-hand editor in the
  screenshot shows these were pre-populated. Worth checking whether they
  inherit from a parent (Dept/Class-level default record) or from a global
  config table. Follow-up experiment: edit an existing empty DCC, save,
  see what table the form fields land in.
- **DCCLocation LocationID=0 convention**: laportal reads should use
  `DCCLocationExt` to resolve which DCCLocation row governs a specific
  (DCC, Location) pair, not assume LocationID=0 or a specific LocationID
  is canonical. This is how PrismCore does it and we should match.

##### Follow-ups

- **Attempt 1.4**: Create a full new Dept/Class/Cat triplet (pick a free
  Dept number like 32 or 82). Expected additional writes: one row each into
  `DCC_Department`, `DCC_Class`, plus whatever cascades they trigger
  (DCCLocation / DCCLocationExt / DccLocationRoyalty for Dept-level? Or
  only for leaf Category?).
- **Attempt 1.5**: Edit the new 30-30-30 DCC (change Desired Margin,
  toggle Discounts, change Tag Type) and diff to learn which columns on
  `DCCLocation` each form field maps to.
- **Attempt 1.6**: Delete a DCC (if the UI allows) — confirm whether it
  cascades or soft-deletes, which tables are touched, whether DCCLocationExt
  mappings are cleaned up.
- **Attempt 1.7**: Click the "GL Codes" and "Royalty" tabs and edit
  something — learn the GL-code / royalty write footprint.
- **Attempt 1.8**: "Set Inventory" button next to Tag Type — learn what it
  does (populates `Inventory` rows per location? Opens a dialog? Writes a
  flag?).
- **Attempt 1.9**: Add a per-location override on an existing DCC — see
  how DCCLocation / DCCLocationExt shift to route that location to the new
  DCCLocID.
- **Tooling**: add `--ignore-noise-tables` / a default noise mask to
  `prism-diff.ts` so low-signal experiments are readable without grepping.
- **Tooling**: capture the DCCMask bitmask's meaning — likely encodes
  "which override fields were explicitly set by the user" or similar.

##### Full inspection of DCC 30-30-30 (DCCID 1973790)

Ran 2026-04-22 via `npx tsx scripts/prism-inspect-dcc.ts --dccid=1973790`.
JSON output: `tmp/prism-snapshots/inspect-dcc-1973790.json`. All SELECT-only.

**Hierarchy rows (verbatim, including fixed-width CHAR padding):**

```
DeptClassCat  : DCCID=1973790 Department=30 Class=30 Category=30 DCCType=3
DCC_Department: Department=30 DeptName="GENERAL MERCH  " Subsystem=1
DCC_Class     : Department=30 Class=30    ClassName="PAPER PRODUCTS "
DCC_Category  : Department=30 Class=30    Category=30 CatName="COPYTECH       "
```

**Settings row (DCCLocation, single row because "Applies to All Locations"):**

```
DCCLocID=471 LocationID=0 DCCID=1973790
DCCMask=16777215  (0xFFFFFF — all 24 low bits set)
TaxTypeID=0      -> Tax_Type.Description="None                                    "
ItemTaxTypeID=0  -> no row in Item_Tax_Type (unset/empty in UI)
TagTypeID=10000121 -> TagType { Description="Small GM", ScriptID=31, PaperTypeID=3, FormID=12, IsDefault=0, Subsystem=1, ShowOrder=39, UniqueId=15A20344-298D-421D-A7C7-B4322096BCA5 }
DefaultMargin=50
SortID=0
fDiscountFlag=0
Pos_Flag=0
fESTIncludeDCC=false
fDefaultDigitalDCC=false
```

**DCCLocationExt — per-location resolution (all 17 point at DCCLocID 471):**

| LocationID | DCCLocID | Label (from Location master) |
|--:|--:|---|
| 1 | 471 | CITY — L.A. CITY COLLEGE BOOKSTORE |
| 2 | 471 | PIER — LOS ANGELES PIERCE COLLEGE BOOKSTORE |
| 3 | 471 | **PCOP — L.A. PIERCE COPY TECH** |
| 4 | 471 | PFS — L.A. PIERCE BRAHMA CAFE |
| 5 | 471 | PBO — L.A. PIERCE BUSINESS OFFICE (excluded per scope rule) |
| 6 | 471 | LAMC — L.A. MISSION EAGLES' LANDING |
| 7 | 471 | LASC — L.A. SOUTHWEST COLLEGE BOOKSTORE |
| 8 | 471 | WEST — WEST LOS ANGELES COLLEGE STORE |
| 9 | 471 | PAWS — PAWS 4 SNACKS & STUFF PRIMARY |
| 10 | 471 | PAW2 — PAWS 4 SNACKS SATELLITE |
| 11 | 471 | LAVC — L.A. VALLEY COLLEGE BOOKSTORE |
| 12 | 471 | ELAC — EAST LOS ANGELES COLLEGE BOOKSTORE |
| 13 | 471 | SGEC — SOUTH GATE BOOKSTORE |
| 15 | 471 | HSKY — ELAC HUSKY/CAFE |
| 16 | 471 | LAHC — L.A. HARBOR COLLEGE STORE |
| 17 | 471 | LATT — L.A. TRADE TECH COLLEGE STORE |
| 18 | 471 | LAMC — L.A. MISSION CONVENIENCE STORE |

Location 14 intentionally absent (reserved/deleted, confirmed across all
location-keyed tables).

**DccLocationRoyalty — 17 rows, IDs 4494-4510, contiguous sequence:**

All rows: `RoyaltyPercentage=0, RoyaltyMinimum=0`.

```
DccLocationRoyaltyId 4494..4510 (17 IDs)
DccId                1973790    (all rows)
LocationId           1,2,...,13,15,16,17,18 (17 locations)
```

**Linked items**: `SELECT COUNT(*) FROM Item WHERE DCCID=1973790` → 0.
As expected — this DCC is freshly created with nothing assigned.

**Full-DB scan**: checked 63 tables whose columns include `DCCID` or `DccId`.
**No tables beyond the 5 known touch points (DeptClassCat, DCCLocation,
DCCLocationExt, DccLocationRoyalty, Item) contain rows for DCCID 1973790.**
Confirms the write footprint is complete — nothing else in Prism references
this DCC.

##### Additional findings from the inspection

15. **Tag master table is `dbo.TagType`** (single word, no underscore).
    `Tag_Type` does not exist. Inventory of related tables: `TagType`,
    `TagTypePrinter`, `TagTypePrinterType`, `Rental_TagType`, `Monarch_Tag_Types`.
16. **`TagType` has rich metadata**: `Description`, `ScriptID`, `PaperTypeID`,
    `FormID`, `IsDefault`, `Subsystem`, `ShowOrder`, `UniqueId (GUID)`.
    The printed tag layout is determined by `ScriptID` (31 for "Small GM").
    GUID column suggests the table participates in some cross-server sync or
    export pipeline.
17. **`DCC_Department.Subsystem` partitions departments**:
    - `1` = General Merchandise (17 of 25 dept rows)
    - `2` = Textbook (6 rows — 10/NEW TEXTBOOKS, 11/USED TEXT, 12/TRADE BOOKS,
      13/STORE RENTALS, 19/NON-STORE RENT, plus one more)
    - `3` = 1 row (special — unknown use)
    - `11` = 1 row (special — unknown use)

    Our Dept 30 is Subsystem 1 (GM), which matches the Tag Type ("Small GM"
    also has Subsystem=1). The "System Type" dropdown in the "Add New DCC"
    dialog is likely an alias for this Subsystem column; different subsystems
    enable different Tag Type options, different GL code paths, and
    potentially different screens in WPAdmin.
18. **`Item_Tax_Type` does not have a row for ItemTaxTypeID=0** — so ID 0 is
    the sentinel "no item tax type chosen". Laportal should treat a zero/NULL
    ItemTaxTypeID identically.
19. **Location 3 (PCOP) is "L.A. PIERCE COPY TECH"** — the new DCC 30-30-30
    COPYTECH now applies there (and at every other location) because the
    DCCLocationExt maps all 17 locations to the single DCCLocID=471
    settings row. If CopyTech should be Pierce-only, a per-location override
    would be needed (future experiment: add a LocationID-specific DCCLocation
    row and see how DCCLocationExt re-pins).

##### New tooling notes

- `scripts/prism-inspect-dcc.ts` (added 2026-04-22) — takes `--dccid=<N>` or
  `--dept= --class= --category=`, prints structured report of everything
  Prism stores for that DCC, including ref-data label resolution and a full-
  DB scan for any other table with a DCCID column holding the target value.
  SELECT-only. Reusable for any DCC going forward.
- Known limitation: the reference-label heuristic in `prism-inspect-dcc.ts`
  found TagType by suffix matching (`_Type`) but the actual table is
  `TagType` (no underscore), so the TagType lookup fell back to a bad
  candidate on first run. A manual follow-up query resolved it. **TODO**:
  improve the heuristic to prefer tables with a `Description`/`Name`/`CatName`
  column and an exact matching ID PK, rather than name-pattern matching.

---

## Open questions / experiment backlog

- What exact tables does a *successful* DCC create write to? Beyond
  `DCC_Department`, `DCC_Class`, `DCC_Category`, `DeptClassCat`, we expect
  GL-code and Royalty defaults to be populated, plus possible audit rows.
  Confirm via a clean Dept-number experiment.
- Does "Add New DCC" populate `Inventory_Turnover` or a per-location join?
- Does the "Set Inventory" button (visible on the main panel when a DCC is
  selected) write DCC rows per location, or is DCC global?
- Does toggling "Discounts" / "Transmit Electronic Shelf Tags" /
  "Digital Content Mass Adopt Default" write to separate tables or columns?
- Compare: create via WPAdmin vs. create via PrismCore POS (if POS has any
  DCC surfaces) — does the write footprint differ?
- Compare: delete DCC vs. inactivate DCC. Does WPAdmin even allow delete?
- Separately, capture the write-footprint of a **new Class under existing
  Department** — the workflow Marcos will eventually need.

Backlog items are worked top-down as opportunity or need arises.

---

### Experiment 2 — Create a new GM item via Item Maintenance (close before Update)

- **Date**: 2026-04-22
- **Client**: PrismCore Admin (WPAdmin)
- **Path in UI**: `101 Item Maintenance` window → "Add Item" toolbar button →
  `Add Record` dialog → OK → `Copy/Add Inventory Records` dialog → **Close**
  (NOT Update — intentionally skipping the per-location inventory commit).
- **Goal**: Map the minimal write footprint of a GM item create, and determine
  what gets persisted if the user skips the Copy/Add Inventory step. Also
  confirm the item correctly lands on DCC 30-30-30 (DCCID 1973790).

**Snapshots**:
- Before: `tmp/prism-snapshots/before-item-add.json`
- After: `tmp/prism-snapshots/after-item-add-sku-11989875.json`
- Diff JSON: `tmp/prism-snapshots/diff-before-item-add-vs-after-item-add-sku-11989875.json`
- Diff text: `tmp/prism-snapshots/diff-item-add.txt`

**Input on "Add Record" dialog**:

| Field | Value entered | Resolved to |
|---|---|---|
| Use Style | unchecked | n/a |
| Description | `TEST ITEM` | GeneralMerchandise.Description / ItemMaster.Description |
| Vendor | `A&R001` | VendorID=150 "A&R WHOLESALE (3006425)" |
| Mfg | `A.F001` | VendorID=1712 "A.FRITZ & ASSOCIATES LLC (1020980)" — *Mfg is stored in the same VendorMaster table* |
| DCC | `303030` | DCCID=1973790 (our new COPYTECH) |
| Size | `1.0 MM` | SizeID=15 (in `dbo.GMSize` master) |
| Color | `#16` | Color.ColorID=2207, Description="#16" |
| Catalog # | `3434` | ItemMaster.CatISBN="3434" and GeneralMerchandise.CatalogNumber="3434" (**stored redundantly**) |
| Pkg Type | `EA - Each` | GeneralMerchandise.PackageType="EA " (CHAR(3)) |
| Comment | `TEST COMMENT` | Item.txComment="TEST COMMENT" (CHAR(25)) |
| Units/pkg | `13` | GeneralMerchandise.UnitsPerPack=13 |

On click of **OK**, the `Copy/Add Inventory Records` dialog appeared with
the generated SKU visible (11989875), tag type "Small GM", and PIERCE
BOOKSTORE marked "New" in the inventory list. Marcos clicked **Close**
instead of Update, intentionally skipping the per-location inventory
commit.

**Outcome**: SUCCESS. Item SKU=11989875 was saved. Per-location Inventory
rows were NOT written because the Close button short-circuits that step.

#### Write footprint (noise-filtered)

After masking the 47-table noise list from Appendix C, 15 tables show
activity. Of those, the ones that match SKU=11989875 / UUID=110190 /
GMUID=110190 on direct verification are:

| Table | Action | Rows | Details |
|---|---|--:|---|
| `dbo.Item` | INSERT | 1 | The item's "pointer" row (SKU PK, DCCID, VendorID, tax/comment/flags) |
| `dbo.ItemMaster` | INSERT | 1 | The text/descriptive side (Description, CatISBN, imported-Mfg string, textbook fields left null) |
| `dbo.GeneralMerchandise` | INSERT | 1 | GM-specific attributes (Color, SizeID, CatalogNumber, PackageType, UnitsPerPack) |
| `dbo.ItemFindSettingsQueue` | INSERT | 3 | 3 rows queue the item for re-indexing in the "Item Find" search subsystem |
| `dbo.SKUSequence` | UPDATE | 1 | Global SKU counter NextSKU bumped |
| `dbo.Sequence` | UPDATE | 1 | Pierce-specific sequence `PGM####` (LocationID=2, SequenceTypeID=8, Subsystem=1) bumped |

**Total write footprint for a "create GM item, skip Update": 7 rows across
6 tables** (1+1+1+3+1+1 = 8 row-level writes — two of which are updates to
sequence counters, not new rows).

Tables that did **NOT** get rows for our SKU despite showing deltas in the
diff (confirming they're noise from concurrent district activity):

- `Inventory` +1 — NOT ours (our inventory was never committed because we
  clicked Close). The +1 was some other item's inventory update elsewhere.
- `Inv_POVendor` +1 — NOT ours.
- `ItemHistory` +33 — NOT ours (related to the Invoice_* batch posting
  that also hit this snapshot window).
- `Invoice_Header/Detail/Location` — AP invoice posting activity, unrelated.
- `Stock_Adjustment_Table` +1 — NOT ours.
- `PO_Receive`, `PO_ShipVia`, `PO_Vendor` — unrelated PO activity.

These should be added to Appendix C as additional noise-mask candidates
(confirmed over 2 experiments now), especially `Invoice_Header`,
`Invoice_Detail`, `Invoice_Location`, `ItemHistory`, `Inventory`,
`Inv_POVendor`, `Stock_Adjustment_Table`, `PO_Receive`, `PO_ShipVia`,
`PO_Vendor`, `Sequence` (only the Pierce PGM row is signal for our event;
the fact that Sequence shows activity isn't noise per se — the signal is
which specific SequenceID changed).

#### Row-level detail for SKU=11989875

```
Item
----
  SKU                 = 11989875
  VendorID            = 150                (-> VendorMaster: "A&R WHOLESALE")
  DCCID               = 1973790            (-> COPYTECH 30-30-30)
  UsedDCCID           = 0                  (unused for GM items)
  UUID                = 110190             (links Item <-> GeneralMerchandise <-> ItemMaster)
  TypeID              = 1                  (GM item type)
  CreateDate          = 2026-04-22 18:08:06.823 UTC
  BarCode             = null               (no barcode entered)
  MinOrderQty         = 0
  txComment           = "TEST COMMENT"    (CHAR(25) padded)
  fListPriceFlag      = 0
  Subsystem           = 1                  (GM, matches DCC.Subsystem)
  fDiscontinue        = 0
  DiscCodeID          = 0                  (no discount)
  Weight              = 0
  ItemTaxTypeID       = 4                  (-> Item_Tax_Type.Description = "STATE")
  StyleID             = null
  ItemSeasonCodeID    = null
  fPerishable         = 0
  LastRecvDate        = null
  LastPODate          = null
  fIDRequired         = 0

ItemMaster
----------
  ITMUID              = 156665             (auto-increment master ID)
  UUID                = 110190             (matches Item.UUID)
  CatISBN             = "3434"             (CHAR(30) padded — catalog # lives here too)
  Description         = "TEST ITEM"        (CHAR(128) padded — also on GeneralMerchandise!)
  Subsystem           = 1
  ImpMfg              = "A.F001"           (CHAR(10) — raw user input string, not resolved)
  BdType              = null               (binding type — textbook-only)
  EdColor             = "#16"              (CHAR(20) — redundant text copy of Color)
  CpSize              = "1.0 MM"           (CHAR(15) — redundant text copy of Size)
  Bookkey             = null               (textbook-only)
  ISBN13              = null               (textbook-only)
  StyleGraphic        = null

GeneralMerchandise
------------------
  GMUID               = 110190             (matches Item.UUID)
  SKU                 = 11989875
  AlternateVendorID   = 0                  (no alt vendor)
  MfgID               = 1712               (-> VendorMaster: "A.FRITZ & ASSOCIATES LLC")
  Description         = "TEST ITEM"        (full 128 char)
  Type                = null
  Color               = 2207               (-> Color.Description = "#16")
  Size                = null               (deprecated? column unused)
  SizeID              = 15                 (-> GMSize, value "1.0 MM")
  CatalogNumber       = "3434"             (CHAR(30) — redundant with ItemMaster.CatISBN)
  PackageType         = "EA "              (CHAR(3))
  UnitsPerPack        = 13
  Weight              = 0
  ImageURL            = null
  OrderIncrement      = 1
  UseScaleInterface   = false
  Tare                = null

ItemFindSettingsQueue
---------------------
  ItemFindSettingsQueueID=1911766 SKU=11989875
  ItemFindSettingsQueueID=1911767 SKU=11989875
  ItemFindSettingsQueueID=1911770 SKU=11989875
  (non-consecutive IDs — queue is shared with other inserts happening simultaneously)

SKUSequence (UPDATE)
--------------------
  NextSKU: 1198980 -> 1198988  (+8, but only 2 items inserted district-wide during window — 6 SKUs allocated somewhere without a committed Item row)

Sequence (UPDATE)
-----------------
  SequenceID=10001406, LocationID=2, SequenceTypeID=8, Description="General Merch",
  Subsystem=1, QwkFormat="PGM%4.4ld", Template="PGM####", fAutogen=1
  NextNumber: 8834 -> 8835  (our item got Pierce-local sequence PGM8834)
```

#### Findings — Item data model

20. **Three-table item layering** for GM items. Every item has:
    - `Item` — "pointer" row, SKU PK, FKs to DCC / Vendor / Tax / Style /
      Season, top-level flags. Small (22 columns).
    - `ItemMaster` — descriptive/text side, keyed on `UUID`. Holds the
      Description, Catalog # (as CatISBN), raw user-entered Mfg code
      (ImpMfg), and textbook-specific fields that are null for GM items.
    - `GeneralMerchandise` — GM attributes, keyed on `GMUID` (= `UUID`).
      Holds Color, SizeID, CatalogNumber, PackageType, UnitsPerPack.
    
    The surrogate `UUID = GMUID = Item.UUID` links the three. `ITMUID` is
    a separate auto-increment on ItemMaster that's NOT the same as UUID.
    A complete "item" requires all three rows — reading just `Item` misses
    Description/Color/Size.
21. **Redundant storage of several fields**:
    - Description exists on both `ItemMaster.Description` (CHAR(128)) and
      `GeneralMerchandise.Description`.
    - Catalog # exists on both `ItemMaster.CatISBN` (CHAR(30)) and
      `GeneralMerchandise.CatalogNumber` (CHAR(30)).
    - Color/Size exist as resolved FK IDs on `GeneralMerchandise`
      (`Color`, `SizeID`) AND as raw text copies on `ItemMaster`
      (`EdColor`, `CpSize`).
    - Vendor is stored via `Item.VendorID` (FK). Mfg is stored via
      `GeneralMerchandise.MfgID` (FK to same VendorMaster) AND as raw text
      in `ItemMaster.ImpMfg`.
    
    Denormalization is pervasive. Any sync layer MUST keep these in sync
    to avoid display drift.
22. **`Mfg` and `Vendor` share `dbo.VendorMaster`.** `MfgID` on
    GeneralMerchandise is really a `VendorID` in disguise. Roles are
    distinguished by context (Vendor.VendTypeID may flag "manufacturer"
    vs "supplier"). Verified: VendorID=1712 → "A.FRITZ & ASSOCIATES LLC
    (1020980)" with VendorCode "A.F001", matching what the UI showed
    under the Mfg field.
23. **`ItemTaxTypeID=4` ("STATE") was defaulted by the UI even though
    neither the DCC nor the item form explicitly set it.** DCCLocation
    for our DCC has ItemTaxTypeID=0 (unset). So the default came from
    somewhere else — candidates: a global "default tax type for Subsystem=1
    items" config, or hardcoded in WPAdmin, or resolved from the Vendor.
    Worth a micro-experiment later: edit the item's tax type to something
    else, diff, and verify where the change lands.
24. **SKU is an 8-digit integer; `SKUSequence.NextSKU` is 7 digits.** Our
    `NextSKU` went 1198980 → 1198988, but our actual SKU was 11989875.
    The SKU appears to be derived as `(NextSKU * 10) + check_digit` or
    similar — the exact formula is a future investigation item.
    Importantly: `SKUSequence` bumped by 8 but only 2 items were created
    district-wide during our window → 6 SKUs were allocated without being
    committed (batch pre-allocation, or WPAdmin held IDs then released).
25. **Prism uses two sequence systems in parallel**:
    - `SKUSequence` (single-row counter) for the global SKU numeric ID
    - `Sequence` (many rows keyed by SequenceID, scoped by LocationID /
      SequenceTypeID / Subsystem) for location-specific string codes like
      `PGM####`, `CGM####`, `CITY-######-DSR`, etc.
    
    For Pierce GM items, the relevant row is
    `(LocationID=2, SequenceTypeID=8, Subsystem=1)` with template `PGM####`.
    Our item got Pierce-local code `PGM8834`. Where this code ends up on
    the item (barcode? alt code? display-only?) is a follow-up question —
    it doesn't appear on the Item row itself.
26. **`ItemFindSettingsQueue` is a work queue for search re-indexing.**
    3 rows get enqueued per new GM item. The queue is shared across all
    users' inserts (IDs 1911766, 1911767, 1911770 for us — with a gap at
    1911768, 1911769 suggesting another insert happened in between). A
    separate background process presumably drains the queue and updates
    indexed tables like `ItemFindSettings` / `ItemFindSettingsItems`.
    Laportal readers don't need to touch this; writers that bypass
    WPAdmin would need to either write queue rows themselves or accept
    that Item Find won't surface their items until next re-index.
27. **Description columns are HEAVILY padded**: ItemMaster.Description is
    CHAR(128) — 128 char wide, space-padded. Displaying without TRIM will
    leave 100+ trailing spaces. All TRIM everywhere.
28. **Color master is `dbo.Color`** (columns: ColorID PK, Description,
    fDisable, AlternateDescription, Reference, MediaSetId, UniqueId GUID).
    Size master is `dbo.GMSize` (not `Size`, not `Sizes`). Both have GUID
    `UniqueId` columns like TagType and VendorMaster — same cross-server
    sync pattern.

#### Implications for laportal

- **A complete "item read" must join `Item` + `ItemMaster` + `GeneralMerchandise`
  on the UUID/GMUID/UUID trio.** Laportal's existing products mirror
  already does this (confirmed by the `prism-sync` sales code path). New
  code should not regress.
- **Writes that create items must insert into all three tables atomically**
  and must bump both `SKUSequence` (new SKU) and the appropriate per-location
  `Sequence` row (new location code). A stored proc that does all of this
  in a single transaction would be ideal — we should check whether Prism
  exposes one (e.g., `SP_ItemMaintenance_Add` or similar) even though we
  can't read its source.
- **Skipping the per-location Inventory commit is a legitimate user choice**
  that leaves the item in a half-configured state: it exists in Prism
  catalog tables but has no `Inventory` row at any location. The item will
  NOT appear at POS until inventory is committed. Laportal's "create item"
  UI should decide up-front whether to force inventory setup or allow
  the same two-stage pattern.
- **Redundant fields mean we CANNOT treat `GeneralMerchandise` as the
  single source of truth for Description or CatalogNumber** — ItemMaster
  holds the same (padded) data and some Prism surfaces may read from
  ItemMaster. Edits must update both.
- **The `ItemFindSettingsQueue` re-index pattern is a good pattern to
  emulate** if we ever add a search-over-items feature in laportal
  independent of Supabase's Postgres full-text search.
- **For the "Update" path** (the button Marcos skipped in the Copy/Add
  Inventory dialog), we have no data yet — that's its own experiment
  (Experiment 2.1: add an item and DO click Update to see what Inventory
  rows get written).

#### Follow-ups

- **Experiment 2.1**: Create another test item and DO click Update in the
  Copy/Add Inventory dialog. Diff to learn what Inventory / InventoryLocation
  / POS-push rows get written. Critical for laportal's future item-create
  flow to match parity.
- **Experiment 2.2**: Edit the existing TEST ITEM (SKU 11989875): change
  Cost/Retail, change Tag Type, toggle Discontinue. Diff each to map
  field→table→column precisely.
- **Experiment 2.3**: Add a Barcode to TEST ITEM and see what table
  it lands in (likely `BarCode` or `Item.BarCode` plus a lookup table).
- **Experiment 2.4**: Delete TEST ITEM. Does Prism hard-delete or flag
  `fDiscontinue`? How do the 3+ item-related rows cascade?
- **Answer**: where does `ItemTaxTypeID=4` ("STATE") come from when neither
  DCC nor dialog specified it? Look for a system-wide default or Vendor-
  level default.
- **Decode**: the SKU-to-NextSKU relationship. Likely a check-digit formula.
- **Decode**: how `Sequence.NextNumber` maps onto the item's surfaces
  (`PGM8834` for us — where is that code actually visible?).

---

## Appendix A — Confirmed schema reference (DCC + Item domains)

Captured from the before/after snapshots and full-table inspections in
Experiment 1. All column types are *observed* (from SELECT output) — SQL
Server exact types require a separate `sys.columns` query. Fixed-width CHAR
columns are flagged with observed widths.

### `dbo.DCC_Department` — Department dictionary

| Column | Type (observed) | Notes |
|---|---|---|
| `Department` | int | PK (`PK_DCC_Department`). User-supplied, NOT identity. |
| `DeptName` | CHAR(15) space-padded | Fixed width. TRIM for display. |
| `Subsystem` | int | 1=General Merchandise (17 rows), 2=Textbook (6), 3=1, 11=1. Determines which Tag Types / GL-paths apply. Matches "System Type" dropdown in WPAdmin "Add New DCC" dialog. |

### `dbo.DCC_Class` — Class dictionary under a Department

| Column | Type | Notes |
|---|---|---|
| `Department` | int | PK part 1, FK to DCC_Department |
| `Class` | int | PK part 2 |
| `ClassName` | CHAR(15) space-padded | Fixed width |

### `dbo.DCC_Category` — Leaf Category under (Dept, Class)

| Column | Type | Notes |
|---|---|---|
| `Department` | int | PK part 1 |
| `Class` | int | PK part 2 |
| `Category` | int | PK part 3 |
| `CatName` | CHAR(15) space-padded | Fixed width |

### `dbo.DeptClassCat` — DCC junction (surrogate DCCID per triplet)

| Column | Type | Notes |
|---|---|---|
| `DCCID` | int IDENTITY | PK. Global; gaps in sequence from interleaved inserts across district. |
| `Department` | int | Redundant copy for join convenience |
| `Class` | int | Redundant copy |
| `Category` | int | Redundant copy |
| `DCCType` | int | Hierarchy level. 3=Category (leaf, 254 rows). 4=1 special, 5=1 special. Types 1/2 not observed — Dept/Class-only entries may not exist in this junction. |

`Item.DCCID` foreign-keys here.

### `dbo.DCCLocation` — Per-DCC-per-location settings

| Column | Type | Notes |
|---|---|---|
| `DCCLocID` | int IDENTITY | PK |
| `LocationID` | int | 0 = "Applies to All Locations" pseudo-location. Otherwise specific LACCD location. |
| `DCCID` | int | FK to DeptClassCat |
| `DCCMask` | int (bitmask) | 24-bit mask. 0xFFFFFF observed on "fresh, all bits set" rows. Semantics TBD — likely "which fields the user explicitly set vs. defaulted". |
| `TaxTypeID` | int | FK to `dbo.Tax_Type` |
| `ItemTaxTypeID` | int | FK to `dbo.Item_Tax_Type`. 0 = unset sentinel (no row in master for ID 0). |
| `TagTypeID` | int | FK to `dbo.TagType` (not `Tag_Type`). Determines printed tag layout. |
| `DefaultMargin` | int (pct) | Observed 50 for 50%. Integer percent. |
| `SortID` | int | |
| `fDiscountFlag` | bit (stored as 0/1) | |
| `Pos_Flag` | bit (stored as 0/1) | |
| `fESTIncludeDCC` | bit | May be NULL in legacy rows (see noise-update finding in 1.3) |
| `fDefaultDigitalDCC` | bit | Same — legacy nulls observed |

### `dbo.DCCLocationExt` — (DCC × Location) → DCCLocation resolution

| Column | Type | Notes |
|---|---|---|
| `DCCID` | int | PK part 1 |
| `LocationID` | int | PK part 2. One row per active LACCD location (1-13, 15-18 — 17 rows per DCC). |
| `DCCLocID` | int | Points at the DCCLocation row that governs this (DCC, Location) pair. |

When a DCC has only a LocationID=0 "applies to all" DCCLocation row, all 17
DCCLocationExt rows point at that single DCCLocID. Per-location overrides
insert additional DCCLocation rows and re-point the relevant
DCCLocationExt row.

### `dbo.DccLocationRoyalty` — Per-DCC-per-location royalty

| Column | Type | Notes |
|---|---|---|
| `DccLocationRoyaltyId` | int IDENTITY | PK (surrogate). Contiguous sequence during a single create — 17 rows in one block. |
| `DccId` | int | FK to DeptClassCat.DCCID (note the casing: `DccId`, not `DCCID`) |
| `LocationId` | int | 17 rows per DCC (locs 1-13, 15-18) |
| `RoyaltyPercentage` | decimal | 0 default |
| `RoyaltyMinimum` | decimal | 0 default |

### `dbo.TagType` — Tag layout master (NOT `Tag_Type`)

| Column | Type | Notes |
|---|---|---|
| `TagTypeID` | int | PK |
| `Description` | CHAR(20) padded | e.g., "Small GM" |
| `ScriptID` | int | Determines print script |
| `PaperTypeID` | int | |
| `FormID` | int | |
| `IsDefault` | bit | |
| `Subsystem` | int | Filters visibility by DCC subsystem (1=GM, 2=Textbook, etc.) |
| `ShowOrder` | int | UI sort order |
| `UniqueId` | uniqueidentifier (GUID) | Cross-server sync marker? |

### `dbo.Tax_Type` — Tax type dictionary

| Column | Type | Notes |
|---|---|---|
| `TaxTypeID` | int | PK. 0 = "None" / no tax. |
| `Description` | CHAR(40) padded | e.g., "None" |

### `dbo.Location` — LACCD location master

Confirmed rows: 17 active locations with IDs 1-13, 15-18 (LocationID 14
absent across every location-keyed table). Columns: `LocationID` (PK),
`AddressGroupID`, `Abbreviation` (CHAR(4), e.g. "PCOP"), `ShortDescription`
(CHAR(20)), `Description` (CHAR(80)), `StoreNumber`, `SortOrder`,
`RentalAccountID`, `StoreAcctNum`. Pierce scope: LocationID 2 (PIER), 3
(PCOP = Copy Tech), 4 (PFS). PBO = 5 is excluded per scope rule.

### `dbo.Item` — item "pointer" row (Experiment 2)

| Column | Type | Notes |
|---|---|---|
| `SKU` | int | PK (identifier). NOT identity — generated by app via `SKUSequence`. |
| `VendorID` | numeric(9) | FK to `VendorMaster`. Primary vendor for the item. |
| `DCCID` | numeric(9) | FK to `DeptClassCat.DCCID`. |
| `UsedDCCID` | numeric(9) | Used-textbook DCCID. 0 for non-textbook. |
| `UUID` | numeric(9) | Surrogate link → `ItemMaster.UUID`, `GeneralMerchandise.GMUID`. |
| `TypeID` | int | Item type (1 = GM in our observation). |
| `CreateDate` | datetime | UTC (driver sets `useUTC:true`). |
| `BarCode` | CHAR(20) | Optional. Null if no barcode entered at create. |
| `MinOrderQty` | smallint | |
| `txComment` | CHAR(25) | User comment, space-padded. |
| `fListPriceFlag` | tinyint | |
| `Subsystem` | tinyint | Matches DCC subsystem (1=GM, 2=Textbook). |
| `fDiscontinue` | tinyint | Soft-delete flag. |
| `DiscCodeID` | numeric(9) | FK to discount master (0 = no discount). |
| `Weight` | decimal | |
| `ItemTaxTypeID` | int | FK to `Item_Tax_Type`. 0 = sentinel "unset"; 4 = "STATE". |
| `StyleID` | int | FK to style master (nullable). |
| `ItemSeasonCodeID` | int | |
| `fPerishable` / `fIDRequired` | tinyint | |
| `LastRecvDate` / `LastPODate` | datetime | Populated by purchasing/receiving flows. |

### `dbo.ItemMaster` — descriptive/text side (Experiment 2)

| Column | Type | Notes |
|---|---|---|
| `ITMUID` | numeric(9) IDENTITY | PK (surrogate). Separate from UUID. |
| `UUID` | numeric(9) | Links to Item.UUID. |
| `CatISBN` | CHAR(30) padded | Catalog # for GM; ISBN for textbooks. |
| `Description` | CHAR(128) padded | Item description. MUST TRIM. |
| `Subsystem` | tinyint | |
| `ImpMfg` | CHAR(10) | Raw user-entered Mfg code (not FK-resolved) |
| `BdType` / `EdColor` / `CpSize` | CHAR | Textbook: binding type, edition color. GM: redundant text copies of Color / Size. |
| `Bookkey` / `ISBN13` / `StyleGraphic` | various | Textbook / style-specific |

### `dbo.GeneralMerchandise` — GM attributes (Experiment 2)

| Column | Type | Notes |
|---|---|---|
| `GMUID` | numeric(9) | PK. Equals Item.UUID. |
| `SKU` | int | Redundant (also on Item). |
| `AlternateVendorID` | numeric(9) | Secondary vendor. 0 if none. |
| `MfgID` | numeric(9) | **FK to `VendorMaster.VendorID`** — manufacturer is just another vendor. |
| `Description` | CHAR(128) padded | Redundant with ItemMaster.Description. |
| `Type` | int | |
| `Color` | int | FK to `dbo.Color.ColorID`. |
| `Size` | (deprecated?) | Null in observed rows — use `SizeID`. |
| `SizeID` | int | FK to `dbo.GMSize`. |
| `CatalogNumber` | CHAR(30) padded | Redundant with ItemMaster.CatISBN. |
| `PackageType` | CHAR(3) | e.g., "EA ". |
| `UnitsPerPack` | int | |
| `Weight` / `Tare` | decimal | |
| `ImageURL` | varchar | |
| `OrderIncrement` | int | |
| `UseScaleInterface` | bit | |

### `dbo.ItemFindSettingsQueue` — search re-index work queue

| Column | Type | Notes |
|---|---|---|
| `ItemFindSettingsQueueID` | int IDENTITY | PK |
| `SKU` | int | FK to Item. 3 rows are enqueued per new GM item. |

Shared queue across all item inserts — IDs non-contiguous. Drained by a
background process into `ItemFindSettingsItems` / related tables.

### `dbo.VendorMaster` — vendors **and** manufacturers share this table

| Column | Type | Notes |
|---|---|---|
| `VendorID` | numeric(9) | PK |
| `VendTypeID` | int | Distinguishes vendor/manufacturer/other? |
| `VendorCode` | CHAR(10) padded | User-facing code (e.g., "A&R001") |
| `Name` | CHAR(50) padded | Display name incl. parenthesized external ID |
| `UniqueId` | uniqueidentifier (GUID) | Cross-server sync |
| (+ ~25 more) | | Tax IDs, lead time, contact info, flags |

`MfgID` fields on `GeneralMerchandise` / `ItemMaster.ImpMfg` resolve to
rows in this same table.

### `dbo.Color` — color master

Columns: `ColorID` (PK), `Description` (CHAR(20) padded), `fDisable`,
`AlternateDescription`, `Reference`, `MediaSetId`, `UniqueId` (GUID).

### `dbo.GMSize` — general-merchandise size master

Not explored in detail yet; referenced from `GeneralMerchandise.SizeID`.
Note: the table name is `GMSize`, not `Size` or `Sizes`.

### `dbo.Item_Tax_Type` — item tax-type dictionary

| ID | Description |
|--:|---|
| 0 | (no row — sentinel "unset") |
| 4 | "STATE" |
| (other) | (not catalogued yet) |

### `dbo.SKUSequence` — global SKU counter

Single-row table (PK-less). Columns: `NextSKU` (int), `Padding` (nullable).
Bumped when new SKUs are allocated. Observed behavior: bumped by 8 when
2 items were committed district-wide, implying batch-allocation or
reservation-then-rollback pattern. The actual SKU value stored on Item is
derived from NextSKU via an unknown transform (likely `NextSKU × 10 + check`).

### `dbo.Sequence` — multi-purpose location/type-scoped counters

| Column | Type | Notes |
|---|---|---|
| `SequenceID` | int IDENTITY | PK |
| `LocationID` | int | 0 = shared across locations; otherwise specific |
| `SequenceNumber` | int | Secondary scope (for per-subsystem variants of the same SequenceTypeID) |
| `SequenceTypeID` | int | Category: 1=DSR, 2=BC, 3=CN, 4=CXFR, 5=BB, 6=BO, 7=WH, 8=item code, 9=GL, 10=PS, 11=SR, 12=MO, 13=MR |
| `StartNumber` / `NextNumber` / `EndNumber` | int | Counter bounds |
| `QwkFormat` | CHAR(25) | printf-style format (`PGM%4.4ld`) |
| `Template` | CHAR(25) | Pattern version (`PGM####`) |
| `UseShare` | bit | |
| `Description` | CHAR | e.g., "General Merch", "Textbook", "Shared" |
| `Subsystem` | tinyint | |
| `fAutogen` | bit | Whether the app auto-assigns |

Creating a new GM item at Pierce bumps
`(LocationID=2, SequenceTypeID=8, Subsystem=1, Template=PGM####)` — our
item got code `PGM8834`.

---

## Appendix B — Quick references (DCC 30-30-30, TEST ITEM)

### Quick reference: DCC 30-30-30 (COPYTECH)

Created 2026-04-22 via WPAdmin tree-view workflow. Full payload below; raw
JSON at `tmp/prism-snapshots/inspect-dcc-1973790.json`.

| Field | Value |
|---|---|
| DCCID | `1973790` |
| Triplet | `Dept 30 GENERAL MERCH → Class 30 PAPER PRODUCTS → Category 30 COPYTECH` |
| DCCType | 3 (leaf Category) |
| Subsystem | 1 (General Merchandise) |
| DCCLocID | 471 (single row, LocationID=0 "applies to all") |
| Tag Type | 10000121 = "Small GM" |
| Tax Type | 0 = "None" |
| Item Tax Type | 0 (unset) |
| Default Margin | 50% |
| DCCMask | 0xFFFFFF |
| Discounts | off |
| POS Flag | off |
| EST Include | false |
| Digital Adopt Default | false |
| Royalty | 0% / $0 min at all 17 locations |
| Items linked | 0 |
| Applies at PCOP (LocationID 3) | yes (via DCCLocationExt → DCCLocID 471) |
| Other tables referencing DCCID | none (scanned 63 candidate tables) |

Rename candidates for CatName if re-naming is desired later: currently
"COPYTECH       " (CHAR(15) padded). 7 visible chars, 8 trailing spaces.

### Quick reference: TEST ITEM (SKU 11989875, created Experiment 2)

| Field | Value |
|---|---|
| SKU | `11989875` |
| UUID / GMUID | `110190` (both tables share this surrogate) |
| ITMUID | `156665` (separate ItemMaster IDENTITY) |
| DCC | 1973790 = 30-30-30 COPYTECH |
| Vendor | 150 = "A&R WHOLESALE (3006425)" (code `A&R001`) |
| Mfg | 1712 = "A.FRITZ & ASSOCIATES LLC (1020980)" (code `A.F001`; lives in VendorMaster) |
| Description | "TEST ITEM" |
| Size | SizeID=15 = "1.0 MM" |
| Color | ColorID=2207 = "#16" |
| Catalog # | "3434" |
| Pkg Type | "EA - Each", UnitsPerPack=13 |
| Comment | "TEST COMMENT" |
| Tax Type | ItemTaxTypeID=4 = "STATE" (*defaulted by UI even though not entered*) |
| Tag Type (from Copy/Add dialog) | 10000121 = "Small GM" — *not written to Item since Update wasn't clicked* |
| Retail / Cost / Margin | all 0 — *not committed (Close instead of Update)* |
| Inventory rows | **none** — Pierce inventory was queued in the dialog but never committed |
| Pierce sequence code | `PGM8834` (from `Sequence` SequenceID=10001406 NextNumber bump) |
| Item Find queue | 3 rows enqueued (IDs 1911766, 1911767, 1911770) pending re-index |

Item is in a half-configured state: catalog rows exist, inventory rows do
not. Item won't appear at any POS until the Copy/Add Inventory dialog is
re-opened and Update is clicked.

---

## Appendix C — Noise tables to ignore in future diffs

From Experiment 1.3, the 57+ tables below changed during our 1-hour capture
window from concurrent district activity (not from our DCC action). When
running focused diffs, mask these. TODO: wire this list into
`prism-diff.ts` as a `--ignore-noise` flag with a `--show-ignored` inverse.

**Live POS transaction activity** (cashier sales happening during the window):
`Transaction_Header`, `Transaction_Detail`, `Transaction_Tax`,
`Transaction_Tender`, `Transaction_Detail_Tender`,
`TransactionTaxTenderDetail`, `Transaction_Tax_Detail`,
`Transaction_Tender_Adtnl`, `Transaction_AVS`,
`Transaction_Detail_Tend_Tmp`, `SalesTable`, `TempSalesTable`,
`SalesHistoryHeader`, `POS_Open_History`, `POS_ProcessPaymentReports`,
`POS_ProcessPaymentReportDetails`

**POS push-to-register queues** (Push-to-POS churn, sync drains):
`Pos_Update`, `Pos_Update_Raw`, `SortHeader`, `Web_Transfer`,
`Web_Transfer_History`, `Web_Transfer_History_Raw`

**AR / GL posting**:
`Acct_ARInvoice_Header`, `Acct_ARInvoice_Detail`, `Acct_ARInvoice_Tender`,
`Acct_Apply`

**Item / inventory churn elsewhere in district**:
`Item`, `ItemMaster`, `GeneralMerchandise`, `Inventory`, `Inv_POVendor`,
`SKUSequence` (counter bumps)

**Purchase orders / merchandise orders**:
`PO_Header`, `PO_Detail`, `PO_Location`, `MO_Address`

**Catalog / customer / pricing**:
`Catalog_Sales_Header`, `Catalog_Sales_Detail`, `Catalog_Sales_Tender`,
`CatalogInventory`, `Customer_Address`, `Customer_Location`, `PriceChange`

**Events / queues / caches**:
`SalesEventItems`, `SalesEventItemLocations`, `ItemFindSettingsItems`,
`ItemFindSettingsQueue`, `LocationSelections`, `LocationSelectionLocations`

**Audit / access logs**:
`SystemLog`, `ModuleAccessHistory`, `ModuleAuditLog`, `AppAccessHistory`,
`POS_Register_Access_History`, `Stock_Ledger_Reverse`, `GblComment`,
`Course_Selection`

**Best practice for clean diffs**: run experiments after Pierce POS close
(after ~8pm) and confirm other LACCD campuses are also idle (weekend
mornings are ideal). Even off-hours, expect audit-log tables to still tick
slightly from background maintenance jobs.

### Additional noise confirmed in Experiment 2 (item-add window)

These tables showed deltas in the Experiment 2 diff but had no rows for
our SKU on direct verification — safely add them to the noise list:

- `Invoice_Header`, `Invoice_Detail`, `Invoice_Location` — AP invoice
  posting (the diff showed +208 in the detail tables, all belonging to
  unrelated invoice IDs).
- `ItemHistory` — +33 rows during the window, none for our SKU. Tracks
  item-level changes tied to other district operations.
- `Inventory`, `Inv_POVendor` — +1 each, NOT ours (we skipped the Update
  that would have written Pierce inventory).
- `Stock_Adjustment_Table` — +1, not ours.
- `PO_Receive`, `PO_ShipVia`, `PO_Vendor` — +1 each, PO churn.

**Signal table that changed but is mostly noise**: `Sequence` shows an
update on every experiment that allocates a location-scoped code. The
*which row* changed is signal; the fact that the table has activity is
not a discriminator. Future tooling should surface changed rows inline
rather than treating Sequence as binary "changed/not-changed".

---

## Appendix D — laportal vs. WPAdmin item-create: what matches, what's missing

Compared against `src/domains/product/prism-server.ts :: createGmItem`
(the only item-create path in laportal today, wrapping
`EXEC P_Item_Add_GM` + a direct `INSERT INTO Inventory` per location).

### Key architectural match

Both WPAdmin's "Add Record" dialog and laportal's `createGmItem` route
through the **same stored procedure `P_Item_Add_GM`**. Everything that
procedure does internally is by definition identical between the two
callers, which means these writes are *free parity* for laportal:

- INSERT `Item` (SKU, VendorID, DCCID, TypeID, tax-type, comment, flags…)
- INSERT `ItemMaster` (UUID, CatISBN, Description, ImpMfg, …)
- INSERT `GeneralMerchandise` (GMUID, MfgID, Color, SizeID, CatalogNumber,
  PackageType, UnitsPerPack, …)
- UPDATE `SKUSequence` (global counter bump)
- UPDATE `Sequence` row `(LocationID=2, TypeID=8, Subsystem=1, PGM####)`
- INSERT 3× `ItemFindSettingsQueue` (search re-index enqueue)

Marcos's UI clicks in Experiment 2 produced exactly this footprint; any
call to `createGmItem` from laportal produces the same proc-driven
footprint. No action needed to reach parity on these tables.

### What's DIFFERENT today

| Concern | WPAdmin (Add Record + Update) | laportal `createGmItem` | Notes |
|---|---|---|---|
| `Color` on GeneralMerchandise | User picks from `dbo.Color` lookup | **Hardcoded `0`** at [prism-server.ts:98](../../src/domains/product/prism-server.ts) | Every laportal-created item has no color — not surfaced in UI or API input |
| `SizeID` on GeneralMerchandise | User picks from `dbo.GMSize` lookup | **Hardcoded `0`** at [prism-server.ts:99](../../src/domains/product/prism-server.ts) | Same — no size on laportal items |
| `ItemTaxTypeID` on Item | Defaulted to `4` = STATE by WPAdmin when user doesn't pick | Defaulted to `6` = CA 9.75% at [prism-server.ts:104](../../src/domains/product/prism-server.ts) | Different defaults. laportal's is more Pierce-correct. Worth confirming with accounting whether "STATE" or "CA 9.75%" is the right default for Pierce. |
| `AlternateVendorID` on GeneralMerchandise | User-settable (2nd vendor) | Not exposed; proc defaults it | No ability to set in laportal |
| `Use Style` / `StyleID` on Item | Checkbox + picker on Add Record dialog | Not exposed | Cannot create style-linked items |
| `Discount` / `DiscCodeID` on Item | User-pickable | Hardcoded `0` at [prism-server.ts:109](../../src/domains/product/prism-server.ts) | No item-level discounts on laportal-created items |
| `fPerishable`, `fIDRequired` flags on Item | Checkboxes on main Item Maintenance panel | Not exposed on create | Must set via update afterwards |
| `Inventory` row fields | Copy/Add dialog offers: Cost, Retail, Tag Type, Discount, Inv Status, Royalty, Min Royalty, Min/Max Stock, Auto Order, Min Order, Rent Only, No Returns | **Only `Retail`, `Cost`** — see [prism-server.ts:129](../../src/domains/product/prism-server.ts) | Biggest gap. laportal-created items have minimal Inventory rows — no tag type, no status code, no stock limits, no royalty. |
| Inventory locations | User picks in Copy/Add dialog ("Set Values to Selected Location(s)"). Experiment 2 showed the dialog pre-selected Pierce as "New". | Accepts an `inventory[]` array; defaults to Pierce-only if omitted | Parity possible with explicit multi-location input. |

### What's NOT exposed in either path (tables we learned about that
nobody touches from laportal today)

- `BarCode` lookup tables (if any separate ones exist beyond `Item.BarCode` CHAR(20))
- Vendor-item linkage tables — existence/necessity unverified
- Any per-location DCCLocation override (distinct from DCC-level Experiment 1 writes)

### What laportal should ADD to reach full WPAdmin parity on create

Ranked by value × effort (small effort / high value at top):

1. **Expose `Color` and `SizeID` in `createGmItem` input.** They're
   already proc parameters — we just pass `0`. Expand
   `CreateGmItemInput` to accept `colorId?: number` and `sizeId?: number`,
   thread them through to `addRequest.input("Color", ..., input.colorId ?? 0)`.
   Pair with `listColors()` (already exists) and a `listSizes()` (need
   to add) for pickers. **Effort: 30 minutes. Value: high** — every GM
   item the team creates today is colorless / sizeless.

2. **Widen the Inventory INSERT to match the Copy/Add dialog.** Extend
   the query at [prism-server.ts:128-130](../../src/domains/product/prism-server.ts)
   and the corresponding request input set to include:
   `TagTypeID`, `StatusCodeID`, `EstSales`, `EstSalesLocked`,
   `fInvListPriceFlag`, `fNoReturns`, plus (new territory for laportal)
   `MinimumStock`, `MaximumStock`, `AutoOrderQty`, `MinOrderQty`,
   `RoyaltyPercentage`, `RoyaltyMinimum`, `fRentOnly`. Thread as optional
   fields on `CreateInventoryInput`. Use DB defaults when omitted.
   **Effort: 2-3 hours. Value: high** — Pierce-created items today have
   zero stock limits, no tag type (so no printed tags work), no status
   code (could break Discontinue queries later).

3. **Confirm and align `ItemTaxTypeID` default.** Which of 4 (STATE) vs
   6 (CA 9.75%) is right for Pierce GM items? Check with accounting,
   pick one, pin it in code with a comment citing the decision.
   **Effort: 10 minutes + one Slack to accounting.**

4. **Add `styleId`, `altVendorId`, `discCodeId`, `fPerishable`,
   `fIdRequired` as optional inputs to `CreateGmItemInput`** and thread
   through to the proc / a post-proc UPDATE Item. These are available in
   laportal's **update** path already (`prism-updates.ts`) — it's a
   consistency win to also expose them on create. **Effort: 1 hour.**

5. **Run Experiment 2.1** (add item + click Update) to capture the
   *actual* WPAdmin Inventory-write footprint before sizing items 2
   further. Could reveal that WPAdmin writes to additional tables
   (e.g., per-location pricing history, POS push queues). **Effort:
   2 min for the snapshot; analysis + doc ~30 min.**

### Open questions to resolve before further parity work

- Does WPAdmin pop a barcode-assignment dialog when the user enters a
  value and tabs out? If so, does it write to a barcode-sequence table
  we haven't seen? Experiment 2.3 covers this.
- Does `P_Item_Add_GM` silently reject certain DCC/Subsystem mismatches?
  E.g., does creating a GM-subsystem item under a Textbook DCC fail?
  Worth a targeted test so the laportal UI can validate in advance.
- Is there a companion `P_Item_Add_Textbook` proc with different
  behavior? `updateTextbookPricing` exists but creation for textbooks
  is not in laportal at all. Separate experiment worth running once
  textbook-create is on the roadmap.

### Where the comparison lives in code

- Create entry point: [src/app/api/products/route.ts:215](../../src/app/api/products/route.ts)
  calls `createGmItem` after Zod-validating against `createItemSchema`.
- Create implementation: [src/domains/product/prism-server.ts:83-158](../../src/domains/product/prism-server.ts)
- Update implementation (parity reference for field coverage):
  [src/domains/product/prism-updates.ts](../../src/domains/product/prism-updates.ts)
- Batch create (also uses the same proc): [src/domains/product/prism-batch.ts](../../src/domains/product/prism-batch.ts)
