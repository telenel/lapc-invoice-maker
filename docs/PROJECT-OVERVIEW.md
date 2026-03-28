# LAPC InvoiceMaker — Project Overview

Invoice generation webapp for Los Angeles Pierce College. Handles invoice drafting, finalization, and PDF generation for campus purchasing requests. Supports running/recurring invoices, quote creation with online sharing and approval, staff management, admin controls, real-time notifications, and dashboard analytics.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Database ORM | Prisma 7 + PostgreSQL |
| Styling | Tailwind CSS 4 + shadcn/ui v4 (base-ui) |
| Auth | NextAuth.js (credentials provider) |
| PDF | Puppeteer (render) + pdf-lib (merge) |
| Testing | Vitest |
| Deployment | Docker Compose + Traefik on montalvo.io |
| CI/CD | GitHub Actions (lint → build → test → deploy) |

---

## Project Structure

```
src/
├── app/                   # Next.js App Router pages and API routes
│   ├── api/               # Route handlers (admin, analytics, auth, categories,
│   │   │                  #   invoices, notifications, quick-picks, quotes,
│   │   │                  #   quotes/public, saved-items, setup, staff,
│   │   │                  #   upload, user-quick-picks)
│   ├── admin/
│   ├── analytics/
│   ├── invoices/
│   ├── quick-picks/
│   ├── quotes/
│   ├── staff/
│   └── setup/
│
├── components/            # React components
│   ├── ui/                # shadcn/ui base components
│   ├── invoice/
│   ├── invoices/
│   ├── notifications/     # Notification bell + dropdown
│   ├── quote/
│   ├── quotes/            # Includes share-link-dialog, quote-activity,
│   │                      #   public-quote-view
│   ├── staff/
│   ├── admin/
│   ├── analytics/
│   ├── dashboard/
│   └── quick-picks/
│
├── domains/               # Domain module architecture (see section below)
│   ├── shared/
│   ├── invoice/
│   ├── quote/
│   ├── notification/
│   ├── staff/
│   ├── admin/
│   ├── analytics/
│   ├── pdf/
│   ├── category/
│   ├── quick-picks/
│   ├── saved-items/
│   ├── user-quick-picks/
│   └── upload/
│
├── generated/             # Prisma generated client (do not edit)
│
└── lib/                   # Legacy utilities (being migrated to domains)
    ├── auth.ts
    ├── csv.ts
    ├── formatters.ts
    ├── prisma.ts
    ├── quote-number.ts
    ├── sse.ts             # In-memory SSE pub/sub for real-time notifications
    ├── themes.ts
    ├── utils.ts
    ├── validators.ts
    └── pdf/               # PDF templates and generation helpers

prisma/
├── schema.prisma
├── migrations/
└── seed.ts

tests/
├── components/
├── domains/
└── lib/

docs/
├── superpowers/
│   ├── plans/             # Implementation plans
│   └── specs/             # Design specs
└── PROJECT-OVERVIEW.md    # This file
```

---

## Domain Module Architecture

The codebase uses a domain-module architecture with clear separation of concerns. All components use typed api-client wrappers — no raw `fetch()` calls exist in components.

### Directory Structure

```
src/domains/
├── shared/
│   ├── types.ts           # PaginatedResponse, ApiError
│   ├── auth.ts            # withAuth(), withAdmin() route wrappers
│   ├── formatters.ts      # Canonical formatCurrency, formatDate
│   └── errors.ts          # Typed error classes, handleApiError()
│
├── invoice/
│   ├── types.ts
│   ├── repository.ts
│   ├── service.ts
│   ├── api-client.ts
│   ├── hooks.ts
│   └── constants.ts
│
├── quote/
│   ├── types.ts
│   ├── repository.ts
│   ├── service.ts
│   ├── api-client.ts
│   └── hooks.ts
│
├── notification/
│   ├── types.ts
│   ├── repository.ts
│   ├── service.ts
│   ├── api-client.ts
│   └── hooks.ts
│
├── staff/
│   ├── types.ts
│   ├── repository.ts
│   ├── service.ts
│   ├── api-client.ts
│   └── hooks.ts
│
├── admin/
│   ├── types.ts
│   ├── repository.ts
│   ├── service.ts
│   └── api-client.ts
│
├── analytics/
│   ├── types.ts
│   ├── repository.ts
│   └── service.ts
│
├── pdf/
│   ├── types.ts
│   ├── service.ts
│   └── storage.ts
│
├── category/
│   └── api-client.ts
│
├── quick-picks/
│   └── api-client.ts
│
├── saved-items/
│   └── api-client.ts
│
├── user-quick-picks/
│   └── api-client.ts
│
└── upload/
    └── api-client.ts
```

### Layer Responsibilities

**Repository** — Pure Prisma wrappers. No business logic, no auth, no formatting. Returns domain types that mirror DB shape with relations.

**Service** — Orchestrates repositories, enforces business rules, owns calculations. Returns response DTOs (serialization boundary where `Number(decimalField)` conversion happens).

**API Client** — Client-side typed fetch wrappers. One per domain. Only file that knows endpoint URLs for its domain. Handles response parsing and error normalization.

**Hooks** — React hooks wrapping api-client calls with `useState`/`useCallback`/`useEffect`. Returns `{ data, loading, error, refetch }` pattern.

### Dependency Rules

1. Domains import from `shared/` and their own directory only.
2. Cross-domain references go through `types.ts` and `service.ts` only — never another domain's repository, api-client, or hooks.
3. Route handlers import from the domain service — never from a repository directly.
4. Components import from domain `api-client.ts` and `hooks.ts` — never use raw `fetch()`.

### Domains with Full Layers

| Domain | repository | service | api-client | hooks |
|---|---|---|---|---|
| invoice | yes | yes | yes | yes |
| quote | yes | yes | yes | yes |
| staff | yes | yes | yes | yes |
| admin | yes | yes | yes | — |
| analytics | yes | yes | — | — |
| notification | yes | yes | yes | yes |
| pdf | — | yes | — | — |
| shared | — | — | — | — |

### Domains with api-client Only

These domains encapsulate endpoint URLs and response parsing for smaller feature areas:

- `category` — invoice/quote category listing
- `quick-picks` — admin-managed quick pick items catalog
- `saved-items` — admin saved line item catalog
- `user-quick-picks` — per-user quick pick selections
- `upload` — file upload handling

---

## Data Models (Key)

| Model | Description |
|---|---|
| `User` | App user accounts with roles (admin/user) |
| `Staff` | Pierce College staff members for invoice attribution |
| `StaffAccountNumber` | Account numbers associated with staff |
| `StaffSignerHistory` | Approval chain signer history per staff member |
| `Invoice` | Core invoice records with status, line items, PDF paths |
| `LineItem` | Invoice line items (description, quantity, unit cost) |
| `Quote` | Quote records with auto-expiry, conversion to invoice, and online sharing (shareToken) |
| `QuoteLineItem` | Quote line items |
| `QuoteView` | Tracks public quote page views (IP, user-agent, referrer, viewport, duration, response) |
| `Notification` | Real-time notifications for quote events (viewed, approved, declined) |
| `AccountCode` | Admin-managed account code catalog |
| `SavedLineItem` | Admin-managed saved line items catalog |
| `QuickPick` | Admin-managed quick pick items |
| `UserQuickPick` | Per-user quick pick selections |
| `Category` | Invoice/quote categories |

---

## PDF Generation

- Puppeteer renders HTML templates to PDF; pdf-lib merges pages.
- Templates live in `src/lib/pdf/templates/` — all styles are inline (no Tailwind in Puppeteer).
- Logo loaded as base64 data URI from `public/lapc-logo.png`.
- Cover sheet: portrait Letter. IDP (Internal Distribution Page): landscape 11×8.5in.
- `pdf/service.ts` owns the Puppeteer lifecycle; `pdf/storage.ts` abstracts file I/O.

---

## Authentication

- NextAuth.js credentials provider with bcrypt password hashing.
- Roles: `admin` and `user`. First user to complete setup is automatically admin.
- `withAuth()` / `withAdmin()` route wrappers in `shared/auth.ts` centralize session checks.
- Setup flow redirects unauthenticated users to `/setup` or `/login` via middleware.

---

## Online Quote Sharing

Quotes can be shared with external recipients via token-based public links.

### Flow

1. User clicks "Mark as Sent" on a DRAFT quote → backend generates a UUID `shareToken`, sets status to SENT
2. A dialog appears with the share URL, a "Copy Link" button, and an "Email Link" button (opens `mailto:`)
3. Recipient opens the link → public review page at `/quotes/review/[token]` (no auth required)
4. Page visit is recorded as a `QuoteView` (IP, user-agent, referrer, viewport, duration via `sendBeacon`)
5. Recipient clicks "Approve" or "Decline" → quote status updates, notification pushed to creator

### SSE Notifications

Real-time notifications via Server-Sent Events:

- **Endpoint:** `GET /api/notifications/stream` (authenticated)
- **Pub/sub:** In-memory `Map<userId, Set<controller>>` in `src/lib/sse.ts`
- **Events:** `QUOTE_VIEWED` (10-min debounce), `QUOTE_APPROVED`, `QUOTE_DECLINED`
- **UI:** Bell icon in navbar with unread count badge and dropdown

### Public Routes (no auth)

| Route | Method | Purpose |
|-------|--------|---------|
| `/quotes/review/[token]` | Page | Public quote review page |
| `/api/quotes/public/[token]` | GET | Fetch quote by share token |
| `/api/quotes/public/[token]/view` | POST | Register page view |
| `/api/quotes/public/[token]/view/[viewId]` | PATCH | Update view duration (beacon) |
| `/api/quotes/public/[token]/respond` | POST | Accept/decline quote |

These routes are excluded from auth middleware in `src/middleware.ts`.

---

## Testing

**Total: 350 tests** across 19 test files.

### Test Files

| File | Domain/Layer |
|---|---|
| `tests/components/invoice-form-logic.test.ts` | Components |
| `tests/domains/admin/service.test.ts` | Admin domain (25 tests) |
| `tests/domains/analytics/service.test.ts` | Analytics domain (4 tests) |
| `tests/domains/invoice/calculations.test.ts` | Invoice domain |
| `tests/domains/invoice/repository.test.ts` | Invoice domain (24 tests) |
| `tests/domains/invoice/service.test.ts` | Invoice domain (34 tests) |
| `tests/domains/pdf/service.test.ts` | PDF domain (7 tests) |
| `tests/domains/pdf/storage.test.ts` | PDF domain |
| `tests/domains/quote/service.test.ts` | Quote domain (33 tests) |
| `tests/domains/shared/auth.test.ts` | Shared auth |
| `tests/domains/shared/formatters.test.ts` | Shared formatters |
| `tests/domains/staff/repository.test.ts` | Staff domain |
| `tests/domains/staff/service.test.ts` | Staff domain |
| `tests/lib/auth-logic.test.ts` | Auth lib |
| `tests/lib/csv-export.test.ts` | CSV export lib |
| `tests/lib/pdf-merge.test.ts` | PDF merge lib |
| `tests/lib/pdf-templates.test.ts` | PDF templates lib |
| `tests/lib/themes.test.ts` | Themes lib |
| `tests/lib/validators.test.ts` | Validators lib |

### Commands

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
```

---

## Development & Deployment

### Local Development

```bash
npm run dev           # Start dev server
npm run build         # Production build (also type-checks)
npm run lint          # ESLint
npx prisma migrate dev --name <name>   # Create migration
npx prisma generate   # Regenerate client after schema changes
```

### Build Version Indicator

The navigation bar displays the current git short SHA as a build version indicator. It is injected at build time via `next.config.mjs`:

```js
env: {
  NEXT_PUBLIC_BUILD_SHA: gitSha(),       // git rev-parse --short HEAD
  NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
}
```

In production, `NEXT_PUBLIC_BUILD_SHA` reflects the exact commit deployed. Falls back to `"dev"` when git is unavailable.

### PR Workflow

All changes go through pull requests targeting `main`. PRs are squash-merged after CI passes. Direct pushes to `main` are not used for feature work.

### CI/CD Pipeline

GitHub Actions runs on every push to `main` and every PR targeting `main`:

1. **Lint & Build** — `npm run lint` + `npx prisma generate` + `npm run build`
2. **Tests** — `npm test`
3. **Deploy** (push to `main` only) — triggers HTTPS webhook at `montalvo.io/hooks/deploy-lapc`

Deployment is Docker Compose on montalvo.io behind Traefik. The deploy webhook triggers a build-first strategy (no docker-down before build).

### Stack Gotchas

**Prisma 7**
- Client import: `import { PrismaClient } from "@/generated/prisma/client"` — NOT `@prisma/client`
- Constructor: `new PrismaClient({ adapter: new PrismaPg({ connectionString }) })`
- Decimal fields come back as strings — always `Number(field)` before `.toFixed()` or arithmetic
- Schema config lives in `prisma.config.ts`

**shadcn/ui v4 (base-ui)**
- Uses base-ui, NOT Radix — no `asChild` prop, no `buttonVariants` in server components
- Component imports from `@/components/ui/*`

### Conventions

- All Prisma models: `@@map("snake_case_table")`, fields: `@map("snake_case_column")`
- Files: kebab-case. Components: PascalCase
- API routes: validate with Zod, check `getServerSession()`, return `NextResponse`
- Account Number and Account Code are separate fields — do not conflate them
