CREATE OR REPLACE VIEW "products_with_derived" AS
SELECT
  p.*,
  COALESCE(p.last_sale_date_computed, p.last_sale_date) AS effective_last_sale_date,
  (p.sales_aggregates_computed_at IS NOT NULL) AS aggregates_ready,
  CASE
    WHEN p.retail_price IS NULL OR p.retail_price <= 0 THEN NULL
    ELSE (p.retail_price - p.cost)::NUMERIC / NULLIF(p.retail_price::NUMERIC, 0)
  END AS margin_ratio,
  CASE
    WHEN p.sales_aggregates_computed_at IS NULL THEN NULL
    WHEN p.units_sold_30d IS NULL OR p.units_sold_30d = 0 THEN NULL
    ELSE p.stock_on_hand::NUMERIC / (p.units_sold_30d::NUMERIC / 30.0)
  END AS stock_coverage_days,
  CASE
    WHEN p.sales_aggregates_computed_at IS NULL THEN NULL
    WHEN p.units_sold_30d IS NULL OR p.units_sold_1y IS NULL
      OR p.units_sold_30d = 0 OR p.units_sold_1y = 0 THEN NULL
    WHEN (p.units_sold_30d::NUMERIC / 30.0) > (p.units_sold_1y::NUMERIC / 365.0) * 1.5
      THEN 'accelerating'
    WHEN (p.units_sold_30d::NUMERIC / 30.0) < (p.units_sold_1y::NUMERIC / 365.0) * 0.5
      THEN 'decelerating'
    ELSE 'steady'
  END AS trend_direction
FROM "products" p;
