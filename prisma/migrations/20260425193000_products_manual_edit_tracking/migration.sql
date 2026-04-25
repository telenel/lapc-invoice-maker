DROP VIEW IF EXISTS "products_with_derived";

ALTER TABLE "products"
  ADD COLUMN IF NOT EXISTS "manual_updated_at" TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS "products_manual_updated_at_idx"
  ON "products" ("manual_updated_at" DESC)
  WHERE "manual_updated_at" IS NOT NULL;

CREATE OR REPLACE VIEW "products_with_derived" AS
SELECT
  p.*,
  CASE
    WHEN p.units_sold_30d IS NULL OR p.units_sold_30d = 0 THEN NULL
    ELSE p.stock_on_hand::NUMERIC / (p.units_sold_30d::NUMERIC / 30.0)
  END AS stock_coverage_days,
  CASE
    WHEN p.units_sold_30d IS NULL OR p.units_sold_1y IS NULL
      OR p.units_sold_1y = 0 THEN NULL
    WHEN (p.units_sold_30d::NUMERIC / 30.0) > (p.units_sold_1y::NUMERIC / 365.0) * 1.5
      THEN 'accelerating'
    WHEN (p.units_sold_30d::NUMERIC / 30.0) < (p.units_sold_1y::NUMERIC / 365.0) * 0.5
      THEN 'decelerating'
    ELSE 'steady'
  END AS trend_direction,
  COALESCE(p.last_sale_date_computed, p.last_sale_date) AS effective_last_sale_date,
  (p.sales_aggregates_computed_at IS NOT NULL) AS aggregates_ready,
  CASE
    WHEN p.retail_price IS NULL OR p.retail_price <= 0 THEN NULL
    ELSE (p.retail_price - p.cost)::NUMERIC / NULLIF(p.retail_price::NUMERIC, 0)
  END AS margin_ratio,
  (
    p.manual_updated_at IS NOT NULL
    AND (p.synced_at IS NULL OR p.manual_updated_at > p.synced_at)
  ) AS edited_since_sync
FROM "products" p;

REVOKE ALL ON "products_with_derived" FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON "products_with_derived" FROM authenticated;
GRANT SELECT ON "products_with_derived" TO authenticated;

ALTER VIEW "products_with_derived" SET (security_invoker = true);
