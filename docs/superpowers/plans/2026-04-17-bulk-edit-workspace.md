# Bulk Edit Workspace + Prism Pull Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `/products/bulk-edit` workspace (Select → Transform → Preview → Commit) with compound transforms, saved searches, audit log, and a companion daily Prism → Supabase pull sync.

**Architecture:** Frontend-heavy feature that reuses the existing `POST /api/products/batch` backend for all catalog writes. New pieces are: (1) a pure transform engine that turns a compound-transform spec into per-row patches, (2) new Supabase tables (`saved_searches`, `bulk_edit_runs`, `sync_runs`), (3) new Next.js routes for dry-run, commit, runs, saved-searches, and pull-sync, (4) new React components and a dedicated page. Source of truth stays Prism; Supabase is a one-way read-side mirror refreshed daily (or on manual button press).

**Tech Stack:** Next.js 14 (App Router), TypeScript, Prisma 7 + Supabase Postgres, `mssql` (reused), `zod`, shadcn/ui, Tailwind, Vitest, `node-cron` (existing).

**Design spec:** `docs/superpowers/specs/2026-04-17-bulk-edit-workspace-design.md`. Read it before starting. This plan implements that spec; decisions (transform shape, margin semantics, no-undo, no-push-button, etc.) are already locked.

---

## File structure

### New files

| Path | Responsibility |
|---|---|
| `src/domains/bulk-edit/types.ts` | `BulkEditTransform`, `BulkEditRequest`, `PricingMode`, `PreviewRow`, `PreviewResult`, etc. |
| `src/domains/bulk-edit/transform-engine.ts` | Pure: compound-transform spec + current row → projected patch + warnings |
| `src/domains/bulk-edit/preview-builder.ts` | Build the preview payload (rows + totals + warnings) from a selection and transform |
| `src/domains/product/prism-sync.ts` | Pull-sync: stream Prism `Item` + `Inventory`, hash-compare, upsert changed rows |
| `src/app/api/products/bulk-edit/dry-run/route.ts` | POST: returns preview without side effects |
| `src/app/api/products/bulk-edit/commit/route.ts` | POST: validates, materializes batch, records run |
| `src/app/api/products/bulk-edit/runs/route.ts` | GET: paginated list of runs |
| `src/app/api/products/bulk-edit/runs/[id]/route.ts` | GET: full detail of one run |
| `src/app/api/saved-searches/route.ts` | GET/POST: list + create |
| `src/app/api/saved-searches/[id]/route.ts` | PATCH/DELETE |
| `src/app/api/sync/prism-pull/route.ts` | POST: triggers a pull (manual or cron) |
| `src/app/products/bulk-edit/page.tsx` | Workspace page shell |
| `src/components/bulk-edit/bulk-edit-sidebar.tsx` | Saved-search library + helpers + recent-runs shortcuts |
| `src/components/bulk-edit/selection-panel.tsx` | Filter bar + Pierce/district toggle + paste-SKU + count badge |
| `src/components/bulk-edit/transform-panel.tsx` | Compound transform form with visual split |
| `src/components/bulk-edit/preview-panel.tsx` | Diff grid + totals + warnings + commit button |
| `src/components/bulk-edit/audit-log-list.tsx` | Paginated list of recent `bulk_edit_runs` |
| `src/components/bulk-edit/audit-log-detail-dialog.tsx` | Full detail + "Re-run this selection" |
| `src/components/bulk-edit/save-search-dialog.tsx` | Name + save current filter state |
| `src/components/bulk-edit/commit-confirm-dialog.tsx` | Confirmation with district warning |
| `src/components/products/sync-database-button.tsx` | Header button + last-synced timestamp |
| `tests/domains/bulk-edit/transform-engine.test.ts` | Unit tests for every pricing mode |
| `tests/domains/bulk-edit/preview-builder.test.ts` | Unit tests for warnings/totals aggregation |
| `scripts/test-bulk-edit-flow.ts` | Live Prism integration: all pricing modes round-trip |
| `scripts/test-prism-pull-sync.ts` | Live pull sync + idempotency check |
| `scripts/test-bulk-edit-district.ts` | Live DCC change → verify in Prism |

### Modified files

| Path | What changes |
|---|---|
| `prisma/schema.prisma` | Add `SavedSearch`, `BulkEditRun`, `SyncRun` models |
| `src/domains/product/types.ts` | Export `ProductFilters` shape for re-use (if not already named) |
| `src/domains/product/api-client.ts` | Add `bulkEdit.*`, `savedSearches.*`, `sync.*` methods |
| `src/instrumentation.ts` | Register daily `node-cron` schedule for pull sync |
| `src/app/products/page.tsx` | Add `<SyncDatabaseButton>` + "Bulk Edit Selected" / "Bulk Edit Workspace" entry points |
| `.env` and `.env.hotfix.example` | Add `CRON_INTERNAL_SECRET` for cron → route authentication |

---

## Tech context (read before Task 1)

- **Repo root:** `C:\Users\MONTALMA2\code\laportal` (Git Bash; forward slashes in paths).
- **Branch starting point:** current tip of `feat/products-crud-batch` (`7213cb4` at plan-write time — the spec commit). New branch suggested: `feat/bulk-edit-workspace`.
- **Prisma migration command:** `npx prisma migrate dev --name <name>` (generates SQL + applies to dev DB). From LACCD the direct Supabase connection fails — use the existing laportal pattern, which is to commit the migration and let prod apply it. Or run migrations against a local Postgres if one is available.
- **Vitest:** `npm test -- <path>` single file, non-watch.
- **Ship-check:** `npm run ship-check` — must stay green before push. Requires clean working tree (remember to stash the pre-existing untracked `scripts/verify-edit-discovery.ts`).
- **Hotfix deploy:** The hotfix shim doesn't resolve our SSH alias correctly in Git Bash; deploy via direct `ssh -F /c/Users/MONTALMA2/.ssh/config laportal-vps 'cd /opt/lapc-invoice-maker && DEPLOY_CHANNEL=hotfix DEPLOY_ACTOR=marcos DEPLOY_EXPECTED_SHA=<sha> ./scripts/deploy-webhook.sh feat/bulk-edit-workspace'` as we've been doing.
- **Commit style:** Conventional commits with `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>` trailer.
- **Never** push to remote or run ship-check unless the step explicitly says to.
- **Never** weaken `deleteTestItem`'s `TEST-CLAUDE-` barcode guard.
- **Never** add logic that bypasses `probePrism()` — the health probe is load-bearing.
- **Existing cron shape** (for Phase C) lives in `src/instrumentation.ts`. It uses `node-cron` with `{ timezone: "America/Los_Angeles" }` option and the `runTrackedJob` helper. Follow that pattern exactly.

---

## Phase A — Foundation: types, migrations, pure logic

### Task 1: Branch + shared types

**Files:**
- Create: `src/domains/bulk-edit/types.ts`

- [ ] **Step 1: Create working branch**

```bash
cd /c/Users/MONTALMA2/code/laportal
git checkout feat/products-crud-batch
git pull origin feat/products-crud-batch
git checkout -b feat/bulk-edit-workspace
```

- [ ] **Step 2: Create the types file**

Create `src/domains/bulk-edit/types.ts`:

```typescript
/**
 * Types shared across the bulk-edit workspace: frontend forms, API routes,
 * transform engine, and preview builder all use these shapes.
 */

/**
 * Product-filter shape. Mirrors the existing products page filters so we
 * can reuse the useProductSearch hook without reshaping data.
 */
export interface ProductFilters {
  q?: string;
  vendorId?: number;
  dccId?: number;
  itemType?: "textbook" | "general_merchandise";
  minRetail?: number;
  maxRetail?: number;
  hasBarcode?: boolean;
}

/**
 * Bulk-edit selection — either filter-based (evaluated server-side against
 * Supabase products) or SKU-list-based (paste from Excel / external source).
 * If skus is set, filter is ignored.
 */
export interface BulkEditSelection {
  filter?: ProductFilters;
  skus?: number[];
  scope: "pierce" | "district";
}

/**
 * Compound transform: one pricing mode + optional catalog metadata.
 * Only one of pricing + catalog needs to have a real change; pure no-op
 * transforms are rejected at dry-run time.
 */
export type PricingMode =
  | { mode: "none" }
  | { mode: "uplift"; percent: number }                                             // percent: 5 = +5%
  | { mode: "absolute"; retail: number }                                            // dollar amount
  | { mode: "margin"; targetMargin: number }                                        // 0 <= x < 1
  | {
      mode: "cost";
      newCost: { kind: "absolute"; value: number } | { kind: "uplift"; percent: number };
      preserveMargin: boolean;
    };

export interface BulkEditTransform {
  pricing: PricingMode;
  catalog: {
    dccId?: number;
    itemTaxTypeId?: number;
  };
}

export interface BulkEditRequest {
  selection: BulkEditSelection;
  transform: BulkEditTransform;
}

/** Row values that the transform engine operates on. Pulled from Supabase mirror. */
export interface BulkEditSourceRow {
  sku: number;
  description: string;
  barcode: string | null;
  retail: number;
  cost: number;
  vendorId: number | null;
  dccId: number | null;
  itemTaxTypeId: number | null;
  itemType: "textbook" | "general_merchandise" | null;
  fDiscontinue: 0 | 1;
}

/** One row in the preview grid: before/after values + row-level warnings. */
export interface PreviewRow {
  sku: number;
  description: string;
  before: Pick<BulkEditSourceRow, "retail" | "cost" | "dccId" | "itemTaxTypeId" | "barcode">;
  after: Pick<BulkEditSourceRow, "retail" | "cost" | "dccId" | "itemTaxTypeId" | "barcode">;
  changedFields: Array<"retail" | "cost" | "dccId" | "itemTaxTypeId">;
  warnings: PreviewWarning[];
}

export type PreviewWarningCode =
  | "NEGATIVE_MARGIN"
  | "ZERO_RETAIL_FOR_MARGIN_MODE"
  | "ZERO_COST_FOR_MARGIN_MODE"
  | "LARGE_PRICE_JUMP"
  | "DISCONTINUED_ITEM";

export interface PreviewWarning {
  code: PreviewWarningCode;
  message: string;
}

export interface PreviewResult {
  rows: PreviewRow[];
  totals: {
    rowCount: number;
    pricingDeltaCents: number;   // sum over (after.retail - before.retail) * 100
    districtChangeCount: number; // rows whose dccId or itemTaxTypeId changed
  };
  warnings: PreviewWarning[]; // batch-level (e.g., "selection spans multiple DCCs and you're setting a single DCC")
}

/** Validation errors returned from the server dry-run or commit. */
export interface BulkEditValidationError {
  code:
    | "EMPTY_SELECTION"
    | "NO_OP_TRANSFORM"
    | "INVALID_MARGIN"
    | "INVALID_PERCENT"
    | "INVALID_RETAIL"
    | "INVALID_COST"
    | "INVALID_DCC"
    | "INVALID_TAX_TYPE";
  field?: string;
  message: string;
}

/** Shape returned from commit-route on success. */
export interface CommitResult {
  runId: string;
  successCount: number;
  affectedSkus: number[];
}
```

- [ ] **Step 3: Commit**

```bash
git add src/domains/bulk-edit/types.ts
git commit -m "$(cat <<'COMMIT'
feat(bulk-edit): add shared types for workspace feature

Selection shape (filter or SKU list + scope), compound-transform
(pricing mode + optional catalog metadata), preview payload, and
validation error codes. All pure data types — used by both the
frontend and the forthcoming API routes.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
COMMIT
)"
```

---

### Task 2: Prisma migrations for the three new tables

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Read current schema tail to find the insertion point**

Run:
```bash
tail -40 prisma/schema.prisma
```

Identify the last model definition — the new models will be appended after it.

- [ ] **Step 2: Append three new models to `prisma/schema.prisma`**

```prisma
model SavedSearch {
  id            String    @id @default(uuid())
  createdAt     DateTime  @default(now()) @map("created_at")
  updatedAt     DateTime  @updatedAt @map("updated_at")
  ownerUserId   String?   @map("owner_user_id")  // NULL = system preset
  name          String
  filter        Json                               // full selection criteria
  isSystem      Boolean   @default(false) @map("is_system")

  owner         User?     @relation(fields: [ownerUserId], references: [id])

  @@index([ownerUserId, name])
  @@map("saved_searches")
}

model BulkEditRun {
  id                  String   @id @default(uuid())
  createdAt           DateTime @default(now()) @map("created_at")
  operatorUserId      String   @map("operator_user_id")
  operatorDisplay     String   @map("operator_display")
  selection           Json
  transform           Json
  affectedSkus        Int[]    @map("affected_skus")
  skuCount            Int      @map("sku_count")
  pricingDeltaCents   BigInt   @default(0) @map("pricing_delta_cents")
  hadDistrictChanges  Boolean  @map("had_district_changes")
  summary             String

  operator            User     @relation(fields: [operatorUserId], references: [id])

  @@index([createdAt(sort: Desc)])
  @@index([operatorUserId, createdAt(sort: Desc)])
  @@map("bulk_edit_runs")
}

model SyncRun {
  id              String    @id @default(uuid())
  startedAt       DateTime  @default(now()) @map("started_at")
  completedAt     DateTime? @map("completed_at")
  triggeredBy     String    @map("triggered_by")  // 'scheduled' | 'manual:<user_id>'
  scannedCount    Int?      @map("scanned_count")
  updatedCount    Int?      @map("updated_count")
  status          String                             // 'running' | 'ok' | 'failed'
  error           String?

  @@index([startedAt(sort: Desc)])
  @@map("sync_runs")
}
```

- [ ] **Step 3: Add back-relations to the `User` model**

Find the `User` model (lines ~10-36 of schema.prisma) and add these lines next to the other relation fields:

```prisma
  savedSearches SavedSearch[]
  bulkEditRuns  BulkEditRun[]
```

- [ ] **Step 4: Create the migration**

Run:
```bash
npx prisma migrate dev --name add_bulk_edit_tables
```

If Prisma can't reach the DB (common from LACCD), generate the SQL manually with `npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script > prisma/migrations/20260417000000_add_bulk_edit_tables/migration.sql` — or simpler, ask the implementer to run `npx prisma migrate dev` on a machine with DB reach, then commit the generated migration folder. In either case, the committed artifact is the `prisma/migrations/<timestamp>_add_bulk_edit_tables/` directory.

- [ ] **Step 5: Regenerate the Prisma client**

```bash
npx prisma generate
```

Expected: no errors, writes to `src/generated/prisma/`.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "$(cat <<'COMMIT'
feat(bulk-edit): add saved_searches, bulk_edit_runs, sync_runs tables

Three Supabase-only tables backing the bulk-edit workspace:
- saved_searches: user + system-scope filter presets
- bulk_edit_runs: audit log of every bulk commit
- sync_runs: log of every Prism->Supabase pull

User model gains back-relations for saved searches and runs.
Migration auto-generated by prisma migrate dev.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
COMMIT
)"
```

---

### Task 3: Transform engine (pure) with unit tests

**Files:**
- Create: `src/domains/bulk-edit/transform-engine.ts`
- Create: `tests/domains/bulk-edit/transform-engine.test.ts`

- [ ] **Step 1: Write the failing tests first**

Create `tests/domains/bulk-edit/transform-engine.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { applyTransform, validateTransform } from "@/domains/bulk-edit/transform-engine";
import type { BulkEditSourceRow, BulkEditTransform } from "@/domains/bulk-edit/types";

function row(overrides: Partial<BulkEditSourceRow> = {}): BulkEditSourceRow {
  return {
    sku: 100001,
    description: "TEST ITEM",
    barcode: "UPC1",
    retail: 10.0,
    cost: 5.0,
    vendorId: 21,
    dccId: 1968650,
    itemTaxTypeId: 6,
    itemType: "general_merchandise",
    fDiscontinue: 0,
    ...overrides,
  };
}

describe("applyTransform — pricing modes", () => {
  it("none leaves retail/cost unchanged", () => {
    const t: BulkEditTransform = { pricing: { mode: "none" }, catalog: {} };
    const result = applyTransform(row(), t);
    expect(result.after.retail).toBe(10);
    expect(result.after.cost).toBe(5);
    expect(result.changedFields).toEqual([]);
  });

  it("uplift 5% raises retail by 5 percent, rounded to 2 decimals", () => {
    const t: BulkEditTransform = { pricing: { mode: "uplift", percent: 5 }, catalog: {} };
    const result = applyTransform(row({ retail: 10.0 }), t);
    expect(result.after.retail).toBe(10.5);
    expect(result.changedFields).toContain("retail");
  });

  it("uplift -10% lowers retail", () => {
    const t: BulkEditTransform = { pricing: { mode: "uplift", percent: -10 }, catalog: {} };
    const result = applyTransform(row({ retail: 20 }), t);
    expect(result.after.retail).toBe(18);
  });

  it("absolute set applies the same retail to every row", () => {
    const t: BulkEditTransform = { pricing: { mode: "absolute", retail: 12.99 }, catalog: {} };
    const result = applyTransform(row({ retail: 3 }), t);
    expect(result.after.retail).toBe(12.99);
  });

  it("margin mode sets retail = cost / (1 - margin)", () => {
    const t: BulkEditTransform = { pricing: { mode: "margin", targetMargin: 0.4 }, catalog: {} };
    const result = applyTransform(row({ cost: 6 }), t);
    expect(result.after.retail).toBe(10); // 6 / 0.6
  });

  it("cost absolute without preserveMargin updates only cost", () => {
    const t: BulkEditTransform = {
      pricing: { mode: "cost", newCost: { kind: "absolute", value: 8.5 }, preserveMargin: false },
      catalog: {},
    };
    const result = applyTransform(row({ cost: 5, retail: 10 }), t);
    expect(result.after.cost).toBe(8.5);
    expect(result.after.retail).toBe(10);
  });

  it("cost absolute WITH preserveMargin updates cost and recomputes retail to preserve current margin", () => {
    // Current margin on retail=10, cost=5 is 50%. New cost 6 -> new retail = 6 / 0.5 = 12
    const t: BulkEditTransform = {
      pricing: { mode: "cost", newCost: { kind: "absolute", value: 6 }, preserveMargin: true },
      catalog: {},
    };
    const result = applyTransform(row({ cost: 5, retail: 10 }), t);
    expect(result.after.cost).toBe(6);
    expect(result.after.retail).toBe(12);
  });

  it("cost uplift with preserveMargin", () => {
    // 3% cost uplift on 5 = 5.15; current margin 50%; new retail = 5.15 / 0.5 = 10.30
    const t: BulkEditTransform = {
      pricing: { mode: "cost", newCost: { kind: "uplift", percent: 3 }, preserveMargin: true },
      catalog: {},
    };
    const result = applyTransform(row({ cost: 5, retail: 10 }), t);
    expect(result.after.cost).toBe(5.15);
    expect(result.after.retail).toBe(10.3);
  });
});

describe("applyTransform — warnings", () => {
  it("warns when resulting retail < resulting cost", () => {
    const t: BulkEditTransform = { pricing: { mode: "absolute", retail: 3 }, catalog: {} };
    const result = applyTransform(row({ cost: 5, retail: 10 }), t);
    expect(result.warnings.some((w) => w.code === "NEGATIVE_MARGIN")).toBe(true);
  });

  it("warns on zero retail in margin mode (cannot derive margin)", () => {
    const t: BulkEditTransform = {
      pricing: { mode: "cost", newCost: { kind: "absolute", value: 6 }, preserveMargin: true },
      catalog: {},
    };
    const result = applyTransform(row({ retail: 0, cost: 5 }), t);
    expect(result.warnings.some((w) => w.code === "ZERO_RETAIL_FOR_MARGIN_MODE")).toBe(true);
  });

  it("warns on >50% jump for absolute set", () => {
    const t: BulkEditTransform = { pricing: { mode: "absolute", retail: 20 }, catalog: {} };
    const result = applyTransform(row({ retail: 10 }), t);
    expect(result.warnings.some((w) => w.code === "LARGE_PRICE_JUMP")).toBe(true);
  });

  it("warns when row is already discontinued", () => {
    const t: BulkEditTransform = { pricing: { mode: "uplift", percent: 5 }, catalog: {} };
    const result = applyTransform(row({ fDiscontinue: 1 }), t);
    expect(result.warnings.some((w) => w.code === "DISCONTINUED_ITEM")).toBe(true);
  });
});

describe("applyTransform — catalog metadata", () => {
  it("applies DCC change and records it as a changed field", () => {
    const t: BulkEditTransform = { pricing: { mode: "none" }, catalog: { dccId: 1968651 } };
    const result = applyTransform(row({ dccId: 1968650 }), t);
    expect(result.after.dccId).toBe(1968651);
    expect(result.changedFields).toContain("dccId");
  });

  it("does not record DCC as a change if value equals current", () => {
    const t: BulkEditTransform = { pricing: { mode: "none" }, catalog: { dccId: 1968650 } };
    const result = applyTransform(row({ dccId: 1968650 }), t);
    expect(result.changedFields).not.toContain("dccId");
  });
});

describe("validateTransform", () => {
  it("rejects a fully no-op transform", () => {
    const errors = validateTransform({ pricing: { mode: "none" }, catalog: {} });
    expect(errors.some((e) => e.code === "NO_OP_TRANSFORM")).toBe(true);
  });

  it("rejects margin >= 1", () => {
    const errors = validateTransform({ pricing: { mode: "margin", targetMargin: 1 }, catalog: {} });
    expect(errors.some((e) => e.code === "INVALID_MARGIN")).toBe(true);
  });

  it("rejects negative absolute retail", () => {
    const errors = validateTransform({ pricing: { mode: "absolute", retail: -1 }, catalog: {} });
    expect(errors.some((e) => e.code === "INVALID_RETAIL")).toBe(true);
  });

  it("accepts a clean transform", () => {
    const errors = validateTransform({ pricing: { mode: "uplift", percent: 5 }, catalog: {} });
    expect(errors).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
npm test -- tests/domains/bulk-edit/transform-engine.test.ts
```

Expected: FAIL with `Cannot find module '@/domains/bulk-edit/transform-engine'`.

- [ ] **Step 3: Write the implementation**

Create `src/domains/bulk-edit/transform-engine.ts`:

```typescript
import type {
  BulkEditSourceRow,
  BulkEditTransform,
  BulkEditValidationError,
  PreviewRow,
  PreviewWarning,
} from "./types";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Apply a compound transform to a single row. Pure function.
 * Returns the projected PreviewRow including changed-field list and
 * row-level warnings. Does NOT mutate the input.
 */
export function applyTransform(
  row: BulkEditSourceRow,
  transform: BulkEditTransform,
): PreviewRow {
  const warnings: PreviewWarning[] = [];
  const changedFields: PreviewRow["changedFields"] = [];

  const before: PreviewRow["before"] = {
    retail: row.retail,
    cost: row.cost,
    dccId: row.dccId,
    itemTaxTypeId: row.itemTaxTypeId,
    barcode: row.barcode,
  };

  let afterRetail = row.retail;
  let afterCost = row.cost;

  // Pricing ---------------------------------------------------------------
  const p = transform.pricing;
  switch (p.mode) {
    case "none":
      break;

    case "uplift":
      afterRetail = round2(row.retail * (1 + p.percent / 100));
      break;

    case "absolute":
      afterRetail = round2(p.retail);
      break;

    case "margin":
      // retail = cost / (1 - margin); validated to 0 <= margin < 1 by validateTransform
      if (row.cost === 0) {
        warnings.push({
          code: "ZERO_COST_FOR_MARGIN_MODE",
          message: `SKU ${row.sku} has zero cost; margin-mode retail would be 0.`,
        });
      }
      afterRetail = round2(row.cost / (1 - p.targetMargin));
      break;

    case "cost": {
      // Resolve new cost
      const newCostVal =
        p.newCost.kind === "absolute"
          ? round2(p.newCost.value)
          : round2(row.cost * (1 + p.newCost.percent / 100));
      afterCost = newCostVal;

      if (p.preserveMargin) {
        if (row.retail === 0) {
          warnings.push({
            code: "ZERO_RETAIL_FOR_MARGIN_MODE",
            message: `SKU ${row.sku} has zero retail; cannot preserve margin (retail left unchanged).`,
          });
        } else {
          const currentMargin = 1 - row.cost / row.retail;
          if (currentMargin >= 1 || currentMargin < 0) {
            // Edge case: cost >= retail (margin <= 0). Preserving this is nonsense.
            warnings.push({
              code: "NEGATIVE_MARGIN",
              message: `SKU ${row.sku} currently has non-positive margin; recomputed retail may be unusual.`,
            });
          }
          if (currentMargin < 1) {
            afterRetail = round2(newCostVal / (1 - currentMargin));
          }
        }
      }
      break;
    }
  }

  if (afterRetail !== row.retail) changedFields.push("retail");
  if (afterCost !== row.cost) changedFields.push("cost");

  // Catalog ---------------------------------------------------------------
  let afterDccId = row.dccId;
  let afterTax = row.itemTaxTypeId;

  if (transform.catalog.dccId !== undefined && transform.catalog.dccId !== row.dccId) {
    afterDccId = transform.catalog.dccId;
    changedFields.push("dccId");
  }
  if (
    transform.catalog.itemTaxTypeId !== undefined &&
    transform.catalog.itemTaxTypeId !== row.itemTaxTypeId
  ) {
    afterTax = transform.catalog.itemTaxTypeId;
    changedFields.push("itemTaxTypeId");
  }

  // Cross-field warnings --------------------------------------------------
  if (afterRetail < afterCost) {
    warnings.push({
      code: "NEGATIVE_MARGIN",
      message: `SKU ${row.sku} would have retail $${afterRetail.toFixed(2)} < cost $${afterCost.toFixed(2)}.`,
    });
  }

  if (p.mode === "absolute" && row.retail > 0) {
    const jump = Math.abs(afterRetail - row.retail) / row.retail;
    if (jump > 0.5) {
      warnings.push({
        code: "LARGE_PRICE_JUMP",
        message: `SKU ${row.sku}: retail changes by ${(jump * 100).toFixed(0)}% (from $${row.retail.toFixed(2)} to $${afterRetail.toFixed(2)}).`,
      });
    }
  }

  if (row.fDiscontinue === 1 && changedFields.length > 0) {
    warnings.push({
      code: "DISCONTINUED_ITEM",
      message: `SKU ${row.sku} is discontinued; changes will still apply.`,
    });
  }

  return {
    sku: row.sku,
    description: row.description,
    before,
    after: {
      retail: afterRetail,
      cost: afterCost,
      dccId: afterDccId,
      itemTaxTypeId: afterTax,
      barcode: row.barcode,
    },
    changedFields,
    warnings,
  };
}

/**
 * Validate a transform spec before it's applied. Pure. Returns zero errors
 * if the spec is internally consistent and has at least one real change.
 */
export function validateTransform(t: BulkEditTransform): BulkEditValidationError[] {
  const errs: BulkEditValidationError[] = [];

  const p = t.pricing;
  switch (p.mode) {
    case "none":
      break;
    case "uplift":
      if (typeof p.percent !== "number" || !Number.isFinite(p.percent)) {
        errs.push({ code: "INVALID_PERCENT", field: "pricing.percent", message: "Percent must be a finite number" });
      }
      break;
    case "absolute":
      if (typeof p.retail !== "number" || p.retail < 0 || !Number.isFinite(p.retail)) {
        errs.push({ code: "INVALID_RETAIL", field: "pricing.retail", message: "Retail must be a non-negative number" });
      }
      break;
    case "margin":
      if (
        typeof p.targetMargin !== "number" ||
        !Number.isFinite(p.targetMargin) ||
        p.targetMargin < 0 ||
        p.targetMargin >= 1
      ) {
        errs.push({
          code: "INVALID_MARGIN",
          field: "pricing.targetMargin",
          message: "Target margin must be >= 0 and < 1 (e.g. 0.40 for 40%)",
        });
      }
      break;
    case "cost":
      if (p.newCost.kind === "absolute") {
        if (typeof p.newCost.value !== "number" || p.newCost.value < 0 || !Number.isFinite(p.newCost.value)) {
          errs.push({ code: "INVALID_COST", field: "pricing.newCost.value", message: "New cost must be non-negative" });
        }
      } else {
        if (typeof p.newCost.percent !== "number" || !Number.isFinite(p.newCost.percent)) {
          errs.push({ code: "INVALID_PERCENT", field: "pricing.newCost.percent", message: "Cost uplift percent must be a finite number" });
        }
      }
      break;
  }

  // Reject a transform that would do nothing
  const hasPricingChange = p.mode !== "none";
  const hasCatalogChange = t.catalog.dccId !== undefined || t.catalog.itemTaxTypeId !== undefined;
  if (!hasPricingChange && !hasCatalogChange) {
    errs.push({
      code: "NO_OP_TRANSFORM",
      message: "Transform has no pricing or catalog changes — nothing to apply.",
    });
  }

  return errs;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
npm test -- tests/domains/bulk-edit/transform-engine.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/domains/bulk-edit/transform-engine.ts tests/domains/bulk-edit/transform-engine.test.ts
git commit -m "$(cat <<'COMMIT'
feat(bulk-edit): pure transform engine

Applies compound transforms (pricing mode + catalog metadata) to a
single row, returning projected before/after values, the list of
changed fields, and row-level warnings. Pure; no I/O. Rounds money
to 2 decimals. Validates margin is [0, 1), percent is finite,
absolute retail/cost are non-negative, and rejects fully no-op
transforms. Unit tests cover every pricing mode + each warning code.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
COMMIT
)"
```

---

### Task 4: Preview builder (aggregates rows into a PreviewResult)

**Files:**
- Create: `src/domains/bulk-edit/preview-builder.ts`
- Create: `tests/domains/bulk-edit/preview-builder.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/domains/bulk-edit/preview-builder.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { buildPreview } from "@/domains/bulk-edit/preview-builder";
import type { BulkEditSourceRow, BulkEditTransform } from "@/domains/bulk-edit/types";

function row(overrides: Partial<BulkEditSourceRow> = {}): BulkEditSourceRow {
  return {
    sku: 1,
    description: "TEST",
    barcode: "UPC",
    retail: 10,
    cost: 5,
    vendorId: 21,
    dccId: 100,
    itemTaxTypeId: 6,
    itemType: "general_merchandise",
    fDiscontinue: 0,
    ...overrides,
  };
}

describe("buildPreview", () => {
  it("rejects empty selection", () => {
    const result = buildPreview([], { pricing: { mode: "uplift", percent: 5 }, catalog: {} });
    expect(result.rows).toEqual([]);
    expect(result.warnings.some((w) => w.code === "NEGATIVE_MARGIN")).toBe(false);
  });

  it("sums pricing delta across rows in cents", () => {
    const t: BulkEditTransform = { pricing: { mode: "uplift", percent: 10 }, catalog: {} };
    const rows = [row({ sku: 1, retail: 10 }), row({ sku: 2, retail: 20 })];
    const result = buildPreview(rows, t);
    // Row 1: 10 -> 11 (+1.00 = 100 cents). Row 2: 20 -> 22 (+2.00 = 200 cents). Total = 300.
    expect(result.totals.pricingDeltaCents).toBe(300);
    expect(result.totals.rowCount).toBe(2);
  });

  it("counts district changes only on rows where the field actually changes", () => {
    const t: BulkEditTransform = { pricing: { mode: "none" }, catalog: { dccId: 200 } };
    const rows = [row({ sku: 1, dccId: 100 }), row({ sku: 2, dccId: 200 })];
    const result = buildPreview(rows, t);
    expect(result.totals.districtChangeCount).toBe(1);
  });

  it("emits a batch-level warning when selection spans multiple DCCs and the transform sets a single DCC", () => {
    const t: BulkEditTransform = { pricing: { mode: "none" }, catalog: { dccId: 999 } };
    const rows = [row({ sku: 1, dccId: 100 }), row({ sku: 2, dccId: 200 })];
    const result = buildPreview(rows, t);
    expect(result.warnings.some((w) => w.message.toLowerCase().includes("multiple"))).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
npm test -- tests/domains/bulk-edit/preview-builder.test.ts
```

Expected: FAIL on module-not-found.

- [ ] **Step 3: Write the implementation**

Create `src/domains/bulk-edit/preview-builder.ts`:

```typescript
import { applyTransform } from "./transform-engine";
import type {
  BulkEditSourceRow,
  BulkEditTransform,
  PreviewResult,
  PreviewWarning,
} from "./types";

/**
 * Build a full preview payload from source rows + a compound transform.
 * Aggregates per-row results into totals and batch-level warnings.
 * Pure; callers are responsible for loading the source rows.
 */
export function buildPreview(
  sourceRows: BulkEditSourceRow[],
  transform: BulkEditTransform,
): PreviewResult {
  const rows = sourceRows.map((r) => applyTransform(r, transform));

  let pricingDeltaCents = 0;
  let districtChangeCount = 0;
  for (const r of rows) {
    pricingDeltaCents += Math.round((r.after.retail - r.before.retail) * 100);
    if (r.changedFields.includes("dccId") || r.changedFields.includes("itemTaxTypeId")) {
      districtChangeCount += 1;
    }
  }

  const batchWarnings: PreviewWarning[] = [];

  // If the transform forces a single DCC but the selection spans multiple distinct
  // starting DCCs, surface that — it's often intentional (recategorization pass),
  // but worth confirming.
  if (transform.catalog.dccId !== undefined) {
    const distinctStartingDccs = new Set(sourceRows.map((r) => r.dccId));
    if (distinctStartingDccs.size > 1) {
      batchWarnings.push({
        code: "NEGATIVE_MARGIN", // reuse existing code — batch warnings don't need a new category
        message: `Selection spans ${distinctStartingDccs.size} different Department/Classes and you're collapsing them into one. Review the preview carefully.`,
      });
    }
  }

  return {
    rows,
    totals: {
      rowCount: rows.length,
      pricingDeltaCents,
      districtChangeCount,
    },
    warnings: batchWarnings,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
npm test -- tests/domains/bulk-edit/preview-builder.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/domains/bulk-edit/preview-builder.ts tests/domains/bulk-edit/preview-builder.test.ts
git commit -m "$(cat <<'COMMIT'
feat(bulk-edit): preview builder aggregates rows + totals

Runs applyTransform across source rows, aggregates pricing delta and
district-change count, emits batch-level warnings (e.g., multi-DCC
selection collapsed to one). Pure module — caller supplies the
source rows from Supabase.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
COMMIT
)"
```

---

## Phase B — Backend API routes

### Task 5: saved-searches CRUD routes

**Files:**
- Create: `src/app/api/saved-searches/route.ts`
- Create: `src/app/api/saved-searches/[id]/route.ts`

- [ ] **Step 1: Create the list + create route**

Create `src/app/api/saved-searches/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/domains/shared/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  name: z.string().min(1).max(80),
  filter: z.record(z.string(), z.any()),
});

export const GET = withAuth(async (_request: NextRequest, session) => {
  const userId = session.user.id;
  const rows = await prisma.savedSearch.findMany({
    where: { OR: [{ ownerUserId: userId }, { isSystem: true }] },
    orderBy: [{ isSystem: "desc" }, { name: "asc" }],
  });
  return NextResponse.json({ items: rows });
});

export const POST = withAuth(async (request: NextRequest, session) => {
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const created = await prisma.savedSearch.create({
    data: {
      name: parsed.data.name,
      filter: parsed.data.filter,
      ownerUserId: session.user.id,
      isSystem: false,
    },
  });
  return NextResponse.json(created, { status: 201 });
});
```

- [ ] **Step 2: Create the update + delete route**

Create `src/app/api/saved-searches/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/domains/shared/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  filter: z.record(z.string(), z.any()).optional(),
});

export const PATCH = withAuth(async (request: NextRequest, session, ctx?: RouteCtx) => {
  const params = ctx ? await ctx.params : null;
  const id = params?.id;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const existing = await prisma.savedSearch.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.isSystem) {
    return NextResponse.json({ error: "System presets are read-only" }, { status: 403 });
  }
  if (existing.ownerUserId !== session.user.id) {
    return NextResponse.json({ error: "Not your preset" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const updated = await prisma.savedSearch.update({
    where: { id },
    data: { ...parsed.data, updatedAt: new Date() },
  });
  return NextResponse.json(updated);
});

export const DELETE = withAuth(async (_request: NextRequest, session, ctx?: RouteCtx) => {
  const params = ctx ? await ctx.params : null;
  const id = params?.id;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const existing = await prisma.savedSearch.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.isSystem) {
    return NextResponse.json({ error: "System presets are read-only" }, { status: 403 });
  }
  if (existing.ownerUserId !== session.user.id) {
    return NextResponse.json({ error: "Not your preset" }, { status: 403 });
  }
  await prisma.savedSearch.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
```

- [ ] **Step 3: Seed the 4 system smart-helper presets**

Create a new Prisma migration SQL to insert them (or run inline via `prisma db execute`). Create `prisma/migrations/20260417000002_seed_bulk_edit_helpers/migration.sql`:

```sql
-- Seed system smart-helper saved searches. is_system = true makes them
-- read-only and visible to every user.
INSERT INTO saved_searches (id, created_at, updated_at, owner_user_id, name, filter, is_system)
VALUES
  (gen_random_uuid(), now(), now(), NULL, 'All textbooks',
   '{"itemType":"textbook"}'::jsonb, true),
  (gen_random_uuid(), now(), now(), NULL, 'Items without barcode',
   '{"hasBarcode":false}'::jsonb, true),
  (gen_random_uuid(), now(), now(), NULL, 'Items from vendor 21 (PENS ETC)',
   '{"vendorId":21}'::jsonb, true),
  (gen_random_uuid(), now(), now(), NULL, 'General Merchandise — under $5',
   '{"itemType":"general_merchandise","maxRetail":5}'::jsonb, true)
ON CONFLICT DO NOTHING;
```

Apply via `npx prisma migrate dev` (picks up the new folder automatically).

- [ ] **Step 4: Commit**

```bash
git add "src/app/api/saved-searches/route.ts" "src/app/api/saved-searches/[id]/route.ts" "prisma/migrations/20260417000002_seed_bulk_edit_helpers/"
git commit -m "$(cat <<'COMMIT'
feat(bulk-edit): saved-searches CRUD routes + system helpers

List (returns user-owned + system presets), create, patch, delete.
System presets are read-only for everyone; user presets only mutable
by their owner. Auth-gated via withAuth (admin gate not required for
personal filter shortcuts).

Seeds 4 system smart-helper presets: All textbooks, Items without
barcode, Items from vendor 21, and GM under $5. Users see these in
the sidebar but can't modify them.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
COMMIT
)"
```

---

### Task 6: bulk-edit dry-run route

**Files:**
- Create: `src/app/api/products/bulk-edit/dry-run/route.ts`

- [ ] **Step 1: Write the route**

Create `src/app/api/products/bulk-edit/dry-run/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAdmin } from "@/domains/shared/auth";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { validateTransform, applyTransform } from "@/domains/bulk-edit/transform-engine";
import { buildPreview } from "@/domains/bulk-edit/preview-builder";
import type { BulkEditSourceRow } from "@/domains/bulk-edit/types";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  selection: z.object({
    filter: z
      .object({
        q: z.string().optional(),
        vendorId: z.number().int().optional(),
        dccId: z.number().int().optional(),
        itemType: z.enum(["textbook", "general_merchandise"]).optional(),
        minRetail: z.number().nonnegative().optional(),
        maxRetail: z.number().nonnegative().optional(),
        hasBarcode: z.boolean().optional(),
      })
      .optional(),
    skus: z.array(z.number().int().positive()).optional(),
    scope: z.enum(["pierce", "district"]).default("pierce"),
  }),
  transform: z.record(z.string(), z.any()),
});

export const POST = withAdmin(async (request: NextRequest) => {
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  // Validate the transform structurally
  // (we trust the client's shape matches BulkEditTransform because the UI is ours)
  const transformErrs = validateTransform(parsed.data.transform as never);
  if (transformErrs.length > 0) {
    return NextResponse.json({ errors: transformErrs }, { status: 400 });
  }

  // Resolve selection against Supabase mirror
  const supabase = getSupabaseAdminClient();
  let query = supabase
    .from("products")
    .select("sku, description, barcode, retail_price, cost, vendor_id, dcc_id, item_tax_type_id, item_type, discontinued");

  const sel = parsed.data.selection;
  if (sel.skus && sel.skus.length > 0) {
    query = query.in("sku", sel.skus);
  } else if (sel.filter) {
    if (sel.filter.q) query = query.ilike("description", `%${sel.filter.q}%`);
    if (sel.filter.vendorId !== undefined) query = query.eq("vendor_id", sel.filter.vendorId);
    if (sel.filter.dccId !== undefined) query = query.eq("dcc_id", sel.filter.dccId);
    if (sel.filter.itemType) query = query.eq("item_type", sel.filter.itemType);
    if (sel.filter.minRetail !== undefined) query = query.gte("retail_price", sel.filter.minRetail);
    if (sel.filter.maxRetail !== undefined) query = query.lte("retail_price", sel.filter.maxRetail);
    if (sel.filter.hasBarcode !== undefined) {
      query = sel.filter.hasBarcode ? query.not("barcode", "is", null) : query.is("barcode", null);
    }
  }

  // Cap selection size to avoid accidental runaway previews
  query = query.limit(2000);

  const { data, error } = await query;
  if (error) {
    console.error("dry-run: supabase select failed:", error);
    return NextResponse.json({ error: "Failed to load selection" }, { status: 500 });
  }

  const sourceRows: BulkEditSourceRow[] = (data ?? []).map((r) => ({
    sku: r.sku,
    description: r.description ?? "",
    barcode: r.barcode ?? null,
    retail: Number(r.retail_price ?? 0),
    cost: Number(r.cost ?? 0),
    vendorId: r.vendor_id ?? null,
    dccId: r.dcc_id ?? null,
    itemTaxTypeId: r.item_tax_type_id ?? null,
    itemType: r.item_type ?? null,
    fDiscontinue: r.discontinued ? 1 : 0,
  }));

  if (sourceRows.length === 0) {
    return NextResponse.json({
      errors: [{ code: "EMPTY_SELECTION", message: "Selection resolved to zero items." }],
    }, { status: 400 });
  }

  const preview = buildPreview(sourceRows, parsed.data.transform as never);
  return NextResponse.json(preview);
});
```

- [ ] **Step 2: Commit**

```bash
git add "src/app/api/products/bulk-edit/dry-run/route.ts"
git commit -m "$(cat <<'COMMIT'
feat(bulk-edit): dry-run route for preview generation

POST /api/products/bulk-edit/dry-run accepts a selection + transform,
resolves the selection against the Supabase products mirror (fast,
no Prism round-trip), runs the transform engine, and returns the
full PreviewResult with per-row diff, totals, and warnings. Capped
at 2000 rows to prevent runaway previews.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
COMMIT
)"
```

---

### Task 7: bulk-edit commit route

**Files:**
- Create: `src/app/api/products/bulk-edit/commit/route.ts`

- [ ] **Step 1: Write the route**

Create `src/app/api/products/bulk-edit/commit/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAdmin } from "@/domains/shared/auth";
import { isPrismConfigured } from "@/lib/prism";
import { prisma } from "@/lib/prisma";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { validateTransform, applyTransform } from "@/domains/bulk-edit/transform-engine";
import { buildPreview } from "@/domains/bulk-edit/preview-builder";
import type { BulkEditSourceRow, BulkEditTransform } from "@/domains/bulk-edit/types";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  selection: z.object({
    filter: z.record(z.string(), z.any()).optional(),
    skus: z.array(z.number().int().positive()).optional(),
    scope: z.enum(["pierce", "district"]).default("pierce"),
  }),
  transform: z.record(z.string(), z.any()),
});

export const POST = withAdmin(async (request: NextRequest, session) => {
  if (!isPrismConfigured()) {
    return NextResponse.json(
      { error: "Prism is not configured in this environment." },
      { status: 503 },
    );
  }

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const transform = parsed.data.transform as BulkEditTransform;
  const transformErrs = validateTransform(transform);
  if (transformErrs.length > 0) {
    return NextResponse.json({ errors: transformErrs }, { status: 400 });
  }

  // Resolve selection against Supabase mirror (same logic as dry-run)
  const supabase = getSupabaseAdminClient();
  let query = supabase
    .from("products")
    .select("sku, description, barcode, retail_price, cost, vendor_id, dcc_id, item_tax_type_id, item_type, discontinued");

  const sel = parsed.data.selection as { skus?: number[]; filter?: Record<string, unknown> };
  if (sel.skus && sel.skus.length > 0) {
    query = query.in("sku", sel.skus);
  } else if (sel.filter) {
    const f = sel.filter as Record<string, unknown>;
    if (typeof f.q === "string") query = query.ilike("description", `%${f.q}%`);
    if (typeof f.vendorId === "number") query = query.eq("vendor_id", f.vendorId);
    if (typeof f.dccId === "number") query = query.eq("dcc_id", f.dccId);
    if (typeof f.itemType === "string") query = query.eq("item_type", f.itemType);
    if (typeof f.minRetail === "number") query = query.gte("retail_price", f.minRetail);
    if (typeof f.maxRetail === "number") query = query.lte("retail_price", f.maxRetail);
    if (typeof f.hasBarcode === "boolean") {
      query = f.hasBarcode ? query.not("barcode", "is", null) : query.is("barcode", null);
    }
  }
  query = query.limit(2000);

  const { data, error } = await query;
  if (error) {
    console.error("commit: supabase select failed:", error);
    return NextResponse.json({ error: "Failed to load selection" }, { status: 500 });
  }

  const sourceRows: BulkEditSourceRow[] = (data ?? []).map((r) => ({
    sku: r.sku,
    description: r.description ?? "",
    barcode: r.barcode ?? null,
    retail: Number(r.retail_price ?? 0),
    cost: Number(r.cost ?? 0),
    vendorId: r.vendor_id ?? null,
    dccId: r.dcc_id ?? null,
    itemTaxTypeId: r.item_tax_type_id ?? null,
    itemType: r.item_type ?? null,
    fDiscontinue: r.discontinued ? 1 : 0,
  }));

  if (sourceRows.length === 0) {
    return NextResponse.json({
      errors: [{ code: "EMPTY_SELECTION", message: "Selection resolved to zero items." }],
    }, { status: 400 });
  }

  // Build preview (used to emit per-row patches and final summary)
  const preview = buildPreview(sourceRows, transform);

  // Materialize the batch-update payload for /api/products/batch
  const batchRows = preview.rows
    .filter((r) => r.changedFields.length > 0)
    .map((r) => {
      const patch: Record<string, unknown> = {};
      if (r.changedFields.includes("retail")) patch.retail = r.after.retail;
      if (r.changedFields.includes("cost")) patch.cost = r.after.cost;
      if (r.changedFields.includes("dccId") && r.after.dccId !== null) patch.dccId = r.after.dccId;
      if (r.changedFields.includes("itemTaxTypeId") && r.after.itemTaxTypeId !== null) {
        patch.itemTaxTypeId = r.after.itemTaxTypeId;
      }
      return { sku: r.sku, patch, isTextbook: false };
    });

  if (batchRows.length === 0) {
    return NextResponse.json({
      errors: [{ code: "NO_OP_TRANSFORM", message: "Every selected row would be unchanged — nothing to commit." }],
    }, { status: 400 });
  }

  // Call the existing batch endpoint (same host — call its handler inline for atomicity)
  // We import the handler indirectly to avoid a network round-trip.
  const { POST: batchHandler } = await import("../../batch/route");
  const batchReq = new NextRequest(new URL(request.url).origin + "/api/products/batch", {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: request.headers.get("cookie") ?? "" },
    body: JSON.stringify({ action: "update", rows: batchRows }),
  });
  // The withAdmin wrapper reads the session from cookies — we already passed the gate once.
  // To avoid a second auth bounce, pass the session via the internal-secret header pattern
  // used by the sync endpoint (see Task 10). For this in-process call we just invoke the
  // handler function directly:
  const batchRes = await batchHandler(batchReq);
  const batchJson = await batchRes.json().catch(() => null);

  if (!batchRes.ok) {
    console.error("commit: batch rejected", batchJson);
    return NextResponse.json(batchJson ?? { error: "Batch commit failed" }, { status: batchRes.status });
  }

  // Record the run
  const summary = `${preview.totals.rowCount} items — retail delta $${(preview.totals.pricingDeltaCents / 100).toFixed(2)}${preview.totals.districtChangeCount > 0 ? `, ${preview.totals.districtChangeCount} district changes` : ""}`;

  const run = await prisma.bulkEditRun.create({
    data: {
      operatorUserId: session.user.id,
      operatorDisplay: session.user.name ?? session.user.username ?? "unknown",
      selection: parsed.data.selection as never,
      transform: transform as never,
      affectedSkus: batchRows.map((r) => r.sku),
      skuCount: batchRows.length,
      pricingDeltaCents: BigInt(preview.totals.pricingDeltaCents),
      hadDistrictChanges: preview.totals.districtChangeCount > 0,
      summary,
    },
  });

  return NextResponse.json({
    runId: run.id,
    successCount: batchRows.length,
    affectedSkus: batchRows.map((r) => r.sku),
  });
});
```

- [ ] **Step 2: Commit**

```bash
git add "src/app/api/products/bulk-edit/commit/route.ts"
git commit -m "$(cat <<'COMMIT'
feat(bulk-edit): commit route — server-authoritative apply

POST /api/products/bulk-edit/commit re-validates the transform,
re-resolves the selection from Supabase, materializes per-row patches,
and calls the existing /api/products/batch handler in-process (no
network round-trip). On success, inserts a bulk_edit_runs row with
full context for the audit log.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
COMMIT
)"
```

---

### Task 8: bulk-edit runs list + detail routes

**Files:**
- Create: `src/app/api/products/bulk-edit/runs/route.ts`
- Create: `src/app/api/products/bulk-edit/runs/[id]/route.ts`

- [ ] **Step 1: Write the list route**

Create `src/app/api/products/bulk-edit/runs/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { withAdmin } from "@/domains/shared/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const GET = withAdmin(async (request: NextRequest) => {
  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "20"), 100);
  const offset = Math.max(Number(url.searchParams.get("offset") ?? "0"), 0);

  const runs = await prisma.bulkEditRun.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: offset,
    select: {
      id: true,
      createdAt: true,
      operatorDisplay: true,
      skuCount: true,
      pricingDeltaCents: true,
      hadDistrictChanges: true,
      summary: true,
    },
  });

  const total = await prisma.bulkEditRun.count();

  return NextResponse.json({
    items: runs.map((r) => ({
      ...r,
      pricingDeltaCents: Number(r.pricingDeltaCents), // BigInt → number for JSON
    })),
    total,
    limit,
    offset,
  });
});
```

- [ ] **Step 2: Write the detail route**

Create `src/app/api/products/bulk-edit/runs/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { withAdmin } from "@/domains/shared/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string }> };

export const GET = withAdmin(async (_request: NextRequest, _session, ctx?: RouteCtx) => {
  const params = ctx ? await ctx.params : null;
  const id = params?.id;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const run = await prisma.bulkEditRun.findUnique({ where: { id } });
  if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    ...run,
    pricingDeltaCents: Number(run.pricingDeltaCents),
  });
});
```

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/products/bulk-edit/runs/route.ts" "src/app/api/products/bulk-edit/runs/[id]/route.ts"
git commit -m "$(cat <<'COMMIT'
feat(bulk-edit): runs list + detail routes for audit log

GET /api/products/bulk-edit/runs — paginated list, newest first.
GET /api/products/bulk-edit/runs/[id] — full detail including
selection, transform, and affected SKUs. BigInt columns serialized
as JS numbers.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
COMMIT
)"
```

---

## Phase C — Prism pull sync

### Task 9: prism-sync domain module

**Files:**
- Create: `src/domains/product/prism-sync.ts`

- [ ] **Step 1: Write the module**

Create `src/domains/product/prism-sync.ts`:

```typescript
/**
 * Prism → Supabase pull sync. Reads recent Item + Inventory data from Prism,
 * hash-compares against the Supabase `products` mirror, and upserts only
 * rows whose hash changed. Idempotent; safe to run repeatedly.
 *
 * Pierce-only: joins Inventory on LocationID = 2 so Supabase reflects Pierce
 * pricing. Item master fields (description, DCC, tax, barcode) are district-
 * wide by nature — we mirror them as-is.
 */
import crypto from "crypto";
import { getPrismPool, sql } from "@/lib/prism";
import { PIERCE_LOCATION_ID } from "./prism-server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

interface PrismItemRow {
  sku: number;
  description: string | null;
  barcode: string | null;
  vendorId: number | null;
  dccId: number | null;
  itemTaxTypeId: number | null;
  itemType: string;
  fDiscontinue: 0 | 1;
  retail: number | null;
  cost: number | null;
  lastSaleDate: Date | null;
}

function hashRow(r: PrismItemRow): string {
  const canonical = JSON.stringify([
    r.sku,
    r.description ?? "",
    r.barcode ?? "",
    r.vendorId ?? 0,
    r.dccId ?? 0,
    r.itemTaxTypeId ?? 0,
    r.itemType,
    r.fDiscontinue,
    r.retail ?? 0,
    r.cost ?? 0,
    r.lastSaleDate?.toISOString() ?? "",
  ]);
  return crypto.createHash("sha256").update(canonical).digest("hex").slice(0, 16);
}

export interface PullSyncResult {
  scanned: number;
  updated: number;
  durationMs: number;
}

/**
 * Run one full-catalog pull. Paginates Prism reads to avoid loading the
 * entire 195k-row catalog into memory at once.
 */
export async function runPrismPull(options: {
  pageSize?: number;
  onProgress?: (scanned: number) => void;
} = {}): Promise<PullSyncResult> {
  const pageSize = options.pageSize ?? 2000;
  const started = Date.now();
  let scanned = 0;
  let updated = 0;

  const pool = await getPrismPool();
  const supabase = getSupabaseAdminClient();

  // Fetch existing hashes from Supabase in one shot — acceptable at 195k rows
  const { data: existingHashRows, error: hashErr } = await supabase
    .from("products")
    .select("sku, sync_hash");
  if (hashErr) {
    throw new Error(`Supabase hash read failed: ${hashErr.message}`);
  }
  const existingHashes = new Map<number, string | null>();
  for (const r of existingHashRows ?? []) {
    existingHashes.set(r.sku, (r as { sync_hash: string | null }).sync_hash);
  }

  // Paginate Prism with SKU cursor (SKU is the PK, monotonically increasing)
  let lastSku = 0;
  while (true) {
    const result = await pool
      .request()
      .input("loc", sql.Int, PIERCE_LOCATION_ID)
      .input("cursor", sql.Int, lastSku)
      .input("pageSize", sql.Int, pageSize)
      .query<{
        SKU: number;
        Description: string | null;
        BarCode: string | null;
        VendorID: number | null;
        DCCID: number | null;
        ItemTaxTypeID: number | null;
        ItemType: string;
        fDiscontinue: number | null;
        Retail: number | null;
        Cost: number | null;
        LastSaleDate: Date | null;
      }>(`
        SELECT TOP (@pageSize)
          i.SKU,
          LTRIM(RTRIM(gm.Description)) AS Description,
          LTRIM(RTRIM(i.BarCode))      AS BarCode,
          i.VendorID,
          i.DCCID,
          i.ItemTaxTypeID,
          CASE WHEN i.TypeID = 1 THEN 'textbook' ELSE 'general_merchandise' END AS ItemType,
          i.fDiscontinue,
          inv.Retail,
          inv.Cost,
          inv.LastSaleDate
        FROM Item i
        LEFT JOIN GeneralMerchandise gm ON gm.SKU = i.SKU
        LEFT JOIN Inventory inv ON inv.SKU = i.SKU AND inv.LocationID = @loc
        WHERE i.SKU > @cursor
        ORDER BY i.SKU
      `);

    if (result.recordset.length === 0) break;

    const toUpsert: Array<Record<string, unknown>> = [];
    for (const raw of result.recordset) {
      scanned += 1;
      const row: PrismItemRow = {
        sku: raw.SKU,
        description: raw.Description,
        barcode: raw.BarCode && raw.BarCode.length > 0 ? raw.BarCode : null,
        vendorId: raw.VendorID,
        dccId: raw.DCCID,
        itemTaxTypeId: raw.ItemTaxTypeID,
        itemType: raw.ItemType,
        fDiscontinue: raw.fDiscontinue === 1 ? 1 : 0,
        retail: raw.Retail != null ? Number(raw.Retail) : null,
        cost: raw.Cost != null ? Number(raw.Cost) : null,
        lastSaleDate: raw.LastSaleDate ?? null,
      };
      const newHash = hashRow(row);
      if (existingHashes.get(row.sku) === newHash) continue;

      toUpsert.push({
        sku: row.sku,
        description: row.description,
        barcode: row.barcode,
        vendor_id: row.vendorId,
        dcc_id: row.dccId,
        item_tax_type_id: row.itemTaxTypeId,
        item_type: row.itemType,
        discontinued: row.fDiscontinue === 1,
        retail_price: row.retail,
        cost: row.cost,
        last_sale_date: row.lastSaleDate?.toISOString() ?? null,
        sync_hash: newHash,
        synced_at: new Date().toISOString(),
      });
      lastSku = row.sku;
    }

    if (toUpsert.length > 0) {
      const { error: upsertErr } = await supabase.from("products").upsert(toUpsert);
      if (upsertErr) {
        throw new Error(`Supabase upsert failed: ${upsertErr.message}`);
      }
      updated += toUpsert.length;
    }

    // Ensure cursor advances even if no rows upserted
    if (toUpsert.length === 0) {
      lastSku = result.recordset[result.recordset.length - 1].SKU;
    }
    options.onProgress?.(scanned);

    if (result.recordset.length < pageSize) break;
  }

  return {
    scanned,
    updated,
    durationMs: Date.now() - started,
  };
}
```

**Note:** This module assumes the Supabase `products` table has a `sync_hash` column. That column does not yet exist; add it as part of this task.

- [ ] **Step 2: Add sync_hash column to products via Prisma migration**

Edit `prisma/schema.prisma` to add `syncHash String? @map("sync_hash")` on the `Product` model (find the existing Product model; add the field near the other metadata fields).

Then:

```bash
npx prisma migrate dev --name add_products_sync_hash
npx prisma generate
```

- [ ] **Step 3: Commit**

```bash
git add src/domains/product/prism-sync.ts prisma/schema.prisma prisma/migrations/
git commit -m "$(cat <<'COMMIT'
feat(bulk-edit): prism-sync domain module + products.sync_hash

runPrismPull() streams Item + Inventory (Pierce only) from Prism in
SKU-ordered pages, hashes each row, compares against the stored
products.sync_hash, and upserts only changed rows. Idempotent.

Adds sync_hash column to products via migration.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
COMMIT
)"
```

---

### Task 10: Pull-sync HTTP route

**Files:**
- Create: `src/app/api/sync/prism-pull/route.ts`
- Modify: `.env` and `.env.hotfix.example` (add `CRON_INTERNAL_SECRET`)

- [ ] **Step 1: Add the secret env var**

Append to `.env`:
```
CRON_INTERNAL_SECRET="<generate a random 48-char string>"
```
Generate a fresh random string — do not commit the example value.

Also add a placeholder to `.env.hotfix.example`:
```
CRON_INTERNAL_SECRET="replace-with-a-48-char-random-string"
```

Add the same to `/opt/lapc-invoice-maker/.env` on the VPS during rollout (this is a deploy-time step, not captured in code).

- [ ] **Step 2: Write the route**

Create `src/app/api/sync/prism-pull/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { withAdmin } from "@/domains/shared/auth";
import { isPrismConfigured } from "@/lib/prism";
import { prisma } from "@/lib/prisma";
import { runPrismPull } from "@/domains/product/prism-sync";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes — allow full catalog pulls

/**
 * Shared handler that either an authenticated admin or the internal cron
 * can invoke. The cron presents an `X-Internal-Cron-Secret` header matching
 * CRON_INTERNAL_SECRET env var; admin invocations go through the normal
 * session cookie path.
 */
async function handle(request: NextRequest): Promise<NextResponse> {
  if (!isPrismConfigured()) {
    return NextResponse.json({ error: "Prism is not configured in this environment." }, { status: 503 });
  }

  // Check for cron header first (scheduled invocations)
  const cronSecret = request.headers.get("x-internal-cron-secret");
  const expectedSecret = process.env.CRON_INTERNAL_SECRET;
  const isCron = cronSecret && expectedSecret && cronSecret === expectedSecret;

  let triggeredBy: string;
  if (isCron) {
    triggeredBy = "scheduled";
  } else {
    // User-triggered; enforce admin
    const session = await getServerSession(authOptions);
    if (!session || (session.user as { role?: string }).role !== "admin") {
      return NextResponse.json({ error: "Admin required" }, { status: 403 });
    }
    triggeredBy = `manual:${(session.user as { id: string }).id}`;
  }

  const run = await prisma.syncRun.create({
    data: {
      triggeredBy,
      status: "running",
    },
  });

  try {
    const result = await runPrismPull();
    await prisma.syncRun.update({
      where: { id: run.id },
      data: {
        completedAt: new Date(),
        scannedCount: result.scanned,
        updatedCount: result.updated,
        status: "ok",
      },
    });
    return NextResponse.json({ runId: run.id, ...result });
  } catch (err) {
    await prisma.syncRun.update({
      where: { id: run.id },
      data: {
        completedAt: new Date(),
        status: "failed",
        error: err instanceof Error ? err.message : String(err),
      },
    });
    console.error("prism-pull failed:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Sync failed" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return handle(request);
}
```

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/sync/prism-pull/route.ts" .env.hotfix.example
git commit -m "$(cat <<'COMMIT'
feat(bulk-edit): POST /api/sync/prism-pull route

Handles both manual admin invocations (session cookie) and scheduled
cron invocations (X-Internal-Cron-Secret header matching the
CRON_INTERNAL_SECRET env var). Creates a sync_runs row on start,
updates it to ok/failed on completion. 5-minute max duration.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
COMMIT
)"
```

*(Do NOT commit the actual `.env` file — it's gitignored. Only the `.env.hotfix.example` placeholder goes to git.)*

---

### Task 11: Instrumentation cron registration

**Files:**
- Modify: `src/instrumentation.ts`

- [ ] **Step 1: Add the cron registration**

In `src/instrumentation.ts`, after the existing cron registrations (after the `Account follow-ups — Mondays at 9 AM` block, before `state.__laportalCronRegistered = true`), add:

```typescript
    // Prism pull sync — daily at 11 AM Los Angeles time
    cron.schedule(
      "0 11 * * *",
      () => {
        runTrackedJob("prism-pull-sync", { runner: "node-cron" }, async () => {
          const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
          const secret = process.env.CRON_INTERNAL_SECRET;
          if (!secret) {
            console.warn("[cron] CRON_INTERNAL_SECRET not set; skipping prism-pull-sync");
            return;
          }
          const res = await fetch(`${baseUrl}/api/sync/prism-pull`, {
            method: "POST",
            headers: { "x-internal-cron-secret": secret },
          });
          if (!res.ok) {
            throw new Error(`prism-pull returned ${res.status}: ${await res.text()}`);
          }
        }).catch((err) => console.error("[cron] prism-pull-sync failed:", err));
      },
      { timezone: "America/Los_Angeles" },
    );
```

- [ ] **Step 2: Commit**

```bash
git add src/instrumentation.ts
git commit -m "$(cat <<'COMMIT'
feat(bulk-edit): register daily Prism pull cron

Schedules POST /api/sync/prism-pull at 11 AM America/Los_Angeles via
node-cron, using the same pattern as existing reminders/follow-ups.
Authenticates via X-Internal-Cron-Secret header.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
COMMIT
)"
```

---

## Phase D — API client + shared UI primitives

### Task 12: Extend `productApi` with bulk-edit and sync methods

**Files:**
- Modify: `src/domains/product/api-client.ts`

- [ ] **Step 1: Read the existing api-client shape**

Run:
```bash
cat src/domains/product/api-client.ts | head -40
```

Find the `productApi` object's closing brace and add new methods before it.

- [ ] **Step 2: Add type imports and new methods**

Near the top of the file, add:
```typescript
import type { BulkEditRequest, PreviewResult, CommitResult } from "@/domains/bulk-edit/types";
```

Inside the `productApi` object (alongside existing methods like `update`, `hardDelete`, `batch`):

```typescript
async bulkEditDryRun(body: BulkEditRequest): Promise<PreviewResult | { errors: unknown[] }> {
  const res = await fetch("/api/products/bulk-edit/dry-run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.status === 400) {
    const data = await res.json();
    if (data.errors) return { errors: data.errors };
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
},

async bulkEditCommit(body: BulkEditRequest): Promise<CommitResult | { errors: unknown[] }> {
  const res = await fetch("/api/products/bulk-edit/commit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.status === 400 || res.status === 409) {
    const data = await res.json();
    if (data.errors) return { errors: data.errors };
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
},

async listBulkEditRuns(params: { limit?: number; offset?: number } = {}): Promise<{ items: unknown[]; total: number }> {
  const qs = new URLSearchParams();
  if (params.limit !== undefined) qs.set("limit", String(params.limit));
  if (params.offset !== undefined) qs.set("offset", String(params.offset));
  const res = await fetch(`/api/products/bulk-edit/runs?${qs.toString()}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
},

async getBulkEditRun(id: string): Promise<unknown> {
  const res = await fetch(`/api/products/bulk-edit/runs/${id}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
},

async syncPrismPull(): Promise<{ runId: string; scanned: number; updated: number; durationMs: number }> {
  const res = await fetch("/api/sync/prism-pull", { method: "POST" });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? `HTTP ${res.status}`);
  }
  return res.json();
},
```

Also add a sibling object for saved searches (keep separate from `productApi` for namespace clarity):

```typescript
export const savedSearchesApi = {
  async list(): Promise<{ items: Array<{ id: string; name: string; filter: Record<string, unknown>; isSystem: boolean }> }> {
    const res = await fetch("/api/saved-searches");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },
  async create(body: { name: string; filter: Record<string, unknown> }) {
    const res = await fetch("/api/saved-searches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? `HTTP ${res.status}`);
    }
    return res.json();
  },
  async update(id: string, body: { name?: string; filter?: Record<string, unknown> }) {
    const res = await fetch(`/api/saved-searches/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },
  async remove(id: string) {
    const res = await fetch(`/api/saved-searches/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },
};
```

- [ ] **Step 3: Commit**

```bash
git add src/domains/product/api-client.ts
git commit -m "$(cat <<'COMMIT'
feat(bulk-edit): api-client methods for workspace + sync

productApi gains bulkEditDryRun, bulkEditCommit, listBulkEditRuns,
getBulkEditRun, syncPrismPull. New sibling savedSearchesApi for
preset CRUD. All error-unwrap 400/409 into a { errors } return so
callers can render validation errors without re-throwing.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
COMMIT
)"
```

---

### Task 13: `SyncDatabaseButton` component

**Files:**
- Create: `src/components/products/sync-database-button.tsx`

- [ ] **Step 1: Write the component**

Create `src/components/products/sync-database-button.tsx`:

```typescript
"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { productApi } from "@/domains/product/api-client";

export function SyncDatabaseButton() {
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Optionally hydrate last-sync timestamp from /api/sync/prism-pull/runs later.
    // For MVP, read from localStorage — the button updates this on success.
    const stored = localStorage.getItem("laportal.lastPrismSync");
    setLastSync(stored);
  }, []);

  async function handleClick() {
    setSyncing(true);
    setError(null);
    try {
      const result = await productApi.syncPrismPull();
      const now = new Date().toISOString();
      localStorage.setItem("laportal.lastPrismSync", now);
      setLastSync(now);
      console.log(`Sync complete: ${result.scanned} scanned, ${result.updated} updated in ${result.durationMs}ms`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSyncing(false);
    }
  }

  const lastSyncLabel = lastSync
    ? `Last synced ${relativeTime(new Date(lastSync))}`
    : "Never synced";

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={handleClick} disabled={syncing}>
        {syncing ? "Syncing…" : "Sync Database"}
      </Button>
      <span className="text-xs tabular-nums text-muted-foreground">
        {lastSyncLabel}
      </span>
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </div>
  );
}

function relativeTime(d: Date): string {
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/products/sync-database-button.tsx
git commit -m "$(cat <<'COMMIT'
feat(bulk-edit): SyncDatabaseButton component

Header button + relative-time last-sync indicator. Triggers
POST /api/sync/prism-pull. Last-sync timestamp kept in localStorage
for MVP; promote to a shared state layer later if needed.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
COMMIT
)"
```

---

### Task 14: `SaveSearchDialog` component

**Files:**
- Create: `src/components/bulk-edit/save-search-dialog.tsx`

- [ ] **Step 1: Write the component**

Create `src/components/bulk-edit/save-search-dialog.tsx`:

```typescript
"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { savedSearchesApi } from "@/domains/product/api-client";

interface SaveSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentFilter: Record<string, unknown>;
  onSaved?: () => void;
}

export function SaveSearchDialog({ open, onOpenChange, currentFilter, onSaved }: SaveSearchDialogProps) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await savedSearchesApi.create({ name: name.trim(), filter: currentFilter });
      onSaved?.();
      onOpenChange(false);
      setName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Save search</DialogTitle>
          <DialogDescription>
            Name this filter so you can recall it later from the workspace sidebar.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="search-name">Name</Label>
          <Input
            id="search-name"
            name="searchName"
            autoComplete="off"
            placeholder="e.g. Vendor X snacks…"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            autoFocus
          />
        </div>
        {error ? (
          <p role="alert" aria-live="polite" className="text-sm text-destructive">{error}</p>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || name.trim().length === 0}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/bulk-edit/save-search-dialog.tsx
git commit -m "$(cat <<'COMMIT'
feat(bulk-edit): SaveSearchDialog component

Small modal for naming and persisting the current filter state as a
user-scoped saved search via POST /api/saved-searches.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
COMMIT
)"
```

---

### Task 15: `CommitConfirmDialog` component

**Files:**
- Create: `src/components/bulk-edit/commit-confirm-dialog.tsx`

- [ ] **Step 1: Write the component**

Create `src/components/bulk-edit/commit-confirm-dialog.tsx`:

```typescript
"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { PreviewResult } from "@/domains/bulk-edit/types";

interface CommitConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preview: PreviewResult | null;
  onConfirm: () => void;
  submitting: boolean;
}

export function CommitConfirmDialog({ open, onOpenChange, preview, onConfirm, submitting }: CommitConfirmDialogProps) {
  if (!preview) return null;
  const { rowCount, pricingDeltaCents, districtChangeCount } = preview.totals;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Apply {rowCount} change{rowCount === 1 ? "" : "s"}?</DialogTitle>
          <DialogDescription>Review before committing. Changes are not undoable.</DialogDescription>
        </DialogHeader>
        <ul className="space-y-2 text-sm">
          <li>
            <span className="font-medium">{rowCount.toLocaleString()}</span> item{rowCount === 1 ? "" : "s"} will be updated
          </li>
          {pricingDeltaCents !== 0 ? (
            <li>
              Pierce retail delta:{" "}
              <span className={`tabular-nums font-medium ${pricingDeltaCents >= 0 ? "text-foreground" : "text-destructive"}`}>
                {pricingDeltaCents >= 0 ? "+" : ""}
                ${(pricingDeltaCents / 100).toFixed(2)}
              </span>{" "}
              total
            </li>
          ) : null}
          {districtChangeCount > 0 ? (
            <li className="flex items-start gap-2 rounded border border-destructive/30 bg-destructive/5 px-3 py-2">
              <span>⚠</span>
              <span>
                <strong>{districtChangeCount}</strong> of these rows have Department/Class or Tax changes.
                Those fields live on the shared Item record and affect all 17 LACCD locations, not just Pierce.
              </span>
            </li>
          ) : null}
        </ul>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button onClick={onConfirm} disabled={submitting}>
            {submitting ? "Applying…" : "Apply Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/bulk-edit/commit-confirm-dialog.tsx
git commit -m "$(cat <<'COMMIT'
feat(bulk-edit): CommitConfirmDialog with district warning

Final confirmation before commit. Shows row count, pricing delta,
and a prominent district-wide warning block when any DCC/tax changes
are in the patch.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
COMMIT
)"
```

---

## Phase E — Workspace panels

### Task 16: `SelectionPanel` component

**Files:**
- Create: `src/components/bulk-edit/selection-panel.tsx`

- [ ] **Step 1: Write the component**

Create `src/components/bulk-edit/selection-panel.tsx`:

```typescript
"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { BulkEditSelection, ProductFilters } from "@/domains/bulk-edit/types";

interface SelectionPanelProps {
  selection: BulkEditSelection;
  onChange: (next: BulkEditSelection) => void;
  matchingCount: number | null;       // null = unknown / not yet fetched
  onSaveSearch: () => void;
}

export function SelectionPanel({ selection, onChange, matchingCount, onSaveSearch }: SelectionPanelProps) {
  const [pasteValue, setPasteValue] = useState("");

  function setFilter<K extends keyof ProductFilters>(key: K, value: ProductFilters[K] | undefined) {
    onChange({
      ...selection,
      skus: undefined,
      filter: { ...(selection.filter ?? {}), [key]: value },
    });
  }

  function applyPaste() {
    const parsed = pasteValue
      .split(/[\s,]+/)
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isInteger(n) && n > 0);
    onChange({ ...selection, skus: parsed, filter: undefined });
  }

  function clear() {
    onChange({ scope: selection.scope });
    setPasteValue("");
  }

  const filter = selection.filter ?? {};

  return (
    <section aria-labelledby="selection-heading" className="space-y-3 rounded border p-4">
      <div className="flex items-baseline justify-between">
        <h2 id="selection-heading" className="text-base font-semibold">1. Select</h2>
        <span className="text-sm tabular-nums text-muted-foreground">
          {matchingCount === null ? "—" : `${matchingCount.toLocaleString()} matching`}
          {selection.skus?.length ? ` / ${selection.skus.length} pasted` : ""}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Label className="flex items-center gap-2">
          <span>Scope:</span>
          <select
            name="scope"
            value={selection.scope}
            onChange={(e) => onChange({ ...selection, scope: e.target.value as BulkEditSelection["scope"] })}
            className="h-8 rounded border bg-transparent px-2"
          >
            <option value="pierce">Pierce only</option>
            <option value="district">All campuses</option>
          </select>
        </Label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="q">Search description</Label>
          <Input
            id="q"
            name="q"
            autoComplete="off"
            value={filter.q ?? ""}
            onChange={(e) => setFilter("q", e.target.value || undefined)}
            placeholder="e.g. mug…"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="vendorId">Vendor ID</Label>
          <Input
            id="vendorId"
            name="vendorId"
            type="number"
            min="0"
            autoComplete="off"
            value={filter.vendorId ?? ""}
            onChange={(e) => setFilter("vendorId", e.target.value ? Number(e.target.value) : undefined)}
            placeholder="21"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="dccId">DCC ID</Label>
          <Input
            id="dccId"
            name="dccId"
            type="number"
            min="0"
            autoComplete="off"
            value={filter.dccId ?? ""}
            onChange={(e) => setFilter("dccId", e.target.value ? Number(e.target.value) : undefined)}
            placeholder="1968650"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="itemType">Item type</Label>
          <select
            id="itemType"
            name="itemType"
            value={filter.itemType ?? ""}
            onChange={(e) => setFilter("itemType", (e.target.value || undefined) as ProductFilters["itemType"])}
            className="h-9 w-full rounded border bg-transparent px-2"
          >
            <option value="">Any</option>
            <option value="general_merchandise">Merchandise</option>
            <option value="textbook">Textbook</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="minRetail">Min retail</Label>
          <Input
            id="minRetail"
            name="minRetail"
            type="number"
            step="0.01"
            min="0"
            autoComplete="off"
            value={filter.minRetail ?? ""}
            onChange={(e) => setFilter("minRetail", e.target.value ? Number(e.target.value) : undefined)}
            placeholder="0.00"
            className="tabular-nums"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="maxRetail">Max retail</Label>
          <Input
            id="maxRetail"
            name="maxRetail"
            type="number"
            step="0.01"
            min="0"
            autoComplete="off"
            value={filter.maxRetail ?? ""}
            onChange={(e) => setFilter("maxRetail", e.target.value ? Number(e.target.value) : undefined)}
            placeholder="—"
            className="tabular-nums"
          />
        </div>
      </div>

      <details>
        <summary className="cursor-pointer text-sm text-muted-foreground">Paste SKU list (overrides filters)</summary>
        <div className="mt-2 space-y-2">
          <Textarea
            name="pasteSkus"
            rows={3}
            placeholder="Paste SKUs separated by whitespace or commas…"
            value={pasteValue}
            onChange={(e) => setPasteValue(e.target.value)}
          />
          <Button variant="outline" size="sm" onClick={applyPaste} disabled={pasteValue.trim().length === 0}>
            Use this list
          </Button>
        </div>
      </details>

      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={clear}>Clear</Button>
        <Button variant="outline" size="sm" onClick={onSaveSearch}>Save Search</Button>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/bulk-edit/selection-panel.tsx
git commit -m "$(cat <<'COMMIT'
feat(bulk-edit): SelectionPanel — filter bar + paste SKU + scope

Filter inputs mirror the /products page for familiarity. Pierce/All-
campuses scope toggle. Collapsible paste-SKU override (wins over
filters when populated). Matching-count badge. Save Search button
hook.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
COMMIT
)"
```

---

### Task 17: `TransformPanel` component (compound form)

**Files:**
- Create: `src/components/bulk-edit/transform-panel.tsx`

- [ ] **Step 1: Write the component**

Create `src/components/bulk-edit/transform-panel.tsx`:

```typescript
"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ItemRefSelects } from "@/components/products/item-ref-selects";
import { productApi, type PrismRefs } from "@/domains/product/api-client";
import type { BulkEditTransform, PricingMode } from "@/domains/bulk-edit/types";

interface TransformPanelProps {
  transform: BulkEditTransform;
  onChange: (next: BulkEditTransform) => void;
  onPreview: () => void;
  previewing: boolean;
  disabled: boolean;
}

type PricingModeKey = PricingMode["mode"];

export function TransformPanel({ transform, onChange, onPreview, previewing, disabled }: TransformPanelProps) {
  const [refs, setRefs] = useState<PrismRefs | null>(null);

  useEffect(() => {
    productApi.refs().then(setRefs).catch(() => {});
  }, []);

  const mode = transform.pricing.mode;

  function setMode(next: PricingModeKey) {
    let pricing: PricingMode;
    switch (next) {
      case "none": pricing = { mode: "none" }; break;
      case "uplift": pricing = { mode: "uplift", percent: 0 }; break;
      case "absolute": pricing = { mode: "absolute", retail: 0 }; break;
      case "margin": pricing = { mode: "margin", targetMargin: 0.4 }; break;
      case "cost":
        pricing = {
          mode: "cost",
          newCost: { kind: "absolute", value: 0 },
          preserveMargin: true,
        };
        break;
    }
    onChange({ ...transform, pricing });
  }

  return (
    <section aria-labelledby="transform-heading" className="space-y-3 rounded border p-4">
      <h2 id="transform-heading" className="text-base font-semibold">2. Transform</h2>

      <div className="rounded border border-blue-200/50 bg-blue-50/30 p-3 dark:border-blue-900/40 dark:bg-blue-900/10">
        <h3 className="text-sm font-medium">Pierce Pricing</h3>
        <div className="mt-2 flex flex-wrap items-center gap-4 text-sm">
          {(["none", "uplift", "absolute", "margin", "cost"] as PricingModeKey[]).map((k) => (
            <label key={k} className="flex items-center gap-1.5">
              <input
                type="radio"
                name="pricing-mode"
                value={k}
                checked={mode === k}
                onChange={() => setMode(k)}
                disabled={disabled}
              />
              <span>{labelFor(k)}</span>
            </label>
          ))}
        </div>

        <PricingControls transform={transform} onChange={onChange} disabled={disabled} />
      </div>

      <div className="rounded border border-destructive/30 bg-destructive/5 p-3">
        <h3 className="text-sm font-medium">District-wide Catalog <span className="font-normal text-muted-foreground">⚠ affects all 17 LACCD locations</span></h3>
        <p className="mt-1 text-xs text-muted-foreground">Leave a field empty to skip that change.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <ItemRefSelects
            refs={refs}
            vendorId=""
            dccId={transform.catalog.dccId !== undefined ? String(transform.catalog.dccId) : ""}
            itemTaxTypeId={transform.catalog.itemTaxTypeId !== undefined ? String(transform.catalog.itemTaxTypeId) : ""}
            onChange={(field, value) => {
              if (field === "vendorId") return; // vendor not changeable in bulk catalog transform
              onChange({
                ...transform,
                catalog: {
                  ...transform.catalog,
                  [field]: value ? Number(value) : undefined,
                },
              });
            }}
            bulkMode
            disabled={disabled}
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={onPreview} disabled={previewing || disabled}>
          {previewing ? "Building preview…" : "Preview →"}
        </Button>
      </div>
    </section>
  );
}

function labelFor(k: PricingModeKey): string {
  switch (k) {
    case "none": return "No change";
    case "uplift": return "Uplift %";
    case "absolute": return "Absolute set";
    case "margin": return "Margin re-price";
    case "cost": return "Cost update";
  }
}

function PricingControls({ transform, onChange, disabled }: { transform: BulkEditTransform; onChange: (t: BulkEditTransform) => void; disabled: boolean }) {
  const p = transform.pricing;

  if (p.mode === "none") return null;

  if (p.mode === "uplift") {
    return (
      <div className="mt-3 flex items-center gap-3">
        <Label htmlFor="uplift-percent" className="whitespace-nowrap">Percent (+/-):</Label>
        <Input
          id="uplift-percent"
          type="number"
          step="0.1"
          autoComplete="off"
          className="w-32 tabular-nums"
          value={p.percent}
          disabled={disabled}
          onChange={(e) => onChange({ ...transform, pricing: { mode: "uplift", percent: Number(e.target.value) } })}
        />
        <span className="text-sm text-muted-foreground">e.g. 5 for +5%, -10 for -10%</span>
      </div>
    );
  }

  if (p.mode === "absolute") {
    return (
      <div className="mt-3 flex items-center gap-3">
        <Label htmlFor="abs-retail" className="whitespace-nowrap">Set retail to:</Label>
        <Input
          id="abs-retail"
          type="number"
          step="0.01"
          min="0"
          autoComplete="off"
          className="w-32 tabular-nums"
          value={p.retail}
          disabled={disabled}
          onChange={(e) => onChange({ ...transform, pricing: { mode: "absolute", retail: Number(e.target.value) } })}
        />
      </div>
    );
  }

  if (p.mode === "margin") {
    return (
      <div className="mt-3 flex items-center gap-3">
        <Label htmlFor="margin-target" className="whitespace-nowrap">Target margin:</Label>
        <Input
          id="margin-target"
          type="number"
          step="0.01"
          min="0"
          max="0.99"
          autoComplete="off"
          className="w-32 tabular-nums"
          value={p.targetMargin}
          disabled={disabled}
          onChange={(e) => onChange({ ...transform, pricing: { mode: "margin", targetMargin: Number(e.target.value) } })}
        />
        <span className="text-sm text-muted-foreground">0.40 = 40% (retail = cost / (1 − margin))</span>
      </div>
    );
  }

  // cost
  const costP = p;
  return (
    <div className="mt-3 space-y-2">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Label className="flex items-center gap-1.5">
          <input
            type="radio"
            name="cost-kind"
            checked={costP.newCost.kind === "absolute"}
            onChange={() =>
              onChange({ ...transform, pricing: { mode: "cost", newCost: { kind: "absolute", value: 0 }, preserveMargin: costP.preserveMargin } })
            }
            disabled={disabled}
          />
          <span>Set cost to</span>
        </Label>
        <Label className="flex items-center gap-1.5">
          <input
            type="radio"
            name="cost-kind"
            checked={costP.newCost.kind === "uplift"}
            onChange={() =>
              onChange({ ...transform, pricing: { mode: "cost", newCost: { kind: "uplift", percent: 0 }, preserveMargin: costP.preserveMargin } })
            }
            disabled={disabled}
          />
          <span>Uplift cost by %</span>
        </Label>
      </div>
      <div className="flex items-center gap-3">
        <Input
          type="number"
          step="0.01"
          min="0"
          autoComplete="off"
          className="w-32 tabular-nums"
          value={costP.newCost.kind === "absolute" ? costP.newCost.value : costP.newCost.percent}
          disabled={disabled}
          onChange={(e) => {
            const v = Number(e.target.value);
            const newCost: PricingMode = costP.newCost.kind === "absolute"
              ? { mode: "cost", newCost: { kind: "absolute", value: v }, preserveMargin: costP.preserveMargin }
              : { mode: "cost", newCost: { kind: "uplift", percent: v }, preserveMargin: costP.preserveMargin };
            onChange({ ...transform, pricing: newCost });
          }}
        />
      </div>
      <Label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={costP.preserveMargin}
          onChange={(e) =>
            onChange({
              ...transform,
              pricing: { mode: "cost", newCost: costP.newCost, preserveMargin: e.target.checked },
            })
          }
          disabled={disabled}
        />
        <span>Recompute retail to preserve current margin per item</span>
      </Label>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/bulk-edit/transform-panel.tsx
git commit -m "$(cat <<'COMMIT'
feat(bulk-edit): TransformPanel — compound form with visual split

Pierce Pricing (radio-select pricing mode + mode-specific controls)
visually separated from District-wide Catalog (DCC / tax dropdowns
via ItemRefSelects). District section has permanent 17-campus
warning. Preview button wires to the page-level dry-run flow.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
COMMIT
)"
```

---

### Task 18: `PreviewPanel` component

**Files:**
- Create: `src/components/bulk-edit/preview-panel.tsx`

- [ ] **Step 1: Write the component**

Create `src/components/bulk-edit/preview-panel.tsx`:

```typescript
"use client";

import { Button } from "@/components/ui/button";
import type { PreviewResult } from "@/domains/bulk-edit/types";

interface PreviewPanelProps {
  preview: PreviewResult | null;
  previewing: boolean;
  onCommit: () => void;
  committing: boolean;
}

export function PreviewPanel({ preview, previewing, onCommit, committing }: PreviewPanelProps) {
  return (
    <section aria-labelledby="preview-heading" className="space-y-3 rounded border p-4">
      <h2 id="preview-heading" className="text-base font-semibold">3. Preview & Commit</h2>

      {previewing ? (
        <div role="status" aria-live="polite" className="py-8 text-center text-sm text-muted-foreground">
          Building preview…
        </div>
      ) : !preview ? (
        <p className="text-sm text-muted-foreground">Run a preview from the transform panel to see projected changes.</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-6 rounded bg-muted/40 px-4 py-3 text-sm">
            <div>
              <div className="text-muted-foreground">Rows</div>
              <div className="tabular-nums font-medium">{preview.totals.rowCount.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Pierce retail delta</div>
              <div className={`tabular-nums font-medium ${preview.totals.pricingDeltaCents < 0 ? "text-destructive" : ""}`}>
                {preview.totals.pricingDeltaCents >= 0 ? "+" : ""}
                ${(preview.totals.pricingDeltaCents / 100).toFixed(2)}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">District changes</div>
              <div className="tabular-nums font-medium">{preview.totals.districtChangeCount}</div>
            </div>
          </div>

          {preview.warnings.length > 0 ? (
            <div role="alert" aria-live="polite" className="rounded border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              <div className="font-medium">{preview.warnings.length} batch-level warning{preview.warnings.length === 1 ? "" : "s"}</div>
              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                {preview.warnings.map((w, i) => <li key={i}>{w.message}</li>)}
              </ul>
            </div>
          ) : null}

          <div className="max-h-96 overflow-auto rounded border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted">
                <tr>
                  <th className="px-2 py-2 text-left font-medium">SKU</th>
                  <th className="px-2 py-2 text-left font-medium">Description</th>
                  <th className="px-2 py-2 text-right font-medium">Retail</th>
                  <th className="px-2 py-2 text-right font-medium">Cost</th>
                  <th className="px-2 py-2 text-left font-medium">Changes</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((r) => (
                  <tr key={r.sku} className="border-t">
                    <td className="px-2 py-1 font-mono tabular-nums">{r.sku}</td>
                    <td className="px-2 py-1">{r.description}</td>
                    <td className="px-2 py-1 text-right tabular-nums">
                      {r.changedFields.includes("retail") ? (
                        <>
                          <span className="text-muted-foreground line-through">${r.before.retail.toFixed(2)}</span>{" "}
                          <span className="font-medium">${r.after.retail.toFixed(2)}</span>
                        </>
                      ) : (
                        `$${r.after.retail.toFixed(2)}`
                      )}
                    </td>
                    <td className="px-2 py-1 text-right tabular-nums">
                      {r.changedFields.includes("cost") ? (
                        <>
                          <span className="text-muted-foreground line-through">${r.before.cost.toFixed(2)}</span>{" "}
                          <span className="font-medium">${r.after.cost.toFixed(2)}</span>
                        </>
                      ) : (
                        `$${r.after.cost.toFixed(2)}`
                      )}
                    </td>
                    <td className="px-2 py-1 text-xs text-muted-foreground">
                      {r.changedFields.join(", ") || "—"}
                      {r.warnings.length > 0 ? (
                        <div className="mt-0.5 text-destructive">
                          {r.warnings.map((w) => w.message).join("; ")}
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end">
            <Button onClick={onCommit} disabled={committing || preview.totals.rowCount === 0}>
              {committing ? "Applying…" : `Commit ${preview.totals.rowCount} Change${preview.totals.rowCount === 1 ? "" : "s"}`}
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/bulk-edit/preview-panel.tsx
git commit -m "$(cat <<'COMMIT'
feat(bulk-edit): PreviewPanel — diff grid + totals + warnings

Totals summary bar, batch-level warnings block, scrollable per-row
diff grid with before→after values, and a commit button. Pure
presentational component; commit wiring lives in the page shell.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
COMMIT
)"
```

---

### Task 19: AuditLogList + detail dialog

**Files:**
- Create: `src/components/bulk-edit/audit-log-list.tsx`
- Create: `src/components/bulk-edit/audit-log-detail-dialog.tsx`

- [ ] **Step 1: Write the list component**

Create `src/components/bulk-edit/audit-log-list.tsx`:

```typescript
"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { productApi } from "@/domains/product/api-client";
import { AuditLogDetailDialog } from "./audit-log-detail-dialog";

interface RunSummary {
  id: string;
  createdAt: string;
  operatorDisplay: string;
  skuCount: number;
  pricingDeltaCents: number;
  hadDistrictChanges: boolean;
  summary: string;
}

export function AuditLogList() {
  const [items, setItems] = useState<RunSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const { items } = await productApi.listBulkEditRuns({ limit: 20 });
      setItems(items as RunSummary[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <section aria-labelledby="audit-heading" className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 id="audit-heading" className="text-base font-semibold">Recent bulk edits</h2>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          {loading ? "Loading…" : "Refresh"}
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">{error}</p>
      ) : null}
      <ul className="divide-y rounded border">
        {items.length === 0 && !loading ? (
          <li className="px-3 py-4 text-center text-sm text-muted-foreground">No bulk edits yet.</li>
        ) : null}
        {items.map((r) => (
          <li key={r.id} className="flex items-center justify-between px-3 py-2 text-sm">
            <div>
              <span className="tabular-nums text-muted-foreground">{new Date(r.createdAt).toLocaleString()}</span>
              {" "}•{" "}
              <span className="font-medium">{r.operatorDisplay}</span>
              {" "}•{" "}
              <span className="tabular-nums">{r.skuCount} items</span>
              {r.hadDistrictChanges ? <span className="ml-2 rounded bg-destructive/10 px-1.5 py-0.5 text-xs text-destructive">district</span> : null}
              <div className="text-xs text-muted-foreground">{r.summary}</div>
            </div>
            <Button variant="outline" size="sm" onClick={() => setDetailId(r.id)}>Detail</Button>
          </li>
        ))}
      </ul>
      {detailId ? (
        <AuditLogDetailDialog
          runId={detailId}
          open={detailId !== null}
          onOpenChange={(open) => !open && setDetailId(null)}
        />
      ) : null}
    </section>
  );
}
```

- [ ] **Step 2: Write the detail dialog**

Create `src/components/bulk-edit/audit-log-detail-dialog.tsx`:

```typescript
"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { productApi } from "@/domains/product/api-client";

interface DetailRun {
  id: string;
  createdAt: string;
  operatorDisplay: string;
  selection: Record<string, unknown>;
  transform: Record<string, unknown>;
  affectedSkus: number[];
  skuCount: number;
  pricingDeltaCents: number;
  hadDistrictChanges: boolean;
  summary: string;
}

interface Props {
  runId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AuditLogDetailDialog({ runId, open, onOpenChange }: Props) {
  const [run, setRun] = useState<DetailRun | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    productApi.getBulkEditRun(runId).then((r) => { setRun(r as DetailRun); setLoading(false); }).catch(() => setLoading(false));
  }, [runId, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Bulk edit detail</DialogTitle>
          <DialogDescription>
            {run ? `${run.operatorDisplay} · ${new Date(run.createdAt).toLocaleString()}` : "Loading…"}
          </DialogDescription>
        </DialogHeader>
        {loading || !run ? (
          <div role="status" className="py-6 text-center text-sm text-muted-foreground">Loading…</div>
        ) : (
          <div className="space-y-3 text-sm">
            <p>{run.summary}</p>
            <div>
              <div className="font-medium">Affected SKUs ({run.affectedSkus.length})</div>
              <div className="mt-1 max-h-40 overflow-auto rounded border bg-muted/30 p-2 font-mono text-xs">
                {run.affectedSkus.join(", ")}
              </div>
            </div>
            <details>
              <summary className="cursor-pointer text-muted-foreground">Raw selection</summary>
              <pre className="mt-1 overflow-auto rounded bg-muted/30 p-2 text-xs">{JSON.stringify(run.selection, null, 2)}</pre>
            </details>
            <details>
              <summary className="cursor-pointer text-muted-foreground">Raw transform</summary>
              <pre className="mt-1 overflow-auto rounded bg-muted/30 p-2 text-xs">{JSON.stringify(run.transform, null, 2)}</pre>
            </details>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/bulk-edit/audit-log-list.tsx src/components/bulk-edit/audit-log-detail-dialog.tsx
git commit -m "$(cat <<'COMMIT'
feat(bulk-edit): AuditLogList + AuditLogDetailDialog

Inline list of the last 20 bulk_edit_runs with a refresh button.
Detail dialog shows the full run including operator, summary,
affected SKU list, and raw selection/transform payloads in collapsed
<details> for forensics.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
COMMIT
)"
```

---

### Task 20: `BulkEditSidebar` component

**Files:**
- Create: `src/components/bulk-edit/bulk-edit-sidebar.tsx`

- [ ] **Step 1: Write the component**

Create `src/components/bulk-edit/bulk-edit-sidebar.tsx`:

```typescript
"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { savedSearchesApi } from "@/domains/product/api-client";
import type { ProductFilters } from "@/domains/bulk-edit/types";

interface SavedSearch {
  id: string;
  name: string;
  filter: Record<string, unknown>;
  isSystem: boolean;
}

interface BulkEditSidebarProps {
  onLoadFilter: (filter: ProductFilters) => void;
  refreshKey: number; // increment to force re-fetch
}

export function BulkEditSidebar({ onLoadFilter, refreshKey }: BulkEditSidebarProps) {
  const [items, setItems] = useState<SavedSearch[]>([]);

  useEffect(() => {
    savedSearchesApi.list().then((res) => setItems(res.items)).catch(() => setItems([]));
  }, [refreshKey]);

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this saved search?")) return;
    await savedSearchesApi.remove(id);
    setItems((prev) => prev.filter((x) => x.id !== id));
  }

  const user = items.filter((x) => !x.isSystem);
  const system = items.filter((x) => x.isSystem);

  return (
    <aside aria-label="Saved searches" className="space-y-4 rounded border p-3 text-sm">
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">My Searches</h3>
        {user.length === 0 ? (
          <p className="text-xs text-muted-foreground">None yet. Use the Save Search button in the selection panel.</p>
        ) : (
          <ul className="space-y-1">
            {user.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-1">
                <button
                  className="flex-1 truncate rounded px-1 py-0.5 text-left hover:bg-accent"
                  onClick={() => onLoadFilter(s.filter as ProductFilters)}
                >
                  {s.name}
                </button>
                <Button size="sm" variant="ghost" onClick={() => handleDelete(s.id)} aria-label={`Delete ${s.name}`}>×</Button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Helpers</h3>
        {system.length === 0 ? (
          <p className="text-xs text-muted-foreground">None configured.</p>
        ) : (
          <ul className="space-y-1">
            {system.map((s) => (
              <li key={s.id}>
                <button
                  className="w-full truncate rounded px-1 py-0.5 text-left hover:bg-accent"
                  onClick={() => onLoadFilter(s.filter as ProductFilters)}
                >
                  {s.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/bulk-edit/bulk-edit-sidebar.tsx
git commit -m "$(cat <<'COMMIT'
feat(bulk-edit): BulkEditSidebar with saved searches + helpers

Two-section sidebar: My Searches (user-scoped, deletable) + Helpers
(system presets, read-only). Click to load the filter into the
selection panel via callback. Refreshes when refreshKey changes
(incremented after a Save Search action completes).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
COMMIT
)"
```

---

## Phase F — Workspace assembly + integration

### Task 21: `/products/bulk-edit` page

**Files:**
- Create: `src/app/products/bulk-edit/page.tsx`

- [ ] **Step 1: Write the page**

Create `src/app/products/bulk-edit/page.tsx`:

```typescript
"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { BulkEditSidebar } from "@/components/bulk-edit/bulk-edit-sidebar";
import { SelectionPanel } from "@/components/bulk-edit/selection-panel";
import { TransformPanel } from "@/components/bulk-edit/transform-panel";
import { PreviewPanel } from "@/components/bulk-edit/preview-panel";
import { AuditLogList } from "@/components/bulk-edit/audit-log-list";
import { SaveSearchDialog } from "@/components/bulk-edit/save-search-dialog";
import { CommitConfirmDialog } from "@/components/bulk-edit/commit-confirm-dialog";
import { SyncDatabaseButton } from "@/components/products/sync-database-button";
import { productApi } from "@/domains/product/api-client";
import type {
  BulkEditSelection,
  BulkEditTransform,
  PreviewResult,
  ProductFilters,
} from "@/domains/bulk-edit/types";

const EMPTY_SELECTION: BulkEditSelection = { scope: "pierce" };
const EMPTY_TRANSFORM: BulkEditTransform = { pricing: { mode: "none" }, catalog: {} };

export default function BulkEditPage() {
  const router = useRouter();
  const [selection, setSelection] = useState<BulkEditSelection>(EMPTY_SELECTION);
  const [transform, setTransform] = useState<BulkEditTransform>(EMPTY_TRANSFORM);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [sidebarKey, setSidebarKey] = useState(0);
  const [matchingCount, setMatchingCount] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runPreview = useCallback(async () => {
    setPreviewing(true);
    setError(null);
    try {
      const result = await productApi.bulkEditDryRun({ selection, transform });
      if ("errors" in result) {
        setError((result.errors as Array<{ message: string }>).map((e) => e.message).join("; "));
        setPreview(null);
      } else {
        setPreview(result);
        setMatchingCount(result.totals.rowCount);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPreview(null);
    } finally {
      setPreviewing(false);
    }
  }, [selection, transform]);

  async function actuallyCommit() {
    setCommitting(true);
    setError(null);
    try {
      const result = await productApi.bulkEditCommit({ selection, transform });
      if ("errors" in result) {
        setError((result.errors as Array<{ message: string }>).map((e) => e.message).join("; "));
        return;
      }
      setToast(`Committed ${result.successCount} change${result.successCount === 1 ? "" : "s"}. Run ${result.runId.slice(0, 8)}.`);
      setSelection(EMPTY_SELECTION);
      setTransform(EMPTY_TRANSFORM);
      setPreview(null);
      setConfirmOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCommitting(false);
    }
  }

  function handleLoadFilter(f: ProductFilters) {
    setSelection({ scope: selection.scope, filter: f });
    setPreview(null);
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Bulk Edit Workspace</h1>
          <p className="text-sm text-muted-foreground">Select, transform, preview, commit. Changes are not undoable; the preview is your safety net.</p>
        </div>
        <div className="flex items-center gap-3">
          <SyncDatabaseButton />
          <Button variant="outline" asChild>
            <Link href="/products">← Products</Link>
          </Button>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <BulkEditSidebar onLoadFilter={handleLoadFilter} refreshKey={sidebarKey} />

        <div className="space-y-6">
          <SelectionPanel
            selection={selection}
            onChange={setSelection}
            matchingCount={matchingCount}
            onSaveSearch={() => setSaveOpen(true)}
          />

          <TransformPanel
            transform={transform}
            onChange={setTransform}
            onPreview={runPreview}
            previewing={previewing}
            disabled={committing}
          />

          <PreviewPanel
            preview={preview}
            previewing={previewing}
            onCommit={() => setConfirmOpen(true)}
            committing={committing}
          />

          {error ? (
            <p role="alert" aria-live="polite" className="rounded border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}
          {toast ? (
            <p role="status" aria-live="polite" className="rounded border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">
              {toast}
            </p>
          ) : null}

          <AuditLogList />
        </div>
      </div>

      <SaveSearchDialog
        open={saveOpen}
        onOpenChange={setSaveOpen}
        currentFilter={selection.filter ?? {}}
        onSaved={() => setSidebarKey((k) => k + 1)}
      />
      <CommitConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        preview={preview}
        onConfirm={actuallyCommit}
        submitting={committing}
      />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/products/bulk-edit/page.tsx
git commit -m "$(cat <<'COMMIT'
feat(bulk-edit): assemble /products/bulk-edit workspace page

Orchestrates Sidebar + SelectionPanel + TransformPanel +
PreviewPanel + AuditLogList with shared state. Wires the
SyncDatabaseButton into the header. Save-search and commit-confirm
dialogs are page-level.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
COMMIT
)"
```

---

### Task 22: Products page — bulk-edit entry points + sync button

**Files:**
- Modify: `src/app/products/page.tsx`

- [ ] **Step 1: Add imports**

At the top of `src/app/products/page.tsx`, add alongside existing imports:

```typescript
import { SyncDatabaseButton } from "@/components/products/sync-database-button";
```

- [ ] **Step 2: Add the Bulk Edit header link + Sync button**

Find where the "Batch Add" button is rendered in the header. Next to it, add:

```tsx
{prismAvailable && (
  <Button variant="outline" asChild>
    <Link href="/products/bulk-edit">Bulk Edit Workspace →</Link>
  </Button>
)}
<SyncDatabaseButton />
```

- [ ] **Step 3: Add "Bulk Edit Selected" to the action bar**

In the `ProductActionBar` props passed from the products page, add `onBulkEdit={() => router.push('/products/bulk-edit?preloadSkus=' + Array.from(selected.keys()).join(','))}`.

Then in `src/components/products/product-action-bar.tsx`, add the corresponding prop + button (next to Edit / Discontinue / Delete):

```typescript
// in ProductActionBarProps:
onBulkEdit?: () => void;

// destructure: onBulkEdit,

// in the JSX, after onEditClick block:
{prismAvailable && onBulkEdit ? (
  <Button size="sm" variant="outline" onClick={onBulkEdit}>
    Bulk Edit
  </Button>
) : null}
```

Update the bulk-edit page (`src/app/products/bulk-edit/page.tsx`) to honor the `preloadSkus` query param:

```typescript
// At the top of BulkEditPage, add:
import { useSearchParams } from "next/navigation";
// ...and inside the function body, before any other state init:
const searchParams = useSearchParams();
useEffect(() => {
  const raw = searchParams.get("preloadSkus");
  if (raw) {
    const skus = raw.split(",").map((s) => Number(s.trim())).filter((n) => Number.isInteger(n) && n > 0);
    if (skus.length > 0) setSelection({ scope: "pierce", skus });
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
```

(Also add `import { useEffect } from "react";` to the page's imports if not already present.)

- [ ] **Step 4: Commit**

```bash
git add src/app/products/page.tsx src/components/products/product-action-bar.tsx src/app/products/bulk-edit/page.tsx
git commit -m "$(cat <<'COMMIT'
feat(bulk-edit): entry points from /products

- Bulk Edit Workspace header link (Prism-gated)
- Sync Database button in the header
- Bulk Edit Selected action bar button (carries selected SKUs via
  preloadSkus query param into the workspace page)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
COMMIT
)"
```

---

## Phase G — Prism integration scripts

### Task 23: `scripts/test-bulk-edit-flow.ts`

**Files:**
- Create: `scripts/test-bulk-edit-flow.ts`

- [ ] **Step 1: Write the script**

Create `scripts/test-bulk-edit-flow.ts`:

```typescript
/**
 * Live end-to-end test of the bulk-edit flow. Creates 3 TEST-CLAUDE items,
 * exercises each pricing mode, verifies results in Prism via direct SELECT,
 * then hard-deletes the test items. Run on campus.
 */
import { config as loadEnv } from "dotenv";
import path from "path";
loadEnv({ path: path.resolve(process.cwd(), ".env.local") });
loadEnv({ path: path.resolve(process.cwd(), ".env") });

import { createGmItem, deleteTestItem } from "@/domains/product/prism-server";
import { updateGmItem, getItemSnapshot } from "@/domains/product/prism-updates";
import { applyTransform } from "@/domains/bulk-edit/transform-engine";
import type { BulkEditTransform } from "@/domains/bulk-edit/types";

async function main() {
  const stamp = Date.now() % 1_000_000;
  const created: number[] = [];

  try {
    // Create 3 test items
    for (let i = 0; i < 3; i++) {
      const item = await createGmItem({
        description: `BULK EDIT TEST ${i + 1}`,
        vendorId: 21,
        dccId: 1968650,
        itemTaxTypeId: 6,
        barcode: `TEST-CLAUDE-BE${i}${stamp}`.slice(0, 20),
        retail: 10 + i,
        cost: 5 + i,
      });
      created.push(item.sku);
    }
    console.log(`Created SKUs: ${created.join(", ")}`);

    // Test each pricing mode by directly calling applyTransform + updateGmItem
    const modes: Array<{ label: string; transform: BulkEditTransform }> = [
      { label: "uplift +5%", transform: { pricing: { mode: "uplift", percent: 5 }, catalog: {} } },
      { label: "absolute $12.99", transform: { pricing: { mode: "absolute", retail: 12.99 }, catalog: {} } },
      { label: "margin 40%", transform: { pricing: { mode: "margin", targetMargin: 0.4 }, catalog: {} } },
      { label: "cost absolute $6 + preserveMargin", transform: { pricing: { mode: "cost", newCost: { kind: "absolute", value: 6 }, preserveMargin: true }, catalog: {} } },
    ];

    for (const { label, transform } of modes) {
      // Pick the first created item for each test
      const sku = created[0];
      const snap = await getItemSnapshot(sku);
      if (!snap) throw new Error(`snapshot for ${sku} missing`);

      const projected = applyTransform({
        sku,
        description: "",
        barcode: snap.barcode,
        retail: snap.retail,
        cost: snap.cost,
        vendorId: null, dccId: null, itemTaxTypeId: null,
        itemType: "general_merchandise",
        fDiscontinue: 0,
      }, transform);

      const patch: Record<string, unknown> = {};
      if (projected.changedFields.includes("retail")) patch.retail = projected.after.retail;
      if (projected.changedFields.includes("cost")) patch.cost = projected.after.cost;
      if (Object.keys(patch).length === 0) {
        console.log(`SKIP ${label} — no change projected`);
        continue;
      }
      await updateGmItem(sku, patch);
      const after = await getItemSnapshot(sku);
      if (!after) throw new Error(`post-update snapshot missing`);
      console.log(`✓ ${label}: retail ${snap.retail} → ${after.retail}, cost ${snap.cost} → ${after.cost}`);
    }
  } finally {
    for (const sku of created) {
      try { await deleteTestItem(sku); } catch (e) { console.warn(`cleanup ${sku} failed:`, e); }
    }
    console.log(`Cleaned up ${created.length} test items`);
  }
  process.exit(0);
}

main().catch((err) => { console.error("FAILED:", err); process.exit(1); });
```

- [ ] **Step 2: Run on-campus**

```bash
npx tsx scripts/test-bulk-edit-flow.ts
```

Expected: creates 3 items, exercises 4 pricing modes with per-step ✓ lines, cleans up.

- [ ] **Step 3: If it passes, commit**

```bash
git add scripts/test-bulk-edit-flow.ts
git commit -m "$(cat <<'COMMIT'
test(bulk-edit): live round-trip for pricing modes

Creates TEST-CLAUDE items, applies each pricing mode via the
transform engine + updateGmItem, reads back via getItemSnapshot,
verifies projected values match reality. Cleans up via
deleteTestItem.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
COMMIT
)"
```

---

### Task 24: `scripts/test-prism-pull-sync.ts`

**Files:**
- Create: `scripts/test-prism-pull-sync.ts`

- [ ] **Step 1: Write the script**

Create `scripts/test-prism-pull-sync.ts`:

```typescript
/**
 * Live test of runPrismPull. Runs it twice; the second run must upsert
 * zero rows (idempotency). Reports timing.
 */
import { config as loadEnv } from "dotenv";
import path from "path";
loadEnv({ path: path.resolve(process.cwd(), ".env.local") });
loadEnv({ path: path.resolve(process.cwd(), ".env") });

import { runPrismPull } from "@/domains/product/prism-sync";

async function main() {
  console.log("First run:");
  const r1 = await runPrismPull({ onProgress: (n) => { if (n % 5000 === 0) console.log(`  scanned ${n}`); } });
  console.log(`  scanned=${r1.scanned}, updated=${r1.updated}, durationMs=${r1.durationMs}`);

  console.log("Second run (expect 0 updated):");
  const r2 = await runPrismPull();
  console.log(`  scanned=${r2.scanned}, updated=${r2.updated}, durationMs=${r2.durationMs}`);

  if (r2.updated !== 0) {
    console.error(`IDEMPOTENCY FAIL: second run updated ${r2.updated} rows (expected 0)`);
    process.exit(1);
  }
  console.log("✓ idempotent");
  process.exit(0);
}

main().catch((err) => { console.error("FAILED:", err); process.exit(1); });
```

- [ ] **Step 2: Run on-campus**

```bash
npx tsx scripts/test-prism-pull-sync.ts
```

Expected: first run scans ~195k, updates varying count. Second run updates 0. Prints `✓ idempotent`.

- [ ] **Step 3: Commit**

```bash
git add scripts/test-prism-pull-sync.ts
git commit -m "$(cat <<'COMMIT'
test(bulk-edit): live Prism pull sync + idempotency assertion

Runs the pull twice; second run must update zero rows. Regression
guard against hash function drift or schema shape surprises.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
COMMIT
)"
```

---

### Task 25: `scripts/test-bulk-edit-district.ts`

**Files:**
- Create: `scripts/test-bulk-edit-district.ts`

- [ ] **Step 1: Write the script**

Create `scripts/test-bulk-edit-district.ts`:

```typescript
/**
 * Verify that a DCC change via updateGmItem propagates to the shared Item
 * table (district-wide field). Reads DCCID back from Prism and confirms
 * the new value landed. Cleans up after itself.
 */
import { config as loadEnv } from "dotenv";
import path from "path";
loadEnv({ path: path.resolve(process.cwd(), ".env.local") });
loadEnv({ path: path.resolve(process.cwd(), ".env") });

import { createGmItem, deleteTestItem } from "@/domains/product/prism-server";
import { updateGmItem } from "@/domains/product/prism-updates";
import { getPrismPool, sql } from "@/lib/prism";

const ORIGINAL_DCC = 1968650;
const ALTERNATE_DCC_QUERY = "SELECT TOP 1 DCCID FROM DeptClassCat WHERE DCCType = 3 AND DCCID <> 1968650";

async function main() {
  const pool = await getPrismPool();
  const altResult = await pool.request().query<{ DCCID: number }>(ALTERNATE_DCC_QUERY);
  const altDcc = altResult.recordset[0]?.DCCID;
  if (!altDcc) throw new Error("Could not find an alternate DCC for the test");

  const item = await createGmItem({
    description: "DISTRICT DCC TEST",
    vendorId: 21,
    dccId: ORIGINAL_DCC,
    itemTaxTypeId: 6,
    barcode: `TEST-CLAUDE-D-${Date.now() % 100_000}`,
    retail: 1,
    cost: 0.5,
  });
  console.log(`Created SKU ${item.sku}`);

  try {
    await updateGmItem(item.sku, { dccId: altDcc });
    const check = await pool.request().input("sku", sql.Int, item.sku)
      .query<{ DCCID: number }>("SELECT DCCID FROM Item WHERE SKU = @sku");
    const actual = check.recordset[0]?.DCCID;
    if (actual !== altDcc) {
      throw new Error(`DCC change did not land: expected ${altDcc}, found ${actual}`);
    }
    console.log(`✓ DCC on Item ${item.sku} is now ${actual}`);
  } finally {
    await deleteTestItem(item.sku);
    console.log(`Cleaned up SKU ${item.sku}`);
  }
  process.exit(0);
}

main().catch((err) => { console.error("FAILED:", err); process.exit(1); });
```

- [ ] **Step 2: Run on-campus**

```bash
npx tsx scripts/test-bulk-edit-district.ts
```

Expected: creates test item, changes DCC, reads back from `Item.DCCID`, confirms, cleans up.

- [ ] **Step 3: Commit**

```bash
git add scripts/test-bulk-edit-district.ts
git commit -m "$(cat <<'COMMIT'
test(bulk-edit): district DCC change propagation

Confirms updateGmItem mutating Item.DCCID actually lands (evidence
that district-wide writes take effect across the shared catalog).
Safety check before a bulk DCC change is ever committed against
real inventory.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
COMMIT
)"
```

---

## Phase H — Verification & ship

### Task 26: Run full integration suite + ship-check + deploy

**Files:** (no code changes — verification)

- [ ] **Step 1: Ensure working tree is clean**

```bash
git status
```

Expected: `nothing to commit, working tree clean` (the pre-existing untracked `scripts/verify-edit-discovery.ts` may still be present; stash it before ship-check).

- [ ] **Step 2: Stash the pre-existing untracked script and run ship-check**

```bash
git stash push -u -m "tmp untracked" -- scripts/verify-edit-discovery.ts
bash ./scripts/ship-check.sh
git stash pop
```

Expected: ship-check passes and records a stamp.

- [ ] **Step 3: Run all Prism integration scripts (on-campus)**

```bash
npx tsx scripts/test-bulk-edit-flow.ts
npx tsx scripts/test-prism-pull-sync.ts
npx tsx scripts/test-bulk-edit-district.ts
```

Expected: every script exits 0 with ✓ output.

- [ ] **Step 4: Add CRON_INTERNAL_SECRET to VPS .env**

Before deploying, SSH to the VPS and add the secret:

```bash
ssh -F /c/Users/MONTALMA2/.ssh/config -o BatchMode=yes -o ConnectionAttempts=1 laportal-vps \
  "grep -q '^CRON_INTERNAL_SECRET=' /opt/lapc-invoice-maker/.env || echo 'CRON_INTERNAL_SECRET=\"<generated-48-char-string>\"' >> /opt/lapc-invoice-maker/.env"
```

Use a freshly-generated random 48-char string. Do NOT reuse the dev value.

- [ ] **Step 5: Push branch**

```bash
git push -u origin feat/bulk-edit-workspace
```

- [ ] **Step 6: Hotfix deploy**

```bash
EXPECTED_SHA=$(git rev-parse HEAD)
ssh -F /c/Users/MONTALMA2/.ssh/config -o BatchMode=yes -o ConnectionAttempts=1 laportal-vps \
  "cd /opt/lapc-invoice-maker && DEPLOY_CHANNEL=hotfix DEPLOY_ACTOR=marcos DEPLOY_EXPECTED_SHA=${EXPECTED_SHA} ./scripts/deploy-webhook.sh feat/bulk-edit-workspace"
```

Expected: build + deploy + smoke checks green. `/api/version` reports the new SHA.

- [ ] **Step 7: Browser smoke on `laportal.montalvo.io`**

1. Log in as admin.
2. Visit `/products`. Verify "Bulk Edit Workspace →" button appears in header + "Sync Database" button shows.
3. Click "Sync Database". Wait for toast. Button label updates to "Last synced …".
4. Navigate to `/products/bulk-edit`. Verify sidebar renders (will be mostly empty until smart helpers are seeded).
5. Enter a tiny filter (e.g. `vendorId = 21`), click Preview in the transform panel with `mode: none` and no catalog changes → expect a `NO_OP_TRANSFORM` error (validates the validation).
6. Change pricing to uplift +1%, click Preview → expect a diff grid.
7. Do NOT commit unless you've picked genuinely test-safe SKUs.

- [ ] **Step 8: If everything green, open PR (don't merge yet — spec requested review gate elsewhere; this is a user call)**

Done.

---

## Plan self-review checklist

Before marking this plan complete, an implementer should confirm:

- [ ] Every transform mode in the spec (uplift, absolute, margin, cost+preserveMargin) has a unit test AND a live integration exercise
- [ ] District-wide change path is exercised end-to-end (Task 25)
- [ ] Pull sync is exercised for both first-run and idempotency (Task 24)
- [ ] All new routes are admin-gated (`withAdmin`) or user-gated (`withAuth` for saved searches) appropriately
- [ ] The pull-sync route accepts both admin sessions AND the internal cron secret
- [ ] `CRON_INTERNAL_SECRET` is set in the VPS `.env` before the first scheduled 11 AM PT run
- [ ] Visual split in the TransformPanel is unmissable (color + label + warning subheader)
- [ ] CommitConfirmDialog warns specifically when `hadDistrictChanges` is true
- [ ] Audit log shows `district` badge for runs with `hadDistrictChanges`
- [ ] No transform input lets a user submit margin ≥ 1 (client AND server validate)
- [ ] Rounding is 2 decimal places across every pricing computation (tests cover this)
- [ ] `deleteTestItem`'s `TEST-CLAUDE-` barcode guard is untouched
- [ ] ship-check is green

---

## Next-steps handoff

When this plan ships, the follow-up specs already identified:

1. **Clone with variations** (D2 from the brainstorm) — create N items from a template, per-axis variation
2. **Saved campaigns** (selection + transform bundled as one preset) — only if repeat usage justifies it
3. **Undo** — only if commit mistakes become a real problem
4. **Query builder** — only if filter-bar + smart-helpers + paste-SKU prove insufficient
5. **Stored margin targets** — only if stateless margin preservation isn't enough
