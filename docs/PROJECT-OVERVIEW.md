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
| AI Assistant | Vercel AI SDK + Claude Haiku (streaming chat sidebar) |
| Calendar | FullCalendar (catering + manual events + birthdays) |
| Email | Power Automate webhook (shared mailbox) |
| CI/CD | GitHub Actions (setup → lint/build/test parallel → deploy) |
| Code Review | CodeRabbit (assertive profile, auto-review on PRs) |
| Auto-fix | Claude Code Action (fixes CodeRabbit reviews, resolves threads) |

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
| event | yes | yes | yes | yes |
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
- **Drag-and-drop layout** — widgets can be reordered, persisted to `localStorage` (key: `lapc-dashboard-order`)
- **Stats cards** — invoice/quote counts filtered by `createdAt` (not invoice date)
- **Recent invoices, running invoices, pending charges, team activity** — all role-aware

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

---

## AI Assistant (Chat Sidebar)

A Claude Haiku-powered chatbot in a collapsible right sidebar. Staff can ask about invoices, quotes, events, staff, and analytics.

- **Stack:** Vercel AI SDK (`streamText()` + `useChat` hook), Claude Haiku model
- **Domain:** `src/domains/chat/` — `types.ts`, `tools.ts`, `system-prompt.ts`, `hooks.ts`
- **Route:** `POST /api/chat` (authenticated, rate-limited per user)
- **Tools:** List/view invoices and quotes, search staff, list/create calendar events, view analytics, navigate user to pages
- **Safeguards:** Ownership enforcement (users can only modify their own records, admins bypass), destructive action confirmation, rate limiting
- **Conversations:** Ephemeral (no persistence, resets on page refresh)
- **UI:** Right sidebar (320px), minimize to icon strip, state persisted in localStorage
- **Security:** User name escaped in system prompt to prevent injection; link URLs sanitized (http/https/relative only)

---

## Calendar

FullCalendar page at `/calendar` merging three event sources:

1. **Catering events** — derived from quotes with `isCateringEvent=true`
2. **Manual events** — `Event` model with types (Meeting, Seminar, Vendor, Other), recurrence (Daily/Weekly/Monthly/Yearly), color coding
3. **Staff birthdays** — auto-generated from `Staff.birthMonth`/`birthDay` fields (handles Feb 29 on non-leap years)

- **API:** `GET /api/calendar/events` merges all sources; `GET /api/events` (list), `POST /api/events` (create), `GET/PUT/PATCH/DELETE /api/events/:id` (read/update/delete)
- **Reminders:** `src/domains/event/reminders.ts` checks due reminders via scheduled trigger, sends `EVENT_REMINDER` notifications to all users
- **UI:** `AddEventModal` for create/edit, `EventLegend` for color key, click-to-edit for manual events

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

**Branch protection on `main`:**
- Required checks: Lint, Build, Tests (all must pass)
- Required reviews: 1 approval (CodeRabbit counts)
- Stale reviews dismissed on new pushes
- Enforce admins: OFF (admin can bypass when needed)

**CodeRabbit** reviews every PR automatically with the `assertive` profile. Config in `.coderabbit.yaml`. Uses `request_changes_workflow: true` — if CodeRabbit requests changes, it blocks merge until resolved.

**Auto-fix workflow** (`.github/workflows/autofix-reviews.yml`):
- Triggers on `pull_request_review` when CodeRabbit requests changes
- Uses `anthropics/claude-code-action@v1` with `claude_args`:
  - `--allowedTools "Bash(gh *),Bash(npm *),..."` — explicit tool permissions (Bash disabled by default in the action)
  - `--disallowedTools "WebFetch,Agent"` — prevents token waste on blocked tools
  - `--max-turns 30` — caps API calls to prevent spiraling
- `allowed_bots: "coderabbitai[bot]"` — required since bots are blocked by default
- After fixing code: resolves GitHub review threads via GraphQL mutation → triggers CodeRabbit auto-approve → unblocks auto-merge
- Concurrency group per PR with `cancel-in-progress: true`; 10-minute timeout

### CI/CD Pipeline

GitHub Actions runs on every push to `main` and every PR targeting `main`:

1. **Setup** — `npm ci` + `npx prisma generate`, caches `node_modules` and `src/generated/prisma`
2. **Lint** / **Build** / **Tests** — run in parallel after Setup (Node 22)
3. **Deploy** (push to `main` only) — triggers HTTPS webhook at `montalvo.io/hooks/deploy-lapc`, then polls health check at `invoice.montalvo.io`

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
