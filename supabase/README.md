# Supabase Setup

This directory contains the LAPortal Supabase bootstrap assets used by the application.

The full operator runbook is here:

- [docs/operations/supabase-cutover.md](/Users/montalvo/lapc-invoice-maker/docs/operations/supabase-cutover.md)

## Required Services

- Supabase Postgres
- Supabase Storage
- Supabase Realtime

Auth remains on NextAuth in this migration slice. The app uses a short-lived JWT bridge for private Realtime channels.

## Environment Variables

Set these in local development and production:

```env
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
SUPABASE_JWT_SECRET=<legacy-jwt-secret-or-imported-hs256-secret>
NEXTAUTH_SECRET=<nextauth-secret>
NEXTAUTH_URL=https://laportal.example.com
JOB_SCHEDULER=supabase
CRON_SECRET=<shared-secret-for-internal-job-routes>
```

## Bootstrap Steps

1. Provision a Supabase project.
2. Create the `prisma` role with [`sql/002_laportal_prisma_role.sql`](/Users/montalvo/lapc-invoice-maker/supabase/sql/002_laportal_prisma_role.sql).
3. Point `DATABASE_URL` and `DIRECT_URL` at the Supabase Postgres instance.
4. Restore the existing database into Supabase Postgres.
5. Apply Prisma migrations against that database.
6. Run the SQL in:
   - [`sql/001_laportal_foundation.sql`](/Users/montalvo/lapc-invoice-maker/supabase/sql/001_laportal_foundation.sql)
   - [`sql/003_laportal_scheduler.sql`](/Users/montalvo/lapc-invoice-maker/supabase/sql/003_laportal_scheduler.sql) after the app is deployed with `JOB_SCHEDULER=supabase`
7. Run the legacy document migration:
   - `npx tsx scripts/supabase/migrate-legacy-documents.ts --dry-run`
   - `npx tsx scripts/supabase/migrate-legacy-documents.ts`
8. Confirm the private Storage bucket `laportal-documents` exists.
9. Confirm private Realtime topic access works for:
   - `app:global`
   - `user:<app-user-id>`

## Runtime Expectations

- Uploaded PrismCore PDFs are stored under `uploads/`
- Finalized invoice PDFs are stored under `invoices/<invoice-id>/`
- Quote PDFs are stored under `quotes/<quote-id>/`
- Print quote PDFs are stored under `print-quotes/<quote-id>/`
- `/api/realtime/token` issues short-lived JWTs for browser Realtime subscriptions
- `src/lib/sse.ts` publishes server-side invalidation and notification events into Supabase Realtime
- Supabase pg_cron calls the authenticated internal job routes when `JOB_SCHEDULER=supabase`
- `scripts/supabase/migrate-legacy-documents.ts` moves old filesystem-backed records into Supabase Storage

## Notes

- This slice does not migrate login/session management off NextAuth.
- Scheduler ownership is configurable:
  - `JOB_SCHEDULER=app` keeps the existing Node process cron registration
  - `JOB_SCHEDULER=supabase` moves scheduling to Supabase pg_cron + pg_net
- The local filesystem is no longer the document source of truth.
