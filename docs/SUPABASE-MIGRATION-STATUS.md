# Supabase Migration Status

Last updated: 2026-04-04

This file is the durable status record for LAPortal's Supabase migration. It reflects the production fixes deployed on April 4, 2026 and the remaining work required to call the platform migration complete.

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

Live production verification after `e665c93`:

- `/api/version` reports `buildSha: "e665c93"`
- `publicEnv.supabaseUrlConfigured: true`
- `publicEnv.supabaseAnonKeyConfigured: true`

## What Is Still Not Fully Migrated

### 1. Supabase-managed scheduling is not fully activated

The app can target Supabase scheduler mode, but production cannot yet verify or manage `pg_cron` using the application role.

Current blocker:

- `GET /api/internal/platform/supabase-scheduler` returns `permission denied for schema cron`

What still needs to happen:

1. Use Supabase SQL Editor or a higher-privilege Postgres role to grant the app role the required `cron` schema access, or run the scheduler SQL outside the app role.
2. Verify the scheduler jobs created by [`supabase/sql/003_laportal_scheduler.sql`](../supabase/sql/003_laportal_scheduler.sql).
3. Re-run the protected scheduler diagnostic route until it returns actual job state instead of `42501`.
4. Only then set `SUPABASE_SCHEDULER_CONFIRMED=true`.

Until that happens, keeping `JOB_SCHEDULER=supabase` without confirmation would be unsafe. The app now intentionally keeps its own cron registrations active as a fallback.

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

### 4. Legacy filesystem references still need cleanup verification

The runtime source of truth is Supabase Storage, and the repo now includes an explicit audit path for old disk-backed references:

- `data/pdfs/`
- `public/uploads/`
- [`scripts/supabase/migrate-legacy-documents.ts`](../scripts/supabase/migrate-legacy-documents.ts)
- [`scripts/supabase/audit-legacy-documents.ts`](../scripts/supabase/audit-legacy-documents.ts)

What still needs to happen:

1. Run `npm run audit:legacy-documents` and inspect the remaining references.
2. Run the legacy document migration if any old files still matter.
3. Confirm there are no remaining database records pointing at legacy filesystem paths.
4. Set `ALLOW_LEGACY_FILESYSTEM_FALLBACK=false` only after that audit is clean.
5. Remove compatibility handling only after the fallback has been safely disabled.

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

1. Finish the scheduler privilege fix and verify `pg_cron` jobs live.
2. Audit and migrate any remaining legacy filesystem document references.
3. Disable legacy filesystem fallback once the audit is clean.
4. Leave auth on NextAuth unless there is a strong reason to absorb the cost of a full auth migration.
