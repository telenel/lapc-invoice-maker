# LAPortal

Operations portal for **Los Angeles Pierce College**. Handles the full lifecycle of inter-department purchase orders: invoice creation, quote management, PDF generation, staff directory, calendar, AI assistant, and admin operations.

**Live:** [laportal.montalvo.io](https://laportal.montalvo.io)

## Features

- **Invoice creation** with keyboard-first entry, staff autofill, line items, tax calculation, and approval chains
- **PDF generation** — cover sheets (Puppeteer), IDP forms (pdf-lib), PrismCore merge
- **Quote management** — create, send, auto-expire, convert to invoice, online sharing with approve/decline flow
- **Online quote sharing** — shareable public links, recipient approve/decline, view tracking (IP, browser, duration), real-time Supabase notifications
- **Staff directory** — CRUD with account numbers, signer history tracking
- **Admin panel** — user management, account codes, invoice manager with inline editing, saved line items catalog, analytics dashboard
- **Dark/light theme** with UI scale controls

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) |
| Database | Supabase Postgres + Prisma 7 |
| Storage / Realtime | Supabase Storage + Realtime |
| Styling | Tailwind CSS 4 + shadcn/ui v4 |
| Auth | NextAuth (JWT + Credentials) |
| PDF | Puppeteer + pdf-lib |
| Testing | Vitest + React Testing Library |
| Deploy | Docker Compose, Traefik, GitHub Actions CI/CD |

## Architecture

Domain module architecture with isolated layers:

```
Route Handler → withAuth() → Domain Service → Domain Repository → Prisma
Component → Domain API Client → Domain Hooks → Domain Types (DTOs)
```

13 domain modules under `src/domains/` — each with types, repository, service, api-client, and hooks as needed. See [docs/PROJECT-OVERVIEW.md](docs/PROJECT-OVERVIEW.md) for full architecture details.

## Development

```bash
npm install              # Install dependencies + configure git hooks
npx prisma generate      # Generate Prisma client
npm run dev              # Start dev server (localhost:3000)
npm run ship-check       # git status + lint + test + build + stamp current HEAD
npm test                 # Run the full Vitest suite
npm run build            # Production build
```

### Branching

- Start from a fresh `main` branch: `git checkout main && git pull`
- Create one focused branch per change: `git checkout -b feat/thing`
- Keep the branch small and avoid stacking branches
- Commit often, but keep each commit scoped to the one concern
- Run `npm run ship-check` before pushing
- Push the branch when it is ready for PR review
- Let CodeRabbit and CI review the PR
- Merge before starting the next feature

> `npm install` automatically sets `git config core.hooksPath hooks`, which enables the tracked pre-push hook that blocks pushes to branches with open PRs.

### Database

```bash
npx prisma migrate dev --name <name>   # Create migration
npx prisma migrate deploy              # Apply migrations to Supabase/production
npx prisma db seed                     # Seed database
```

### Environment Variables

```
DATABASE_URL=postgresql://user:pass@host:5432/postgres
DIRECT_URL=postgresql://user:pass@host:5432/postgres
NEXTAUTH_SECRET=<secret>
NEXTAUTH_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
SUPABASE_JWT_SECRET=<jwt-secret>
JOB_SCHEDULER=app
SUPABASE_SCHEDULER_CONFIRMED=false
CRON_SECRET=<cron-secret-for-internal-job-routes>
ALLOW_LEGACY_FILESYSTEM_FALLBACK=true
```

## Deployment

Docker Compose behind Traefik on [montalvo.io](https://montalvo.io). GitHub Actions runs formal `ship-check` and `actionlint` checks on PRs and pushes, auto-merges PRs by default after a 15-minute quiet period once the latest head SHA has green CI and CodeRabbit has reviewed it or produced the latest commit, and deploys `main` via webhook after CI passes. Add `no-automerge` or `hold` to opt out. Production images also carry a `.build-meta.json` stamp so `/api/version` can report the deployed commit reliably.

Important: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` must be present at image build time, not only container runtime. The Docker build now bakes those public values into the client bundle and records whether they were present in `.build-meta.json`.

If `JOB_SCHEDULER=supabase`, only set `SUPABASE_SCHEDULER_CONFIRMED=true` after the Supabase `pg_cron` jobs are verified. Until then, LAPortal keeps app-side cron active as a safe fallback.

Rate limiting is now database-backed through Postgres so login and chat throttles are shared across app instances. Job runs are also tracked in the database, and the admin Database Health page now shows recent job execution state plus a legacy document storage audit.

Use `npm run audit:legacy-documents` to inspect any remaining database references to old filesystem-backed PDF paths before disabling `ALLOW_LEGACY_FILESYSTEM_FALLBACK`.

If local DB connectivity is unavailable, the deployed app also exposes a protected storage audit route at `GET /api/internal/platform/storage-audit` guarded by `CRON_SECRET`.

Current migration status:

- Supabase Postgres, Storage, and Realtime are live.
- Production build-time public env wiring is fixed.
- Shared rate limiting, job-run observability, and legacy storage audit tooling are in place.
- Supabase scheduler ownership is still optional and not fully complete until the app role can verify `cron` schema access and the jobs from `supabase/sql/003_laportal_scheduler.sql`.
- See [docs/SUPABASE-MIGRATION-STATUS.md](docs/SUPABASE-MIGRATION-STATUS.md) for the full status and remaining work.

## Project Documentation

- [docs/PROJECT-OVERVIEW.md](docs/PROJECT-OVERVIEW.md) — Comprehensive architecture and API reference
- [docs/SUPABASE-MIGRATION-STATUS.md](docs/SUPABASE-MIGRATION-STATUS.md) — Live migration status, deployed fixes, and remaining platform work
- [docs/superpowers/specs/](docs/superpowers/specs/) — Design specifications
- [docs/superpowers/plans/](docs/superpowers/plans/) — Implementation plans

## License

Private project for Los Angeles Pierce College.
