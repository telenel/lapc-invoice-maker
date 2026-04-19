-- The products preset seed migration uses `ON CONFLICT (slug)`, which requires
-- a real unique constraint or a fully matching unique index inference target.
-- The earlier partial unique index is useful for legacy backfill, but it is
-- not sufficient for clean migration replay. Add the canonical unique
-- constraint before the seed step so replayed databases behave like prod.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'saved_searches_slug_key'
      AND conrelid = 'public.saved_searches'::regclass
  ) THEN
    ALTER TABLE "saved_searches"
      ADD CONSTRAINT "saved_searches_slug_key" UNIQUE ("slug");
  END IF;
END
$$;
