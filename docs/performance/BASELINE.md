# LAPortal Performance Baseline

Baseline date: 2026-04-23 America/Los_Angeles. Lighthouse reports are timestamped in UTC on 2026-04-24.

This audit is source-grounded first. Graphify was used for orientation because `graphify-out/graph.json` exists, but every finding below was verified against repository files. No production writes were performed. PRISM was treated as read-only. Supabase/Postgres reads and local authenticated page loads were used for measurement.

## Repo State

Command:

```bash
git status --short --branch
```

Result at audit start:

```text
## main...origin/main [behind 6]
D  .codex/config.toml
MM .gitignore
M  AGENTS.md
M  CLAUDE.md
?? .codex/
?? .graphifyignore
?? .mcp.json
?? graphify-out/
?? hooks/post-checkout
?? hooks/post-commit
```

Those were pre-existing local changes. The baseline audit first added `docs/performance/BASELINE.md` and `docs/performance/PRIORITY-PLAN.md`; the follow-up optimization pass also changed the measured routes and added a focused index migration.

## Commands Run

Validation:

```bash
npm run lint
npm test
npm run build
```

Results:

- `npm run lint` passed with no ESLint warnings or errors.
- `npm test` passed: 192 test files, 1468 tests. Existing warnings appeared for jsdom canvas support and a `--localstorage-file` path.
- `npm run build` passed.
- Follow-up optimization validation also passed:
  - `npx prisma validate`
  - Initial `npx prisma migrate deploy` reached Supabase but failed on `product_inventory_location_id_sku_idx` with `ERROR: must be owner of table product_inventory`; that index was removed from this Prisma migration and should be applied separately by a table-owner/service path if still needed.
  - `npx prisma migrate resolve --rolled-back 20260423180000_performance_baseline_indexes`
  - `npx prisma migrate deploy`
  - `npx prisma migrate status`
  - `npm test -- --run src/__tests__/products-page-quick-picks-tabs.test.tsx tests/domains/calendar/service.test.ts tests/domains/dashboard/service.test.ts tests/domains/invoice/repository.test.ts`
  - `npm run lint`
  - `npm test`
  - `npm run build`
  - `graphify update .`

Local server and browser measurements:

```bash
npm run dev
npm run audit:perf -- --path /login --no-start-server --only-categories performance --runs 1 --browser chrome --ignore-thresholds
npm run audit:perf -- --path / --auth --no-start-server --only-categories performance --runs 1 --browser chrome --ignore-thresholds
npm run audit:perf -- --path /calendar --auth --no-start-server --only-categories performance --runs 1 --browser chrome --ignore-thresholds
npm run audit:perf -- --path /products --auth --no-start-server --only-categories performance --runs 1 --browser chrome --ignore-thresholds
npm run audit:perf -- --path /invoices --auth --no-start-server --only-categories performance --runs 1 --browser chrome --ignore-thresholds
npm run audit:perf -- --path /quotes --auth --no-start-server --only-categories performance --runs 1 --browser chrome --ignore-thresholds
```

Environment blockers:

- `--browser chromium` failed because the Playwright Chromium executable was not installed. Chrome worked.
- The `/quotes` Lighthouse run failed at login with `401` after repeated authenticated audits, consistent with the local login rate limiter described in `docs/performance-testing.md`. I did not clear `rate_limit_events` during the audit.
- `npm run ship-check` was not run because the worktree already had unrelated dirty files and the baseline did not create a clean ship candidate.

## Lighthouse Measurements

All Lighthouse runs used one desktop run, Chrome, an existing localhost server, and performance-only categories.

| Route | Auth | Score | FCP | LCP | TBT | CLS | TTI | Server |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `/login` | no | 48 | 908 ms | 4117 ms | 2105 ms | 0.019 | 24482 ms | 88 ms |
| `/` | yes | 38 | 910 ms | 17272 ms | 1347 ms | 0.154 | 17307 ms | 15 ms |
| `/calendar` | yes | 17 | 1060 ms | 26097 ms | 1990 ms | 0.777 | 26097 ms | 16 ms |
| `/products` | yes | 36 | 1077 ms | 26992 ms | 2593 ms | 0.149 | 27742 ms | 21 ms |
| `/invoices` | yes | 38 | 913 ms | 16858 ms | 2081 ms | 0.148 | 23877 ms | 18 ms |

Report paths:

- `playwright-report/lighthouse/localhost-3000-login-desktop-2026-04-24T01-01-01.264Z-run-1.html`
- `playwright-report/lighthouse/localhost-3000-desktop-2026-04-24T01-01-22.722Z-run-1.html`
- `playwright-report/lighthouse/localhost-3000-calendar-desktop-2026-04-24T01-08-05.504Z-run-1.html`
- `playwright-report/lighthouse/localhost-3000-products-desktop-2026-04-24T01-08-26.351Z-run-1.html`
- `playwright-report/lighthouse/localhost-3000-invoices-desktop-2026-04-24T01-08-47.904Z-run-1.html`

## Build And Bundle Signals

`npm run build` highlighted these high first-load routes:

| Route | Build first-load JS |
| --- | ---: |
| `/calendar` | 346 kB |
| `/quotes/[id]` | 331 kB |
| `/products` | 326 kB |
| `/quotes/[id]/edit` | 287 kB |
| `/quotes/new` | 286 kB |
| `/invoices/[id]/edit` | 267 kB |
| `/invoices/new` | 266 kB |
| `/quotes` | 253 kB |
| `/invoices` | 245 kB |
| `/invoices/[id]` | 244 kB |

Raw built app chunk sizes under `.next/static/chunks/app` also rank `/products/page.js` and `/calendar/page.js` highest among page chunks:

```text
8.7M .next/static/chunks/app/products/page.js
8.0M .next/static/chunks/app/calendar/page.js
6.4M .next/static/chunks/app/invoices/[id]/edit/page.js
5.9M .next/static/chunks/app/quotes/page.js
5.7M .next/static/chunks/app/invoices/page.js
5.5M .next/static/chunks/app/invoices/[id]/page.js
```

## Browser Use Smoke Pass

Browser Use was run against `http://localhost:3000` after starting `npm run dev`. The login UI loaded and an authenticated local session was established through the visible in-app controls. Destructive actions were not clicked.

Observed warm-route timings from Browser Use:

| Workflow | Route/action | Observed time | Notes |
| --- | --- | ---: | --- |
| login | `/login` form | UI loaded; submit completed after visible click | Local auth succeeded. |
| dashboard | `/` | 539 ms | Visible dashboard with queue, team metrics, calendar, activity. |
| invoices list | `/invoices` | 606 ms | Visible list with draft COPYTECH invoices. |
| invoice detail | `/invoices/d36b4f6f-1a0f-4cb1-8a54-8760c93fbd6e` | 737 ms | Client detail loaded after API fetch. |
| invoice edit | `/invoices/d36b4f6f-1a0f-4cb1-8a54-8760c93fbd6e/edit` | 1747 ms | Client edit form loaded after API and supporting refs. |
| quotes list | `/quotes` | 904 ms | Empty local quote list in this dataset. |
| products/search | `/products`, search box filled with `paper` | 1287 ms initial, 297 ms input observation | UI showed product catalog; server logs show search/count APIs below. |
| calendar | `/calendar` | 3173 ms | Calendar month grid and Add Event control visible. |
| bulk edit preview workspace | `/products/bulk-edit` | 517 ms route, supporting APIs up to 1489 ms cold | Preview workspace visible; no preview or commit was submitted. |

Follow-up warm smoke after the first optimization pass:

| Workflow | Route | Observed warm navigation | Notes |
| --- | --- | ---: | --- |
| products/search | `/products` | 453 ms | Product/search/Quick Picks labels present; no auth redirect. |
| invoices list | `/invoices` | 451 ms | Invoice list labels present; no auth redirect. |
| calendar | `/calendar` | 402 ms | Event UI text present; no auth redirect. |
| dashboard | `/` | 418 ms | Dashboard content present; no auth redirect. |

The in-app browser console still reports pre-existing Base UI native-button warnings on these routes.

## Post-Migration Lighthouse Recheck

After applying `20260423180000_performance_baseline_indexes` to Supabase, these routes were rechecked with the same authenticated Lighthouse command shape:

```bash
npm run audit:perf -- --path /calendar --auth --no-start-server --only-categories performance --runs 1 --browser chrome --ignore-thresholds
npm run audit:perf -- --path /products --auth --no-start-server --only-categories performance --runs 1 --browser chrome --ignore-thresholds
npm run audit:perf -- --path /invoices --auth --no-start-server --only-categories performance --runs 1 --browser chrome --ignore-thresholds
npm run audit:perf -- --path / --auth --no-start-server --only-categories performance --runs 1 --browser chrome --ignore-thresholds
```

| Route | Baseline score | Recheck score | Baseline LCP | Recheck LCP | Baseline TBT | Recheck TBT | Baseline CLS | Recheck CLS | Read |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| `/calendar` | 17 | 18 | 26097 ms | 25927 ms | 1990 ms | 1941 ms | 0.777 | 0.754 | Essentially flat; remaining issue is front-end render/layout weight. |
| `/products` | 36 | 37 | 26992 ms | 26969 ms | 2593 ms | 2469 ms | 0.149 | 0.150 | Essentially flat; request scheduling helps warm UX but not Lighthouse main-thread/TTI. |
| `/invoices` | 38 | 38 | 16858 ms | 16832 ms | 2081 ms | 2062 ms | 0.148 | 0.148 | Flat; list include reduction is not the Lighthouse limiter. |
| `/` | 38 | 34 | 17272 ms | 18235 ms | 1347 ms | 1312 ms | 0.154 | 0.214 | Slightly worse within single-run noise; dashboard still needs client/render work. |

Post-migration report paths:

- `playwright-report/lighthouse/localhost-3000-calendar-desktop-2026-04-24T01-32-05.470Z-run-1.html`
- `playwright-report/lighthouse/localhost-3000-products-desktop-2026-04-24T01-32-28.122Z-run-1.html`
- `playwright-report/lighthouse/localhost-3000-invoices-desktop-2026-04-24T01-32-49.217Z-run-1.html`
- `playwright-report/lighthouse/localhost-3000-desktop-2026-04-24T01-33-08.840Z-run-1.html`

Representative dev-server timings from the Browser Use and Lighthouse passes:

```text
GET /api/products/search?minStock=1 200 in 1314ms cold, then 324ms and 258ms warm
GET /api/products/search?tab=merchandise&minStock=1&countOnly=true 200 in 167ms, 159ms, 188ms
GET /api/products/search?tab=quickPicks&allSections=true&minStock=1&countOnly=true 200 in 56ms, 67ms, 82ms
GET /api/products/refs 200 in 1035ms cold
GET /api/products/bulk-edit/runs?limit=20 200 in 1489ms cold
GET /api/calendar/events?start=2026-04-20&end=2026-04-25 200 in 497ms cold, then 63ms and 42ms warm
GET /invoices 200 in 624ms cold, then 274ms and 216ms warm
GET /api/invoices/d36b4f6f-1a0f-4cb1-8a54-8760c93fbd6e 200 in 243ms, then 158ms
GET /api/follow-ups/badge?invoiceId=d36b4f6f-1a0f-4cb1-8a54-8760c93fbd6e 200 in 962ms cold
```

## Slowest Likely User Workflows

1. Calendar initial load.
   Evidence: worst measured Lighthouse score, 26.1 s LCP/TTI, 0.777 CLS, largest build first-load JS, and `listCalendarEventsForRange` over-fetches catering quotes and staff birthdays before filtering in JS.

2. Products/search initial load.
   Evidence: 27.0 s LCP, 2.6 s TBT, `/products` 326 kB first-load JS, app page triggers health, views, sync status, main search, and inactive-tab count requests; the search route repeats a heavy CTE for rows and count.

3. Dashboard.
   Evidence: 17.3 s LCP and TTI, server bootstrap fans out into dashboard focus, stats, pending accounts, running invoices, recent activity, and calendar data. Stats alone include 12 weekly invoice-stat calls.

4. Invoices list/detail/edit.
   Evidence: list Lighthouse LCP 16.9 s and TTI 23.9 s. Source shows SSR list work pulls staff, categories, table data, creator stats, then follow-up badge states. Detail and edit pages are client-fetch driven and edit loads several supporting APIs after route load.

5. Bulk edit preview/commit.
   Evidence: preview route is read-heavy but acceptable for small selections; the field-picker commit path loops changed rows sequentially and invokes the single-SKU PATCH handler once per SKU. The audit did not execute commit because that is a write path.

6. PDF generation/finalization.
   Evidence: source shows each invoice/quote PDF generation reads and base64-encodes the logo, writes temp HTML, starts a fresh Chrome process, prints to PDF, then reads and deletes temp files. Invoice finalization also fetches the invoice once for auth and again for finalization.

## Source Findings

### Dashboard

- `src/app/page.tsx` blocks the authenticated dashboard on `getDashboardBootstrapData(currentUserId)` before rendering.
- `src/domains/dashboard/service.ts:58-80` builds 12 weekly ranges and calls `invoiceService.getStats` once per week.
- `src/domains/dashboard/service.ts:83-100` adds month stats, last-month stats, creator stats, expected-open aggregate, and the 12-call pipeline in one bootstrap.
- `src/domains/dashboard/service.ts:116-198` adds five per-user counts/aggregates.
- `src/domains/dashboard/service.ts:221-271` fetches up to 50 running invoices with a first item and item count.
- `src/domains/dashboard/service.ts:274-357` fetches recent invoice/quote activity, then separately fetches payment reminder attempts and invoice follow-up badges.
- `src/domains/dashboard/service.ts:360-389` combines calendar, focus, stats, pending accounts, running invoices, and activity into the initial dashboard bootstrap.

Likely bottleneck: DB fan-out and post-query derivation, not Prisma itself as a blanket technology choice.

### Invoices

- `src/app/invoices/page.tsx:84-97` SSR-loads staff list, categories, initial invoice table data, and creator stats.
- `src/app/invoices/page.tsx:102-107` then loads badge state for the visible invoice IDs after the initial parallel block.
- `src/domains/invoice/repository.ts:10-17` includes full line items for every list row. List UI generally needs summary/count/first-detail, not the entire item set.
- `src/domains/invoice/repository.ts:92-104` search uses case-insensitive `contains` across invoice number, department, staff/contact names, notes, and item descriptions. This can become expensive without focused text indexes or a separate search document.
- `src/domains/invoice/repository.ts:137-146` paginates with a `findMany` plus `count`, which is normal, but the include shape makes the row query heavier than needed.
- `src/domains/invoice/repository.ts:357-397` gets all current-month invoices and groups by creator in application code instead of using a DB aggregate/grouping path.
- `src/components/invoices/invoice-detail.tsx:19-23` loads invoice detail client-side via `useInvoice(id)` after the route shell renders.
- `src/components/invoices/invoice-detail.tsx:31-43` regenerates/finalizes the PDF and then refetches the invoice.

### Quotes

- `src/app/quotes/page.tsx:95-107` SSR-loads staff, categories, and quote list data.
- `src/app/quotes/page.tsx:111-116` then loads badge state for visible quote IDs.
- `src/domains/quote/repository.ts:11-17` includes full line items for every list row.
- `src/domains/quote/repository.ts:74-87` has broad text search across quote fields and item descriptions.
- `src/domains/quote/repository.ts:110-127` runs `expireOverdue()` as an `updateMany` before every quote list read.
- `src/domains/quote/service.ts:356-370` and `src/domains/quote/service.ts:376-389` can also write an expired status during detail/share-token reads.
- `src/domains/quote/repository.ts:522-539` reads quote views and follow-ups by invoice ID and time order; `follow_ups` has an index, but `quote_views` does not.

Likely bottleneck: quote list/detail can spend write latency on read requests, and list rows over-fetch items.

### Products/Search

- `src/app/products/page.tsx:252-280` starts the main product search and product health polling.
- `src/app/products/page.tsx:305-349` fires inactive-tab count requests after active data resolves.
- `src/domains/product/search-route.ts:339-346` builds text search with a `to_tsvector` branch plus several `ILIKE` branches.
- `src/domains/product/search-route.ts:379-400` handles numeric search with exact SKU/barcode/ISBN/catalog and runtime DCC concatenation expressions.
- `src/domains/product/search-route.ts:529-557` builds a `visible_skus` CTE and joins `product_inventory` twice.
- `src/domains/product/search-route.ts:646-654` runs a full count query for count-only requests.
- `src/domains/product/search-route.ts:664-685` runs the base row query and then repeats the CTE for the total count.
- `src/domains/product/search-route.ts:687-702` runs a third query for inventory rows for the page SKUs.

Existing indexes:

- Product PK is `products(sku)`.
- `prisma/migrations/20260416999999_products_table_baseline/migration.sql:29-37` adds barcode, item type, and a GIN `to_tsvector('english', description)` index.
- `prisma/migrations/20260419180000_product_inventory_table/migration.sql:64-72` uses PK `(sku, location_id)` plus single-column location/tag/status/last-sale indexes.

Potential gaps:

- The query uses `to_tsvector('simple', description)`, while the migration indexed `to_tsvector('english', description)`. Planner may not use the existing GIN index for the `simple` expression.
- Location-first inventory filters may benefit from a composite `(location_id, sku)` or revised CTE strategy.
- Runtime DCC concatenation cannot use the existing numeric component indexes directly.

### Calendar

- `src/domains/calendar/service.ts:31-63` fetches all active catering quotes with JSON details and all active staff birthdays for every date range.
- `src/domains/calendar/service.ts:65-75` filters catering event date in application code after fetching the rows.
- `src/domains/calendar/service.ts:151-178` calls `listCalendarEventsForRange` twice on bootstrap, once for desktop week and once for mobile day, duplicating the all-catering/all-birthday work.
- `src/domains/event/repository.ts:25-29` queries manual events by `date` range, but `prisma/schema.prisma:221-241` has no event date index.

### Bulk Edit Preview/Commit

- `src/app/api/products/bulk-edit/dry-run/route.ts:453-516` loads source rows and builds the preview in one request. This is read-only and suitable for future benchmark fixtures.
- `src/app/api/products/bulk-edit/commit/route.ts:538-592` field-picker commit rebuilds the preview, filters changed rows, then loops each changed SKU sequentially through the single-product PATCH route.
- `src/app/api/products/bulk-edit/commit/route.ts:646-710` the legacy path already batches rows through `/api/products/batch`, which is a better shape for large commits.

The user-facing CopyTech import preview/commit wording maps to the bulk edit preview/commit workflow in this repo. I did not find a distinct `CopyTech import` module.

### PDF Generation/Finalization

- `src/lib/pdf/generate.ts:27-39` reads and base64-encodes `public/lapc-logo.png` for each invoice PDF, then generates cover and IDP PDFs.
- `src/lib/pdf/generate-quote.ts:13-19` repeats the logo read/base64 path for quote PDFs.
- `src/lib/pdf/puppeteer.ts:18-71` creates a temp directory, writes HTML, launches a fresh Chrome process, prints to PDF, reads the result, and removes the temp directory for every render.
- `src/app/api/invoices/[id]/finalize/route.ts:37-44` fetches the invoice via `invoiceService.getById` for authorization and then `invoiceService.finalize` fetches the invoice again at `src/domains/invoice/service.ts:376-378`.
- `src/domains/invoice/service.ts:419-453` generates the PDF before optional PrismCore merge and final DB update.

## Schema And Index Gaps

Current invoice-related model indexes:

- `prisma/schema.prisma:159-161`: `Invoice` only indexes `(type, archivedAt)`, `(createdBy, archivedAt)`, and `(archivedBy, archivedAt)`.
- `prisma/schema.prisma:165-182`: `InvoiceItem` has no explicit `(invoiceId, sortOrder)` index despite relation includes sorting items by `sortOrder`.
- `prisma/schema.prisma:313-326`: `QuoteView` has no `(invoiceId, viewedAt)` index.
- `prisma/schema.prisma:522-524`: `FollowUp` does have `(invoiceId, sentAt)`, `seriesId`, and `(seriesStatus, type)`.
- `prisma/schema.prisma:221-241`: `Event` has no `date` index.

Recommended verification before adding indexes:

```sql
EXPLAIN (ANALYZE, BUFFERS)
-- representative invoice list, invoice search, quote list, product search,
-- calendar event range, quote view activity, and bulk edit source row queries
```

## Prisma Assessment

The evidence does not support removing Prisma as a broad performance fix. The clearest issues are query shape, indexes, duplicated reads, write-on-read behavior, client boot fan-out, and Chrome/PDF process startup. Prisma may add overhead to some paths, but none of the measured/source-backed findings identifies Prisma itself as the root bottleneck for a specific user workflow.
