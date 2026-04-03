# Supabase Setup

This directory contains the LAPortal Supabase bootstrap assets used by the application.

## Required Services

- Supabase Postgres
- Supabase Storage
- Supabase Realtime

Auth remains on NextAuth in this migration slice. The app uses a short-lived JWT bridge for private Realtime channels.

## Environment Variables

Set these in local development and production:

```env
DATABASE_URL=postgresql://...
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
SUPABASE_JWT_SECRET=<legacy-jwt-secret-or-imported-hs256-secret>
NEXTAUTH_SECRET=<nextauth-secret>
NEXTAUTH_URL=https://laportal.example.com
```

## Bootstrap Steps

1. Provision a Supabase project.
2. Point `DATABASE_URL` at the Supabase Postgres instance.
3. Apply Prisma migrations against that database.
4. Run the SQL in [`sql/001_laportal_foundation.sql`](/Users/montalvo/lapc-invoice-maker/supabase/sql/001_laportal_foundation.sql).
5. Confirm the private Storage bucket `laportal-documents` exists.
6. Confirm private Realtime topic access works for:
   - `app:global`
   - `user:<app-user-id>`

## Runtime Expectations

- Uploaded PrismCore PDFs are stored under `uploads/`
- Finalized invoice PDFs are stored under `invoices/<invoice-id>/`
- Quote PDFs are stored under `quotes/<quote-id>/`
- Print quote PDFs are stored under `print-quotes/<quote-id>/`
- `/api/realtime/token` issues short-lived JWTs for browser Realtime subscriptions
- `src/lib/sse.ts` publishes server-side invalidation and notification events into Supabase Realtime

## Notes

- This slice does not migrate login/session management off NextAuth.
- This slice does not move reminder scheduling off the app runtime yet.
- The local filesystem is no longer the document source of truth.
