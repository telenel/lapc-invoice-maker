-- Supports the Prism -> Supabase pull sync. The products table is
-- Supabase-only (not Prisma-managed), so this is raw SQL.
ALTER TABLE products ADD COLUMN IF NOT EXISTS sync_hash TEXT;
