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
  END AS trend_direction;
