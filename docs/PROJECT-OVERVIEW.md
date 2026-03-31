# LAPortal — Project Overview

Operations portal for Los Angeles Pierce College. Handles invoice drafting, finalization, and PDF generation for campus purchasing requests. Supports running/recurring invoices, quote creation with online sharing and approval, staff management, admin controls, real-time notifications, calendar, AI assistant, and dashboard analytics.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Database ORM | Prisma 7 + PostgreSQL |
| Styling | Tailwind CSS 4 + shadcn/ui v4 (base-ui) |
| Auth | NextAuth.js (credentials provider) |
| PDF | Chromium CLI (HTML render) + pdf-lib (merge) |
| Testing | Vitest |
| Deployment | Docker Compose + Traefik on montalvo.io + VPS webhook |
| AI Assistant | Vercel AI SDK + Claude Haiku (streaming chat sidebar) |
| Calendar | FullCalendar (catering + manual events + birthdays) |
| Email | Power Automate webhook (shared mailbox) |
| CI/CD | GitHub Actions (lint → test → build → webhook deploy → SHA verification) |
| Code Review | CodeRabbit (chill profile, auto-review on PRs) |

---

## Deployment Topology

- Production URL: `https://laportal.montalvo.io`
- Deploy trigger: `https://montalvo.io/hooks/deploy-laportal`
- Health/build probe: `https://laportal.montalvo.io/api/version`
- VPS checkout path: `/opt/lapc-invoice-maker`
- Host deploy entrypoint: `/opt/deploy-webhook.sh`
- Reverse proxy: Traefik
- Runtime: Docker Compose app + Postgres

The production checkout and container names still use legacy `lapc-invoice-maker` naming after the LAPortal rebrand. That mismatch is expected today.

### Current Deploy Sequence

1. Merge to `main`.
2. GitHub Actions runs lint, test, and production build.
3. Actions POSTs to the VPS webhook.
4. The VPS deploy script fetches and hard-resets to `origin/main`.
5. Docker rebuilds the app image with the short git SHA embedded as `NEXT_PUBLIC_BUILD_SHA`.
6. The host script and GitHub Actions both poll `/api/version` until the live `buildSha` matches.

### Recent Operational Fixes

- Added `/api/version` so deploy verification can check the actual live build SHA.
- Fixed Docker deps stage so `postinstall` succeeds on the VPS.
- Added rollback behavior when container replacement or verification fails.
- Expanded deploy health-check timing so healthy deploys are not marked failed during startup.
- Switched production HTML-to-PDF rendering to direct Chromium CLI execution with explicit temp `HOME` and `XDG_*` paths.

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for the full VPS and deploy runbook.

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
│   ├── event/
│   ├── chat/
│   ├── contact/           # types, repository, service (external people)
│   ├── calendar/
│   ├── quick-picks/
│   ├── saved-items/
│   ├── user-quick-picks/
│   └── upload/
│
├── generated/             # Prisma generated client (do not edit)
│
└── lib/                   # Utilities, auth, PDF generation, validators
    ├── auth.ts
    ├── csv.ts
    ├── formatters.ts
    ├── html.ts            # escapeHtml() for XSS prevention in PDF templates
    ├── prisma.ts
    ├── quote-number.ts
    ├── rate-limit.ts      # Sliding window rate limiter (login protection)
    ├── sse.ts             # In-memory SSE pub/sub for real-time notifications
    ├── use-sse.ts         # Generic SSE hook for real-time updates
    ├── themes.ts
    ├── utils.ts
    ├── validators.ts
    └── pdf/               # PDF templates and generation helpers

prisma/
├── schema.prisma
├── migrations/
└── seed.ts

src/__tests__/             # Component and integration tests (7 files, 47 tests)

tests/                     # Domain and lib tests (19 files, 303 tests)
├── components/
├── domains/
└── lib/

hooks/
└── pre-push               # Blocks pushes to branches with open PRs

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
├── contact/
│   ├── types.ts
│   ├── repository.ts
│   └── service.ts
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
| event | yes | yes | yes | yes |
| contact | yes | yes | — | — |
| chat | — | — | — | yes |
| calendar | — | — | yes | — |
| pdf | — | yes | — | — |
| shared | — | — | — | — |

### Domains with api-client Only

These domains encapsulate endpoint URLs and response parsing for smaller feature areas:

- `category` — invoice/quote category listing
- `quick-picks` — admin-managed quick pick items catalog
- `saved-items` — admin saved line item catalog
- `user-quick-picks` — per-user quick pick selections
- `upload` — file upload handling

### Contact Domain

External people (vendors, customers, catering contacts) who are not Pierce College staff. Key design:

- **Owner-scoped** — all queries filter by `createdBy` so users only see their own contacts
- **findOrCreate with dedup** — matches on name + email + organization to avoid duplicates
- Used by invoice/quote forms for attribution when the counterparty is not a staff member
- AI Assistant auto-creates contacts via `createInvoice`/`createQuote` tools when `contactName` is provided

---

## Data Models (Key)

| Model | Description |
|---|---|
| `User` | App user accounts with roles (admin/user) |
| `Staff` | Pierce College staff members for invoice attribution |
| `StaffAccountNumber` | Account numbers associated with staff |
| `StaffSignerHistory` | Approval chain signer history per staff member |
| `Contact` | External people (vendors, customers) — id, name, email, phone, org, department, title, notes, createdBy |
| `Invoice` | Core invoice records with status, line items, PDF paths. Optional `staffId`/`contactId`, `marginEnabled`, `marginPercent`, `taxEnabled`, `taxRate`, `isCateringEvent`, `cateringDetails` |
| `LineItem` | Invoice line items (description, quantity, unit cost, `isTaxable`, `costPrice`, `marginOverride`) |
| `Quote` | Quote records with auto-expiry, conversion to invoice, online sharing (`shareToken`), `revisedFromQuoteId` for revision chains. Statuses include SUBMITTED_EMAIL, SUBMITTED_MANUAL, REVISED |
| `QuoteLineItem` | Quote line items (same fields as LineItem including `isTaxable`, `costPrice`, `marginOverride`) |
| `QuoteView` | Tracks public quote page views (IP, user-agent, referrer, viewport, duration, response) |
| `Event` | Calendar events with type (Meeting/Seminar/Vendor/Other), recurrence, reminders |
| `Notification` | Real-time notifications for quote events and event reminders |
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
- ALL interpolated values must use `escapeHtml()` from `src/lib/html.ts` — prevents XSS.
- Puppeteer blocks all external requests via request interception — only `data:` and `file:` URLs allowed.

---

## Security

- **XSS prevention** — `escapeHtml()` in `src/lib/html.ts` wraps all user input in PDF templates
- **Rate limiting** — sliding window limiter in `src/lib/rate-limit.ts`: 5 login attempts per 15min per IP+username
- **Puppeteer sandboxing** — request interception blocks all external URLs; only `data:` and `file:` protocols allowed
- **Path traversal protection** — `prismcorePath` must resolve within `public/uploads/`
- **CSV injection** — `escapeCsv()` prefixes formula triggers (`=+-@`) with `'`
- **Ownership verification** — all single-resource endpoints verify `resource.createdBy === session.user.id` (admins bypass)
- **Auth wrappers** — `withAuth()` / `withAdmin()` centralize session checks in route handlers

---

## Authentication

- NextAuth.js credentials provider with bcrypt password hashing.
- Roles: `admin` and `user`. First user to complete setup is automatically admin.
- `withAuth()` / `withAdmin()` route wrappers in `shared/auth.ts` centralize session checks.
- Setup flow redirects unauthenticated users to `/setup` or `/login` via middleware.

---

## Dashboard

The home page (`src/app/page.tsx`) features a personalized dashboard:

- **Personalized header** — time-based greeting (Good Morning/Afternoon/Evening) with username
- **YourFocus widget** — prioritized action items for the current user
- **Drag-and-drop layout** — widgets can be reordered, persisted to `localStorage` (key: `laportal-dashboard-order`)
- **Stats cards** — invoice/quote counts filtered by `createdAt` (not invoice date)
- **Recent activity** — shows both invoices and quotes (not just invoices)
- **Running invoices, pending charges, team activity** — all role-aware
- **Real-time updates** — all dashboard widgets update in real-time via SSE
- **Help modal** — accessible from nav bar, covers invoice creation, line items, signatures, PDF generation, invoice management, and analytics

Components in `src/components/dashboard/`.

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

### Quote Revision Workflow

- DECLINED quotes get an "Edit & Resubmit" button
- Creates a new DRAFT copy with all fields (items, margin, tax, catering details)
- Original quote is marked REVISED with a link to the new quote
- New quote has a link back to the original for traceability
- New statuses: `SUBMITTED_EMAIL` (auto-set when email sent via Power Automate webhook), `SUBMITTED_MANUAL` (user marks manually), `REVISED` (original of a revision)

---

## Real-Time SSE Architecture

Real-time updates are powered by Server-Sent Events with a generic hook and singleton connection.

- **Generic hook:** `useSSE(eventType, callback, debounceMs)` in `src/lib/use-sse.ts`
- **Singleton EventSource:** shared across all consumers — one connection per browser tab
- **Server broadcast:** `safePublishAll()` in `src/lib/sse.ts` — non-throwing broadcast wrapper that silently handles disconnected clients
- **Event types:** `calendar-changed`, `quote-changed`, `invoice-changed`, `staff-changed`
- **Emission:** Services emit after every mutation (create, update, delete, status change)
- **Consumers:** quote table, invoice table, staff table, dashboard stats, recent activity, pending charges, calendar

---

## Margin & Tax Calculation Pipeline

Invoices and quotes support per-item margin markup and tax calculation.

- **Form display:** `chargedPrice = costPrice * (1 + marginPercent / 100)`
- **DB storage:** `unitPrice` = charged price shown to customer, `costPrice` = original cost
- **On reload:** if `costPrice` exists, use as editable base; re-derive charged price from margin
- **Per-item flags:** `isTaxable` (whether tax applies), `marginOverride` (item-level margin override)
- **Tax rate:** stored as fraction (0.0975 = 9.75%) in `taxRate` field on the invoice/quote
- **Quote-to-invoice conversion:** copies ALL fields including margin, tax, catering, per-item `costPrice`/`marginOverride`

---

## Email Webhook Integration

- Power Automate webhook sends from `bookstore@piercecollege.edu` shared mailbox
- **Endpoint:** `POST /api/email/send` with type `quote-share` or `quote-response`
- **Config:** `POWER_AUTOMATE_EMAIL_URL` env var required
- **UI:** Email progress dialog with stepper and terminal animation
- **Auto-upgrade:** SENT -> SUBMITTED_EMAIL on successful send
- **Manual fallback:** user can mark as SUBMITTED_MANUAL if email sent outside the app

---

## AI Assistant (Chat Sidebar)

A Claude Haiku-powered chatbot in a collapsible right sidebar. Staff can ask about invoices, quotes, events, staff, and analytics.

- **Stack:** Vercel AI SDK (`streamText()` + `useChat` hook), Claude Haiku model
- **Domain:** `src/domains/chat/` — `types.ts`, `tools.ts`, `system-prompt.ts`, `hooks.ts`
- **Route:** `POST /api/chat` (authenticated, rate-limited per user)
- **Tools:** List/view invoices and quotes, search staff, create staff, list/create calendar events, view analytics, navigate user to pages. `searchPeople` searches both Staff and Contact tables. `createInvoice`/`createQuote` accept `contactName` for auto-creating contacts
- **Safeguards:** Ownership enforcement (users can only modify their own records, admins bypass), destructive action confirmation, rate limiting
- **Conversations:** Ephemeral (no persistence, resets on page refresh)
- **UI:** Right sidebar (320px), minimize to icon strip, state persisted in localStorage
- **Security:** Username escaped in system prompt to prevent injection; link URLs sanitized (http/https/relative only)

---

## Calendar

FullCalendar page at `/calendar` merging three event sources:

1. **Catering events** — derived from quotes with `isCateringEvent=true`
2. **Manual events** — `Event` model with types (Meeting, Seminar, Vendor, Other), recurrence (Daily/Weekly/Monthly/Yearly), color coding
3. **Staff birthdays** — auto-generated from `Staff.birthMonth`/`birthDay` fields (handles Feb 29 on non-leap years)

- **API:** `GET /api/calendar/events` merges all sources; `GET /api/events` (list), `POST /api/events` (create), `GET/PUT/PATCH/DELETE /api/events/:id` (read/update/delete)
- **Reminders:** `src/domains/event/reminders.ts` checks due reminders via scheduled trigger, sends `EVENT_REMINDER` notifications to all users
- **UI:** `AddEventModal` for create/edit, `EventLegend` for color key, click-to-edit for manual events
- **Real-time:** Updates via `calendar-changed` SSE event — events created from chatbot or modal appear instantly without refresh

---

## Login

- **Email label** — field shows "Email" with `you@piercecollege.edu` placeholder
- **Remember Me** — checkbox (default: on). Checked = 90-day session, unchecked = 24-hour session. Preference persisted in localStorage
- **Show/hide password** — eye icon toggle with `aria-pressed` for accessibility
- **Caps Lock warning** — amber text with `aria-live` region when Caps Lock is detected
- **Session enforcement** — `session.maxAge` set to 90 days (max), per-session expiration enforced via `token.iat` check in JWT callback

---

## Testing

**Total: 350 tests** across 26 test files in two directories.

### Test Files — `tests/` (303 tests)

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

### Test Files — `src/__tests__/` (47 tests)

| File | Area |
|---|---|
| `src/__tests__/csv-export.test.ts` | CSV export integration |
| `src/__tests__/idp-data-mapping.test.ts` | IDP data mapping |
| `src/__tests__/inline-combobox.test.tsx` | Inline combobox component |
| `src/__tests__/keyboard-mode.test.tsx` | Keyboard mode component |
| `src/__tests__/line-items-keyboard.test.tsx` | Line items keyboard nav |
| `src/__tests__/quick-pick-tax.test.tsx` | Quick pick tax calculation |
| `src/__tests__/quote-lifecycle.test.ts` | Quote lifecycle integration |

### Commands

```bash
npm test                    # Run all tests (may include ECC tests)
npm run test:watch          # Watch mode
npx vitest run --dir tests  # Run project tests only
npx vitest run --dir tests && npx vitest run --dir src/__tests__  # Full CI test run
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

**PRs are finalized once created** — no further pushes to a branch with an open PR, except to fix CodeRabbit review issues (`CR_FIX=1 git push`). Enforced by a tracked pre-push hook in `hooks/pre-push` (auto-configured via `npm install` postinstall script).

**Branch protection on `main`:**
- Required checks: Lint, Build, Tests (all must pass)
- Required reviews: 1 approval (CodeRabbit counts)
- Stale review dismissal is OFF — CodeRabbit approval persists across pushes
- Conversation resolution required — all review threads must be resolved before merge
- Admin bypass allowed (`gh pr merge --admin` when needed)

**CodeRabbit** reviews every PR automatically with the `chill` profile. Config in `.coderabbit.yaml`. All review threads must be resolved before merge. CodeRabbit issues are fixed manually (no auto-fix workflow).

### CI/CD Pipeline

GitHub Actions runs on every push to `main` and every PR targeting `main`:

1. **Setup** — `npm ci` + `npx prisma generate`, caches `node_modules` and `src/generated/prisma`
2. **Lint** / **Build** / **Tests** — run in parallel after Setup (Node 22)
3. **Deploy** (push to `main` only) — triggers HTTPS webhook at `montalvo.io/hooks/deploy-laportal`, then polls health check at `laportal.montalvo.io`

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
- API routes: validate with Zod, use `withAuth`/`withAdmin` wrappers, return `NextResponse`
- Account Number and Account Code are separate fields — do not conflate them
