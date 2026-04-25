# Action: Open / print / export an AR invoice (Crystal Reports flow)

**Source binaries:** `WA_AR.dll` (UI handler), `NBC.CrystalReport.dll` (.NET — Crystal Reports runtime), `CRUFL_NBC_Addin.dll` (.NET — Crystal Reports User Function Library)
**Method:** Plan-cache recovery against the AR-invoice report stored procedures, plus binary-string and catalog discovery. See [`../plan-cache-method.md`](../plan-cache-method.md).
**Confidence:** ✅ confirmed by recovered proc body · 🔵 confirmed by literal binary string · 🔍 inference · ❓ unknown.

> Companion to [`generate-invoices.md`](generate-invoices.md). That doc covers how an `Acct_ARInvoice_Header` row is *created* (the receipt-promotion flow). This doc covers how an existing invoice is *displayed and exported* — the "search up an invoice → click → some old viewer opens → save as PDF" workflow that Pierce uses to send invoices out.

## TL;DR

When a user clicks _Print_ or _Open_ on an AR invoice in WPAdmin, the chain is:

1. The `[PrintInvoice]` UI handler in `WA_AR.dll` resolves the user's `ARInvoiceID`.
2. The .NET Crystal Reports runtime (`NBC.CrystalReport.dll`) loads a `.rpt` template (bound at install time; no `.rpt` files in the WinPRISM install dir — they live on a network share or per-tenant location).
3. The runtime executes **`SP_RPT_AR_INVOICE`** (verified — 37 cached executions on 2026-04-23 at Pierce) and binds the returned 47-column flat row-set to the report's data fields.
4. A sub-report calls **`SP_RPT_AR_INVOICE_ADDTIONAL_INFOMATION`** (sic — typo in the proc name) for aggregated totals.
5. The Crystal Reports Viewer (the "weird old document viewer") displays the rendered report.
6. The user clicks _File → Export → PDF_ to convert it.

The full data contract is recovered. **laportal can replicate the entire flow without Crystal Reports** — call `SP_RPT_AR_INVOICE` directly, render the result with any modern PDF engine (Puppeteer + HTML, react-pdf, PDFKit, etc.), stream the PDF to the browser. See section 6.

## 1. The Crystal Reports stack at WinPRISM

✅ Confirmed `.NET` assemblies present in `C:\Program Files (x86)\WinPRISM\` (per the [`prism-probe-clr.ps1`](../../../../scripts/prism-probe-clr.ps1) run from PR #293):

| Assembly | Role |
|---|---|
| `NBC.CrystalReport.dll` | Crystal Reports runtime / wrapper |
| `CRUFL_NBC_Addin.dll` | Crystal Reports User Function Library — custom formulas Prism's `.rpt` templates use |

✅ `.rpt` files are NOT in the WinPRISM install directory. A `find` across `C:\Program Files (x86)\` and known sibling paths returned zero hits. The `.rpt` files must live elsewhere — most likely a network share configured at install time, or a per-tenant `Reports` directory pointed at by a system parameter. Discovering the actual location requires inspecting the runtime configuration on a Pierce workstation (out of scope for this read-only analysis).

🔍 The two .NET helpers are wrappers around `CrystalDecisions.CrystalReports.Engine.ReportDocument` (the standard Crystal Reports SDK class for .NET). The native WPAdmin code does not embed Crystal directly — it loads `NBC.CrystalReport.dll` via COM/CLR interop and lets that library handle the rendering.

## 2. The data-source procs

### Primary: `SP_RPT_AR_INVOICE` (37 cached executions on 2026-04-23 at Pierce)

✅ Body recovered in full: [`../proc-bodies/SP_RPT_AR_INVOICE.sql`](../proc-bodies/SP_RPT_AR_INVOICE.sql). 33 unique cached statements covering:

#### Input parameters

| Parameter | Type | Role |
|---|---|---|
| `@invoice_id` | `int` | Starting `ARInvoiceID` (use the same value for `@end_invoice_id` to render a single invoice) |
| `@end_invoice_id` | `int` | Ending `ARInvoiceID` for ranged reports |
| `@agency_id` | `int` | Optional agency filter; pass `0` for "all agencies" |
| `@use_date` | `bit/int` | If non-zero, filter by `InvoiceDate` between `@con_start_date` and `@con_end_date`; otherwise use the invoice ID range |
| `@con_start_date` | `datetime` | Inclusive start date when `@use_date <> 0` |
| `@con_end_date` | `datetime` | Inclusive end date when `@use_date <> 0` |

For a single-invoice render (the "open and print this one invoice" case), the bindings are:

```sql
EXEC SP_RPT_AR_INVOICE
    @invoice_id     = <ARInvoiceID>,
    @end_invoice_id = <ARInvoiceID>,
    @agency_id      = 0,
    @use_date       = 0,
    @con_start_date = '',
    @con_end_date   = '';
```

#### Internal structure (recovered)

The proc uses a two-cursor pattern:

```sql
-- Outer cursor: find every ARInvoiceID matching the filter
DECLARE cur_get_invoices CURSOR FAST_FORWARD FOR
    SELECT DISTINCT Acct_ARInvoice_Header.ARInvoiceID
    FROM Acct_ARInvoice_Header
    INNER JOIN Acct_ARInvoice_Detail ON Acct_ARInvoice_Header.ARInvoiceID = Acct_ARInvoice_Detail.ARInvoiceID
    LEFT JOIN Transaction_Detail ON Transaction_Detail.TranDtlID = Acct_ARInvoice_Detail.TranDtlID
    LEFT JOIN Transaction_Header ON Transaction_Header.TransactionID = Transaction_Detail.TransactionID
    WHERE Transaction_Header.fStatus <> 4
      AND (@invoice_id < 1 OR InvoiceNumber BETWEEN @start_invoice AND @end_invoice)
      AND (@agency_id < 1 OR AgencyID = @agency_id)
      AND (@use_date = 0 OR InvoiceDate BETWEEN @con_start_date AND @con_end_date);
```

Note the `Transaction_Header.fStatus <> 4` guard — `fStatus = 4` is excluded (likely a void / cancelled status).

For each matched invoice, an **inner cursor** picks one of two SELECT shapes based on `InvoiceCodeID`:

- **Branch A** — special view-based source (`ARInvoiceDetNMRPP2_vw`) for NMRPP rental items.
- **Branch B** — direct join over `Acct_ARInvoice_Header` + `Acct_ARInvoice_Detail` + `Transaction_Detail` + `Transaction_Header` for standard invoices. This is the common case at Pierce.

For every detail row, the proc looks up:

| Field | Source |
|---|---|
| `RefNumber` | `RequestNumber` from `Acct_ARInvoice_Header` or `Transaction_Header` (whichever is non-empty) |
| `Description` | `Transaction_Detail.Description`, with NMRP / NBCP rental price annotations: `' (student)'`, `' (NMRP)'`, `' (NBCP)'` suffixes when matching rental price flags |
| `CustomerName`, `CustomerNumber` | `Customer_Table.AccountNumber + '/' + FirstName + ' ' + LastName` |
| `CustomerAddress`, `CustomerCity`, `CustomerState`, `CustomerZipCode` | `Customer_Address` (top 1 by `fBillAddr IN (1, 2)` ordered by `fDefault DESC`) — falls back to the agency's address |
| `AgencyName`, `AgencyNumber` | `Acct_Agency.Name`, `Acct_Agency.AgencyNumber` |
| `Location`, `LocationAddress`, `LocationCity`, `LocationState`, `LocationZipCode`, `LocationPhone` | `Location.Description` + `Store_Information_Table.Mail*` columns |
| `TermDesc` | `Acct_Terms_Header.TermDesc` (joined via `Acct_Agency.AcctTermID`) |
| `Billing` | `Acct_Agency.fBilling` |
| `fExempt`, `ExemptNumber` | `Acct_Agency.fTaxExempt`, `Acct_Agency.FedTaxNumber` |
| `TransactionType` | `Transaction_Header.TranTypeID` |
| `PageBreak` | `Acct_Agency.fPageBreak` (per-agency setting that controls page-breaks in the report) |

#### Output schema — the `#_invoice` temp table

The proc populates a 47-column temp table and returns it via:

```sql
SELECT * FROM #_invoice ORDER BY ARInvoiceDtlID, Description DESC;
```

✅ All 47 columns recovered from the `INSERT` literal:

```
ARInvoiceDtlID, DetailDate, LocationID, Location,
LocationAddress, LocationCity, LocationState, LocationZipCode, LocationPhone,
InvoiceNumber, CreateDate, ChargedAmount, InvoiceAmount, Tax, InvoiceDiscount,
SKU, Description, Qty, Price, Discount, ExtPrice, ItemTax,
CustomerName, CustomerNumber, CustomerAddress, CustomerCity, CustomerState, CustomerZipCode,
TermDesc, Billing, AgencyName, AgencyNumber, fExempt, ExemptNumber,
InvoiceCodeID, CheckAmount, ApplyInvoice, CheckNumber, CheckDate, Credit, Debit,
CustomerIsDetail, PageBreak, DetailCPOAmount, ShipCharge, TransactionType, InvoiceID, RefNumber, OrginReceipt
```

The `.rpt` template binds report-section text fields directly to these column names. Pre-formatted; no client-side computation needed.

### Sub-report: `SP_RPT_AR_INVOICE_ADDTIONAL_INFOMATION`

✅ Body recovered: [`../proc-bodies/SP_RPT_AR_INVOICE_ADDTIONAL_INFOMATION.sql`](../proc-bodies/SP_RPT_AR_INVOICE_ADDTIONAL_INFOMATION.sql). Single SELECT with aggregations, takes `@invoice_id`. Returns one row per invoice with:

- `InvoiceNumber`, `UserName` (joined from `prism_security.PrismUser`), `InvoiceDate`
- `TotalItems` = `SUM(Qty)`, `TotalLines` = `COUNT(Qty)`
- `TaxExempt` / `ManualTax` rendered as `'YES'` / `'NO'` strings (Crystal-friendly)
- `PostVoid` (the InvoiceNumber of the voiding invoice if this one was post-voided)
- `StatusDesc` (joined to `Status_Codes WHERE ModuleID = 13101`)
- `CustomerID` (the `AccountNumber`), `CustName`, `RequestNumber`, `AgencyNumber`
- `InvoiceAmt`, `TotShip`, `ItemDisc`, `InvoiceDiscount`, `Tax`, `TaxExemptTotal`, `CPOAmount`, `CheckAmount`, `DiscountDetail`, `ExtPrice`

Note `ModuleID = 13101` is the AR Invoice module's status-code namespace.

### Adjacent: `SP_RPT_AR_INVOICE_REGISTER`

✅ Body recovered: [`../proc-bodies/SP_RPT_AR_INVOICE_REGISTER.sql`](../proc-bodies/SP_RPT_AR_INVOICE_REGISTER.sql). Different report — a list-view of invoices over a range (date / customer / agency). Not the single-invoice path, but useful for "give me all invoices for ANTHRO this month" reports.

Per-invoice row schema:
```
InvoiceNumber, InvoiceDate, InvoiceAmt + Tax (combined),
AgencyNumber AS AccountCode, Acct_Agency.Name AS AccountName,
Customer_Table.AccountNumber AS CustomerCode, LastName + ', ' + FirstName AS CustomerName,
Acct_ARInvoice_Header.CPOAmount AS AmountCharged,
LocationID, Location.Description AS LocationDesc
```

### School-specific variants (excluded from Pierce path)

The catalog also contains school-customized renders: `SP_RPT_AR_INVOICE_BCIT`, `SP_RPT_AR_INVOICE_LONG_BEACH`, `SP_RPT_AR_INVOICE_SDSU`, `SP_RPT_AR_INVOICE_THOMPSONRIVERS`, `SP_RPT_AR_INVOICE_BY_DCC_Wilmington`, `SP_RPT_AR_INVOICE_IC`. None recovered (none executed at Pierce — Pierce uses the generic `SP_RPT_AR_INVOICE`).

## 3. Workflow reconstruction

🔍 End-to-end, when Marcos clicks _Print Invoice_ on an AR invoice in WPAdmin:

1. WPAdmin's `WA_AR.dll` reads the highlighted `ARInvoiceID` from the form's bound recordset.
2. UI handler `[PrintInvoice]` (literal binary string at `WA_AR.dll.strings.txt:4036`) fires.
3. Handler invokes the .NET Crystal Reports wrapper (`NBC.CrystalReport.dll`) via COM interop, passing the `ARInvoiceID` and the path to a `.rpt` template (path resolved at runtime from a configured Reports directory).
4. The Crystal Reports runtime opens the `.rpt`, reads its embedded data-source definitions, and discovers it needs `SP_RPT_AR_INVOICE` + `SP_RPT_AR_INVOICE_ADDTIONAL_INFOMATION`.
5. Runtime executes both procs with the invoice ID; binds returned columns to template fields.
6. Crystal Reports Viewer window opens with the rendered invoice.
7. User picks _File → Export → PDF_; the runtime writes a `.pdf` file to the user's chosen location.

The total round-trip is one DB query for headline data + one for aggregates + a render in the .NET Crystal runtime. Standard 2000s-era ERP report architecture.

## 4. What we *cannot* recover from this analysis

- ❓ **The actual `.rpt` template file.** It defines the visual layout — fonts, page breaks, logo placement, header bands, totals positioning. Recovering it requires obtaining the file from disk on a Pierce workstation, or extracting it from a Crystal-aware tool. Out of scope for this read-only DB analysis.
- ❓ **The configured `.rpt` path.** Likely set in a `SystemParameters` row (or an INI file alongside the install). The path resolves at runtime, so static analysis of the binary doesn't expose it.
- ❓ **CRUFL custom-function bodies.** `CRUFL_NBC_Addin.dll` provides custom formula functions the `.rpt` may invoke. Their semantics are not part of the SQL contract we recovered.
- ❓ **Whether Pierce overrides the default `.rpt` template.** Some Prism installations let admins swap in a custom template per report ID. Worth checking but not required for the laportal mirror — the data contract is the same regardless of template.

None of these gaps block laportal from building a native PDF renderer (see section 6).

## 5. Implications for laportal

✅ **The data contract is fully recovered.** laportal already has a Prism connection via `@/lib/prism` and runs procs via `pool.request().execute(...)`. Adding a single endpoint that calls `SP_RPT_AR_INVOICE` is straightforward.

✅ **The 47-column flat row-set is render-friendly.** Each row is one detail line with header / customer / agency fields denormalized — exactly the shape you'd want for a flat HTML table or a templated PDF. No client-side joins needed.

✅ **No Crystal Reports dependency.** laportal can render the result with any modern engine. The currently-installed dev dependencies don't include Puppeteer or react-pdf, but adding either is a single `npm install`.

🔍 **The PDF rendering library choice is open.** Three reasonable options for laportal:

| Engine | Pros | Cons |
|---|---|---|
| **Puppeteer / Playwright + HTML template** | Pixel-perfect PDFs from React/HTML; familiar to web devs; Tailwind-friendly | Heavy runtime (Chromium); ~200 MB to deploy |
| **`@react-pdf/renderer`** | React component model; small footprint; declarative layout | Custom font handling; less flexible than HTML/CSS |
| **PDFKit / pdfmake (Node-native)** | Tiny; fast; no headless browser | Imperative API; verbose for complex layouts |

For Pierce's use case (a one-page invoice with header + line-item table + totals), **`@react-pdf/renderer` is probably the sweet spot**. Lightweight, React-native, Tailwind theming optional.

## 6. Suggested laportal endpoint shape

```typescript
// src/app/api/invoices/[id]/print/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getPrismPool, sql } from "@/lib/prism";
import { renderToBuffer } from "@react-pdf/renderer";
import { InvoiceDocument } from "@/components/print/invoice-document";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const arInvoiceId = Number(params.id);
  if (!Number.isFinite(arInvoiceId)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }

  const pool = await getPrismPool();
  const [main, summary] = await Promise.all([
    pool.request()
      .input("invoice_id", sql.Int, arInvoiceId)
      .input("end_invoice_id", sql.Int, arInvoiceId)
      .input("agency_id", sql.Int, 0)
      .input("use_date", sql.Int, 0)
      .input("con_start_date", sql.VarChar, "")
      .input("con_end_date", sql.VarChar, "")
      .execute("SP_RPT_AR_INVOICE"),
    pool.request()
      .input("invoice_id", sql.Int, arInvoiceId)
      .execute("SP_RPT_AR_INVOICE_ADDTIONAL_INFOMATION"),
  ]);

  const lines = main.recordsets?.[0] ?? [];
  const aggregates = summary.recordsets?.[0]?.[0] ?? null;

  const pdf = await renderToBuffer(<InvoiceDocument lines={lines} aggregates={aggregates} />);
  return new NextResponse(pdf, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="invoice-${arInvoiceId}.pdf"`,
    },
  });
}
```

This collapses the current "open invoice in WPAdmin → wait for Crystal Viewer → File → Export → PDF" multi-click chore into one click in laportal. The PDF either streams to the browser for inline preview or downloads, depending on the `Content-Disposition` header.

## 7. How to verify before building

Before laportal commits to this path, one quick verification:

1. From laportal's existing intranet box, run `EXEC SP_RPT_AR_INVOICE @invoice_id=N, @end_invoice_id=N, @agency_id=0, @use_date=0, @con_start_date='', @con_end_date=''` for a known Pierce invoice ID.
2. Sanity-check the row count and column values against the same invoice viewed in WPAdmin (Crystal-rendered version).
3. Compare to the recovered proc body in [`../proc-bodies/SP_RPT_AR_INVOICE.sql`](../proc-bodies/SP_RPT_AR_INVOICE.sql) — confirm any branch-specific behavior (the NMRPP view branch vs the standard branch) matches what Pierce sees.

If the row-set matches, the laportal-native PDF path is on solid ground.
