# Supabase Platform Migration — Implementation Blueprint

> Goal: move LAPortal onto Supabase-managed infrastructure for database, storage, realtime, and supporting platform services without breaking invoice, quote, staff, calendar, or admin workflows.

## Summary

LAPortal already has strong domain boundaries. The migration should preserve those boundaries and replace the infrastructure under them:

- Database: keep Prisma, point it at Supabase Postgres
- File storage: replace local disk writes with Supabase Storage
- Realtime: replace in-memory SSE and polling with Supabase Realtime
- Auth: keep NextAuth temporarily via a Supabase JWT bridge, then evaluate full Supabase Auth migration
- Jobs: move in-process cron work toward Supabase Cron / Edge Functions

The application should not be rewritten around raw Supabase table access from the browser. Existing authenticated API routes remain the main data boundary. Realtime is used to deliver invalidation or narrowly scoped row updates.

---

## Constraints

- Supabase Database is PostgreSQL. This is a platform migration, not a move away from Postgres.
- Current branch-local PR work must remain isolated from this migration.
- Invoice and quote visibility is role- and owner-scoped, so browser subscriptions must not bypass existing access rules.
- Calendar is a composed view, not a single table projection.
- Files currently live on local disk and must be migrated explicitly.
- Browser `localStorage` use must be classified into:
  - state that should stay local-only
  - state that should become shared and server-backed

---

## Current Persistence Inventory

### Relational data

Source of truth today: Prisma models in `prisma/schema.prisma`

- `User`
- `Staff`
- `StaffAccountNumber`
- `StaffSignerHistory`
- `Contact`
- `Invoice`
- `InvoiceItem`
- `QuickPickItem`
- `Event`
- `Category`
- `SavedLineItem`
- `UserQuickPick`
- `QuoteView`
- `Notification`
- `Template`
- `TemplateItem`
- `PrintPricingConfig`
- `PrintPricingTier`
- `PrintQuote`
- `PrintQuoteLineItem`
- `QuoteFollowUp`
- `AppSetting`

### Files on disk

- uploaded PrismCore PDFs: `public/uploads`
- generated invoice PDFs: `data/pdfs`
- generated quote PDFs: `data/pdfs`
- generated print quote PDFs: `data/pdfs`

### Browser-only persistence

- invoice/quote draft autosave
- dashboard widget order
- UI scale
- assistant sidebar open state
- login remember-me checkbox
- field hint dismissal

### Live update infrastructure

- in-memory SSE publisher: `src/lib/sse.ts`
- shared browser `EventSource`: `src/lib/use-sse.ts`
- notification polling fallback: `src/domains/notification/hooks.ts`

### Background work

- event reminders: `src/domains/event/reminders.ts`
- quote follow-up reminders: `src/domains/quote/follow-ups.ts`
- scheduler registration: `src/instrumentation.ts`

### External integrations

- Power Automate email webhook: `src/lib/email.ts`

---

## Target Architecture

### 1. Supabase Postgres

Keep Prisma as the application ORM. Change infrastructure, not domain architecture.

- `DATABASE_URL` points to Supabase Postgres
- add `DIRECT_URL` if needed for migrations and pooled/runtime split
- keep repositories and services intact

### 2. Supabase Storage

Use one private bucket for application documents:

- bucket: `laportal-documents`

Object key layout:

- `uploads/<uuid>.pdf`
- `invoices/<invoice-id>/<invoice-number>.pdf`
- `quotes/<quote-id>/<quote-number>.pdf`
- `print-quotes/<quote-id>/<quote-number>.pdf`

Implementation rule:

- database fields such as `pdfPath` and `prismcorePath` store Storage object keys, not filesystem paths
- downloads stay behind authenticated API routes unless a specific public share flow requires signed URLs

### 3. Supabase Realtime

Use private channels with a server-minted JWT bridge first.

Topics:

- `app:global`
  - invoice invalidation
  - quote invalidation
  - staff invalidation
  - calendar invalidation
  - admin/settings/template invalidation
- `user:<app-user-id>`
  - notification create/update/delete events
- optional future topics:
  - `quote:<quote-id>`
  - `draft:<user-id>:<route-key>`

Event strategy:

- Notifications: row-like payloads
- Complex list/detail/dashboard views: invalidation event plus API refetch
- Quote activity: either dedicated invalidation or targeted row events

### 4. Auth

Phase 1:

- keep NextAuth credentials
- add a Supabase Realtime token bridge route
- browser Realtime client fetches short-lived JWTs via `accessToken`

Phase 2:

- evaluate full migration to Supabase Auth
- move middleware/session logic if and only if parity is achieved for:
  - credentials login
  - roles
  - setup-complete gating
  - server session access in route handlers

### 5. Background jobs

Move toward Supabase-managed scheduling:

- event reminders
- quote payment follow-ups
- future cleanup/backfill jobs

Initial target:

- preserve existing business logic in domain services
- move scheduling/orchestration out of `node-cron`

---

## Security Model

### Database access

- server writes remain through Prisma repositories/services
- browser does not directly read privileged business tables by default
- existing API authorization remains authoritative

### Realtime authorization

JWT claims:

- `sub`: app user id
- `role`: `authenticated`
- custom claim `app_role`: current app role (`admin` or `user`)

Private topic access:

- any authenticated user may subscribe to `app:global`
- a user may subscribe only to `user:<auth.uid()>`

### Storage authorization

- bucket is private
- writes occur server-side with service-role credentials
- downloads are served through app routes or signed URLs only when needed

---

## Feature-by-Feature Migration Map

### Notifications

Current behavior:

- create is pushed live
- mark read, mark all read, and delete are not synchronized across tabs
- polling starts after 5 seconds as fallback

Target behavior:

- no SSE endpoint
- no polling fallback
- create, mark read, mark all read, and delete all publish user-channel updates

Files:

- `src/lib/sse.ts`
- `src/lib/use-sse.ts`
- `src/domains/notification/service.ts`
- `src/domains/notification/hooks.ts`
- `src/app/api/notifications/[id]/route.ts`
- `src/app/api/notifications/read-all/route.ts`
- `src/app/api/notifications/stream/route.ts`

### Invoices

Current behavior:

- writes use Prisma + PDF generation on local disk
- live updates are coarse `invoice-changed`

Target behavior:

- finalize stores generated PDFs in Supabase Storage
- invoice detail/table/dashboard continue refetching through existing APIs after Realtime invalidation

Files:

- `src/domains/invoice/service.ts`
- `src/domains/invoice/repository.ts`
- `src/app/api/invoices/[id]/finalize/route.ts`
- `src/app/api/invoices/[id]/pdf/route.ts`
- `src/components/invoices/*`
- `src/components/dashboard/*`

### Quotes

Current behavior:

- quote PDFs are generated on demand and written to disk
- quote activity is not fully live for plain page views

Target behavior:

- quote PDF generation writes to Storage
- public view tracking publishes targeted activity changes
- quote list/detail keep invalidation-plus-refetch

Files:

- `src/domains/quote/service.ts`
- `src/app/api/quotes/[id]/pdf/route.ts`
- `src/app/api/quotes/public/[token]/view/route.ts`
- `src/components/quotes/*`

### Print pricing

Current behavior:

- generated PDFs stored on local disk

Target behavior:

- generated PDFs stored in Storage
- download route reads from Storage

Files:

- `src/domains/print-pricing/service.ts`
- `src/lib/pdf/generate-print-quote.ts`
- `src/app/api/print-pricing/quotes/[id]/pdf/route.ts`

### Contacts, templates, quick picks, settings

Target behavior:

- stay API-driven
- gain `app:global` invalidation or targeted topics where useful
- remain owner- or admin-scoped through current route authorization

### Calendar

Current behavior:

- composed from quotes, events, and staff birthdays

Target behavior:

- keep a `calendar-changed` invalidation event
- do not attempt a single table subscription model

### Drafts and user preferences

Target behavior:

- move draft autosave to server-backed storage first
- keep purely cosmetic local state local unless cross-device sync is desired

Server-backed candidates:

- invoice draft autosave
- quote draft autosave
- dashboard order if cross-device consistency matters

Local-only candidates:

- UI scale
- field hint dismissal
- assistant open/closed state
- remember-me checkbox

---

## Implementation Phases

## Phase 1: Foundation

- [ ] Add Supabase dependencies
- [ ] Add environment variable schema and documentation
- [ ] Add server/admin/browser Supabase clients
- [ ] Add a Realtime JWT mint route
- [ ] Add a shared Realtime abstraction that preserves current `publish`, `publishAll`, and `useSSE` call sites
- [ ] Add Supabase SQL bootstrap for:
  - private Realtime policies
  - Storage bucket creation
  - optional helper indexes / extensions where needed

## Phase 2: Storage Migration

- [ ] Refactor PDF generators to produce `Buffer`, not local files
- [ ] Write Storage upload/download/delete helpers
- [ ] Update invoice finalize flow to store PDFs in Storage
- [ ] Update quote PDF generation to store/read from Storage
- [ ] Update print quote PDF generation to store/read from Storage
- [ ] Update upload route to store PrismCore PDFs in Storage
- [ ] Replace local-path assumptions in API responses and UI badges

## Phase 3: Realtime Migration

- [ ] Replace `src/lib/sse.ts` implementation with Supabase publish helpers
- [ ] Replace `src/lib/use-sse.ts` transport with Supabase subscriptions
- [ ] Remove notification polling
- [ ] Broadcast notification mutation events on read/delete/all-read
- [ ] Ensure quote activity refreshes on public page views
- [ ] Keep current refetch pattern for invoice/quote/dashboard/staff/calendar

## Phase 4: Data And Workflow Hardening

- [ ] Add draft persistence table and API if server-backed drafts are adopted now
- [ ] Add optional user-preference persistence if cross-device sync is desired now
- [ ] Review every API route for assumptions tied to filesystem or SSE
- [ ] Review tests and add coverage for storage/realtime transitions

## Phase 5: Auth And Runtime Consolidation

- [ ] Decide whether to stay on NextAuth + JWT bridge or move fully to Supabase Auth
- [ ] If migrating auth, replace middleware/session helpers only after behavior parity
- [ ] Move reminder/follow-up scheduling off `node-cron`

---

## Validation Plan

For each completed phase:

- run targeted tests for touched domains
- run lint
- run full test suite
- run build
- perform a manual workflow pass:
  - create invoice
  - finalize invoice with and without PrismCore upload
  - create quote
  - send/share quote
  - public quote view
  - approve/decline quote
  - print pricing quote generation
  - notifications read/delete/all-read
  - staff update
  - calendar update

---

## Rollout Notes

- The migration can ship in slices, but database/storage/realtime scaffolding should land in one coherent branch.
- Prisma remains the core server data access layer unless a later project explicitly replaces it.
- Browser direct table subscriptions are not the default architecture for this application.
- If Supabase Auth is deferred, the bridge must still be secure, short-lived, and role-aware.
