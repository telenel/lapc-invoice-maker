-- Quick pick sections are read and written by server-side routes. Grant the
-- Supabase service role direct table access so server-only routes keep working
-- even when they use the admin client instead of Prisma. Guard the grant so
-- ordinary local Postgres installs without Supabase roles can still replay the
-- migration chain.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE
    ON TABLE "quick_pick_sections"
    TO service_role;
  END IF;
END
$$;
