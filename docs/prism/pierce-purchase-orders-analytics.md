# Pierce Purchase Orders — Analytics (2026-04-26)

Read-only analytics on the Accounts Payable / Purchase Order domain at Pierce, district-wide WinPRISM SQL Server. Pierce filter: a PO is "Pierce" if any of its `PO_Detail` rows has a `PO_Location` row with `LocationID IN (2, 3, 4)` (PIER, PCOP, PFS). Source: [`scripts/probe-prism-pierce-purchase-orders.ts`](../../scripts/probe-prism-pierce-purchase-orders.ts).

## TL;DR

- **17,129 Pierce POs all-time** since 2011-05-03 — the first one is older than the WPAdmin install date, suggesting POs were imported from a predecessor system.
- **1,167 Pierce POs in the last 12 months** (about 23 per week).
- **2 active Pierce buyers** account for **74.5%** of recent volume: **Stella Badalyan (SUID 911)** and **Michael Matsumoto (SUID 191)**.
- **Pipeline is healthy**: ~98% of POs get received, ~93–96% get an AP-side vendor invoice booked against them. Receive lag averages 17 days; 80% receive within 30 days.
- **Last-5-year Pierce spend: $6.74M** across 5,165 POs and 11,624 line items. Average PO is ~9 lines and ~$1,305.
- **Vendor mix has shifted dramatically** — historical top vendors were textbook publishers; the current mix is dominated by Amazon, food service (Corner Bakery, Costco, Pepsi, Coca-Cola), and digital textbook platforms (Redshelf at #1 by spend over 5 years).
- **Auto-PO generation exists** (`P_AutogenPOScheduled`) but has fired only 4 times recently — Pierce purchasing is overwhelmingly manual.
- **Marcos (SUID 865) has 1 Pierce PO** in the last 12 months (2025-09-04) — confirming his minimal involvement in this domain.

## 1. Volume and trend

### POs by year (Pierce)

| Year | POs | Notes |
|---:|---:|---|
| 2026 (YTD) | 364 | Through Apr 23; on pace for ~1,150 |
| 2025 | 1,158 | Stable |
| 2024 | 1,208 | Stable |
| 2023 | 1,176 | Stable |
| 2022 | 840 | Recovery from pandemic |
| 2021 | 551 | **Pandemic trough** |
| 2020 | 814 | Pandemic dip |
| 2019 | **1,522** | All-time peak |
| 2018 | 1,172 | |

Pre-2018 data is sparse (cumulative ~7,000 POs spread across 2011–2017, mostly from Holly Hagan, Chara Coleman-Roberts, and other long-departed buyers).

### Monthly seasonality (Pierce, last 12 months)

| Month | POs | |
|---|---:|---|
| 2025-04 | 14 | (partial — earliest in window) |
| 2025-05 | 122 | Pre-summer ordering |
| 2025-06 | 64 | Summer slowdown |
| 2025-07 | 65 | Summer slowdown |
| 2025-08 | 102 | Back-to-school ramp |
| **2025-09** | **150** | **Peak — fall semester start** |
| 2025-10 | 129 | High |
| 2025-11 | 79 | Cooling |
| 2025-12 | 78 | Holiday slowdown |
| 2026-01 | 110 | Spring semester ramp |
| 2026-02 | 103 | Stable |
| 2026-03 | 120 | Peak spring |
| 2026-04 | 31 | (partial through Apr 23) |

Clear academic-calendar signal: peak at semester starts (September, secondary peak in May for summer prep + January for spring), troughs in summer break and December.

### PO status distribution (Pierce, last 5 years)

| `fStatus` | Description | Count | % |
|---:|---|---:|---:|
| 2 | **Closed** | **5,013** | **97.1%** |
| 1 | Open | 99 | 1.9% |
| 0 | Proposed | 49 | 0.9% |
| 5 | (anomalous — not in `PO_Status` lookup) | 3 | 0.06% |
| 4 | (anomalous — not in `PO_Status` lookup) | 1 | 0.02% |

97% of Pierce POs end up Closed — strong evidence that POs are followed through end-to-end, not abandoned. The 4 statuses 4/5 are anomalies worth investigating (could be data corruption or a custom status not in the lookup table).

## 2. Who creates Pierce POs

### Last 30 days (most current)

| User | UserID | UserName | POs | Pierce employee? |
|---|---:|---|---:|---|
| **Michael Matsumoto** | 191 | `1274` | **17** | ✅ Yes |
| **Stella Badalyan** | 911 | `STELLA` | **15** | ✅ Yes |
| Nenita | 864 | `2019` | 5 | (other LACCD) |
| Tovmas Anumyan | 1032 | `TANUMYAN` | 3 | (other LACCD) |

Only **4 distinct users** created any Pierce PO in the last 30 days. Pierce's two staff buyers handled 80% (32 of 40) of recent activity.

### Last 12 months

| User | UserID | UserName | POs | Pierce employee? |
|---|---:|---|---:|---|
| **Stella Badalyan** | 911 | `STELLA` | **555** | ✅ Yes |
| **Michael Matsumoto** | 191 | `1274` | **315** | ✅ Yes |
| Nenita | 864 | `2019` | 185 | (other LACCD) |
| Tovmas Anumyan | 1032 | `TANUMYAN` | 74 | (other LACCD) |
| Grigor Hogikyan | 185 | `Hogikg` | 24 | (other LACCD) |
| Candy Van | 184 | `1142` | 12 | (other LACCD) |
| Maged Khalil | 962 | `2023` | 1 | (other LACCD) |
| **Marcos Montalvo** | **865** | **`2020`** | **1** | ✅ You — created 2025-09-04 |

Eight distinct users, but the top two — both confirmed Pierce employees — own **870 of 1,167 POs (74.5%)**.

The remaining ~30% of Pierce-touching POs come from non-Pierce LACCD staff. These are likely cross-campus orders that include Pierce as one of multiple delivery locations on a shared PO.

### All-time top creators with Pierce activity (20 users ever)

| Rank | User | UserID | POs | Last activity | Status |
|---:|---|---:|---:|---|---|
| 1 | Chara Coleman-Roberts | 190 | 2,508 | 2024-12-16 | Departed (likely) |
| 2 | Gabriela Moreno | 197 | 2,393 | 2022-09-02 | Departed |
| 3 | Holly Hagan | 194 | 2,352 | 2021-09-01 | Departed |
| 4 | **Michael Matsumoto** | **191** | **2,090** | **2026-04-23** | ✅ **Active Pierce** |
| 5 | **Stella Badalyan** | **911** | **1,729** | **2026-04-15** | ✅ **Active Pierce** |
| 6 | Juan Catalan | 193 | 1,117 | 2017-02-09 | Departed |
| 7 | Arsen Abramian | 195 | 844 | 2021-07-13 | Departed |
| 8 | Nenita | 864 | 788 | 2026-04-13 | Active (other LACCD) |
| 9 | Candy Van | 184 | 735 | 2026-03-26 | Active (other LACCD) |
| 10 | Shant Varozian | 198 | 680 | 2016-05-31 | Departed |
| 11 | Nettie Ann Corbin Johnson | 716 | 615 | 2022-03-25 | Departed |
| 12 | Grigor Hogikyan | 185 | 256 | 2026-03-16 | Active (other LACCD) |
| 13 | Mario Juarez | 607 | 239 | 2016-11-15 | Departed |
| 14 | Pame Holmes | 196 | 219 | 2013-02-26 | Departed |
| 15 | Danny Illouz | 938 | 211 | 2023-07-13 | Departed |
| 16 | Valorie Marie Smith-Harris | 715 | 162 | 2019-03-12 | Departed |
| 17 | Tovmas Anumyan | 1032 | 91 | 2026-04-20 | Active (other LACCD) |
| 18 | Renu Gupta | 224 | 40 | 2023-11-06 | Departed |
| 19 | (UserID 0) | 0 | 19 | 2017-06-09 | **Anomaly — orphan rows with no UserID** |
| 20 | Bryan Coronado | 961 | 10 | 2024-08-02 | Departed |

A short-tail distribution: ~10 historical buyers contributed >700 POs each, while only 2 are still active. The 19 POs attributed to `UserID = 0` are a data-quality anomaly worth a one-line follow-up — likely failed user lookups during a migration.

### Stella Badalyan (SUID 911) — profile

| Metric | Value |
|---|---:|
| Pierce POs all-time | **1,729** |
| First Pierce PO | 2023-01-11 |
| Most recent | 2026-04-15 |
| Last 12 months | 555 |
| Last 30 days | 15 |
| Closed | 1,721 |
| Open | 2 |
| Proposed | 6 |

**Close rate: 99.5%** — extraordinarily clean PO lifecycle hygiene. Stella started January 2023 and has been the dominant Pierce buyer since.

### Michael Matsumoto (SUID 191) — profile

| Metric | Value |
|---|---:|
| Pierce POs all-time | **2,090** |
| First Pierce PO | 2014-04-15 |
| Most recent | 2026-04-23 |
| Last 12 months | 315 |
| Last 30 days | 17 |
| Closed | 1,983 |
| Open | 87 |
| Proposed | 20 |

12 years tenure on Pierce POs. Pierce's institutional memory for purchasing — does roughly half of Stella's recent volume but covers different categories (the open + proposed counts of 87/20 vs Stella's 2/6 suggests Michael handles longer-cycle or special-order POs that don't close as quickly).

## 3. Vendors

### Top vendors by PO count (Pierce, all-time)

| Rank | Vendor | POs | Category |
|---:|---|---:|---|
| 1 | **FED EX** (3004171) | 1,030 | Shipping/courier |
| 2 | PEARSON EDUCATION (3002659) | 735 | Textbook publisher |
| 3 | WORLDWILD EXPRESS (3012187) | 576 | Shipping |
| 4 | NEBRASKA BOOK COMPANY (3001691) | 550 | Textbook wholesaler |
| 5 | CENGAGE LEARNING (3002411) | 537 | Textbook publisher |
| 6 | CORNER BAKERY CAFE (3000497) | 473 | Food service |
| 7 | PENS ETC (3001795) | 463 | Office supplies |
| 8 | MPS (3002300) | 454 | Textbook fulfillment |
| 9 | INDICO/NACS (3001653) | 452 | Textbook wholesaler |
| 10 | OFFICE DEPOT (3001749) | 410 | Office supplies |
| 11 | AMAZON (3010096) | 363 | General merch |
| 12 | PEPSI (3002441) | 357 | Beverages |
| 13 | REYES COCA-COLA (3000711) | 332 | Beverages |
| 14 | W.W.NORTON (3002302) | 324 | Textbook publisher |
| 15 | MCGRAW HILL EDUCATION (3002512) | 323 | Textbook publisher |

### Top vendors by PO count (Pierce, last 12 months)

| Rank | Vendor | POs | Notes |
|---:|---|---:|---|
| 1 | **AMAZON (3010096)** | **146** | Now the #1 PO source |
| 2 | CORNER BAKERY CAFE | 92 | Cafe operations |
| 3 | WORLDWILD EXPRESS | 51 | Shipping |
| 4 | COSTCO | 50 | Bulk goods |
| 5 | FED EX | 43 | Shipping |
| 6 | A & A WEST COAST DISTRIBUTION | 40 | |
| 7 | KENNEDY WHOLESALE | 33 | |
| 8 | YERBA MATE CO. | 33 | Beverages |
| 9 | PEPSI | 32 | Beverages |
| 10 | MKS LOUNGE INC | 28 | |
| 11 | BERRY MAN INC | 27 | |
| 12 | PARTNERSHIP | 26 | |
| 13 | ONPOINT SALES & MARKETING | 25 | |
| 14 | **REDSHELF (3016380)** | **25** | **Digital textbooks** |
| 15 | OFFICE DEPOT | 23 | |
| 16 | PENS ETC | 20 | |
| 17 | THIRD CROP LLC | 20 | |
| 18 | 7-UP | 18 | |
| 19 | PEARSON EDUCATION | 18 | (down from 735 historical) |
| 20 | S DE ZILWA / PIZZA EFFECT | 17 | Food service |

### The shift visible in vendor mix

Compare 2014–2018 (peak Pearson era) to 2025–2026:

| Vendor | All-time POs | Last-12m POs | Trend |
|---|---:|---:|---|
| Pearson Education | 735 | 18 | **↓ 96% ** |
| Cengage Learning | 537 | (none in top-25) | **↓ to near-zero** |
| McGraw Hill | 323 | (none in top-25) | **↓ to near-zero** |
| W.W. Norton | 324 | 13 | ↓ 90% |
| John Wiley | 193 | (none in top-25) | ↓ to near-zero |
| Nebraska Book | 550 | (none in top-25) | ↓ to zero (2022 last activity) |
| MPS | 454 | 12 | ↓ 90% |
| Amazon | 363 | 146 | **↑ 4x** to top spot |
| Redshelf | 25 (recent only) | 25 | New category |
| Corner Bakery | 473 | 92 | Stable |
| Costco | (low historical) | 50 | New category |

**The textbook business at Pierce has nearly evaporated through traditional publishers** — replaced by digital platforms (Redshelf) and Amazon. The remaining bookstore PO volume is dominated by **food/beverage operations and general merchandise**, not textbooks.

### Top vendors by 5-year spend (Pierce)

This is the dollar-value picture, computed as `SUM(PO_Detail.Cost × PO_Detail.TotalQty)` for the line items on Pierce-flagged POs:

| Rank | Vendor | 5y Spend | Lines | Notes |
|---:|---|---:|---:|---|
| 1 | **REDSHELF** | **$436,099.62** | 1,447 | Digital textbook reseller |
| 2 | PEARSON EDUCATION | $373,072.57 | 396 | Despite low PO count, big-ticket items |
| 3 | OMNICARD / Black Hawk Network | $290,917.80 | 65 | Gift cards (high $/PO) |
| 4 | LAD CUSTOM PUBLISHING | $259,015.65 | 193 | Custom course materials |
| 5 | BAMKO / PUBLIC IDENTITY | $242,807.01 | 189 | Promotional/branded merchandise |
| 6 | PEARSON CUSTOM | $219,966.36 | 27 | High-value custom publishing |
| 7 | KENNEDY WHOLESALE | $199,749.48 | **12,877** | Tons of small items (snacks?) |
| 8 | VAE INDUSTRIES | $186,028.40 | 220 | |
| 9 | MPS | $182,285.13 | 209 | |
| 10 | CENGAGE LEARNING | $180,479.45 | 170 | |
| 11 | CORNER BAKERY CAFE | $175,875.30 | 1,397 | |
| 12 | JOHN WILEY & SONS | $171,372.10 | 150 | |
| 13 | SUBWAY (Vikram Singh) | $168,539.88 | 179 | Cafe vendor |
| 14 | AMAZON | $159,135.62 | 1,529 | High volume, lower per-line |
| 15 | W.W. NORTON | $145,628.65 | 268 | |
| 16 | OFFICE DEPOT | $144,795.33 | 1,129 | |
| 17 | MCGRAW HILL | $144,154.23 | 153 | |
| 18 | PENS ETC | $141,279.34 | 5,462 | Lots of small office supplies |
| 19 | VISTA HIGHER LEARNING | $132,430.65 | 32 | |
| 20 | COSTCO | $116,396.03 | 2,117 | |

Total Pierce 5-year spend captured: **$6,741,397**, ~$1.35M/year average.

Notable: Kennedy Wholesale and Pens Etc both have huge line counts (12,877 and 5,462) but moderate dollar totals — they're penny-per-pencil suppliers. Conversely, OmniCard at 65 lines but $291k means each line is gift cards (~$4,500 per line).

## 4. Pipeline efficiency (PO → Receive → Invoice)

### By year, Pierce

| Year | POs Created | Received | Receive Rate | Invoiced | Invoice Rate |
|---:|---:|---:|---:|---:|---:|
| 2026 (YTD) | 364 | 352 | **96.7%** | 328 | **90.1%** |
| 2025 | 1,158 | 1,140 | 98.4% | 1,081 | 93.4% |
| 2024 | 1,208 | 1,192 | **98.7%** | 1,159 | 95.9% |
| 2023 | 1,176 | 1,162 | **98.8%** | 1,148 | **97.6%** |
| 2022 | 840 | 824 | 98.1% | 800 | 95.2% |
| 2021 | 419 | 403 | 96.2% | 384 | 91.6% |

**Receive rates: 96–99%. Invoice rates: 90–98%.** This is excellent operational discipline. The drop in 2026 figures is the natural in-progress lag (POs created in March/April that haven't finished their receive/invoice cycle yet).

### Receive lag distribution (Pierce, last 12 months)

Time from `PO_Header.PODate` to `PO_Header.ReceiveDate` for the 1,143 received POs:

| Lag bucket | Count | % |
|---|---:|---:|
| Same day or earlier (negative lag) | 2 | 0.2% |
| 1–7 days | 521 | 45.6% |
| 8–14 days | 185 | 16.2% |
| 15–30 days | 211 | 18.5% |
| 31+ days | 226 | **19.8%** |

**Average: 17.2 days. Median bucket: 1–7 days. Worst case: 244 days** (someone took 8 months to receive a PO). The ~20% of POs that take >30 days to receive is a real operational tail — likely backorders, long-lead-time custom orders, or vendor delays.

The 2 POs received "before" their PODate are data-entry quirks (probably the PO was post-dated after the goods arrived).

## 5. Quantity flow (Pierce lines, last 12 months)

| Metric | Total | Notes |
|---|---:|---|
| Pierce PO lines | **11,624** | |
| Total ordered qty | 233,512 | Sum of `PO_Location.Qty` |
| Total received qty | 296,785 | Sum of `PO_Location.RecvQty` — **larger than ordered**, see anomaly |
| Total invoiced qty | 260,766 | Sum of `PO_Location.InvoicedQty` |
| Total backorder qty | **0** | Backorder field is unused at Pierce |
| Total cancel qty | 315 | Spread across 28 lines |
| Total discrepancy qty | 15 | Tiny — clean data |
| Lines with backorder | 0 | |
| Lines with cancel | 28 | |

**Anomaly worth flagging**: total `RecvQty` (296k) > total `Qty` ordered (233k) — a 27% over-receive. Possible causes: cumulative receipts including returns/reversals, vendor over-shipments not corrected, or `RecvQty` captures lifetime cumulative receipts on a row that was later modified. Worth a follow-up query against a smaller sample to understand. Not a data-loss concern; just a metric-trustworthiness one.

**The zero backorder count is also notable** — either Pierce vendors never partial-ship, or `BackOrderQty` isn't being populated. Most bookstores see frequent backorders, so the latter is more likely. If laportal ever needs to surface backorder visibility, this field can't be relied on.

## 6. Average PO size (Pierce, last 5 years)

| Metric | Value |
|---|---:|
| POs | 5,165 |
| Average lines per PO | **8.94** |
| Average qty per PO | 176.91 |
| Average $ per PO | $1,305 |
| Total 5y spend | **$6,741,397** |

A typical Pierce PO is ~9 lines, ~177 units, ~$1,300. The big-ticket POs are clearly textbook orders and gift card purchases (visible in the spend ranking).

## 7. Auto-generation

Prism has automated PO generation procs (`SP_AutogenPO`, `SP_AutogenPOAddItem`, `SP_AutogenPOAddRptItem`, `SP_AutogenPOItem`, `P_AutogenPOScheduled`). Per `sys.dm_exec_procedure_stats`:

| Proc | Recent executions | Last fired |
|---|---:|---|
| `P_AutogenPOScheduled` | 4 | 2026-04-24 20:06:18 |

**Auto-generation is barely used.** The 4 cached executions are likely from a scheduled job that runs nightly or weekly. The other `SP_Autogen*` procs don't even appear in `procedure_stats` — meaning they haven't fired since the cache was last cold (April 21).

For Pierce specifically (where almost all POs are manual buyer-driven), auto-gen looks unimportant. For other LACCD bookstores doing high-volume textbook reorders, this picture might differ.

## 8. The live PO write-path

From the prior session's reverse-engineering pass, the live PO procs at the district level are:

| Proc | Recent executions | Role |
|---|---:|---|
| `SP_PurchPostRequest` | 98 + 29 | **Posts a PO request** — canonical save entrypoint |
| `SP_PurchEditInfoEx` | 147 + 12 | Edits PO header |
| `SP_PurchEditInfo` | 71 | Edit variant |
| `SP_PurchAddShip` | 75 + 8 | Adds shipment |
| `SP_PurchAddItem` | 2 | Adds line item |
| `SP_PurchDeleteItem` | 6 + 1 | Deletes line item |

These are reverse-engineering candidates if laportal ever needs to write POs. Plan-cache recovery would yield their bodies.

## 9. Anomalies worth surfacing

1. **One PO with `PODate` = 2042-02-06** — far-future. Likely a typo or intentional placeholder. From the district-wide pass; not necessarily a Pierce row, but flag for the purchasing team to find and verify.
2. **19 Pierce POs with `UserID = 0`** — orphan rows with no user attribution. All from 2013–2017; likely a data-migration artifact. Won't affect future activity but they show up in any "by user" rollup as `<null>`.
3. **2 Pierce POs received before their `PODate`** — almost certainly post-dated entries (PO was filled out after the goods arrived). Operational-process trivia.
4. **0 backorder qty across 11,624 lines** — `BackOrderQty` isn't being populated. Either by vendor practice or by data-entry convention.
5. **`RecvQty` totals > `Qty` ordered totals** by 27% — needs investigation. Could be cumulative-over-time semantics on the column, or a real over-receive pattern, or measurement error in the metric.
6. **`fStatus` values 4 and 5** appear in 4 Pierce POs but aren't in the `PO_Status` lookup table (which has 0, 1, 2, 3 only). Either a custom-status extension or schema corruption.

## 10. Implications for laportal

### What laportal could do here

1. **PO dashboards / reporting only**, no write paths. Pierce's 2 active buyers (Stella, Michael) are deeply skilled in WPAdmin's PO module; replacing the buyer UI in laportal would have low adoption ROI and high build cost. Read-only views (top vendors, spend trends, pipeline health) would have value for management oversight without disrupting buyer workflow.
2. **Vendor master + spend analytics** as a standalone laportal module would be useful — top vendors, spend by category, year-over-year trends. The ~$1.35M/year Pierce purchasing budget is worth surfacing in a discoverable dashboard.
3. **The textbook decline** is a real strategic signal. If laportal builds analytics for management, "publisher PO trend over 5 years" would visually show the digital-shift story this data tells.

### What laportal probably should NOT do

1. Replace the PO creation UI. WPAdmin's PO entry is fast for trained buyers, integrates with vendor catalogs, and the 2 active Pierce buyers represent the entire user population. The build cost wouldn't pay back.
2. Touch the auto-generation flow. Barely used at Pierce; not worth modeling.
3. Fix the backorder data. That's a vendor-process problem, not a system problem.

### What this analysis confirms about identity-stamping (per [`user-identity-mapping.md`](user-identity-mapping.md))

Every Pierce PO has a clean `UserID` value (except the 19 orphans from 2013–2017). When laportal eventually builds the SUID-mapping table, these are the Pierce PO authors who'd need entries:

| User | SUID | Active? |
|---|---:|---|
| Stella Badalyan | 911 | Yes — primary buyer |
| Michael Matsumoto | 191 | Yes — primary buyer |
| Marcos Montalvo | 865 | Yes — occasional |

Other users on the Pierce PO list (Nenita, Tovmas, Grigor, Candy, Maged) are non-Pierce LACCD employees whose POs include Pierce as a delivery location; mapping them in laportal isn't required unless we expand to district-wide use.

## 11. How this analysis was generated

Two read-only TypeScript scripts in `scripts/`:

- [`probe-prism-purchase-orders.ts`](../../scripts/probe-prism-purchase-orders.ts) — district-wide pass (used as a sanity check earlier in the investigation)
- [`probe-prism-pierce-purchase-orders.ts`](../../scripts/probe-prism-pierce-purchase-orders.ts) — the focused Pierce-only probe that produced everything in this doc

Both query only `PO_*`, `Invoice_Header`, `VendorMaster`, `prism_security.dbo.PrismUser`, and `sys.*` DMVs via plain `SELECT`. No INSERT/UPDATE/DELETE/MERGE/EXEC of writing procs.

To re-run after time has passed:

```bash
npx tsx scripts/probe-prism-pierce-purchase-orders.ts
```

Output lands in `tmp/prism-pierce-purchase-orders-<timestamp>.json` for full machine-readable detail behind every metric in this doc.
