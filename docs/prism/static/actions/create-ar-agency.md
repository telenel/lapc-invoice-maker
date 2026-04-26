# Action: Create an AR agency (department billing account)

**Source binaries:** `WA_AR.dll`, `WACommon.dll` (search/QS), `WPUtility.dll` (framework methods)
**Method:** Plan-cache schema introspection + trigger-body recovery. See [`../plan-cache-method.md`](../plan-cache-method.md).
**Confidence:** ✅ confirmed by recovered DDL/trigger body · 🔵 confirmed by literal binary string · 🔍 inference · ❓ unknown / not yet recovered.
**Companion docs:**
- [`clone-ar-agency.md`](clone-ar-agency.md) — Pierce semester-rollover use case (clone an existing agency rather than creating from scratch).
- [`agency-binary-findings.md`](agency-binary-findings.md) — **2026-04-25 update**: literal MFC column list recovered from `WPData.dll`, verified proc signatures, validation messages. Closes the biggest gap in this doc.

> **Terminology**: "AR account" / "agency" / "billing account" all refer to the same entity in Prism: a row in `Acct_Agency`. Pierce identifies them by `AgencyNumber` — strings like `PSP 26 ANTHRO`. WPAdmin's UI calls them "Accounts"; the schema and procs call them "Agencies". This doc uses **agency** to match the schema.

## TL;DR

There is **no dedicated `SP_*Agency_Add` proc** for the WPAdmin agency-create flow. Creating an agency goes through MFC's `CRecordView::OnRecordAdd` → `CRecordset::AddNew` on a recordset class bound to `Acct_Agency`, which generates an `INSERT INTO Acct_Agency` at runtime from form-field bindings. The literal SQL is therefore **not in any binary** — but the column contract is fully recoverable from the live schema (55 columns, identified below).

The interesting structural finding: **most of the secondary-table population happens automatically via a trigger**, not through proc calls or extra inserts. The `TI_Acct_Agency` trigger fires on every agency `INSERT` and auto-populates `Acct_Agency_Tax_Codes` with one row per existing tax code (Cartesian product across `Tax_Codes`).

So the minimum viable agency-create from outside WPAdmin is:

```sql
INSERT INTO Acct_Agency (...required NOT NULL columns + AgencyNumber + Name + status flags...)
VALUES (...);

DECLARE @new_id int = SCOPE_IDENTITY();

-- Optionally: Customer linkage, DCC permissions, NonMerch overrides.
INSERT INTO Acct_Agency_Customer (...);  -- at least one row for the principal contact
EXEC SP_AcctAgencyCopyDCC <new_id>, <source_agency>;       -- NEW first, OLD second per verified signature
EXEC SP_AcctAgencyCopyNonMerch <new_id>, <source_agency>;  -- NEW first, OLD second per verified signature
```

The `Acct_Agency_Tax_Codes` rows are created by the trigger automatically — do not insert them yourself.

## 1. Where the INSERT comes from

✅ Confirmed via catalog scan: there is no `SP_AddAgency`, `SP_AcctAgencyAdd`, `SP_ARAcctAdd`, or any equivalent. The only `*Agency*Add*` procs in the catalog are POS-side:

- `SP_POS_ARCustomer_AddAgency` — links an existing customer to an existing agency at the till. Not a master-record creator.
- `SP_POS_TCSPOS_ADDAGENCY` — Touchscreen-POS variant. Same purpose.

The matching `*Agency*Copy*` and `*Agency*Delete*` procs DO exist (`SP_AcctAgencyCopyDCC`, `SP_AcctAgencyCopyNonMerch`, `SP_AcctAgencyDelete`) — typical of MFC-CRecordView form behaviour where Add is built-in to the framework but Copy/Delete need explicit procs.

🔍 By process of elimination: WPAdmin's _Add Account_ form fires an MFC-generated `INSERT INTO Acct_Agency` directly. The exact column list is determined at runtime by the form's `DoFieldExchange` bindings. Static analysis cannot see this; plan-cache recovery would catch it but only after the form fires (we have not seen one in the cache window — agency creation is rare and Pierce hasn't created one in the last few days).

## 2. The `Acct_Agency` schema — 55 columns, recovered live

The complete column list, recovered via `sys.columns` + `sys.types` + `sys.default_constraints`. **No DB-level defaults** are defined for any column; everything must be supplied at INSERT time, with NULL allowed where indicated.

### Required (NOT NULL, no default — must be supplied)

| Column | Type | Likely binding |
|---|---|---|
| `AgencyTypeID` | `int` | FK → `Acct_Agency_Type` (typical Pierce values: 1 = Department, 5 = Gift Cert holder) |
| `HalfReceiptTemplateID` | `int` | Receipt template — half-page format |
| `FullReceiptTemplateID` | `int` | Receipt template — full-page format |
| `NonMerchOptID` | `int` | FK → `Acct_Agency_Non_Merch_Opt`. Controls non-merchandise fee handling |
| `fPrintBalance` | `tinyint` | Whether to print running balance on receipts |
| `fDispCustCmnt` | `tinyint` | Display customer comment? |
| `fPrtCustCmnt` | `tinyint` | Print customer comment? |
| `PrtStartExpDate` | `tinyint` | Print account start/expiry date on receipts? |
| `TextbookValidation` | `int` | Textbook validation level (0 = none) |
| `ValidateTextbooksOnly` | `tinyint` | Restrict purchases to textbooks only? |

### Identity / human ID

| Column | Type | Notes |
|---|---|---|
| `AgencyID` | `int IDENTITY` | Auto-allocated. Use `SCOPE_IDENTITY()` after the INSERT. |
| `AgencyNumber` | `char(26)` | Human-readable code — e.g. `PSP 26 ANTHRO`. Nullable in schema but should always be set. |

### Optional (nullable) — typically populated by the WPAdmin form

| Column | Type | Notes |
|---|---|---|
| `Name` | `varchar(80)` | Agency display name |
| `Contact` | `varchar(80)` | Contact person |
| `Address`, `City`, `State`, `Country`, `PostalCode` | varchar | Address |
| `Phone1`, `Phone2`, `Phone3`, `Ext1`, `Ext2`, `Ext3` | varchar | Phones with extensions |
| `FedTaxNumber` | `char(15)` | Federal tax ID |
| `txComment` | `varchar(255)` | Free-form comment |
| `AgencyBillingID` | `int` | Optional link to a separate billing entity |
| `MaxDays` | `int` | Aging threshold |
| `Priority` | `int` | Display priority for tender selection |
| `StatementCodeID` | `int` | FK → `Acct_Statement_Codes` |
| `AcctTermID` | `int` | FK → `Acct_Terms_Header` |
| `DiscountCodeID` | `int` | FK → `Discount_Codes` |
| `ChangeLimit`, `CreditLimit`, `MimimumCharge` | `money` | (note typo: `MimimumCharge` is the actual column name in the schema) |
| `FinanceRate` | `decimal(7,4)` | APR for finance charges |
| `TenderCode`, `DiscountType`, `PrintInvoice` | `int` | Behaviour flags (treated as enums) |

### Behaviour flags (nullable `tinyint`)

`fTaxExempt`, `fBalanceType`, `fBilling`, `fSetCredLimit`, `fStatus`, `fDebit`, `fFinanceType`, `fFinanceCharge`, `fPageBreak`, `fPermitChgDue`, `fOpenDrawer`, `fRefRequired`, `fAccessibleOnline`, `fAllowLimitChg`, `fInvoiceInAR`

`fInvoiceInAR` is the one that controls whether the agency's transactions become AR invoices via the receipt-promotion flow (see [`generate-invoices.md`](generate-invoices.md)). Setting this to `1` is what makes an agency billable.

### Foreign keys (out)

```
Acct_Agency.AgencyTypeID    → Acct_Agency_Type.AgencyTypeID
Acct_Agency.StatementCodeID → Acct_Statement_Codes.StatementCodeID
Acct_Agency.AcctTermID      → Acct_Terms_Header.AcctTermID
```

### Foreign keys (in)

Six tables hold a reference back to `Acct_Agency.AgencyID`:

```
Acct_Adjust_Header
Acct_Agency_Customer
Acct_Agency_DCC
Acct_Agency_Tax_Codes
Rental_History
Rental_Setup_Pos       (NBCPAgencyID column)
```

Note the absence of `Acct_Agency_NonMerch` from this list — that table has `AgencyID NOT NULL` but no FK constraint, presumably an oversight in the original schema design.

## 3. Triggers — automatic side effects on INSERT

Three triggers fire on `Acct_Agency`:

| Trigger | Event | Recovered? |
|---|---|---|
| `TI_Acct_Agency` | INSERT only | ✅ Body recovered ([`../proc-bodies/TI_Acct_Agency.sql`](../proc-bodies/TI_Acct_Agency.sql)) |
| `TUI_Acct_Agency` | UPDATE + INSERT | 🔍 Partially recovered (4 of N statements) ([`../proc-bodies/TUI_Acct_Agency.sql`](../proc-bodies/TUI_Acct_Agency.sql)) |
| `TD_Acct_Agency` | DELETE | ❓ Not in cache |

### `TI_Acct_Agency` — auto-populates tax codes

```sql
INSERT Acct_Agency_Tax_Codes (AgencyID, TaxCodeID)
SELECT i.AgencyID, t.TaxCodeID
FROM inserted i INNER JOIN Tax_Codes t ON 1=1
```

Every new agency gets one `Acct_Agency_Tax_Codes` row per row in the master `Tax_Codes` table — a Cartesian product. The default `fExempt` is presumably `0` (the column is `NOT NULL` but has no default constraint, so it must be defined elsewhere — possibly via the `Acct_Agency_Tax_Codes` table's own column-level default which the schema query didn't surface, or it inherits NULL and the column is actually nullable in practice).

**Implication for laportal**: do not insert `Acct_Agency_Tax_Codes` rows yourself when creating an agency — the trigger handles it. If you need tax-exempt status on specific codes, UPDATE those rows after the trigger fires.

### `TUI_Acct_Agency` — textbook-validation housekeeping (partial)

```sql
DECLARE curAgency CURSOR FOR
    SELECT AgencyID, AgencyNumber, TextbookValidation FROM inserted;

FETCH curAgency INTO @agency_id, @agency_num, @textbookValidation;

IF @textbookValidation > 0 AND EXISTS (
    SELECT * FROM deleted WHERE AgencyID = @agency_id AND TextbookValidation = 0
) ...
```

The trigger detects the transition from "no textbook validation" to "validation enabled" and presumably runs a one-time setup. The remaining branches were not in the cache slice. Re-probe after exercising agency edits to fill the gaps.

## 4. Required secondary tables (after the agency exists)

These are NOT auto-populated by triggers; the WPAdmin form / external creator must handle them.

### `Acct_Agency_Customer` — customer linkage

29 columns. At minimum the AgencyID + CustomerID + StartDate + ExpDate + initial balance/limit fields. This is the "who can charge to this agency" mapping.

Key columns: `AgencyCustID` (IDENTITY), `AgencyID` (FK), `CustomerID` (FK), `BillingRefID`, `StartDate`, `ExpDate`, `PayDate`, `IssueDate`, `LastTranDate`, `LastInvDate`, `PayAmount`, `CurrBalance`, `CreditLimit`, `TotalBalance`, `FinanceRate`, `Over30`/`60`/`90`/`120`, `fBalanceType`, `fStatus`, `fSetCredLimit`, `StatementCodeID`, `AcctTermID`, `PIN`, `StandingPO`.

Updates to credit limit and dates flow through `SP_ARAcctCustParam(@AgencyID, @CustomerID, @MemAcctID, @CreditLimit, @bSetLimit, @fStatus, @fBalanceType, @PIN, @AcctTermID, @StandingPO, @StatementCodeID, @StartDate, @ExpDate, @IssueDate)` — recovered separately, plan-cache visible.

### `Acct_Agency_DCC` — DCC permissions

5 columns: `AgencyDCCID` (IDENTITY), `AgencyID` (FK), `DCCID` (FK to `DeptClassCat`), `DCCMask`, `Discount`. Controls which DCCs are charge-eligible for this agency, with optional discount overrides.

The `SP_AcctAgencyCopyDCC` proc copies these from a template agency. `SP_ARAgencyDCCRemoveAll(@AgencyID)` clears them (visible in `WA_AR.dll.strings.txt:4163`). Per-DCC discount editing is `SP_ARAgencyUpdateDCCDiscount`.

### `Acct_Agency_NonMerch` — non-merch fee descriptions

4 columns: `AcctAgncyNMrchID` (IDENTITY), `AgencyID` (NOT NULL — but no FK constraint), `fG3` (`tinyint NOT NULL`), `FeeCodeDescr` (`char(50) NOT NULL`).

This is the one with verbatim INSERTs from `WA_AR.dll`:

```sql
INSERT INTO Acct_Agency_NonMerch (AgencyID, fG3, FeeCodeDescr) VALUES (%ld, 0, '%3d')
INSERT INTO Acct_Agency_NonMerch (AgencyID, fG3, FeeCodeDescr) VALUES (%ld, 1, '%s')
```

— `WA_AR.dll.sql.txt:20-21`. Two variants: `fG3 = 0` for "global" (one row keyed by a 3-char code) and `fG3 = 1` for "agency-specific" (per-agency description).

### `Acct_Agency_Tax_Codes` — tax-code overrides

Auto-populated by the `TI_Acct_Agency` trigger. Shape: `AATC_ID` (IDENTITY), `AgencyID`, `TaxCodeID`, `fExempt`, `ExemptNumber`. To set tax-exempt status, UPDATE these rows after the trigger fires:

```sql
UPDATE Acct_Agency_Tax_Codes
SET fExempt = 1, ExemptNumber = 'EXMP-12345'
WHERE AgencyID = @new_agency_id AND TaxCodeID = @specific_tax_code;
```

## 5. Workflow reconstruction (most likely)

🔍 Combining the available evidence:

1. **User opens WPAdmin → AR → Account Maintenance, clicks New** → MFC form (`CARAcctMntHeaderView` or similar — the exact class name not yet captured) presents a blank `Acct_Agency` form.
2. **User fills in fields**: AgencyNumber (e.g. `PSP 26 ANTHRO`), Name, AgencyTypeID, address, behaviour flags, credit/finance fields. Form has UI-level defaults for most flag columns.
3. **User clicks Save** → MFC fires the generated `INSERT INTO Acct_Agency` with all the form-bound columns.
4. **Server-side**: `TI_Acct_Agency` fires, populating `Acct_Agency_Tax_Codes` with one row per tax code (Cartesian). `TUI_Acct_Agency` also fires (it's UPDATE+INSERT) and runs the textbook-validation initialization branch if applicable.
5. **User adds customer linkages** → form transitions to a sub-grid; per-row INSERTs into `Acct_Agency_Customer`.
6. **User configures DCC permissions** → either copies from a template via `SP_AcctAgencyCopyDCC` or directly INSERTs/UPDATEs `Acct_Agency_DCC`.
7. **User sets non-merch fee handling** → INSERTs into `Acct_Agency_NonMerch` (literal SQL visible in `WA_AR.dll`).
8. **POS sync** → `SP_ARAcctResendToPos(@AgencyID)` pushes the new agency to all register-local POS databases. The proc body recovered ([`../proc-bodies/`](../proc-bodies/) — see `plan_cache_in_agency_procs` results) shows it deletes existing `pos_update` rows for the agency and re-queues them.

Steps 1, 5, 6, 7, 8 use mechanisms with recovered or partially-recovered SQL. Steps 2, 3 are MFC-generated and not yet captured (no recent agency creation in the plan cache window).

## 6. Closing the gap without a literal capture (2026-04-25 update)

The plan-cache approach to capturing the literal MFC-generated INSERT requires someone to drive WPAdmin from a desktop, which Marcos is not always positioned to do. A 7-day plan-cache scan with strict filtering (`probe-prism-recent-agency-writes.ts`) returned **zero** cached agency INSERTs across the entire district — the cache had churned past every recent agency-create from the last week. The MFC INSERT shape stays empirical until someone clicks _New Agency_.

**Alternative path — value-sampling.** Instead of waiting on a literal capture, we sampled **1,072 Pierce-prefixed agencies** (`AgencyNumber LIKE 'P%'`) and computed the per-column fill rate, distinct value count, and modal values. The output gives us a high-confidence **Pierce-default INSERT template** — it tells us what Pierce *actually* puts in each column, regardless of what value WPAdmin's form ships in its UI defaults. For a laportal mirror, that's actually a better contract than the literal MFC INSERT (which would tell us only what the form sends, not what Pierce conventions are).

Probe: [`scripts/probe-prism-agency-value-distribution.ts`](../../../../scripts/probe-prism-agency-value-distribution.ts). 1,072 agencies × 55 columns × 4 metrics = comprehensive.

### Pierce-default values per column (n=1,072)

| Column | Type | Always | Notes |
|---|---|---|---|
| `MaxDays` | int | **`30`** | 100% of agencies — 30-day terms |
| `StatementCodeID` | int | **`6`** (98%) | Pierce statement code; `4` (12 agencies), `2` (5) are exceptions |
| `DiscountCodeID` | int | **`0`** (99.9%) | |
| `ChangeLimit` | money | **`0`** (100%) | |
| `MimimumCharge` | money | **`0`** (99.9%) | |
| `FinanceRate` | decimal | **`0`** (100%) | |
| `AgencyTypeID` | int | **`4`** (62%), `2` (34%), `6` (3%) | 4 = external entity, 2 = internal department |
| `fTaxExempt` | tinyint | **`0`** (99.6%) | |
| `fBalanceType` | tinyint | **`1`** (100%) | |
| `fBilling` | tinyint | **`1`** (98.8%) | |
| `fSetCredLimit` | tinyint | **`0`** (91.7%) | `1` for the 89 agencies that override credit limit |
| `fStatus` | tinyint | **`0`** (99.4%) | |
| `fDebit` | tinyint | **`0`** (99.3%) | |
| `fFinanceType` | tinyint | **`0`** (100%) | |
| `fFinanceCharge` | tinyint | **`0`** (99.9%) | |
| `fPageBreak` | tinyint | **`0`** (99.8%) | |
| `TenderCode` | int | **`12`** (92.9%) | Pierce's billing tender code; `49` (5%), `77` (<1%) are alternates |
| `DiscountType` | int | **`0`** (100%) | |
| `PrintInvoice` | int | **`0`** (99.9%) | |
| `fPermitChgDue` | tinyint | **`0`** (100%) | |
| `fOpenDrawer` | tinyint | **`0`** (99.9%) | |
| `fRefRequired` | tinyint | **`0`** (99.4%) | |
| `fAccessibleOnline` | tinyint | **`0`** (93.7%) | `1` for 67 agencies that get web access |
| `fAllowLimitChg` | tinyint | **`0`** (98.8%) | |
| `HalfReceiptTemplateID` | int | **`0`** (97.8%) | `31` for the 24 agencies with a half-receipt template |
| `FullReceiptTemplateID` | int | **`0`** (100%) | |
| `fInvoiceInAR` | tinyint | **`1`** (91.2%) | The flag that enables AR-invoice promotion |
| `NonMerchOptID` | int | **`2`** (98.4%) | `3` (1.4%), `1` (0.2%) are exceptions |
| `fPrintBalance` | tinyint | **`0`** (83.4%) | `1` for 178 agencies that get balance on receipt |
| `fDispCustCmnt` | tinyint | **`0`** (99.6%) | |
| `fPrtCustCmnt` | tinyint | **`0`** (99.6%) | |
| `PrtStartExpDate` | tinyint | **`0`** (92.6%) | `1` for 79 time-bound agencies |
| `TextbookValidation` | int | **`0`** (100%) | |
| `ValidateTextbooksOnly` | tinyint | **`0`** (100%) | |

### Pierce-style INSERT template (synthesized)

Drop-in starting point for a laportal `createAgency` service. Caller supplies the highlighted variables; everything else uses the Pierce-default value derived above.

```sql
INSERT INTO Acct_Agency (
    -- caller-supplied (the unique identity + display + classification)
    AgencyNumber, Name, AgencyTypeID,
    -- caller-supplied optional address fields (nullable; populate when external entity)
    Contact, Address, City, State, PostalCode, Phone1,
    -- caller-supplied financial overrides (default 0; populate to grant credit)
    CreditLimit, fSetCredLimit,
    -- caller-supplied behaviour overrides (default 0; populate to enable web / receipt-balance / time-bound)
    fAccessibleOnline, fPrintBalance, PrtStartExpDate, HalfReceiptTemplateID,
    -- Pierce-default values
    MaxDays, StatementCodeID, DiscountCodeID, ChangeLimit, MimimumCharge, FinanceRate,
    fTaxExempt, fBalanceType, fBilling, fStatus, fDebit, fFinanceType, fFinanceCharge,
    fPageBreak, TenderCode, DiscountType, PrintInvoice, fPermitChgDue, fOpenDrawer,
    fRefRequired, fAllowLimitChg, FullReceiptTemplateID, fInvoiceInAR, NonMerchOptID,
    fDispCustCmnt, fPrtCustCmnt, TextbookValidation, ValidateTextbooksOnly
)
VALUES (
    @AgencyNumber, @Name, @AgencyTypeID,
    @Contact, @Address, @City, @State, @PostalCode, @Phone1,
    ISNULL(@CreditLimit, 0), CASE WHEN ISNULL(@CreditLimit, 0) > 0 THEN 1 ELSE 0 END,
    ISNULL(@fAccessibleOnline, 0), ISNULL(@fPrintBalance, 0), ISNULL(@PrtStartExpDate, 0), ISNULL(@HalfReceiptTemplateID, 0),
    -- Pierce defaults
    30, 6, 0, 0, 0, 0,
    0, 1, 1, 0, 0, 0, 0,
    0, 12, 0, 0, 0, 0,
    0, 0, 0, 1, 2,
    0, 0, 0, 0
);

DECLARE @new_agency_id int = SCOPE_IDENTITY();
-- TI_Acct_Agency trigger fires here automatically and populates Acct_Agency_Tax_Codes
-- (one row per Tax_Codes entry, Cartesian product). Do not insert those rows yourself.

-- After the agency row exists:
--   Acct_Agency_Customer linkage rows: caller's responsibility
--   Acct_Agency_DCC perms: caller's responsibility (or use SP_AcctAgencyCopyDCC <new>, <template>)
--   Acct_Agency_NonMerch fees: caller's responsibility (or use SP_AcctAgencyCopyNonMerch <new>, <template>)
--   POS sync: EXEC SP_ARAcctResendToPos @new_agency_id  -- pushes to register-local DBs
```

This is the contract laportal can mirror **today** without any further reverse-engineering. The remaining unknowns (literal MFC INSERT shape, full TUI/TD trigger bodies) don't block it — they only matter if we want bit-perfect parity with WPAdmin's UI, which we don't.

### What's still ❓ (low priority)

- ~~Literal MFC `INSERT INTO Acct_Agency` from WPAdmin~~ — **CLOSED 2026-04-25 via binary recovery.** The column list is in `WPData.dll` at offset `0x32988` (53 columns + paramAgencyID). See [`agency-binary-findings.md`](agency-binary-findings.md). The literal INSERT itself is composed at runtime by MFC's CRecordset from this column list — the **column contract is now verified** without needing a plan-cache capture.
- `TUI_Acct_Agency` cursor body (partial recovery only — cursor preludes captured, loop body evicted).
- `TD_Acct_Agency` (delete trigger) — not in cache because no recent agency deletes. Closes when WPAdmin deletes one.
- ~~`SP_ARAcctResendToPos` body~~ — **CLOSED 2026-04-25 via plan-cache.** Body recovered; see [`../proc-bodies/SP_ARAcctResendToPos.sql`](../proc-bodies/SP_ARAcctResendToPos.sql). Writes type-6 (Agency) rows to `pos_update` for every Location. For a fresh clone with no customer linkages yet, only type-6 entries are emitted — minimal POS sync as expected.

None of these block laportal mirroring.

## 7. Implications for laportal

If laportal needs to create agencies (for example, to streamline the "set up a new department billing account" workflow that currently requires a CopyTech admin to walk through WPAdmin):

- **The full column contract is known from live schema** — no reverse-engineering blockers.
- **The 11 NOT-NULL-no-default columns are the core required set.** Pick reasonable Pierce-aligned defaults (sample existing Pierce agencies to derive them).
- **The `TI_Acct_Agency` trigger handles `Acct_Agency_Tax_Codes` automatically** — do not duplicate this insert.
- **Companion procs `SP_AcctAgencyCopyDCC` and `SP_AcctAgencyCopyNonMerch` are available** for cloning DCC and non-merch settings from a template agency — recommended for ease of use.
- **`SP_ARAcctResendToPos` must be called after creation** to propagate the new agency to register-local POS DBs. Otherwise the agency exists in PRISM but cannot be tendered against at the till.

The path is straightforward; the only remaining step before writing it is one snapshot/diff or one test-agency probe to lock in the INSERT contract verbatim.
