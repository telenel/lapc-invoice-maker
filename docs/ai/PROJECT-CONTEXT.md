# LAPortal Project Context

## What This Repo Is

LAPortal is the operations portal for Los Angeles Pierce College. The current codebase covers invoices, quotes, product catalog management, bulk edit, staff, calendar, analytics, archive, admin tooling, textbook requisitions, a pricing calculator, and a Claude-powered assistant.

## Architecture Summary

- Framework: Next.js App Router
- Data boundary: authenticated route handlers plus domain services and Prisma repositories
- Database: Supabase Postgres via Prisma
- Storage: Supabase Storage
- Realtime: Supabase Realtime with a token bridge
- Auth: NextAuth remains the session authority
- Product catalog: Prism-backed reads and writes with committed ref-data fallback for offline development

## Current Feature Surface

The final eight-phase feature set now includes:

- invoice creation, editing, finalization, PDFs, and follow-up flows
- quote creation, sharing, public response, payment details, and revision chains
- product catalog browsing, batch add, bulk edit, saved views, and Prism health checks
- staff directory and signer history
- calendar events, birthdays, and reminders
- archive browsing and analytics
- admin users, settings, and pricing
- textbook requisitions and public faculty submission
- notifications, quick picks, saved items, and user quick picks

## Supabase Status

The Supabase migration is functionally in place for database, storage, realtime, shared rate limiting, and job-run observability. The scheduler route now works with live cron state and the decision to move scheduler ownership to Supabase is intentionally separate from the rest of the migration.

Current operating assumptions:

- `JOB_SCHEDULER=app` is still the safe default
- `JOB_SCHEDULER=supabase` only becomes active after explicit confirmation
- `SUPABASE_SCHEDULER_CONFIRMED=true` is a deliberate ops switch, not a default
- build-time public Supabase env must be verified through `/api/version`

## Docs To Read First

1. [docs/README.md](../README.md)
2. [docs/PROJECT-OVERVIEW.md](../PROJECT-OVERVIEW.md)
3. [docs/SUPABASE-MIGRATION-STATUS.md](../SUPABASE-MIGRATION-STATUS.md)
4. [docs/GIT-WORKFLOW.md](../GIT-WORKFLOW.md) when changing branches or pushing work
5. [prisma/schema.prisma](../../prisma/schema.prisma) for model changes

## What To Remember

- Historical phase plans and specs live under `docs/superpowers/`; treat them as archive material unless a task explicitly asks you to work from one.
- The product catalog refs endpoint should always show labels, not raw numeric IDs, when a label exists.
- PBO / LocationID 5 remains excluded from product catalog work.
- `ship-check` is the release gate that matters most for this repo.
