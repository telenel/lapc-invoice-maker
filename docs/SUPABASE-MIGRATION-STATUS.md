# Supabase Migration Status

Last updated: 2026-04-20

This is the durable status record for LAPortal's Supabase migration and the current platform wiring around it.

## Current State

LAPortal is now running the core infrastructure layers on Supabase:

- Database: Prisma points at Supabase Postgres.
- Document storage: PDFs and uploads live in Supabase Storage.
- Realtime: browser subscriptions use Supabase Realtime through the app token bridge.
- Build-time public env: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are expected in the image build and are surfaced by `/api/version` and admin health checks.
- Shared rate limiting: login and chat throttles are persisted in Postgres.
- Job observability: background job runs are recorded in the database and shown in admin Database Health.
- Legacy document audit: filesystem fallback is disabled by default and can be verified with the audit tooling.
- Scheduler inspection: the app can now inspect `cron.job` without the earlier BigInt serialization failure.

Live production verification on the current codebase showed:

- `/api/version` reports build metadata and public-env configuration state.
- the storage audit returns zero legacy document references when fallback is disabled and the migration is clean.
- the scheduler status route can return live cron job data instead of failing on `BigInt` serialization.

## What Is Fully In Place

### 1. Database

- Prisma repositories and services are the main data access layer.
- Supabase Postgres is the canonical database.
- The browser is never meant to read privileged tables directly.

### 2. Storage

- PDFs and uploads are stored under the private `laportal-documents` bucket.
- Storage keys, not local filesystem paths, are the active source of truth.
- Legacy filesystem fallback stays off unless an audit proves it is needed again.

### 3. Realtime

- Realtime uses Supabase channels.
- Browser clients receive short-lived tokens from the app via `/api/realtime/token`.
- Server broadcasts go through the shared Realtime shim in `src/lib/sse.ts`.

### 4. Shared Rate Limiting

- Login and chat throttles are stored in Postgres instead of process memory.
- This removes single-instance behavior for those request gates.

### 5. Job Ledger

- Background job runs are written to `job_runs`.
- Admin health surfaces recent job execution state and timing.

### 6. Scheduler Controls

- `JOB_SCHEDULER=app` keeps app-owned cron active.
- `JOB_SCHEDULER=supabase` enables Supabase ownership only when confirmation is explicit.
- `SUPABASE_SCHEDULER_CONFIRMED=true` is the final switch that lets the active scheduler mode move to Supabase.
- The scheduler route now supports both inspection and reconciliation.

## What Is Intentionally Still Open

### NextAuth remains the session authority

This migration slice intentionally kept auth on NextAuth. A full move to Supabase Auth would require additional work for:

- credentials login
- role handling
- setup-complete gating
- server-side session access in route handlers
- account lifecycle decisions

That migration is not required for the current platform state.

### Scheduler ownership remains an explicit decision

The code now supports Supabase scheduler ownership, but the team still has to choose whether to enable it in production. If the goal is to keep app-owned scheduling, nothing else is required. If the goal is to move ownership to Supabase, the operational check is:

1. Confirm `/api/internal/platform/supabase-scheduler` returns live cron state.
2. Verify the expected jobs exist:
   - `laportal-event-reminders`
   - `laportal-payment-follow-ups`
   - `laportal-account-follow-ups`
3. Set `SUPABASE_SCHEDULER_CONFIRMED=true`.

### Optional cleanup

- Retention for old `rate_limit_events` rows is still optional.
- The legacy filesystem audit tooling stays in the repo for safety even though the current production posture is storage-first.

## Operational Checks

Use these routes and commands when you want to verify the platform state:

- `/api/version` - build metadata and build-time public env
- `GET /api/internal/platform/storage-audit` - legacy document audit
- `GET /api/internal/platform/supabase-scheduler` - scheduler inspection
- `npm run audit:legacy-documents` - local legacy storage audit
- `npm run ship-check` - normal release gate

## What This Means For Future Work

- Keep Supabase Storage, Realtime, and Postgres as the default platform assumptions.
- Treat `SUPABASE_SCHEDULER_CONFIRMED` as a deliberate operations switch, not a casual setting.
- Do not migrate auth to Supabase Auth unless the project gains a separate, explicit migration scope.
- When platform behavior changes, update `README.md`, `docs/README.md`, `docs/PROJECT-OVERVIEW.md`, and the AI handoff docs together.
