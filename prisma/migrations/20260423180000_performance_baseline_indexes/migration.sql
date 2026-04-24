CREATE INDEX IF NOT EXISTS "events_date_idx"
  ON "events" ("date");

CREATE INDEX IF NOT EXISTS "invoice_items_invoice_id_sort_order_idx"
  ON "invoice_items" ("invoice_id", "sort_order");

CREATE INDEX IF NOT EXISTS "invoices_type_archived_at_created_at_idx"
  ON "invoices" ("type", "archived_at", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "invoices_type_archived_at_date_idx"
  ON "invoices" ("type", "archived_at", "date" DESC);

CREATE INDEX IF NOT EXISTS "products_description_simple_idx"
  ON "products"
  USING GIN (to_tsvector('simple', COALESCE("description", ''::TEXT)));
