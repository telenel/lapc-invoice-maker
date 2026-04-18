-- Add DCC classification (numeric triple + names) and Inventory_EstSales-derived
-- velocity estimates to the products mirror. All columns nullable so sync can
-- backfill incrementally and rows with no classification degrade cleanly.

ALTER TABLE "products"
  ADD COLUMN IF NOT EXISTS "dept_num"           SMALLINT,
  ADD COLUMN IF NOT EXISTS "class_num"          SMALLINT,
  ADD COLUMN IF NOT EXISTS "cat_num"            SMALLINT,
  ADD COLUMN IF NOT EXISTS "dept_name"          TEXT,
  ADD COLUMN IF NOT EXISTS "class_name"         TEXT,
  ADD COLUMN IF NOT EXISTS "cat_name"           TEXT,
  ADD COLUMN IF NOT EXISTS "one_year_sales"     NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS "look_back_sales"    NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS "sales_to_avg_ratio" NUMERIC(8,4),
  ADD COLUMN IF NOT EXISTS "est_sales_calc"     NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS "est_sales_prev"     NUMERIC(12,2);

CREATE INDEX IF NOT EXISTS products_dcc_num_idx
  ON "products" ("dept_num", "class_num", "cat_num");

CREATE INDEX IF NOT EXISTS products_est_sales_calc_idx
  ON "products" ("est_sales_calc");
