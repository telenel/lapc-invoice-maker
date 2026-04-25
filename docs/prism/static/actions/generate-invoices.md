# Action: Generate AR (customer / department) invoices in WPAdmin

**Source binaries:** `WA_AR.dll` (primary), `WACommon.dll` (search/QS helpers), `WPUtility.dll` (framework methods, search proc declarations), `WinPrism.exe` (POS/mail-order tangent)
**Method:** Originally static-only. **Now ground-truthed via plan-cache recovery** of `SP_ARCreateInvoiceHdr`, `SP_ARCreateInvoiceDtl`, `SP_ARCreateMOTran`, and `SP_ARAutogenInvoices`. See [`../plan-cache-method.md`](../plan-cache-method.md) and [`../proc-bodies/`](../proc-bodies/).
**Confidence:** ✅ confirmed by recovered proc body · 🔵 confirmed by literal binary string · 🔍 inference · ❓ unknown.

> **Update 2026-04-24:** Plan-cache recovery rewrote significant parts of this analysis. Most importantly: **the "manual entry" path is NOT MFC-managed as I originally thought.** It goes through `SP_ARCreateInvoiceHdr` — a heavily-used proc (10,438 executions in 3 days at Pierce) that is also the receipt-to-invoice promotion path. The original static-only conclusions are preserved further down for methodology comparison; the corrected picture is below.

> Scope clarification: WPAdmin has **two unrelated invoice domains**. AP / vendor invoices live on tables `Invoice_Header` / `Invoice_Detail` / `Invoice_Location` (handled by `WA_AP.dll` and `WPInv.dll`). AR / customer invoices live on `Acct_ARInvoice_Header` / `Acct_ARInvoice_Detail` / `Acct_ARInvoice_Pymt` (handled by `WA_AR.dll`). This doc covers **AR — customer / department billing**, the path Pierce uses to charge departments for CopyTech jobs, special orders, and posted account activity.

## TL;DR (corrected)

Three distinct invoice-creation paths, all now confirmed by plan-cache recovery:

| Path | Entrypoint | Trigger | Frequency at Pierce |
|---|---|---|---|
| **A. Batch auto-generation** | `SP_ARAutogenInvoices(@autogenID, 0)` | WPAdmin "Generate Invoices" button | Periodic (42 cached executions over 2 days) |
| **B. Receipt promotion** (a.k.a. "manual entry" via WPAdmin AR form) | `SP_ARCreateInvoiceHdr` + `SP_ARCreateInvoiceDtl` | Per-receipt; fires every time a POS sale touches an AR account | **10,438 executions in 3 days** — this is the workhorse |
| **C. Mail-order/special-order receipt origination** | `SP_ARCreateMOTran` | WinPrism POS special-order flow | 5 cached executions |

**Path B is the most important one for laportal**, both because it's by far the most-used path and because it is the canonical "create one AR invoice from one receipt" entrypoint. Every Pierce POS sale paid (in whole or part) by a department's AR account fires this proc to materialize the corresponding `Acct_ARInvoice_Header`.

The full `Acct_ARInvoice_Header` `INSERT` contract — 22 columns — is recovered verbatim. So is the `Acct_ARInvoice_Tender` insert, the `Acct_ARInvoice_Detail` insert (via `SP_ARCreateInvoiceDtl`), and the `Transaction_Header.fInvoiced = 1` marker that prevents double-billing.

The original static-only conclusion that Path B was "MFC-managed and invisible to recovery" was wrong: WPAdmin's `CARInvoiceHeaderView::RecordAdd` evidently calls `SP_ARCreateInvoiceHdr` rather than letting MFC generate an `INSERT`. That correction is the single biggest finding in this doc.

## Recovered proc bodies — the source of truth

These are the literal `INSERT` statements that fire when each path runs, recovered statement-by-statement from the SQL Server plan cache. Full stitched bodies live at [`../proc-bodies/`](../proc-bodies/).

### Path B core: `SP_ARCreateInvoiceHdr` — the `Acct_ARInvoice_Header` insert

```sql
INSERT INTO Acct_ARInvoice_Header (
    UserID,
    CustomerID,
    AgencyID,
    LocationID,
    TransactionID,
    InvoiceNumber,
    InvoiceCodeID,    -- 1 = Receipt-sourced
    PostVoidID,
    Tax,
    TaxExemptTotal,
    fTaxExempt,
    fManualTax,
    CPODate,
    CPOAmount,
    RequestNumber,
    CreateDate,
    fStatus,          -- 1 = POSTED
    InvoiceAmt,
    PrintedDate,
    InvoiceDate,
    ARPeriod,
    ShipCharge
)
SELECT
    UserID,
    @InvCustomerID,
    @agency_id,
    LocationID,
    @receipt_id,
    @TranNumber,
    1,                -- InvoiceCodeID = 'Receipt'
    @inv_post_void_id,
    @taxamt,
    TaxExemptTotal,
    fTaxExempt,
    fManualTax,
    @cpo_date,
    @cpo_amt,
    @cpo_req,
    [dbo].fnGetDateOffset(),
    1,                -- fStatus = 'POSTED'
    CASE WHEN (@tran_code_id = 3 OR @tran_code_id = 4) THEN 0.0 - (TranTotal)
         ELSE TranTotal
    END,
    ProcessDate,
    ProcessDate,
    @ar_period,
    ShipCharge
FROM Transaction_Header
WHERE TransactionID = @receipt_id;
```

**22 columns. Every column source is now known**: most copy directly from the originating `Transaction_Header` row, while AR-specific fields come from proc params (`@agency_id`, `@cpo_amt`, `@TranNumber` etc.). Refunds (`TranCodeID` 3 or 4) negate `InvoiceAmt`. The `[dbo].fnGetDateOffset()` helper provides the create-time stamp.

The proc also writes `Acct_ARInvoice_Tender`:

```sql
INSERT INTO Acct_ARInvoice_Tender (
    ARInvoiceID, AgencyID, TenderID, TenderAmount,
    TenderAccount, TenderAuth, TenderResp, ExpDate,
    fAuthorized, AuthorizedDate
)
SELECT
    @arinvoice_id, AgencyID, TenderID, TenderAmount,
    NULL, NULL, NULL, NULL,         -- account/auth/resp/exp wiped on copy
    1, AuthorizedDate
FROM TransactionTender360_vw
WHERE TransactionID = @receipt_id
  AND AgencyID = @agency_id
  AND ISNULL(CustomerId, 0) = @GCCustomerID
  AND TenderAmount <> 0;
```

Note the **deliberate NULL-out** of `TenderAccount`, `TenderAuth`, `TenderResp`, `ExpDate` — looks like PCI-aware masking when persisting an AR-invoice tender row from a payment-method tender.

And the receipt marker:
```sql
UPDATE Transaction_Header SET fInvoiced = 1 WHERE TransactionID = @receipt_id;
```

### Path B detail: `SP_ARCreateInvoiceDtl` — the `Acct_ARInvoice_Detail` insert

```sql
INSERT INTO Acct_ARInvoice_Detail (
    ARInvoiceID, SKU, Qty, Price, ExtPrice, OrginReceipt,
    FeeAmt, DiscountAmt, DiscountRate, TaxAmt, TranDtlID
)
SELECT
    @arinvoice_id,
    td.SKU,
    td.Qty,
    td.Price,
    td.ExtPrice,
    @receipt_num,
    0.0,                                      -- FeeAmt always 0
    td.DiscountAmt + td.TranDiscAmt,          -- combined line + tran discount
    td.DiscountRate,
    td.TaxAmt,
    td.TranDtlID
FROM Transaction_Detail td
LEFT OUTER JOIN TransactionTender360_vw tendVw ON td.TranDtlID = tendVw.TranDtlId
WHERE td.TranDtlID = @receipt_dtl_id
  AND NOT EXISTS (
      SELECT * FROM Acct_ARInvoice_Detail
      WHERE ARInvoiceID = @arinvoice_id
        AND TranDtlID = td.TranDtlID
  )
  AND (@AgencyTypeID <> 5 OR (tendVw.CustomerId = @GCCustomerId));
```

11 columns. The `NOT EXISTS` guard prevents duplicate detail rows; the `@AgencyTypeID <> 5` clause is a special-case for gift-cert agencies.

### Path A: `SP_ARAutogenInvoices` writes its own inline `INSERT INTO Acct_ARInvoice_Header`

Not a call to `SP_ARCreateInvoiceHdr` — the auto-gen proc duplicates the create logic with a slightly different schema (16 columns vs 22):

```sql
INSERT INTO Acct_ARInvoice_Header (
    UserID, CustomerID, AgencyID, LocationID, TransactionID, InvoiceNumber,
    InvoiceCodeID,    -- 7 = Auto-generated
    PostVoidID, CPODate, fStatus, PrintedDate,
    InvoiceDate, ARPeriod, fTaxExempt, fManualTax,
    fAutogen          -- 1 = Auto-generated marker
)
VALUES (
    @UserID, @InvoiceCustomerID, @AgencyID, @LocationID, 0, @InvoiceNumber,
    7, 0, @CreateDate, 1, @CreateDate,
    @CreateDate, @ARPeriod, @fTaxExempt, @fManualTax, 1
);
```

The remaining 6 columns from Path B's superset (`Tax`, `TaxExemptTotal`, `CPOAmount`, `RequestNumber`, `InvoiceAmt`, `ShipCharge`) are populated by a follow-up `UPDATE` as detail rows accumulate:

```sql
UPDATE Acct_ARInvoice_Header
SET CPOAmount      = CPOAmount + @TenderAmount,
    Tax            = Tax + @TaxTotal,
    TaxExemptTotal = TaxExemptTotal + @TaxExemptTotal,
    InvoiceAmt     = InvoiceAmt + @TranTotal
WHERE ARInvoiceID = @ARInvoiceID;
```

Auto-gen also creates:
- `Acct_ARInvoice_Tender` rows (sourced from `Transaction_Tender`, no NULL-out — the auto-gen proc preserves account/auth fields, unlike the receipt-promote proc)
- `Acct_Apply` rows (payment-application tracking; `ApplyTypeID IN (3, 4)` semantically separates invoices and payments)

### `InvoiceCodeID` mapping — confirmed

| Value | Meaning | Source proc |
|---:|---|---|
| `1` | Receipt-sourced (the workhorse) | `SP_ARCreateInvoiceHdr` |
| `7` | Auto-generated (batch run) | `SP_ARAutogenInvoices` |
| `5` | Gift certificate | (filter in WHERE clauses; create proc not yet recovered) |
| `6` | (unknown — appears in filters) | ❓ |

### `SP_ARAutogenInvoices` selection logic — the eligibility predicate

The auto-gen run picks transactions matching:
```sql
WHERE fInvoiced = 0
  AND Transaction_Header.fStatus NOT IN (0, 3, 4, 7, 8, 9)
  AND fInvoiceInAR = 1
  AND (ISNULL(MOReceiptId, 0) = 0 OR MOfStatus = 1)
  AND ad.ARInvoiceDtlID IS NULL    -- not already invoiced
  AND -- run-config filters: account-select-type, customer-select-type,
      -- date range, transaction-number range
```

The run config (date range, account type, customer type, etc.) is read from a single `Acct_ARAutogen_Inv` row keyed by `@autogenID` (the proc's first param). So `SP_ARAutogenInvoices(@autogenID, 0)` is fully parameterized by a config row in `Acct_ARAutogen_Inv`.

---



### What is literally in the binary

```
{call SP_ARAutogenInvoices (%d, 0)}
{call SP_ARDeleteAutoInvoice(%d)}
```

— `WA_AR.dll.strings.txt:4173` and `:4181`

### UI shell

✅ The dialog class is `CARInvoiceAutogenView` (`WA_AR.dll.strings.txt:5837`). It is a custom subclass — not the standard `CG3RecordView` — meaning the screen is purpose-built for batch generation rather than the per-row "header view" pattern used elsewhere in WPAdmin.

✅ The user-facing confirmation is the literal string `Are you sure you want to Generate Invoices?` (`WA_AR.dll.strings.txt:5716`). On confirm, `SP_ARAutogenInvoices` fires.

### Parameter signature

| # | Format | Inferred binding | Confidence |
|---:|---|---|---|
| 1 | `%d` | LocationID (likely) — every WA_AR proc that takes a single int as param 1 binds it to a location, and the AR ledger is per-location | 🔍 |
| 2 | `0` (literal) | A mode flag — possibly "preview vs commit", or "include closed accounts: no" | ❓ |

🔍 The companion `SP_ARDeleteAutoInvoice(%d)` takes a single `ARInvoiceID` (verified by other DELETE statements in the file that key on `ARInvoiceID = %d`). It is the manual undo for an auto-generated invoice — confirming that the batch generator emits one or more rows that can be selectively deleted afterward.

### Source data the proc must read

🔍 The binary's read surface includes `Acct_ARAutogen_Inv` (`WA_AR.dll` per-binary doc, "Read surface" section) — a staging / configuration table that almost certainly defines which agencies / customers / activity-windows are eligible for auto-invoicing. Combined with the `[fAutoCreateInvoice]` column reference (`WA_AR.dll.strings.txt:3914`), the picture is: each agency or customer carries a flag, and `SP_ARAutogenInvoices` enumerates the flagged accounts at the given location, then writes an `Acct_ARInvoice_Header` row plus N `Acct_ARInvoice_Detail` rows per qualifying account.

### Visible writes during the batch

✅ **None.** `WA_AR.dll` contains zero `INSERT INTO Acct_ARInvoice_*` strings. The proc does all the inserting internally. The binary's only verbatim writes against the `Acct_ARInvoice_*` tables are DELETEs and the `fDoGL` toggle UPDATE — both are post-creation lifecycle operations on already-existing invoices.

## 2. Path B — Manual entry via Invoice Maintenance

### Entrypoint

✅ `CARInvoiceHeaderView` is the form view class for one-by-one invoice entry. Visible methods:

- `?RecordAdd@CARInvoiceHeaderView@@MAEHXZ` (`WA_AR.dll.strings.txt:3329`) — the OnAdd handler.
- `?RecordPost@CARInvoiceHeaderView@@MAEHXZ` (`WA_AR.dll.strings.txt:3387`) — the OnPost / commit handler.
- `?DoFieldExchange@CARInvoiceHdrSet@@MAEXPAVCFieldExchange@@@Z` (`WA_AR.dll.strings.txt:1547`) — the recordset's column-binding method.

The view is paired with `CARInvoiceHdrSet` (the data class) and `CARInvoiceReceiptView` (a sibling view for receipt-side display).

### Why the SQL is invisible

🔍 `RecordAdd` and `RecordPost` are virtual methods inherited from the framework class `CG3RecordView`, defined in `WPUtility.dll`:

- `?RecordAdd@CG3RecordView@@UAEHXZ` (`WPUtility.dll.strings.txt:10098`)
- `?RecordPost@CG3RecordView@@UAEHXZ` (`WPUtility.dll.strings.txt:10110`)

In the MFC `CRecordView` / `CRecordset` pattern, `AddNew` and `Update` on the recordset object generate INSERT and UPDATE statements at runtime from the column bindings declared in `DoFieldExchange`. The literal SQL is constructed by ODBC's MFC layer — it is never embedded in the binary's `.rdata` section, so the strings extractor cannot recover it.

This is the single biggest static-analysis blind spot for this action: **we know the INSERT happens, we know which class manages it, but we cannot enumerate the columns.**

## 3. The `Acct_ARInvoice_*` table family

✅ References across the binaries identify five tables in the AR-invoice schema:

| Table | Role (inferred from access patterns) | Confidence |
|---|---|---|
| `Acct_ARInvoice_Header` | One row per invoice. Carries `ARInvoiceID` PK, `InvoiceNumber`, `CustomerID`, `AgencyID`, `LocationID`, `InvoiceTotal`, `fOpenBalance`, `fDoGL`. | ✅ |
| `Acct_ARInvoice_Detail` | Line items. Keyed by `ARInvoiceID + SKU` (per `DELETE FROM Acct_ARInvoice_Detail WHERE ARInvoiceID = %ld AND SKU = %ld`). | ✅ |
| `Acct_ARInvoice_Pymt` | Payments applied against the invoice. Keyed by `ARInvDtlPymtID`; tracks `CustomerID + AgencyID`. Joined via `ARInvoiceID`. | ✅ |
| `Acct_ARInvoice_GiftCert` | Gift-cert-backed invoice rows. Has `GCNumber`, `AgencyID`, `ARInvDtlGCID`. | ✅ |
| `Acct_ARInvoice_BadChk` | Bad-check-backed invoice rows. Referenced as `[dbo].[Acct_ARInvoice_BadChk]` in `WACommon.dll.strings.txt:1789`. | ✅ |

🔍 The two latter tables — `_GiftCert` and `_BadChk` — suggest that invoice "details" can come from multiple sources beyond simple SKU lines: a gift certificate purchase or a bounced-check write-off both materialize as an AR invoice with a typed detail row.

### Header columns recoverable from WHERE / SELECT / UPDATE

| Column | Type | Evidence |
|---|---|---|
| `ARInvoiceID` | int (PK) | `SELECT TOP 1 ARInvoiceID FROM Acct_ARInvoice_Header ORDER BY ARInvoiceID DESC` (`:6341`) |
| `InvoiceNumber` | varchar | `SELECT Count(*) FROM Acct_ARInvoice_Header WHERE InvoiceNumber = '%s'` (`:6254`), used for duplicate-check |
| `CustomerID` | int | `SELECT CustomerID FROM Acct_ARInvoice_Header WHERE InvoiceNumber = '%s'` (`:6281`) |
| `AgencyID` | int | `... where AgencyID = %d AND fOpenBalance = 1` (`:5745`) |
| `LocationID` | int | `select LocationID from Acct_ARInvoice_Header where ARInvoiceID = %d` (`:6296`) |
| `fOpenBalance` | bit/flag | `... AND fOpenBalance = 1` (`:5745`) — distinguishes invoices that still have a balance |
| `fDoGL` | bit (0 / 1 / null) | `select isnull(fDoGL,2) from Acct_ARInvoice_Header where ARInvoiceID = %ld` (`:6295`) — controls per-invoice GL posting; default appears to be NULL/2 (unset) |
| `InvoiceTotal` | money | `select InvoiceTotal from VW_AR_BADCHK_HEADER where ARInvoiceID = %d` (`:6294`) |

❓ Other header columns almost certainly exist (`InvoiceDate`, `DueDate`, `Description`, etc.) but are not referenced by literal SQL in the binaries — they are bound only by the MFC field exchange.

### Detail / Pymt columns recoverable

| Table | Column | Evidence |
|---|---|---|
| `Acct_ARInvoice_Detail` | `ARInvoiceID`, `SKU` | `DELETE FROM Acct_ARInvoice_Detail WHERE ARInvoiceID = %ld AND SKU = %ld` (`:6011`) |
| `Acct_ARInvoice_Pymt` | `ARInvoiceID`, `CustomerID`, `AgencyID`, `ARInvDtlPymtID` | `delete acct_ARInvoice_Pymt where ARInvDtlPymtID = %d` (`:5993`) and `delete Acct_ARInvoice_Pymt where ARInvoiceID = %d and CustomerID = %d and AgencyID = %d` (`:5994`) |
| `Acct_ARInvoice_GiftCert` | `ARInvoiceID`, `ARInvDtlGCID`, `AgencyID`, `GCNumber` | `WHERE GCNumber like '%%%s'` (`:5744`) |

### `InvoiceCodeID` — invoice categorisation

✅ Visible filter values for `InvoiceCodeID`:

```
ARInvoiceID = ? AND InvoiceCodeID = 5      (:5739)
ARInvoiceID = ? AND InvoiceCodeID = 7      (:5740)
ARInvoiceID = ? AND InvoiceCodeID in (1,6) (:5741)
```

🔍 This is a categorical column that sub-types invoices. From the access pattern (different code-paths interrogate different InvoiceCodeIDs), the codes likely correspond to: 1 = standard sale, 5 = gift certificate, 6 = ?, 7 = bad check. We cannot confirm the mapping without the proc body or a reference table dump.

## 4. Cross-binary: alternate AR-invoice-create paths

### `SP_ARCreateMOTran` (in `WinPrism.exe`, not in `WA_AR.dll`)

```
{ call SP_ARCreateMOTran (%d, %d, '%s') }    (WinPrism.exe.strings.txt:6903)
```

🔍 "MOTran" = Mail-Order Transaction (consistent with the `CMOAddItemBaseDlg` / `CMOExchAddItemDlg` / `CMOSaleAddItemDlg` view-class family in `WinPrism.exe.strings.txt:481-555`). This is the POS/special-order codepath that creates an AR-side transaction when a customer or department charges a special-order book to their account at the till. Its 3-arg signature (`int, int, varchar`) suggests `(LocationID, CustomerOrAgencyID, ReferenceNumber)`.

The fact that this proc lives in `WinPrism.exe` (not `WA_AR.dll`) tells us **the AR-invoice domain has at least three distinct creation entrypoints**:

1. WPAdmin → AR Invoice Maintenance → New (manual entry, MFC-managed)
2. WPAdmin → AR Auto-Generate Invoices (batch, `SP_ARAutogenInvoices`)
3. WinPrism POS → Special-order or charge-account flow (`SP_ARCreateMOTran`)

### QuickSearch helpers

```
{ call P_QuickSearchAddSortARInvoice('%s', '%s') }   (WACommon.dll.strings.txt:2040)
STP=SP_ARInvoices(%ld, '%s');ID=ARInvoiceID;DSP=InvoiceNumber  (WPUtility.dll.strings.txt:17339)
```

These are read-side: QuickSearch dialogs use `SP_ARInvoices` as the result-set source and `P_QuickSearchAddSortARInvoice` to add custom sort/filter terms.

## 5. Visible lifecycle operations on existing invoices

Once an invoice exists (whether from auto-gen or manual entry), `WA_AR.dll` does manage it directly with literal SQL:

| Operation | Statement | Source |
|---|---|---|
| Toggle GL posting on | `update Acct_ARInvoice_Header set fDoGL = 1 where ARInvoiceID = %ld` | `:6465` |
| Toggle GL posting off | `update Acct_ARInvoice_Header set fDoGL = 0 where ARInvoiceID = %ld` | `:6464` |
| Delete invoice header | `DELETE Acct_ARInvoice_Header WHERE ARInvoiceID = %d` | `:5992` |
| Delete invoice details (all) | `DELETE Acct_ARInvoice_Detail WHERE ARInvoiceID = %d` | `:5991` |
| Delete one detail line | `DELETE FROM Acct_ARInvoice_Detail WHERE ARInvoiceID = %ld AND SKU = %ld` | `:6011` |
| Delete payment row by PK | `delete acct_ARInvoice_Pymt where ARInvDtlPymtID = %d` | `:5993` |
| Delete payment rows by composite | `delete Acct_ARInvoice_Pymt where ARInvoiceID = %d and CustomerID = %d and AgencyID = %d` | `:5994` |
| Get last invoice ID | `SELECT TOP 1 ARInvoiceID FROM Acct_ARInvoice_Header ORDER BY ARInvoiceID DESC` | `:6341` |
| Duplicate-number check | `SELECT Count(*) FROM Acct_ARInvoice_Header WHERE InvoiceNumber = '%s'` | `:6254` |

There is also a `[PrintInvoice]` UI string (`WA_AR.dll.strings.txt:4036`) — confirming a print action exists, though the print routing is not visible in the binary (probably Crystal Reports — `CRUFL_NBC_Addin.dll` and `NBC.CrystalReport.dll` are the .NET helpers in the install).

### Notably absent: a generic "post" proc

There are domain-specific post procs (`SP_AROpenBalPost`, `SP_ARAdjustPost`, `SP_ARBadChecks_Post`, `SP_ARGiftCertificate_Post`, `SP_ARPymtPost`) but **no generic `SP_ARInvoicePost`**. This implies "post" on an AR invoice is either:

- 🔍 The MFC `CRecordView::OnRecordPost` UPDATE flow — the form simply saves whatever fields the user edited and the row stays in `Acct_ARInvoice_Header` with whatever flags they toggled.
- 🔍 Or "post" is a status transition encoded in `fDoGL` + posting downstream via the GL post (no AR-side flag named `fPosted` is visible in the binary).

## 6. Workflow reconstruction

🔍 The end-to-end picture for the most common "generate invoices" workflow at Pierce:

1. **Admin opens WPAdmin → AR module → Generate Invoices** → `CARInvoiceAutogenView` displays. Possibly takes a date range / location filter as input (the form fields are not visible to static analysis).
2. **Admin clicks Generate** → confirmation dialog: `Are you sure you want to Generate Invoices?`
3. **Admin confirms** → `{call SP_ARAutogenInvoices (%d, 0)}` fires.
4. **The proc reads** `Acct_ARAutogen_Inv` config (likely an agency-level definition table) plus the actual unbilled activity (sources unknown — possibly `Transaction_Header`/`Transaction_Detail` filtered by AR-account tenders, or a queued-charges table; the proc body cannot be read).
5. **The proc writes** N rows to `Acct_ARInvoice_Header` with `fOpenBalance=1`, `fDoGL=NULL` (the default), an auto-allocated `InvoiceNumber`, plus K rows per invoice in `Acct_ARInvoice_Detail` (and possibly `_GiftCert` / `_BadChk` for typed details).
6. **Admin reviews** in the QuickSearch list (powered by `SP_ARInvoices`) and may:
   - Click an invoice → `CARInvoiceHeaderView` opens → toggles `fDoGL` to 1 → MFC saves via `RecordPost` → `update Acct_ARInvoice_Header set fDoGL = 1 where ARInvoiceID = %ld` fires.
   - Or click _Print Invoice_ → Crystal Reports rendering (not in scope for this analysis).
   - Or click _Delete_ on a generated invoice → `SP_ARDeleteAutoInvoice(%ld)` fires (auto-gen specifically) or the Delete cascade hits `Acct_ARInvoice_Detail`/`_Pymt`/`_Header` directly via the visible DELETE statements (manual delete).
7. **Periodically: GL post.** Whatever job propagates `fDoGL = 1` invoices into the GL fires elsewhere — possibly a separate WPAdmin action or a scheduled run. No `SP_ARGLPost` is visible in `WA_AR.dll`, but `WA_AP.dll` has `SP_APGLPostInvoice` — the AR side likely has an analog inside another module.

The manual-entry workflow (Path B) is structurally similar: the user creates a header in `CARInvoiceHeaderView`, MFC issues the INSERT, the user types detail lines, MFC issues per-line INSERTs into `Acct_ARInvoice_Detail` — but every INSERT is generated by the framework rather than being a literal in the binary.

## 7. What static analysis cannot tell us

- ❓ **The body of `SP_ARAutogenInvoices`.** This is the entire substance of the auto-gen behaviour: which source tables it reads, which `InvoiceCodeID` it stamps, how it handles partial periods, whether it is idempotent. Recoverable only by `VIEW DEFINITION` grant or dynamic snapshot/diff.
- ❓ **The MFC-generated INSERT for manual entry.** We know the recordset class is `CARInvoiceHdrSet` and we know `DoFieldExchange` declares the column bindings, but the column list itself is in the C++ method body, not in the strings. Recoverable by IDA/Ghidra decompilation of `WA_AR.dll` — substantial effort — or by a snapshot/diff.
- ❓ **Mapping of `InvoiceCodeID` integer values to types.** We see codes 1, 5, 6, 7 used as filters but no enum / lookup table is referenced in literal SQL.
- ❓ **The body of `SP_ARCreateMOTran`** — the POS-side mail-order transaction creation.
- ❓ **What actually triggers the `fAutoCreateInvoice` flag.** It is a column reference, but the table it lives on is not visible from the literal strings. Inference suggests `Acct_Agency` (the department/customer master), but only dynamic capture or schema lookup confirms.
- ❓ **GL posting downstream.** No literal AR→GL post proc in `WA_AR.dll`. The pipeline probably exits this module entirely.
- 🔍 **Trigger side-effects.** Partially closed by a 2026-04-25 plan-cache probe — see the new "Triggers" section below. Three triggers exist on the AR-invoice tables; the cursor preludes were recovered, but the loop bodies stayed evicted. Closing this fully needs a snapshot/diff or another probe later.

## Triggers on the AR-invoice tables — partial recovery (2026-04-25)

A targeted plan-cache probe via `scripts/probe-prism-arinvoice-triggers.ts` enumerated every trigger parented on the six `Acct_ARInvoice_*` tables and pulled their cached bodies.

### Trigger inventory

| Table | Trigger | Type | Cached executions | Status |
|---|---|---|---:|---|
| `Acct_ARInvoice_Header` | `TI_Acct_ARInvoice_Header` | INSERT only | 414 (Apr 23) | Cursor prelude recovered ([`../proc-bodies/TI_Acct_ARInvoice_Header.sql`](../proc-bodies/TI_Acct_ARInvoice_Header.sql)); loop body evicted |
| `Acct_ARInvoice_Detail` | `TI_ARInvoice_Detail` | INSERT only | 1,055 (Apr 23) | Cursor prelude recovered ([`../proc-bodies/TI_ARInvoice_Detail.sql`](../proc-bodies/TI_ARInvoice_Detail.sql)); loop body evicted |
| `Acct_ARInvoice_BadChk` | `TIUD_Acct_ARInvoice_BadChk` | INSERT + UPDATE + DELETE | 0 | Not cached (rare path) |
| `Acct_ARInvoice_Tender` | _none_ | — | — | ✅ No triggers |
| `Acct_ARInvoice_Pymt` | _none_ | — | — | ✅ No triggers |
| `Acct_ARInvoice_GiftCert` | _none_ | — | — | ✅ No triggers |

### Critical structural findings

- ✅ **Tender, Pymt, and GiftCert have no triggers at all.** When laportal inserts into these tables, no implicit side effects fire.
- ✅ **There are no UPDATE or DELETE triggers on `Acct_ARInvoice_Header` or `_Detail`.** Header/detail mutations and deletions do not trigger sync work. Only the initial INSERT does.
- 🔍 **Both INSERT triggers join to `Acct_Agency` to retrieve `AgencyNumber` per row.** Recovered prelude shape:

  ```sql
  -- TI_Acct_ARInvoice_Header
  declare curARh cursor for
      select i.ARInvoiceID, a.AgencyNumber
      from inserted i
      inner join Acct_Agency a on i.AgencyID = a.AgencyID;
  fetch curARh into @arinvoice_id, @agency_number;
  ```

  ```sql
  -- TI_ARInvoice_Detail
  declare curARd1 cursor for
      select i.ARInvoiceDtlID, a.AgencyNumber
      from inserted i
      inner join Acct_ARInvoice_Header h on i.ARInvoiceID = h.ARInvoiceID
      inner join Acct_Agency a on h.AgencyID = a.AgencyID;
  fetch curARd1 into @arinvoice_dtl_id, @agency_number;
  ```

- 🔍 **Both triggers fire on every receipt-promote.** `SP_ARCreateInvoiceHdr` ran 10,438 times in 3 days; `TI_Acct_ARInvoice_Header` has 414 cached executions in the same window. Activity is correlated; the trigger is part of every standard create.

### What's still ❓

- ❓ **What the cursor loops actually do.** The `WHILE @@FETCH_STATUS = 0 BEGIN ... END` body is not in the current cache slice. Likely candidates based on the agency-number theme and prior findings about `pos_update`:
  - Insert into a sync queue keyed by `AgencyNumber` (e.g. `pos_update`, `web_update`, or a similar staging table — `SP_ARAcctResendToPos` writes to `pos_update` with `type` codes per entity, so an AR-invoice trigger probably writes there with a different type code).
  - Update an aggregated balance / aging row keyed by agency.
  - Call a per-agency sync proc.
- ❓ **What `TIUD_Acct_ARInvoice_BadChk` does.** Zero cached executions; rarely fires. Re-probe if/when bad-check handling becomes in scope.

### How to close the gap

Two options, in ranked order:

1. **Snapshot/diff a single receipt-to-invoice promotion.** This catches every trigger residue regardless of whether the trigger body is cached. The diff will show exactly which tables the trigger touched. ~5 minutes total with someone driving WPAdmin.
2. **Wait and re-probe.** The SQL Server may eventually evict the cursor preludes and cache the loop bodies on a different round. Slow and unreliable; option 1 is more direct.

Either way: this gap is **scoped and small**. It does not block laportal mirroring `SP_ARCreateInvoiceHdr`'s contract — the laportal mirror's INSERT will fire the trigger automatically (server-side), so as long as we use the same `Acct_ARInvoice_Header` insert shape, we inherit whatever the trigger does without having to replicate it client-side.

## 8. Implications for laportal

After plan-cache recovery, the picture is materially different from the original static-only conclusion (which is preserved below for comparison). Concrete observations as of 2026-04-25:

- **The receipt-to-invoice contract is fully buildable from this analysis alone.** The 22-column `Acct_ARInvoice_Header` INSERT, the 11-column `Acct_ARInvoice_Detail` INSERT, the 10-column `Acct_ARInvoice_Tender` INSERT (with the deliberate masking of `TenderAccount`/`Auth`/`Resp`/`ExpDate`), and the `Transaction_Header.fInvoiced = 1` marker are recovered verbatim from the plan cache. laportal can mirror them directly without calling the WPAdmin proc.
- **No UPDATE/DELETE triggers on Header or Detail** means laportal-side mutations (correcting an invoice, voiding a line) trigger no implicit sync work. Only the initial INSERT fires triggers.
- **The two INSERT triggers (`TI_Acct_ARInvoice_Header`, `TI_ARInvoice_Detail`) fire automatically server-side** when laportal does the INSERT, regardless of whether the call goes through `SP_ARCreateInvoiceHdr` or directly. We do not need to replicate the trigger logic client-side; the server handles it.
- **`SP_ARAutogenInvoices` remains the simplest integration for batch generation** — one proc call, two params (`@autogenID, 0`). The config row in `Acct_ARAutogen_Inv` keyed by `@autogenID` defines the date range, account-select-type, etc.
- **The five-table family means `Acct_ARInvoice_Detail` is not a complete picture of an invoice** — `_GiftCert` and `_BadChk` extension tables also feed into the totals. Any laportal-side rebuild has to handle (or explicitly exclude) those typed detail rows.
- **Posting and GL flow is a separate concern** — turning `fDoGL = 1` does not by itself post the invoice to the ledger; that has to happen elsewhere. Worth dedicated analysis when GL becomes in-scope.

### Build options for laportal, ranked

1. **Direct INSERT against `Acct_ARInvoice_*` from the laportal server, mirroring `SP_ARCreateInvoiceHdr`'s contract.** Most flexibility, no Prism proc dependency, fastest. The trigger handles agency-keyed sync as a side effect. **This is now the recommended path** — the contract is recovered.
2. **Call `SP_ARCreateInvoiceHdr` from laportal directly.** Same end state as option 1; less code. Trades flexibility for less surface area in our codebase. Requires `EXEC` permission on the proc, which our `pdt` login already has.
3. **Call `SP_ARAutogenInvoices(@autogenID, 0)`** when the batch shape fits the use case (e.g. monthly billing run). Treat it as the "press the button" path.

## 9. How to verify the unknowns

A single dynamic-analysis session collapses most of the ❓ items:

1. Snapshot Prism: `npx tsx scripts/prism-snapshot.ts before-arinvoice-batch`.
2. In WPAdmin → AR → Generate Invoices, with a small / known test agency, click _Generate_.
3. Snapshot: `npx tsx scripts/prism-snapshot.ts after-arinvoice-batch`.
4. Diff: `npx tsx scripts/prism-diff.ts before-arinvoice-batch after-arinvoice-batch`.

The diff reveals every column written, every trigger residue, and the actual `InvoiceCodeID` value chosen by the proc. A second pair of snapshots around a single manually-entered invoice (Path B) reveals the MFC-generated column contract.

After both experiments, this doc can graduate from a 70%-static / 30%-inferred analysis to a fully-confirmed write-path map.
