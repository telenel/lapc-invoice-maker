-- Per-location inventory mirror. One row per (sku, location_id) where
-- location_id ∈ {2 PIER, 3 PCOP, 4 PFS}. LocationID 5 (PBO) is strictly
-- excluded from this table and from the sync that writes to it.
--
-- The retail_price/cost/stock_on_hand/last_sale_date columns on products
-- remain in place until the UI cuts over to this table; both are kept in
-- sync until then.

CREATE TABLE IF NOT EXISTS "product_inventory" (
  "sku"                     INTEGER      NOT NULL,
  "location_id"             SMALLINT     NOT NULL,
  "location_abbrev"         TEXT,

  -- Pricing + stock
  "retail_price"            NUMERIC(10,2),
  "cost"                    NUMERIC(10,2),
  "expected_cost"           NUMERIC(10,2),
  "stock_on_hand"           INTEGER,

  -- Label columns (denormalized from Prism ref tables each sync)
  "tag_type_id"             INTEGER,
  "tag_type_label"          TEXT,
  "status_code_id"          SMALLINT,
  "status_code_label"       TEXT,
  "tax_type_override_id"    SMALLINT,
  "disc_code_id"            INTEGER,

  -- Reorder / stocking controls
  "min_stock"               INTEGER,
  "max_stock"               INTEGER,
  "auto_order_qty"          INTEGER,
  "min_order_qty"           INTEGER,
  "hold_qty"                INTEGER,
  "reserved_qty"            INTEGER,
  "rental_qty"              INTEGER,

  -- Forecasting
  "est_sales"               INTEGER,
  "est_sales_locked"        BOOLEAN      DEFAULT FALSE,

  -- Royalty
  "royalty_cost"            NUMERIC(10,4),
  "min_royalty_cost"        NUMERIC(10,4),

  -- Flags
  "f_inv_list_price_flag"   BOOLEAN      DEFAULT FALSE,
  "f_tx_want_list_flag"     BOOLEAN      DEFAULT FALSE,
  "f_tx_buyback_list_flag"  BOOLEAN      DEFAULT FALSE,
  "f_rent_only"             BOOLEAN      DEFAULT FALSE,
  "f_no_returns"            BOOLEAN      DEFAULT FALSE,

  -- Inventory-scoped free text (256-char Prism limit)
  "text_comment_inv"        VARCHAR(256),

  -- Activity dates
  "last_sale_date"          TIMESTAMPTZ,
  "last_inventory_date"     TIMESTAMPTZ,
  "create_date"             TIMESTAMPTZ,
  "synced_at"               TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  -- Sync hash (parallel to products.sync_hash)
  "sync_hash"               TEXT,

  CONSTRAINT "product_inventory_pkey" PRIMARY KEY ("sku", "location_id"),
  CONSTRAINT "product_inventory_location_check" CHECK ("location_id" IN (2, 3, 4)),
  CONSTRAINT "product_inventory_sku_fkey" FOREIGN KEY ("sku") REFERENCES "products"("sku") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "product_inventory_location_id_idx" ON "product_inventory" ("location_id");
CREATE INDEX IF NOT EXISTS "product_inventory_tag_type_id_idx" ON "product_inventory" ("tag_type_id") WHERE "tag_type_id" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "product_inventory_status_code_id_idx" ON "product_inventory" ("status_code_id") WHERE "status_code_id" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "product_inventory_last_sale_date_idx" ON "product_inventory" ("last_sale_date") WHERE "last_sale_date" IS NOT NULL;

-- RLS posture: mirror the products table. Enable RLS, revoke public grants.
-- Exact grant set matches the feedback_supabase_grant_anon_default rule —
-- new tables get GRANT ALL to anon by default, so revoke explicitly.
ALTER TABLE "product_inventory" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "product_inventory" FROM anon;
REVOKE ALL ON "product_inventory" FROM authenticated;
GRANT SELECT ON "product_inventory" TO authenticated;
GRANT ALL ON "product_inventory" TO service_role;
