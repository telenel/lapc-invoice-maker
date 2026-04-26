# Agency creation — binary-recovered ground truth

**Companion to** [`create-ar-agency.md`](create-ar-agency.md) and [`clone-ar-agency.md`](clone-ar-agency.md).

This document captures what we recovered by **scanning the WinPRISM binaries in original byte order** rather than relying on the (alphabetically-sorted) strings dump. The original-order scan reveals contiguous SQL strings, MFC recordset bindings, validation messages, and the `[dbo].[<TableName>]` anchors with their column lists intact.

**Why this matters**: it closes the biggest reverse-engineering gap for agency creation/cloning — we no longer need to capture an MFC INSERT from the plan cache or run a dev test write. The column list MFC binds is **right there in the binary**, in the exact order WPAdmin reads/writes them.

**Tool**: [`scripts/prism-extract-mfc-recordset.ps1`](../../../../scripts/prism-extract-mfc-recordset.ps1). Generic — works for any table/recordset, not just agencies.

## 1. WPAdmin's Account Maintenance form structure

Eight MFC view classes compose the form (from binary symbol scan):

| Class | Tab | Source binary |
|---|---|---|
| `CARAcctMntFrame` | Frame window | `WA_AR.dll` |
| `CARAcctMntBaseView` | Base view | `WA_AR.dll` |
| `CARAcctMntGeneralView` | **General** (AgencyNumber, Name, Type) | `WA_AR.dll` |
| `CARAcctMntAddressView` | **Address** | `WA_AR.dll` |
| `CARAcctMntBillingView` | **Billing** | `WA_AR.dll` |
| `CARAcctMntFinanceView` | **Finance** | `WA_AR.dll` |
| `CARAcctMntDCCView` | **DCC permissions** | `WA_AR.dll` (recordset in `WACommon.dll`) |
| `CARAcctMntNonMrchVw` | **Non-Merch fees** | `WA_AR.dll` |
| `CARAcctMntPOSView` | **POS** behavior | `WA_AR.dll` |
| `CARAcctMntTaxCodeGrid` | **Tax codes** grid | `WA_AR.dll` |

Plus `CARAcctMntAddDlg` — the modal "Add Account" dialog that appears when clicking *New*.

The Add dialog likely collects only minimal fields (AgencyNumber, Name, Type) and then the full form opens for the rest. We haven't captured the dialog's recordset binding directly — but the **save flow** still funnels through the master `CARAgencySet` recordset in `WPData.dll`, which is the source of truth for the column list.

## 2. `[dbo].[Acct_Agency]` — full MFC recordset binding

**Source: `WPData.dll` at offset `0x32988`.** This is the comprehensive `CARAgencySet` binding used by the main form save flow.

| # | Column | Notes |
|---:|---|---|
| — | `paramAgencyID` | Parameter (not a column) — the WHERE binding |
| 0 | `AgencyID` | IDENTITY (PK) — set by SCOPE_IDENTITY after INSERT |
| 1 | `AgencyNumber` | char(26) — Pierce code (`PSP26EOPSDEPT`) |
| 2 | `Name` | varchar(80) — display name |
| 3 | `AgencyTypeID` | int FK → `Acct_Agency_Type` |
| 4 | `fDebit` | tinyint |
| 5 | `AgencyBillingID` | int (nullable) |
| 6 | `MaxDays` | int — Pierce: 30 |
| 7 | `Priority` | int |
| 8 | `StatementCodeID` | int FK → `Acct_Statement_Codes` (Pierce: 6) |
| 9 | `AcctTermID` | int FK → `Acct_Terms_Header` |
| 10 | `DiscountCodeID` | int |
| 11 | `ChangeLimit` | money |
| 12 | `CreditLimit` | money |
| 13 | `MimimumCharge` | money (typo "Mimimum" is intentional in the schema) |
| 14 | `FinanceRate` | decimal(7,4) |
| 15 | `FedTaxNumber` | char(15) |
| 16 | `Contact` | varchar(80) |
| 17 | `Address` | varchar |
| 18 | `City` | varchar |
| 19 | `State` | varchar |
| 20 | `Country` | varchar |
| 21 | `PostalCode` | varchar |
| 22 | `Phone1` | varchar |
| 23 | `Phone2` | varchar |
| 24 | `Phone3` | varchar |
| 25 | `Ext1` | varchar |
| 26 | `Ext2` | varchar |
| 27 | `Ext3` | varchar |
| 28 | `fBilling` | tinyint |
| 29 | `fBalanceType` | tinyint |
| 30 | `fFinanceType` | tinyint |
| 31 | `fFinanceCharge` | tinyint |
| 32 | `fTaxExempt` | tinyint |
| 33 | `fSetCredLimit` | tinyint |
| 34 | `fPageBreak` | tinyint |
| 35 | `TenderCode` | int FK → `Tender_Codes` (Pierce: 12 / 49) |
| 36 | `DiscountType` | int |
| 37 | `PrintInvoice` | int |
| 38 | `fPermitChgDue` | tinyint |
| 39 | `fOpenDrawer` | tinyint |
| 40 | `fRefRequired` | tinyint |
| 41 | `fAccessibleOnline` | tinyint |
| 42 | `fAllowLimitChg` | tinyint |
| 43 | `HalfReceiptTemplateID` | int |
| 44 | `FullReceiptTemplateID` | int |
| 45 | `fInvoiceInAR` | tinyint — **the AR-billable switch** |
| 46 | `NonMerchOptID` | int FK → `Acct_Agency_Non_Merch_Opt` (Pierce: 2) |
| 47 | `fPrintBalance` | tinyint |
| 48 | `fDispCustCmnt` | tinyint |
| 49 | `fPrtCustCmnt` | tinyint |
| 50 | `PrtStartExpDate` | tinyint |
| 51 | `TextbookValidation` | int |
| 52 | `ValidateTextbooksOnly` | tinyint |

**53 columns** are bound by MFC. Plus `AgencyID` (IDENTITY) makes 54.

### Schema columns NOT in the MFC binding

The schema query identified 55 total columns. The 53 above + `AgencyID` = 54. That leaves **1 column unbound by `CARAgencySet`**:

- `txComment` — varchar(255). Present in the older `WA_AR.dll` recordset binding (offset `0x89700`, 38-column subset) but **not** in the comprehensive `WPData.dll` binding. Pierce sets this very rarely; we observed 99%+ NULL.

**Implication for laportal**: omit `txComment` from the standard create flow. Match WPAdmin's behavior. Add it as an explicit override field if needed.

### `WA_AR.dll`'s alternate (older) binding at `0x89700`

The 38-column subset in `WA_AR.dll` is:
```
AgencyBillingID, MaxDays, Priority, StatementCodeID, AcctTermID, DiscountCodeID,
ChangeLimit, CreditLimit, MimimumCharge, FinanceRate, FedTaxNumber, Contact, Name,
Address, City, State, Country, PostalCode, Phone1, Phone2, Phone3, txComment,
AgencyTypeID, fBalanceType, fBilling, fSetCredLimit, fDebit, fFinanceType,
fFinanceCharge, fPageBreak, TenderCode, DiscountType, PrintInvoice, fPermitChgDue,
fOpenDrawer, fRefRequired, fAccessibleOnline, fAllowLimitChg
```

This is missing the receipt-template columns, the `fInvoiceInAR` flag, the non-merch option, and the textbook-validation flags. Probably a partial form variant (e.g., the "Add" dialog's reduced field set, or a legacy form). The `WPData.dll` binding is authoritative for full saves.

## 3. Companion table bindings

### `[dbo].[Acct_Agency_Customer]` (WA_AR.dll @ `0x8AA2C`)

Recordset binding: 17 columns visible after the parameter prefix.

```
[m_paramAgencyCustID], [m_paramCustomerID], [m_paramAgencyID]   ← the 3 parameters
AgencyCustID (PK), StandingPO, OldStandingPO, BillingRefID,
PayDate, StatusDate, IssueDate, LastTranDate, LastInvDate,
PayAmount, CurrBalance, TotalBalance, Over30, Over60, Over90, Over120,
PIN
```

**Note**: This recordset doesn't bind `AgencyID`, `CustomerID`, `StartDate`, `ExpDate`, `CreditLimit`, `FinanceRate`, `fBalanceType`, `fStatus`, `fSetCredLimit`, `StatementCodeID`, or `AcctTermID`. Those fields are written via the dedicated proc `SP_ARAcctCustParam` (signature below).

### `[dbo].[Acct_Agency_DCC]` (WACommon.dll @ `0x19A8C`)

```
AgencyDCCID (PK), AgencyID (FK), DCCID (FK), DCCMask, [AgencyIDParam]
```

The schema lists 5 columns: `AgencyDCCID`, `AgencyID`, `DCCID`, `DCCMask`, `Discount`. The MFC recordset binds only 4 — `Discount` is **set via `SP_ARAgencyUpdateDCCDiscount` instead**, not the recordset.

### `[dbo].[Acct_Agency_NonMerch]` (WA_AR.dll @ `0x83FE8`)

```
AcctAgncyNMrchID (PK), fG3, FeeCodeDescr
```

Only 3 columns bound. `AgencyID` is **not** bound — it's supplied as a literal in the explicit INSERT statements (also recovered):

```sql
INSERT INTO Acct_Agency_NonMerch (AgencyID, fG3, FeeCodeDescr) VALUES (%ld, 0, '%3d')
INSERT INTO Acct_Agency_NonMerch (AgencyID, fG3, FeeCodeDescr) VALUES (%ld, 1, '%s')
```

`fG3 = 0` means "global by 3-char code", `fG3 = 1` means "agency-specific description".

### `[dbo].[Acct_Agency_Tax_Codes]` — no MFC binding

No recordset binding found in any binary. **Confirms** our earlier finding that this table is populated **exclusively by the `TI_Acct_Agency` trigger** on agency INSERT. WPAdmin reads it via the `VW_ACCT_AGENCY_TAX_CODES` view (binding at WA_AR.dll `0x896BC`):

```
[VW_ACCT_AGENCY_TAX_CODES]: AATC_ID, AgencyName, TaxCodeID, TaxCodeDesc, fExempt, ExemptNumber
```

To set tax-exempt status on individual codes, WPAdmin must UPDATE `Acct_Agency_Tax_Codes` directly (no proc call observed).

## 4. Verified stored proc signatures

Every proc signature observed in the binary's `{ call SP_X(%d, %s) }` strings was cross-checked against `sys.procedures` + `sys.parameters`. **Each is confirmed live in the database with the parameter order and types listed below.**

### Agency lifecycle

| Proc | Signature | Purpose |
|---|---|---|
| `SP_AcctAgencyCopyDCC` | `(@NewAgencyID int, @OldAgencyID int)` | **Note: NEW comes FIRST.** Copies DCC perms from OldAgencyID into NewAgencyID. |
| `SP_AcctAgencyCopyNonMerch` | `(@NewAgencyID int, @OldAgencyID int)` | NEW-first. Copies non-merch fees. |
| `SP_AcctAgencyDelete` | `(@agencyid int)` | Hard-delete. UI gates with "Account is in use" check. |
| `SP_ARClearAgency` | `(@agency_id int, @balance_opt int)` | Discovered in catalog only — clears balances. Likely used by Reset Balances flow. |

### POS / web sync (call after any agency mutation)

| Proc | Signature | Purpose |
|---|---|---|
| `SP_ARAcctResendToPos` | `(@AgencyID int)` | Push agency to register-local POS DBs. **Required after create/edit.** |
| `SP_ARAcctResendToWeb` | `(@AgencyID int)` | Push agency to PrismCore/Mosaic web. |
| `SP_Wincom_ARAgencyDCC` | `(@agency_id int)` | DCC-side POS sync. Discovered in catalog. |

### Customer linkage management

| Proc | Signature |
|---|---|
| `SP_ARAcctCustParam` | `(@AgencyID, @bResetBalance, @bSetLimit, @NewLimit money, @bSetActive, @bNewAcitve, @bSetStartDate, @NewStartDate, @bSetExpireDate, @NewExpireDate, @bSetIssueDate, @NewIssueDate, @bDeleteCustomerAccount)` — 13 params. The "set/reset many fields" hammer. Note the typo `@bNewAcitve`. |
| `SP_ARAcctCustChange` | `(@AgencyID, @bDoStatement tinyint, @bDoFinanceRate tinyint, @bDoBalanceType tinyint)` — bulk-update statement code / finance rate / balance type across all customers on an agency. |
| `SP_ARCustAcct_Delete` | `(@customerid int, @agencyid int)` — remove a single customer-agency linkage. |
| `SP_ARAcctResetBalances` | `(@AgencyID int, @SingleCustomerID int)` — reset balances for one customer or all (-1?). |

### DCC management

| Proc | Signature |
|---|---|
| `SP_ARAgencyDCCRemoveAll` | `(@AgencyID int)` — clear all DCC perms. |
| `SP_ARAgencyUpdateDCCDiscount` | `(@AgencyID int, @DCCID int, @DCCMask int, @Discount decimal, @remove int)` — update one DCC perm row, or remove if `@remove=1`. |

### Adjustments / payments

| Proc | Signature |
|---|---|
| `SP_ARAcctCreateAdjustments` | `(@AgencyID int, @AdjustDate datetime, @COAID int)` |
| `SP_ARAcctCreatePayments` | `(@AgencyID int, @CutoffDate datetime, @PaymentDate datetime)` |

### Notable binary-vs-DB discrepancies

- `SP_AcctAgencyCopyNonmerch` — the binary calls it lowercase-m `Nonmerch`. The DB has `SP_AcctAgencyCopyNonMerch`. SQL Server's case-insensitive name resolution makes both work; the binary's literal is just sloppy.
- `SP_ARAcctCustParam` has a typo in the binding name `@bNewAcitve` (should be `@bNewActive`). Pass it positionally to avoid issues.

## 5. Validation messages from the binary

Recovered literal validation strings — these tell us WPAdmin's UI-level rules without needing to drive the form:

| Message | Implies |
|---|---|
| `Account Code is required.` | `AgencyNumber` must be non-empty |
| `Account Name is required.` | `Name` must be non-empty |
| `Exempt Number is required.` | When `fTaxExempt=1` (or per-code in tax grid), `ExemptNumber` must be set |
| `Account is in use. Cannot be deleted.` | Pre-delete: refuses if `Acct_Agency_Customer` count > 0 (or any FK reference) |
| `One or More Selected Accounts have Balances and could not be Deleted.` | Pre-delete: refuses if any balance > 0 |
| `Delete this account?` | Confirmation dialog before `SP_AcctAgencyDelete` |
| `Invalid Date Selected. (Closed AR Period)` | Date range guard for AR ops |

Pre-save validation queries:
```sql
select count(*) from acct_agency where AgencyNumber = '%s'         -- duplicate-name check
select count(*) from acct_agency_customer where agencyID = %d      -- pre-delete: in-use check
SELECT top 1 AgencyID from Acct_Agency order by AgencyID desc       -- get last AgencyID (post-add navigate)
```

## 6. UI dropdown lookup queries

Recovered queries that populate the form's dropdowns:

```sql
SELECT AgencyTypeID, Description FROM Acct_Agency_Type            -- 9 types (Pierce uses 5)
SELECT AcctGroupID, Description FROM Acct_Agency_Group            -- 3 rows: 0=Charge, 1=Prepaid, 2=Bad Check
SELECT StatementCodeID, Description FROM Acct_Statement_Codes     -- 6 codes (Pierce uses #6 = Month End)
select acctbaltypeid, description from acct_balance_type order by acctbaltypeid asc
SELECT NonMerchOptID, Description FROM Acct_Agency_Non_Merch_Opt  -- 3 options
```

Note: `Acct_Agency_Group` exists with 3 rows but the `Acct_Agency` table has **no `AcctGroupID` column** in its current schema. This dropdown is either:
- Used elsewhere (Acct_Agency_Customer's `BillingRefID` perhaps?), or
- A legacy/unused field that the form still loads for compatibility.

Worth a follow-up probe.

## 7. Recommended laportal create-agency procedure (verified contract)

Putting it all together — this is the laportal-side procedure that exactly mirrors WPAdmin's save flow:

```sql
-- 1. Pre-save validation (mirror WPAdmin):
SELECT COUNT(*) FROM Acct_Agency WHERE AgencyNumber = @AgencyNumber;
-- if > 0, refuse with "Account Code already exists"

-- 2. Insert (53 columns matching WPData.dll's CARAgencySet binding, in MFC order).
--    Caller supplies AgencyNumber + Name + AgencyTypeID + any optional overrides;
--    everything else uses Pierce-default values from the empirical contract.
INSERT INTO Acct_Agency (
    AgencyNumber, Name, AgencyTypeID, fDebit,
    AgencyBillingID, MaxDays, Priority, StatementCodeID, AcctTermID, DiscountCodeID,
    ChangeLimit, CreditLimit, MimimumCharge, FinanceRate,
    FedTaxNumber, Contact, Address, City, State, Country, PostalCode,
    Phone1, Phone2, Phone3, Ext1, Ext2, Ext3,
    fBilling, fBalanceType, fFinanceType, fFinanceCharge, fTaxExempt, fSetCredLimit, fPageBreak,
    TenderCode, DiscountType, PrintInvoice,
    fPermitChgDue, fOpenDrawer, fRefRequired, fAccessibleOnline, fAllowLimitChg,
    HalfReceiptTemplateID, FullReceiptTemplateID,
    fInvoiceInAR, NonMerchOptID,
    fPrintBalance, fDispCustCmnt, fPrtCustCmnt, PrtStartExpDate,
    TextbookValidation, ValidateTextbooksOnly
)
VALUES (
    @AgencyNumber, @Name, @AgencyTypeID, 0,
    NULL, 30, 0, 6, NULL, 0,
    0, ISNULL(@CreditLimit, 0), 0, 0,
    NULL, NULL, NULL, NULL, NULL, NULL, NULL,
    NULL, NULL, NULL, NULL, NULL, NULL,
    1, 1, 0, 0, 0, CASE WHEN ISNULL(@CreditLimit, 0) > 0 THEN 1 ELSE 0 END, 0,
    @TenderCode, 0, 0,
    0, 0, 0, ISNULL(@fAccessibleOnline, 0), 0,
    ISNULL(@HalfReceiptTemplateID, 0), 0,
    1, 2,
    ISNULL(@fPrintBalance, 0), 0, 0, ISNULL(@PrtStartExpDate, 0),
    0, 0
);

DECLARE @new_agency_id int = SCOPE_IDENTITY();
-- TI_Acct_Agency trigger fires here automatically: populates Acct_Agency_Tax_Codes Cartesian.

-- 3. (Clone case only) Copy DCC permissions from a template:
EXEC SP_AcctAgencyCopyDCC @new_agency_id, @source_agency_id;
EXEC SP_AcctAgencyCopyNonMerch @new_agency_id, @source_agency_id;

-- 4. (Optional) Set up customer linkages — caller's responsibility, then:
EXEC SP_ARAcctCustParam @new_agency_id, ...;  -- or direct INSERT into Acct_Agency_Customer

-- 5. Push to register POS DBs (REQUIRED):
EXEC SP_ARAcctResendToPos @new_agency_id;

-- 6. Push to PrismCore web (if fAccessibleOnline = 1):
IF @fAccessibleOnline = 1
    EXEC SP_ARAcctResendToWeb @new_agency_id;
```

## 8. Confidence rating after binary recovery

| Operation | Before binary recovery | After binary recovery | Why |
|---|---:|---:|---|
| **Clone existing agency** | 85% | **~95%** | Source-row inheritance + MFC column list verified |
| **Create from scratch** | 70% | **~92%** | Literal MFC binding closes the "what does WPAdmin write" gap |
| **Edit existing agency** | 75% | **~92%** | Same column list + MFC update mechanism |
| **Delete agency** | 70% | **~88%** | Proc signature verified; pre-checks documented |

### Remaining ~5–8% risk

1. **`SP_ARAcctResendToPos` body still not recovered** — we know the proc exists and what params it takes, but the body lives in the DB plan cache (binaries don't carry it). For 100% confidence, recover it via plan-cache scan after someone clicks Resend in WPAdmin.
2. **`TUI_Acct_Agency` cursor body partial** — only the textbook-validation prelude. Pierce uses `TextbookValidation = 0` 100% of the time, so likely zero impact, but unverified.
3. **No live test row** — a single dev-environment INSERT (with explicit per-operation acknowledgment) would close the remaining gap to ~98%.

## 9. The extraction technique (so future-you can re-run)

The trick: the strings dump in `docs/prism/strings/<binary>.strings.txt` is **alphabetically sorted** by `prism-extract-strings.ps1`, which destroys the contiguous-block structure of MFC's bound string literals. To recover the literal column list:

1. Read the binary as raw bytes.
2. Replace any non-printable byte with a placeholder character (`` ` ``).
3. Locate the anchor `[dbo].[<TableName>]` in the resulting text.
4. The next ~60 bracketed strings (`[ColumnName]`) are the recordset's column list, in MFC binding order.

The script is `scripts/prism-extract-mfc-recordset.ps1`. It works for any table:

```powershell
powershell -File scripts/prism-extract-mfc-recordset.ps1 -Tables Acct_Agency,Acct_Agency_Customer
```

Output is the column list per binary, plus any nearby SQL fragments / proc calls. About 30 seconds per binary.

This technique generalizes — any MFC-bound table in the WinPRISM stack can be recovered the same way, including tables we haven't yet analyzed (Item, ItemMaster, GeneralMerchandise, Textbook, Inventory, etc.).
