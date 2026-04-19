-- The products catalog table predates Prisma and originally lived outside the
-- recorded migration chain. Recreate the baseline here so clean databases can
-- replay later additive product migrations end to end.
CREATE TABLE IF NOT EXISTS "products" (
  "sku" INTEGER NOT NULL,
  "barcode" TEXT,
  "item_type" TEXT,
  "description" TEXT,
  "author" TEXT,
  "title" TEXT,
  "isbn" TEXT,
  "edition" TEXT,
  "retail_price" NUMERIC,
  "cost" NUMERIC,
  "catalog_number" TEXT,
  "image_url" TEXT,
  "vendor_id" INTEGER,
  "dcc_id" INTEGER,
  "product_type" TEXT,
  "color_id" INTEGER,
  "size" TEXT,
  "created_at" TIMESTAMPTZ,
  "last_sale_date" TIMESTAMPTZ,
  "synced_at" TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT "products_pkey" PRIMARY KEY ("sku")
);

CREATE INDEX IF NOT EXISTS idx_products_barcode
  ON "products" ("barcode");

CREATE INDEX IF NOT EXISTS idx_products_item_type
  ON "products" ("item_type");

CREATE INDEX IF NOT EXISTS idx_products_description
  ON "products"
  USING GIN (to_tsvector('english', COALESCE("description", ''::TEXT)));

ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
    AND NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'products'
        AND policyname = 'Authenticated users can read products'
    ) THEN
    CREATE POLICY "Authenticated users can read products"
      ON "products"
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END
$$;
