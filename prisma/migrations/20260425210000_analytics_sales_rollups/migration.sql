-- Pre-aggregate mirrored POS transactions for the analytics page. The raw
-- `sales_transactions` table is append-heavy and already has ~3 years of
-- transaction lines; dashboard queries should not rescan it for every chart.

CREATE INDEX IF NOT EXISTS sales_transactions_location_date_active_idx
  ON "sales_transactions" ("location_id", "process_date" DESC, "sku")
  WHERE "dtl_f_status" <> 1;

DROP MATERIALIZED VIEW IF EXISTS "analytics_sales_hourly";
DROP MATERIALIZED VIEW IF EXISTS "analytics_sales_daily";

CREATE MATERIALIZED VIEW "analytics_sales_daily" AS
SELECT
  (st.process_date AT TIME ZONE 'America/Los_Angeles')::date AS sale_date,
  st.location_id,
  st.sku::integer AS sku,
  COALESCE(SUM(st.qty), 0) AS units,
  COALESCE(SUM(st.ext_price), 0) AS revenue,
  COUNT(DISTINCT st.transaction_id) AS receipts,
  COALESCE(SUM(st.discount_amt), 0) AS discount_amount
FROM "sales_transactions" st
WHERE st.dtl_f_status <> 1
GROUP BY 1, 2, 3;

CREATE UNIQUE INDEX analytics_sales_daily_unique_idx
  ON "analytics_sales_daily" ("sale_date", "location_id", "sku");
CREATE INDEX analytics_sales_daily_location_date_idx
  ON "analytics_sales_daily" ("location_id", "sale_date");
CREATE INDEX analytics_sales_daily_location_date_revenue_idx
  ON "analytics_sales_daily" ("location_id", "sale_date", "revenue" DESC);
CREATE INDEX analytics_sales_daily_location_date_units_idx
  ON "analytics_sales_daily" ("location_id", "sale_date", "units" DESC);

CREATE MATERIALIZED VIEW "analytics_sales_hourly" AS
SELECT
  (st.process_date AT TIME ZONE 'America/Los_Angeles')::date AS sale_date,
  st.location_id,
  EXTRACT(HOUR FROM st.process_date AT TIME ZONE 'America/Los_Angeles')::int AS hour,
  COALESCE(SUM(st.ext_price), 0) AS revenue,
  COUNT(DISTINCT st.transaction_id) AS receipts
FROM "sales_transactions" st
WHERE st.dtl_f_status <> 1
GROUP BY 1, 2, 3;

CREATE UNIQUE INDEX analytics_sales_hourly_unique_idx
  ON "analytics_sales_hourly" ("sale_date", "location_id", "hour");
CREATE INDEX analytics_sales_hourly_location_date_idx
  ON "analytics_sales_hourly" ("location_id", "sale_date");

REVOKE ALL ON "analytics_sales_daily" FROM anon, authenticated;
REVOKE ALL ON "analytics_sales_hourly" FROM anon, authenticated;
