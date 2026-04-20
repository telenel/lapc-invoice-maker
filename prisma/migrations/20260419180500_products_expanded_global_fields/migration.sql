-- Additive column set for full Item / GM / Textbook field parity.
-- No DROP COLUMN in this migration. Retail/cost/stock columns stay on
-- products for Phase 1; a later migration will drop them after the UI
-- cuts over to product_inventory.

ALTER TABLE "products"
  -- Item table (global)
  ADD COLUMN IF NOT EXISTS "alt_vendor_id"         INTEGER,
  ADD COLUMN IF NOT EXISTS "mfg_id"                INTEGER,
  ADD COLUMN IF NOT EXISTS "used_dcc_id"           INTEGER,
  ADD COLUMN IF NOT EXISTS "item_tax_type_label"   TEXT,
  ADD COLUMN IF NOT EXISTS "tx_comment"            VARCHAR(25),
  ADD COLUMN IF NOT EXISTS "weight"                NUMERIC(9,4),
  ADD COLUMN IF NOT EXISTS "style_id"              INTEGER,
  ADD COLUMN IF NOT EXISTS "item_season_code_id"   INTEGER,
  ADD COLUMN IF NOT EXISTS "f_list_price_flag"     BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "f_perishable"          BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "f_id_required"         BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "min_order_qty_item"    INTEGER,

  -- GeneralMerchandise (global, present when item_type = general_merchandise)
  ADD COLUMN IF NOT EXISTS "type_gm"               VARCHAR(15),
  ADD COLUMN IF NOT EXISTS "size"                  VARCHAR(15),
  ADD COLUMN IF NOT EXISTS "size_id"               INTEGER,
  ADD COLUMN IF NOT EXISTS "package_type"          CHAR(3),
  ADD COLUMN IF NOT EXISTS "package_type_label"    TEXT,
  ADD COLUMN IF NOT EXISTS "units_per_pack"        SMALLINT,
  ADD COLUMN IF NOT EXISTS "order_increment"       INTEGER,
  ADD COLUMN IF NOT EXISTS "image_url"             VARCHAR(128),
  ADD COLUMN IF NOT EXISTS "use_scale_interface"   BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "tare"                  NUMERIC(9,4),

  -- Textbook (global, present when item_type starts with 'textbook')
  ADD COLUMN IF NOT EXISTS "binding_id"            INTEGER,
  ADD COLUMN IF NOT EXISTS "binding_label"         TEXT,
  ADD COLUMN IF NOT EXISTS "imprint"               VARCHAR(10),
  ADD COLUMN IF NOT EXISTS "copyright"             VARCHAR(2),
  ADD COLUMN IF NOT EXISTS "used_sku"              INTEGER,
  ADD COLUMN IF NOT EXISTS "text_status_id"        INTEGER,
  ADD COLUMN IF NOT EXISTS "status_date"           TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "type_textbook"         VARCHAR(10),
  ADD COLUMN IF NOT EXISTS "book_key"              VARCHAR(10);

-- Helpful index for the textbook filter on the products page
CREATE INDEX IF NOT EXISTS "products_binding_id_idx"
  ON "products" ("binding_id") WHERE "binding_id" IS NOT NULL;
