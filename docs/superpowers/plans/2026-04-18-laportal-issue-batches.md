# LAPortal Issue Batches

Date: 2026-04-18

This note tracks the current open-issue remediation batches so the implementation
work stays grouped by shared code surface instead of scattering one-off fixes
across unrelated branches.

## Batch 1: Products UX, presets, and view state

Status:
- Implemented in this worktree with focused regression tests.

Issues:
- #184 products views API drops the Trending and Stock Health system preset groups
- #185 advanced products presets are not fully restorable or inspectable from the URL and filters panel
- #189 Pierce assurance badge on the products page does not open sync history
- #190 products filter badge undercounts active analytics filters
- #192 products saved-views failures collapse into a generic fallback state with no actionable error detail
- #197 hiding a preset-added products column persists preset runtime columns into the user's defaults
- #198 products hidden-column indicator undercounts at the exact responsive breakpoints

Primary files:
- `src/app/products/page.tsx`
- `src/components/products/product-filters.tsx`
- `src/components/products/product-filters-extended.tsx`
- `src/components/products/saved-views-bar.tsx`
- `src/components/products/sync-database-button.tsx`
- `src/components/products/column-visibility-toggle.tsx`
- `src/components/products/use-hidden-columns.ts`
- `src/domains/product/view-serializer.ts`
- `src/domains/product/views-api.ts`
- `src/app/api/products/views/route.ts`

## Batch 2: Products analytics and sync correctness

Status:
- Implemented in this worktree with focused regression tests.
- The fixes move last-sale, margin, and aggregate-readiness logic onto the derived
  products view so filtering, sorting, counts, and display behavior stay aligned.

Issues:
- #181 `/api/sync/prism-pull` reports success even when sales-transaction sync or aggregate refresh fails
- #182 products analytics cannot distinguish uncomputed sales data from real zero-sales rows
- #183 products page still uses `Inventory.LastSaleDate` instead of the more accurate computed sale date
- #187 margin-based product filters paginate and count the wrong rows
- #188 sales transaction backfill stores a transaction cursor from `TranDtlID`-ordered pages

Primary files:
- `src/app/api/sync/prism-pull/route.ts`
- `src/domains/product/queries.ts`
- `src/domains/product/sales-txn-sync.ts`
- `src/domains/product/sales-aggregates.ts`
- `scripts/backfill-prism-transactions.ts`

## Batch 3: Agenda stream behavior

Status:
- Not reproducible on the current `origin/main` checkout.
- Repo-wide searches for `AgendaStreamView`, `agenda-stream`, `showPast`,
  `loadAgendaPreferences`, `saveAgendaPreferences`, and the referenced quick-add
  handlers returned no matching source files on 2026-04-18.
- These issues should be closed as stale or retargeted to the branch/repo that
  actually contains the agenda stream implementation.

Issues:
- #194 agenda stream summary counts ignore the Show past filter
- #195 expanded agenda stream can open Quick Add when a user double-clicks a read-only event
- #196 agenda stream preference helpers are implemented and tested but never wired into the actual view state

Primary files:
- calendar / agenda-stream UI state and interaction surfaces
