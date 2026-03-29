# LAPC InvoiceMaker

Invoice generation webapp for Los Angeles Pierce College. Next.js 14 (App Router), Prisma 7, PostgreSQL, Tailwind CSS 4, shadcn/ui v4.

> **Comprehensive documentation:** See [docs/PROJECT-OVERVIEW.md](docs/PROJECT-OVERVIEW.md) for full architecture, domain module details, API routes reference, PDF pipeline, testing guide, and all workflows.

## Stack Gotchas

### Prisma 7

- Client imports: `import { PrismaClient } from "@/generated/prisma/client"` — NOT `@prisma/client`
- Constructor: `new PrismaClient({ adapter: new PrismaPg({ connectionString }) })`
- Decimal fields come back as strings — always `Number(field)` before `.toFixed()` or arithmetic
- Schema config lives in `prisma.config.ts` (uses dotenv for datasource URL)
- Standalone scripts need `import "dotenv/config"` and the PrismaPg adapter

### shadcn/ui v4 (base-ui)

- Uses base-ui, NOT Radix — no `asChild` prop, no `buttonVariants` in server components
- Component imports from `@/components/ui/*`

### PDF Generation

- Puppeteer renders HTML templates to PDF, pdf-lib merges pages
- Templates in `src/lib/pdf/templates/` — all styles inline (no Tailwind in Puppeteer)
- Logo loaded as base64 data URI from `public/lapc-logo.png`
- Cover sheet: portrait Letter, IDP: landscape 11x8.5in
- ALL interpolated values must use `escapeHtml()` from `src/lib/html.ts` — prevents XSS/injection in rendered HTML
- Puppeteer uses `waitUntil: "domcontentloaded"` and blocks external requests
- `prismcorePath` must resolve within `public/uploads/` (path traversal protection)

## Project Structure

```text
src/
├── app/           # Next.js App Router pages and API routes
├── components/    # React components (ui/, invoice/, staff/, etc.)
├── domains/       # Domain modules (see docs/PROJECT-OVERVIEW.md for details)
│   ├── shared/    # Auth wrappers, formatters, errors, types
│   ├── staff/     # types, repository, service, api-client, hooks
│   ├── invoice/   # types, constants, calculations, repository, service, api-client, hooks
│   ├── quote/     # types, repository, service, api-client, hooks
│   ├── notification/ # types, repository, service, api-client, hooks
│   ├── event/     # types, repository, service, api-client, hooks, reminders
│   ├── chat/      # types, tools, system-prompt, hooks
│   ├── contact/   # types, repository, service (external people)
│   ├── calendar/  # api-client
│   ├── pdf/       # types, storage, service
│   ├── admin/     # types, repository, service, api-client
│   ├── analytics/ # types, repository, service
│   ├── category/  # api-client
│   ├── quick-picks/      # api-client
│   ├── saved-items/      # api-client
│   ├── user-quick-picks/ # api-client
│   └── upload/    # api-client
├── generated/     # Prisma generated client (do not edit)
└── lib/           # Utilities, auth, PDF generation, validators
prisma/
├── schema.prisma  # Database schema
├── migrations/    # Migration history
└── seed.ts        # Database seeding
scripts/           # One-off scripts (staff import, etc.)
tests/             # Domain and lib tests (315+ tests)
```

## Commands

```bash
npm run dev          # Start dev server
npm run build        # Production build (also type-checks)
npm run lint         # ESLint
npm test             # Vitest (run all tests)
npm run test:watch   # Vitest watch mode
npx vitest run --dir tests  # Run only project tests (excludes ECC dir)
npx prisma migrate dev --name <name>   # Create migration
npx prisma generate  # Regenerate client after schema changes
```

## Environment

Required in `.env`: `DATABASE_URL` (PostgreSQL), `ANTHROPIC_API_KEY` (for AI chatbot)
Note: `ANTHROPIC_API_KEY` must ALSO be in `docker-compose.yml` environment section for production.

## Scripts

Standalone scripts use `npx tsx`:

```bash
npx tsx scripts/import-staff.ts /path/to/csv
```

## Deployment

Docker Compose on montalvo.io behind Traefik. CI/CD pipeline:

1. PR created → CI (single lint/build/test job with paths-filter + Next.js cache) + CodeRabbit review
2. CodeRabbit requests changes → fix manually, resolve threads via GraphQL API
3. CodeRabbit auto-approves → auto-merge (squash) → CI on main → deploy to VPS
4. Deploy webhook validates response body, passes `BUILD_SHA` as Docker build arg

**Email:** Power Automate webhook sends from `bookstore@piercecollege.edu` shared mailbox. URL in `POWER_AUTOMATE_EMAIL_URL` env var.

## Architecture

- **Domain modules** in `src/domains/` — each domain has types, repository, service, api-client, hooks
- **Route handlers** are thin dispatchers using `withAuth()`/`withAdmin()` wrappers from `src/domains/shared/auth.ts`
- **Components** use domain api-clients (never raw `fetch()`) and domain types (never local interface duplicates)
- **Cross-domain** calls go through services and types only — never import another domain's repository
- **SSE notifications** — in-memory pub/sub in `src/lib/sse.ts`, streamed via `GET /api/notifications/stream`
- **AI Assistant** — Claude Haiku chatbot in right sidebar (`src/domains/chat/`), uses Vercel AI SDK `streamText()` + `useChat`, rate-limited per user
- **Calendar** — FullCalendar at `/calendar` merges catering events (from quotes), manual events (`Event` model), and staff birthdays
- **Event reminders** — `src/domains/event/reminders.ts` checks due reminders via scheduled trigger, sends to all users via notification system
- **Public routes** — `/quotes/review/[token]` and `/api/quotes/public/*` bypass auth (excluded in `src/middleware.ts`)

## Security Patterns

- All user input in PDF templates MUST be wrapped with `escapeHtml()` from `src/lib/html.ts`
- All single-resource endpoints must verify ownership: `resource.createdBy === session.user.id` (admins bypass)
- Use `forbiddenResponse()` from `src/domains/shared/auth.ts` for 403 responses
- Puppeteer blocks all external requests via request interception — only `data:` and `file:` URLs allowed
- Rate limiting on login: 5 attempts per 15min per IP+username (in-memory, `src/lib/rate-limit.ts`)
- Rate limiting on chat API: per-user limit to prevent cost exhaustion
- Chat system prompt escapes user name to prevent prompt injection
- Chat message links sanitized: only `http://`, `https://`, and relative URLs rendered
- CSV exports: `escapeCsv()` prefixes formula triggers (`=+-@`) with `'`

## Conventions

- All Prisma models: `@@map("snake_case_table")`, fields: `@map("snake_case_column")`
- Files: kebab-case. Components: PascalCase
- API routes: validate with Zod, use `withAuth`/`withAdmin`, return `NextResponse`
- Account Number and Account Code are separate fields — don't conflate them
- TAX_RATE = 0.0975 (Woodland Hills combined rate) in `src/domains/invoice/constants.ts`
- Per-item `isTaxable` flag — catering quotes force all items taxable (CDTFA Reg 1603)
- Margin markup: `costPrice` stored separately, customer sees only charged price
- Always update Zod schemas in `src/lib/validators.ts` when adding new fields to Prisma models
- Use explicit null checks (`!= null`) not truthy checks when converting Prisma Decimal fields
- Always push changes through PRs — never merge directly to main
- **Always branch before editing** — never modify files on `main`, even for experiments. Run `git checkout -b feature/<name>` before touching code
- **Commit or stash before switching context** — never leave uncommitted changes on a branch when starting different work
- **One concern per branch** — don't mix unrelated changes in the same branch (e.g., dashboard UI + quote feature)
- **Always link PRs and issues** — when creating PRs or issues via `gh`, always include the URL in your response so the user can click through directly
- **Always enable auto-merge** — after creating a PR, run `gh pr merge <number> --auto --squash` so it merges automatically once CI passes and CodeRabbit approves
- **Run lint+build before pushing** — `npm run lint && npm run build` catches errors locally in seconds vs minutes in CI
- **Batch fixes before pushing** — push complete fixes in one commit to avoid CodeRabbit reviewing intermediate/reverted code
- **Specs on same branch** — don't create separate PRs for design specs; commit them on the feature branch
