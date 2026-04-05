# Supabase Setup

This directory contains the LAPortal Supabase bootstrap assets used by the application.

For the live migration status and unresolved blockers, see [docs/SUPABASE-MIGRATION-STATUS.md](../docs/SUPABASE-MIGRATION-STATUS.md).

## Required Services

- Supabase Postgres
- Supabase Storage
- Supabase Realtime
- Supabase `pg_cron` and `pg_net` if you want scheduler ownership moved off the app container

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
SUPABASE_SCHEDULER_CONFIRMED=false
CRON_SECRET=<shared-secret-for-internal-job-routes>
ALLOW_LEGACY_FILESYSTEM_FALLBACK=true
```

Important: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` must exist at image build time for production builds. Runtime-only injection is not sufficient for Next.js client bundles.

## Bootstrap Steps

1. Provision a Supabase project.
2. Create the `prisma` role with `sql/002_laportal_prisma_role.sql`.
3. Point `DATABASE_URL` and `DIRECT_URL` at the Supabase Postgres instance.
4. Apply Prisma migrations against that database.
5. Run:
   - `sql/001_laportal_foundation.sql`
   - `sql/003_laportal_scheduler.sql` after the app is deployed with `JOB_SCHEDULER=supabase`
6. Run the legacy document migration if you still have filesystem-backed PDFs:
   - `npx tsx scripts/supabase/migrate-legacy-documents.ts --dry-run`
   - `npx tsx scripts/supabase/migrate-legacy-documents.ts`
   - `npm run audit:legacy-documents`
7. Confirm the private Storage bucket `laportal-documents` exists.
8. Confirm private Realtime topic access works for:
   - `app:global`
   - `user:<app-user-id>`
9. Verify the protected scheduler route can inspect cron state before setting `SUPABASE_SCHEDULER_CONFIRMED=true`:
   - `GET /api/internal/platform/supabase-scheduler`
10. If local DB access is unavailable, use the protected storage audit route to inspect remaining legacy document references:
   - `GET /api/internal/platform/storage-audit`

## Runtime Expectations

- Uploaded PrismCore PDFs are stored under `uploads/`
- Finalized invoice PDFs are stored under `invoices/<invoice-id>/`
- Quote PDFs are stored under `quotes/<quote-id>/`
- Print quote PDFs are stored under `print-quotes/<quote-id>/`
- `/api/realtime/token` issues short-lived JWTs for browser Realtime subscriptions
- `src/lib/sse.ts` publishes server-side invalidation and notification events into Supabase Realtime
- `JOB_SCHEDULER=supabase` only changes ownership after cron is verified and `SUPABASE_SCHEDULER_CONFIRMED=true`
- Login/chat rate limiting is stored in Postgres and shared across instances
- Background job runs are recorded in `job_runs` and surfaced in admin health

## Notes

- This slice does not migrate login/session management off NextAuth.
- Scheduler ownership is configurable:
  - `JOB_SCHEDULER=app` keeps the existing Node process cron registration
  - `JOB_SCHEDULER=supabase` prepares for Supabase pg_cron + pg_net, but the app still keeps its own cron active until confirmation
- The local filesystem is no longer the document source of truth.
- `ALLOW_LEGACY_FILESYSTEM_FALLBACK` keeps temporary compatibility reads for old filesystem-backed document paths; disable it only after `npm run audit:legacy-documents` is clean.
- If the protected scheduler route returns `permission denied for schema cron`, the app role still lacks the required privileges and the scheduler migration is not complete.
