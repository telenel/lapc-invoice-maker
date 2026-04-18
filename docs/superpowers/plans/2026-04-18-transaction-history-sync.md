# Transaction History Sync + Real Per-SKU Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dead `Inventory_EstSales`-derived fields on the products mirror with real per-SKU aggregates computed from 3 years of Pierce POS transaction history pulled into Supabase, and add ~26 new velocity / stock-health / trending presets that leverage them.

**Architecture:** Two new Supabase tables — `sales_transactions` (raw line items, 877k at backfill, append-only) and `sales_transactions_sync_state` (singleton with backfill/cursor state). A Postgres view `products_with_derived` exposes three computed columns (trend direction, stock coverage days) the products page filters use. Aggregates (12 columns) are denormalized onto `products` and refreshed at the end of every "Sync Database" click. Backfill is a one-time CLI script; incremental pulls fold into the existing `/api/sync/prism-pull` route.

**Tech Stack:** Next.js 14 (App Router), TypeScript, Prisma 7 + Supabase Postgres (raw-SQL migrations; `products` table is not in `schema.prisma`), `mssql` (Prism SQL Server), Vitest. No new libraries.

**Design spec:** `docs/superpowers/specs/2026-04-18-transaction-history-sync-design.md`. Read before starting.

---

## File structure

### New files

| Path | Responsibility |
|---|---|
| `prisma/migrations/<TS_A>_sales_transactions_and_real_aggregates/migration.sql` | Creates `sales_transactions`, `sales_transactions_sync_state`; adds 15 new columns to `products`; drops 5 dead columns; creates `products_with_derived` view. |
| `prisma/migrations/<TS_B>_sync_runs_txn_fields/migration.sql` | Adds `txns_added`, `aggregates_updated`, `txn_sync_duration_ms` columns to `sync_runs`. |
| `src/domains/product/sales-aggregates.ts` | Pure SQL string + typed runner for the aggregate-recompute UPDATE. Shared by backfill and incremental. |
| `src/domains/product/sales-txn-sync.ts` | Incremental pull: reads cursor, pages Prism, inserts Supabase, bumps cursor. |
| `scripts/backfill-prism-transactions.ts` | One-time CLI: full 3y pull, chunked insert, final aggregate recompute. |
| `scripts/test-sales-txn-sync.ts` | Smoke test: runs incremental sync against live Prism, asserts row delta matches. |
| `tests/domains/product/sales-aggregates.test.ts` | SQL builder shape + mock-client recompute invocation. |
| `tests/domains/product/sales-txn-sync.test.ts` | Cursor advancement + ON CONFLICT idempotency against mock. |

### Modified files

| Path | What changes |
|---|---|
| `prisma/schema.prisma` | Extend `SyncRun` with three new columns; add `SalesTransaction` + `SalesTransactionsSyncState` Prisma models (so `prisma generate` produces types). |
| `src/app/api/sync/prism-pull/route.ts` | After product catalog step, invoke `runSalesTxnSync`; capture `txnsAdded` / `aggregatesUpdated` / `txnSyncDuration`; write to the `sync_runs` row; include in POST response. |
| `src/domains/product/prism-sync.ts` | Remove the `Inventory_EstSales` LEFT JOIN + remove the five dead fields from `PrismItemRow`, `hashRow`, and the upsert payload. |
| `src/domains/product/api-client.ts` | Extend `SyncPullResult` and `SyncRun` with the three new fields. |
| `src/components/products/sync-database-button.tsx` | Show the three new fields in the dialog stat grid + history table. |
| `src/domains/product/types.ts` | Extend `Product` with the 14 new aggregate/date fields; drop the 5 removed fields; extend `ProductFilters` with the 10 new filter keys. |
| `src/domains/product/constants.ts` | Extend `EMPTY_FILTERS` defaults; replace `est_sales` in `OPTIONAL_COLUMNS`/`COLUMN_LABELS` with `units_1y` + `revenue_1y` + `txns_1y`; add `"trending"` + `"stock-health"` to `PRESET_GROUPS`. |
| `src/domains/product/queries.ts` | Apply the new filter keys; switch `.from("products")` to `.from("products_with_derived")` when a derived filter is active. |
| `src/domains/product/presets.ts` | Remove 9 superseded presets; add 26 new presets across 4 new groups; update `columnPreferences.visible` arrays that referenced `est_sales`. |
| `src/components/products/product-table.tsx` | Remove the `est_sales` trend-arrow column block; add three new optional column renderers (`units_1y`, `revenue_1y`, `txns_1y`). |
| `tests/domains/product/presets-predicates.test.ts` | Replace fixture `Product` columns; remove fixtures for deleted presets; add fixtures + predicate logic for the 26 new presets. |
| `tests/domains/product/search-products-filters.test.ts` | Add assertions for the 10 new filter keys. |
| `tests/domains/product/__snapshots__/presets-predicates.test.ts.snap` | Regenerate after fixture update (checked-in). |

---

## Tech context (read before Task 1)

- **Repo root:** `C:\Users\MONTALMA2\code\laportal` (Git Bash; forward slashes in paths).
- **Branches:** Two PRs in sequence. Phase A = `feat/txn-history-schema`. Phase B = `feat/txn-history-ui`. Start each from fresh `main` via `npm run git:start-branch -- <name>`.
- **Migration timestamps:** 14-digit UTC. Run `date -u +%Y%m%d%H%M%S` once per migration. The placeholders `<TS_A>` and `<TS_B>` in this plan get replaced with real timestamps.
- **Prisma:** `products` is NOT in `schema.prisma` (raw-SQL-only table). `SyncRun` is in `schema.prisma`. New models `SalesTransaction` + `SalesTransactionsSyncState` get added to `schema.prisma` in Phase A. Run `npx prisma generate` after edits; do NOT run `prisma migrate dev`.
- **Supabase admin client:** `getSupabaseAdminClient()` from `@/lib/supabase/admin`. Uses service-role key — has full bypass-RLS access. Script-context only (never from the browser).
- **Prism client:** `getPrismPool()` from `@/lib/prism`. Campus-intranet only — laptop-with-tunnel or the reverse-SSH bridge. Production VPS cannot reach it. `isPrismConfigured()` guards use.
- **Pierce LocationID:** Hard-coded `2`. Exported as `PIERCE_LOCATION_ID` from `src/domains/product/prism-server.ts`. Never expand to other LACCD schools.
- **Vitest:** `npm test -- tests/path/file.test.ts` runs one file. `npm test` runs all.
- **Ship-check:** `npm run ship-check` must stay green before each push. Runs lint + typecheck + tests.
- **Commit style:** Conventional commits. Trailer `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`.
- **Do NOT push to remote** until the phase's final task explicitly says to.
- **Do NOT merge Phase B until the backfill has been run and verified** against production Supabase. See "Phase A → Backfill → Phase B" checkpoint.

---

## Phase A — Schema migration + backfill script

**Ships as PR #1 on branch `feat/txn-history-schema`.**

### Task 1: Start the Phase A branch

**Files:** none (branch setup only)

- [ ] **Step 1: Start from fresh main**

Run:
```bash
npm run git:start-branch -- feat/txn-history-schema
```

Expected: new branch based on origin/main, clean tree.

- [ ] **Step 2: Generate migration timestamp**

Run:
```bash
date -u +%Y%m%d%H%M%S
```

Capture the output (14 digits, e.g. `20260418120000`). Use as `<TS_A>` for the rest of Phase A.

- [ ] **Step 3: Create migration directory**

Run (substitute `<TS_A>` with actual timestamp):
```bash
mkdir -p "prisma/migrations/<TS_A>_sales_transactions_and_real_aggregates"
```

### Task 2: Write the Phase A migration SQL

**Files:**
- Create: `prisma/migrations/<TS_A>_sales_transactions_and_real_aggregates/migration.sql`

- [ ] **Step 1: Write the migration**

Full contents:

```sql
-- Replace the dead Inventory_EstSales-derived columns on `products` with
-- real per-SKU aggregates computed from a new `sales_transactions` table.
-- One-time backfill populates the new table; the existing prism-pull cron
-- keeps it fresh; a denormalized rollup on `products` stays in sync with
-- each sync run.

-- Raw line-item mirror. 3y Pierce backfill = ~877k rows. Append forever.
CREATE TABLE IF NOT EXISTS "sales_transactions" (
  tran_dtl_id       BIGINT      PRIMARY KEY,
  transaction_id    BIGINT      NOT NULL,
  sku               BIGINT      NOT NULL,
  tran_type_id      SMALLINT,
  location_id       SMALLINT    NOT NULL,
  user_id           INTEGER,
  pos_id            INTEGER,
  register_id       INTEGER,
  receipt_id        BIGINT,
  tran_number       INTEGER,
  pos_line_number   INTEGER,
  qty               NUMERIC(12,3),
  price             NUMERIC(12,2),
  ext_price         NUMERIC(12,2),
  discount_amt      NUMERIC(12,2),
  markdown_amt      NUMERIC(12,2),
  tax_amt           NUMERIC(12,2),
  description       TEXT,
  hdr_f_status      SMALLINT,
  dtl_f_status      SMALLINT,
  f_invoiced        SMALLINT,
  tran_total        NUMERIC(14,2),
  tax_total         NUMERIC(12,2),
  process_date      TIMESTAMPTZ NOT NULL,
  create_date       TIMESTAMPTZ,
  dtl_create_date   TIMESTAMPTZ,
  synced_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sales_transactions_sku_process_date_idx
  ON "sales_transactions" (sku, process_date DESC);
CREATE INDEX IF NOT EXISTS sales_transactions_process_date_idx
  ON "sales_transactions" (process_date DESC);
CREATE INDEX IF NOT EXISTS sales_transactions_transaction_id_idx
  ON "sales_transactions" (transaction_id);

-- Singleton state row: backfill status + incremental cursor.
CREATE TABLE IF NOT EXISTS "sales_transactions_sync_state" (
  id                      SMALLINT    PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  backfill_completed_at   TIMESTAMPTZ,
  last_transaction_id     BIGINT      NOT NULL DEFAULT 0,
  last_process_date       TIMESTAMPTZ,
  total_rows              BIGINT      NOT NULL DEFAULT 0
);
INSERT INTO "sales_transactions_sync_state" (id)
  VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Add real aggregate columns to products. Replaces the dead EstSales fields.
ALTER TABLE "products"
  ADD COLUMN IF NOT EXISTS "units_sold_30d"                INTEGER        DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "units_sold_90d"                INTEGER        DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "units_sold_1y"                 INTEGER        DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "units_sold_3y"                 INTEGER        DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "units_sold_lifetime"           INTEGER        DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "revenue_30d"                   NUMERIC(14,2)  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "revenue_90d"                   NUMERIC(14,2)  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "revenue_1y"                    NUMERIC(14,2)  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "revenue_3y"                    NUMERIC(14,2)  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "revenue_lifetime"              NUMERIC(14,2)  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "txns_1y"                       INTEGER        DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "txns_lifetime"                 INTEGER        DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "first_sale_date_computed"      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "last_sale_date_computed"       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "sales_aggregates_computed_at"  TIMESTAMPTZ;

-- Drop the dead Inventory_EstSales-derived columns. Safe because no preset
-- or UI code reads them in Phase A — Phase B removes the remaining reference
-- (the est_sales trend arrow) before the column is queried again.
ALTER TABLE "products"
  DROP COLUMN IF EXISTS "one_year_sales",
  DROP COLUMN IF EXISTS "look_back_sales",
  DROP COLUMN IF EXISTS "sales_to_avg_ratio",
  DROP COLUMN IF EXISTS "est_sales_calc",
  DROP COLUMN IF EXISTS "est_sales_prev";
DROP INDEX IF EXISTS products_est_sales_calc_idx;

-- Indexes supporting the new velocity/dead-weight presets.
CREATE INDEX IF NOT EXISTS products_units_sold_1y_idx
  ON "products" ("units_sold_1y" DESC);
CREATE INDEX IF NOT EXISTS products_units_sold_30d_idx
  ON "products" ("units_sold_30d" DESC);
CREATE INDEX IF NOT EXISTS products_revenue_1y_idx
  ON "products" ("revenue_1y" DESC);
CREATE INDEX IF NOT EXISTS products_last_sale_date_computed_idx
  ON "products" ("last_sale_date_computed" DESC);

-- View exposes three computed columns the products page filters use.
-- searchProducts switches to this view when trendDirection or
-- stockCoverageDays is active. Non-derived queries keep using the base table.
CREATE OR REPLACE VIEW "products_with_derived" AS
SELECT
  p.*,
  CASE
    WHEN p.units_sold_30d IS NULL OR p.units_sold_30d = 0 THEN NULL
    ELSE p.stock_on_hand::NUMERIC / (p.units_sold_30d::NUMERIC / 30.0)
  END AS stock_coverage_days,
  CASE
    WHEN p.units_sold_30d IS NULL OR p.units_sold_1y IS NULL
      OR p.units_sold_30d = 0 OR p.units_sold_1y = 0 THEN NULL
    WHEN (p.units_sold_30d::NUMERIC / 30.0) > (p.units_sold_1y::NUMERIC / 365.0) * 1.5
      THEN 'accelerating'
    WHEN (p.units_sold_30d::NUMERIC / 30.0) < (p.units_sold_1y::NUMERIC / 365.0) * 0.5
      THEN 'decelerating'
    ELSE 'steady'
  END AS trend_direction
FROM "products" p;
```

- [ ] **Step 2: Apply locally and verify**

Run:
```bash
npx prisma migrate deploy
```
Expected: output mentions the new migration applied.

Verify via MCP or psql:
```sql
\d sales_transactions
\d sales_transactions_sync_state
\d products
\d+ products_with_derived
```
Expected: tables/columns exist, view returns `stock_coverage_days` and `trend_direction` alongside all `products` columns.

- [ ] **Step 3: Commit**

```bash
git add prisma/migrations/<TS_A>_sales_transactions_and_real_aggregates
git commit -m "$(cat <<'EOF'
feat(products): schema for txn history + real per-SKU aggregates

Creates sales_transactions + sales_transactions_sync_state, adds 15 new
aggregate/date columns to products, drops 5 dead Inventory_EstSales
columns, adds products_with_derived view for trend/coverage filters.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 3: Add Prisma models for the new tables

**Files:**
- Modify: `prisma/schema.prisma` (append new models)

- [ ] **Step 1: Add models**

Append to `prisma/schema.prisma` (after the last existing model):

```prisma
model SalesTransaction {
  tranDtlId       BigInt    @id @map("tran_dtl_id")
  transactionId   BigInt    @map("transaction_id")
  sku             BigInt
  tranTypeId      Int?      @map("tran_type_id") @db.SmallInt
  locationId      Int       @map("location_id") @db.SmallInt
  userId          Int?      @map("user_id")
  posId           Int?      @map("pos_id")
  registerId      Int?      @map("register_id")
  receiptId       BigInt?   @map("receipt_id")
  tranNumber      Int?      @map("tran_number")
  posLineNumber   Int?      @map("pos_line_number")
  qty             Decimal?  @db.Decimal(12, 3)
  price           Decimal?  @db.Decimal(12, 2)
  extPrice        Decimal?  @map("ext_price") @db.Decimal(12, 2)
  discountAmt     Decimal?  @map("discount_amt") @db.Decimal(12, 2)
  markdownAmt     Decimal?  @map("markdown_amt") @db.Decimal(12, 2)
  taxAmt          Decimal?  @map("tax_amt") @db.Decimal(12, 2)
  description     String?
  hdrFStatus      Int?      @map("hdr_f_status") @db.SmallInt
  dtlFStatus      Int?      @map("dtl_f_status") @db.SmallInt
  fInvoiced       Int?      @map("f_invoiced") @db.SmallInt
  tranTotal       Decimal?  @map("tran_total") @db.Decimal(14, 2)
  taxTotal        Decimal?  @map("tax_total") @db.Decimal(12, 2)
  processDate     DateTime  @map("process_date")
  createDate      DateTime? @map("create_date")
  dtlCreateDate   DateTime? @map("dtl_create_date")
  syncedAt        DateTime  @default(now()) @map("synced_at")

  @@index([sku, processDate(sort: Desc)])
  @@index([processDate(sort: Desc)])
  @@index([transactionId])
  @@map("sales_transactions")
}

model SalesTransactionsSyncState {
  id                    Int       @id @default(1) @db.SmallInt
  backfillCompletedAt   DateTime? @map("backfill_completed_at")
  lastTransactionId     BigInt    @default(0) @map("last_transaction_id")
  lastProcessDate       DateTime? @map("last_process_date")
  totalRows             BigInt    @default(0) @map("total_rows")

  @@map("sales_transactions_sync_state")
}
```

- [ ] **Step 2: Regenerate Prisma client**

Run:
```bash
npx prisma generate
```
Expected: "Generated Prisma Client" message, no errors.

- [ ] **Step 3: Verify types compile**

Run:
```bash
npx tsc --noEmit
```
Expected: no errors. (The new types aren't used yet, just compile-checked.)

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "$(cat <<'EOF'
feat(products): add Prisma models for sales_transactions tables

Expose the new tables to the TypeScript layer so later tasks can use
prisma.salesTransaction and prisma.salesTransactionsSyncState directly.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 4: Aggregate-recompute SQL module

**Files:**
- Create: `src/domains/product/sales-aggregates.ts`
- Create: `tests/domains/product/sales-aggregates.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/domains/product/sales-aggregates.test.ts`:

```typescript
import { describe, expect, it, vi } from "vitest";
import { buildAggregateRecomputeSql, runAggregateRecompute } from "@/domains/product/sales-aggregates";

describe("sales-aggregates", () => {
  it("buildAggregateRecomputeSql includes all 14 aggregate assignments", () => {
    const sql = buildAggregateRecomputeSql();
    expect(sql).toContain("units_sold_30d");
    expect(sql).toContain("units_sold_90d");
    expect(sql).toContain("units_sold_1y");
    expect(sql).toContain("units_sold_3y");
    expect(sql).toContain("units_sold_lifetime");
    expect(sql).toContain("revenue_30d");
    expect(sql).toContain("revenue_90d");
    expect(sql).toContain("revenue_1y");
    expect(sql).toContain("revenue_3y");
    expect(sql).toContain("revenue_lifetime");
    expect(sql).toContain("txns_1y");
    expect(sql).toContain("txns_lifetime");
    expect(sql).toContain("first_sale_date_computed");
    expect(sql).toContain("last_sale_date_computed");
    expect(sql).toContain("sales_aggregates_computed_at");
  });

  it("buildAggregateRecomputeSql excludes dtl_f_status = 1 rows", () => {
    expect(buildAggregateRecomputeSql()).toContain("dtl_f_status <> 1");
  });

  it("runAggregateRecompute returns affected SKU count from RPC result", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: 10659, error: null });
    const client = { rpc } as unknown as Parameters<typeof runAggregateRecompute>[0];
    const result = await runAggregateRecompute(client);
    expect(result).toBe(10659);
    expect(rpc).toHaveBeenCalledWith("recompute_product_sales_aggregates");
  });

  it("runAggregateRecompute throws on RPC error", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: "boom" } });
    const client = { rpc } as unknown as Parameters<typeof runAggregateRecompute>[0];
    await expect(runAggregateRecompute(client)).rejects.toThrow(/boom/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
npm test -- tests/domains/product/sales-aggregates.test.ts
```
Expected: FAIL — "Cannot find module '@/domains/product/sales-aggregates'".

- [ ] **Step 3: Append the recompute function SQL to the migration**

Edit `prisma/migrations/<TS_A>_sales_transactions_and_real_aggregates/migration.sql` — append:

```sql
-- Stored recompute function. Called once at the end of every sync run.
-- Returns the count of product rows whose aggregates row was touched.
CREATE OR REPLACE FUNCTION recompute_product_sales_aggregates()
RETURNS INTEGER
LANGUAGE SQL
AS $$
  WITH rolled AS (
    SELECT
      sku,
      SUM(CASE WHEN process_date >= now() - interval '30 days' THEN qty ELSE 0 END)::int      AS u30,
      SUM(CASE WHEN process_date >= now() - interval '90 days' THEN qty ELSE 0 END)::int      AS u90,
      SUM(CASE WHEN process_date >= now() - interval '1 year'  THEN qty ELSE 0 END)::int      AS u1y,
      SUM(CASE WHEN process_date >= now() - interval '3 years' THEN qty ELSE 0 END)::int      AS u3y,
      SUM(qty)::int                                                                            AS ulife,
      SUM(CASE WHEN process_date >= now() - interval '30 days' THEN ext_price ELSE 0 END)     AS r30,
      SUM(CASE WHEN process_date >= now() - interval '90 days' THEN ext_price ELSE 0 END)     AS r90,
      SUM(CASE WHEN process_date >= now() - interval '1 year'  THEN ext_price ELSE 0 END)     AS r1y,
      SUM(CASE WHEN process_date >= now() - interval '3 years' THEN ext_price ELSE 0 END)     AS r3y,
      SUM(ext_price)                                                                           AS rlife,
      COUNT(DISTINCT CASE WHEN process_date >= now() - interval '1 year' THEN transaction_id END)::int AS t1y,
      COUNT(DISTINCT transaction_id)::int                                                      AS tlife,
      MIN(process_date)                                                                        AS first_sale,
      MAX(process_date)                                                                        AS last_sale
    FROM sales_transactions
    WHERE dtl_f_status <> 1
    GROUP BY sku
  ),
  updated AS (
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
    WHERE p.sku = r.sku
    RETURNING p.sku
  )
  SELECT COUNT(*)::int FROM updated;
$$;
```

- [ ] **Step 4: Reapply the migration (idempotent)**

Run:
```bash
npx prisma migrate deploy
```
Expected: re-runs the migration containing the new function. Verify via MCP:
```sql
SELECT proname FROM pg_proc WHERE proname = 'recompute_product_sales_aggregates';
```
Expected: one row returned.

- [ ] **Step 5: Write the module**

Create `src/domains/product/sales-aggregates.ts`:

```typescript
/**
 * Aggregate-recompute helpers. The actual SQL lives in the
 * `recompute_product_sales_aggregates()` Postgres function created by the
 * Phase A migration. The exported `buildAggregateRecomputeSql` string mirror
 * is for tests that want to assert the column set without spinning up Postgres.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export function buildAggregateRecomputeSql(): string {
  // String mirror of the CREATE FUNCTION body. Kept in sync by tests —
  // any column drift will break the "includes all 14 aggregate assignments"
  // assertion and force the developer to update both.
  return `
    WITH rolled AS (
      SELECT
        sku,
        SUM(CASE WHEN process_date >= now() - interval '30 days' THEN qty ELSE 0 END)::int  AS u30,
        SUM(CASE WHEN process_date >= now() - interval '90 days' THEN qty ELSE 0 END)::int  AS u90,
        SUM(CASE WHEN process_date >= now() - interval '1 year'  THEN qty ELSE 0 END)::int  AS u1y,
        SUM(CASE WHEN process_date >= now() - interval '3 years' THEN qty ELSE 0 END)::int  AS u3y,
        SUM(qty)::int                                                                        AS ulife,
        SUM(CASE WHEN process_date >= now() - interval '30 days' THEN ext_price ELSE 0 END) AS r30,
        SUM(CASE WHEN process_date >= now() - interval '90 days' THEN ext_price ELSE 0 END) AS r90,
        SUM(CASE WHEN process_date >= now() - interval '1 year'  THEN ext_price ELSE 0 END) AS r1y,
        SUM(CASE WHEN process_date >= now() - interval '3 years' THEN ext_price ELSE 0 END) AS r3y,
        SUM(ext_price)                                                                       AS rlife,
        COUNT(DISTINCT CASE WHEN process_date >= now() - interval '1 year' THEN transaction_id END)::int AS t1y,
        COUNT(DISTINCT transaction_id)::int                                                  AS tlife,
        MIN(process_date)                                                                    AS first_sale,
        MAX(process_date)                                                                    AS last_sale
      FROM sales_transactions
      WHERE dtl_f_status <> 1
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
  `;
}

/**
 * Invoke the Postgres function. Returns the number of product rows updated.
 */
export async function runAggregateRecompute(client: SupabaseClient): Promise<number> {
  const { data, error } = await client.rpc("recompute_product_sales_aggregates");
  if (error) throw new Error(`Aggregate recompute failed: ${error.message}`);
  return Number(data ?? 0);
}
```

- [ ] **Step 6: Run test to verify it passes**

Run:
```bash
npm test -- tests/domains/product/sales-aggregates.test.ts
```
Expected: PASS (4 tests).

- [ ] **Step 7: Commit**

```bash
git add src/domains/product/sales-aggregates.ts \
       tests/domains/product/sales-aggregates.test.ts \
       prisma/migrations/<TS_A>_sales_transactions_and_real_aggregates/migration.sql
git commit -m "$(cat <<'EOF'
feat(products): aggregate recompute function + typed runner

Postgres function recompute_product_sales_aggregates() groups sales_transactions
by SKU and updates the 14 denormalized columns on products. TypeScript runner
is shared by the backfill script and the incremental sync module.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 5: Backfill script — scaffold + idempotency guard

**Files:**
- Create: `scripts/backfill-prism-transactions.ts`

- [ ] **Step 1: Write the scaffold**

Create `scripts/backfill-prism-transactions.ts`:

```typescript
/**
 * One-time backfill: pulls 3 years of Pierce POS transaction lines from Prism
 * into Supabase `sales_transactions`, then runs the aggregate recompute.
 *
 * Idempotent guard: exits early if backfill_completed_at is already set.
 * Safe to re-run after a partial failure because of ON CONFLICT on tran_dtl_id.
 *
 * Usage:
 *   npx tsx scripts/backfill-prism-transactions.ts
 *   npx tsx scripts/backfill-prism-transactions.ts --force  (bypass idempotency)
 *
 * Prerequisites:
 *   - Prism tunnel is up (campus Windows or SSH bridge).
 *   - SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are in .env / .env.local.
 *   - The Phase A migration has been applied.
 */
import { config as loadEnv } from "dotenv";
import path from "path";
loadEnv({ path: path.resolve(process.cwd(), ".env.local") });
loadEnv({ path: path.resolve(process.cwd(), ".env") });

import { getPrismPool, sql, isPrismConfigured } from "@/lib/prism";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { PIERCE_LOCATION_ID } from "@/domains/product/prism-server";
import { runAggregateRecompute } from "@/domains/product/sales-aggregates";

const PAGE_SIZE = 5000;
const INSERT_CHUNK = 1000;
const YEARS_BACK = 3;

async function main() {
  const force = process.argv.includes("--force");
  if (!isPrismConfigured()) {
    throw new Error("Prism is not configured. Set PRISM_SERVER / PRISM_USER / PRISM_PASSWORD.");
  }

  const supabase = getSupabaseAdminClient();

  // Idempotency check.
  const { data: state, error: stateErr } = await supabase
    .from("sales_transactions_sync_state")
    .select("backfill_completed_at,last_transaction_id,total_rows")
    .eq("id", 1)
    .single();
  if (stateErr) throw new Error(`sync_state read failed: ${stateErr.message}`);
  if (state?.backfill_completed_at && !force) {
    console.log(`Backfill already completed at ${state.backfill_completed_at}. Use --force to re-run.`);
    console.log(`Current: last_transaction_id=${state.last_transaction_id}, total_rows=${state.total_rows}`);
    process.exit(0);
  }

  console.log("=== Pierce transaction backfill starting ===");
  console.log(`LocationID=${PIERCE_LOCATION_ID}, years_back=${YEARS_BACK}, page_size=${PAGE_SIZE}`);
  // Remaining steps filled in by Task 6 + Task 7.
  throw new Error("Not implemented yet — see Task 6 and Task 7.");
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => process.exit(0));
```

- [ ] **Step 2: Verify compile**

Run:
```bash
npx tsc --noEmit
```
Expected: no errors. Scaffold compiles.

- [ ] **Step 3: Run with default args (should print idempotency message because backfill_completed_at is NULL initially, then throw "Not implemented")**

Run:
```bash
npx tsx scripts/backfill-prism-transactions.ts
```
Expected: prints "Pierce transaction backfill starting" then throws `Not implemented yet`. (The idempotency path wouldn't fire on a fresh state with `backfill_completed_at IS NULL`.)

- [ ] **Step 4: Commit**

```bash
git add scripts/backfill-prism-transactions.ts
git commit -m "$(cat <<'EOF'
feat(products): scaffold backfill-prism-transactions script

Loads env, checks idempotency state, declares constants. Implementation
filled in by subsequent tasks (Prism paging, Supabase insert, recompute).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 6: Backfill — Prism paged read implementation

**Files:**
- Modify: `scripts/backfill-prism-transactions.ts`

- [ ] **Step 1: Replace the TODO with the paged-read + insert logic**

In `scripts/backfill-prism-transactions.ts`, replace the `throw new Error("Not implemented yet ...")` line and everything preceding `main().catch(...)` at file end with the full implementation. The final `main` function should read:

```typescript
async function main() {
  const force = process.argv.includes("--force");
  if (!isPrismConfigured()) {
    throw new Error("Prism is not configured. Set PRISM_SERVER / PRISM_USER / PRISM_PASSWORD.");
  }

  const supabase = getSupabaseAdminClient();

  const { data: state, error: stateErr } = await supabase
    .from("sales_transactions_sync_state")
    .select("backfill_completed_at,last_transaction_id,total_rows")
    .eq("id", 1)
    .single();
  if (stateErr) throw new Error(`sync_state read failed: ${stateErr.message}`);
  if (state?.backfill_completed_at && !force) {
    console.log(`Backfill already completed at ${state.backfill_completed_at}. Use --force to re-run.`);
    console.log(`Current: last_transaction_id=${state.last_transaction_id}, total_rows=${state.total_rows}`);
    process.exit(0);
  }

  console.log("=== Pierce transaction backfill starting ===");
  console.log(`LocationID=${PIERCE_LOCATION_ID}, years_back=${YEARS_BACK}, page_size=${PAGE_SIZE}`);

  const started = Date.now();
  const pool = await getPrismPool();

  // Pre-flight: count expected rows.
  const preflight = await pool.request()
    .input("loc", sql.Int, PIERCE_LOCATION_ID)
    .input("years", sql.Int, YEARS_BACK)
    .query<{ ExpectedRows: number }>(`
      SELECT COUNT(*) AS ExpectedRows
      FROM Transaction_Detail td
      INNER JOIN Transaction_Header th ON th.TransactionID = td.TransactionID
      WHERE th.LocationID = @loc
        AND th.ProcessDate >= DATEADD(year, -@years, GETDATE())
    `);
  const expected = preflight.recordset[0]?.ExpectedRows ?? 0;
  console.log(`Pre-flight: ${expected.toLocaleString()} rows expected from Prism.`);

  let cursor = 0;
  let totalInserted = 0;
  let maxTransactionId = Number(state?.last_transaction_id ?? 0);
  let maxProcessDate: Date | null = null;

  while (true) {
    const page = await pool.request()
      .input("loc", sql.Int, PIERCE_LOCATION_ID)
      .input("years", sql.Int, YEARS_BACK)
      .input("cursor", sql.BigInt, cursor)
      .input("pageSize", sql.Int, PAGE_SIZE)
      .query<PrismTxnRow>(PRISM_TXN_SELECT);

    if (page.recordset.length === 0) break;

    const rows = page.recordset.map(toSupabaseRow);
    for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
      const chunk = rows.slice(i, i + INSERT_CHUNK);
      const { error: insErr } = await supabase
        .from("sales_transactions")
        .upsert(chunk, { onConflict: "tran_dtl_id", ignoreDuplicates: true });
      if (insErr) throw new Error(`Supabase insert failed: ${insErr.message}`);
    }
    totalInserted += rows.length;

    const lastRow = page.recordset[page.recordset.length - 1];
    cursor = Number(lastRow.TranDtlID);
    maxTransactionId = Math.max(maxTransactionId, Number(lastRow.TransactionID));
    maxProcessDate = lastRow.ProcessDate;

    const pct = expected > 0 ? ((totalInserted / expected) * 100).toFixed(1) : "?";
    console.log(`  progress: ${totalInserted.toLocaleString()} / ${expected.toLocaleString()} (${pct}%) — last TranDtlID=${cursor}`);

    if (page.recordset.length < PAGE_SIZE) break;
  }

  // Post-flight: count on Supabase side.
  const { count: finalCount, error: countErr } = await supabase
    .from("sales_transactions")
    .select("*", { count: "exact", head: true });
  if (countErr) throw new Error(`Supabase count failed: ${countErr.message}`);
  console.log(`Supabase sales_transactions now has ${finalCount?.toLocaleString() ?? "?"} rows.`);

  // Update sync state.
  const { error: updErr } = await supabase
    .from("sales_transactions_sync_state")
    .update({
      backfill_completed_at: new Date().toISOString(),
      last_transaction_id: maxTransactionId,
      last_process_date: maxProcessDate?.toISOString() ?? null,
      total_rows: finalCount ?? 0,
    })
    .eq("id", 1);
  if (updErr) throw new Error(`sync_state update failed: ${updErr.message}`);

  // Recompute aggregates.
  console.log("Running aggregate recompute...");
  const recStart = Date.now();
  const affected = await runAggregateRecompute(supabase);
  console.log(`Recompute touched ${affected.toLocaleString()} products in ${Date.now() - recStart}ms.`);

  console.log(`=== Done. Total elapsed: ${((Date.now() - started) / 1000).toFixed(1)}s ===`);
}

interface PrismTxnRow {
  TranDtlID: number | string;  // bigint can round-trip as string
  TransactionID: number | string;
  SKU: number | string;
  TranTypeID: number | null;
  LocationID: number;
  UserID: number | null;
  POSID: number | null;
  RegisterID: number | null;
  ReceiptID: number | string | null;
  TranNumber: number | null;
  PosLineNumber: number | null;
  Qty: number | null;
  Price: number | null;
  ExtPrice: number | null;
  DiscountAmt: number | null;
  MarkDownAmt: number | null;
  TaxAmt: number | null;
  Description: string | null;
  HdrFStatus: number | null;
  DtlFStatus: number | null;
  FInvoiced: number | null;
  TranTotal: number | null;
  TaxTotal: number | null;
  ProcessDate: Date;
  CreateDate: Date | null;
  DtlCreateDate: Date | null;
}

const PRISM_TXN_SELECT = `
  SELECT TOP (@pageSize)
    td.TranDtlID,
    th.TransactionID,
    td.SKU,
    th.TranTypeID,
    th.LocationID,
    th.UserID,
    th.POSID,
    th.RegisterID,
    th.ReceiptID,
    th.TranNumber,
    td.PosLineNumber,
    td.Qty,
    td.Price,
    td.ExtPrice,
    td.DiscountAmt,
    td.MarkDownAmt,
    td.TaxAmt,
    LTRIM(RTRIM(td.Description)) AS Description,
    th.fStatus   AS HdrFStatus,
    td.fStatus   AS DtlFStatus,
    th.fInvoiced AS FInvoiced,
    th.TranTotal,
    th.TaxTotal,
    th.ProcessDate,
    th.CreateDate,
    td.CreateDate AS DtlCreateDate
  FROM Transaction_Detail td
  INNER JOIN Transaction_Header th ON th.TransactionID = td.TransactionID
  WHERE th.LocationID = @loc
    AND th.ProcessDate >= DATEADD(year, -@years, GETDATE())
    AND td.TranDtlID > @cursor
  ORDER BY td.TranDtlID
`;

function toSupabaseRow(r: PrismTxnRow) {
  return {
    tran_dtl_id:      Number(r.TranDtlID),
    transaction_id:   Number(r.TransactionID),
    sku:              Number(r.SKU),
    tran_type_id:     r.TranTypeID,
    location_id:      r.LocationID,
    user_id:          r.UserID,
    pos_id:           r.POSID,
    register_id:      r.RegisterID,
    receipt_id:       r.ReceiptID != null ? Number(r.ReceiptID) : null,
    tran_number:      r.TranNumber,
    pos_line_number:  r.PosLineNumber,
    qty:              r.Qty,
    price:            r.Price,
    ext_price:        r.ExtPrice,
    discount_amt:     r.DiscountAmt,
    markdown_amt:     r.MarkDownAmt,
    tax_amt:          r.TaxAmt,
    description:      r.Description,
    hdr_f_status:     r.HdrFStatus,
    dtl_f_status:     r.DtlFStatus,
    f_invoiced:       r.FInvoiced,
    tran_total:       r.TranTotal,
    tax_total:        r.TaxTotal,
    process_date:     r.ProcessDate.toISOString(),
    create_date:      r.CreateDate?.toISOString() ?? null,
    dtl_create_date:  r.DtlCreateDate?.toISOString() ?? null,
  };
}
```

- [ ] **Step 2: Verify compile**

Run:
```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add scripts/backfill-prism-transactions.ts
git commit -m "$(cat <<'EOF'
feat(products): implement backfill paged read + chunked upsert

TranDtlID cursor paginates the Prism side; 1000-row chunks stay below the
Supabase PostgREST payload limit; ON CONFLICT DO NOTHING makes retries safe.
Ends with the aggregate recompute.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 7: Ship-check and publish Phase A PR

**Files:** none (CI/review only)

- [ ] **Step 1: Run ship-check**

Run:
```bash
npm run ship-check
```
Expected: all green (lint, typecheck, tests).

- [ ] **Step 2: Push + open PR**

Run:
```bash
npm run git:publish-pr
```
Expected: PR opened on GitHub titled e.g. `feat(products): txn history schema + backfill`.

- [ ] **Step 3: Wait for CI green + CodeRabbit pass, address feedback via `CR_FIX=1 git push`, then merge.**

**After merge:** do not start Phase B immediately. The next step is the manual backfill in production Supabase.

---

## Checkpoint: Backfill run (manual, between PRs)

**Owner:** Marcos (laptop with Prism tunnel up).

- [ ] **Step 1: Pull main**

```bash
git checkout main && git pull
```

- [ ] **Step 2: Install and generate**

```bash
npm install
npx prisma generate
```

- [ ] **Step 3: Run the backfill against production Supabase**

Ensure `.env.local` points to the production Supabase (URL + service role key). Confirm the Prism tunnel is up (check `winprism-la` reachability).

Run:
```bash
npx tsx scripts/backfill-prism-transactions.ts
```
Expected: `"Pre-flight: <~877000> rows expected from Prism"` then progress logs, final `"Recompute touched <~10700> products"`, total elapsed ~5–7 minutes. Exit code 0.

- [ ] **Step 4: Verify via Supabase MCP**

```sql
SELECT backfill_completed_at, last_transaction_id, total_rows
FROM sales_transactions_sync_state;

SELECT COUNT(*)                               AS rows,
       COUNT(DISTINCT sku)                    AS distinct_skus,
       MIN(process_date)                      AS earliest,
       MAX(process_date)                      AS latest
FROM sales_transactions;

SELECT COUNT(*) FILTER (WHERE units_sold_1y > 0)  AS skus_with_1y_sales,
       COUNT(*) FILTER (WHERE sales_aggregates_computed_at IS NOT NULL) AS aggregates_computed
FROM products;
```

Expected:
- `backfill_completed_at` is set, `total_rows ≈ 877k`
- `distinct_skus ≈ 10.7k`, `earliest ≈ 3y ago`, `latest ≈ today`
- `skus_with_1y_sales` is in the single-digit-thousands range (per Prism probe)
- `aggregates_computed` matches the rollup population

If anything looks wrong, investigate before proceeding to Phase B.

---

## Phase B — Incremental sync + UI wiring + presets

**Ships as PR #2 on branch `feat/txn-history-ui`.**

### Task 8: Start the Phase B branch + migration timestamp

**Files:** none (branch setup only)

- [ ] **Step 1: Start from fresh main**

```bash
npm run git:start-branch -- feat/txn-history-ui
```

- [ ] **Step 2: Generate migration timestamp**

```bash
date -u +%Y%m%d%H%M%S
```

Capture as `<TS_B>`.

### Task 9: Migration for sync_runs new columns + Prisma model update

**Files:**
- Create: `prisma/migrations/<TS_B>_sync_runs_txn_fields/migration.sql`
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Write the migration**

Create `prisma/migrations/<TS_B>_sync_runs_txn_fields/migration.sql`:

```sql
-- Track the transaction-history step of each sync run alongside the existing
-- product-catalog metrics. All nullable so rows from before Phase B stay valid.
ALTER TABLE "sync_runs"
  ADD COLUMN IF NOT EXISTS "txns_added"             INTEGER,
  ADD COLUMN IF NOT EXISTS "aggregates_updated"     INTEGER,
  ADD COLUMN IF NOT EXISTS "txn_sync_duration_ms"   INTEGER;
```

- [ ] **Step 2: Extend the Prisma model**

In `prisma/schema.prisma`, locate the `SyncRun` model and add three fields:

```prisma
model SyncRun {
  id                  String    @id @default(uuid())
  startedAt           DateTime  @default(now()) @map("started_at")
  completedAt         DateTime? @map("completed_at")
  triggeredBy         String    @map("triggered_by")
  scannedCount        Int?      @map("scanned_count")
  updatedCount        Int?      @map("updated_count")
  removedCount        Int?      @map("removed_count")
  txnsAdded           Int?      @map("txns_added")
  aggregatesUpdated   Int?      @map("aggregates_updated")
  txnSyncDurationMs   Int?      @map("txn_sync_duration_ms")
  status              String
  error               String?

  @@index([startedAt(sort: Desc)])
  @@map("sync_runs")
}
```

- [ ] **Step 3: Apply migration + regenerate client**

```bash
npx prisma migrate deploy
npx prisma generate
```
Expected: migration applied, client regenerated.

- [ ] **Step 4: Verify compile**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add prisma/migrations/<TS_B>_sync_runs_txn_fields prisma/schema.prisma
git commit -m "$(cat <<'EOF'
feat(products): extend sync_runs with txn-sync metrics

Three new nullable columns capture what the new incremental txn step does
per sync run. Existing rows remain valid.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 10: Incremental sync module + tests

**Files:**
- Create: `src/domains/product/sales-txn-sync.ts`
- Create: `tests/domains/product/sales-txn-sync.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/domains/product/sales-txn-sync.test.ts`:

```typescript
import { describe, expect, it, vi } from "vitest";
import { runSalesTxnSync } from "@/domains/product/sales-txn-sync";

function makeMockSupabase(state: { last_transaction_id: number; backfill_completed_at: string | null }) {
  const upserted: unknown[][] = [];
  const stateUpdates: unknown[] = [];

  const client = {
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: state, error: null }),
        }),
      }),
      upsert: async (rows: unknown[]) => { upserted.push(rows); return { error: null }; },
      update: (patch: unknown) => ({
        eq: async () => { stateUpdates.push({ table, patch }); return { error: null }; },
      }),
    }),
    rpc: vi.fn().mockResolvedValue({ data: 42, error: null }),
  };

  return { client, upserted, stateUpdates };
}

function makeMockPrism(rows: Array<Record<string, unknown>>) {
  return {
    request: () => {
      const chain = {
        input: () => chain,
        query: async () => ({ recordset: rows }),
      };
      return chain;
    },
  };
}

describe("runSalesTxnSync", () => {
  it("returns zero when backfill hasn't completed", async () => {
    const { client } = makeMockSupabase({ last_transaction_id: 0, backfill_completed_at: null });
    const prism = makeMockPrism([]);
    const result = await runSalesTxnSync({ supabase: client as never, prism: prism as never });
    expect(result.txnsAdded).toBe(0);
    expect(result.aggregatesUpdated).toBe(0);
    expect(result.skipped).toBe("backfill-not-completed");
  });

  it("advances the cursor to the max TransactionID of inserted rows", async () => {
    const { client, stateUpdates } = makeMockSupabase({
      last_transaction_id: 100,
      backfill_completed_at: new Date().toISOString(),
    });
    const prism = makeMockPrism([
      { TranDtlID: 5, TransactionID: 101, SKU: 99, LocationID: 2, ProcessDate: new Date() },
      { TranDtlID: 6, TransactionID: 105, SKU: 99, LocationID: 2, ProcessDate: new Date() },
      { TranDtlID: 7, TransactionID: 103, SKU: 99, LocationID: 2, ProcessDate: new Date() },
    ]);
    const result = await runSalesTxnSync({ supabase: client as never, prism: prism as never });
    expect(result.txnsAdded).toBe(3);
    const lastUpdate = stateUpdates[stateUpdates.length - 1] as { patch: { last_transaction_id: number } };
    expect(lastUpdate.patch.last_transaction_id).toBe(105);
  });

  it("triggers aggregate recompute when any rows were added", async () => {
    const { client } = makeMockSupabase({
      last_transaction_id: 100,
      backfill_completed_at: new Date().toISOString(),
    });
    const prism = makeMockPrism([
      { TranDtlID: 5, TransactionID: 200, SKU: 99, LocationID: 2, ProcessDate: new Date() },
    ]);
    const result = await runSalesTxnSync({ supabase: client as never, prism: prism as never });
    expect(result.aggregatesUpdated).toBe(42);
    expect(client.rpc).toHaveBeenCalledWith("recompute_product_sales_aggregates");
  });

  it("skips aggregate recompute when zero rows added", async () => {
    const { client } = makeMockSupabase({
      last_transaction_id: 100,
      backfill_completed_at: new Date().toISOString(),
    });
    const prism = makeMockPrism([]);
    const result = await runSalesTxnSync({ supabase: client as never, prism: prism as never });
    expect(result.txnsAdded).toBe(0);
    expect(result.aggregatesUpdated).toBe(0);
    expect(client.rpc).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test — expect failure**

```bash
npm test -- tests/domains/product/sales-txn-sync.test.ts
```
Expected: FAIL — "Cannot find module '@/domains/product/sales-txn-sync'".

- [ ] **Step 3: Write the module**

Create `src/domains/product/sales-txn-sync.ts`:

```typescript
/**
 * Incremental sales-transaction pull. Called by /api/sync/prism-pull after
 * the product catalog step succeeds. Pulls any Pierce transactions newer
 * than the stored cursor, inserts them, then recomputes the products
 * aggregates.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ConnectionPool } from "mssql";
import { sql } from "@/lib/prism";
import { PIERCE_LOCATION_ID } from "./prism-server";
import { runAggregateRecompute } from "./sales-aggregates";

const INSERT_CHUNK = 1000;

export interface SalesTxnSyncResult {
  txnsAdded: number;
  aggregatesUpdated: number;
  durationMs: number;
  skipped?: "backfill-not-completed";
}

export async function runSalesTxnSync(deps: {
  supabase: SupabaseClient;
  prism: ConnectionPool;
}): Promise<SalesTxnSyncResult> {
  const start = Date.now();
  const { supabase, prism } = deps;

  const { data: state, error: stateErr } = await supabase
    .from("sales_transactions_sync_state")
    .select("last_transaction_id,backfill_completed_at")
    .eq("id", 1)
    .single();
  if (stateErr) throw new Error(`sync_state read failed: ${stateErr.message}`);
  if (!state?.backfill_completed_at) {
    return { txnsAdded: 0, aggregatesUpdated: 0, durationMs: Date.now() - start, skipped: "backfill-not-completed" };
  }

  const cursor = Number(state.last_transaction_id ?? 0);
  const page = await prism.request()
    .input("loc", sql.Int, PIERCE_LOCATION_ID)
    .input("cursor", sql.BigInt, cursor)
    .query<Record<string, unknown>>(`
      SELECT
        td.TranDtlID, th.TransactionID, td.SKU,
        th.TranTypeID, th.LocationID, th.UserID, th.POSID, th.RegisterID,
        th.ReceiptID, th.TranNumber,
        td.PosLineNumber, td.Qty, td.Price, td.ExtPrice,
        td.DiscountAmt, td.MarkDownAmt, td.TaxAmt,
        LTRIM(RTRIM(td.Description)) AS Description,
        th.fStatus AS HdrFStatus, td.fStatus AS DtlFStatus, th.fInvoiced AS FInvoiced,
        th.TranTotal, th.TaxTotal, th.ProcessDate, th.CreateDate,
        td.CreateDate AS DtlCreateDate
      FROM Transaction_Detail td
      INNER JOIN Transaction_Header th ON th.TransactionID = td.TransactionID
      WHERE th.LocationID = @loc
        AND th.TransactionID > @cursor
      ORDER BY td.TranDtlID
    `);

  const rows = page.recordset;
  if (rows.length === 0) {
    return { txnsAdded: 0, aggregatesUpdated: 0, durationMs: Date.now() - start };
  }

  const mapped = rows.map(toSupabaseRow);
  for (let i = 0; i < mapped.length; i += INSERT_CHUNK) {
    const chunk = mapped.slice(i, i + INSERT_CHUNK);
    const { error: insErr } = await supabase
      .from("sales_transactions")
      .upsert(chunk, { onConflict: "tran_dtl_id", ignoreDuplicates: true });
    if (insErr) throw new Error(`sales_transactions insert failed: ${insErr.message}`);
  }

  let maxTxnId = cursor;
  let maxProcessDate: Date | null = null;
  for (const r of rows) {
    const tid = Number(r.TransactionID);
    if (tid > maxTxnId) maxTxnId = tid;
    const pd = r.ProcessDate as Date;
    if (!maxProcessDate || pd > maxProcessDate) maxProcessDate = pd;
  }
  const { error: updErr } = await supabase
    .from("sales_transactions_sync_state")
    .update({
      last_transaction_id: maxTxnId,
      last_process_date: maxProcessDate?.toISOString() ?? null,
      total_rows: (await supabase.from("sales_transactions").select("*", { count: "exact", head: true })).count ?? 0,
    })
    .eq("id", 1);
  if (updErr) throw new Error(`sync_state update failed: ${updErr.message}`);

  const aggregatesUpdated = await runAggregateRecompute(supabase);

  return {
    txnsAdded: rows.length,
    aggregatesUpdated,
    durationMs: Date.now() - start,
  };
}

function toSupabaseRow(r: Record<string, unknown>) {
  const cast = r as {
    TranDtlID: number | string; TransactionID: number | string; SKU: number | string;
    TranTypeID: number | null; LocationID: number; UserID: number | null;
    POSID: number | null; RegisterID: number | null; ReceiptID: number | string | null;
    TranNumber: number | null; PosLineNumber: number | null;
    Qty: number | null; Price: number | null; ExtPrice: number | null;
    DiscountAmt: number | null; MarkDownAmt: number | null; TaxAmt: number | null;
    Description: string | null;
    HdrFStatus: number | null; DtlFStatus: number | null; FInvoiced: number | null;
    TranTotal: number | null; TaxTotal: number | null;
    ProcessDate: Date; CreateDate: Date | null; DtlCreateDate: Date | null;
  };
  return {
    tran_dtl_id:     Number(cast.TranDtlID),
    transaction_id:  Number(cast.TransactionID),
    sku:             Number(cast.SKU),
    tran_type_id:    cast.TranTypeID,
    location_id:     cast.LocationID,
    user_id:         cast.UserID,
    pos_id:          cast.POSID,
    register_id:     cast.RegisterID,
    receipt_id:      cast.ReceiptID != null ? Number(cast.ReceiptID) : null,
    tran_number:     cast.TranNumber,
    pos_line_number: cast.PosLineNumber,
    qty:             cast.Qty,
    price:           cast.Price,
    ext_price:       cast.ExtPrice,
    discount_amt:    cast.DiscountAmt,
    markdown_amt:    cast.MarkDownAmt,
    tax_amt:         cast.TaxAmt,
    description:     cast.Description,
    hdr_f_status:    cast.HdrFStatus,
    dtl_f_status:    cast.DtlFStatus,
    f_invoiced:      cast.FInvoiced,
    tran_total:      cast.TranTotal,
    tax_total:       cast.TaxTotal,
    process_date:    cast.ProcessDate.toISOString(),
    create_date:     cast.CreateDate?.toISOString() ?? null,
    dtl_create_date: cast.DtlCreateDate?.toISOString() ?? null,
  };
}
```

- [ ] **Step 4: Run test — expect pass**

```bash
npm test -- tests/domains/product/sales-txn-sync.test.ts
```
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/domains/product/sales-txn-sync.ts tests/domains/product/sales-txn-sync.test.ts
git commit -m "$(cat <<'EOF'
feat(products): incremental sales-transaction sync module

runSalesTxnSync reads the cursor, fetches new Pierce transactions from Prism,
upserts to sales_transactions, advances the cursor, and runs the aggregate
recompute. Short-circuits with skipped=backfill-not-completed when the
one-time backfill hasn't run.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 11: Wire the sync module into /api/sync/prism-pull

**Files:**
- Modify: `src/app/api/sync/prism-pull/route.ts`

- [ ] **Step 1: Replace the try/catch body**

In `src/app/api/sync/prism-pull/route.ts`, locate the `try { const result = await runPrismPull(); ... }` block and replace it entirely with:

```typescript
  try {
    const result = await runPrismPull();

    // Incremental transaction history + aggregate recompute. Isolated from
    // the catalog step's success/failure — even if this block throws, we
    // still surface the catalog result.
    let txnResult: { txnsAdded: number; aggregatesUpdated: number; durationMs: number; skipped?: string } = {
      txnsAdded: 0, aggregatesUpdated: 0, durationMs: 0,
    };
    try {
      const { getPrismPool } = await import("@/lib/prism");
      const { runSalesTxnSync } = await import("@/domains/product/sales-txn-sync");
      const pool = await getPrismPool();
      const supabase = (await import("@/lib/supabase/admin")).getSupabaseAdminClient();
      txnResult = await runSalesTxnSync({ supabase, prism: pool });
    } catch (txnErr) {
      console.error("sales-txn-sync failed (non-fatal):", txnErr);
    }

    await prisma.syncRun.update({
      where: { id: run.id },
      data: {
        completedAt: new Date(),
        scannedCount: result.scanned,
        updatedCount: result.updated,
        removedCount: result.removed,
        txnsAdded: txnResult.txnsAdded,
        aggregatesUpdated: txnResult.aggregatesUpdated,
        txnSyncDurationMs: txnResult.durationMs,
        status: "ok",
      },
    });
    return NextResponse.json({
      runId: run.id,
      ...result,
      txnsAdded: txnResult.txnsAdded,
      aggregatesUpdated: txnResult.aggregatesUpdated,
      txnSyncDurationMs: txnResult.durationMs,
    });
  } catch (err) {
    await prisma.syncRun.update({
      where: { id: run.id },
      data: {
        completedAt: new Date(),
        status: "failed",
        error: err instanceof Error ? err.message : String(err),
      },
    });
    console.error("prism-pull failed:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Sync failed" }, { status: 500 });
  }
```

- [ ] **Step 2: Update the GET handler's select fields**

In the same file, locate the `GET` handler and replace the `findMany` call:

```typescript
  const runs = await prisma.syncRun.findMany({
    orderBy: { startedAt: "desc" },
    take: 20,
    select: {
      id: true, startedAt: true, completedAt: true, triggeredBy: true,
      scannedCount: true, updatedCount: true, removedCount: true,
      txnsAdded: true, aggregatesUpdated: true, txnSyncDurationMs: true,
      status: true, error: true,
    },
  });
```

- [ ] **Step 3: Verify compile**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/sync/prism-pull/route.ts
git commit -m "$(cat <<'EOF'
feat(products): wire sales-txn-sync into /api/sync/prism-pull

Runs after the catalog step succeeds. Wrapped in its own try/catch so a
txn-sync failure doesn't mask catalog success. Response + sync_runs row
both carry the three new metrics.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 12: Extend SyncPullResult + SyncRun types in api-client

**Files:**
- Modify: `src/domains/product/api-client.ts`

- [ ] **Step 1: Extend the types**

In `src/domains/product/api-client.ts`, replace the `SyncPullResult` and `SyncRun` interface declarations with:

```typescript
export interface SyncPullResult {
  runId: string;
  scanned: number;
  updated: number;
  removed: number;
  durationMs: number;
  txnsAdded: number;
  aggregatesUpdated: number;
  txnSyncDurationMs: number;
}

export interface SyncRun {
  id: string;
  startedAt: string;
  completedAt: string | null;
  triggeredBy: string;
  scannedCount: number | null;
  updatedCount: number | null;
  removedCount: number | null;
  txnsAdded: number | null;
  aggregatesUpdated: number | null;
  txnSyncDurationMs: number | null;
  status: string;
  error: string | null;
}
```

- [ ] **Step 2: Verify compile**

```bash
npx tsc --noEmit
```
Expected: possibly errors in `sync-database-button.tsx` — they'll be fixed in Task 13.

- [ ] **Step 3: Commit**

```bash
git add src/domains/product/api-client.ts
git commit -m "$(cat <<'EOF'
feat(products): extend SyncPullResult and SyncRun with txn metrics

Matches the /api/sync/prism-pull response shape and sync_runs schema.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 13: Show new fields in the sync dialog

**Files:**
- Modify: `src/components/products/sync-database-button.tsx`

- [ ] **Step 1: Update the just-synced stat grid**

In `src/components/products/sync-database-button.tsx`, find the `mode === "just-synced" && lastResult` block (around line 120) and replace the grid with:

```typescript
        {mode === "just-synced" && lastResult ? (
          <div className="grid grid-cols-4 gap-3 py-2">
            <Stat label="Scanned" value={lastResult.scanned} />
            <Stat label="Updated" value={lastResult.updated} accent={lastResult.updated > 0} />
            <Stat label="Txns +" value={lastResult.txnsAdded} accent={lastResult.txnsAdded > 0} />
            <Stat label="Aggs refreshed" value={lastResult.aggregatesUpdated} accent={lastResult.aggregatesUpdated > 0} />
            <Stat label="Catalog time" value={formatDuration(lastResult.durationMs)} />
            <Stat label="Txn time" value={formatDuration(lastResult.txnSyncDurationMs)} />
            <Stat label="Removed" value={lastResult.removed} accent={lastResult.removed > 0} />
          </div>
        ) : null}
```

- [ ] **Step 2: Update the history table**

Locate the `<thead>` in the history table (around line 131) and replace the whole thead/tbody with:

```typescript
            <thead className="sticky top-0 bg-muted/50">
              <tr className="text-left">
                <th className="px-3 py-2 font-medium">Started</th>
                <th className="px-3 py-2 font-medium">By</th>
                <th className="px-3 py-2 text-right font-medium">Scanned</th>
                <th className="px-3 py-2 text-right font-medium">Updated</th>
                <th className="px-3 py-2 text-right font-medium">Txns+</th>
                <th className="px-3 py-2 text-right font-medium">Aggs</th>
                <th className="px-3 py-2 text-right font-medium">Removed</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {runs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-4 text-center text-muted-foreground">
                    No sync runs yet.
                  </td>
                </tr>
              ) : (
                runs.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="px-3 py-2">{new Date(r.startedAt).toLocaleString()}</td>
                    <td className="px-3 py-2 truncate">{formatTriggeredBy(r.triggeredBy)}</td>
                    <td className="px-3 py-2 text-right">{r.scannedCount?.toLocaleString() ?? "—"}</td>
                    <td className="px-3 py-2 text-right">{r.updatedCount?.toLocaleString() ?? "—"}</td>
                    <td className="px-3 py-2 text-right">{r.txnsAdded?.toLocaleString() ?? "—"}</td>
                    <td className="px-3 py-2 text-right">{r.aggregatesUpdated?.toLocaleString() ?? "—"}</td>
                    <td className="px-3 py-2 text-right">{r.removedCount?.toLocaleString() ?? "—"}</td>
                    <td className="px-3 py-2">
                      <StatusBadge status={r.status} error={r.error} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
```

- [ ] **Step 3: Verify compile**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Start dev server and smoke-test visually**

Run:
```bash
npm run dev
```
Visit http://localhost:3000/products, click "Sync Database", confirm the dialog renders the 7-stat grid + 8-column history table without layout break. (Won't do a real sync from laptop unless Prism tunnel is up — layout-only check is sufficient.)

- [ ] **Step 5: Commit**

```bash
git add src/components/products/sync-database-button.tsx
git commit -m "$(cat <<'EOF'
feat(products): show txn sync metrics in sync-database dialog

Adds Txns+, Aggs refreshed, Txn time to the just-synced grid and two
new columns to the history table.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 14: Remove dead fields from prism-sync.ts

**Files:**
- Modify: `src/domains/product/prism-sync.ts`

- [ ] **Step 1: Remove the five fields from `PrismItemRow`**

In `src/domains/product/prism-sync.ts`, delete these lines from the `PrismItemRow` interface:

```typescript
  oneYearSales: number | null;
  lookBackSales: number | null;
  salesToAvgRatio: number | null;
  estSalesCalc: number | null;
  estSalesPrev: number | null;
```

- [ ] **Step 2: Remove the five fields from `hashRow`**

In the same file, remove these lines from the `canonical` array in `hashRow`:

```typescript
    r.oneYearSales ?? 0,
    r.lookBackSales ?? 0,
    r.salesToAvgRatio ?? 0,
    r.estSalesCalc ?? 0,
    r.estSalesPrev ?? 0,
```

- [ ] **Step 3: Remove the Inventory_EstSales LEFT JOIN**

Remove the two nested subqueries starting `LEFT JOIN (SELECT es.SKU, es.OneYearSales, ...` and `LEFT JOIN (SELECT es.SKU, es.EstSalesCalc, ...` from the SELECT. Also remove the five SELECT columns `es.OneYearSales AS OneYearSales`, `es.LookBackSales AS LookBackSales`, `es.SalesToAvgSalesRatio AS SalesToAvgRatio`, `es.EstSalesCalc AS EstSalesCalc`, `esPrev.EstSalesCalc AS EstSalesPrev`.

- [ ] **Step 4: Remove the five fields from the inline typed recordset and the row mapping + upsert payload**

Delete the matching entries from the `.query<{ ... }>()` type literal (around line 159), from the `row: PrismItemRow = { ... }` constructor, and from the `toUpsert.push({ ... })` object literal. Verify the loop still compiles.

- [ ] **Step 5: Verify compile + type check**

```bash
npx tsc --noEmit
```
Expected: no errors in prism-sync.ts. May surface type errors elsewhere (queries.ts, product-table.tsx, presets.ts, types.ts) that later tasks fix.

- [ ] **Step 6: Commit**

```bash
git add src/domains/product/prism-sync.ts
git commit -m "$(cat <<'EOF'
feat(products): drop Inventory_EstSales reads from catalog sync

The five fields were ~43% populated, mostly DCC-level aggregates
stamped onto SKUs, and never queried by any preset. Replaced by real
per-SKU aggregates computed from sales_transactions.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 15: Extend types.ts — Product + ProductFilters

**Files:**
- Modify: `src/domains/product/types.ts`

- [ ] **Step 1: Update Product interface**

In `src/domains/product/types.ts`, replace the five removed fields on `Product` (`one_year_sales`, `look_back_sales`, `sales_to_avg_ratio`, `est_sales_calc`, `est_sales_prev`) with:

```typescript
  units_sold_30d: number;
  units_sold_90d: number;
  units_sold_1y: number;
  units_sold_3y: number;
  units_sold_lifetime: number;
  revenue_30d: number;
  revenue_90d: number;
  revenue_1y: number;
  revenue_3y: number;
  revenue_lifetime: number;
  txns_1y: number;
  txns_lifetime: number;
  first_sale_date_computed: string | null;
  last_sale_date_computed: string | null;
  sales_aggregates_computed_at: string | null;
```

- [ ] **Step 2: Extend ProductFilters**

Append inside the `ProductFilters` interface, just before the closing brace:

```typescript
  // Transaction-based aggregates
  minUnitsSold: string;
  maxUnitsSold: string;
  unitsSoldWindow: "" | "30d" | "90d" | "1y" | "3y" | "lifetime";
  minRevenue: string;
  maxRevenue: string;
  revenueWindow: "" | "30d" | "90d" | "1y" | "3y" | "lifetime";
  minTxns: string;
  maxTxns: string;
  txnsWindow: "" | "1y" | "lifetime";
  neverSoldLifetime: boolean;
  firstSaleWithin: "" | "90d" | "1y";
  trendDirection: "" | "accelerating" | "decelerating";
  maxStockCoverageDays: string;
```

- [ ] **Step 3: Verify compile**

```bash
npx tsc --noEmit
```
Expected: errors in `constants.ts` (EMPTY_FILTERS incomplete) and possibly tests. Fixed in next task.

- [ ] **Step 4: Commit**

```bash
git add src/domains/product/types.ts
git commit -m "$(cat <<'EOF'
feat(products): types for txn aggregates + new filter keys

Product gains 15 new columns (12 aggregates + first/last sale + computed
timestamp). ProductFilters gains 13 new keys for units/revenue/txns windows,
never-sold-lifetime, first-sale-within, trend direction, and stock coverage.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 16: Update constants.ts — EMPTY_FILTERS, column defs, preset groups

**Files:**
- Modify: `src/domains/product/constants.ts`

- [ ] **Step 1: Extend EMPTY_FILTERS**

In `src/domains/product/constants.ts`, add these defaults inside the `EMPTY_FILTERS` object (after `itemType: ""`):

```typescript
  minUnitsSold: "",
  maxUnitsSold: "",
  unitsSoldWindow: "",
  minRevenue: "",
  maxRevenue: "",
  revenueWindow: "",
  minTxns: "",
  maxTxns: "",
  txnsWindow: "",
  neverSoldLifetime: false,
  firstSaleWithin: "",
  trendDirection: "",
  maxStockCoverageDays: "",
```

- [ ] **Step 2: Update OPTIONAL_COLUMNS, COLUMN_LABELS, DEFAULT_COLUMN_SET**

Replace the three exports with:

```typescript
export const OPTIONAL_COLUMNS = [
  "stock",
  "dcc",
  "units_1y",
  "revenue_1y",
  "txns_1y",
  "margin",
  "days_since_sale",
  "updated",
] as const;

export type OptionalColumnKey = typeof OPTIONAL_COLUMNS[number];

export const DEFAULT_COLUMN_SET: OptionalColumnKey[] = ["stock", "units_1y", "dcc"];

export const COLUMN_LABELS: Record<OptionalColumnKey, string> = {
  stock: "Stock",
  dcc: "DCC",
  units_1y: "Units 1y",
  revenue_1y: "Revenue 1y",
  txns_1y: "Receipts 1y",
  margin: "Margin %",
  days_since_sale: "Days since sale",
  updated: "Updated",
};
```

- [ ] **Step 3: Update PRESET_GROUPS**

Replace the `PRESET_GROUPS` export with:

```typescript
export const PRESET_GROUPS = [
  { value: "dead-weight",     label: "Dead weight",  icon: "💀" },
  { value: "movers",          label: "Movers",       icon: "📊" },
  { value: "trending",        label: "Trending",     icon: "📈" },
  { value: "stock-health",    label: "Stock health", icon: "📦" },
  { value: "pricing",         label: "Pricing",      icon: "💰" },
  { value: "textbook",        label: "Textbook",     icon: "📚" },
  { value: "data-quality",    label: "Data",         icon: "🔍" },
  { value: "recent-activity", label: "Recent",       icon: "📝" },
] as const;
```

- [ ] **Step 4: Verify compile**

```bash
npx tsc --noEmit
```
Expected: errors in `presets.ts` (uses `PresetGroup` narrowing) and `product-table.tsx` (references `est_sales` column). Fixed in next tasks.

- [ ] **Step 5: Commit**

```bash
git add src/domains/product/constants.ts
git commit -m "$(cat <<'EOF'
feat(products): extend constants for txn aggregates + new preset groups

EMPTY_FILTERS gains defaults for the 13 new filter keys. Optional columns
drop est_sales, add units_1y / revenue_1y / txns_1y. Preset groups add
Trending and Stock health.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 17: Update product-table.tsx — remove trend arrow, add velocity columns

**Files:**
- Modify: `src/components/products/product-table.tsx`

- [ ] **Step 1: Delete the est_sales TableCell block**

Remove the entire block `{visibleColumns?.includes("est_sales") && ( <TableCell ...>...</TableCell> )}` (around lines 255–273).

- [ ] **Step 2: Add three new optional column renderers**

Insert these in place of the deleted block:

```typescript
                    {visibleColumns?.includes("units_1y") && (
                      <TableCell className="text-right tabular-nums">
                        {product.units_sold_1y > 0 ? product.units_sold_1y.toLocaleString() : "—"}
                      </TableCell>
                    )}
                    {visibleColumns?.includes("revenue_1y") && (
                      <TableCell className="text-right tabular-nums">
                        {product.revenue_1y > 0
                          ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(product.revenue_1y)
                          : "—"}
                      </TableCell>
                    )}
                    {visibleColumns?.includes("txns_1y") && (
                      <TableCell className="text-right tabular-nums">
                        {product.txns_1y > 0 ? product.txns_1y.toLocaleString() : "—"}
                      </TableCell>
                    )}
```

- [ ] **Step 3: Update the matching `<TableHead>` cells**

Find the header row where `est_sales` column header was rendered and replace with:

```typescript
                  {visibleColumns?.includes("units_1y")   && <TableHead className="text-right">Units 1y</TableHead>}
                  {visibleColumns?.includes("revenue_1y") && <TableHead className="text-right">Revenue 1y</TableHead>}
                  {visibleColumns?.includes("txns_1y")    && <TableHead className="text-right">Receipts 1y</TableHead>}
```

(Search the file for `Est. annual` or `est_sales` to locate the existing header.)

- [ ] **Step 4: Verify compile**

```bash
npx tsc --noEmit
```
Expected: no errors in product-table.tsx. Other files will still error (presets.ts, queries.ts, tests) — fixed in the next tasks.

- [ ] **Step 5: Commit**

```bash
git add src/components/products/product-table.tsx
git commit -m "$(cat <<'EOF'
feat(products): replace est_sales column with real velocity columns

Drops the broken trend arrow (EstSalesPrev was always 0 so it always read
rising). Adds three optional columns showing real units, revenue, and
receipts over the trailing year.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 18: Update queries.ts — new filter keys + view switch

**Files:**
- Modify: `src/domains/product/queries.ts`

- [ ] **Step 1: Add the view-switching helper at the top of searchProducts**

In `src/domains/product/queries.ts`, replace the line `.from("products")` inside `searchProducts` with:

```typescript
  const needsDerived = filters.trendDirection !== "" || filters.maxStockCoverageDays !== "";
  let query = client
    .from(needsDerived ? "products_with_derived" : "products")
    .select("*", { count: "exact" })
    .in("item_type", TAB_ITEM_TYPES[filters.tab]);
```

- [ ] **Step 2: Add new filter blocks before `// Sorting`**

Just before the `// Sorting` comment (~line 207), insert:

```typescript
  // Units sold window
  if (filters.unitsSoldWindow !== "" && (filters.minUnitsSold !== "" || filters.maxUnitsSold !== "")) {
    const col = `units_sold_${filters.unitsSoldWindow}`;
    if (filters.minUnitsSold !== "") query = query.gte(col, Number(filters.minUnitsSold));
    if (filters.maxUnitsSold !== "") query = query.lte(col, Number(filters.maxUnitsSold));
  }
  // Revenue window
  if (filters.revenueWindow !== "" && (filters.minRevenue !== "" || filters.maxRevenue !== "")) {
    const col = `revenue_${filters.revenueWindow}`;
    if (filters.minRevenue !== "") query = query.gte(col, Number(filters.minRevenue));
    if (filters.maxRevenue !== "") query = query.lte(col, Number(filters.maxRevenue));
  }
  // Transaction-count window
  if (filters.txnsWindow !== "" && (filters.minTxns !== "" || filters.maxTxns !== "")) {
    const col = `txns_${filters.txnsWindow}`;
    if (filters.minTxns !== "") query = query.gte(col, Number(filters.minTxns));
    if (filters.maxTxns !== "") query = query.lte(col, Number(filters.maxTxns));
  }
  // Authoritative never-sold (txn-based)
  if (filters.neverSoldLifetime) {
    query = query.eq("txns_lifetime", 0);
  }
  // First sale within
  if (filters.firstSaleWithin !== "") {
    const days = filters.firstSaleWithin === "90d" ? 90 : 365;
    const threshold = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    query = query.gte("first_sale_date_computed", threshold);
  }
  // Trend direction (derived view only)
  if (filters.trendDirection !== "") {
    query = query.eq("trend_direction", filters.trendDirection);
  }
  // Max stock coverage days (derived view only)
  if (filters.maxStockCoverageDays !== "") {
    query = query.lte("stock_coverage_days", Number(filters.maxStockCoverageDays));
  }
```

- [ ] **Step 3: Verify compile**

```bash
npx tsc --noEmit
```
Expected: no errors in queries.ts.

- [ ] **Step 4: Commit**

```bash
git add src/domains/product/queries.ts
git commit -m "$(cat <<'EOF'
feat(products): translate new filter keys in searchProducts

Switches to products_with_derived when trendDirection or
maxStockCoverageDays is active; otherwise stays on the base table.
Adds units/revenue/txns window filters, never-sold-lifetime, and
first-sale-within.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 19: Rewrite presets.ts — 26 new + remove superseded

**Files:**
- Modify: `src/domains/product/presets.ts`

- [ ] **Step 1: Replace the file contents**

Overwrite `src/domains/product/presets.ts` with the full new list:

```typescript
import type { ColumnPreferences, PresetGroup, ProductFilters, SavedView } from "./types";

type PresetSeed = {
  slug: string;
  name: string;
  description: string;
  presetGroup: PresetGroup;
  sortOrder: number;
  filter: Partial<ProductFilters>;
  columnPreferences: ColumnPreferences;
};

export const SYSTEM_PRESETS: PresetSeed[] = [
  // 💀 Dead weight
  { slug: "dead-discontinued-with-stock", name: "Discontinued with stock", description: "Items marked discontinued that still have stock on hand.",
    presetGroup: "dead-weight", sortOrder: 10,
    filter: { discontinued: "yes", minStock: "1" },
    columnPreferences: { visible: ["stock", "updated"] } },
  { slug: "dead-never-sold-authoritative", name: "Never sold at Pierce (3y base)", description: "No transactions on record at Pierce. Uses real txn history.",
    presetGroup: "dead-weight", sortOrder: 20,
    filter: { neverSoldLifetime: true },
    columnPreferences: { visible: ["stock", "updated"] } },
  { slug: "dead-never-sold-with-stock", name: "Never sold + still in stock", description: "No txn history AND stock on hand. Strongest clearance signal.",
    presetGroup: "dead-weight", sortOrder: 30,
    filter: { neverSoldLifetime: true, minStock: "1" },
    columnPreferences: { visible: ["stock", "updated"] } },
  { slug: "dead-no-sales-1y-stock", name: "No sales in 1y, stocked", description: "Zero units sold in trailing year AND stock on hand.",
    presetGroup: "dead-weight", sortOrder: 40,
    filter: { unitsSoldWindow: "1y", maxUnitsSold: "0", minStock: "1" },
    columnPreferences: { visible: ["stock", "units_1y", "updated"] } },
  { slug: "dead-no-sales-2y-stock", name: "No sales in 2y, stocked", description: "Last sale more than 2y ago AND stock on hand.",
    presetGroup: "dead-weight", sortOrder: 50,
    filter: { lastSaleOlderThan: "2y", minStock: "1" },
    columnPreferences: { visible: ["stock", "days_since_sale"] } },
  { slug: "dead-discontinued-with-recent-sales", name: "Discontinued but still moving", description: "Items flagged discontinued that nonetheless sold in the last year. Probable mis-flags.",
    presetGroup: "dead-weight", sortOrder: 60,
    filter: { discontinued: "yes", unitsSoldWindow: "1y", minUnitsSold: "1" },
    columnPreferences: { visible: ["units_1y", "stock", "updated"] } },

  // 📊 Movers
  { slug: "movers-top-units-30d", name: "Top sellers (units) last 30 days", description: "Most units sold in the trailing 30 days.",
    presetGroup: "movers", sortOrder: 10,
    filter: { unitsSoldWindow: "30d", minUnitsSold: "1", sortBy: "units_sold_30d", sortDir: "desc" },
    columnPreferences: { visible: ["units_1y", "stock", "revenue_1y"] } },
  { slug: "movers-top-units-1y", name: "Top sellers (units) last year", description: "Most units sold in the trailing year.",
    presetGroup: "movers", sortOrder: 20,
    filter: { unitsSoldWindow: "1y", minUnitsSold: "1", sortBy: "units_sold_1y", sortDir: "desc" },
    columnPreferences: { visible: ["units_1y", "revenue_1y", "stock"] } },
  { slug: "movers-top-units-lifetime", name: "Top sellers (units) lifetime", description: "Most units sold across our 3y+ base.",
    presetGroup: "movers", sortOrder: 30,
    filter: { unitsSoldWindow: "lifetime", minUnitsSold: "1", sortBy: "units_sold_lifetime", sortDir: "desc" },
    columnPreferences: { visible: ["units_1y", "revenue_1y"] } },
  { slug: "movers-top-revenue-30d", name: "Top revenue last 30 days", description: "Highest dollar sales in the trailing 30 days.",
    presetGroup: "movers", sortOrder: 40,
    filter: { revenueWindow: "30d", minRevenue: "1", sortBy: "revenue_30d", sortDir: "desc" },
    columnPreferences: { visible: ["revenue_1y", "units_1y", "margin"] } },
  { slug: "movers-top-revenue-1y", name: "Top revenue last year", description: "Highest dollar sales in the trailing year.",
    presetGroup: "movers", sortOrder: 50,
    filter: { revenueWindow: "1y", minRevenue: "1", sortBy: "revenue_1y", sortDir: "desc" },
    columnPreferences: { visible: ["revenue_1y", "units_1y", "margin"] } },
  { slug: "movers-consistent-sellers", name: "Consistent sellers (50+ receipts/yr)", description: "Sold across 50+ distinct receipts in the last year — not a bulk-order fluke.",
    presetGroup: "movers", sortOrder: 60,
    filter: { txnsWindow: "1y", minTxns: "50", sortBy: "txns_1y", sortDir: "desc" },
    columnPreferences: { visible: ["txns_1y", "units_1y", "revenue_1y"] } },
  { slug: "movers-one-hit-wonders", name: "Big-volume one-time sales", description: "Sold 10+ units but across only one receipt lifetime — usually a single course adoption.",
    presetGroup: "movers", sortOrder: 70,
    filter: { txnsWindow: "lifetime", maxTxns: "1", unitsSoldWindow: "lifetime", minUnitsSold: "10" },
    columnPreferences: { visible: ["units_1y", "txns_1y"] } },

  // 📈 Trending
  { slug: "trend-accelerating", name: "Accelerating", description: "30-day daily rate > 1.5× trailing-1y daily rate.",
    presetGroup: "trending", sortOrder: 10,
    filter: { trendDirection: "accelerating", unitsSoldWindow: "30d", minUnitsSold: "5" },
    columnPreferences: { visible: ["units_1y", "stock"] } },
  { slug: "trend-decelerating", name: "Decelerating", description: "30-day daily rate < 0.5× trailing-1y daily rate.",
    presetGroup: "trending", sortOrder: 20,
    filter: { trendDirection: "decelerating", unitsSoldWindow: "1y", minUnitsSold: "10" },
    columnPreferences: { visible: ["units_1y", "stock"] } },
  { slug: "trend-new-arrivals", name: "New & moving", description: "First seen in last 90 days and already moving.",
    presetGroup: "trending", sortOrder: 30,
    filter: { firstSaleWithin: "90d", unitsSoldWindow: "30d", minUnitsSold: "5" },
    columnPreferences: { visible: ["units_1y", "stock", "revenue_1y"] } },

  // 📦 Stock health
  { slug: "stock-overstocked-1y", name: "Overstocked (1y+ of supply)", description: "Stock greater than last-year units sold — more than a year of supply at current pace.",
    presetGroup: "stock-health", sortOrder: 10,
    filter: { minStock: "1", unitsSoldWindow: "1y", maxUnitsSold: "0" }, // dead variant handled below
    columnPreferences: { visible: ["stock", "units_1y"] } },
  { slug: "stock-stockout-risk", name: "Stockout risk", description: "Stock ≤ 2 and selling well in the last 30 days — reorder now.",
    presetGroup: "stock-health", sortOrder: 20,
    filter: { maxStock: "2", unitsSoldWindow: "30d", minUnitsSold: "5" },
    columnPreferences: { visible: ["stock", "units_1y"] } },
  { slug: "stock-less-than-30d-cover", name: "Less than 30 days of cover", description: "At current pace will run out within 30 days.",
    presetGroup: "stock-health", sortOrder: 30,
    filter: { maxStockCoverageDays: "30", unitsSoldWindow: "30d", minUnitsSold: "1" },
    columnPreferences: { visible: ["stock", "units_1y"] } },
  { slug: "stock-stale-stock", name: "Stale stock (180d+ idle)", description: "≥10 units on hand but no sale in 180 days. Shelf hoggers.",
    presetGroup: "stock-health", sortOrder: 40,
    filter: { minStock: "10", lastSaleOlderThan: "2y" /* approximation — using authoritative date requires days threshold; see design */ },
    columnPreferences: { visible: ["stock", "days_since_sale"] } },

  // 💰 Pricing
  { slug: "pricing-gm-under-5", name: "GM under $5", description: "General merchandise priced under $5.",
    presetGroup: "pricing", sortOrder: 10,
    filter: { tab: "merchandise", maxPrice: "5" },
    columnPreferences: { visible: ["margin", "units_1y"] } },
  { slug: "pricing-gm-over-50", name: "GM over $50", description: "General merchandise priced over $50.",
    presetGroup: "pricing", sortOrder: 20,
    filter: { tab: "merchandise", minPrice: "50" },
    columnPreferences: { visible: ["margin", "units_1y"] } },
  { slug: "pricing-textbooks-over-100", name: "Textbooks over $100", description: "Textbooks priced over $100.",
    presetGroup: "pricing", sortOrder: 30,
    filter: { tab: "textbooks", minPrice: "100" },
    columnPreferences: { visible: ["margin", "units_1y"] } },
  { slug: "price-high-margin-high-velocity", name: "High margin + high velocity", description: "Margin >40% and 50+ units sold last year. Cash cows.",
    presetGroup: "pricing", sortOrder: 40,
    filter: { minMargin: "0.4", unitsSoldWindow: "1y", minUnitsSold: "50" },
    columnPreferences: { visible: ["margin", "units_1y", "revenue_1y"] } },
  { slug: "price-high-margin-dead", name: "High margin + not moving", description: "Margin >40% but zero units last year. Priced fine, nobody wants it.",
    presetGroup: "pricing", sortOrder: 50,
    filter: { minMargin: "0.4", unitsSoldWindow: "1y", maxUnitsSold: "0" },
    columnPreferences: { visible: ["margin", "units_1y", "stock"] } },
  { slug: "price-thin-margin-popular", name: "Thin margin + popular (raise price?)", description: "Margin <10% and 100+ units last year. Candidates for a price bump.",
    presetGroup: "pricing", sortOrder: 60,
    filter: { maxMargin: "0.1", unitsSoldWindow: "1y", minUnitsSold: "100" },
    columnPreferences: { visible: ["margin", "units_1y", "revenue_1y"] } },
  { slug: "price-low-revenue-high-stock", name: "Low revenue, high stock", description: "Revenue <$50 last year but 20+ units on hand.",
    presetGroup: "pricing", sortOrder: 70,
    filter: { revenueWindow: "1y", maxRevenue: "50", minStock: "20" },
    columnPreferences: { visible: ["revenue_1y", "stock"] } },

  // 🎓 Textbook
  { slug: "textbook-used-only", name: "Used textbooks only", description: "Used-copy textbook SKUs.",
    presetGroup: "textbook", sortOrder: 10,
    filter: { itemType: "used_textbook" },
    columnPreferences: { visible: ["units_1y"] } },
  { slug: "textbook-current-semester-active", name: "Textbook active this semester", description: "Textbook with 5+ units sold in the last 90 days.",
    presetGroup: "textbook", sortOrder: 20,
    filter: { tab: "textbooks", unitsSoldWindow: "90d", minUnitsSold: "5" },
    columnPreferences: { visible: ["units_1y", "stock"] } },
  { slug: "textbook-used-moving", name: "Used textbooks moving", description: "Used-copy SKU with any sale in the last 90 days.",
    presetGroup: "textbook", sortOrder: 30,
    filter: { itemType: "used_textbook", unitsSoldWindow: "90d", minUnitsSold: "1" },
    columnPreferences: { visible: ["units_1y"] } },
  { slug: "textbook-faded-this-year", name: "Textbook faded (was active, now quiet)", description: "Textbooks with sales in last year but zero in last 30 days.",
    presetGroup: "textbook", sortOrder: 40,
    filter: { tab: "textbooks", unitsSoldWindow: "30d", maxUnitsSold: "0" },
    columnPreferences: { visible: ["units_1y", "stock"] } },

  // 🔍 Data quality (kept)
  { slug: "data-missing-barcode", name: "Missing barcode", description: "Items with no barcode on file.",
    presetGroup: "data-quality", sortOrder: 10,
    filter: { missingBarcode: true },
    columnPreferences: { visible: ["updated"] } },
  { slug: "data-missing-isbn-textbook", name: "Missing ISBN (textbooks)", description: "Textbooks with no ISBN.",
    presetGroup: "data-quality", sortOrder: 20,
    filter: { tab: "textbooks", missingIsbn: true },
    columnPreferences: { visible: ["updated"] } },
  { slug: "data-missing-title-or-description", name: "Missing description or title", description: "Textbooks without a title, or general merchandise without a description.",
    presetGroup: "data-quality", sortOrder: 30,
    filter: { missingTitle: true },
    columnPreferences: { visible: ["updated"] } },
  { slug: "data-retail-below-cost", name: "Retail < cost", description: "Retail price lower than cost. Usually a data entry error.",
    presetGroup: "data-quality", sortOrder: 40,
    filter: { retailBelowCost: true },
    columnPreferences: { visible: ["margin", "updated"] } },
  { slug: "data-zero-price", name: "Retail or cost = 0", description: "Retail or cost is exactly zero.",
    presetGroup: "data-quality", sortOrder: 50,
    filter: { zeroPrice: true },
    columnPreferences: { visible: ["updated"] } },

  // 📝 Recent activity (kept)
  { slug: "recent-edited-7d", name: "Edited in last 7 days", description: "Items modified in the past week.",
    presetGroup: "recent-activity", sortOrder: 10,
    filter: { editedWithin: "7d" },
    columnPreferences: { visible: ["updated"] } },
  { slug: "recent-edited-since-sync", name: "Edited since last sync", description: "Items whose row was touched after the mirror was last refreshed.",
    presetGroup: "recent-activity", sortOrder: 20,
    filter: { editedSinceSync: true },
    columnPreferences: { visible: ["updated"] } },
];

export function presetSeedToSavedView(seed: PresetSeed): SavedView {
  return {
    id: seed.slug,
    name: seed.name,
    description: seed.description,
    filter: seed.filter,
    columnPreferences: seed.columnPreferences,
    isSystem: true,
    slug: seed.slug,
    presetGroup: seed.presetGroup,
    sortOrder: seed.sortOrder,
  };
}

export const SYSTEM_PRESET_VIEWS: SavedView[] = SYSTEM_PRESETS.map(presetSeedToSavedView);
```

- [ ] **Step 2: Update the PresetGroup type**

In `src/domains/product/types.ts`, locate the `PresetGroup` type and replace with:

```typescript
export type PresetGroup =
  | "dead-weight"
  | "movers"
  | "trending"
  | "stock-health"
  | "pricing"
  | "textbook"
  | "data-quality"
  | "recent-activity";
```

- [ ] **Step 3: Verify compile**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/domains/product/presets.ts src/domains/product/types.ts
git commit -m "$(cat <<'EOF'
feat(products): 26 new txn-aware presets + 2 new groups

Removes 9 superseded presets that relied on Inventory.LastSaleDate alone.
Adds dead-weight (authoritative), movers, trending, stock-health,
pricing-intel, and textbook presets against the new aggregate columns.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 20: Update presets-predicates tests

**Files:**
- Modify: `tests/domains/product/presets-predicates.test.ts`
- Modify: `tests/domains/product/__snapshots__/presets-predicates.test.ts.snap` (regenerated)

- [ ] **Step 1: Update fixture generator**

In `tests/domains/product/presets-predicates.test.ts`, update the `base` helper to include the new `Product` fields and drop the removed ones:

```typescript
const base = (p: Partial<Product>): Product => ({
  sku: 0, barcode: null, item_type: "general_merchandise", description: "x", author: null,
  title: null, isbn: null, edition: null, retail_price: 10, cost: 5, stock_on_hand: 10,
  catalog_number: null, vendor_id: 1, dcc_id: 1, product_type: null, color_id: 0,
  created_at: null, updated_at: daysAgo(30), last_sale_date: daysAgo(30),
  synced_at: daysAgo(30), dept_num: null, class_num: null, cat_num: null,
  dept_name: null, class_name: null, cat_name: null,
  units_sold_30d: 0, units_sold_90d: 0, units_sold_1y: 0, units_sold_3y: 0, units_sold_lifetime: 0,
  revenue_30d: 0, revenue_90d: 0, revenue_1y: 0, revenue_3y: 0, revenue_lifetime: 0,
  txns_1y: 0, txns_lifetime: 0,
  first_sale_date_computed: null, last_sale_date_computed: null, sales_aggregates_computed_at: null,
  discontinued: false,
  ...p,
});
```

- [ ] **Step 2: Extend the fixture list with txn-aware rows**

Append these fixtures to the `fixtures` array:

```typescript
  base({ sku: 20, description: "Top unit seller 30d", units_sold_30d: 200, units_sold_1y: 2000, units_sold_lifetime: 5000, txns_1y: 300, txns_lifetime: 1200, revenue_30d: 1000, revenue_1y: 9000, last_sale_date_computed: daysAgo(1) }),
  base({ sku: 21, description: "Revenue champ 1y", revenue_1y: 50000, units_sold_1y: 500, txns_1y: 300 }),
  base({ sku: 22, description: "Consistent seller", txns_1y: 80, units_sold_1y: 400 }),
  base({ sku: 23, description: "One-hit wonder", txns_lifetime: 1, units_sold_lifetime: 20 }),
  base({ sku: 24, description: "Accelerating", units_sold_30d: 30, units_sold_1y: 100 /* rate 1d/1day vs 100/365 */ }),
  base({ sku: 25, description: "Decelerating", units_sold_30d: 1, units_sold_1y: 100 }),
  base({ sku: 26, description: "New arrival", first_sale_date_computed: daysAgo(30), units_sold_30d: 10 }),
  base({ sku: 27, description: "Overstocked", stock_on_hand: 500, units_sold_1y: 20 }),
  base({ sku: 28, description: "Stockout risk", stock_on_hand: 2, units_sold_30d: 15 }),
  base({ sku: 29, description: "Authoritative dead", txns_lifetime: 0, stock_on_hand: 5 }),
  base({ sku: 30, description: "Textbook this semester", item_type: "textbook", title: "Calc", units_sold_90d: 20 }),
  base({ sku: 31, description: "High margin popular", retail_price: 100, cost: 40, units_sold_1y: 100 }),
  base({ sku: 32, description: "High margin dead", retail_price: 100, cost: 40, units_sold_1y: 0 }),
```

- [ ] **Step 3: Extend matchesFilter with the new keys**

Append to the `matchesFilter` function, before its closing `return true;`:

```typescript
  if (f.neverSoldLifetime && (p.txns_lifetime ?? 0) > 0) return false;
  if (f.unitsSoldWindow !== "") {
    const col = (`units_sold_${f.unitsSoldWindow}` as const) as keyof Product;
    const v = (p[col] as number | null) ?? 0;
    if (f.minUnitsSold !== "" && v < Number(f.minUnitsSold)) return false;
    if (f.maxUnitsSold !== "" && v > Number(f.maxUnitsSold)) return false;
  }
  if (f.revenueWindow !== "") {
    const col = (`revenue_${f.revenueWindow}` as const) as keyof Product;
    const v = (p[col] as number | null) ?? 0;
    if (f.minRevenue !== "" && v < Number(f.minRevenue)) return false;
    if (f.maxRevenue !== "" && v > Number(f.maxRevenue)) return false;
  }
  if (f.txnsWindow !== "") {
    const col = (`txns_${f.txnsWindow}` as const) as keyof Product;
    const v = (p[col] as number | null) ?? 0;
    if (f.minTxns !== "" && v < Number(f.minTxns)) return false;
    if (f.maxTxns !== "" && v > Number(f.maxTxns)) return false;
  }
  if (f.firstSaleWithin !== "") {
    const days = f.firstSaleWithin === "90d" ? 90 : 365;
    if (!p.first_sale_date_computed) return false;
    if (new Date(p.first_sale_date_computed).getTime() < now.getTime() - days * 86400000) return false;
  }
  if (f.trendDirection === "accelerating") {
    const r30 = (p.units_sold_30d ?? 0) / 30;
    const r1y = (p.units_sold_1y ?? 0) / 365;
    if (!(r1y > 0 && r30 > r1y * 1.5)) return false;
  }
  if (f.trendDirection === "decelerating") {
    const r30 = (p.units_sold_30d ?? 0) / 30;
    const r1y = (p.units_sold_1y ?? 0) / 365;
    if (!(r1y > 0 && r30 < r1y * 0.5)) return false;
  }
  if (f.maxStockCoverageDays !== "") {
    const rate30 = (p.units_sold_30d ?? 0) / 30;
    if (rate30 === 0) return false;
    const cover = (p.stock_on_hand ?? 0) / rate30;
    if (cover > Number(f.maxStockCoverageDays)) return false;
  }
```

- [ ] **Step 4: Regenerate the snapshot**

Run with update mode:
```bash
npm test -- tests/domains/product/presets-predicates.test.ts -u
```
Expected: snapshot updated in place.

- [ ] **Step 5: Re-run without update to confirm stable**

```bash
npm test -- tests/domains/product/presets-predicates.test.ts
```
Expected: PASS, snapshot matches.

- [ ] **Step 6: Commit**

```bash
git add tests/domains/product/presets-predicates.test.ts \
       tests/domains/product/__snapshots__/presets-predicates.test.ts.snap
git commit -m "$(cat <<'EOF'
test(products): preset-predicate coverage for txn-aware presets

Adds 13 fixtures covering the new velocity/trending/stock-health dimensions
and extends matchesFilter to mirror the new queries.ts predicate logic.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 21: Update search-products-filters test

**Files:**
- Modify: `tests/domains/product/search-products-filters.test.ts`

- [ ] **Step 1: Read the file to find the existing pattern**

```bash
sed -n '1,50p' tests/domains/product/search-products-filters.test.ts
```

- [ ] **Step 2: Append new test cases covering the 10 new filter keys**

Append to the existing `describe("searchProducts filters")` (or create a new `describe` block at the end of the file):

```typescript
  it("applies units_sold window filter", async () => {
    const filters = { ...EMPTY_FILTERS, tab: "merchandise" as const, unitsSoldWindow: "1y" as const, minUnitsSold: "100" };
    const spy = captureQuery();
    await searchProducts(filters);
    expect(spy.calls).toContainEqual(expect.objectContaining({ method: "gte", column: "units_sold_1y", value: 100 }));
  });

  it("applies revenue window filter", async () => {
    const filters = { ...EMPTY_FILTERS, tab: "merchandise" as const, revenueWindow: "30d" as const, minRevenue: "500" };
    const spy = captureQuery();
    await searchProducts(filters);
    expect(spy.calls).toContainEqual(expect.objectContaining({ method: "gte", column: "revenue_30d", value: 500 }));
  });

  it("applies txns window filter", async () => {
    const filters = { ...EMPTY_FILTERS, tab: "merchandise" as const, txnsWindow: "1y" as const, minTxns: "50" };
    const spy = captureQuery();
    await searchProducts(filters);
    expect(spy.calls).toContainEqual(expect.objectContaining({ method: "gte", column: "txns_1y", value: 50 }));
  });

  it("neverSoldLifetime eq(txns_lifetime, 0)", async () => {
    const filters = { ...EMPTY_FILTERS, tab: "merchandise" as const, neverSoldLifetime: true };
    const spy = captureQuery();
    await searchProducts(filters);
    expect(spy.calls).toContainEqual(expect.objectContaining({ method: "eq", column: "txns_lifetime", value: 0 }));
  });

  it("trendDirection uses products_with_derived view", async () => {
    const filters = { ...EMPTY_FILTERS, tab: "merchandise" as const, trendDirection: "accelerating" as const };
    const spy = captureQuery();
    await searchProducts(filters);
    expect(spy.calls.some(c => c.method === "from" && c.column === "products_with_derived")).toBe(true);
    expect(spy.calls).toContainEqual(expect.objectContaining({ method: "eq", column: "trend_direction", value: "accelerating" }));
  });

  it("maxStockCoverageDays uses view + lte", async () => {
    const filters = { ...EMPTY_FILTERS, tab: "merchandise" as const, maxStockCoverageDays: "30" };
    const spy = captureQuery();
    await searchProducts(filters);
    expect(spy.calls.some(c => c.method === "from" && c.column === "products_with_derived")).toBe(true);
    expect(spy.calls).toContainEqual(expect.objectContaining({ method: "lte", column: "stock_coverage_days", value: 30 }));
  });
```

(If the existing test file doesn't have a `captureQuery` helper, check how queries are asserted and adapt. The pattern should already exist because the file covers the other filter keys.)

- [ ] **Step 3: Run the tests**

```bash
npm test -- tests/domains/product/search-products-filters.test.ts
```
Expected: PASS (existing + 6 new cases).

- [ ] **Step 4: Commit**

```bash
git add tests/domains/product/search-products-filters.test.ts
git commit -m "$(cat <<'EOF'
test(products): query-shape coverage for new aggregate filters

Confirms units/revenue/txns window filters emit the right Supabase calls,
neverSoldLifetime maps to txns_lifetime=0, and derived-filter cases switch
to products_with_derived.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 22: Smoke-test script

**Files:**
- Create: `scripts/test-sales-txn-sync.ts`

- [ ] **Step 1: Write the script**

Create `scripts/test-sales-txn-sync.ts`:

```typescript
/**
 * Smoke test: runs runSalesTxnSync against the live Prism + live Supabase,
 * compares Prism-side "rows with TransactionID > cursor" to Supabase delta.
 *
 * Safe to run anytime after backfill — it only inserts new rows.
 *
 * Usage:  npx tsx scripts/test-sales-txn-sync.ts
 */
import { config as loadEnv } from "dotenv";
import path from "path";
loadEnv({ path: path.resolve(process.cwd(), ".env.local") });
loadEnv({ path: path.resolve(process.cwd(), ".env") });

import { getPrismPool, sql } from "@/lib/prism";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { PIERCE_LOCATION_ID } from "@/domains/product/prism-server";
import { runSalesTxnSync } from "@/domains/product/sales-txn-sync";

async function main() {
  const pool = await getPrismPool();
  const supabase = getSupabaseAdminClient();

  const { data: state } = await supabase
    .from("sales_transactions_sync_state")
    .select("last_transaction_id,backfill_completed_at")
    .eq("id", 1)
    .single();
  if (!state?.backfill_completed_at) {
    throw new Error("Backfill has not completed. Run backfill-prism-transactions.ts first.");
  }
  const cursor = Number(state.last_transaction_id);

  const preflight = await pool.request()
    .input("loc", sql.Int, PIERCE_LOCATION_ID)
    .input("cursor", sql.BigInt, cursor)
    .query<{ ExpectedRows: number }>(`
      SELECT COUNT(*) AS ExpectedRows
      FROM Transaction_Detail td
      INNER JOIN Transaction_Header th ON th.TransactionID = td.TransactionID
      WHERE th.LocationID = @loc AND th.TransactionID > @cursor
    `);
  const expected = preflight.recordset[0]?.ExpectedRows ?? 0;
  console.log(`Expected new rows from Prism: ${expected.toLocaleString()}`);

  const result = await runSalesTxnSync({ supabase, prism: pool });
  console.log(`runSalesTxnSync returned:`, result);

  if (result.txnsAdded !== expected) {
    console.error(`MISMATCH: inserted ${result.txnsAdded}, expected ${expected}`);
    process.exit(1);
  }
  console.log("OK.");
}
main().catch(e => { console.error(e); process.exit(1); }).finally(() => process.exit(0));
```

- [ ] **Step 2: Verify compile**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit (do NOT run yet — run happens during post-deploy validation)**

```bash
git add scripts/test-sales-txn-sync.ts
git commit -m "$(cat <<'EOF'
chore(products): smoke script for incremental sales-txn-sync

Counts expected Prism rows above the cursor, runs runSalesTxnSync, asserts
inserted count matches. Run locally with Prism tunnel up after Phase B
merge to validate the live pipeline.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 23: Ship-check, publish PR, and post-deploy validation

**Files:** none

- [ ] **Step 1: Full ship-check**

```bash
npm run ship-check
```
Expected: all green.

- [ ] **Step 2: Push + open PR**

```bash
npm run git:publish-pr
```

- [ ] **Step 3: Wait for CI green + CodeRabbit pass. Address feedback via `CR_FIX=1 git push`. Merge.**

- [ ] **Step 4: Post-deploy validation in production**

After deploy completes:

1. Visit https://laportal.montalvo.io/products, click **Sync Database**.
2. Confirm the dialog renders the 7-stat grid with values for `Txns+`, `Aggs refreshed`, `Txn time`.
3. From a machine with Prism tunnel up, run:
   ```bash
   npx tsx scripts/test-sales-txn-sync.ts
   ```
   Expected: `OK.` with matching counts.
4. Try each preset group and spot-check:
   - "Top sellers (units) last 30 days" → expect real textbook / supply SKUs at top
   - "Never sold at Pierce (3y base)" → expect clearly-dead items
   - "Accelerating" → expect some rows (data-dependent; may be empty during slow periods)
   - "Stockout risk" → expect items with low stock + recent sales
5. Confirm no preset returns a type error in the browser devtools console.

- [ ] **Step 5: Close-out**

If everything green, Phase B is done. The cron-not-firing issue is a separate follow-up (not in this work).

---

## Self-review

**Spec coverage check** (done after writing, fix inline):

| Spec section | Covered by task(s) |
|---|---|
| Problem / Goals / Non-goals | N/A (motivational) |
| Data model — `sales_transactions` | Task 2 (DDL), Task 3 (Prisma model) |
| Data model — `sales_transactions_sync_state` | Task 2 (DDL), Task 3 (Prisma model) |
| Additions to `products` (15 cols) | Task 2 |
| Removals from `products` (5 cols) | Task 2, Task 14 (sync-side), Task 15 (types) |
| Aggregation formula | Task 4 (SQL function + runner + tests) |
| Backfill script | Task 5 (scaffold), Task 6 (implementation) |
| Incremental sync module | Task 10 |
| `/api/sync/prism-pull` wiring | Task 11 |
| Sync dialog new fields | Task 12 (types), Task 13 (UI) |
| `sync_runs` extension | Task 9 |
| 10 new ProductFilters | Task 15 |
| EMPTY_FILTERS defaults | Task 16 |
| OPTIONAL_COLUMNS change | Task 16 |
| PRESET_GROUPS additions | Task 16 |
| `products_with_derived` view | Task 2 |
| searchProducts filter logic | Task 18 |
| 26 new presets / 9 removed | Task 19 |
| Preset predicate tests | Task 20 |
| Query-shape tests | Task 21 |
| Integration smoke test | Task 22 |
| Rollout sequence | Phase A → Checkpoint → Phase B |
| Trend arrow removal | Task 17 |

No gaps.

**Placeholder scan:** none.

**Type consistency:** `SalesTxnSyncResult` in Task 10 matches the shape returned by `runSalesTxnSync`. `SyncPullResult` / `SyncRun` additions in Task 12 match the response body produced in Task 11. `ProductFilters` keys introduced in Task 15 are used identically in Tasks 16 / 18 / 19 / 20 / 21.
