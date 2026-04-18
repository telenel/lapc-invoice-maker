# LAPortal

Operations portal for **Los Angeles Pierce College**. Handles the full lifecycle of inter-department purchase orders: invoice creation, quote management, PDF generation, staff directory, calendar, AI assistant, and admin operations.

**Live:** [laportal.montalvo.io](https://laportal.montalvo.io)

## Features

- **Invoice creation** with keyboard-first entry, requestor autofill, distinct account number/account code fields, line items, tax calculation, and approver chains
- **PDF generation** — cover sheets (Puppeteer), IDP forms (pdf-lib), PrismCore merge
- **Quote management** — create, send, auto-expire, convert to invoice, online sharing with approve/decline flow
- **Online quote sharing** — shareable public links, recipient approve/decline, view tracking (IP, browser, duration), real-time Supabase notifications
- **Staff directory** — CRUD with account numbers, signer history tracking
- **Team visibility** — shared quote/invoice lists, dashboard activity, and read-only fiscal context across authenticated staff
- **Admin panel** — user management, account number management, invoice manager with inline editing, saved line items catalog, analytics dashboard
- **Dark/light theme** with UI scale controls

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
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
npm run git:bootstrap    # Configure the LAPortal multi-machine git defaults
npm run git:start-branch -- feat/thing # Fresh branch from updated main
npm run git:resume-branch -- feat/thing # Re-sync a remote branch on another machine
npm run git:publish-pr   # Push current branch and open a PR after validation/review
npx prisma generate      # Generate Prisma client
npm run dev              # Start dev server (localhost:3000)
npm run ship-check       # git status + lint + test + build + stamp current HEAD
npm run hotfix:preflight # Reduced local validation for production hotfixes
npm run hotfix:deploy -- <ref> # SSH deploy a pushed branch/tag through the VPS build-first flow
npm test                 # Run the full Vitest suite
npm run build            # Production build
```

### Branching

- GitHub is the source of truth. Local branches are disposable caches.
- One task gets one short-lived branch and one PR.
- One branch has one active writer at a time across all machines and AI agents.
- Start new work with `npm run git:start-branch -- feat/thing`.
- Resume existing work on another machine with `npm run git:resume-branch -- feat/thing`.
- Use `npm run git:resume-branch -- --discard-local feat/thing` only when GitHub should overwrite this machine's local copy.
- Run `npm run ship-check` before pushing.
- Open a PR with `npm run git:publish-pr`.
- Once a PR exists, only push review fixes with `CR_FIX=1 git push`.
- Merge before starting the next feature.

> `npm install` now applies LAPortal repo-local git defaults including `core.hooksPath`, `pull.ff=only`, `fetch.prune=true`, `rerere.enabled=true`, `merge.conflictStyle=zdiff3`, and `push.autoSetupRemote=true`. Run `npm run git:bootstrap` once per machine to apply the same defaults globally.

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
ALLOW_LEGACY_FILESYSTEM_FALLBACK=false
```

## Deployment

Docker Compose behind Traefik on [montalvo.io](https://montalvo.io). GitHub Actions runs formal `ship-check` and `actionlint` checks on PRs and pushes, auto-merges PRs by default after a 15-minute quiet period once the latest head SHA has green CI and CodeRabbit has reviewed it or produced the latest commit, and deploys `main` after CI passes. When deploy SSH secrets are configured, GitHub now prefers an exact-SHA SSH deploy to the VPS. If those secrets are absent, it falls back to the legacy webhook path. Add `no-automerge` or `hold` to opt out.

Production build identity now comes from immutable runtime metadata baked into the image (`BUILD_SHA` / `BUILD_TIME`). The container rewrites `.build-meta.json` from those values on startup as a fallback, but `/api/version` prefers the immutable runtime values first so repo SHA, image SHA, and live app SHA do not drift. Remote deploys now verify both the live SHA and a lightweight route smoke-check set before they declare success or skip a rebuild.

Important: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` must be present at image build time, not only container runtime. The Docker build bakes those public values into the client bundle and the runtime version endpoint reports whether they were present.

If `JOB_SCHEDULER=supabase`, only set `SUPABASE_SCHEDULER_CONFIRMED=true` after the Supabase `pg_cron` jobs are verified. Until then, LAPortal keeps app-side cron active as a safe fallback.

Rate limiting is now database-backed through Postgres so login and chat throttles are shared across app instances. Job runs are also tracked in the database, and the admin Database Health page now shows recent job execution state plus a legacy document storage audit.

Use `npm run audit:legacy-documents` to inspect any remaining database references to old filesystem-backed PDF paths before enabling `ALLOW_LEGACY_FILESYSTEM_FALLBACK` again for emergency compatibility.

If local DB connectivity is unavailable, the deployed app also exposes a protected storage audit route at `GET /api/internal/platform/storage-audit` guarded by `CRON_SECRET`.

Current migration status:

- Supabase Postgres, Storage, and Realtime are live.
- Production build-time public env wiring is fixed.
- Shared rate limiting, job-run observability, and legacy storage audit tooling are in place.
- Supabase scheduler ownership is still optional and not fully complete until the app role can verify `cron` schema access and the jobs from `supabase/sql/003_laportal_scheduler.sql`.
- See [docs/SUPABASE-MIGRATION-STATUS.md](docs/SUPABASE-MIGRATION-STATUS.md) for the full status and remaining work.

## Project Documentation

- [docs/README.md](docs/README.md) — Documentation index and navigation
- [docs/PROJECT-OVERVIEW.md](docs/PROJECT-OVERVIEW.md) — Comprehensive architecture and API reference
- [docs/GIT-WORKFLOW.md](docs/GIT-WORKFLOW.md) — Multi-machine git workflow and branch handoff rules
- [docs/SUPABASE-MIGRATION-STATUS.md](docs/SUPABASE-MIGRATION-STATUS.md) — Live migration status, deployed fixes, and remaining platform work
- [docs/HOTFIX-WORKFLOW.md](docs/HOTFIX-WORKFLOW.md) — Fast SSH deploy lane for small production fixes
- [docs/DEPLOYMENT-STANDARD.md](docs/DEPLOYMENT-STANDARD.md) — Repeatable SHA-pinned deploy standard and reusable templates
- [docs/templates/deploy-smoke-check.sh.example](docs/templates/deploy-smoke-check.sh.example) — Reusable route smoke-check template
- [docs/superpowers/specs/](docs/superpowers/specs/) — Design specifications
- [docs/superpowers/plans/](docs/superpowers/plans/) — Implementation plans

## License

Private project for Los Angeles Pierce College.
