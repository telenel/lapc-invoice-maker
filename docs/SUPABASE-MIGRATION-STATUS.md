# Supabase Migration Status

Last updated: 2026-04-05

This file is the durable status record for LAPortal's Supabase migration. It reflects the production fixes deployed on April 4-5, 2026 and the remaining work required to call the platform migration complete.

## Current State

LAPortal is already using Supabase for the major infrastructure layers that were the intended target of the migration:

- Database: Prisma is pointed at Supabase Postgres.
- Document storage: PDFs and uploads are stored in Supabase Storage through [`src/domains/pdf/storage.ts`](../src/domains/pdf/storage.ts).
- Realtime: browser subscriptions use Supabase Realtime with a short-lived token bridge through [`src/app/api/realtime/token/route.ts`](../src/app/api/realtime/token/route.ts).
- Production build wiring: public Supabase env is now baked into the client bundle at image build time and surfaced through [`/api/version`](../src/app/api/version/route.ts).
- Platform diagnostics: admin/runtime checks now distinguish build-time public env, runtime public/admin env, scheduler mode, and scheduler confirmation state.

## Production Fixes Landed

These fixes are already deployed to production:

- `062d56f` — restored Docker build-time Supabase public env wiring, platform diagnostics, and scheduler assets.
- `84fbefc` — added the protected scheduler inspection/reconcile endpoint.
- `e665c93` — kept app-side cron active unless Supabase scheduling is explicitly confirmed.
- `74b0e0c` — added shared Postgres-backed rate limiting, job-run tracking, storage audit tooling, and the protected storage audit route.
- `595be98` — disabled legacy filesystem fallback by default after production verified zero remaining legacy references.

Live production verification after `595be98`:

- `/api/version` reports `buildSha: "595be98"`
- `publicEnv.supabaseUrlConfigured: true`
- `publicEnv.supabaseAnonKeyConfigured: true`
- protected storage audit reports:
  - `legacyFilesystemFallbackEnabled: false`
  - `totalLegacyReferences: 0`

## What Is Still Not Fully Migrated

### 1. Supabase-managed scheduling is provisioned but not yet confirmed active

The Supabase scheduler infrastructure is now in place:

- the `prisma` role has read access to `cron.job` and `cron.job_run_details`
- `pg_cron`, `pg_net`, and `vault` are installed
- the expected jobs exist and are active:
  - `laportal-event-reminders`
  - `laportal-payment-follow-ups`

Current blocker:

- production still needs the scheduler serializer fix for `GET /api/internal/platform/supabase-scheduler`
- before that fix is deployed, the route fails with `Do not know how to serialize a BigInt`

What still needs to happen:

1. Deploy the scheduler serializer fix so the protected scheduler route can return live job state.
2. Re-run `GET /api/internal/platform/supabase-scheduler` until it returns `200` with the expected jobs.
3. Set `SUPABASE_SCHEDULER_CONFIRMED=true`.
4. Redeploy so app-side cron stops registering and Supabase becomes the active scheduler owner.

Until that happens, keeping `JOB_SCHEDULER=supabase` without confirmation is still intentionally fallback-safe. The app continues registering its own cron jobs until confirmation is explicit.

### 2. Authentication is still on NextAuth

This migration slice preserved auth on purpose. Realtime uses a JWT bridge, but login/session ownership still belongs to NextAuth.

That is acceptable for now. A full move to Supabase Auth would require parity for:

- credentials login flow
- role handling (`admin` vs `user`)
- setup-complete gating
- middleware redirects
- server-side session access in route handlers
- password reset / account lifecycle decisions

Recommendation: do not migrate auth unless there is a concrete product or ops reason. The current split is coherent.

### 3. Some process-local infrastructure still exists

The previous process-local rate limiting gap has been addressed:

- [`src/lib/rate-limit.ts`](../src/lib/rate-limit.ts) now stores hashed rate-limit events in Postgres.
- Login and chat throttles now share state across app instances.

What still remains in this area:

- Retention/cleanup of old rate-limit rows is currently demand-driven by active keys rather than a dedicated cleanup job.

### 4. Legacy filesystem migration is operationally complete

The runtime source of truth is Supabase Storage, and production has now verified zero remaining legacy references.

The repo still retains audit and migration tooling for safety:

- `data/pdfs/`
- `public/uploads/`
- [`scripts/supabase/migrate-legacy-documents.ts`](../scripts/supabase/migrate-legacy-documents.ts)
- [`scripts/supabase/audit-legacy-documents.ts`](../scripts/supabase/audit-legacy-documents.ts)

Current state:

1. production audit is clean
2. `ALLOW_LEGACY_FILESYSTEM_FALLBACK` now defaults to `false`
3. the fallback should only be re-enabled if a future audit proves it is actually needed

### 5. Operational runbooks should assume build-time env requirements

For Next.js client code, these public env vars must exist at image build time, not just at container runtime:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

That production mistake already happened once. Future deploy/debug workflows should always verify:

- `/api/version`
- admin platform health
- scheduler mode and confirmation state

## What Counts As "Full Migration Complete"

Treat the Supabase migration as complete only when all of the following are true:

- production client bundle has public Supabase env baked in
- runtime public and admin Supabase env are configured
- Supabase Storage is the only active document source of truth
- Realtime subscriptions are working in production
- shared rate limiting no longer depends on single-process memory
- background job execution is visible in the database/admin health surface
- Supabase scheduler jobs are verifiably installed and healthy
- `SUPABASE_SCHEDULER_CONFIRMED=true` is set intentionally after verification

## Recommended Next Steps

In order:

1. Deploy the scheduler serializer fix, verify the protected scheduler route, and set `SUPABASE_SCHEDULER_CONFIRMED=true` if the team wants Supabase to own scheduling.
2. Add a dedicated retention/cleanup policy for stale `rate_limit_events` rows if that becomes operationally useful.
3. Leave auth on NextAuth unless there is a strong reason to absorb the cost of a full auth migration.
