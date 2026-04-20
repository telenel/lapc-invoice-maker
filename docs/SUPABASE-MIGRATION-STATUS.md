# Supabase Migration Status

Last updated: 2026-04-19

This file is the durable status record for LAPortal's Supabase/platform migration work. It is intentionally split between codebase state and operational follow-up so the repo docs do not drift as quickly as one-off deploy notes.

## Verified current repo state

Verified from the current repo and configured `DATABASE_URL`:

- Prisma is pointed at Supabase Postgres.
- `./node_modules/.bin/prisma migrate status` reports: `Database schema is up to date!`
- document storage paths are handled through Supabase-backed storage code
- browser realtime is bridged through `GET /api/realtime/token`
- runtime/version diagnostics surface build metadata and public Supabase env presence
- shared rate limiting and job-run tracking exist in the database layer
- Supabase scheduler inspection/reconciliation code exists and now serializes cron `jobid` values safely as strings
- scheduler tooling currently expects three jobs:
  - `laportal-event-reminders`
  - `laportal-payment-follow-ups`
  - `laportal-account-follow-ups`

## What is complete

### 1. Database migration to Supabase Postgres

Complete for normal app operation.

- Prisma schema and migrations target Supabase Postgres.
- The repo-local migration status is currently clean.
- CI includes a migration check that applies Prisma migrations end to end and verifies the derived products view shape.

### 2. Storage migration

Operationally complete.

- PDFs/uploads are expected to live in Supabase-backed storage paths.
- legacy filesystem fallback is now an emergency compatibility path, not the default runtime source of truth.
- keep `ALLOW_LEGACY_FILESYSTEM_FALLBACK=false` unless a real audit shows it is needed again.

### 3. Realtime migration

Complete in code.

- browser subscriptions use Supabase Realtime
- the app mints short-lived browser tokens through `GET /api/realtime/token`
- NextAuth still owns primary app sessions by design

### 4. Build-time public env handling

Complete in code and deploy flow.

The deploy/build path now assumes:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

must exist at image build time, not only at runtime.

`/api/version` and startup-written build metadata expose whether those public env values were present.

## What is still an operational decision or follow-up

### 1. Scheduler ownership

The codebase supports both modes:

- `JOB_SCHEDULER=app`
- `JOB_SCHEDULER=supabase`

Protected scheduler inspection/reconciliation lives at:

- `GET /api/internal/platform/supabase-scheduler`
- `POST /api/internal/platform/supabase-scheduler`

Recommended rule:

- leave `SUPABASE_SCHEDULER_CONFIRMED=false` until production verification proves the cron schema, jobs, and auth path are all healthy for the app role

Treat Supabase scheduler ownership as optional platform work, not a prerequisite for the rest of the migration being useful.

### 2. Auth ownership

Auth is intentionally still on NextAuth.

That is acceptable unless there is a concrete product or ops reason to move login/session authority into Supabase Auth. Realtime and infrastructure can use Supabase without forcing that migration.

### 3. Legacy storage audit discipline

Even though filesystem fallback is no longer the intended source of truth, the repo still keeps migration/audit tooling for safety:

- `scripts/supabase/audit-legacy-documents.ts`
- `scripts/supabase/migrate-legacy-documents.ts`
- `GET /api/internal/platform/storage-audit`

Keep those tools available, but do not re-enable fallback by default.

## Verification commands

### Prisma migration state

```bash
./node_modules/.bin/prisma migrate status
```

### Legacy document audit

```bash
npm run audit:legacy-documents
```

### Version/env verification

```bash
curl -fsS https://laportal.montalvo.io/api/version
```

### Protected scheduler inspection

Use the protected scheduler route with the configured cron auth secret when validating Supabase scheduler mode.

## What counts as “platform migration complete”

Treat the migration as operationally complete when all of these are true:

- Prisma migrations are current on the target database
- public Supabase env is baked into production builds
- runtime/admin Supabase env is configured
- Supabase Storage is the active document source of truth
- browser realtime works in production
- shared rate limiting/job tracking no longer depend on single-process memory
- the chosen scheduler owner is intentionally verified
- `SUPABASE_SCHEDULER_CONFIRMED` reflects a verified choice, not a guess
