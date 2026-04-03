# Supabase Cutover Runbook

This runbook moves LAPortal onto Supabase-managed Postgres, Storage, Realtime, and scheduler orchestration.

It assumes:

- the application code from `feat/supabase-platform-migration` is deployed
- you can access the current source database
- you can create a new Supabase project and run SQL in the Supabase dashboard

## 1. Create the Supabase project

1. Create a new Supabase project.
2. Open `Connect` in the Supabase dashboard and copy:
   - the direct Postgres connection string
   - the Supavisor session pooler connection string on port `5432`
   - the Supabase project URL
   - the anon key
   - the service role key
3. Open `Project Settings -> JWT` and copy or import the HS256 signing secret that will be used as `SUPABASE_JWT_SECRET`.

## 2. Create the Prisma database role

Run [`002_laportal_prisma_role.sql`](/Users/montalvo/lapc-invoice-maker/supabase/sql/002_laportal_prisma_role.sql) in the Supabase SQL editor after replacing `__PRISMA_PASSWORD__`.

Use a dedicated `prisma` role for the application runtime. Keep the default `postgres` role for one-time admin tasks like the initial import if needed.

## 3. Set application environment variables

Recommended values for this repo:

```env
# App runtime: use the direct string when your host supports IPv6.
# If IPv6 is not available, use the Supavisor session string on port 5432.
DATABASE_URL=postgres://prisma.<project-ref>:<password>@<host>:5432/postgres

# Migrations, pg_dump, pg_restore: prefer the direct connection string.
# If direct IPv6 connectivity is unavailable, use the session pooler string.
DIRECT_URL=postgres://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres

NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
SUPABASE_JWT_SECRET=<hs256-secret>
NEXTAUTH_SECRET=<nextauth-secret>
NEXTAUTH_URL=https://laportal.example.com

# Scheduler mode
JOB_SCHEDULER=supabase
CRON_SECRET=<same-secret-used-in-003_laportal_scheduler.sql>
```

Notes:

- This app is a server-based Next.js deployment, so `DATABASE_URL` should be a direct connection or Supavisor session mode on port `5432`.
- Do not use Supavisor transaction mode on port `6543` as the main runtime URL for this app.
- `DIRECT_URL` is what the repo uses for Prisma migrations and backup/import tooling when available.

## 4. Import the existing database into Supabase Postgres

Use the current source database as the export source and Supabase as the restore target.

```bash
export SOURCE_DATABASE_URL='postgresql://...'
export TARGET_DATABASE_URL="$DIRECT_URL"

pg_dump "$SOURCE_DATABASE_URL" \
  --format=custom \
  --no-owner \
  --no-privileges \
  --file=laportal.dump

pg_restore \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  --dbname="$TARGET_DATABASE_URL" \
  laportal.dump
```

After restore, apply any repo migrations that are newer than the source database:

```bash
npx prisma migrate deploy
npx prisma generate
```

## 5. Apply the Supabase bootstrap SQL

Run these in order:

1. [`001_laportal_foundation.sql`](/Users/montalvo/lapc-invoice-maker/supabase/sql/001_laportal_foundation.sql)
2. [`002_laportal_prisma_role.sql`](/Users/montalvo/lapc-invoice-maker/supabase/sql/002_laportal_prisma_role.sql) if not already applied
3. [`003_laportal_scheduler.sql`](/Users/montalvo/lapc-invoice-maker/supabase/sql/003_laportal_scheduler.sql) after the app is deployed with `JOB_SCHEDULER=supabase` and `CRON_SECRET` configured

`001` creates the private Storage bucket and Realtime policies.

`003` installs `pg_cron`, `pg_net`, and `vault`, then schedules two Supabase-managed jobs that call:

- `POST /api/internal/jobs/event-reminders`
- `POST /api/internal/jobs/payment-follow-ups`

## 6. Migrate legacy local documents into Supabase Storage

The branch includes a document migration script for existing rows that still point at old filesystem paths.

First run a dry run:

```bash
npx tsx scripts/supabase/migrate-legacy-documents.ts --dry-run
```

If the warnings look correct, run the real migration:

```bash
npx tsx scripts/supabase/migrate-legacy-documents.ts
```

What it migrates:

- legacy invoice PDFs from `/pdfs/...` or `data/pdfs/...`
- legacy quote PDFs from `/pdfs/...` or `data/pdfs/...`
- legacy print quote PDFs from `/pdfs/...` or `data/pdfs/...`
- legacy PrismCore uploads from `/uploads/...` or `public/uploads/...`

What it updates:

- `invoices.pdf_path`
- `invoices.prismcore_path`
- `print_quotes.pdf_path`

The application also contains a temporary legacy-file fallback in `src/lib/document-storage.ts`, so documents continue to read during the cutover window even before every row is migrated.

## 7. Deploy the app against Supabase

Deploy the branch with the new environment variables.

After deployment:

1. Confirm `/api/realtime/token` returns a token for an authenticated user.
2. Confirm notifications update across tabs.
3. Confirm invoice/quote/dashboard views refetch after realtime events.
4. Confirm the internal cron routes return `200` with the configured bearer secret.

Manual smoke commands:

```bash
curl -i -X POST \
  -H "Authorization: Bearer $CRON_SECRET" \
  https://laportal.example.com/api/internal/jobs/event-reminders

curl -i -X POST \
  -H "Authorization: Bearer $CRON_SECRET" \
  https://laportal.example.com/api/internal/jobs/payment-follow-ups
```

## 8. Post-cutover validation

Run the repo validation command:

```bash
npm run ship-check
```

Then verify these workflows in the deployed environment:

1. Upload a PrismCore PDF.
2. Create and finalize an invoice.
3. Open an older invoice/quote that existed before the cutover and download its PDF.
4. Create a quote, share it publicly, and confirm quote activity updates in the admin view.
5. Mark notifications read in one tab and confirm another tab updates.
6. Reorder dashboard widgets, reload, and confirm the order is preserved.
7. Change UI scale, reload, and confirm the preference is preserved.
8. Confirm Supabase cron created rows/notifications when the internal job routes are triggered.

## 9. Rollback notes

If you need to roll back quickly:

1. Point `DATABASE_URL` and `DIRECT_URL` back to the previous database.
2. Set `JOB_SCHEDULER=app` so the Next.js process owns scheduling again.
3. Leave the Supabase storage migration in place; the application can still read legacy local documents during the transition window.
