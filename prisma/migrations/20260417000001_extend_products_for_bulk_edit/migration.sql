-- The products table was created outside Prisma's model system.
-- Bulk-edit dry-run and preview need item_tax_type_id + discontinued.
-- Additive columns only — safe for a live table.
ALTER TABLE products ADD COLUMN IF NOT EXISTS item_tax_type_id INTEGER;
ALTER TABLE products ADD COLUMN IF NOT EXISTS discontinued BOOLEAN NOT NULL DEFAULT false;
