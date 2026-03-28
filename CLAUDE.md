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

## Project Structure

```
src/
├── app/           # Next.js App Router pages and API routes
├── components/    # React components (ui/, invoice/, staff/, etc.)
├── domains/       # Domain modules (see docs/PROJECT-OVERVIEW.md for details)
│   ├── shared/    # Auth wrappers, formatters, errors, types
│   ├── staff/     # types, repository, service, api-client, hooks
│   ├── invoice/   # types, constants, calculations, repository, service, api-client, hooks
│   ├── quote/     # types, repository, service, api-client, hooks
│   ├── notification/ # types, repository, service, api-client, hooks
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
tests/domains/     # Domain layer tests (350 tests total)
```

## Commands

```bash
npm run dev          # Start dev server
npm run build        # Production build (also type-checks)
npm run lint         # ESLint
npm test             # Vitest (run all tests)
npm run test:watch   # Vitest watch mode
npx prisma migrate dev --name <name>   # Create migration
npx prisma generate  # Regenerate client after schema changes
```

## Deployment

Docker Compose on montalvo.io behind Traefik. CI/CD via GitHub Actions — push to main triggers lint, build, test, then SSH deploy.

## Architecture

- **Domain modules** in `src/domains/` — each domain has types, repository, service, api-client, hooks
- **Route handlers** are thin dispatchers using `withAuth()`/`withAdmin()` wrappers from `src/domains/shared/auth.ts`
- **Components** use domain api-clients (never raw `fetch()`) and domain types (never local interface duplicates)
- **Cross-domain** calls go through services and types only — never import another domain's repository
- **SSE notifications** — in-memory pub/sub in `src/lib/sse.ts`, streamed via `GET /api/notifications/stream`
- **Public routes** — `/quotes/review/[token]` and `/api/quotes/public/*` bypass auth (excluded in `src/middleware.ts`)

## Conventions

- All Prisma models: `@@map("snake_case_table")`, fields: `@map("snake_case_column")`
- Files: kebab-case. Components: PascalCase
- API routes: validate with Zod, use `withAuth`/`withAdmin`, return `NextResponse`
- Account Number and Account Code are separate fields — don't conflate them
- TAX_RATE = 0.095 lives in `src/domains/invoice/constants.ts`
- Always push changes through PRs — never merge directly to main
