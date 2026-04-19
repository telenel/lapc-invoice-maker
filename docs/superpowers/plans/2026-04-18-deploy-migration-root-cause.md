# LAPortal Deploy/Migration Root Cause

Date: 2026-04-18

## Incident

The `Deploy to VPS` workflow for `main` commit `b7a4fa4` rebuilt the app image
successfully but never brought the app back to a healthy `/api/version`
response. The deploy then rolled the Git checkout back, but the app container
continued restart-looping.

## Exact Cause

The Prisma migration `20260418153000_products_derived_accuracy_and_margin`
failed in production with PostgreSQL error `42P16`:

`cannot change name of view column "stock_coverage_days" to "effective_last_sale_date"`

Why:
- the existing `products_with_derived` view already ended with
  `stock_coverage_days, trend_direction`
- the migration used `CREATE OR REPLACE VIEW` and inserted new columns before
  those existing derived columns
- PostgreSQL treats `CREATE OR REPLACE VIEW` as position-sensitive for existing
  view columns, so this looked like an in-place rename rather than an append

## Why It Caused Downtime

- the production container entrypoint ran `prisma migrate deploy` before
  starting `server.js`
- once the migration failed, Prisma recorded a failed migration state in
  `_prisma_migrations`
- every subsequent container start hit `P3009` before the app could boot
- the deploy rollback reset the repo checkout but could not recover the app
  because startup still retried Prisma migrations on every boot

## Why CI Missed It

- CI ran lint, tests, and build, but not `prisma migrate deploy` against a real
  database with the full migration chain
- the migration was therefore never exercised against an existing
  `products_with_derived` view before merge
- once CI started replaying the full chain, it also exposed a second hidden
  gap: the `products` table itself had never been codified in Prisma's
  migration history, so clean databases could not apply
  `20260417000001_extend_products_for_bulk_edit`

## Prevention

1. Keep existing view columns in-place when using `CREATE OR REPLACE VIEW`; only
   append new columns at the end, or drop/recreate explicitly when reordering is
   unavoidable.
2. Validate `prisma migrate deploy` in CI against disposable PostgreSQL so
   historical-schema migration failures are caught before merge.
3. Recreate out-of-band baseline objects like `products` inside the recorded
   migration chain so clean databases can replay history end to end.
4. Bootstrap the Supabase roles that older raw SQL migrations reference during
   CI migration replay, so validation matches production assumptions closely.
5. Run production migrations as a deploy preflight step before replacing the
   live app container.
6. Do not make the app container startup path depend on successful migrations by
   default.
