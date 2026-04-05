# LAPortal Workflow

## Read First

1. [README.md](../../README.md)
2. [docs/PROJECT-OVERVIEW.md](../PROJECT-OVERVIEW.md)
3. [docs/SUPABASE-MIGRATION-STATUS.md](../SUPABASE-MIGRATION-STATUS.md) for infrastructure work
4. [prisma/schema.prisma](../../prisma/schema.prisma) for model changes

## Validation

- Run `npm run ship-check` before handing off changes when the tree is clean enough for it.
- If a repo script refuses to run because the tree is intentionally dirty, state that explicitly and run the nearest safe validation commands.

## Infra Rules

- Do not assume runtime env is enough for Next.js public Supabase config. Verify build-time env through `/api/version`.
- Do not set `SUPABASE_SCHEDULER_CONFIRMED=true` until Supabase cron jobs are explicitly verified.
- Do not migrate auth off NextAuth as a side effect of unrelated Supabase work.
- Do not disable `ALLOW_LEGACY_FILESYSTEM_FALLBACK` until `npm run audit:legacy-documents` is clean.

## Documentation

When infrastructure behavior changes, update the durable docs:

- [README.md](../../README.md)
- [docs/PROJECT-OVERVIEW.md](../PROJECT-OVERVIEW.md)
- [docs/SUPABASE-MIGRATION-STATUS.md](../SUPABASE-MIGRATION-STATUS.md)
