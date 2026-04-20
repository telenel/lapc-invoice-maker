# Supabase Handoff For Claude

Last updated: 2026-04-20

This is the Claude-facing handoff for LAPortal's Supabase work. Use it before making any infrastructure or deployment changes.

## Executive Summary

No immediate Supabase-side action is required for the current codebase.

Current production assumptions:

- the app runs on Supabase Postgres, Storage, and Realtime
- public Supabase env must be baked into the image at build time
- shared rate limiting and job-run tracking are already persisted in Postgres
- legacy filesystem fallback is disabled by default
- the scheduler route now serializes cron job IDs correctly and can inspect live cron state

If nobody is explicitly trying to move scheduling onto Supabase, leave the scheduler ownership switch alone.

## Current Live State

Verified live on the current codebase:

- build SHA: `3dd56d5`
- `/api/version` reports the build metadata and public-env config
- the storage audit reports zero legacy references when fallback is disabled
- the scheduler inspection route can return job state without the old BigInt serialization failure

## What Supabase Is Already Responsible For

### 1. Database

- Prisma points at Supabase Postgres.
- Route handlers still go through domain repositories and services.
- The browser should never become a direct privileged table client.

Relevant files:

- [prisma/schema.prisma](../../prisma/schema.prisma)
- [src/lib/prisma.ts](../../src/lib/prisma.ts)

### 2. Storage

- PDFs and uploads live in the private `laportal-documents` bucket.
- Storage object keys are the active source of truth.
- Legacy filesystem compatibility is off unless the audit tooling proves it is needed.

Relevant files:

- [src/lib/document-storage.ts](../../src/lib/document-storage.ts)
- [src/domains/pdf/storage.ts](../../src/domains/pdf/storage.ts)
- [src/lib/storage-audit.ts](../../src/lib/storage-audit.ts)
- [scripts/supabase/migrate-legacy-documents.ts](../../scripts/supabase/migrate-legacy-documents.ts)
- [scripts/supabase/audit-legacy-documents.ts](../../scripts/supabase/audit-legacy-documents.ts)

### 3. Realtime

- Realtime uses Supabase channels.
- Browser clients get short-lived tokens from the app, not direct browser auth ownership.
- The old SSE naming remains for compatibility, but transport is Supabase Realtime.

Relevant files:

- [src/app/api/realtime/token/route.ts](../../src/app/api/realtime/token/route.ts)
- [src/lib/supabase/browser.ts](../../src/lib/supabase/browser.ts)
- [src/lib/sse.ts](../../src/lib/sse.ts)
- [src/lib/use-sse.ts](../../src/lib/use-sse.ts)

### 4. Shared Rate Limiting

- Login and chat throttles are stored in Postgres.
- This removes single-instance behavior for the important request gates.

Relevant files:

- [src/lib/rate-limit.ts](../../src/lib/rate-limit.ts)
- [src/lib/auth.ts](../../src/lib/auth.ts)
- [src/app/api/chat/route.ts](../../src/app/api/chat/route.ts)

### 5. Job Run Ledger

- Background job executions are written to Postgres.
- Admin health surfaces recent job execution state.

Relevant files:

- [src/lib/job-runs.ts](../../src/lib/job-runs.ts)
- [src/instrumentation.ts](../../src/instrumentation.ts)
- [src/app/api/internal/jobs/event-reminders/route.ts](../../src/app/api/internal/jobs/event-reminders/route.ts)
- [src/app/api/internal/jobs/payment-follow-ups/route.ts](../../src/app/api/internal/jobs/payment-follow-ups/route.ts)
- [src/app/api/internal/jobs/account-follow-ups/route.ts](../../src/app/api/internal/jobs/account-follow-ups/route.ts)
- [src/components/admin/db-health.tsx](../../src/components/admin/db-health.tsx)

## Recent Supabase-Related Changes

### Build-time env and diagnostics

- production build-time Supabase env is now visible through `/api/version`
- admin health surfaces build/public env state, scheduler mode, and storage audit counts

### Scheduler status

- the protected scheduler route now serializes `cron.job` IDs safely
- the app can inspect and reconcile scheduler state without the earlier BigInt failure
- scheduler ownership is still controlled by `JOB_SCHEDULER` plus `SUPABASE_SCHEDULER_CONFIRMED`

### Storage and rate limiting

- legacy document fallback is disabled by default
- storage audit tooling is in place
- login/chat rate limiting is database-backed

## What Claude Should Assume

1. Supabase is already the platform for database, storage, realtime, rate limiting, and job observability.
2. NextAuth still owns auth/session behavior.
3. The scheduler can be moved to Supabase, but only if the team explicitly flips that operational switch.
4. Legacy filesystem compatibility is no longer the default path.

## What Claude Should Not Do Casually

- do not migrate auth to Supabase Auth without a separate project
- do not set `SUPABASE_SCHEDULER_CONFIRMED=true` unless cron state has been verified
- do not re-enable `ALLOW_LEGACY_FILESYSTEM_FALLBACK` unless an audit proves it is needed
- do not treat the presence of scheduler SQL as proof that Supabase must own scheduling

## If You Need To Verify Supabase State

Use these checks in order:

1. `GET /api/version`
2. `GET /api/internal/platform/storage-audit`
3. `GET /api/internal/platform/supabase-scheduler`
4. `npm run audit:legacy-documents`

If the team wants Supabase-owned scheduling, confirm the expected jobs exist and then set `SUPABASE_SCHEDULER_CONFIRMED=true`.

## Supabase MCP Usage

If Supabase MCP is available, the best uses are:

- inspect buckets and confirm `laportal-documents`
- inspect `pg_cron` and `pg_net`
- inspect the `cron` schema access granted to the app role
- inspect `rate_limit_events` and `job_runs` when debugging throttling or background jobs
