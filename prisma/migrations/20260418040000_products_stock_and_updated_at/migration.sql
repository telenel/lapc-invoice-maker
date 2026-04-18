-- Adds stock_on_hand (pulled from Prism Inventory.StockOnHand on sync) and
-- updated_at audit column + trigger so we can actually answer "was this row
-- edited after sync?" questions in the future. Without this column, the
-- 2026-04-17 audit couldn't distinguish sync-written rows from hand-edited
-- ones, and we had to infer from column-population patterns.

ALTER TABLE "products"
  ADD COLUMN IF NOT EXISTS "stock_on_hand" INTEGER,
  ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now();

-- Maintain updated_at on every row change. Skips when only sync_hash/synced_at
-- change would be a false-negative, so we stamp on every UPDATE — the column
-- is for "this row was touched," not specifically "this row was edited
-- outside the sync." Callers that need sync-vs-edit can compare against
-- synced_at.
CREATE OR REPLACE FUNCTION products_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS products_set_updated_at ON "products";
CREATE TRIGGER products_set_updated_at
  BEFORE UPDATE ON "products"
  FOR EACH ROW
  EXECUTE FUNCTION products_set_updated_at();
