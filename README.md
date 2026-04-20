# LAPortal

Operations portal for Los Angeles Pierce College.

Live: https://laportal.montalvo.io

## What it covers

LAPortal is no longer just an invoice/quote app. The current repo includes:

- invoices, PDF generation, and approval/signature workflows
- quotes with public review/payment flows and follow-up tracking
- staff directory and account-code management
- dashboard analytics, notifications, calendar, and reminders
- product catalog tooling, Prism sync, saved views, batch add, and bulk edit
- textbook requisitions and public submission flow
- print pricing configuration and print quotes
- reusable templates, archive/restore flows, saved searches, user drafts, and user preferences
- admin settings, user management, and platform health endpoints

## Stack

| Layer | Technology |
| --- | --- |
| Framework | Next.js 14 App Router |
| Runtime | Node 22 |
| Database | Supabase Postgres via Prisma 7 |
| Storage / Realtime | Supabase Storage + Realtime |
| Auth | NextAuth credentials + JWT sessions |
| Styling | Tailwind CSS 4 + base-ui/shadcn-style components |
| PDF | Puppeteer + pdf-lib |
| Testing | Vitest + React Testing Library |
| Deploy | Docker Compose behind Traefik |

## Local development

```bash
npm install
npm run git:bootstrap
npx prisma generate
npm run dev
```

Useful commands:

```bash
npm run lint
npm test
npm run build
npm run ship-check
npm run hotfix:preflight
npm run hotfix:deploy -- <ref>
```

## Git workflow

This repo is set up for multi-machine and AI-agent handoffs.

```bash
npm run git:start-branch -- feat/thing
npm run git:resume-branch -- feat/thing
npm run git:publish-pr
```

Rules that are actually enforced by the repo scripts/hooks:

- GitHub is the source of truth. Local branches are disposable caches.
- One branch has one active writer at a time.
- `npm run ship-check` requires a totally clean working tree, including no untracked files.
- the `pre-push` hook blocks stale/non-fast-forward feature-branch pushes and blocks pushes to branches with open PRs unless `CR_FIX=1`
- `npm run git:publish-pr` requires `gh`, a clean working tree, a non-`main` branch, and a current `ship-check` stamp for `HEAD`
- once a PR exists, only push review fixes with `CR_FIX=1 git push`

See `docs/GIT-WORKFLOW.md` for the full flow.

## Deployment

Production uses the repo-local Docker Compose stack and `scripts/deploy-webhook.sh`.

Current deploy behavior:

- CI runs `actionlint`, `migration-check`, and `ship-check`
- qualifying PRs can have GitHub native auto-merge enabled automatically when `AUTOMERGE_PAT` is configured
- `main` deploys are exact-SHA deployments after matching CI succeeds
- GitHub prefers SSH deploys and falls back to the legacy webhook only if SSH deploy secrets are absent
- the VPS deploy script builds the candidate image, runs `prisma migrate deploy` plus `node scripts/check-products-derived-view.mjs`, then replaces the live container only if that preflight passes
- the deploy verifies `/api/version`, runs route smoke checks, and rolls back on post-swap failure
- the container does not auto-run Prisma migrations on startup unless `RUN_PRISMA_MIGRATIONS_ON_START=1`

## Required env

Core env expected by the app/runtime:

```bash
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...
NEXTAUTH_SECRET=...
NEXTAUTH_URL=https://laportal.montalvo.io
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_JWT_SECRET=...
JOB_SCHEDULER=app
SUPABASE_SCHEDULER_CONFIRMED=false
CRON_SECRET=...
ALLOW_LEGACY_FILESYSTEM_FALLBACK=false
```

Important: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` must exist at image build time, not just container runtime.

## Docs

- `docs/README.md` — documentation index
- `docs/PROJECT-OVERVIEW.md` — current architecture and codebase map
- `docs/GIT-WORKFLOW.md` — enforced branch/PR workflow
- `docs/HOTFIX-WORKFLOW.md` — fast SSH hotfix lane
- `docs/DEPLOYMENT-STANDARD.md` — reusable exact-SHA deploy standard
- `docs/SUPABASE-MIGRATION-STATUS.md` — current Supabase/platform status
- `AGENTS.md` / `CLAUDE.md` — short repo-specific guidance for coding agents

## License

Private project for Los Angeles Pierce College.
