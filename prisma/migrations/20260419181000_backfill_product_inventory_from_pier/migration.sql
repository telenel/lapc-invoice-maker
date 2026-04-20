-- One-time backfill: copy the PIER slice of products into product_inventory.
-- Safe to re-run because of the ON CONFLICT DO NOTHING clause.

INSERT INTO "product_inventory" (
  "sku", "location_id", "location_abbrev",
  "retail_price", "cost", "stock_on_hand",
  "last_sale_date", "synced_at"
)
SELECT
  p."sku",
  2                     AS "location_id",
  'PIER'                AS "location_abbrev",
  p."retail_price",
  p."cost",
  p."stock_on_hand",
  p."last_sale_date",
  p."synced_at"
FROM "products" p
ON CONFLICT ("sku", "location_id") DO NOTHING;
