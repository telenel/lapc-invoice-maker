# Supabase MCP Agent Handoff

This document is for the next AI agent that has:

- full access to Supabase via MCP or equivalent tooling
- access to this repository and its deployment environment
- the ability to create/update Supabase resources, secrets, SQL, and app env vars

Read this as the authoritative handoff for finishing the Supabase side of LAPortal.

---

## 1. Immediate User Directives

These instructions override older cutover assumptions:

1. The current server is still alpha.
2. Old database contents do **not** need to be preserved.
3. Old PDFs and uploads do **not** need to be preserved.
4. You should treat this as a **greenfield Supabase project bootstrap**, not a legacy migration.
5. Do **not** spend time on `pg_dump`, `pg_restore`, or legacy document migration unless the user changes their mind.

Implication:

- You can start from an empty Supabase Postgres database.
- You can start from an empty Supabase Storage bucket.
- You can ignore all previous filesystem-backed files and old rows.

---

## 2. Repo / Branch Constraints

Follow repo guardrails from `AGENTS.md`.

Important branch rule:

- There is already an open PR for the existing Supabase migration branch:
  - PR: `#106`
  - URL: `https://github.com/telenel/laportal/pull/106`
- Repo rule: once a PR exists, do **not** continue pushing new feature work to that same branch except explicit review follow-ups.

Recommended branch strategy:

1. Review PR `#106`.
2. If the user wants you to continue from that work, create a **new branch** from it or wait for it to merge first.
3. Do not keep stacking unrelated feature work directly on `feat/supabase-platform-migration`.

---

## 3. Read First

Before changing anything, read:

1. [AGENTS.md](/Users/montalvo/lapc-invoice-maker/AGENTS.md)
2. [README.md](/Users/montalvo/lapc-invoice-maker/README.md)
3. [PROJECT-OVERVIEW.md](/Users/montalvo/lapc-invoice-maker/docs/PROJECT-OVERVIEW.md)
4. [supabase-cutover.md](/Users/montalvo/lapc-invoice-maker/docs/operations/supabase-cutover.md)
5. [supabase README](/Users/montalvo/lapc-invoice-maker/supabase/README.md)
6. [schema.prisma](/Users/montalvo/lapc-invoice-maker/prisma/schema.prisma)

Then inspect PR `#106` and the two commits already on the migration branch:

- `1b2fb17` `feat: add Supabase realtime and storage foundation`
- `621bf1b` `feat: add Supabase cutover and persistence tooling`

---

## 4. What Is Already Implemented In Code

This is already in the repository. Do not re-implement it blindly.

### Realtime

- SSE transport has been replaced with Supabase Realtime-backed shims:
  - [sse.ts](/Users/montalvo/lapc-invoice-maker/src/lib/sse.ts)
  - [use-sse.ts](/Users/montalvo/lapc-invoice-maker/src/lib/use-sse.ts)
- NextAuth-to-Supabase Realtime JWT bridge exists:
  - [realtime token route](/Users/montalvo/lapc-invoice-maker/src/app/api/realtime/token/route.ts)
  - [realtime token signer](/Users/montalvo/lapc-invoice-maker/src/lib/supabase/realtime-token.ts)

### Storage

- Generated PDFs and uploads already target Supabase Storage abstractions:
  - [document-storage.ts](/Users/montalvo/lapc-invoice-maker/src/lib/document-storage.ts)
  - [pdf storage](/Users/montalvo/lapc-invoice-maker/src/domains/pdf/storage.ts)
  - [upload route](/Users/montalvo/lapc-invoice-maker/src/app/api/upload/route.ts)

### Drafts / Preferences

- Server-backed draft persistence exists:
  - [draft route](/Users/montalvo/lapc-invoice-maker/src/app/api/me/drafts/route.ts)
  - [draft service](/Users/montalvo/lapc-invoice-maker/src/domains/user-draft/service.ts)
- Server-backed authenticated UI preferences exist:
  - [preference route](/Users/montalvo/lapc-invoice-maker/src/app/api/me/preferences/[key]/route.ts)
  - [preference hook](/Users/montalvo/lapc-invoice-maker/src/domains/user-preference/hooks.ts)

### Scheduler Integration

- Internal cron-authenticated routes already exist:
  - [event reminders job route](/Users/montalvo/lapc-invoice-maker/src/app/api/internal/jobs/event-reminders/route.ts)
  - [payment follow-ups job route](/Users/montalvo/lapc-invoice-maker/src/app/api/internal/jobs/payment-follow-ups/route.ts)
- Scheduler mode switch exists:
  - [job-scheduler.ts](/Users/montalvo/lapc-invoice-maker/src/lib/job-scheduler.ts)
  - [instrumentation.ts](/Users/montalvo/lapc-invoice-maker/src/instrumentation.ts)

### Supabase SQL Assets

- [001_laportal_foundation.sql](/Users/montalvo/lapc-invoice-maker/supabase/sql/001_laportal_foundation.sql)
- [002_laportal_prisma_role.sql](/Users/montalvo/lapc-invoice-maker/supabase/sql/002_laportal_prisma_role.sql)
- [003_laportal_scheduler.sql](/Users/montalvo/lapc-invoice-maker/supabase/sql/003_laportal_scheduler.sql)

### Validation Status

At handoff time, these already passed on the migration branch:

- `npm run ship-check`
- `npm test`
- `npm run build`

---

## 5. What You Should Explicitly Skip

Because the user said no old data matters:

### Skip these operational steps

- old Postgres export/import
- old PDF migration
- old uploads migration
- any filesystem backfill

### Do not spend time on these unless the user changes direction

- `pg_dump`
- `pg_restore`
- `scripts/supabase/migrate-legacy-documents.ts`
- preserving old `data/pdfs`
- preserving old `public/uploads`

### Optional cleanup

If you want to simplify the codebase after the new Supabase environment is working, you may remove or de-emphasize:

- legacy document migration script
- legacy local-file fallback inside [document-storage.ts](/Users/montalvo/lapc-invoice-maker/src/lib/document-storage.ts)
- docs that assume an old-data cutover

Do that only after the empty-project Supabase path is confirmed working.

---

## 6. Recommended Target State

### Minimum practical target

Finish the platform move with:

1. Supabase Postgres as the live database
2. Supabase Storage as the live file store
3. Supabase Realtime as the live update transport
4. Supabase-managed scheduling for reminder jobs
5. Empty greenfield data setup
6. Existing NextAuth bridge retained for now

### Optional expanded target

If the user insists on a fully Supabase-native stack, continue into:

7. Supabase Auth migration

That is materially larger and touches auth/session/middleware behavior. Do not assume it is “free” just because Supabase access exists.

Recommendation:

- Get the greenfield Supabase Postgres/Storage/Realtime/Scheduler deployment working first.
- Then ask whether the user wants a second phase for full Supabase Auth.

---

## 7. Exact Mission For You

Your job is to make the repository and a new empty Supabase project work together end to end.

Specifically:

1. Create/configure the Supabase project.
2. Wire app env vars to that project.
3. Apply the repo’s Prisma schema/migrations to an empty Supabase Postgres DB.
4. Apply the repo’s Supabase SQL assets.
5. Create/verify the private storage bucket.
6. Verify Realtime private channel authorization.
7. Configure Supabase-managed scheduler jobs.
8. Deploy the app against that Supabase project.
9. Validate the main workflows on the empty system.
10. Only after that, decide whether any remaining code cleanup is needed.

---

## 8. Supabase MCP Work To Perform

Use your Supabase MCP tools to do the equivalent of the following.

### A. Create the project

Create a new Supabase project for LAPortal.

Collect:

- project ref
- project URL
- anon key
- service role key
- Postgres connection strings
- JWT signing secret details

### B. Database / connection setup

You need values for:

- `DATABASE_URL`
- `DIRECT_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_JWT_SECRET`
- `JOB_SCHEDULER`
- `CRON_SECRET`

Repo env reference:

- [.env.example](/Users/montalvo/lapc-invoice-maker/.env.example)

Use:

- `JOB_SCHEDULER=supabase`
- a strong random value for `CRON_SECRET`

### C. SQL to run

Run these in order against the empty project:

1. [002_laportal_prisma_role.sql](/Users/montalvo/lapc-invoice-maker/supabase/sql/002_laportal_prisma_role.sql)
2. Prisma migrations from the repo
3. [001_laportal_foundation.sql](/Users/montalvo/lapc-invoice-maker/supabase/sql/001_laportal_foundation.sql)
4. [003_laportal_scheduler.sql](/Users/montalvo/lapc-invoice-maker/supabase/sql/003_laportal_scheduler.sql)

Notes:

- `002` contains a password placeholder; replace it before execution.
- `003` contains secret placeholders and app URL placeholders; replace them before execution.
- Because there is no old data to preserve, you do not need restore/import steps before migrations.

### D. Storage

Confirm bucket:

- `laportal-documents`

It should be private.

### E. Scheduler

Use Supabase-managed cron.

The current repo already supports calling:

- `POST /api/internal/jobs/event-reminders`
- `POST /api/internal/jobs/payment-follow-ups`

These require:

- `Authorization: Bearer <CRON_SECRET>`

Your job is to ensure Supabase cron calls those routes successfully.

---

## 9. Application-Side Files Most Likely To Matter

Review these carefully before making changes:

### Core Supabase plumbing

- [src/lib/supabase/env.ts](/Users/montalvo/lapc-invoice-maker/src/lib/supabase/env.ts)
- [src/lib/supabase/admin.ts](/Users/montalvo/lapc-invoice-maker/src/lib/supabase/admin.ts)
- [src/lib/supabase/browser.ts](/Users/montalvo/lapc-invoice-maker/src/lib/supabase/browser.ts)
- [src/lib/supabase/realtime-token.ts](/Users/montalvo/lapc-invoice-maker/src/lib/supabase/realtime-token.ts)
- [src/lib/realtime-topics.ts](/Users/montalvo/lapc-invoice-maker/src/lib/realtime-topics.ts)

### Database / Prisma

- [src/lib/prisma.ts](/Users/montalvo/lapc-invoice-maker/src/lib/prisma.ts)
- [prisma.config.ts](/Users/montalvo/lapc-invoice-maker/prisma.config.ts)
- [prisma/schema.prisma](/Users/montalvo/lapc-invoice-maker/prisma/schema.prisma)

### Storage / PDFs / uploads

- [src/lib/document-storage.ts](/Users/montalvo/lapc-invoice-maker/src/lib/document-storage.ts)
- [src/domains/pdf/storage.ts](/Users/montalvo/lapc-invoice-maker/src/domains/pdf/storage.ts)
- [src/domains/pdf/service.ts](/Users/montalvo/lapc-invoice-maker/src/domains/pdf/service.ts)
- [src/app/api/upload/route.ts](/Users/montalvo/lapc-invoice-maker/src/app/api/upload/route.ts)

### Scheduler / jobs

- [src/instrumentation.ts](/Users/montalvo/lapc-invoice-maker/src/instrumentation.ts)
- [src/lib/job-scheduler.ts](/Users/montalvo/lapc-invoice-maker/src/lib/job-scheduler.ts)
- [src/domains/shared/cron.ts](/Users/montalvo/lapc-invoice-maker/src/domains/shared/cron.ts)
- [src/domains/event/reminders.ts](/Users/montalvo/lapc-invoice-maker/src/domains/event/reminders.ts)
- [src/domains/quote/follow-ups.ts](/Users/montalvo/lapc-invoice-maker/src/domains/quote/follow-ups.ts)

### Drafts / preferences

- [src/app/api/me/drafts/route.ts](/Users/montalvo/lapc-invoice-maker/src/app/api/me/drafts/route.ts)
- [src/app/api/me/preferences/[key]/route.ts](/Users/montalvo/lapc-invoice-maker/src/app/api/me/preferences/[key]/route.ts)
- [src/lib/use-auto-save.ts](/Users/montalvo/lapc-invoice-maker/src/lib/use-auto-save.ts)

---

## 10. Greenfield Setup Plan

Because there is no data to migrate, use this order:

### Step 1

Get the new Supabase project created and configured.

### Step 2

Set app environment variables to the new project.

### Step 3

Run:

```bash
npx prisma migrate deploy
npx prisma generate
```

against the empty Supabase DB.

### Step 4

Apply the Supabase SQL bootstrap files.

### Step 5

Deploy the app.

### Step 6

Use the app’s existing setup flow to create the first admin user if you are keeping NextAuth:

- visit `/setup`
- create the first user

### Step 7

Verify these workflows:

1. login/setup works
2. notifications work across tabs
3. invoice create/finalize works
4. quote create/send/public-review works
5. uploads work
6. print pricing PDF generation works
7. dashboard/staff/calendar live invalidation works
8. scheduler routes work when triggered by Supabase cron

---

## 11. Auth Guidance

### Recommended default

Keep the current auth model for now:

- NextAuth credentials
- app `users` table
- Supabase Realtime JWT bridge

Why:

- it is already implemented
- it is lower risk
- it still allows the rest of the platform to be fully on Supabase

### If the user explicitly demands Supabase Auth too

Treat that as a separate, larger phase.

Surfaces you would need to audit at minimum:

- [src/lib/auth.ts](/Users/montalvo/lapc-invoice-maker/src/lib/auth.ts)
- `src/middleware.ts`
- session provider/components
- setup flow
- role handling
- `setupComplete` gating
- any route relying on NextAuth session shape

Do not quietly change auth architecture without re-validating:

1. credentials login
2. admin/user roles
3. first-user setup
4. middleware redirects
5. server route session access

---

## 12. What To Ignore From The Existing Cutover Docs

The existing cutover docs include legacy migration instructions because that was the original assumption.

For this user’s current direction, you can ignore:

- database import sections
- old document migration sections
- rollback notes based on preserving old content

Use them only as structural reference, not as requirements.

---

## 13. Cleanup Opportunities After Greenfield Success

Once the empty Supabase deployment works, you may simplify:

1. remove legacy file fallback logic from [document-storage.ts](/Users/montalvo/lapc-invoice-maker/src/lib/document-storage.ts)
2. remove or archive [migrate-legacy-documents.ts](/Users/montalvo/lapc-invoice-maker/scripts/supabase/migrate-legacy-documents.ts)
3. simplify [supabase-cutover.md](/Users/montalvo/lapc-invoice-maker/docs/operations/supabase-cutover.md) for greenfield use

Do not do cleanup first. Prove the new environment works first.

---

## 14. Validation Requirements

Before you hand the work back, run:

```bash
npm run ship-check
```

Also validate manually:

1. create new admin user on empty DB
2. create invoice
3. finalize invoice
4. upload PrismCore PDF
5. create quote
6. send/share quote
7. open public quote page
8. approve/decline quote
9. verify notifications
10. verify Supabase cron can hit the internal job routes

---

## 15. Deliverables Expected From You

When you finish, provide:

1. the Supabase project identifier
2. confirmation that env vars were configured
3. confirmation that SQL assets were applied
4. confirmation that the app is using the empty Supabase Postgres DB
5. confirmation that no old data migration was performed
6. validation results
7. any remaining blockers or open decisions

---

## 16. Bottom Line

Do not overcomplicate this with legacy migration work.

The user has explicitly said:

- old DB data does not matter
- old PDFs do not matter
- this is alpha

So your best path is:

1. stand up a clean Supabase project
2. wire the app to it
3. run Prisma migrations on the empty DB
4. apply the Supabase SQL assets
5. deploy
6. verify workflows
7. only then consider further cleanup or a Supabase Auth phase
