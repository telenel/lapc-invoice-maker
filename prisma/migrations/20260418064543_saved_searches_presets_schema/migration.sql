-- Extend saved_searches so one table holds both system presets (is_system=true)
-- and per-user saved views (is_system=false). Add slug for stable URL refs on
-- system presets, preset_group for UI bucketing, sort_order for display order,
-- column_preferences to bundle which columns a preset reveals, and description
-- for user-facing help text.

ALTER TABLE "saved_searches"
  ADD COLUMN IF NOT EXISTS "description"         TEXT,
  ADD COLUMN IF NOT EXISTS "column_preferences"  JSONB,
  ADD COLUMN IF NOT EXISTS "slug"                TEXT,
  ADD COLUMN IF NOT EXISTS "preset_group"        TEXT,
  ADD COLUMN IF NOT EXISTS "sort_order"          SMALLINT;

-- Stable slug identity for system presets (partial index; user views have NULL).
CREATE UNIQUE INDEX IF NOT EXISTS saved_searches_slug_unique
  ON "saved_searches" ("slug") WHERE "slug" IS NOT NULL;

-- Per-user view names must be unique for that user. System rows (owner NULL)
-- are excluded from this constraint by the partial predicate.
CREATE UNIQUE INDEX IF NOT EXISTS saved_searches_owner_name_unique
  ON "saved_searches" ("owner_user_id", "name") WHERE "owner_user_id" IS NOT NULL;

-- Backfill the four legacy bulk-edit rows seeded by migration
-- 20260417000002. They belong to the bulk-edit workspace, not the products
-- page, so scope them with preset_group='legacy-bulk-edit' and give each a
-- deterministic slug so the unique index holds going forward.
UPDATE "saved_searches"
SET "preset_group" = 'legacy-bulk-edit',
    "slug"         = 'legacy-bulk-textbooks'
WHERE "is_system" = true AND "name" = 'All textbooks' AND "slug" IS NULL;

UPDATE "saved_searches"
SET "preset_group" = 'legacy-bulk-edit',
    "slug"         = 'legacy-bulk-no-barcode'
WHERE "is_system" = true AND "name" = 'Items without barcode' AND "slug" IS NULL;

UPDATE "saved_searches"
SET "preset_group" = 'legacy-bulk-edit',
    "slug"         = 'legacy-bulk-vendor-21'
WHERE "is_system" = true AND "name" = 'Items from vendor 21 (PENS ETC)' AND "slug" IS NULL;

UPDATE "saved_searches"
SET "preset_group" = 'legacy-bulk-edit',
    "slug"         = 'legacy-bulk-gm-under-5'
WHERE "is_system" = true AND "name" = 'General Merchandise — under $5' AND "slug" IS NULL;
