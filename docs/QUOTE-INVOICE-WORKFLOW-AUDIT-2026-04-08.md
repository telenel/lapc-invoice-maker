# Quote And Invoice Workflow Audit

Date: 2026-04-08

## Executive Summary

I audited the quote and invoice lifecycle across the Prisma schema, domain services, API routes, detail/edit UIs, public review UI, and workflow tests.

The main conclusion is that the database state is not broadly corrupted. The production failure came from app-layer workflow drift, not from damaged quote or invoice rows.

Confirmed fixes already made during this audit:

1. Public quote approval was incorrectly hidden when `paymentLinkAvailable` was `false`.
2. Quote delete route error handling returned `500` for valid workflow rejections.
3. The quote validator enum was missing `REVISED`.

Additional verification completed after the initial fix:

1. Draft quotes are editable.
2. Draft quotes can generate or regenerate PDFs after edits because quote PDFs are generated fresh from the current DB row on each request.
3. Accepted-but-unconverted quotes are editable, and meaningful edits intentionally reopen them to `DRAFT` and clear approval/payment state.
4. Declined and expired quotes correctly enter the revise-and-resubmit path.
5. Final invoices remain non-editable, while draft and pending-charge invoices remain editable.
6. Final invoice PDF regeneration is intentionally re-entrant through the finalize pipeline.

## Scope

Files and areas reviewed:

- `prisma/schema.prisma`
- `src/domains/quote/service.ts`
- `src/domains/quote/repository.ts`
- `src/domains/invoice/service.ts`
- `src/app/api/quotes/**`
- `src/app/api/invoices/**`
- `src/components/quotes/public-quote-view.tsx`
- `src/components/quotes/quote-detail.tsx`
- `src/app/quotes/[id]/edit/page.tsx`
- `src/components/invoices/invoice-detail.tsx`
- `src/app/invoices/[id]/edit/page.tsx`
- existing route, UI, and service tests
- live production response checks and direct database consistency queries

## Data Audit

The investigated production quote `e04eaabc-1b90-4312-93c6-f9ea5db311fd` was healthy in storage:

- quote number `Q-2026-0011`
- status `SUBMITTED_EMAIL`
- expiration `2026-05-08`
- not accepted
- not converted
- valid `share_token`

Database anomaly checks returned no inconsistent rows for:

- accepted quotes missing `accepted_at`
- non-accepted quotes with stray `accepted_at`
- converted quotes without a converted invoice
- converted invoices whose source quote lacked `converted_at`
- submitted quotes missing `share_token`
- revised parent/child linkage mismatches
- payment-resolution inconsistencies

## Quote Status Matrix

### `DRAFT`

Entry points:

- new quote creation
- duplicate
- revision child quote
- accepted quote edited with meaningful changes

Allowed actions:

- edit
- delete
- download/regenerate PDF
- mark as sent

Blocked actions:

- approve/decline
- convert to invoice
- revise

Verified by:

- `src/components/quotes/quote-detail.tsx`
- `src/app/quotes/[id]/edit/page.tsx`
- `src/domains/quote/service.ts`
- `src/__tests__/quote-detail.test.tsx`

### `SENT`

Allowed actions:

- edit
- delete
- download/regenerate PDF
- share link
- mark delivered
- manual approve
- manual decline
- public approve/decline

Blocked actions:

- convert before acceptance
- revise

### `SUBMITTED_EMAIL`

Allowed actions:

- edit
- download/regenerate PDF
- share link
- manual approve
- manual decline
- public approve/decline

Blocked actions:

- delete
- convert before acceptance
- revise

### `SUBMITTED_MANUAL`

Allowed actions:

- edit
- download/regenerate PDF
- share link
- manual approve
- manual decline
- public approve/decline

Blocked actions:

- delete
- convert before acceptance
- revise

### `ACCEPTED`

Allowed actions when not converted:

- edit
- resolve payment details
- convert to invoice after payment details are resolved
- download/regenerate PDF
- share link

Allowed actions when converted:

- view converted invoice
- download/regenerate PDF

Special rule:

- If an accepted quote is edited in a meaningful way before conversion, it intentionally reopens to `DRAFT`, clears `acceptedAt`, and clears stored payment details.

Blocked actions:

- delete
- revise
- mark sent
- mark submitted

Verified by:

- `src/domains/quote/service.ts`
- `tests/domains/quote/service.test.ts`
- `src/components/quotes/quote-detail.tsx`
- `src/__tests__/quote-detail.test.tsx`

### `DECLINED`

Allowed actions:

- delete
- duplicate
- revise and resubmit
- download/regenerate PDF
- historical share-link viewing

Blocked actions:

- edit
- public response
- convert

### `REVISED`

Allowed actions:

- duplicate
- download/regenerate PDF
- historical viewing

Blocked actions:

- edit
- delete
- respond
- revise again through the same original path

### `EXPIRED`

Allowed actions:

- delete
- duplicate
- revise and resubmit
- download/regenerate PDF
- historical share-link viewing

Blocked actions:

- edit
- respond
- convert

Note:

- Expiration is enforced lazily on read/response paths for open-family statuses.

## Invoice Status Matrix

### `DRAFT`

Allowed actions:

- edit
- delete
- duplicate
- finalize

### `PENDING_CHARGE`

Allowed actions:

- edit
- delete
- duplicate
- complete/finalize once invoice number exists

### `FINAL`

Allowed actions:

- duplicate
- download PDF
- regenerate PDF
- email PDF
- delete

Blocked actions:

- normal edit/update

Note:

- The UI intentionally reuses the finalize pipeline to regenerate final invoice PDFs.

## End-To-End Notes

### Draft editability

Drafts are editable both in the UI and service layer. The detail page exposes `Edit`, the edit page accepts drafts, and the update service does not block them.

### Draft PDF regeneration after editing

Quote PDFs are generated from the live quote row each time `GET /api/quotes/[id]/pdf` runs. There is no separate stale quote-PDF persistence layer for drafts, so editing then downloading uses the latest saved quote data.

### Accepted quote edits

Accepted quotes can still be edited until conversion. This is intentional. Once the edit meaningfully changes quote content, the system reopens the quote to `DRAFT` so approval and payment details cannot silently survive a material change.

### Revision flow

Only `DECLINED` and `EXPIRED` quotes can create revisions. The original quote becomes `REVISED` and the child quote becomes a new `DRAFT` with a fresh quote number and a new expiration window.

### Conversion flow

Only `ACCEPTED` quotes with resolved payment details can convert to invoices. Conversion creates a new invoice in `DRAFT`, stamps `convertedAt` on the quote, and preserves the quote as the origin record.

### Final invoice regeneration

Final invoices are intentionally locked against normal editing, but PDF regeneration is supported and uses the same finalize pipeline with existing metadata merged forward.

### Browser workflow coverage

Additional Playwright coverage now verifies these staff-facing transitions in a real browser session:

- accepted quote edited after approval reopens to `DRAFT`
- declined quote revises into a new draft
- sent quote can be marked delivered into `SUBMITTED_MANUAL`
- accepted quote without payment details requires `Resolve Payment Details` before conversion
- accepted quote with resolved payment details converts into an editable invoice
- draft quote can be deleted from the detail view

### Browser PDF caveat

The draft quote PDF regeneration path is now browser-verified in the app's default local configuration.

The main fixes were:

- quote PDF downloads now render directly in memory instead of depending on a storage write/read round-trip
- the Chromium helper no longer forces `HOME` to a temp directory, which was hanging local headless print runs
- the Chromium helper now has a fallback executable chain instead of a single hardcoded path

Residual caveat:

- if `PUPPETEER_EXECUTABLE_PATH` is explicitly forced to a problematic browser binary, the route can still spend too long on that candidate before fallback completes

With default executable discovery, the quote/invoice PDF path is now functioning in local browser verification.

## Findings

### Fixed

1. `src/components/quotes/public-quote-view.tsx`
   Public approval visibility now depends on quote status, not `paymentLinkAvailable`.
2. `src/app/api/quotes/[id]/route.ts`
   Quote delete workflow rejections now return a client error instead of `500`.
3. `src/lib/validators.ts`
   Quote validator enum now includes `REVISED`.

### No additional corruption found

The deeper action-matrix audit did not uncover a second broad workflow corruption. The main issue was inconsistent gating logic around valid transitions.

### Additional finding from browser verification

1. `src/lib/pdf/puppeteer.ts`
   Local quote PDF generation was brittle because the helper forced `HOME` to a temp directory and relied on a single executable path. The helper now uses a safer profile strategy and browser fallback chain.
2. `src/lib/document-storage.ts`
   Quote PDF downloads no longer depend on Storage credentials because the route now returns freshly rendered bytes directly instead of persisting then re-reading them.

## Validation

Focused validation completed during the audit:

- `npx vitest run src/__tests__/quote-detail.test.tsx tests/domains/quote/service.test.ts`
- prior quote/public/invoice workflow suites
- `npm run lint`
- `npm test`
- `npm run build`

Most recent added regression coverage:

- draft action visibility
- accepted quote action visibility after payment resolution
- declined revise-and-resubmit visibility
- accepted meaningful edit reopening to `DRAFT`
- accepted no-op edit preserving `ACCEPTED`
- Playwright quote workflow transitions:
  - accepted edit reopen
  - declined revise
  - sent to submitted-manual
  - payment-resolution gating
  - quote-to-invoice conversion
  - draft delete

Most recent browser validation commands:

- `PUPPETEER_EXECUTABLE_PATH=... npx playwright test e2e/quotes.spec.ts --project=authenticated --no-deps --grep "accepted quotes convert into editable draft invoices|accepted quotes require resolved payment details|sent quotes can be marked delivered|draft quotes can be deleted|editing an accepted quote reopens|declined quotes can be revised"`
- `npx playwright test e2e/quotes.spec.ts --project=authenticated --no-deps --grep "draft quotes stay editable and can regenerate PDFs after editing"`
- `npx playwright test e2e/quotes.spec.ts --project=authenticated --no-deps --grep "Quote Workflow Transitions"`

## Residual Risk

The one workflow edge I still want us to keep an eye on is date-only expiration behavior around timezone boundaries. I did not find a live failing case, but date-only expiration logic is always worth monitoring near midnight.
