# Supabase Handoff For Claude Max

Last updated: 2026-04-05 (grants applied, scheduler serializer fix pending deploy)

This document is the Claude-facing handoff for all recent Supabase work in LAPortal, formerly `lapc-invoice-maker`.

Use this file before making any Supabase-related changes.

## Executive Summary

No immediate Supabase-side action is required for current production.

Current production is healthy on the core Supabase migration:

- Supabase Postgres is the database
- Supabase Storage is the document source of truth
- Supabase Realtime is active through the app's token bridge
- public Supabase client env is correctly baked into the production bundle
- shared rate limiting is now Postgres-backed
- background job executions are now recorded in Postgres
- legacy filesystem fallback is disabled
- legacy document references in production are `0`

The only meaningful infrastructure item still open is optional:

- Supabase-owned scheduler (`pg_cron`) is provisioned, but the live app still needs the scheduler serializer fix deployed before confirmation can be flipped

If nobody is explicitly trying to move scheduling onto Supabase, Claude does not need to do anything on the Supabase side right now.

## Current Live Production State

As of this handoff, production reports:

- live build SHA: `595be98`
- public Supabase URL configured at build time: `true`
- public Supabase anon key configured at build time: `true`

Production storage audit reports:

- `legacyFilesystemFallbackEnabled: false`
- `invoicePdfPaths: 0`
- `prismcorePaths: 0`
- `printQuotePdfPaths: 0`
- `totalLegacyReferences: 0`

That means the legacy storage migration is operationally complete.

Supabase scheduler status now appears to be provisioned on the database side:

- `pg_cron`, `pg_net`, and `vault` are installed
- both expected cron jobs exist and are active
- the `prisma` role has read access to `cron.job` and `cron.job_run_details`

The remaining scheduler blocker is in app code, not in Supabase:

- production still needs the scheduler serializer fix deployed so `/api/internal/platform/supabase-scheduler` can return job data without a `BigInt` JSON error

## What Supabase Is Already Responsible For

### 1. Database

- Prisma is pointed at Supabase Postgres.
- The application still uses server-side Prisma repositories and services.
- The browser is not meant to become a direct table client for privileged app data.

Relevant files:

- [prisma/schema.prisma](../../prisma/schema.prisma)
- [src/lib/prisma.ts](../../src/lib/prisma.ts)

### 2. Storage

- PDFs and uploads are stored in the private `laportal-documents` bucket.
- Storage object keys, not local filesystem paths, are the active source of truth.
- Legacy compatibility fallback has now been disabled by default.

Relevant files:

- [src/lib/document-storage.ts](../../src/lib/document-storage.ts)
- [src/domains/pdf/storage.ts](../../src/domains/pdf/storage.ts)
- [src/lib/storage-audit.ts](../../src/lib/storage-audit.ts)
- [scripts/supabase/migrate-legacy-documents.ts](../../scripts/supabase/migrate-legacy-documents.ts)
- [scripts/supabase/audit-legacy-documents.ts](../../scripts/supabase/audit-legacy-documents.ts)

### 3. Realtime

- Realtime uses Supabase channels.
- The browser gets short-lived tokens from the app, not from direct browser auth ownership.
- Existing naming still uses `useSSE`, but transport is Supabase Realtime.

Relevant files:

- [src/app/api/realtime/token/route.ts](../../src/app/api/realtime/token/route.ts)
- [src/lib/supabase/browser.ts](../../src/lib/supabase/browser.ts)
- [src/lib/sse.ts](../../src/lib/sse.ts)
- [src/lib/use-sse.ts](../../src/lib/use-sse.ts)

### 4. Shared Rate Limiting

- Login and chat throttling are now stored in Postgres, not in process memory.
- This was added to remove single-instance behavior for important request throttles.

Relevant files:

- [src/lib/rate-limit.ts](../../src/lib/rate-limit.ts)
- [src/lib/auth.ts](../../src/lib/auth.ts)
- [src/app/api/chat/route.ts](../../src/app/api/chat/route.ts)
- [prisma/migrations/20260404202000_add_rate_limit_events_and_job_runs/migration.sql](../../prisma/migrations/20260404202000_add_rate_limit_events_and_job_runs/migration.sql)

### 5. Job Run Ledger

- Background job executions are now recorded in Postgres.
- Admin health surfaces recent job execution state.

Relevant files:

- [src/lib/job-runs.ts](../../src/lib/job-runs.ts)
- [src/instrumentation.ts](../../src/instrumentation.ts)
- [src/app/api/internal/jobs/event-reminders/route.ts](../../src/app/api/internal/jobs/event-reminders/route.ts)
- [src/app/api/internal/jobs/payment-follow-ups/route.ts](../../src/app/api/internal/jobs/payment-follow-ups/route.ts)
- [src/components/admin/db-health.tsx](../../src/components/admin/db-health.tsx)

## Recent Supabase-Related Commits

These are the key recent changes and what they did:

### `062d56f`

- fixed production build-time public Supabase env wiring
- restored platform diagnostics
- restored optional Supabase scheduler path assets

### `84fbefc`

- added protected Supabase scheduler inspection and reconcile route

### `e665c93`

- prevented scheduler outages by keeping app cron active until Supabase scheduler is explicitly confirmed

### `74b0e0c`

- added shared Postgres-backed rate limiting
- added DB-backed job run tracking
- added storage audit tooling
- added protected storage audit route
- updated docs and admin health surfaces

### `595be98`

- disabled legacy filesystem fallback by default
- production verification showed zero remaining legacy references, so fallback is no longer needed

## What Claude Max Should Assume

Claude should assume all of the following are true unless fresh evidence proves otherwise:

1. Supabase migration is already functionally complete for:
   - database
   - storage
   - realtime
   - shared rate limiting
   - job-run observability

2. Supabase Auth is not the current auth authority.
   - NextAuth still owns session/login behavior.

3. Legacy filesystem compatibility is no longer needed in production.
   - Do not re-enable it casually.

4. The scheduler is still app-owned in practice.
   - Even though the Supabase jobs exist, app cron remains the active safe path until the protected route is verified and `SUPABASE_SCHEDULER_CONFIRMED=true` is set.

## What Claude Max Should Not Do

Do not do any of the following as a casual cleanup:

- do not migrate auth to Supabase Auth without an explicit separate migration project
- do not set `SUPABASE_SCHEDULER_CONFIRMED=true` unless `pg_cron` is explicitly verified
- do not re-enable `ALLOW_LEGACY_FILESYSTEM_FALLBACK` unless a real audit shows legacy refs that need compatibility reads
- do not treat the existence of scheduler SQL as proof that Supabase must own scheduling
- do not rewrite the app around direct browser-side Supabase table access for privileged business data

## What Still Might Need To Be Done On Supabase's End

### Optional only: Supabase scheduler ownership

Scheduler jobs exist and are active in Supabase. Read grants were applied on 2026-04-05.

Current state:

- `pg_cron`, `pg_net`, and `vault` extensions are installed
- both cron jobs exist and are active (`laportal-event-reminders`, `laportal-payment-follow-ups`)
- the `prisma` role has `SELECT` on `cron.job` and `cron.job_run_details`
- the `prisma` role does NOT have `EXECUTE` on cron functions (least-privilege — job creation stays in Supabase SQL Editor)

Remaining steps:

- deploy the scheduler serializer fix
- verify `GET /api/internal/platform/supabase-scheduler` returns success from the live app
- only then set `SUPABASE_SCHEDULER_CONFIRMED=true` in the production environment

### Exact fix path for `cron` schema access

If the team wants Supabase to own reminders and follow-up scheduling, run the scheduler grants in the Supabase SQL Editor as a high-privilege role.

First make sure the required extensions exist:

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists vault;
```

If the goal is only to let the app inspect scheduler state, grant read access only:

```sql
grant usage on schema cron to prisma;
grant select on table cron.job to prisma;
grant select on table cron.job_run_details to prisma;
```

If the goal is to let the app reconcile or create jobs through the protected scheduler route, also grant execute on the `cron` functions:

```sql
grant usage on schema cron to prisma;
grant select on table cron.job to prisma;
grant select on table cron.job_run_details to prisma;
grant execute on all functions in schema cron to prisma;
```

Recommended least-privilege approach:

1. Enable `pg_cron`, `pg_net`, and `vault`.
2. Create the jobs once in Supabase using [supabase/sql/003_laportal_scheduler.sql](../../supabase/sql/003_laportal_scheduler.sql).
3. Grant the app role read access to `cron.job` and `cron.job_run_details`.
4. Keep job creation and grant management out of normal app runtime unless there is a specific reason to let the app reconcile jobs itself.

If, and only if, the team wants Supabase to own reminders/follow-up scheduling, Claude should do this:

1. Verify the live app is running the scheduler serializer fix.
2. Re-check:
   - `GET /api/internal/platform/supabase-scheduler`
3. Confirm the expected jobs exist:
   - `laportal-event-reminders`
   - `laportal-payment-follow-ups`
4. Only after success, allow `SUPABASE_SCHEDULER_CONFIRMED=true`.

If the team does not care about Supabase-owned scheduling, Claude should leave this alone.

## Claude Max With Supabase MCP

If Claude Max has Supabase MCP access, the best uses are:

- inspect buckets and confirm `laportal-documents` exists
- inspect extensions like `pg_cron` and `pg_net`
- inspect whether the `cron` schema is accessible to the app role
- inspect row counts or audit state when app-side routes are unavailable
- inspect the `rate_limit_events` and `job_runs` tables if debugging throttling or background jobs

Claude should prefer inspection and verification first, not schema churn.

## What Claude Max Should Do With Supabase MCP

Claude already has the Supabase tools. For LAPortal, Claude should use them in this order:

1. Inspect, do not mutate, unless the task explicitly requires a Supabase-side change.
2. Confirm current state before proposing migration work:
   - extensions
   - buckets
   - relevant tables
   - scheduler accessibility
3. Treat the app's `prisma` role as the production contract.
   - If the app role cannot read `cron.job`, that is a permissions issue to fix in Supabase, not a reason to rewrite app code.
4. Use MCP to verify whether the `laportal-documents` bucket, `rate_limit_events`, and `job_runs` match repo expectations.
5. If scheduler ownership is requested:
   - verify `pg_cron`, `pg_net`, and `vault`
   - apply the least-privilege `cron` grants above
   - create or verify the jobs from [supabase/sql/003_laportal_scheduler.sql](../../supabase/sql/003_laportal_scheduler.sql)
   - verify the protected scheduler route from the app side
   - only then recommend setting `SUPABASE_SCHEDULER_CONFIRMED=true`

Claude should not use Supabase MCP to make broad schema changes casually. The main migration work is already done.

## Verification Checklist For Claude

When asked to verify Supabase state, use this order:

1. Check live app version:
   - `GET /api/version`
2. Check admin DB health in the app:
   - build env
   - runtime env
   - scheduler configured vs active mode
   - storage audit
   - recent job runs
3. Check protected internal routes if needed:
   - `GET /api/internal/platform/storage-audit`
   - `GET /api/internal/platform/supabase-scheduler`
4. Only then use Supabase MCP or direct SQL for deeper confirmation.

## Fast Answers Claude Should Give

If asked "does anything still need to be done on Supabase?"

Answer:

- No urgent action is required for current production.
- The only optional Supabase-side work left is enabling Supabase-owned scheduler management, and that is not required for the app to function correctly now.

If asked "is the migration complete?"

Answer:

- It is complete for database, storage, realtime, shared rate limiting, and production wiring.
- The only incomplete area is optional Supabase scheduler ownership.

If asked "what changed recently?"

Answer:

- production build-time Supabase env was fixed
- scheduler safety fallback was added
- shared DB-backed rate limiting was added
- DB-backed job-run tracking was added
- legacy storage audit was added
- legacy filesystem fallback was disabled after production verified zero remaining legacy references
