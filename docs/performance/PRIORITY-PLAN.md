# LAPortal Performance Priority Plan

This plan is ordered by likely user impact and PR risk. Keep each item as a focused branch/PR. Do not remove Prisma unless a later benchmark isolates Prisma client overhead on a specific path after query shape and indexes are addressed.

## First Optimization Pass Status

Implemented in the first follow-up pass:

- Added Lighthouse manifest coverage for `/calendar`, `/products`, and `/invoices`.
- Added focused Supabase/Postgres indexes for calendar dates, invoice list ordering, invoice item previews, and product description search. The attempted `product_inventory(location_id, sku)` index is not included in the Prisma migration because the connected role is not the owner of that table in Supabase.
- Reduced calendar bootstrap from two range loads to one desktop-week load with a filtered mobile-day slice, and pushed catering quote `eventDate` filtering into SQL when the real Prisma client is available.
- Replaced the dashboard 12-query weekly pipeline with one grouped aggregate query.
- Made invoice list includes leaner by fetching only the first line item plus `_count`, and moved creator stats to a grouped aggregate query.
- Deferred/cancelled products inactive-tab counts, delayed product health checks until first search data exists, and added abort support to product search fetches.

Post-migration Lighthouse recheck showed the DB/index pass did not materially change Lighthouse LCP/TTI. The server side is no longer the obvious limiter for the four audited pages; the next work should target front-end bundle/render cost and layout stability.

Remaining highest-value follow-ups:

- Add the `product_inventory(location_id, sku)` index through the table owner/service path if EXPLAIN confirms it is still needed.
- Do the analogous lean-list include split for quotes.
- Combine product rows and total count into a single SQL shape after EXPLAIN confirms the best plan.
- Remove quote write-on-read behavior in a separate PR.
- Split the heaviest browser-only widgets out of initial page bundles, especially FullCalendar and product table controls.

## P0: Add Repeatable Measurement Coverage

Impact: high for future work. Risk: low.

Ship a small PR that expands the existing Lighthouse route manifest and records baseline commands for the workflows audited here.

Scope:

- Add `/invoices`, `/quotes`, `/products`, `/products/bulk-edit`, and `/calendar` to `scripts/lighthouse-routes.json`.
- Keep thresholds loose at first, based on `BASELINE.md`, so the first PR is observability rather than a surprise gate.
- Add a short docs note for rate-limit behavior during repeated authenticated audits.

Validation:

```bash
npm run audit:perf -- --path /invoices --auth --no-start-server --only-categories performance --runs 1 --browser chrome --ignore-thresholds
npm run audit:perf -- --path /products --auth --no-start-server --only-categories performance --runs 1 --browser chrome --ignore-thresholds
npm run lint
npm test
```

## P1: Calendar Bootstrap And Index Fix

Impact: very high. Risk: low to medium.

Calendar is the worst measured route: Lighthouse score 17, 26.1 s LCP/TTI, 0.777 CLS, and the largest build first-load JS.

PR-sized fix:

- Add a DB index for manual event range reads: `events(date)` or a Prisma `@@index([date])`.
- Change `getCalendarBootstrapData` so one wider server load supplies both desktop and mobile ranges instead of calling `listCalendarEventsForRange` twice.
- Avoid fetching all catering quotes for every date range. Prefer filtering by JSON `eventDate` in SQL/Supabase where practical, or add a denormalized `cateringEventDate` column in a separate migration if JSON filtering is not reliable enough.
- Avoid recomputing all active staff birthdays twice for week/day bootstrap.

Validation:

```bash
npm run test -- calendar
npm run audit:perf -- --path /calendar --auth --no-start-server --only-categories performance --runs 1 --browser chrome --ignore-thresholds
npm run build
```

Status: initial server/query/index portion is implemented and deployed. Lighthouse stayed flat, so the next calendar PR should focus on client-side calendar bundle/render and CLS.

## P2: Dashboard Query Fan-Out Reduction

Impact: very high. Risk: medium.

Dashboard currently blocks initial render on a large bootstrap, and `getDashboardPipeline` alone calls `invoiceService.getStats` 12 times.

PR-sized fix:

- Replace 12 weekly `getStats` calls with one grouped aggregate query for weekly totals.
- Replace `countByCreator` app-side grouping with a database aggregate/grouping path.
- Keep the existing dashboard layout and DTO shape stable.
- Consider deferring lower-priority widgets after the first paint only after the query fan-out is reduced.

Validation:

```bash
npm test
npm run audit:perf -- --path / --auth --no-start-server --only-categories performance --runs 1 --browser chrome --ignore-thresholds
```

## P3: Invoice And Quote List Lean Includes

Impact: high. Risk: low to medium.

Invoice and quote list repositories include every line item for every visible row. The list UIs need summary fields, requestor/creator, status, totals, counts, and sometimes a first item, not the full item collection.

PR-sized fix:

- Split list DTO selects from detail DTO includes for invoices.
- Split list DTO selects from detail DTO includes for quotes.
- Use `_count` and a `take: 1` item preview where needed.
- Add `invoice_items(invoice_id, sort_order)` in Prisma/schema migration if EXPLAIN confirms item relation sorting needs it.
- Keep detail/edit includes unchanged unless separately measured.

Validation:

```bash
npm test
npm run audit:perf -- --path /invoices --auth --no-start-server --only-categories performance --runs 1 --browser chrome --ignore-thresholds
npm run build
```

## P4: Remove Quote Write-On-Read From List/Detail

Impact: high for quotes. Risk: medium.

`quoteRepository.findMany` runs `expireOverdue()` before every list read, and quote detail/share-token reads can update expiration status.

PR-sized fix:

- Move broad quote expiration to an explicit background/scheduled task or an admin maintenance endpoint.
- For read paths, compute an effective display status without writing, or expire only a single quote in a clearly named mutation/action.
- Preserve user-facing expired-state behavior.
- Add tests that prove GET/list/detail no longer mutate status.

Validation:

```bash
npm test -- quote
npm run audit:perf -- --path /quotes --auth --no-start-server --only-categories performance --runs 1 --browser chrome --ignore-thresholds
```

## P5: Products Search Query And Initial Request Collapse

Impact: very high. Risk: medium.

Products measured 27.0 s LCP/27.7 s TTI. Initial load fires main search, health/sync/views requests, and inactive tab counts. The search route repeats the same CTE for rows and total count.

PR-sized fix:

- Combine product rows and total count with one query shape, for example `COUNT(*) OVER()` on the filtered result, if EXPLAIN shows it reduces work.
- Defer inactive tab count requests until after first visible data, or cache them per filter set with cancellation/debounce.
- Align the text-search expression with the existing GIN index: either use the indexed `english` expression or add the matching `simple` expression index.
- Add a composite `product_inventory(location_id, sku)` if EXPLAIN confirms location-first filtering is expensive.
- Treat runtime DCC concatenation as a follow-up with a generated/search column only if numeric DCC search is frequent.

Validation:

```bash
npm test -- products
npm run audit:perf -- --path /products --auth --no-start-server --only-categories performance --runs 1 --browser chrome --ignore-thresholds
npm run build
```

Status: initial request scheduling/cancellation and product description search index are implemented and deployed. Lighthouse stayed flat, so the next products PR should inspect table render/main-thread work before deeper SQL changes.

## P6: Bulk Edit Field-Picker Commit Batching

Impact: high for large CopyTech/product update runs. Risk: medium.

Field-picker commit currently loops changed rows and invokes the single-SKU PATCH route sequentially. The legacy path already uses a batch endpoint.

PR-sized fix:

- Convert field-picker commit to build batch rows and call a batch service/route once, or extract shared batch update logic and call it directly.
- Preserve per-SKU error reporting and audit-run creation.
- Add tests for partial mirror errors, zero-change selections, and multi-SKU success.
- Do not benchmark or run real commit against PRISM without explicit per-action user permission.

Validation:

```bash
npm test -- bulk-edit
npm run lint
```

## P7: PDF Generation Cold-Path Reduction

Impact: medium to high for finalization. Risk: low for the first step.

PDF generation repeatedly reads and base64-encodes the same logo and launches a fresh Chrome process per render.

PR-sized fix:

- Cache the logo data URI in-process for invoice and quote PDF generation.
- Add a tiny benchmark or test around `renderHtmlToPdf` cold/warm timing if practical.
- Keep the fresh Chrome process for now unless a later PR adds a well-tested renderer pool/worker. A browser pool is higher risk and should be isolated.
- Avoid changing finalization semantics in the first PR.

Validation:

```bash
npm test -- pdf
npm run build
```

## P8: Client Detail/Edit Preload Cleanup

Impact: medium. Risk: medium.

Invoice detail and edit routes load shells first, then fetch detail data and supporting refs on the client. Invoice edit Browser Use took 1747 ms warm and server logs show supporting API fan-out.

PR-sized fix:

- For invoice detail, consider server-loading the first detail payload and passing it as initial data to the client view.
- For edit, batch categories/templates/staff/product search defaults where possible, or defer nonblocking refs until the primary invoice form is interactive.
- Keep SSE/refetch behavior intact.

Validation:

```bash
npm test -- invoice
npm run build
```

## P9: Index Review PR

Impact: medium. Risk: low if backed by EXPLAIN.

Bundle the smallest obvious index additions only after EXPLAIN confirms them:

- `events(date)` for calendar range.
- `invoice_items(invoice_id, sort_order)` for list/detail includes.
- `quote_views(invoice_id, viewed_at DESC)` for quote activity.
- Possibly invoice composites around common filters: `(type, archived_at, created_at DESC)`, `(type, archived_at, date DESC)`, `(type, archived_at, status)`, `(type, archived_at, quote_status)`, and `(created_by, archived_at, created_at DESC)`.
- Product search expression/index alignment for `to_tsvector`.

Validation:

```bash
npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma
npm test
npm run build
```

## Suggested Order

1. Measurement manifest PR.
2. Calendar bootstrap/index PR.
3. Dashboard grouped aggregate PR.
4. Invoice/quote list lean include PR.
5. Quote write-on-read removal PR.
6. Products search query/count PR.
7. Bulk edit field-picker batching PR.
8. PDF logo-cache/cold-path PR.
9. Detail/edit preload PR.

This order gets the worst measured routes first while keeping each branch small enough for CodeRabbit, CI, and local browser verification.
