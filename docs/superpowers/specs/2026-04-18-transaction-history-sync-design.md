# Transaction History Sync + Real Per-SKU Analytics — Design

**Date:** 2026-04-18
**Status:** Draft for review
**Supersedes (partially):** `2026-04-17-products-page-interactive-design.md` (only the sections that depend on `Inventory_EstSales`)

## Problem

The products page mirror currently pulls five aggregate-ish fields from Prism's `Inventory_EstSales` table (`one_year_sales`, `look_back_sales`, `sales_to_avg_ratio`, `est_sales_calc`, `est_sales_prev`) with the intent of feeding velocity-driven presets and a trend arrow on the product table. Direct probing of the source data (see "Prior investigation" below) showed the fields are not usable:

- Only ~26k distinct SKUs out of ~61k Pierce-stocked have any row in `Inventory_EstSales` (~43% coverage, ~57% silent NULLs).
- `OneYearSales`, `LookBackSales`, `SalesToAvgSalesRatio` are DCC-level aggregates for 64% of populated rows — not per-SKU values. They're stamped onto every SKU in a DCC.
- `EstSalesPrev` is always `0` in the most recent rows, so the product-table trend arrow (`est_sales_calc` vs `est_sales_prev`) always reads "rising."
- No preset or filter reads `one_year_sales`, `look_back_sales`, or `sales_to_avg_ratio`. They are carried but never queried.

The solution is to stop piggy-backing on Prism's internal forecast rollup and instead pull Pierce's raw POS transaction history for the last 3 years into Supabase, then compute real per-SKU aggregates ourselves.

## Goals

1. Pull 3 years of Pierce POS transaction line items from Prism into a new Supabase table (`sales_transactions`). Append forever after the initial backfill.
2. Compute a rich set of per-SKU aggregates (units, revenue, txn counts, first/last sale dates) from that raw data and denormalize onto the existing `products` table.
3. Replace the dead `Inventory_EstSales` columns on `products`. Remove the broken trend arrow.
4. Add a comprehensive preset library that uses the new aggregates for real inventory decisions — dead-weight identification, velocity analysis, stock-health signals, margin/pricing crosses, trending direction.
5. Keep the incremental sync cheap — a typical sync click should pull only new rows (few hundred/day) and recompute aggregates in under a second.

## Non-goals

- Transaction-level features that require customer/membership identity. `CustomerID` and `MembershipID` are intentionally excluded; `MembershipID` is also dead data at Pierce (zero populated rows in 3y).
- Time-of-day / hour-of-day analytics. The data supports it (`CreateDate` is populated), but no current preset needs it.
- Fixing the never-firing production cron (separate, unrelated follow-up).

## Prior investigation (validated against live Prism)

Run against `Transaction_Header`, `Transaction_Detail`, `Inventory`, Pierce (`LocationID = 2`), trailing 3 years:

| Table | Rows (Pierce, 3y) | Distinct SKUs |
|---|---:|---:|
| Transaction_Header | 365,036 | — |
| Transaction_Detail | 877,486 | 10,659 |
| SalesHistoryDetail (rollup) | 324,618 | 10,587 |
| ForecastItemSalesByWeek (all-time) | 334,012 | 18,961 |

**Column population findings that shaped the design:**
- `fStatus` on `Transaction_Header` is a **bitmask**, not 0/1. Values observed: 1 (99.6% — clean posted), 2 (0.26% — voided/reversed), 4 (0.07% — returns), 8 (0.05% — other flag).
- Voids and refunds post as **separate reversal rows** with negative `Qty` and negative `ExtPrice`. Including all `fStatus` values gives correct net aggregates; filtering to `fStatus=1` would overcount by ~2%.
- `SaleAmt` on `Transaction_Detail` is **not revenue** (avg 0.001, max 63). `ExtPrice` is revenue (avg $7.76, correctly negative on returns).
- `ItemDiscount`, `TransDiscount` on header are only 1.6% populated — drop.
- `MOfNewUsed`, `MembershipID` are near-dead (< 1% populated) — drop.
- `CreateDate` and `ProcessDate` are same-day on 99.96% of rows. Use `ProcessDate` as canonical sale date.
- `Description` on detail is 100% populated (snapshot at time of sale).
- Our computed `last_sale_date_computed` matches `Inventory.LastSaleDate` within a few hours for most SKUs and is strictly more accurate when they differ (observed 8-day drift on one of the top-10 SKUs).

## Data model

### New table: `sales_transactions`

One row per posted Pierce line item. Columns flattened from `Transaction_Header ⋈ Transaction_Detail`.

| Column | Type | Source | Notes |
|---|---|---|---|
| `tran_dtl_id` | `bigint PRIMARY KEY` | `Transaction_Detail.TranDtlID` | Natural PK from Prism |
| `transaction_id` | `bigint NOT NULL` | `Transaction_Header.TransactionID` | Join key to receipt |
| `sku` | `bigint NOT NULL` | `Transaction_Detail.SKU` | Per-item |
| `tran_type_id` | `smallint` | `Transaction_Header.TranTypeID` | 1=cash/card POS, 2=?, 4=AR invoice (dominant at Pierce), 5=return |
| `location_id` | `smallint NOT NULL` | `Transaction_Header.LocationID` | Always 2; kept for future multi-site hypothetical |
| `user_id` | `integer` | `Transaction_Header.UserID` | Cashier (employee) |
| `pos_id` | `integer` | `Transaction_Header.POSID` | Workstation |
| `register_id` | `integer` | `Transaction_Header.RegisterID` | Till |
| `receipt_id` | `bigint` | `Transaction_Header.ReceiptID` | Receipt reference |
| `tran_number` | `integer` | `Transaction_Header.TranNumber` | Human-facing receipt number |
| `pos_line_number` | `integer` | `Transaction_Detail.PosLineNumber` | Ordering on receipt |
| `qty` | `numeric(12,3)` | `Transaction_Detail.Qty` | Signed (negative on returns) |
| `price` | `numeric(12,2)` | `Transaction_Detail.Price` | List price at time of sale |
| `ext_price` | `numeric(12,2)` | `Transaction_Detail.ExtPrice` | **Revenue.** Signed (negative on returns) |
| `discount_amt` | `numeric(12,2)` | `Transaction_Detail.DiscountAmt` | |
| `markdown_amt` | `numeric(12,2)` | `Transaction_Detail.MarkDownAmt` | |
| `tax_amt` | `numeric(12,2)` | `Transaction_Detail.TaxAmt` | |
| `description` | `text` | `Transaction_Detail.Description` | Snapshot at sale |
| `hdr_f_status` | `smallint` | `Transaction_Header.fStatus` | Bitmask; kept for future "exclude voided receipts" queries if needed |
| `dtl_f_status` | `smallint` | `Transaction_Detail.fStatus` | Line-level flag |
| `f_invoiced` | `smallint` | `Transaction_Header.fInvoiced` | |
| `tran_total` | `numeric(14,2)` | `Transaction_Header.TranTotal` | Receipt-level total |
| `tax_total` | `numeric(12,2)` | `Transaction_Header.TaxTotal` | Receipt-level tax |
| `process_date` | `timestamptz NOT NULL` | `Transaction_Header.ProcessDate` | Canonical sale date |
| `create_date` | `timestamptz` | `Transaction_Header.CreateDate` | When rung up |
| `dtl_create_date` | `timestamptz` | `Transaction_Detail.CreateDate` | Rarely differs from header CreateDate |
| `synced_at` | `timestamptz NOT NULL DEFAULT now()` | — | Supabase-side insert timestamp |

**Indexes:**
- `PRIMARY KEY (tran_dtl_id)`
- `INDEX (sku, process_date DESC)` — main aggregate rollup query
- `INDEX (process_date DESC)` — incremental sync cursor + time-range filters
- `INDEX (transaction_id)` — receipt joins

**Row count estimates:** 877k rows at backfill, +~300k/yr growth, steady state ~1.5M rows at 5 years. Trivial for Supabase.

**Write policy:** exclusively written by the backfill script (one-time) and the incremental sync step. No UI writes.

### New table: `sales_transactions_sync_state`

Single-row table tracking the backfill status and the incremental cursor.

| Column | Type | Notes |
|---|---|---|
| `id` | `smallint PRIMARY KEY DEFAULT 1` | Enforced single-row via `CHECK (id = 1)` |
| `backfill_completed_at` | `timestamptz` | Null until backfill finishes |
| `last_transaction_id` | `bigint NOT NULL DEFAULT 0` | High-water mark for incremental pulls |
| `last_process_date` | `timestamptz` | For diagnostic display |
| `total_rows` | `bigint NOT NULL DEFAULT 0` | Denormalized count (updated on insert) |

### Additions to `products`

Twelve new columns, all nullable or defaulting to 0. All are numeric or date.

| Column | Type | Default |
|---|---|---|
| `units_sold_30d` | `integer` | 0 |
| `units_sold_90d` | `integer` | 0 |
| `units_sold_1y` | `integer` | 0 |
| `units_sold_3y` | `integer` | 0 |
| `units_sold_lifetime` | `integer` | 0 |
| `revenue_30d` | `numeric(14,2)` | 0 |
| `revenue_90d` | `numeric(14,2)` | 0 |
| `revenue_1y` | `numeric(14,2)` | 0 |
| `revenue_3y` | `numeric(14,2)` | 0 |
| `revenue_lifetime` | `numeric(14,2)` | 0 |
| `txns_1y` | `integer` | 0 — distinct receipts, not units |
| `txns_lifetime` | `integer` | 0 |
| `first_sale_date_computed` | `timestamptz` | null |
| `last_sale_date_computed` | `timestamptz` | null |
| `sales_aggregates_computed_at` | `timestamptz` | null |

### Removals from `products`

- `one_year_sales`
- `look_back_sales`
- `sales_to_avg_ratio`
- `est_sales_calc`
- `est_sales_prev`

Done in the same migration as the additions, as part of replacing the dead fields with real ones.

## Aggregation formula (reference implementation)

```sql
-- Recompute per-SKU aggregates for all SKUs with any sales history.
-- Runs as the final step of each sync. Expected runtime: <1s.
WITH rolled AS (
  SELECT
    sku,
    SUM(CASE WHEN process_date >= now() - interval '30 days'  THEN qty       ELSE 0 END)::int      AS u30,
    SUM(CASE WHEN process_date >= now() - interval '90 days'  THEN qty       ELSE 0 END)::int      AS u90,
    SUM(CASE WHEN process_date >= now() - interval '1 year'   THEN qty       ELSE 0 END)::int      AS u1y,
    SUM(CASE WHEN process_date >= now() - interval '3 years'  THEN qty       ELSE 0 END)::int      AS u3y,
    SUM(qty)::int                                                                                    AS ulife,
    SUM(CASE WHEN process_date >= now() - interval '30 days'  THEN ext_price ELSE 0 END)            AS r30,
    SUM(CASE WHEN process_date >= now() - interval '90 days'  THEN ext_price ELSE 0 END)            AS r90,
    SUM(CASE WHEN process_date >= now() - interval '1 year'   THEN ext_price ELSE 0 END)            AS r1y,
    SUM(CASE WHEN process_date >= now() - interval '3 years'  THEN ext_price ELSE 0 END)            AS r3y,
    SUM(ext_price)                                                                                   AS rlife,
    COUNT(DISTINCT CASE WHEN process_date >= now() - interval '1 year' THEN transaction_id END)::int AS t1y,
    COUNT(DISTINCT transaction_id)::int                                                              AS tlife,
    MIN(process_date)                                                                                AS first_sale,
    MAX(process_date)                                                                                AS last_sale
  FROM sales_transactions
  WHERE dtl_f_status <> 1  -- exclude explicit line voids
  GROUP BY sku
)
UPDATE products p SET
  units_sold_30d               = r.u30,
  units_sold_90d               = r.u90,
  units_sold_1y                = r.u1y,
  units_sold_3y                = r.u3y,
  units_sold_lifetime          = r.ulife,
  revenue_30d                  = r.r30,
  revenue_90d                  = r.r90,
  revenue_1y                   = r.r1y,
  revenue_3y                   = r.r3y,
  revenue_lifetime             = r.rlife,
  txns_1y                      = r.t1y,
  txns_lifetime                = r.tlife,
  first_sale_date_computed     = r.first_sale,
  last_sale_date_computed      = r.last_sale,
  sales_aggregates_computed_at = now()
FROM rolled r
WHERE p.sku = r.sku;
```

**Why net (not gross) is the default:** voids and refunds post as negative reversal rows (verified). Summing all `Qty` and `ExtPrice` automatically produces net figures — which is how managers think about "sold."

**Why not filter `hdr_f_status`:** doing so would drop the negative reversal rows but keep the original positive sale, overcounting voided items by ~2%.

**Why exclude `dtl_f_status = 1`:** 87 rows in 877k — line-level voids that were cleared mid-transaction before the receipt closed. They have no paired reversal.

## Sync pipeline

### One-time backfill

New script `scripts/backfill-prism-transactions.ts`:

1. Verify `sales_transactions_sync_state.backfill_completed_at IS NULL` (idempotency guard; aborts with a clear message if backfill has already completed).
2. Page through Prism using a `TransactionID > cursor` loop, page size 5000. Each page is a single `Transaction_Header ⋈ Transaction_Detail` join SELECT filtered to `LocationID = 2 AND ProcessDate >= now() - interval '3 years'`.
3. Stream each page into Supabase via `insert()` in sub-chunks of 1000 rows (Supabase PostgREST payload limit). Use `ON CONFLICT (tran_dtl_id) DO NOTHING` to make retries safe.
4. On completion: set `backfill_completed_at = now()`, `last_transaction_id = <max observed>`, `total_rows = <rowcount>`.
5. Trigger a full aggregate recompute as the final step.

**Runtime estimate:** ~877k rows / 5k page = 176 pages. At ~2s/page (Prism query + network + Supabase insert), roughly **6 minutes**. Run manually from a dev workstation with Prism tunnel up.

**Pre-flight check:** the script prints Prism row count and Supabase row count before/after each major step. If Supabase row count drops, abort immediately.

### Incremental (every sync)

Folded into the existing `/api/sync/prism-pull` route, after the product catalog step finishes. New module `src/domains/product/sales-txn-sync.ts`:

1. Read `last_transaction_id` from sync state.
2. Single Prism query: `SELECT ... WHERE LocationID = 2 AND TransactionID > @cursor`. Typical delta: a few hundred to a few thousand rows.
3. Insert into `sales_transactions` with `ON CONFLICT DO NOTHING`.
4. Update `last_transaction_id` to the max of the inserted batch.
5. Run the aggregate recompute SQL above (one statement, all SKUs with sales).

The txn step is wrapped in its own `try/catch`. Failures are logged to `sync_runs.error` but do not fail the enclosing request — the product catalog step must have already succeeded before we get here, and failing the txn step shouldn't roll it back.

### Why recompute aggregates for all sale-active SKUs every sync

Rolling windows move with the calendar, not just with new sales. A SKU's `units_sold_30d` can change without any new transaction, when a day-31 sale rolls off the window. A full recompute of all ~10.7k sale-active SKUs costs one `UPDATE ... FROM` against the `(sku, process_date)` index and runs in well under a second. Not worth optimizing to "only touched SKUs."

### UI changes on the sync dialog

The existing `SyncResultsDialog` shows scanned / updated / removed / duration for the product catalog. Add three fields next to those:

- `txnsAdded` — rows inserted into `sales_transactions` this run
- `aggregatesUpdated` — count of SKUs whose aggregates changed
- `txnSyncDuration` — isolated duration for the txn + recompute step

Return these from the POST response alongside the existing fields. The table of prior sync runs adds the same fields.

## Preset library

The `SYSTEM_PRESETS` array in `src/domains/product/presets.ts` gets reorganized into seven groups. Existing presets that still work (dead-weight core, data quality, editing activity) stay. New presets that depend on the computed fields are added below.

**New filter fields on `ProductFilters`:**
- `minUnitsSold: string`, `maxUnitsSold: string`, `unitsSoldWindow: "30d" | "90d" | "1y" | "3y" | "lifetime"`
- `minRevenue: string`, `maxRevenue: string`, `revenueWindow: "30d" | "90d" | "1y" | "3y" | "lifetime"`
- `minTxns: string`, `maxTxns: string`, `txnsWindow: "1y" | "lifetime"`
- `trendDirection: "" | "accelerating" | "decelerating"` — derived filter using daily-rate comparison
- `firstSaleWithin: "" | "90d" | "1y"` — new arrivals
- `neverSoldLifetime: boolean` — authoritative "never sold" using txn data, superseding the existing `Inventory.LastSaleDate`-based `lastSaleNever`
- `stockCoverageDays: string` — stock ÷ (units_sold_30d / 30), i.e. "days of cover at current pace"

### Preset groups (final list)

**💀 Dead weight** — identify discontinuation candidates
- `dead-never-sold-authoritative` — "Never sold at Pierce (3y base)" — `neverSoldLifetime: true`. Supersedes the existing `dead-never-sold` (which relied on possibly-wrong `Inventory.LastSaleDate`).
- `dead-never-sold-with-stock` — "Never sold + still in stock" — `neverSoldLifetime: true, minStock: 1` — the strongest "get rid of this" signal.
- `dead-no-sales-1y-stock` — "No sales in 1y, stocked" — `units_sold_1y: 0, minStock: 1`
- `dead-no-sales-2y-stock` — "No sales in 2y, stocked" — same but via `last_sale_date_computed < now() - 2y`
- `dead-discontinued-with-recent-sales` — "Discontinued but still moving" — `discontinued: yes, units_sold_1y > 0` — probable mis-discontinuations worth revisiting
- `dead-discontinued-with-stock` — existing, kept — `discontinued: yes, minStock: 1`

**📊 Movers** — top performers
- `movers-top-units-30d` — "Top sellers (units) last 30 days" — sort by `units_sold_30d desc`, `units_sold_30d > 0`
- `movers-top-units-1y` — "Top sellers (units) last year" — sort by `units_sold_1y desc`
- `movers-top-units-lifetime` — "Top sellers (units) lifetime (3y+)" — sort by `units_sold_lifetime desc`
- `movers-top-revenue-30d` — "Top revenue last 30 days" — sort by `revenue_30d desc`
- `movers-top-revenue-1y` — "Top revenue last year" — sort by `revenue_1y desc`
- `movers-consistent-sellers` — "Consistent sellers (50+ receipts/yr)" — `txns_1y >= 50`. Filters out bulk-order flukes; identifies true repeat products.
- `movers-one-hit-wonders` — "Big-volume / one-time sales" — `txns_lifetime = 1, units_sold_lifetime >= 10`. Single bulk order, no repeat — usually a course adoption that didn't renew.

**📈 Trending** — direction of movement (new group)
- `trend-accelerating` — "Accelerating" — `trendDirection: accelerating, units_sold_30d > 5` (min threshold to avoid noise). Definition: daily rate in last 30d > 1.5× trailing 1y daily rate.
- `trend-decelerating` — "Decelerating" — `trendDirection: decelerating, units_sold_1y > 10`. Definition: daily rate in last 30d < 0.5× trailing 1y daily rate.
- `trend-new-arrivals` — "New & moving" — `firstSaleWithin: 90d, units_sold_30d >= 5`. First seen in last 90d, already moving.

**📦 Stock health** — inventory balance (new group)
- `stock-overstocked-1y` — "Overstocked (1y+ of supply)" — `stock_on_hand > units_sold_1y`. More than a year of supply at current pace.
- `stock-stockout-risk` — "Stockout risk" — `stock_on_hand <= 2, units_sold_30d >= 5`. Low stock + selling — reorder now.
- `stock-less-than-30d-cover` — "Less than 30 days of cover" — `stockCoverageDays < 30, units_sold_30d > 0`
- `stock-stale-stock` — "Stale stock" — `minStock: 10, last_sale_date_computed < now() - 180d` — dust gatherers with real shelf space.

**💰 Pricing intel** — pricing review candidates
- `price-high-margin-high-velocity` — "High margin + high velocity" — `minMargin: 0.4, units_sold_1y >= 50`. Cash cows.
- `price-high-margin-dead` — "High margin + not moving" — `minMargin: 0.4, units_sold_1y: 0`. Priced fine, nobody wants it.
- `price-thin-margin-popular` — "Thin margin + popular (raise price?)" — `maxMargin: 0.1, units_sold_1y >= 100`. Candidates for price increase.
- `price-low-revenue-high-stock` — "Low revenue, high stock" — `revenue_1y < 50, minStock: 20`. Eating shelf space for nothing.

**🎓 Textbook-specific** — semester and course signals
- `textbook-current-semester-active` — "Textbook active this semester" — `tab: textbooks, units_sold_90d >= 5`
- `textbook-used-moving` — "Used textbooks moving" — `itemType: used_textbook, units_sold_90d > 0`
- `textbook-faded-this-year` — "Textbook faded (was active, now quiet)" — `tab: textbooks, units_sold_1y > 0, units_sold_30d = 0`

**🔍 Data quality** — existing presets kept (`data-missing-barcode`, `data-missing-isbn-textbook`, `data-missing-title-or-description`, `data-retail-below-cost`, `data-zero-price`).

**📝 Recent activity** — existing presets kept (`recent-edited-7d`, `recent-edited-since-sync`).

### Total preset count

- Existing dead-weight kept: 1 (`dead-discontinued-with-stock`). The other existing dead-weight presets (`dead-never-sold`, `dead-no-sales-2y`, `dead-no-sales-5y`, `dead-zero-stock-never-sold`, `dead-discontinued`) are replaced by or consolidated into the new variants that use authoritative txn-based fields.
- Existing data-quality kept: 5.
- Existing recent-activity kept: 2.
- Existing movers kept: 0 (the old `movers-last-30d` / `movers-last-90d` / `movers-proven-sellers` rely on `last_sale_date` and are superseded by the new unit-based top-sellers). Removed in this migration.
- Existing pricing kept: 5 (price-band and margin-only filters are still useful).
- New: 26.
- **Total: ~39 presets across 8 groups** (dead weight, movers, trending, stock health, pricing, textbook, data quality, recent activity). The existing UI already groups presets; more entries per group is a scale extension, not a redesign.

### Notes on derived filters

Three filters are computed expressions over multiple columns rather than direct column reads:
- `trendDirection = "accelerating"` → `(units_sold_30d / 30.0) > (units_sold_1y / 365.0) * 1.5`
- `trendDirection = "decelerating"` → `(units_sold_30d / 30.0) < (units_sold_1y / 365.0) * 0.5`
- `stockCoverageDays` → `stock_on_hand / NULLIF(units_sold_30d / 30.0, 0)` — null-propagates when 30d sales are zero.

These need explicit handling in `searchProducts` (the Supabase client builder in `src/domains/product/queries.ts`) since PostgREST expression support is limited. Implementation option: define a Postgres `VIEW products_with_derived` that exposes the three computed fields as if they were columns; `searchProducts` reads from the view when any of these filters are active.

## Rollout sequence

**Order matters. Do not skip or reorder.**

1. **Schema migration PR.** Adds `sales_transactions` table, `sales_transactions_sync_state` table, 15 new columns on `products`, drops the 5 dead `est_sales_*` / `*_sales` columns. Indexes as specified. Ship-check green, merge.
2. **Backfill.** Run `npx tsx scripts/backfill-prism-transactions.ts` from a local workstation with Prism tunnel up. Wait for completion (~6 minutes). Verify `sales_transactions_sync_state.backfill_completed_at` is set and `total_rows` matches the expected ~877k. Verify `products.sales_aggregates_computed_at` is set on sale-active SKUs.
3. **Incremental sync + UI PR.** Adds:
   - the sales-txn-sync module wired into `/api/sync/prism-pull`
   - the sync dialog field additions (`txnsAdded`, `aggregatesUpdated`, `txnSyncDuration`)
   - the type changes on `ProductFilters` and the new filter logic in `searchProducts`
   - the `products_with_derived` view for the three computed filters
   - removal of the broken `est_sales` trend arrow in `src/components/products/product-table.tsx` (replaced with `units_sold_1y` as the default visible velocity column)
   - updates to every preset's `columnPreferences.visible` list that references the deleted `est_sales` column — retargeted to `units_sold_1y` or `revenue_1y` as appropriate
   - the 26 new presets and replacement of the superseded existing ones
   Ship-check green, merge.
4. **Post-deploy validation.** Click "Sync Database" in production. Confirm the dialog shows `txnsAdded > 0` (the delta between backfill end and deploy time), `aggregatesUpdated > 0`, and no errors. Spot-check a preset like "Top sellers (units) last 30 days" — expect real textbook / supply SKUs at the top.
5. **Separate follow-up (not part of this work).** Investigate why `prism-pull-sync` cron never fires (zero entries in `job_runs` despite registration). Likely `CRON_INTERNAL_SECRET` missing from the VPS env.

## Testing

- **Unit tests**:
  - Aggregation formula against a curated fixture of 10 txns (including a void pair and a return pair) — verify net units/revenue, txn counts, first/last dates.
  - Incremental cursor advancement: insert 5 new mock txns, verify `last_transaction_id` bumps to the max.
  - Duplicate insertion tolerance: same batch applied twice produces no duplicates (tests the ON CONFLICT clause).
- **Preset predicate tests** (matching the existing `presets-predicates.test.ts` pattern):
  - Every new preset gets a fixture-based predicate test.
  - Regression: existing preset tests continue to pass after the ProductFilters type expansion.
- **Integration smoke test** (script, not in CI):
  - `scripts/test-sales-txn-sync.ts` — run an incremental sync against a dev Prism, assert Supabase row delta matches Prism delta, assert aggregates recomputed.

## Risks & mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Backfill overwhelms Prism (5M+ daily-commit-volume SQL Server) | Low | Pierce 3y = 877k rows, paged at 5k. Read-only. Runs off-hours if concerns emerge. Server handles nightly Prism full-catalog backups — 877k targeted rows is a non-event. |
| fStatus semantics wrong and we undercount/overcount | Low | Verified against top-10 SKU sanity check + Inventory.LastSaleDate cross-check. Unit tests lock in the rule. |
| Aggregate recompute slows sync click perceptibly | Low | Benchmarked: one UPDATE ... FROM query, 10.7k row grouping on indexed column. <1s. If exceeded, add a covering index on `(sku, process_date, qty, ext_price)`. |
| Preset count (~30) clutters UI | Medium | Existing products page already groups presets. UI doesn't change — just more entries per group. A revisit after launch can consolidate if users don't discover them. |
| Returns net to zero but were "real" sales | By design | Users asking about gross sales can filter `qty > 0` via a future preset. Not in scope for v1. |

## Open questions

None at spec-review time. If the user reviewing the spec wants to change: preset selection, column set, or rollout sequencing — call it out now, before the plan gets written.
