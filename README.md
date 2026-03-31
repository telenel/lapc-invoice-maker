# LAPortal

Operations portal for **Los Angeles Pierce College**. Handles the full lifecycle of inter-department purchase orders: invoice creation, quote management, PDF generation, staff directory, calendar, AI assistant, and admin operations.

**Live:** [laportal.montalvo.io](https://laportal.montalvo.io)

## Features

- **Invoice creation** with keyboard-first workflow, staff autofill, line items, tax calculation, and approval chains
- **PDF generation** — server-side Chromium CLI render, IDP forms (pdf-lib), PrismCore merge
- **Quote management** — create, send, auto-expire, convert to invoice, online sharing with approve/decline workflow
- **Online quote sharing** — shareable public links, recipient approve/decline, view tracking (IP, browser, duration), real-time SSE notifications
- **Staff directory** — CRUD with account numbers, signer history tracking
- **Admin panel** — user management with temporary credential reveal/reset, account codes, invoice manager with inline editing, saved line items catalog, analytics dashboard
- **Dark/light theme** with UI scale controls

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Database | PostgreSQL + Prisma 7 |
| Styling | Tailwind CSS 4 + shadcn/ui v4 |
| Auth | NextAuth (JWT + Credentials) |
| PDF | Chromium CLI + pdf-lib |
| Testing | Vitest + React Testing Library |
| Deploy | Docker Compose, Traefik, GitHub Actions CI/CD, VPS webhook |

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
npm test                 # Run tests
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
```

## Deployment

Production runs on a VPS behind Traefik. GitHub Actions validates `main`, then triggers the host webhook at `https://montalvo.io/hooks/deploy-laportal`, which executes `/opt/deploy-webhook.sh` against the production checkout at `/opt/lapc-invoice-maker`.

Deploys are verified by polling `https://laportal.montalvo.io/api/version` until the reported `buildSha` matches the pushed commit. The production app and database still use legacy `lapc-invoice-maker` Docker Compose names after the LAPortal rebrand; that naming is expected.

All changes go through PRs with squash merge. Once a PR exists, additional pushes should only be follow-up fixes (`CR_FIX=1 git push`) while the PR stays open.

## Project Documentation

- [docs/PROJECT-OVERVIEW.md](docs/PROJECT-OVERVIEW.md) — Comprehensive architecture, workflows, API reference
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — VPS topology, webhook deploy flow, rollback, verification
- [AGENTS.md](AGENTS.md) — Concise PR/review/deploy workflow for AI agents
- [docs/superpowers/specs/](docs/superpowers/specs/) — Design specifications
- [docs/superpowers/plans/](docs/superpowers/plans/) — Implementation plans

## License

Private project for Los Angeles Pierce College.
