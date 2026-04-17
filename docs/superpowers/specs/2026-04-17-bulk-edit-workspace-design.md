# Bulk Edit Workspace + Prism Pull Sync — Design Spec

**Date:** 2026-04-17
**Branch:** to be started from current tip of `feat/products-crud-batch` (prod = `b4ca560`, live at laportal.montalvo.io)
**Status:** Design approved, ready for implementation plan

## Goal

Give admin users a dedicated workspace for bulk editing the product catalog — price campaigns, margin re-pricing, cost updates, DCC/tax cleanup — with proper preview, Pierce-vs-district safety, and saved searches. Add a lightweight daily pull sync (plus manual button) so Supabase stays close to Prism without making Prism the user's critical read path.

## Background & context

We already shipped single-item CRUD + batch add/update/discontinue/hard-delete in the `feat/products-crud-batch` branch. Those features write to Prism directly through the existing `POST /api/products/batch` endpoint; Supabase is a read-side mirror that's updated on every write.

What's missing is a first-class tool for the recurring bulk workflows:
- Inflation-driven price uplifts across many items
- Margin re-pricing after vendor cost changes
- Mass DCC / tax cleanup
- Recurring "this group of items gets the same treatment" campaigns

What's also missing is a way to see changes that Prism receives from *outside* laportal — POS sales, WinPRISM desktop edits, overnight jobs — in Supabase. Today the mirror only reflects our own writes.

## Architectural direction (locked in brainstorming)

**Prism stays the source of truth.** Supabase is a read-side mirror. All writes go to Prism first; the Supabase row is upserted after the Prism commit succeeds.

No write-through caching, no Supabase-first staging, no dual source of truth. Previously-analyzed reasons: POS terminals read from Prism in real time, stored-proc business logic isn't replicated in Supabase, and dual writes invite conflicts with the WinPRISM desktop client.

The new sync piece is **one-directional, Prism → Supabase**, scheduled daily and on-demand via a button. Nothing ever flows Supabase → Prism outside of the existing user-triggered write paths.

## Scope

### In scope

- **Bulk edit workspace** at `/products/bulk-edit`
  - Three-phase workflow: Select → Transform → Preview & Commit
  - Compound transform (one pricing mode + optional DCC/tax metadata)
  - Pricing modes: uplift %, absolute set, margin re-price, cost update with optional retail recompute preserving current margin
  - Server-side dry-run preview with diff grid, impact totals, and warnings
  - Confirmation + atomic batch commit through the existing `/api/products/batch` endpoint
- **Shortcut from the products page**: "Bulk Edit Selected" button carries the current selection into the workspace
- **Saved Searches** (selection-only presets)
  - User-scoped presets + a small set of system-ship "smart helpers"
  - Sidebar library with load / save / delete
- **Audit log** in Supabase (`bulk_edit_runs`), rendered inline at the bottom of the workspace
  - Operator, timestamp, full transform spec, affected SKUs, summary stats
  - "Re-run this selection" loads the filter + transform back into the workspace (does NOT auto-commit)
- **Pierce-vs-district safety**
  - Visual split in the transform panel (Pierce Pricing | District Catalog)
  - Warning in the commit confirmation if any district-wide field is in the patch
- **Prism → Supabase pull sync**
  - Scheduled daily at 11:00 America/Los_Angeles via the existing instrumentation cron hook
  - Manual "Sync Database" button in the products / bulk-edit headers
  - Full-catalog read with row-hash compare (Phase 1); only upsert changed rows
  - `sync_runs` Supabase table captures each attempt
- **Cross-campus search scope toggle** on the selection panel (Pierce-only default, All-campuses optional for reference)

### Out of scope (captured for future specs)

- **Clone with variations** (D2) — create N items from a template with per-axis variation. Separate spec, own brainstorm.
- **Saved campaigns** (selection + transform bundled) — re-run existing runs via the audit log instead, for now.
- **Undo** — a good preview + the audit log are enough for MVP. Revisit only if mistakes happen in practice.
- **Query builder** — filter bar + smart helpers + paste-SKU cover 95%.
- **Stored per-item / per-DCC margin targets** — stateless margin preservation is enough for now.
- **"Push to Prism" / "retry failed mirror" button** — writes already push on commit; mirror drift is handled by the daily pull.
- **Write-to-Supabase-first architecture** — deliberately not built; would break POS real-time read of catalog.

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│ /products                                                        │
│  ├─ [Bulk Edit Selected] (N > 0)   → workspace with preloaded    │
│  │                                    selection                  │
│  ├─ [Bulk Edit Workspace →]        → empty workspace             │
│  └─ [Sync Database]                → POST /api/sync/prism-pull   │
│                                       (same endpoint as cron)    │
└──────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│ /products/bulk-edit (new workspace)                              │
│                                                                  │
│  Sidebar: Saved searches + Smart helpers + Recent runs           │
│                                                                  │
│  1. SELECT:   Filter bar (reuses /products filters) +            │
│               Pierce / District toggle + Paste-SKU input         │
│               Live "N matching / N selected" badge               │
│                                                                  │
│  2. TRANSFORM: Visual split                                      │
│     ┌─ Pierce Pricing ─────────────────┐                         │
│     │  Mode: Uplift | Absolute |       │                         │
│     │        Margin | Cost+recompute   │                         │
│     └──────────────────────────────────┘                         │
│     ┌─ District Catalog ⚠ 17 campuses ─┐                         │
│     │  DCC   [dropdown or unchanged]   │                         │
│     │  Tax   [dropdown or unchanged]   │                         │
│     └──────────────────────────────────┘                         │
│                                                                  │
│  3. PREVIEW & COMMIT: server dry-run → diff grid + totals +     │
│     warnings. Confirm dialog (with district warning if applies). │
│     Commit via existing POST /api/products/batch.                │
│                                                                  │
│  Audit log (inline, collapsible): last 20 bulk_edit_runs         │
└──────────────────────────────────────────────────────────────────┘
                                │
                                ▼
              POST /api/products/batch   (unchanged)
              POST /api/products/validate-batch  (unchanged)

┌──────────────────────────────────────────────────────────────────┐
│ Pull sync (new)                                                  │
│  • POST /api/sync/prism-pull                                     │
│  • Scheduled: daily at 11:00 America/Los_Angeles                 │
│  • Manual: [Sync Database] button                                │
│  • Strategy: full Item + Inventory scan, row-hash compare,       │
│    upsert only changed rows into Supabase products mirror        │
│  • Records one sync_runs row per attempt                         │
└──────────────────────────────────────────────────────────────────┘
```

### Critical design invariants

1. **Prism is source of truth for catalog + inventory.** Supabase mirrors one-way.
2. **Compound transform** = one pricing mode at a time + optional DCC/tax. Never "uplift AND absolute set" in one pass; that's two passes.
3. **District-wide writes must be visible as such** in the UI. Visual split in the transform panel + commit-dialog warning.
4. **No undo.** The preview is the safety net. Audit log gives retrospective visibility.
5. **Pull sync is one direction only.** Supabase → Prism never happens outside of user-triggered writes.

## Components

### New frontend

| Path | Responsibility |
|---|---|
| `src/app/products/bulk-edit/page.tsx` | Workspace page shell |
| `src/components/bulk-edit/BulkEditSidebar.tsx` | Saved searches, helpers, recent runs |
| `src/components/bulk-edit/SelectionPanel.tsx` | Filter bar + scope toggle + paste-SKU + count badge |
| `src/components/bulk-edit/TransformPanel.tsx` | Compound transform form with visual split |
| `src/components/bulk-edit/PreviewPanel.tsx` | Diff grid + totals + warnings + commit button |
| `src/components/bulk-edit/AuditLogList.tsx` | Recent runs, paginated; opens detail drawer |
| `src/components/bulk-edit/SaveSearchDialog.tsx` | Name + save the current filter state |
| `src/components/products/sync-database-button.tsx` | Header button + last-synced timestamp |

### New backend

| Path | Responsibility |
|---|---|
| `src/app/api/products/bulk-edit/dry-run/route.ts` | POST: selection + transform → per-row projected diff |
| `src/app/api/products/bulk-edit/commit/route.ts` | POST: same inputs → call `/api/products/batch` → record `bulk_edit_runs` |
| `src/app/api/products/bulk-edit/runs/route.ts` | GET: paginated list of recent runs |
| `src/app/api/products/bulk-edit/runs/[id]/route.ts` | GET: full detail of one run |
| `src/app/api/saved-searches/route.ts` | GET / POST: list & create |
| `src/app/api/saved-searches/[id]/route.ts` | PATCH / DELETE |
| `src/app/api/sync/prism-pull/route.ts` | POST: the pull sync |
| `src/domains/bulk-edit/transform-engine.ts` | Pure transform-spec → per-row-patch translator (unit-testable) |
| `src/domains/bulk-edit/preview-builder.ts` | Build preview from current rows + transform; compute warnings |
| `src/domains/product/prism-sync.ts` | Pull-sync implementation: stream Prism, hash, upsert changed |

### Supabase schema additions

```sql
CREATE TABLE saved_searches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  owner_user_id uuid REFERENCES users(id),    -- NULL = system preset
  name text NOT NULL,
  filter jsonb NOT NULL,                       -- full selection criteria
  is_system boolean NOT NULL DEFAULT false
);
CREATE INDEX ON saved_searches (owner_user_id, name);

CREATE TABLE bulk_edit_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  operator_user_id uuid NOT NULL REFERENCES users(id),
  operator_display text NOT NULL,
  selection jsonb NOT NULL,
  transform jsonb NOT NULL,
  affected_skus int[] NOT NULL,
  sku_count int NOT NULL,
  pricing_delta_cents bigint DEFAULT 0,
  had_district_changes boolean NOT NULL,
  summary text NOT NULL
);
CREATE INDEX ON bulk_edit_runs (created_at DESC);
CREATE INDEX ON bulk_edit_runs (operator_user_id, created_at DESC);

CREATE TABLE sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  triggered_by text NOT NULL,                  -- 'scheduled' | 'manual:<user_id>'
  scanned_count int,
  updated_count int,
  status text NOT NULL,                        -- 'running' | 'ok' | 'failed'
  error text
);
CREATE INDEX ON sync_runs (started_at DESC);
```

Seed data: insert the smart-helper presets into `saved_searches` with `is_system = true`:

- All textbooks
- Items without barcode
- Items with negative margin
- Items not touched in 12 months
- All items from one vendor (parameterized)

## Transform specification

The compound-transform wire format:

```ts
interface BulkEditTransform {
  pricing:
    | { mode: "none" }
    | { mode: "uplift"; percent: number }
    | { mode: "absolute"; retail: number }
    | { mode: "margin"; targetMargin: number }
    | { mode: "cost"; newCost: number | { uplift: number }; preserveMargin: boolean };
  catalog: {
    dccId?: number;
    itemTaxTypeId?: number;
  };
}

interface BulkEditRequest {
  selection: {
    filter?: ProductFilters;                  // same schema as /products
    skus?: number[];                           // paste-SKU path
    scope: "pierce" | "district";
  };
  transform: BulkEditTransform;
}
```

### Transform semantics (per row)

Given a row with current `retail`, `cost`, `dccId`, `itemTaxTypeId`:

**Pricing**

All price outputs are rounded to **2 decimal places** (standard currency rounding, banker's rounding not required).

- `uplift { percent: 5 }` → `newRetail = round(retail * 1.05, 2)`
- `absolute { retail: 12.99 }` → `newRetail = 12.99` for every row (warnings flag when current retail is far off — surfaces rows you may not have meant to batch-set)
- `margin { targetMargin: 0.40 }` → `newRetail = round(cost / (1 - 0.40), 2)` = `round(cost / 0.60, 2)` — **must validate `0 <= targetMargin < 1`**; values ≥ 1 reject with a clear error since they'd divide by zero or flip the sign
- `cost { newCost: 8.50, preserveMargin: false }` → `newCost = 8.50`, retail unchanged
- `cost { newCost: 8.50, preserveMargin: true }` → `currentMargin = 1 - cost/retail` (skip this row with a warning if current retail = 0); `newCost = 8.50`; `newRetail = round(8.50 / (1 - currentMargin), 2)`
- `cost { newCost: { uplift: 3 }, preserveMargin: true }` → `newCost = round(cost * 1.03, 2)`; `newRetail = round(newCost / (1 - currentMargin), 2)`

**Catalog**

- `dccId` and `itemTaxTypeId`: if present and different from current, emit a district-wide change. If absent, no change to that field.

### Warnings surfaced in preview

- `newRetail < newCost` — negative margin after change
- `currentRetail = 0 && mode = margin` — undefined current margin
- `currentCost = 0` — recomputing margin requires non-zero cost
- `pricing.absolute` where `|newRetail - currentRetail| / currentRetail > 0.50` — >50% price jump, flag as unusual
- Row has `fDiscontinue = 1` — changing a discontinued item's fields is legal but worth flagging
- Selection includes items from multiple DCCs when user applies a single `dccId` change — this is intentional but worth confirming

## Data flow

### Commit path

```
Client: POST /api/products/bulk-edit/commit { selection, transform }
  │
Server:
  1. withAdmin + probePrism gate (503 if tunnel down)
  2. Resolve selection → array of SKUs + current values (from Supabase)
  3. Server-side re-validate transform (same code as dry-run)
  4. Translate transform → batch-update rows
  5. POST /api/products/batch { action: "update", rows }
  6. Wait for batch result (atomic — all or nothing)
  7. On success: INSERT bulk_edit_runs record with full context
  8. Return { runId, successCount, affectedSkus }
```

### Dry-run path

```
Client: POST /api/products/bulk-edit/dry-run { selection, transform }
  │
Server (never touches Prism for reads in Phase 1):
  1. withAdmin
  2. Resolve selection from Supabase (fast)
  3. Run transform engine in-memory per row
  4. Build diff + warnings + totals
  5. Return { rows: [ { sku, before, after, warnings } ... ], totals, warnings }
```

Phase 2 optimization: if Supabase mirror can be stale, dry-run could compare against a fresh Prism read for high-confidence preview. Not needed if the daily pull keeps the mirror ≤ 24 hours stale. Punt.

### Pull sync path

```
Client: POST /api/sync/prism-pull (manual button OR cron)
  │
Server:
  1. withAdmin (manual only; scheduled runs via cron hook skip this check)
  2. probePrism → fail 503 if unreachable
  3. INSERT sync_runs row with status='running'
  4. For each page of Item + Inventory rows (paginated from Prism):
       - Compute row hash (stable across runs)
       - Fetch corresponding Supabase hash
       - If different: upsert into Supabase products
  5. UPDATE sync_runs row with status='ok', counts, durationMs
  6. Return { scanned, updated, durationMs }
```

**Cron registration:** in `src/instrumentation.ts`, schedule a job that hits the same internal handler daily at 11:00 America/Los_Angeles. Scheduled invocations record `triggered_by = 'scheduled'`.

## Pierce-vs-district safety

Enforced at four layers:

1. **Visual split** in the transform panel: two sections with distinct backgrounds, icon cues, and "Pierce Pricing" / "District-wide Catalog" labels.
2. **District section carries a permanent warning subheader**: `⚠ Affects all 17 LACCD locations`.
3. **Commit confirmation dialog** computes whether any district-wide field is in the transform and, if so, shows: `This change will affect the catalog record shared across all 17 LACCD locations, not just Pierce. Continue?`
4. **Audit log records `had_district_changes: boolean`** — makes district-affecting runs easy to find after the fact.

## Error handling

| Failure mode | UX response |
|---|---|
| Prism tunnel down | 503 from commit; "Prism unreachable — changes not saved. The relay machine may be offline." |
| Selection empty at commit | Commit button disabled; selection panel shows "0 items match" |
| Pricing transform produces invalid values (negative retail) | Preview warnings block commit until user acknowledges or adjusts |
| Batch-validate returns per-row errors (duplicate barcode, invalid DCC FK) | Preview panel highlights bad rows; user narrows selection or edits transform |
| Concurrent edit (row changed since preview) | Commit returns 409 with stale SKU list; UI prompts "N items changed since preview — re-preview and retry?" |
| Commit succeeds but mirror upsert fails | Logged as warning, continue; daily pull will repair within 24h. No user-visible error. |
| Pull sync fails mid-run | `sync_runs.status='failed'`, error message captured; UI shows failure on the sync timestamp widget. Next scheduled run retries from scratch. |
| Saved-search persist fails | Toast-level error; the current filter state is still usable in memory |

## Testing

### Unit (Vitest)

- `transform-engine.ts`: every pricing mode × sample rows including edge cases (zero cost, zero retail, mixed Pierce/district patches, rounding behavior)
- Row-hash function for sync: stable across runs, sensitive to all mirrored fields
- Saved-search serialization round-trip
- `preview-builder.ts`: warning rules fire correctly (negative margin, >50% jump, discontinued rows, etc.)

### Integration (new `scripts/test-*.ts`, on-campus only)

- `test-bulk-edit-flow.ts` — create TEST-CLAUDE items, exercise each pricing mode, verify results in Prism via direct SELECT, clean up
- `test-prism-pull-sync.ts` — run the sync, assert idempotency (second run finds zero changed rows), verify `sync_runs` record shape
- `test-bulk-edit-district.ts` — apply a DCC change, confirm the `Item.DCCID` is the new value for the test SKU

### E2E smoke (manual, post-merge)

- In browser: open `/products/bulk-edit`, filter to a small selection of TEST-CLAUDE items, apply 5% uplift + DCC change, preview, commit, verify audit log entry, clean up via test-cleanup script

### ship-check gate

Must stay green: lint + Vitest + build. Prism integration scripts run manually on-campus pre-merge; not part of automated ship-check.

## Rollout

1. Start on a new branch off current `feat/products-crud-batch` tip. Suggested: `feat/bulk-edit-workspace`.
2. Implementation order (to be detailed in the plan phase):
   - Transform engine + unit tests (pure, no I/O)
   - Supabase migrations (new tables + seed)
   - API routes (dry-run, commit, runs, saved-searches, pull-sync)
   - Pull-sync implementation (independent of workspace)
   - Sidebar + SelectionPanel (reuses existing product filter hook)
   - TransformPanel with compound form
   - PreviewPanel + AuditLogList
   - Workspace page assembly
   - "Sync Database" header button + timestamp
   - Products-page shortcut to workspace
   - Prism integration scripts
3. Ship-check green + integration scripts pass → hotfix deploy (same lane as previous work).
4. On-campus browser smoke; merge.

## Implementation-phase UI/UX skills to apply

When the plan is executed, run these at the relevant moments:

- `web-design-guidelines` — after each new component lands, audit the rendered JSX
- `vercel-composition-patterns` — guide the TransformPanel's mode-switching (avoid boolean prop proliferation)
- `vercel-react-best-practices` — preview grid rendering, audit log pagination

## Open items for the plan phase

- Exact shape of `ProductFilters` interface shared between `/products` and `/products/bulk-edit` — factor into a shared type in `src/domains/product/types.ts`
- How to test the pull sync against a real Prism without dirtying the mirror during development — may need a read-only dry-run mode on the sync endpoint (`?dryRun=true` returns would-be-upserts without committing)
- Confirm `src/instrumentation.ts` supports timezone-aware cron schedules (`America/Los_Angeles`) — otherwise compute the offset manually and rebase on DST transitions
- Authorization on `/api/sync/prism-pull` when called by cron — the cron runs in the container, not as a user; needs a bypass path or an internal-secret header
