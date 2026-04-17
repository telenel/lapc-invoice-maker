# Prism Database — Schema Reference & Capability Map

**Generated:** 2026-04-17 (from live winprism-la)
**Source data:** `docs/prism/raw/inventory.json` (2.4 MB — raw metadata dump)
**Regenerate with:** `npx tsx scripts/discover-prism-full.ts` (intranet only)

---

## TL;DR — the shape of the database

| Surface | Count |
|---|---:|
| Tables | **962** |
| Stored procedures | **4,654** |
| Views | **1,472** |
| Functions (scalar, inline, table-valued) | **210** |
| Triggers | **475** |
| Foreign keys | **517** |
| Unique / primary indexes | **897** |
| Columns (total across all tables) | **7,927** |
| Biggest single table | `Transaction_Detail` — **35.9 M rows** |
| **Encrypted procs** | **2** (see below) |

**This is enterprise ERP scale.** It covers point-of-sale, inventory, accounting, textbook adoption/rental/buyback, vendor ordering (EDI/X12), web integration, apparel sizing matrices, rentals, bundles, currency, and a vast reporting surface. Treat every domain as potentially in-scope for future work.

---

## 🔑 Key findings from the mapping pass

1. **Only 2 procs are technically `is_encrypted=1`**: `P_DecryptHub` and `SP_MOConvertShipping`. But `pdt` also **lacks `VIEW DEFINITION`** permission on everything else, so in practice **all 4,654 procs are opaque to us** — we can EXECUTE them, but we can't read the SQL source. `OBJECT_DEFINITION(...)` returns NULL; `sp_helptext` errors. Verified via `HAS_PERMS_BY_NAME` on this account.

   Practical implications:
   - When investigating a proc, we can black-box it: call with test params, observe outputs + side effects.
   - To inspect source we'd need LACCD IT to grant `GRANT VIEW DEFINITION TO pdt` (or a new account with that grant). Worth asking for — it would massively accelerate any future feature work.
   - We can still infer behavior from `sys.parameters` (param names + types + defaults), execution results, trigger side effects, and by reading the public-facing WinPRISM UI.

2. **`pdt`'s effective permissions don't match the visible role model.** Verified state (via `HAS_PERMS_BY_NAME` + `IS_ROLEMEMBER`):

   | Check | Result |
   |---|---|
   | Login / user | `pdt` / `pdt` |
   | `is_sysadmin` | 0 |
   | In `db_owner` / `db_datareader` / `db_datawriter` | No, no, no |
   | `VIEW ANY DEFINITION` | Denied |
   | `SELECT` on `Item` | **Granted** |
   | `EXECUTE` on `P_Item_Add_GM` | **Granted** |
   | `sys.database_permissions` rows for pdt | 1 (just `CONNECT`) |

   The SELECT/EXECUTE grants are **not visible** in `sys.database_permissions`. Likely mechanism: schema-level grants or ownership chaining through an application role. Whatever the plumbing, the practical posture is: **assume read + write + execute work on business tables and procs; don't assume source visibility**.

3. **Transaction history is massive** — `Transaction_Detail` alone is 35.9 M rows; associated tables add another ~150 M+. Any analytics / reporting feature has years of data to draw from. But queries that scan these tables need to be index-aware.

4. **`Acct_*` is the largest table prefix (100 tables)** — accounting is the biggest domain by table count. Second is `POS` (53), then `XDoc` (document management, 34). By **proc** count, reporting dwarfs everything: **~1,873 procs** between the `SP_Rpt*`, `Rpt_*`, `RPT_*` prefixes.

5. **Only `P_Item_Add_GM` exists as a "one-shot create" for catalog items.** No `P_Item_Update_*` or `P_Item_Delete_*` — matches what we already built (direct UPDATE/DELETE with trigger workarounds).

---

## How to use this reference

- **This doc is an index**, not an exhaustive table-by-table catalog. For that, `docs/prism/raw/inventory.json` has every table, column, proc, view, function, trigger, FK, and index.
- When you're about to touch a specific domain, read the relevant section here first to know the shape, then drill into the raw JSON (or query Prism directly) for exact column types.
- Regenerate the raw dump whenever the schema may have changed (new WinPRISM release, etc.) — the discovery script is idempotent and read-only.

### Drill-down patterns

```bash
# Every proc whose name contains "Invoice"
node -e 'const r=require("./docs/prism/raw/inventory.json"); console.log(r.procedures.filter(p=>/invoice/i.test(p.proc_name)).map(p=>p.proc_name).join("\n"))'

# Every table under the "Acct_" prefix, sorted by row count
node -e 'const r=require("./docs/prism/raw/inventory.json"); const t=r.tables.filter(t=>t.table_name.startsWith("Acct_")).map(t=>({...t,row_count:Number(t.row_count)})).sort((a,b)=>b.row_count-a.row_count); for(const x of t) console.log(x.table_name.padEnd(45),x.row_count.toLocaleString())'

# Foreign keys pointing into Item
node -e 'const r=require("./docs/prism/raw/inventory.json"); console.log(r.foreignKeys.filter(f=>f.parent_table==="Item").map(f=>`${f.child_table}(${f.child_cols}) -> Item(${f.parent_cols})`).join("\n"))'
```

### Investigating a proc (without source access)

`pdt` lacks `VIEW DEFINITION`, so `OBJECT_DEFINITION(...)` returns NULL and `sp_helptext` errors. Investigate black-box:

```sql
-- 1. Parameter shape
SELECT p.parameter_id, p.name, TYPE_NAME(p.user_type_id) AS type_name,
       p.max_length, p.is_output, p.has_default_value
FROM sys.parameters p
WHERE p.object_id = OBJECT_ID('SP_ARCreateInvoiceHdr')
ORDER BY p.parameter_id;

-- 2. Inferred read/write dependencies (what tables the proc touches)
-- Requires VIEW DEFINITION; won't work from pdt — use sys.dm_sql_referenced_entities
-- via a sysadmin session if you have one, otherwise skip.

-- 3. Triggers on related tables — often reveal the business rules the proc
-- is expected to cooperate with
SELECT OBJECT_NAME(parent_id) AS parent, name, is_instead_of_trigger
FROM sys.triggers
WHERE OBJECT_NAME(parent_id) = 'Acct_ARInvoice_Header';
```

Then execute the proc against a **read-only transaction** and roll back, or against a scratch record, to see what it actually does. This is slower than reading source but it works.

If source access becomes blocking, ask LACCD IT for `GRANT VIEW DEFINITION TO pdt` — low-risk grant that unblocks a huge amount of engineering.

---

## Domain taxonomy

Grouped by the first underscore segment of the table / proc name. Counts are **tables / procs / views** for each group.

### Core commerce domains

| Domain | Tables | Procs | Highlights |
|---|---:|---:|---|
| **Acct** | 100 | 29 | Accounting master — `Acct_Agency`, `Acct_Chart_Accounts`, `Acct_ARInvoice_Header`/`Detail` (4.9M rows), `Acct_Tran_Reg_Header`. Invoicing, GL posting, customer agencies. |
| **POS** | 53 | 254 | Point-of-sale engine — registers, sessions, operator stations, drawer activity. Paired with `Transaction_*` for actual sales data. |
| **Transaction** | 17 | — | Transactional facts: `Transaction_Header` (16.5M), `Transaction_Detail` (35.9M), `Transaction_Tender`, `Transaction_Tax_Detail`. This is the POS data lake. |
| **Item** | 7 | 8 | Item master: `Item`, `ItemMaster`, `ItemHistory` (3.3M), `Item_Tax_Type`, `ItemSerial`. |
| **GeneralMerchandise** | — | — | Sits under `Item`; GM-specific attributes. |
| **Inventory** | few | many | Per-location stock + pricing. `Inventory`, `Inventory_Sales_History` (may be empty on this install). |
| **DCC** | 8 | 7 | Department / Class / Category hierarchy. Primary lookup is `DeptClassCat`. |
| **Vendor** | 14 | 1 | `VendorMaster` + related. |
| **Location** | 5 | 9 | Store / location master — 17 locations district-wide. |
| **Tender** | 7 | 1 | Payment methods — cash, credit, SAP, etc. |
| **Tax** | 8 | 3 | Tax types / rates. |
| **Discount** | 4 | 2 | Discount codes / programs. |
| **Catalog** | 11 | 8 | Catalog management (public-facing categorization). |
| **Customer** | 4 | — | Customer master — 1.6M `Customer_Address` rows. |

### Textbook-specific

| Domain | Tables | Procs | Highlights |
|---|---:|---:|---|
| **Buyback** | 29 | 33 | Textbook buyback — offers, sessions, special barcodes. |
| **Rental** | 18 | 59 | Textbook rental — periods, returns, refunds. |
| **Adoption** | few | few | Course adoption (textbook selection by faculty) — spread across `Adoption*` and `Request*` tables. |
| **Catalog (textbook variant)** | under `Catalog` | | Contains textbook-catalog shape too. |

### Purchasing & receiving

| Domain | Tables | Procs | Highlights |
|---|---:|---:|---|
| **PO** | 11 | 27 | Purchase orders — `PO_Detail` (the one history table we confirmed exists on this install). |
| **MR** | 7 | 16 | Merchandise Receiving — inbound shipment processing. |
| **MO** | 19 | 72 | Merchandise Orders / Manufacturer Orders — 19 tables, 72 procs. Bigger than PO. |
| **RCV** | — | 28 | Receiving procs. |
| **AP** | — | 77 | Accounts Payable procs — vendor invoice posting, check runs. |
| **Stock** | 5 | — | `Stock_Adjustment_Table` has 14.6M rows — inventory movement history. |

### Integration / external systems

| Domain | Tables | Procs | Highlights |
|---|---:|---:|---|
| **EDI** | 31 | 61 | Electronic Data Interchange — vendor order/ASN/invoice exchange. |
| **X12** | 16 | — | ANSI X12 EDI format tables. |
| **Web** | 22 | 68 | Web-integration tables + procs. `Web_Transfer_History` has 8.5M rows. `SP_Web_Import_Receipt` lives here conceptually. |
| **Thunder** | 3 | 44 | **Unknown third-party integration.** 44 procs + 27 views with `Thunder` prefix. Likely a receipt-printing / e-receipt system (`ThunderReceiptTemplate`). Worth a dedicated investigation. |
| **Pubnet** | 7 | 49 | PubNet textbook catalog service (Ingram? Baker & Taylor?) — 49 procs suggests heavy use. |
| **EDI / Pubnet / X12 / PDA** — these are all the "outside Prism" data sources. |

### Apparel / style

| Domain | Tables | Procs | Highlights |
|---|---:|---:|---|
| **Style** | 11 | 18 | Size matrix parent — e.g. one "shirt" has many SKUs by size/color. |
| **Matrix** | 5 | 6 | Size × color cross-reference. |
| **Bundle** | 3 | 12 | Bundle pricing (e.g., "book + pen + notebook" combo). |
| **PKG** | — | 17 | Package deals. |
| **Buyers** | 7 | — | Apparel/style buyer master. |

### Reporting (by far the biggest proc surface)

| Prefix | Procs | Notes |
|---|---:|---|
| `SP_Rpt*` | ~1,640 | Server-generated reports. Enormous variety: sales, inventory, AP, GL, tax, buyback, rental, customer... |
| `Rpt_*` | 142 | Client-accessible report helpers. |
| `RPT_*` | 117 | Higher-level report procs. |
| `SP_Report*` | few | Additional reporting. |

Reporting is where most of Prism's intelligence lives. Nearly every business question ("what did we sell last week", "which textbooks were rented most often", "what's our buyback performance") has an existing proc — we just haven't discovered them yet. Pattern: `node -e "..."` filter on proc names matching the question.

### Other

| Domain | Tables | Procs | Highlights |
|---|---:|---:|---|
| **AR** | — | 92 | Accounts Receivable procs — invoice creation, payment posting. |
| **GL** | — | 31 | General Ledger posting. |
| **MO** | 19 | 72 | Merchandise orders. |
| **MT** | 7 | 21 | Something-with-a-"MT"-prefix — likely marketing or message tables. |
| **Purge** | 1 | 27 | Data retention — `PurgeStatistics` (5.8M rows). |
| **EDI / X12 / Pubnet / Thunder** | above | above | Third-party integration. |
| **XDoc** | 34 | 137 | Document management — invoice PDFs, receipt images, etc. |
| **XDOC** | 3 | 137 | Alias set for XDoc, apparent duplication. |
| **Currency** | 4 | 4 | Multi-currency support. |
| **Cash** | 4 | — | Cash drawer management. |
| **Store / System** | few | 15 | System config tables. |
| **Serial** | 4 | 8 | Serial-numbered items (electronics). |
| **Markdown** | 8 | 12 | Price markdowns. |

---

## Top 20 tables by row count

These are the tables where reporting-level queries will hit performance. Indexes are annotated in `inventory.json` under `uniqueIndexes`.

| Table | Rows | Notes |
|---|---:|---|
| `Transaction_Detail` | 35,947,002 | POS line items. The firehose. |
| `Transaction_Detail_Tender` | 35,857,898 | Tender per line. |
| `Transaction_Tax_Detail` | 31,700,270 | Tax per line. |
| `TransactionTaxTenderDetail` | 29,595,646 | Tax×tender cross. |
| `Transaction_Dtl_Discount` | 25,086,090 | Discounts per line. |
| `Transaction_Header` | 16,524,983 | Transaction-level (one per sale). |
| `Transaction_Tax` | 16,149,862 | Transaction-level tax. |
| `Transaction_Tender` | 15,849,066 | Transaction-level tender. |
| `Stock_Adjustment_Table` | 14,626,300 | Every inventory movement. |
| `Web_Transfer_History` | 8,519,085 | Web integration audit. |
| `PurgeStatistics` | 5,793,766 | Data-retention metrics. |
| `SalesHistoryDetail` | 4,968,952 | Aggregated sales. |
| `Acct_ARInvoice_Detail` | 4,959,907 | Invoice line items. |
| `Transaction_Tender_Adtnl` | 3,979,220 | Extended tender. |
| `ItemHistory` | 3,324,706 | Item metadata history. |
| `ForecastItemSalesByWeek` | 2,417,448 | Forecasting. |
| `Customer_Address` | 1,620,017 | CRM. |
| `Transaction_Signature` | 1,518,762 | Signed receipts. |
| `ForecastStaticCurves` | 1,246,692 | Forecasting. |
| `Acct_Agency_Customer` | 1,188,317 | Agency ↔ customer links. |

Tables we've previously interacted with (`Item` ~195k, `GeneralMerchandise`, `Inventory` etc.) don't make this top 20 — the system's value is in the transaction history, not the catalog size.

---

## Source visibility

All 4,654 procs are opaque to us in practice:

- **2 are `is_encrypted=1`**: `P_DecryptHub` (probably a decryption helper for encrypted-column data) and `SP_MOConvertShipping` (merchandise-order shipping conversion). Source would be unreadable to anyone.
- **The other 4,652 are "readable but not to `pdt`"** — they have source on disk, but `pdt` lacks `VIEW DEFINITION` to see it. A sysadmin account or a grant would unlock them.

Black-box investigation flow works fine for one-off questions. For deeper reverse-engineering (e.g., building a combined-invoice feature that mirrors `SP_ARCreateInvoiceHdr`'s exact side effects), consider asking LACCD IT for `GRANT VIEW DEFINITION TO pdt`.

---

## Capability matrix (what we can do in each domain)

### ✅ Items & inventory
- **Shipped** in laportal: create/edit/batch GM items, discontinue, hard-delete with history guard.
- **Available**: textbook-specific creation (need to discover the `Textbook` table's add proc or write direct INSERT), bundle creation (`Bundle*` procs), matrix/style creation (`E_CreateItemsFromStyle`).
- **Reports** on items: 1,640+ `SP_Rpt*` procs. Best bet when asked "find the proc that gives me X report" — grep proc names.

### ✅ AR invoicing
- **Investigated, not built**: pipeline is `SP_Web_Import_Receipt` → `SP_ARCreateInvoiceHdr` → `SP_ARCreateInvoiceDtl`.
- **Readable source** — can inspect those procs to learn the exact param shape + flow.
- **Historical data**: 4.9 M invoice-detail rows. Any "invoice X looked like this" lookup is trivial.

### ✅ POS transaction queries
- Historical sales data is complete (35.9 M details). Useful for analytics, not for writing (writes come from POS terminals, not from laportal).
- **Read-only is the right posture here** — don't write to `Transaction_*`; those are produced by the POS engine.

### ✅ Customers & accounts
- **Investigated, not built**: `Acct_Agency` direct INSERT pattern for new accounts; `SP_POS_ARCustomer_AddAgency` for customer linkage. See `reference_prism_account_creation.md`.
- **1.6 M `Customer_Address` rows** — CRM-level data is there.

### ✅ Textbooks (adoption / rental / buyback)
- **Not yet touched in laportal.** Substantial surface: 29 Buyback tables, 18 Rental tables, 33 Buyback procs, 59 Rental procs.
- Adoption workflow is probably the biggest user-facing win — faculty selection → ordering via PO → shelving.

### ✅ Purchasing (PO, MR, MO)
- **Not yet touched.** `SP_POUpdateItem` / `SP_MRUpdateItem` are the receiving-flow procs. Different from item-master updates — these update line items on a specific PO or MR document.

### ✅ Apparel / Style / Matrix / Bundle
- **Not yet touched.** `Style` = parent, `Matrix` = size×color grid, individual SKUs under the parent. `E_CreateItemsFromStyle` is the proc that expands a style into SKUs.

### ✅ Reporting (1,873 procs)
- Effectively anything reportable through WinPRISM's UI is a proc we can call. Pattern: find the proc, call it, render results in laportal.
- **High ROI feature area** — most business questions have existing procs; just need to wire up the laportal UI.
- Reverse-engineering proc params (via `sys.parameters`) is usually enough to know how to call them even without source visibility.

### ❌ What we *can't* do
- Modify schema (no DDL — we don't own the DB)
- Enable SQL Agent jobs, CLR assemblies, linked servers, xp_cmdshell — all require sysadmin we don't have
- **Read proc source** (`pdt` lacks `VIEW DEFINITION` — ask LACCD IT to grant it if we need deep reverse-engineering)
- Bypass the Item-table triggers (which break `@@ROWCOUNT`)

---

## Per-domain deep-dive pointers

When you're about to build a feature in a specific area, start here:

### Item catalog → `Item`, `ItemMaster`, `GeneralMerchandise`, `Textbook*`, `Inventory`
- Already documented: `src/domains/product/prism-server.ts`, `prism-updates.ts`, `prism-delete.ts`, `prism-batch.ts`
- Column detail: raw JSON `columns` key, filter `table_name` for these
- Note: `ItemMaster` is ~195k rows sibling to `Item`; not yet explored — may have extra metadata worth mirroring

### Invoicing → `Acct_ARInvoice_Header`, `Acct_ARInvoice_Detail`, `Acct_Tran_Reg_Header`, `SP_ARCreate*`, `SP_Web_Import_Receipt`
- Reference: `reference_prism_ar_invoice_flow.md` in auto-memory
- Inspect source: `OBJECT_DEFINITION(OBJECT_ID('SP_ARCreateInvoiceHdr'))` before designing a UI

### Account creation → `Acct_Agency`, `Acct_Agency_Customer`, `SP_POS_ARCustomer_AddAgency`
- Reference: `reference_prism_account_creation.md` in auto-memory
- Note: 1.18 M rows in `Acct_Agency_Customer` — significant customer linkage data

### Textbook adoption / rental / buyback
- **New territory.** Start by grepping proc names: `adoption`, `request`, `buyback`, `rental`, `isbn`
- 29 Buyback tables + 33 procs = mature system; there's a "session" concept (per-buyback event)
- 18 Rental tables + 59 procs = even more mature; period-based returns

### EDI / vendor ordering
- **New territory.** 31 EDI tables + 61 procs + 16 X12 tables. Likely integrates with PubNet (49 procs).
- Pattern to look for: `*_Inbound` / `*_Outbound` tables for transaction lifecycle

### Thunder (unknown third-party)
- **Worth investigating.** 3 tables, 44 procs, 27 views. Given `ThunderReceiptTemplate` naming, probably electronic receipts / receipt printing.
- First step: `SELECT TOP 10 * FROM <one of the Thunder tables>` to see shape

### Reporting
- Grep proc names for the topic. Most procs take simple inputs (date range, location, DCC) and return a single recordset.
- Pattern for laportal integration: exec the proc, return the recordset as JSON to a report page.

---

## What's NOT in this reference

- Column types for every table (too big — use raw JSON with name-filtered queries)
- Full proc source (pull on demand via `OBJECT_DEFINITION`)
- Historical data volumes by date range (requires live query against `Transaction_*`)
- LACCD-specific data like course codes, term dates, academic years (those are PrismCore concepts and may live in a separate database or in tables we haven't grouped yet)
- The `PrismCore` web frontend — that's a separate product; this doc covers only the SQL layer

---

## Suggested next discovery passes

Ranked by likely value-per-effort:

1. **Dump the source for ~20 key procs** (`P_Item_Add_GM`, `SP_ARCreateInvoiceHdr`, `SP_ARCreateInvoiceDtl`, `SP_Web_Import_Receipt`, `SP_POUpdateItem`, `SP_MRUpdateItem`, key `Buyback*` and `Rental*` procs) into `docs/prism/procs/*.sql` so they're version-controlled and searchable.
2. **Textbook domain investigation** — map `Adoption*`, `Request*`, `Rental*`, `Buyback*` tables and their procs. This is the biggest un-touched surface for future features.
3. **Find the `SP_Rpt*` list for our common questions** — any report WinPRISM already produces is one proc call away from being a laportal page.
4. **Thunder investigation** — figure out what this third-party integration is; it's heavily used (44 procs).
5. **Cross-database check** — `USE master; SELECT name FROM sys.databases;` to see if PrismCore / LACCD-specific data lives in a sibling database.

---

**Maintenance:** this doc is hand-written summary over an auto-generated raw JSON. When WinPRISM is upgraded, re-run `discover-prism-full.ts` and revisit any count-sensitive sections of this doc. The raw JSON should be committed alongside so we can diff schema changes over time.
