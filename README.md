# LAPortal

Operations portal for **Los Angeles Pierce College**. Handles the full lifecycle of inter-department purchase orders: invoice creation, quote management, PDF generation, staff directory, calendar, AI assistant, and admin operations.

**Live:** [laportal.montalvo.io](https://laportal.montalvo.io)

## Features

- **Invoice creation** with keyboard-first workflow, staff autofill, line items, tax calculation, and approval chains
- **PDF generation** — cover sheets (Puppeteer), IDP forms (pdf-lib), PrismCore merge
- **Quote management** — create, send, auto-expire, convert to invoice, online sharing with approve/decline workflow
- **Online quote sharing** — shareable public links, recipient approve/decline, view tracking (IP, browser, duration), real-time SSE notifications
- **Staff directory** — CRUD with account numbers, signer history tracking
- **Admin panel** — user management, account codes, invoice manager with inline editing, saved line items catalog, analytics dashboard
- **Dark/light theme** with UI scale controls

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) |
| Database | PostgreSQL + Prisma 7 |
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
npm run laportal:review     # Local Codex review against main; writes text + JSON artifacts and stamps current HEAD
npm run laportal:review:autopilot  # One-command live review + orchestrator + delegated remediation
npm run laportal:review:watch -- --follow  # Watch the latest autopilot session summary and event log
npm run laportal:review:live  # Stream the review and publish live finding events into .git/laportal/codex-review.live.jsonl
npm run laportal:review:live:triage  # Batch the current live findings from .git/laportal/codex-review.live.json
npm run laportal:review:loop  # Run review, then print remediation batches when the result is FAIL
npm run laportal:review:json  # Same review, but prints the structured JSON artifact to stdout
npm run laportal:review -- --focus src/domains/quote/service.ts  # Review only matching changed paths
npm run laportal:review:findings  # Print unresolved findings from the latest Codex artifact
npm run laportal:review:triage  # Group the latest unresolved findings into remediation batches
npm run laportal:review:prompt -- --batch B1  # Print a bounded worker prompt for a single remediation batch
npm test                 # Run tests (350 tests)
npm run build            # Production build
```

> `npm install` automatically sets `git config core.hooksPath hooks`, which enables the tracked pre-push hook that blocks pushes to branches with open PRs.

### Database

```bash
npx prisma migrate dev --name <name>   # Create migration
npx prisma db seed                     # Seed database
```

### Environment Variables

```
DATABASE_URL=postgresql://user:pass@localhost:5432/invoicemaker
NEXTAUTH_SECRET=<secret>
NEXTAUTH_URL=http://localhost:3000
LAPORTAL_ENABLE_APP_CRON=0
```

Set `LAPORTAL_ENABLE_APP_CRON=1` only on a single long-lived app instance if you want the in-process reminder jobs enabled. Leave it unset or `0` on multi-replica or serverless-style deployments.

## Deployment

Docker Compose behind Traefik on [montalvo.io](https://montalvo.io). CI/CD via GitHub Actions — push to main triggers lint, build, test, then webhook deploy.

All changes go through PRs with squash merge. PRs are finalized once created — no further pushes except review follow-up fixes (`CR_FIX=1 git push`). Build version (git SHA) is displayed in the nav bar.

Local AI workflow is hard-coded through tracked scripts and hooks:

- `npm run ship-check`
- `npm run laportal:review`
- `./scripts/publish-pr.sh`

`npm run laportal:review` always keeps the latest text report at `.git/laportal/codex-review.txt`, the latest structured artifact at `.git/laportal/codex-review.json`, and a rolling history of the last 20 review runs in `.git/laportal/review-history/`.

`npm run laportal:review:autopilot` is the one-command workflow. It starts the live review producer, watches the live queue, and launches deterministic remediation workers into separate temporary worktrees as safe batches become available. It keeps the producer checkout read-only, falls back to the final review artifact if no live hints are emitted, and writes a session summary under `.git/laportal/autopilot/`.

While it runs, the wrapper now emits explicit lifecycle lines such as worker launch, integration, and cleanup. Each run also writes:

- `.git/laportal/autopilot/<session-id>/events.jsonl`
- `.git/laportal/autopilot/<session-id>/summary.json`
- `.git/laportal/autopilot/<session-id>/summary.txt`
- `.git/laportal/autopilot/latest-session.json`
- `.git/laportal/autopilot/latest-events.jsonl`
- `.git/laportal/autopilot/latest-summary.json`
- `.git/laportal/autopilot/latest-summary.txt`

The per-run `<session-id>/` directory is preserved for history. The `latest-*` files are overwritten on each autopilot run so follow-up tooling always has one stable target. Older session directories are pruned automatically.

Use `npm run laportal:review:watch -- --follow` in a second terminal if you want a live view of the latest session without reading raw worker logs.

`npm run laportal:review:live` streams the review output, records any `LIVE-FINDING:` lines emitted by the review prompt hook, and appends live queue events to `.git/laportal/codex-review.live.jsonl` plus a snapshot at `.git/laportal/codex-review.live.json`. Live hints are opportunistic; the final `.git/laportal/codex-review.json` artifact remains the canonical fallback.

`npm run laportal:review:triage` reads the latest structured artifact and groups unresolved findings by overlapping file ownership so an agent can keep coupled fixes local and delegate only bounded batches. `npm run laportal:review:prompt -- --batch B1` prints a worker-ready prompt for one batch.

## Project Documentation

- [docs/PROJECT-OVERVIEW.md](docs/PROJECT-OVERVIEW.md) — Comprehensive architecture, workflows, API reference
- [docs/AI-WORKFLOW.md](docs/AI-WORKFLOW.md) — Hard-coded local agent workflow and enforcement rules
- [docs/superpowers/specs/](docs/superpowers/specs/) — Design specifications
- [docs/superpowers/plans/](docs/superpowers/plans/) — Implementation plans

## License

Private project for Los Angeles Pierce College.
