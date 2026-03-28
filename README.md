# LAPC InvoiceMaker

Invoice generation webapp for **Los Angeles Pierce College**. Handles the full lifecycle of inter-department purchase orders: invoice creation, quote management, PDF generation, staff directory, and admin operations.

**Live:** [invoice.montalvo.io](https://invoice.montalvo.io)

## Features

- **Invoice creation** with keyboard-first workflow, staff autofill, line items, tax calculation, and approval chains
- **PDF generation** — cover sheets (Puppeteer), IDP forms (pdf-lib), PrismCore merge
- **Quote management** — create, send, auto-expire, convert to invoice
- **Staff directory** — CRUD with account numbers, signer history tracking
- **Admin panel** — user management, account codes, invoice manager with inline editing, saved line items catalog, analytics dashboard
- **Dark/light theme** with UI scale controls

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
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

12 domain modules under `src/domains/` — each with types, repository, service, api-client, and hooks as needed. See [docs/PROJECT-OVERVIEW.md](docs/PROJECT-OVERVIEW.md) for full architecture details.

## Development

```bash
npm install              # Install dependencies
npx prisma generate      # Generate Prisma client
npm run dev              # Start dev server (localhost:3000)
npm test                 # Run tests (350 tests)
npm run build            # Production build
```

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

Docker Compose behind Traefik on [montalvo.io](https://montalvo.io). CI/CD via GitHub Actions — push to main triggers lint, build, test, then webhook deploy.

All changes go through PRs with squash merge. Build version (git SHA) is displayed in the nav bar.

## Project Documentation

- [CLAUDE.md](CLAUDE.md) — Quick reference for AI agents and contributors
- [docs/PROJECT-OVERVIEW.md](docs/PROJECT-OVERVIEW.md) — Comprehensive architecture, workflows, API reference
- [docs/superpowers/specs/](docs/superpowers/specs/) — Design specifications
- [docs/superpowers/plans/](docs/superpowers/plans/) — Implementation plans

## License

Private project for Los Angeles Pierce College.
