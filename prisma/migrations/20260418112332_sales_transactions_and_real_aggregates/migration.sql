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

-- Access control.
-- sales_transactions and sales_transactions_sync_state are written and read
-- exclusively by the server (admin client / service_role). The browser must
-- NOT have visibility into raw POS transaction rows — all user-facing
-- queries go through the denormalized aggregate columns on `products`.
-- Enable RLS with no policies so only service_role (which bypasses RLS)
-- can access these tables.
REVOKE ALL ON "sales_transactions" FROM anon, authenticated;
REVOKE ALL ON "sales_transactions_sync_state" FROM anon, authenticated;
ALTER TABLE "sales_transactions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sales_transactions_sync_state" ENABLE ROW LEVEL SECURITY;

-- products_with_derived is browser-queried by searchProducts when trend or
-- stock-coverage filters are active. Match the `products` grant pattern:
-- authenticated SELECT only (RLS on the underlying products table enforces
-- row-level rules automatically through the view).
REVOKE ALL ON "products_with_derived" FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON "products_with_derived" FROM authenticated;

-- Views on RLS-protected tables must run as the invoker so the underlying
-- `products` RLS policy applies to view reads. Without this, the view
-- inherits the owner's (superuser) privileges and silently bypasses RLS.
ALTER VIEW "products_with_derived" SET (security_invoker = true);

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

-- Only service_role invokes this function (from the backfill script and the
-- incremental sync module via the admin Supabase client). Revoke the default
-- PostgREST exposure to anon/authenticated so it's not callable from the
-- browser-facing Supabase API.
REVOKE EXECUTE ON FUNCTION recompute_product_sales_aggregates() FROM anon, authenticated, public;
