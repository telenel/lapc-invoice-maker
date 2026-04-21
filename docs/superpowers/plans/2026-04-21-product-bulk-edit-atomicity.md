# Product Bulk Edit Atomicity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship one coordinated server + client change so the product edit dialog's bulk save is atomic (zero partial commits) and optimistic concurrency works on PIER, PCOP, and PFS primary locations.

**Architecture:** Extract the per-item SQL work into `applyItemPatchInTransaction` that takes an already-open Prism transaction. `batchUpdateItems` opens one transaction and calls the helper per row — all-or-nothing rollback. Extend `ItemSnapshot` with `primaryLocationId`; server's concurrency SELECT uses it instead of the hardcoded PIER constant. Client dialog replaces sequential per-row PATCH with one atomic `productApi.batch` call.

**Tech Stack:** TypeScript, Next.js (API routes), mssql (Prism database), Zod (boundary validation), React (client dialog), Vitest (unit + route tests), Supabase Admin (mirror — unchanged in this plan).

**Spec:** [`docs/superpowers/specs/2026-04-21-product-bulk-edit-atomicity-design.md`](../specs/2026-04-21-product-bulk-edit-atomicity-design.md)

**Branch:** `fix/product-edit-regressions` (continuing; 4 dead-end hotfix commits stay in history).

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/domains/product/types.ts` | Modify | Extend `ItemSnapshot` with `primaryLocationId`; add `BatchUpdateRowWithBaseline` type |
| `src/domains/product/prism-updates.ts` | Modify | Extract `applyItemPatchInTransaction` helper; shrink `updateGmItem` / `updateTextbookPricing` to thin wrappers; `getItemSnapshot` emits `primaryLocationId`; concurrency SELECT honors `baseline.primaryLocationId` |
| `src/domains/product/prism-batch.ts` | Modify | Rewrite `batchUpdateItems` to one transaction + per-row baseline check; update docstring |
| `src/app/api/products/batch/route.ts` | Modify | Extend `action: "update"` schema to require per-row `baseline`; map 409 with `rowIndex` |
| `src/app/api/products/[sku]/route.ts` | Modify | Extend v2 snapshot Zod schema to include `primaryLocationId` |
| `src/domains/product/api-client.ts` | Modify | `productApi.batch` update rows require `baseline`; parse 409 with `rowIndex` / `sku` / `current` |
| `src/components/products/edit-item-dialog-v2/edit-item-dialog-v2.tsx` | Modify | Replace bulk sequential loop with one `productApi.batch` call; fix single-item baseline to source from `resolvedPrimaryLocationId` slice; delete `bulkPartialCommit` state and "Close and reopen" copy |
| `tests/domains/product/prism-batch.test.ts` | Create | Unit tests proving all-or-nothing semantics of `batchUpdateItems` |
| `tests/app/api/products-batch-route.test.ts` | Modify | Add cases: missing-baseline 400, row-N concurrency 409 with `rowIndex`, generic 500 |
| `tests/app/api/product-patch-route-v2.test.ts` | Modify | Update `getItemSnapshot` mock and baseline fixtures to include `primaryLocationId` |
| `src/components/products/edit-item-dialog-v2.test.tsx` | Modify | Replace sequential-bulk test block (~lines 1070–1250) with atomic-batch assertions |

---

## Task 1: Extend ItemSnapshot type + add BatchUpdateRowWithBaseline

**Why:** Everything downstream depends on this shape. Do this first so the type system guides the rest.

**Files:**
- Modify: `src/domains/product/types.ts:318-325`

- [ ] **Step 1: Read the current `ItemSnapshot` and `BatchUpdateRow` definitions.**

Run: `sed -n '310,345p' src/domains/product/types.ts`

Confirm the lines we're about to change match the spec's understanding.

- [ ] **Step 2: Extend `ItemSnapshot` and add `BatchUpdateRowWithBaseline`.**

Apply this edit to `src/domains/product/types.ts`:

```typescript
/** Baseline snapshot captured when an edit dialog opens, sent back on submit for concurrency check. */
export interface ItemSnapshot {
  sku: number;
  barcode: string | null;
  itemTaxTypeId?: number | null;
  retail: number | null;
  cost: number | null;
  fDiscontinue: 0 | 1;
  /**
   * Which location's `Retail` / `Cost` the snapshot describes. Required when
   * used as a write baseline — tells the server which Inventory row to SELECT
   * for the concurrency check instead of hard-coding PIER.
   */
  primaryLocationId: ProductLocationId;
}
```

And at the bottom of the "Batch" section (right after `BatchUpdateRow`):

```typescript
/**
 * Row shape the batch endpoint needs when callers want atomic, baseline-checked
 * updates. Distinct from `BatchUpdateRow` which is used by the legacy shape-
 * validation pass (no baseline).
 */
export interface BatchUpdateRowWithBaseline {
  sku: number;
  isTextbook?: boolean;
  patch: GmItemPatch | TextbookPatch | ProductEditPatchV2;
  baseline: ItemSnapshot;
}
```

- [ ] **Step 3: Verify with TypeScript compiler.**

Run: `npx tsc --noEmit 2>&1 | head -60`

Expected: TS errors in every file that constructs an `ItemSnapshot` without `primaryLocationId`. Note each reported file — we'll fix them in the following tasks. Don't fix yet; let's keep the diff focused.

- [ ] **Step 4: Commit.**

```bash
git add src/domains/product/types.ts
git commit -m "feat(products): add primaryLocationId to ItemSnapshot, add BatchUpdateRowWithBaseline

Required for making the server's concurrency SELECT honor whichever
location the client snapshotted, instead of hard-coding PIER.
Downstream callers updated in subsequent commits."
```

---

## Task 2: Extract applyItemPatchInTransaction helper in prism-updates.ts

**Why:** `updateGmItem` (lines 170–473) and `updateTextbookPricing` (lines 480–776) are ~300 lines each with identical structure. Extract the inner body so `batchUpdateItems` can reuse it inside one outer transaction without duplicating the field-by-field SQL.

**Files:**
- Modify: `src/domains/product/prism-updates.ts`

- [ ] **Step 1: Add the helper signature and a unified GM/textbook field selector.**

At the top of `prism-updates.ts`, after the `import` block, add:

```typescript
import type { Transaction } from "mssql";

export interface ApplyItemPatchInput {
  sku: number;
  isTextbook: boolean;
  patch: ProductUpdaterInput;
  baseline?: ItemSnapshot;
}

export interface ApplyItemPatchResult {
  sku: number;
  appliedFields: string[];
}
```

- [ ] **Step 2: Write the helper.**

Add this new exported function to `prism-updates.ts`. It is the shared guts of today's `updateGmItem` / `updateTextbookPricing`, parameterized on `isTextbook`, with the concurrency SELECT binding `@loc` to `baseline?.primaryLocationId ?? PIERCE_LOCATION_ID`.

```typescript
/**
 * Apply a single item's patch inside an already-open Prism transaction.
 * Shared by `updateGmItem` / `updateTextbookPricing` (each wraps this with
 * its own tx lifecycle) and `batchUpdateItems` (one outer tx, many calls).
 *
 * Concurrency SELECT binds `@loc` to `baseline.primaryLocationId` when
 * supplied; falls back to `PIERCE_LOCATION_ID` for legacy callers that
 * don't provide a baseline at all. Callers sending a baseline MUST include
 * `primaryLocationId` — the Zod schema on both PATCH surfaces enforces it.
 *
 * On concurrency mismatch, throws `Error` with `code = "CONCURRENT_MODIFICATION"`
 * and `current: ItemSnapshot` echoing the row the server actually saw
 * (including the `primaryLocationId` that drove the read).
 */
export async function applyItemPatchInTransaction(
  transaction: Transaction,
  input: ApplyItemPatchInput,
): Promise<ApplyItemPatchResult> {
  const { sku, isTextbook, patch, baseline } = input;
  const concurrencyLocationId = baseline?.primaryLocationId ?? PIERCE_LOCATION_ID;

  // Verify row exists + optional concurrency check
  const check = await transaction
    .request()
    .input("sku", sql.Int, sku)
    .input("loc", sql.Int, concurrencyLocationId)
    .query<{
      BarCode: string | null;
      ItemTaxTypeID: number | null;
      Retail: number | null;
      Cost: number | null;
      fDiscontinue: number | null;
    }>(`
      SELECT LTRIM(RTRIM(i.BarCode)) AS BarCode,
             i.ItemTaxTypeID,
             inv.Retail, inv.Cost, i.fDiscontinue
      FROM Item i
      LEFT JOIN Inventory inv ON inv.SKU = i.SKU AND inv.LocationID = @loc
      WHERE i.SKU = @sku
    `);
  const current = check.recordset[0];
  if (!current) {
    throw new Error(`Item SKU ${sku} not found`);
  }

  if (baseline) {
    const currentBarcode = current.BarCode && current.BarCode.length > 0 ? current.BarCode : null;
    const currentTaxTypeId = current.ItemTaxTypeID == null ? null : Number(current.ItemTaxTypeID);
    const currentRetail = current.Retail == null ? null : Number(current.Retail);
    const currentCost = current.Cost == null ? null : Number(current.Cost);
    const currentFDisc = (current.fDiscontinue === 1 ? 1 : 0) as 0 | 1;
    if (
      currentBarcode !== baseline.barcode ||
      (baseline.itemTaxTypeId !== undefined &&
        currentTaxTypeId !== baseline.itemTaxTypeId) ||
      currentRetail !== baseline.retail ||
      currentCost !== baseline.cost ||
      currentFDisc !== baseline.fDiscontinue
    ) {
      const err = new Error("CONCURRENT_MODIFICATION") as Error & { code: string; current: ItemSnapshot };
      err.code = "CONCURRENT_MODIFICATION";
      err.current = {
        sku,
        barcode: currentBarcode,
        itemTaxTypeId: currentTaxTypeId,
        retail: currentRetail,
        cost: currentCost,
        fDiscontinue: currentFDisc,
        primaryLocationId: concurrencyLocationId as ProductLocationId,
      };
      throw err;
    }
  }

  const normalizedPatch = normalizeUpdaterInput(patch);
  const applied: string[] = [];

  if (isTextbook) {
    // Verbatim from OLD updateTextbookPricing body, lines 533–768 of the
    // pre-refactor src/domains/product/prism-updates.ts — everything from
    // `const itemSet: string[] = [];` (after the normalizedPatch line) down
    // to the final `for (const inventoryPatch of getInventoryPatches(...))`
    // loop, inclusive. DO NOT include the surrounding `try/await
    // transaction.begin()` / `await transaction.commit()` / `catch rollback`
    // shell — the wrapper in Step 3 owns that. DO NOT include the
    // `check = await transaction.request()...` concurrency SELECT — already
    // handled above. DO NOT redeclare `normalizedPatch` or `applied` — they
    // are already in scope above.
    //
    // Concretely, paste in the block that starts with
    //   `const itemSet: string[] = [];`
    // and ends with the closing `}` of the inventory for-loop (before
    // `await transaction.commit()`).
  } else {
    // Verbatim from OLD updateGmItem body, lines 232–466 of the
    // pre-refactor src/domains/product/prism-updates.ts — starting from
    // `const itemSet: string[] = [];` (after the normalizedPatch line)
    // through the final inventory for-loop, inclusive. Same exclusions
    // as the textbook branch above.
  }

  return { sku, appliedFields: applied };
}
```

Engineer note: this is a mechanical copy-paste transformation. Before starting, `git show HEAD:src/domains/product/prism-updates.ts > /tmp/prism-updates-pre.ts` to have a stable reference of the pre-refactor file. Open the new helper and the reference side-by-side; paste the GM branch into the `else` and the textbook branch into the `if (isTextbook)`. The only semantic change in the helper versus the originals is: (1) the `@loc` binding at the top, (2) the `primaryLocationId` added to the 409 `current` payload.

- [ ] **Step 3: Shrink `updateGmItem` and `updateTextbookPricing` to wrappers.**

Replace the existing `updateGmItem` body (lines 170–473) with:

```typescript
export async function updateGmItem(
  sku: number,
  patch: ProductUpdaterInput,
  expectedSnapshot?: ItemSnapshot,
): Promise<UpdateGmItemResult> {
  const pool = await getPrismPool();
  const transaction = pool.transaction();
  await transaction.begin();
  try {
    const result = await applyItemPatchInTransaction(transaction, {
      sku,
      isTextbook: false,
      patch,
      baseline: expectedSnapshot,
    });
    await transaction.commit();
    return result;
  } catch (err) {
    try { await transaction.rollback(); } catch { /* swallow */ }
    throw err;
  }
}
```

And `updateTextbookPricing` (lines 480–776):

```typescript
export async function updateTextbookPricing(
  sku: number,
  patch: ProductUpdaterInput,
  expectedSnapshot?: ItemSnapshot,
): Promise<UpdateGmItemResult> {
  const pool = await getPrismPool();
  const transaction = pool.transaction();
  await transaction.begin();
  try {
    const result = await applyItemPatchInTransaction(transaction, {
      sku,
      isTextbook: true,
      patch,
      baseline: expectedSnapshot,
    });
    await transaction.commit();
    return result;
  } catch (err) {
    try { await transaction.rollback(); } catch { /* swallow */ }
    throw err;
  }
}
```

- [ ] **Step 4: Update `getItemSnapshot` to emit `primaryLocationId`.**

In the return at line 51–58 of `prism-updates.ts`:

```typescript
return {
  sku: row.SKU,
  barcode: row.BarCode && row.BarCode.length > 0 ? row.BarCode : null,
  itemTaxTypeId: row.ItemTaxTypeID == null ? null : Number(row.ItemTaxTypeID),
  retail: row.Retail == null ? null : Number(row.Retail),
  cost: row.Cost == null ? null : Number(row.Cost),
  fDiscontinue: (row.fDiscontinue === 1 ? 1 : 0) as 0 | 1,
  primaryLocationId: PIERCE_LOCATION_ID,
};
```

- [ ] **Step 5: Run the existing route tests to verify no regressions.**

Run: `npm test -- tests/app/api/product-patch-route-v2.test.ts tests/app/api/product-detail-route.test.ts`

Expected: the existing tests' `getItemSnapshot` mocks will be missing `primaryLocationId` — TypeScript will complain but the test runtime will mostly pass. If runtime asserts fail on the mocks specifically, move to Step 6.

- [ ] **Step 6: Update the existing test fixtures to satisfy the new required field.**

In `tests/app/api/product-patch-route-v2.test.ts`, the `getItemSnapshot` mock (look for `prismMocks.getItemSnapshot.mockResolvedValue({...})`) and any baseline object inside a PATCH body payload need `primaryLocationId: 2` added.

Run a quick scan: `npx tsc --noEmit 2>&1 | grep -i "primaryLocationId" | head -30`

Every file the compiler names, fix by adding `primaryLocationId: 2` to the `ItemSnapshot` literal. PIER is the default so test behavior doesn't change.

- [ ] **Step 7: Full test run to confirm the refactor is green.**

Run: `npm test 2>&1 | tail -30`

Expected: all tests pass. Refactor is semantic no-op (single-item behavior identical; only new producers emit `primaryLocationId`; server's `@loc` fallback keeps honoring PIER when baseline is absent, and honors `primaryLocationId` when present — but no current caller sends one yet).

- [ ] **Step 8: Commit.**

```bash
git add src/domains/product/prism-updates.ts tests/app/api/product-patch-route-v2.test.ts
git commit -m "refactor(products): extract applyItemPatchInTransaction helper

Shared body for updateGmItem / updateTextbookPricing. Concurrency
SELECT now binds @loc to baseline.primaryLocationId when supplied,
falling back to PIERCE_LOCATION_ID for legacy callers. No behavior
change yet — no current caller sends primaryLocationId.

Prepares for batchUpdateItems to reuse this helper inside one outer
transaction instead of opening one transaction per row."
```

---

## Task 3: Rewrite batchUpdateItems transactionally + baseline-aware (TDD)

**Why:** This is the headline fix. One Prism transaction covers the whole selection. Each row's baseline is checked before its UPDATE. Any failure rolls back every row.

**Files:**
- Create: `tests/domains/product/prism-batch.test.ts`
- Modify: `src/domains/product/prism-batch.ts:161-174`

- [ ] **Step 1: Write the failing zero-commit test (RED).**

Create `tests/domains/product/prism-batch.test.ts`:

```typescript
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismLibMocks = vi.hoisted(() => ({
  getPrismPool: vi.fn(),
  sql: {
    Int: "Int",
    VarChar: () => "VarChar",
    Money: "Money",
    Decimal: () => "Decimal",
    Bit: "Bit",
    TinyInt: "TinyInt",
    SmallInt: "SmallInt",
    DateTime: "DateTime",
    Numeric: () => "Numeric",
  },
}));

vi.mock("@/lib/prism", () => prismLibMocks);

/**
 * Minimal mssql-shaped fake: one Transaction object whose `request()`
 * returns chainable Request fakes that record every executed query.
 */
function makeFakePool(options: {
  /** Called per executed query. Return the recordset to emit. */
  onQuery: (sql: string) => unknown[];
  /** Mutated so tests can assert lifecycle. */
  lifecycle: { began: number; committed: number; rolledBack: number };
}) {
  const { onQuery, lifecycle } = options;
  const makeRequest = () => {
    const req = {
      input: vi.fn().mockImplementation(() => req),
      query: vi.fn().mockImplementation(async (sqlText: string) => ({
        recordset: onQuery(sqlText),
      })),
      execute: vi.fn().mockResolvedValue({ recordsets: [[]] }),
    };
    return req;
  };
  const transaction = {
    begin: vi.fn().mockImplementation(async () => { lifecycle.began += 1; }),
    commit: vi.fn().mockImplementation(async () => { lifecycle.committed += 1; }),
    rollback: vi.fn().mockImplementation(async () => { lifecycle.rolledBack += 1; }),
    request: vi.fn().mockImplementation(makeRequest),
  };
  return { transaction: vi.fn().mockReturnValue(transaction), request: vi.fn().mockImplementation(makeRequest) };
}

describe("batchUpdateItems", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("rolls back every row when the second row's baseline mismatches", async () => {
    const lifecycle = { began: 0, committed: 0, rolledBack: 0 };

    // Row 1's SELECT returns matching state; row 2's returns a different retail.
    let selectCount = 0;
    const pool = makeFakePool({
      lifecycle,
      onQuery: (sqlText) => {
        if (!sqlText.includes("SELECT")) return [];
        selectCount += 1;
        if (selectCount === 1) {
          return [{ BarCode: "AAA", ItemTaxTypeID: 6, Retail: 10, Cost: 5, fDiscontinue: 0 }];
        }
        return [{ BarCode: "BBB", ItemTaxTypeID: 6, Retail: 999, Cost: 5, fDiscontinue: 0 }];
      },
    });

    prismLibMocks.getPrismPool.mockResolvedValue(pool);

    const { batchUpdateItems } = await import("@/domains/product/prism-batch");

    const rows = [
      { sku: 101, isTextbook: false, patch: { retail: 11 }, baseline: { sku: 101, barcode: "AAA", retail: 10, cost: 5, fDiscontinue: 0 as 0, primaryLocationId: 2 as const } },
      { sku: 102, isTextbook: false, patch: { retail: 11 }, baseline: { sku: 102, barcode: "BBB", retail: 10, cost: 5, fDiscontinue: 0 as 0, primaryLocationId: 2 as const } },
    ];

    await expect(batchUpdateItems(rows)).rejects.toMatchObject({
      code: "CONCURRENT_MODIFICATION",
      rowIndex: 1,
    });

    expect(lifecycle.began).toBe(1);
    expect(lifecycle.committed).toBe(0);
    expect(lifecycle.rolledBack).toBe(1);
  });
});
```

- [ ] **Step 2: Run the test and confirm RED.**

Run: `npm test -- tests/domains/product/prism-batch.test.ts 2>&1 | tail -30`

Expected: the test fails because `batchUpdateItems` today either (a) doesn't accept `baseline` in its row shape, or (b) uses per-row transactions so lifecycle counts don't match. Capture the exact failure message in your head — we want the rewrite to turn this green.

- [ ] **Step 3: Rewrite `batchUpdateItems` in `src/domains/product/prism-batch.ts`.**

Replace lines 148–174 with:

```typescript
/**
 * Apply N item edits in ONE Prism transaction. Each row's baseline is
 * checked inside the transaction before its UPDATE; any throw (concurrency
 * mismatch or SQL failure) rolls back every row. Caller gets zero
 * partial-commit hazard.
 *
 * Concurrency errors carry `code: "CONCURRENT_MODIFICATION"`, `rowIndex`
 * (the index of the row that failed, 0-based), `sku`, and `current` (the
 * ItemSnapshot the server actually saw).
 */
export async function batchUpdateItems(
  rows: BatchUpdateRowWithBaseline[],
): Promise<number[]> {
  if (rows.length === 0) return [];
  const pool = await getPrismPool();
  const transaction = pool.transaction();
  await transaction.begin();

  const updated: number[] = [];
  try {
    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i];
      try {
        await applyItemPatchInTransaction(transaction, {
          sku: row.sku,
          isTextbook: row.isTextbook ?? false,
          patch: row.patch,
          baseline: row.baseline,
        });
        updated.push(row.sku);
      } catch (err) {
        // Attach rowIndex + sku so the route can shape a precise 409 payload.
        if (err instanceof Error) {
          (err as Error & { rowIndex?: number; sku?: number }).rowIndex = i;
          (err as Error & { rowIndex?: number; sku?: number }).sku = row.sku;
        }
        throw err;
      }
    }
    await transaction.commit();
    return updated;
  } catch (err) {
    try { await transaction.rollback(); } catch { /* swallow */ }
    throw err;
  }
}
```

And update the imports at the top of `src/domains/product/prism-batch.ts`:

```typescript
import type { BatchCreateRow, BatchUpdateRow, BatchUpdateRowWithBaseline, BatchValidationError, GmItemPatch, TextbookPatch } from "./types";
import { applyItemPatchInTransaction } from "./prism-updates";
```

(The old `updateGmItem, updateTextbookPricing` imports are no longer referenced — `batchUpdateItems` now calls `applyItemPatchInTransaction` directly. Remove them from the import and delete any resulting unused-import lint warnings.)

And update the file-top docstring (lines 1–5):

```typescript
/**
 * Batch writes to Prism. `batchCreateGmItems`, `batchHardDeleteItems`, and
 * `batchUpdateItems` each run under a single Prism transaction — any row-
 * level failure rolls back every row in the batch. `batchUpdateItems` also
 * accepts per-row `baseline` snapshots for optimistic concurrency; failures
 * throw with `code: "CONCURRENT_MODIFICATION"` and `rowIndex`.
 *
 * Pre-validation (FK existence, duplicate-barcode against live Prism) is in
 * validateBatchAgainstPrism; shape validation is in batch-validation.ts.
 */
```

- [ ] **Step 4: Run the test and confirm GREEN.**

Run: `npm test -- tests/domains/product/prism-batch.test.ts 2>&1 | tail -30`

Expected: the test passes. `lifecycle.began === 1`, `committed === 0`, `rolledBack === 1`.

- [ ] **Step 5: Add happy-path and mixed-row tests.**

Append to `tests/domains/product/prism-batch.test.ts`:

```typescript
  it("commits once when all baselines match", async () => {
    const lifecycle = { began: 0, committed: 0, rolledBack: 0 };
    const pool = makeFakePool({
      lifecycle,
      onQuery: (sqlText) => {
        if (!sqlText.includes("SELECT")) return [];
        return [{ BarCode: "AAA", ItemTaxTypeID: 6, Retail: 10, Cost: 5, fDiscontinue: 0 }];
      },
    });
    prismLibMocks.getPrismPool.mockResolvedValue(pool);

    const { batchUpdateItems } = await import("@/domains/product/prism-batch");

    const rows = [
      { sku: 101, isTextbook: false, patch: { retail: 11 }, baseline: { sku: 101, barcode: "AAA", retail: 10, cost: 5, fDiscontinue: 0 as 0, primaryLocationId: 2 as const } },
      { sku: 102, isTextbook: true, patch: { retail: 12 }, baseline: { sku: 102, barcode: "AAA", retail: 10, cost: 5, fDiscontinue: 0 as 0, primaryLocationId: 2 as const } },
    ];

    await expect(batchUpdateItems(rows)).resolves.toEqual([101, 102]);
    expect(lifecycle.began).toBe(1);
    expect(lifecycle.committed).toBe(1);
    expect(lifecycle.rolledBack).toBe(0);
  });

  it("returns [] and opens no transaction for an empty row list", async () => {
    const lifecycle = { began: 0, committed: 0, rolledBack: 0 };
    const pool = makeFakePool({ lifecycle, onQuery: () => [] });
    prismLibMocks.getPrismPool.mockResolvedValue(pool);

    const { batchUpdateItems } = await import("@/domains/product/prism-batch");

    await expect(batchUpdateItems([])).resolves.toEqual([]);
    expect(lifecycle.began).toBe(0);
  });

  it("rolls back when row 3 raises a non-concurrency SQL error", async () => {
    const lifecycle = { began: 0, committed: 0, rolledBack: 0 };
    let selectCount = 0;
    const pool = makeFakePool({
      lifecycle,
      onQuery: (sqlText) => {
        if (!sqlText.includes("SELECT")) {
          // row 3's UPDATE throws
          if (selectCount >= 3) throw new Error("FK violation");
          return [];
        }
        selectCount += 1;
        return [{ BarCode: "AAA", ItemTaxTypeID: 6, Retail: 10, Cost: 5, fDiscontinue: 0 }];
      },
    });
    prismLibMocks.getPrismPool.mockResolvedValue(pool);

    const { batchUpdateItems } = await import("@/domains/product/prism-batch");

    const rows = [101, 102, 103].map((sku) => ({
      sku, isTextbook: false, patch: { retail: 11 },
      baseline: { sku, barcode: "AAA", retail: 10, cost: 5, fDiscontinue: 0 as 0, primaryLocationId: 2 as const },
    }));

    await expect(batchUpdateItems(rows)).rejects.toMatchObject({ rowIndex: 2, sku: 103 });
    expect(lifecycle.rolledBack).toBe(1);
    expect(lifecycle.committed).toBe(0);
  });
```

- [ ] **Step 6: Run the new tests and confirm all green.**

Run: `npm test -- tests/domains/product/prism-batch.test.ts 2>&1 | tail -30`

Expected: 4 tests pass.

- [ ] **Step 7: Run the full test suite.**

Run: `npm test 2>&1 | tail -10`

Expected: all tests pass. The existing `tests/app/api/products-batch-route.test.ts` still passes because it mocks `batchUpdateItems` at the module level — internal signature change is invisible there.

- [ ] **Step 8: Commit.**

```bash
git add tests/domains/product/prism-batch.test.ts src/domains/product/prism-batch.ts
git commit -m "feat(products): make batchUpdateItems transactional and baseline-aware

One Prism transaction wraps all rows. Each row's baseline is checked
via applyItemPatchInTransaction before its UPDATE. Any throw rolls
back every row — zero partial-commit hazard.

Errors carry code, rowIndex, sku so the route layer can shape 409s
with precise row context."
```

---

## Task 4: Extend route schemas for baseline + 409 mapping

**Why:** The wire contract has to carry `baseline` per row (with required `primaryLocationId`) and respond with `rowIndex` on 409 so the dialog can show which row conflicted.

**Files:**
- Modify: `src/app/api/products/batch/route.ts:42-49, 114-123`
- Modify: `src/app/api/products/[sku]/route.ts` (the v2 `snapshotSchema`)
- Modify: `tests/app/api/products-batch-route.test.ts`

- [ ] **Step 1: Find and extend the v2 snapshot Zod schema in `[sku]/route.ts`.**

Run: `grep -n "snapshotSchema\|baseline:" src/app/api/products/[sku]/route.ts | head -20`

Find the `z.object({ sku, barcode, itemTaxTypeId, retail, cost, fDiscontinue })` that defines the snapshot shape for v2 PATCH bodies. Add `primaryLocationId: z.union([z.literal(2), z.literal(3), z.literal(4)])` to it (required; PBO/5 excluded per spec rule 3).

- [ ] **Step 2: Add the same shared snapshot schema to the batch route.**

In `src/app/api/products/batch/route.ts`, replace the `action: "update"` branch of the `bodySchema` discriminated union with:

```typescript
z.object({
  action: z.literal("update"),
  rows: z.array(z.object({
    sku: z.number().int().positive(),
    isTextbook: z.boolean().optional(),
    patch: z.record(z.string(), z.any()),
    baseline: z.object({
      sku: z.number().int().positive(),
      barcode: z.string().nullable(),
      itemTaxTypeId: z.number().int().nullable().optional(),
      retail: z.number().nullable(),
      cost: z.number().nullable(),
      fDiscontinue: z.union([z.literal(0), z.literal(1)]),
      primaryLocationId: z.union([z.literal(2), z.literal(3), z.literal(4)]),
    }),
  })),
}),
```

- [ ] **Step 3: Update the `batchUpdateItems` call site in the batch route to thread baseline + shape 409.**

Replace the `action === "update"` body in `POST` (approximately lines 114–123 of `src/app/api/products/batch/route.ts`) with:

```typescript
if (parsed.data.action === "update") {
  const errors = await validateBatchUpdateAgainstPrism(parsed.data.rows.map((r) => ({ sku: r.sku, patch: r.patch })));
  if (errors.length > 0) return NextResponse.json({ errors }, { status: 400 });
  try {
    const skus = await batchUpdateItems(parsed.data.rows.map((r) => ({
      sku: r.sku,
      patch: r.patch,
      isTextbook: !!r.isTextbook,
      baseline: r.baseline,
    })));
    return NextResponse.json({ action: "update", count: skus.length, skus });
  } catch (err) {
    if (err instanceof Error && (err as Error & { code?: string }).code === "CONCURRENT_MODIFICATION") {
      const e = err as Error & { rowIndex?: number; sku?: number; current?: unknown };
      return NextResponse.json(
        { error: "CONCURRENT_MODIFICATION", rowIndex: e.rowIndex ?? null, sku: e.sku ?? null, current: e.current ?? null },
        { status: 409 },
      );
    }
    throw err;
  }
}
```

- [ ] **Step 4: Write failing route tests for the new schema + 409 shape.**

Add to `tests/app/api/products-batch-route.test.ts` (inside the `describe("POST /api/products/batch", ...)` block):

```typescript
  it("rejects an update row without a baseline", async () => {
    const { POST } = await loadRouteModule();
    const response = await POST(new NextRequest("http://localhost/api/products/batch", {
      method: "POST",
      body: JSON.stringify({
        action: "update",
        rows: [{ sku: 101, patch: { retail: 11 } }],
      }),
    }));
    expect(response.status).toBe(400);
  });

  it("forwards CONCURRENT_MODIFICATION with rowIndex + sku as 409", async () => {
    prismBatchMocks.validateBatchUpdateAgainstPrism.mockResolvedValue([]);
    const err = Object.assign(new Error("CONCURRENT_MODIFICATION"), {
      code: "CONCURRENT_MODIFICATION",
      rowIndex: 1,
      sku: 202,
      current: { sku: 202, barcode: "X", retail: 5, cost: 2, fDiscontinue: 0, primaryLocationId: 3 },
    });
    prismBatchMocks.batchUpdateItems.mockRejectedValue(err);

    const { POST } = await loadRouteModule();
    const body = {
      action: "update",
      rows: [101, 202].map((sku) => ({
        sku,
        patch: { retail: 11 },
        baseline: { sku, barcode: "X", retail: 5, cost: 2, fDiscontinue: 0, primaryLocationId: 3 },
      })),
    };
    const response = await POST(new NextRequest("http://localhost/api/products/batch", {
      method: "POST",
      body: JSON.stringify(body),
    }));
    expect(response.status).toBe(409);
    const json = await response.json();
    expect(json).toMatchObject({ error: "CONCURRENT_MODIFICATION", rowIndex: 1, sku: 202 });
  });

  it("returns 200 with updated skus on happy path", async () => {
    prismBatchMocks.validateBatchUpdateAgainstPrism.mockResolvedValue([]);
    prismBatchMocks.batchUpdateItems.mockResolvedValue([101, 202]);

    const { POST } = await loadRouteModule();
    const body = {
      action: "update",
      rows: [101, 202].map((sku) => ({
        sku,
        patch: { retail: 11 },
        baseline: { sku, barcode: "X", retail: 5, cost: 2, fDiscontinue: 0, primaryLocationId: 2 },
      })),
    };
    const response = await POST(new NextRequest("http://localhost/api/products/batch", {
      method: "POST",
      body: JSON.stringify(body),
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ action: "update", count: 2, skus: [101, 202] });
  });
```

- [ ] **Step 5: Run the route tests.**

Run: `npm test -- tests/app/api/products-batch-route.test.ts 2>&1 | tail -20`

Expected: the three new tests pass. Any pre-existing update-action tests that send rows without baseline will now fail — update them to include the required baseline (add `baseline: { ...ItemSnapshot, primaryLocationId: 2 }` to each row in those test bodies).

- [ ] **Step 6: Full test run.**

Run: `npm test 2>&1 | tail -10`

Expected: all tests pass.

- [ ] **Step 7: Commit.**

```bash
git add src/app/api/products/batch/route.ts src/app/api/products/[sku]/route.ts tests/app/api/products-batch-route.test.ts
git commit -m "feat(products): batch update route requires baseline and emits rowIndex 409

action=update rows now carry a required baseline (ItemSnapshot with
primaryLocationId). CONCURRENT_MODIFICATION from batchUpdateItems
is surfaced as 409 { error, rowIndex, sku, current } so the client
can show which row conflicted. V1 single-item PATCH schema also
accepts the primaryLocationId baseline field."
```

---

## Task 5: Update productApi.batch client signature + 409 parsing

**Why:** The client-side contract mirrors the server change — typed `baseline` on update rows, and 409 surfaces the same shape as single-item `productApi.update`.

**Files:**
- Modify: `src/domains/product/api-client.ts:275-296`

- [ ] **Step 1: Update the `productApi.batch` method.**

Replace the existing `batch` method (approximately lines 275–296) with:

```typescript
  async batch(
    body:
      | { action: "create"; rows: BatchCreateRow[] }
      | { action: "update"; rows: Array<{ sku: number; patch: GmItemPatch | TextbookPatch | ProductEditPatchV2; isTextbook?: boolean; baseline: ItemSnapshot }> }
      | { action: "discontinue"; skus: number[] }
      | { action: "hard-delete"; skus: number[] },
  ): Promise<{ action: string; count: number; skus: number[] } | { errors: BatchValidationError[] }> {
    const res = await fetch("/api/products/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.status === 409) {
      const data = await res.json();
      const err = new Error("CONCURRENT_MODIFICATION") as Error & {
        code: string;
        rowIndex?: number | null;
        sku?: number | null;
        current?: unknown;
      };
      err.code = "CONCURRENT_MODIFICATION";
      err.rowIndex = data?.rowIndex ?? null;
      err.sku = data?.sku ?? null;
      err.current = data?.current ?? null;
      throw err;
    }
    if (res.status === 400) {
      const data = await res.json();
      if (data.errors) return { errors: data.errors };
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? `HTTP ${res.status}`);
    }
    return res.json();
  },
```

- [ ] **Step 2: Run the tsc check to see what else needs updating.**

Run: `npx tsc --noEmit 2>&1 | grep -i "api-client\|productApi.batch" | head -20`

Expected: The dialog file (`edit-item-dialog-v2.tsx`) may now show type errors on its `productApi.batch` call — we'll fix those in Task 6. Other callers of `productApi.batch` that don't use `action: "update"` are unaffected.

- [ ] **Step 3: Commit.**

```bash
git add src/domains/product/api-client.ts
git commit -m "feat(products): productApi.batch update rows require baseline; parse 409 with rowIndex

Mirrors the server contract. 409 now throws an Error with code,
rowIndex, sku, current — same pattern productApi.update already uses."
```

---

## Task 6: Rewrite dialog bulk branch + fix single-item primaryLocationId source (TDD)

**Why:** Atomic bulk replaces the sequential loop. Single-item baseline sources from `resolvedPrimaryLocationId` instead of hardcoded `2`. `bulkPartialCommit` state and "Close and reopen" copy are deleted — no longer needed because the batch is all-or-nothing.

**Files:**
- Modify: `src/components/products/edit-item-dialog-v2/edit-item-dialog-v2.tsx:83-91, 143, 255-399, 510`
- Modify: `src/components/products/edit-item-dialog-v2.test.tsx`

- [ ] **Step 1: Update the bulk-save tests to expect one atomic call (RED).**

In `src/components/products/edit-item-dialog-v2.test.tsx`, find the sequential-bulk block (approximately lines 1070–1250; search for `productApi.update` being called multiple times in a bulk scenario). Replace with:

```typescript
  describe("bulk save path", () => {
    it("calls productApi.batch exactly once with all rows", async () => {
      const batch = vi.spyOn(productApi, "batch").mockResolvedValue({ action: "update", count: 2, skus: [101, 102] });
      const onSaved = vi.fn();
      renderDialog({
        items: [
          { sku: 101, barcode: "AAA", retail: 10, cost: 5, fDiscontinue: 0, isTextbook: false },
          { sku: 102, barcode: "BBB", retail: 20, cost: 8, fDiscontinue: 0, isTextbook: false },
        ],
        primaryLocationId: 3,
        onSaved,
      });

      await userEvent.type(screen.getByLabelText(/catalog number/i), "CAT-X");
      await userEvent.click(screen.getByRole("button", { name: /save/i }));

      await waitFor(() => expect(batch).toHaveBeenCalledTimes(1));
      const [call] = batch.mock.calls[0];
      expect(call.action).toBe("update");
      expect(call.rows).toHaveLength(2);
      for (const row of call.rows) {
        expect(row.baseline.primaryLocationId).toBe(3);
      }
      expect(onSaved).toHaveBeenCalledWith([101, 102]);
    });

    it("keeps dialog open and does not call onSaved when batch throws", async () => {
      const err = Object.assign(new Error("CONCURRENT_MODIFICATION"), {
        code: "CONCURRENT_MODIFICATION",
        rowIndex: 1,
        sku: 102,
      });
      vi.spyOn(productApi, "batch").mockRejectedValue(err);
      const onSaved = vi.fn();
      const onOpenChange = vi.fn();
      renderDialog({
        items: [
          { sku: 101, barcode: "AAA", retail: 10, cost: 5, fDiscontinue: 0, isTextbook: false },
          { sku: 102, barcode: "BBB", retail: 20, cost: 8, fDiscontinue: 0, isTextbook: false },
        ],
        primaryLocationId: 2,
        onSaved,
        onOpenChange,
      });

      await userEvent.type(screen.getByLabelText(/catalog number/i), "CAT-X");
      await userEvent.click(screen.getByRole("button", { name: /save/i }));

      await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/CONCURRENT_MODIFICATION|row 2|SKU 102/i));
      expect(onSaved).not.toHaveBeenCalled();
      expect(onOpenChange).not.toHaveBeenCalledWith(false);
      // Save re-enables immediately — no bulkPartialCommit gate.
      expect(screen.getByRole("button", { name: /save/i })).not.toBeDisabled();
    });

    it("single-item save sources baseline retail from the resolved primary location slice", async () => {
      const update = vi.spyOn(productApi, "update").mockResolvedValue({ sku: 101, appliedFields: ["catalogNumber"] });

      // Use the existing `makeEditDetailFixture` helper (or equivalent)
      // that the sibling tests in this file already use for ProductEditDetails.
      // Search the file for `inventoryByLocation:` to find the pattern the
      // other tests use and follow it. The critical thing for this test is:
      //   - primaryLocationId prop = 3 (PCOP)
      //   - detail.inventoryByLocation has entries for 2 AND 3 with
      //     DIFFERENT retail/cost values
      //   - items[0].retail/cost = PCOP's values (what the browse summary holds)
      const detail = makeEditDetailFixture({
        sku: 101,
        barcode: "AAA",
        inventoryByLocation: [
          { locationId: 2, retail: 10, cost: 5 },   // PIER
          { locationId: 3, retail: 30, cost: 15 },  // PCOP — the primary
        ],
      });

      renderDialog({
        items: [{ sku: 101, barcode: "AAA", retail: 30, cost: 15, fDiscontinue: 0, isTextbook: false }],
        primaryLocationId: 3,
        detail,
      });

      await userEvent.type(screen.getByLabelText(/catalog number/i), "CAT-X");
      await userEvent.click(screen.getByRole("button", { name: /save/i }));

      await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
      const call = update.mock.calls[0][1];
      expect(call.baseline.primaryLocationId).toBe(3);
      expect(call.baseline.retail).toBe(30);
      expect(call.baseline.cost).toBe(15);
    });
  });
```

Engineer note: the test harness imports and renderDialog helper already exists elsewhere in this file. If the single-item test's `detail` literal needs more fields to satisfy `ProductEditDetails`, use the existing fixture helper the sibling tests use. The point is primaryLocationId + retail + cost, not a full detail fake.

- [ ] **Step 2: Run the new tests — expect RED.**

Run: `npm test -- src/components/products/edit-item-dialog-v2.test.tsx 2>&1 | tail -30`

Expected: multiple failures. (a) `productApi.batch` is not called (dialog still loops per-row); (b) single-item baseline retail is 99 (from items[0].retail, primary-location value) and `primaryLocationId` is missing — the fixture says PCOP retail should be 30; (c) `onSaved` IS called even on failure today, whereas the new test expects NOT called.

- [ ] **Step 3: Rewrite the dialog `handleSave`.**

In `src/components/products/edit-item-dialog-v2/edit-item-dialog-v2.tsx`:

Replace lines 83–91 (the `bulkPartialCommit` state and its comment block) — delete entirely.

Replace line 143 (`setBulkPartialCommit(false);` inside the open-close effect) — delete.

Replace the entire `handleSave` function (lines 255–399) with:

```typescript
  async function handleSave() {
    const inventoryPatch = buildInventoryPatch(
      form,
      baselineForm,
      inventoryByLocation,
      baselineInventory,
      resolvedPrimaryLocationId,
      isBulk,
    );
    const v2Patch = {
      ...buildV2Patch(form, baselineForm, isBulk, isTextbookRow),
      inventory: inventoryPatch,
    };
    const hasV2Changes =
      hasPatchFields(v2Patch.item ?? {}) ||
      hasPatchFields(v2Patch.gm ?? {}) ||
      hasPatchFields(v2Patch.textbook ?? {}) ||
      (v2Patch.inventory?.length ?? 0) > 0;

    if (!hasV2Changes) {
      onOpenChange(false);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      if (items.length === 1) {
        const item = items[0];
        // Source retail/cost from whatever `resolvedPrimaryLocationId` resolves to
        // (PIER/PCOP/PFS). Falls back to `item.retail` / `item.cost` (which already
        // reflects the browse row's primary-location values) if the slice isn't
        // loaded yet. Server's concurrency SELECT uses `baseline.primaryLocationId`
        // as `@loc`, so client and server read the same row.
        const primarySlice = detail?.inventoryByLocation.find(
          (entry) => entry.locationId === resolvedPrimaryLocationId,
        );
        await productApi.update(item.sku, {
          mode: "v2",
          patch: v2Patch,
          baseline: {
            sku: item.sku,
            barcode: detail?.barcode ?? item.barcode,
            retail: primarySlice?.retail ?? item.retail,
            cost: primarySlice?.cost ?? item.cost,
            fDiscontinue: item.fDiscontinue,
            primaryLocationId: resolvedPrimaryLocationId,
          },
        });
      } else {
        // Atomic bulk save: ONE server call wraps all rows in one Prism
        // transaction. Zero partial-commit hazard — either every row
        // commits or none do. Any failure throws; the catch below surfaces
        // the error and leaves the dialog open for retry.
        const result = await productApi.batch({
          action: "update",
          rows: items.map((item) => ({
            sku: item.sku,
            isTextbook: item.isTextbook ?? false,
            patch: v2Patch,
            baseline: {
              sku: item.sku,
              barcode: item.barcode,
              retail: item.retail,
              cost: item.cost,
              fDiscontinue: item.fDiscontinue,
              primaryLocationId: resolvedPrimaryLocationId,
            },
          })),
        });
        if ("errors" in result) {
          setError(
            `Validation failed: ${result.errors.map((e) => `${e.field}: ${e.message}`).join("; ")}`,
          );
          return;
        }
      }

      onSaved?.(items.map((item) => item.sku));
      onOpenChange(false);
    } catch (err) {
      const e = err as Error & { code?: string; rowIndex?: number | null; sku?: number | null };
      if (e.code === "CONCURRENT_MODIFICATION" && e.rowIndex != null && e.sku != null) {
        setError(
          `Row ${e.rowIndex + 1} (SKU ${e.sku}) has been modified since you opened this dialog. ` +
          `No changes were saved. Close this dialog and retry to see the latest values.`,
        );
      } else {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setSaving(false);
    }
  }
```

Also remove the `bulkPartialCommit` reference from the Save button (around line 510):

```tsx
<Button
  onClick={() => void handleSave()}
  disabled={saving || detailLoading}
>
  {saving ? "Saving…" : "Save changes"}
</Button>
```

- [ ] **Step 4: Run the dialog tests and confirm GREEN.**

Run: `npm test -- src/components/products/edit-item-dialog-v2.test.tsx 2>&1 | tail -30`

Expected: the three new bulk tests pass. Any previous tests that asserted `bulkPartialCommit` state or "Close and reopen" copy fail — delete them (no longer applicable).

- [ ] **Step 5: Clean up any tests that reference deleted behavior.**

Grep the test file for obsolete assertions:

```bash
grep -n "bulkPartialCommit\|Close and reopen\|Saved [0-9]* of [0-9]*" src/components/products/edit-item-dialog-v2.test.tsx
```

Delete matching test blocks. The new three bulk tests cover the replaced ground.

- [ ] **Step 6: Full test run + typecheck + lint.**

Run:

```bash
npm test 2>&1 | tail -10
npx tsc --noEmit 2>&1 | tail -10
npm run lint 2>&1 | tail -10
```

Expected: all three green.

- [ ] **Step 7: Commit.**

```bash
git add src/components/products/edit-item-dialog-v2/edit-item-dialog-v2.tsx src/components/products/edit-item-dialog-v2.test.tsx
git commit -m "fix(products): atomic bulk save + primary-location-aware single-item baseline

Bulk branch: replaces sequential per-row PATCH loop with one atomic
productApi.batch call. Server wraps all rows in one Prism transaction
— zero partial commits. On failure, dialog stays open with precise
row-level error; Save re-enables immediately (no bulkPartialCommit).

Single-item branch: baseline retail/cost now sourced from whatever
resolvedPrimaryLocationId resolves to, with primaryLocationId echoed
in the baseline so the server reads the matching Inventory row.
Fixes false 409s on PCOP/PFS-scoped pages.

Closes the three high-severity regressions Codex flagged on PR #229."
```

---

## Task 7: Local verification + adversarial review

**Why:** The four previous hotfix rounds each passed `npm test` but failed adversarial review. This task is the canary.

- [ ] **Step 1: Run the full gate.**

Run:

```bash
npm test && npx tsc --noEmit && npm run lint
```

Expected: all three green.

- [ ] **Step 2: Manual smoke on localhost.**

Terminal 1: `npm run dev`
Terminal 2: force `prismAvailable` true via the pattern used on the hotfix branch (see git log on `fix/product-edit-regressions` for the exact technique, or temporarily hardcode in `src/app/api/products/health/route.ts` — revert before commit).

In the browser:
1. Products page, PIER filter, select 2 GM rows → bulk edit → change catalog number → Save. Expect both rows update, dialog closes.
2. Products page, PIER filter, select 1 row → single edit → change retail → Save. Expect OK.
3. Products page, PCOP filter, select 1 row → single edit → change retail → Save. Expect OK (today this false-409s).
4. Products page, PCOP filter, select 2 rows → bulk edit → change catalog number → Save. Expect both update atomically (today all false-409 as well).
5. Simulate concurrency: open bulk dialog, use a different tab to directly mutate one selected row's Prism snapshot (e.g. via another PATCH), then save the bulk dialog. Expect 409 with row index in the error message. No rows in DB should have the bulk's new values.

Note: if #5 is too fiddly to set up locally, rely on the `tests/domains/product/prism-batch.test.ts` unit tests as the authoritative proof of the all-or-nothing invariant.

- [ ] **Step 3: Codex adversarial review before any push.**

Run:

```bash
node "/Users/montalvo/.claude/plugins/cache/openai-codex/codex/1.0.1/scripts/codex-companion.mjs" adversarial-review ""
```

Return the verdict verbatim to the operator. Do NOT manually stamp `.git/laportal/codex-review.env` — that anti-pattern let the four hotfix rounds ship broken. Wait for operator approval on the verdict before pushing.

- [ ] **Step 4: `ship-check` + push (operator-gated).**

Only after operator approval of the adversarial-review verdict:

```bash
npm run ship-check
```

Then push only with operator approval:

```bash
git push
```

If a PR isn't open yet, use `npm run git:publish-pr` instead of raw `git push`. If a PR IS already open on this branch and the push is a review-fix, it will be `CR_FIX=1 git push` per the memory file.

---

## Spec Coverage Check

- ✅ Atomic bulk save → Task 3 + Task 6
- ✅ Primary-location-aware concurrency → Task 2 + Task 4 + Task 6
- ✅ ItemSnapshot extended → Task 1
- ✅ Helper extraction → Task 2
- ✅ batchUpdateItems rewrite → Task 3
- ✅ Route schemas → Task 4
- ✅ productApi.batch → Task 5
- ✅ Dialog rewrite → Task 6
- ✅ New prism-batch unit test → Task 3
- ✅ Extended route test → Task 4
- ✅ Replaced dialog bulk tests → Task 6
- ✅ Codex adversarial review before push → Task 7
- ✅ Manual localhost verify → Task 7

## Out-of-Scope Reminders

Per spec, these do NOT ship in this PR:

1. Legacy dialog PIER hardcode (feature-flag-gated, flag off in prod)
2. Batch route's Supabase mirror gap for `action: "update"` (pre-existing; track as follow-up)
3. `primaryInventory` fallback in `normalizeUpdaterInput` (V1-legacy-only caller)
4. `getItemSnapshot` taking a `locationId` param (cleanup for later)

If any of these are tempting to "just fix while I'm here" — don't. Keep the diff surgical so adversarial review stays crisp.
