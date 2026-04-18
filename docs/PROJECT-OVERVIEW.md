# LAPortal — Project Overview

Operations portal for Los Angeles Pierce College. Handles invoice drafting, finalization, and PDF generation for campus purchasing requests. Supports running/recurring invoices, quote creation with online sharing and approval, staff management, admin controls, real-time notifications, calendar, AI assistant, and dashboard analytics.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Database ORM | Prisma 7 + Supabase Postgres |
| Styling | Tailwind CSS 4 + shadcn/ui v4 (base-ui) |
| Auth | NextAuth.js (credentials provider) |
| PDF | Puppeteer (render) + pdf-lib (merge) |
| Testing | Vitest |
| Deployment | Docker Compose + Traefik on montalvo.io |
| AI Assistant | Vercel AI SDK + Claude Haiku (streaming chat sidebar) |
| Calendar | FullCalendar (catering + manual events + birthdays) |
| Email | Power Automate webhook (shared mailbox) |
| CI/CD | GitHub Actions (setup → lint/build/test parallel → deploy) |
| Checks | GitHub Actions CI |
| Scheduler | App cron with DB-backed job ledger, plus optional Supabase `pg_cron` via authenticated internal job routes |

---

## Supabase Migration Status

LAPortal's Supabase migration is mostly complete at the infrastructure layer:

- Prisma is running against Supabase Postgres.
- PDFs and uploads are stored in Supabase Storage.
- Realtime updates use Supabase Realtime with a short-lived token bridge.
- Production now verifies build-time public Supabase env through `/api/version` and platform diagnostics.

The remaining migration blocker is scheduler ownership. The live app can target Supabase cron mode, but production still returns `permission denied for schema cron` when the protected scheduler inspection route tries to access `pg_cron` through the app role. Because of that, app-side cron remains active unless `SUPABASE_SCHEDULER_CONFIRMED=true` is set after explicit verification.

See [docs/SUPABASE-MIGRATION-STATUS.md](SUPABASE-MIGRATION-STATUS.md) for the durable status record.

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
│   ├── follow-up/         # account number follow-up series
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
    ├── rate-limit.ts      # Postgres-backed sliding window rate limiter
    ├── job-runs.ts        # DB-backed job execution tracking + summaries
    ├── storage-audit.ts   # Legacy filesystem reference audit + fallback state
    ├── sse.ts             # Supabase Realtime server publish shim
    ├── use-sse.ts         # Generic realtime hook backed by Supabase channels
    ├── themes.ts
    ├── utils.ts
    ├── validators.ts
    └── pdf/               # PDF templates and generation helpers

prisma/
├── schema.prisma
├── migrations/
└── seed.ts

src/__tests__/             # Component and integration tests

tests/                     # Domain and lib tests
├── components/
├── domains/
└── lib/

hooks/
└── pre-push               # Blocks stale/non-fast-forward pushes and open-PR branch pushes

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
├── follow-up/
│   ├── types.ts
│   ├── repository.ts
│   ├── service.ts
│   ├── api-client.ts
│   ├── hooks.ts
│   ├── account-follow-ups.ts    # Cron job logic
│   └── email-templates.ts
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
| follow-up | yes | yes | yes | yes |
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
- **Rate limiting** — sliding window limiter in `src/lib/rate-limit.ts`: 5 login attempts per 15min per IP+username, now persisted in Postgres and shared across replicas
- **Puppeteer sandboxing** — request interception blocks all external URLs; only `data:` and `file:` protocols allowed
- **Storage key validation** — uploaded document object keys are normalized and reject traversal patterns such as `..` and `\`
- **CSV injection** — `escapeCsv()` prefixes formula triggers (`=+-@`) with `'`
- **Shared read / restricted write** — authenticated users can read shared fiscal data for invoices and quotes, but mutating actions remain owner/admin only unless a route is explicitly public by token
- **Auth wrappers** — `withAuth()` / `withAdmin()` centralize session checks in route handlers

---

## Authentication

- NextAuth.js credentials provider with bcrypt password hashing.
- Roles: `admin` and `user`. First user to complete setup is automatically admin.
- `withAuth()` / `withAdmin()` route wrappers in `shared/auth.ts` centralize session checks.
- Setup flow redirects unauthenticated users to `/setup` or `/login` via middleware.
- Supabase is not the session authority today. Browser Realtime access is bridged through `GET /api/realtime/token`, while login/session management remains on NextAuth by design.

---

## Dashboard

The home page (`src/app/page.tsx`) features a personalized dashboard:

- **Personalized header** — time-based greeting (Good Morning/Afternoon/Evening) with username
- **YourFocus widget** — prioritized action items for the current user
- **Drag-and-drop layout** — widgets can be reordered and persisted via the authenticated user preferences API
- **Stats cards** — invoice/quote counts filtered by `createdAt` (not invoice date)
- **Recent activity** — merges the latest invoices and quotes across the team and highlights the current user's items
- **Running invoices, pending charges, team activity** — team-visible with per-user emphasis where useful
- **Real-time updates** — all dashboard widgets update in real-time via Supabase Realtime invalidation
- **Operational visibility** — admin Database Health now includes scheduler mode, storage audit counts, and recent tracked background job runs
- **Help modal** — accessible from nav bar, covers invoice creation, line items, signatures, PDF generation, invoice management, and analytics

Components in `src/components/dashboard/`.

---

## Access Model

- **Invoices and quotes** — authenticated users can read team-wide lists, dashboard activity, detail pages, and generated PDFs
- **Mutations** — create is authenticated; update/delete/finalize/duplicate and other destructive or state-changing actions remain owner/admin scoped unless a route is intentionally public
- **Quotes** — public recipient review stays token-based and unauthenticated; internal staff review is authenticated and team-visible
- **Contacts** — remain owner-scoped because they are user-managed address-book data rather than shared fiscal records
- **Staff and admin data** — governed separately by route-level auth wrappers and admin checks

This split is deliberate: fiscal visibility is shared across the team, while authorship and write authority remain constrained.

---

## Invoice Workflow Semantics

- **Requestor** — the selected staff member on invoice creation is the requestor
- **Department Contact** — the IDP Department Contact is derived from that requestor selection
- **Approvers** — the three signature lines at the bottom of the invoice are approvers, not requestors
- **Account Number vs Account Code** — these are separate fields and separate data concepts throughout the form, PDF output, and exports
- **Signer history** — approver suggestions are remembered per requestor through `StaffSignerHistory`

These semantics are reflected in the invoice form, help modal, and generated PDF workflow.

---

## Online Quote Sharing

Quotes can be shared with external recipients via token-based public links.

### Flow

1. User clicks "Mark as Sent" on a DRAFT quote → backend generates a UUID `shareToken`, sets status to SENT
2. A dialog appears with the share URL, a "Copy Link" button, and an "Email Link" button (opens `mailto:`)
3. Recipient opens the link → public quote page (no auth required)
4. Page visit is recorded as a `QuoteView` (IP, user-agent, referrer, viewport, duration via `sendBeacon`)
5. Recipient clicks "Approve" or "Decline" → quote status updates, notification pushed to creator

### Realtime Notifications

Real-time notifications via Supabase Realtime:

- **Token bridge:** `GET /api/realtime/token` (authenticated)
- **Pub/sub:** private Supabase Realtime channels via `src/lib/sse.ts`
- **Events:** `QUOTE_VIEWED` (10-min debounce), `QUOTE_APPROVED`, `QUOTE_DECLINED`
- **UI:** Bell icon in navbar with unread count badge and dropdown

### Public Routes (no auth)

| Route | Method | Purpose |
|-------|--------|---------|
| Quote sharing page | Page | Public quote page |
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

## Account Number Follow-Up

Invoices and quotes missing account numbers can be followed up with recurring email requests to the assigned staff member.

### Flow

1. User clicks "Request Account Number" on an invoice/quote detail page (or uses bulk action from the list)
2. Backend persists a follow-up series and sends the first email immediately via Power Automate webhook
3. Email contains a token-based link to a public form where the recipient enters the account number
4. Up to 4 additional weekly reminders are sent by the Monday cron job, with escalating tone
5. Series completes early if the account number is provided (via public form or manual entry)
6. After 5 attempts with no response, the series is marked EXHAUSTED and the creator is notified

### Display

- `FollowUpBadge` component shows "Follow Up 2/5" (amber) or "No Response" (red) alongside existing status badges
- List page filter: "Needs Account Number" shows items with active or exhausted series
- Dashboard widget: "Pending Account Numbers" shows team-wide active/exhausted series
- Recent Activity: badge overlays on existing invoice/quote rows

### Public Routes (no auth)

| Route | Method | Purpose |
|-------|--------|---------|
| `/account-request/[token]` | Page | Public account number form |
| `/api/follow-ups/public/[token]` | GET | Fetch invoice/quote summary |
| `/api/follow-ups/public/[token]/submit` | POST | Submit account number |

---

## Real-Time Architecture

Real-time updates are powered by Supabase Realtime with a generic hook and shared browser client.

- **Generic hook:** `useSSE(eventType, callback, debounceMs)` in `src/lib/use-sse.ts`
- **Shared client:** one Supabase client and channel set per browser tab
- **Server broadcast:** `safePublishAll()` in `src/lib/sse.ts` publishes to `app:global`; `publish(userId, ...)` targets `user:<id>`
- **Event types:** `calendar-changed`, `quote-changed`, `invoice-changed`, `staff-changed`
- **Emission:** Services emit after every mutation (create, update, delete, status change)
- **Consumers:** quote table, invoice table, staff table, dashboard stats, recent activity, pending charges, calendar

The old SSE naming remains in `useSSE()` for compatibility, but the transport is Supabase Realtime rather than browser `EventSource`.

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
- **UI:** Right sidebar (320px), minimize to icon strip, state persisted via authenticated user preferences
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
- **Real-time:** Updates via `calendar-changed` realtime event — events created from chatbot or modal appear instantly without refresh

---

## Login

- **Email label** — field shows "Email" with `you@piercecollege.edu` placeholder
- **Remember Me** — checkbox (default: on). Checked = 90-day session, unchecked = 24-hour session
- **Show/hide password** — eye icon toggle with `aria-pressed` for accessibility
- **Caps Lock warning** — amber text with `aria-live` region when Caps Lock is detected
- **Session enforcement** — `session.maxAge` set to 90 days (max), per-session expiration enforced via `token.iat` check in JWT callback

---

## Testing

Vitest covers both domain/lib tests in `tests/` and component/integration tests in `src/__tests__/`.

### Test Files — `tests/`

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

### Test Files — `src/__tests__/`

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

The navigation bar displays the current git short SHA as a build version indicator. Build metadata is still injected at build time via `next.config.mjs`:

```js
env: {
  NEXT_PUBLIC_BUILD_SHA: gitSha(),       // git rev-parse --short HEAD
  NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
}
```

In production, the nav badge reads from `/api/version`, and `/api/version` prefers immutable runtime metadata from the running image (`BUILD_SHA` / `BUILD_TIME`). The container also rewrites `.build-meta.json` on startup from the same values as a fallback so the reported version cannot drift from the actual image just because a file was edited after deploy.

### CI/CD Pipeline

GitHub Actions runs on every push to `main` and every PR targeting `main`:

1. **`actionlint`** — validates GitHub Actions workflow syntax and common mistakes
2. **`ship-check`** — runs the repo validation command (`npm run ship-check`) on Node 22 after `npm ci` and `npx prisma generate`
3. **Auto-merge** (PRs to `main`) — after a 15-minute quiet period, merges the latest green PR head SHA once CodeRabbit has reviewed it or produced the latest commit; add `no-automerge` or `hold` to opt out
4. **Deploy** (push to `main` only) — waits for the `CI` workflow to pass, then prefers an exact-SHA SSH deploy if deploy SSH secrets are configured; otherwise it falls back to the legacy HTTPS webhook path and polls `laportal.montalvo.io/api/version`

Deployment is Docker Compose on montalvo.io behind Traefik. The VPS deploy script now:

- fetches the target ref
- verifies the expected SHA when one is provided
- exports `BUILD_SHA` / `BUILD_TIME` for both build and runtime identity
- skips only when the live app already reports the target SHA and smoke checks pass
- rebuilds and recreates the container otherwise
- runs lightweight route smoke checks before declaring success
- appends an audit record for skip / success / rollback / failure outcomes
- rolls back to `.last-good-commit` if live verification fails

For urgent low-risk production fixes, the repo also includes a separate hotfix lane:

- `npm run hotfix:preflight` — reduced local validation
- `npm run hotfix:deploy -- <ref>` — direct SSH deploy of a pushed branch/tag through the same remote build/verify/rollback script

See [docs/HOTFIX-WORKFLOW.md](HOTFIX-WORKFLOW.md) for the operator workflow and guardrails, and [docs/DEPLOYMENT-STANDARD.md](DEPLOYMENT-STANDARD.md) for the reusable cross-repo deployment template.

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
