# LAPortal Project Context

## What This Repo Is

LAPortal is the operations portal for Los Angeles Pierce College. It handles invoices, quotes, PDFs, staff data, notifications, calendar workflows, admin controls, and an AI assistant.

## Architecture Summary

- Framework: Next.js App Router
- Data boundary: authenticated API routes + domain services + Prisma repositories
- Database: Supabase Postgres via Prisma
- Storage: Supabase Storage
- Realtime: Supabase Realtime with a token bridge
- Auth: NextAuth remains the session authority

## Supabase Status

The Supabase platform migration is mostly complete, but not fully finished.

Completed:

- database on Supabase Postgres
- document storage on Supabase Storage
- realtime on Supabase Realtime
- production build-time public env fix
- platform diagnostics and scheduler inspection endpoint
- shared Postgres-backed rate limiting
- DB-backed job run tracking for scheduled jobs

Still open:

- Supabase scheduler jobs exist and the app role can now read `cron.job`
- Supabase scheduler ownership is not fully confirmed until the protected route is redeployed with the serializer fix and `SUPABASE_SCHEDULER_CONFIRMED=true` is set
- no urgent Supabase-side work is required unless the team wants Supabase to own scheduler execution

Read [docs/SUPABASE-MIGRATION-STATUS.md](../SUPABASE-MIGRATION-STATUS.md) and [docs/ai/SUPABASE-HANDOFF.md](SUPABASE-HANDOFF.md) before making infrastructure or deployment changes.
