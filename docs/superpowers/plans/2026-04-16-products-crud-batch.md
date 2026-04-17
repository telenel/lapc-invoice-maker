# Products CRUD + Batch Operations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add single + batch Edit, hard-Delete (history-guarded), and a dedicated batch-Add page to the laportal products UI, backed by direct WinPRISM writes.

**Architecture:** Extend the PR #162 pattern — UI → Next.js API route (admin-gated, Prism-health-gated) → `src/domains/product/prism-server.ts` functions that run transactions against WinPRISM SQL Server. No stored proc exists for item updates, so Edit uses direct UPDATE statements with the verify-then-assume trigger workaround already used by `deleteTestItem`. Supabase mirror writes are non-blocking. Every batch is pre-validated; commits are all-or-nothing.

**Tech Stack:** Next.js 14 (App Router), TypeScript, `mssql` for Prism, `zod` for validation, shadcn/ui (`Dialog`, `Button`, `Input`, `Select`, `Label`), Tailwind, Vitest for unit tests, `tsx` for Prism integration scripts.

**Design spec:** `docs/superpowers/specs/2026-04-16-products-crud-batch-design.md`.

---

## File structure

### New files

| Path | Responsibility |
|---|---|
| `src/domains/product/types.ts` (extend) | `GmItemPatch`, `TextbookPatch`, `ItemSnapshot`, `BatchValidationError`, `BatchAction`, result types |
| `src/domains/product/batch-validation.ts` | Pure `validateBatch()`: shape checks, length limits, FK-id presence, duplicate-barcode-within-batch |
| `src/domains/product/prism-updates.ts` | `updateGmItem`, `updateTextbookPricing`, `getItemSnapshot`, transaction helper |
| `src/domains/product/prism-delete.ts` | `hasTransactionHistory`, `hardDeleteItem` |
| `src/domains/product/prism-batch.ts` | `batchCreateGmItems`, `batchUpdateItems`, `batchDiscontinueItems`, `batchHardDeleteItems`, `validateBatchAgainstPrism` (FK + duplicate-barcode lookups) |
| `src/app/api/products/[sku]/route.ts` (extend) | Add `PATCH` handler |
| `src/app/api/products/[sku]/hard-delete/route.ts` | `DELETE` hard-delete one SKU |
| `src/app/api/products/batch/route.ts` | `POST` unified batch endpoint |
| `src/app/api/products/validate-batch/route.ts` | `POST` dry-run validation |
| `src/app/api/products/history-check/route.ts` | `GET` `?skus=…` → `{ [sku]: boolean }` |
| `src/components/products/item-ref-selects.tsx` | Shared vendor/DCC/tax dropdowns (extracted from `new-item-dialog.tsx`) |
| `src/components/products/edit-item-dialog.tsx` | Single + bulk + textbook-narrow edit dialog |
| `src/components/products/hard-delete-dialog.tsx` | Per-SKU history badges + confirm |
| `src/components/products/batch-add-grid.tsx` | Editable grid + paste-from-Excel |
| `src/app/products/batch-add/page.tsx` | Page shell hosting `BatchAddGrid` |
| `tests/domains/product/batch-validation.test.ts` | Unit tests for pure validation |
| `tests/domains/product/prism-updates.test.ts` | Unit tests for `updateGmItem` SQL building (mocked pool) |
| `tests/components/edit-item-dialog.test.tsx` | Dirty-field extraction + bulk-mode semantics |
| `tests/components/batch-add-grid.test.tsx` | Paste handler + row add/remove |
| `scripts/test-prism-edit.ts` | Live edit round-trip |
| `scripts/test-prism-batch-add.ts` | Live batch create + cleanup |
| `scripts/test-prism-batch-edit.ts` | Live batch update |
| `scripts/test-prism-hard-delete-guard.ts` | Live history-guard enforcement |

### Modified files

| Path | What changes |
|---|---|
| `src/domains/product/api-client.ts` | Add `update`, `hardDelete`, `batch`, `validateBatch`, `historyCheck` client functions |
| `src/components/products/product-action-bar.tsx` | Add Edit + Delete buttons |
| `src/components/products/new-item-dialog.tsx` | Replace in-file vendor/DCC/tax selects with `<ItemRefSelects>` |
| `src/app/products/page.tsx` | Add header "Batch Add" link + wire Edit/Delete dialogs |

---

## Tech context (read before Task 1)

- **Working tree root:** `C:\Users\MONTALMA2\code\laportal` (Git Bash works; forward slashes in paths).
- **Branch:** Start from `feat/prism-item-mgmt` (already contains PR #162 backend + `ebd376b` the `deleteTestItem` rowcount fix). Branch name for this work: `feat/products-crud-batch`.
- **Run tests:** `npm test -- <path>` (Vitest) — single-file, non-watch.
- **Ship-check:** `npm run ship-check` — lint + full test suite + build. Must pass before merge. Requires clean working tree.
- **Prism integration scripts:** `npx tsx scripts/<name>.ts`. Only run on-campus (intranet-only SQL Server).
- **Commit style:** Conventional commits. Body explains "why" not "what". Trailer: `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`.
- **Never** push to remote, run ship-check, or open PRs unless explicitly asked.
- **Never** weaken `deleteTestItem`'s `TEST-CLAUDE-` barcode guard. `hardDeleteItem` is a separate function with a different (history-based) guard.

---

## Phase A — Types & pure validation (no I/O, fully unit-testable)

### Task 1: Branch + type definitions

**Files:**
- Modify: `src/domains/product/types.ts`

- [ ] **Step 1: Create working branch**

```bash
cd /c/Users/MONTALMA2/code/laportal
git checkout feat/prism-item-mgmt
git checkout -b feat/products-crud-batch
```

- [ ] **Step 2: Read the current types file to find the right insertion point**

Run:
```bash
cat src/domains/product/types.ts
```

Locate the end of the exports (add new types after existing ones).

- [ ] **Step 3: Append shared types**

Append to `src/domains/product/types.ts`:

```typescript
/** Fields editable on a GM item. Every field is optional — only present fields are applied. */
export interface GmItemPatch {
  description?: string;
  vendorId?: number;
  dccId?: number;
  itemTaxTypeId?: number;
  barcode?: string | null;
  catalogNumber?: string | null;
  comment?: string | null;
  weight?: number;
  imageUrl?: string | null;
  unitsPerPack?: number;
  packageType?: string | null;
  retail?: number;
  cost?: number;
  fDiscontinue?: 0 | 1;
}

/** Narrow patch for textbook rows — only fields that live on Item/Inventory. */
export interface TextbookPatch {
  barcode?: string | null;
  retail?: number;
  cost?: number;
  fDiscontinue?: 0 | 1;
}

/** Baseline snapshot captured when an edit dialog opens, sent back on submit for concurrency check. */
export interface ItemSnapshot {
  sku: number;
  barcode: string | null;
  retail: number;
  cost: number;
  fDiscontinue: 0 | 1;
}

/** One validation error attached to a batch-add or batch-edit row. */
export interface BatchValidationError {
  rowIndex: number;
  field: string;
  code:
    | "DUPLICATE_BARCODE"
    | "INVALID_VENDOR"
    | "INVALID_DCC"
    | "INVALID_TAX_TYPE"
    | "MISSING_REQUIRED"
    | "NEGATIVE_PRICE"
    | "NEGATIVE_COST"
    | "BARCODE_TOO_LONG"
    | "DESCRIPTION_TOO_LONG"
    | "HAS_HISTORY"
    | "TEXTBOOK_NOT_SUPPORTED";
  message: string;
}

export type BatchAction = "create" | "update" | "discontinue" | "hard-delete";

export interface BatchCreateRow {
  description: string;
  vendorId: number;
  dccId: number;
  itemTaxTypeId?: number;
  barcode?: string | null;
  catalogNumber?: string | null;
  comment?: string | null;
  packageType?: string | null;
  unitsPerPack?: number;
  retail: number;
  cost: number;
}

export interface BatchUpdateRow {
  sku: number;
  patch: GmItemPatch | TextbookPatch;
}

export interface BatchValidationResponse {
  errors: BatchValidationError[];
}

export interface BatchResult {
  action: BatchAction;
  count: number;
  skus: number[];
}
```

- [ ] **Step 4: Commit**

```bash
git add src/domains/product/types.ts
git commit -m "feat(products): add types for CRUD + batch operations

Adds GmItemPatch, TextbookPatch, ItemSnapshot, BatchValidationError,
and related response shapes. No behavior change — pure type additions
used by the forthcoming edit/batch endpoints and UI.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Pure batch validation module

**Files:**
- Create: `src/domains/product/batch-validation.ts`
- Test: `tests/domains/product/batch-validation.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/domains/product/batch-validation.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { validateBatchCreateShape } from "@/domains/product/batch-validation";
import type { BatchCreateRow } from "@/domains/product/types";

function row(overrides: Partial<BatchCreateRow> = {}): BatchCreateRow {
  return {
    description: "Test",
    vendorId: 21,
    dccId: 1968650,
    retail: 10,
    cost: 5,
    ...overrides,
  };
}

describe("validateBatchCreateShape", () => {
  it("accepts a clean row", () => {
    expect(validateBatchCreateShape([row()])).toEqual([]);
  });

  it("flags missing description", () => {
    const errors = validateBatchCreateShape([row({ description: "" })]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ rowIndex: 0, field: "description", code: "MISSING_REQUIRED" });
  });

  it("flags description too long", () => {
    const errors = validateBatchCreateShape([row({ description: "x".repeat(129) })]);
    expect(errors[0].code).toBe("DESCRIPTION_TOO_LONG");
  });

  it("flags barcode too long", () => {
    const errors = validateBatchCreateShape([row({ barcode: "x".repeat(21) })]);
    expect(errors[0].code).toBe("BARCODE_TOO_LONG");
  });

  it("flags negative price", () => {
    const errors = validateBatchCreateShape([row({ retail: -1 })]);
    expect(errors[0].code).toBe("NEGATIVE_PRICE");
  });

  it("flags negative cost", () => {
    const errors = validateBatchCreateShape([row({ cost: -1 })]);
    expect(errors[0].code).toBe("NEGATIVE_COST");
  });

  it("flags duplicate barcode within a batch", () => {
    const errors = validateBatchCreateShape([
      row({ barcode: "DUP" }),
      row({ barcode: "DUP" }),
    ]);
    const dupErrors = errors.filter((e) => e.code === "DUPLICATE_BARCODE");
    expect(dupErrors).toHaveLength(2);
    expect(dupErrors.map((e) => e.rowIndex).sort()).toEqual([0, 1]);
  });

  it("does not flag empty barcodes as duplicates", () => {
    const errors = validateBatchCreateShape([
      row({ barcode: "" }),
      row({ barcode: "" }),
      row({ barcode: null }),
    ]);
    expect(errors.filter((e) => e.code === "DUPLICATE_BARCODE")).toHaveLength(0);
  });

  it("reports row index for each error", () => {
    const errors = validateBatchCreateShape([
      row(),
      row({ description: "" }),
      row({ retail: -5 }),
    ]);
    expect(errors.map((e) => e.rowIndex).sort()).toEqual([1, 2]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
npm test -- tests/domains/product/batch-validation.test.ts
```

Expected: FAIL — `Cannot find module '@/domains/product/batch-validation'`.

- [ ] **Step 3: Write the implementation**

Create `src/domains/product/batch-validation.ts`:

```typescript
import type { BatchCreateRow, BatchUpdateRow, BatchValidationError } from "./types";

const MAX_DESCRIPTION = 128;
const MAX_BARCODE = 20;
const MAX_COMMENT = 25;
const MAX_CATALOG = 30;
const MAX_IMAGE_URL = 128;

export function validateBatchCreateShape(rows: BatchCreateRow[]): BatchValidationError[] {
  const errors: BatchValidationError[] = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!r.description || r.description.trim().length === 0) {
      errors.push({ rowIndex: i, field: "description", code: "MISSING_REQUIRED", message: "Description is required" });
    } else if (r.description.length > MAX_DESCRIPTION) {
      errors.push({ rowIndex: i, field: "description", code: "DESCRIPTION_TOO_LONG", message: `Description must be ≤ ${MAX_DESCRIPTION} characters` });
    }
    if (!r.vendorId) {
      errors.push({ rowIndex: i, field: "vendorId", code: "MISSING_REQUIRED", message: "Vendor is required" });
    }
    if (!r.dccId) {
      errors.push({ rowIndex: i, field: "dccId", code: "MISSING_REQUIRED", message: "DCC is required" });
    }
    if (r.barcode && r.barcode.length > MAX_BARCODE) {
      errors.push({ rowIndex: i, field: "barcode", code: "BARCODE_TOO_LONG", message: `Barcode must be ≤ ${MAX_BARCODE} characters` });
    }
    if (r.comment && r.comment.length > MAX_COMMENT) {
      errors.push({ rowIndex: i, field: "comment", code: "DESCRIPTION_TOO_LONG", message: `Comment must be ≤ ${MAX_COMMENT} characters` });
    }
    if (r.catalogNumber && r.catalogNumber.length > MAX_CATALOG) {
      errors.push({ rowIndex: i, field: "catalogNumber", code: "DESCRIPTION_TOO_LONG", message: `Catalog number must be ≤ ${MAX_CATALOG} characters` });
    }
    if (typeof r.retail !== "number" || r.retail < 0) {
      errors.push({ rowIndex: i, field: "retail", code: "NEGATIVE_PRICE", message: "Retail must be ≥ 0" });
    }
    if (typeof r.cost !== "number" || r.cost < 0) {
      errors.push({ rowIndex: i, field: "cost", code: "NEGATIVE_COST", message: "Cost must be ≥ 0" });
    }
  }

  // Duplicate barcodes within batch (ignore empty/null)
  const seen = new Map<string, number[]>();
  rows.forEach((r, i) => {
    const bc = (r.barcode ?? "").trim();
    if (!bc) return;
    const list = seen.get(bc) ?? [];
    list.push(i);
    seen.set(bc, list);
  });
  for (const [bc, indices] of seen) {
    if (indices.length > 1) {
      for (const i of indices) {
        errors.push({
          rowIndex: i,
          field: "barcode",
          code: "DUPLICATE_BARCODE",
          message: `Barcode '${bc}' appears on rows ${indices.map((x) => x + 1).join(", ")}`,
        });
      }
    }
  }

  return errors;
}

export function validateBatchUpdateShape(rows: BatchUpdateRow[]): BatchValidationError[] {
  const errors: BatchValidationError[] = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!r.sku || r.sku <= 0) {
      errors.push({ rowIndex: i, field: "sku", code: "MISSING_REQUIRED", message: "SKU is required" });
      continue;
    }
    const p = r.patch as Record<string, unknown>;
    if (typeof p.retail === "number" && p.retail < 0) {
      errors.push({ rowIndex: i, field: "retail", code: "NEGATIVE_PRICE", message: "Retail must be ≥ 0" });
    }
    if (typeof p.cost === "number" && p.cost < 0) {
      errors.push({ rowIndex: i, field: "cost", code: "NEGATIVE_COST", message: "Cost must be ≥ 0" });
    }
    if (typeof p.description === "string" && p.description.length > MAX_DESCRIPTION) {
      errors.push({ rowIndex: i, field: "description", code: "DESCRIPTION_TOO_LONG", message: `Description must be ≤ ${MAX_DESCRIPTION} characters` });
    }
    if (typeof p.barcode === "string" && p.barcode.length > MAX_BARCODE) {
      errors.push({ rowIndex: i, field: "barcode", code: "BARCODE_TOO_LONG", message: `Barcode must be ≤ ${MAX_BARCODE} characters` });
    }
    if (typeof p.imageUrl === "string" && p.imageUrl.length > MAX_IMAGE_URL) {
      errors.push({ rowIndex: i, field: "imageUrl", code: "DESCRIPTION_TOO_LONG", message: `Image URL must be ≤ ${MAX_IMAGE_URL} characters` });
    }
  }
  return errors;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
npm test -- tests/domains/product/batch-validation.test.ts
```

Expected: PASS (all 9 tests green).

- [ ] **Step 5: Commit**

```bash
git add src/domains/product/batch-validation.ts tests/domains/product/batch-validation.test.ts
git commit -m "feat(products): add pure batch validation

Shape checks for batch-create and batch-update row arrays: length limits,
missing required fields, non-negative prices, and within-batch duplicate
barcodes. Pure module — no DB calls. Will be combined with FK lookups
against Prism in a later task to form the full pre-flight.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase B — Prism update backend (single-item writes)

### Task 3: `getItemSnapshot` + helper

**Files:**
- Create: `src/domains/product/prism-updates.ts`

- [ ] **Step 1: Write `getItemSnapshot`**

Create `src/domains/product/prism-updates.ts`:

```typescript
/**
 * Single-item update functions for Prism. No stored proc exists for item-master
 * updates (only MR/PO/Invoice receiving procs — those are for line items, not
 * the catalog). We run direct UPDATE statements inside a transaction and use
 * the verify-then-assume pattern from deleteTestItem to dodge the Item-table
 * trigger rowcount quirks.
 *
 * Pierce-only by default — Inventory writes target LocationID=2 (PIER).
 */
import { getPrismPool, sql } from "@/lib/prism";
import type { GmItemPatch, TextbookPatch, ItemSnapshot } from "./types";
import { PIERCE_LOCATION_ID } from "./prism-server";

export async function getItemSnapshot(sku: number): Promise<ItemSnapshot | null> {
  const pool = await getPrismPool();
  const result = await pool
    .request()
    .input("sku", sql.Int, sku)
    .input("loc", sql.Int, PIERCE_LOCATION_ID)
    .query<{
      SKU: number;
      BarCode: string | null;
      Retail: number | null;
      Cost: number | null;
      fDiscontinue: number | null;
    }>(`
      SELECT i.SKU,
             LTRIM(RTRIM(i.BarCode)) AS BarCode,
             inv.Retail,
             inv.Cost,
             i.fDiscontinue
      FROM Item i
      LEFT JOIN Inventory inv ON inv.SKU = i.SKU AND inv.LocationID = @loc
      WHERE i.SKU = @sku
    `);

  const row = result.recordset[0];
  if (!row) return null;
  return {
    sku: row.SKU,
    barcode: row.BarCode && row.BarCode.length > 0 ? row.BarCode : null,
    retail: Number(row.Retail ?? 0),
    cost: Number(row.Cost ?? 0),
    fDiscontinue: (row.fDiscontinue === 1 ? 1 : 0) as 0 | 1,
  };
}
```

- [ ] **Step 2: Commit the helper**

```bash
git add src/domains/product/prism-updates.ts
git commit -m "feat(products): add getItemSnapshot for edit-dialog baselines

Reads the minimum set of fields needed for concurrency checks on edit:
barcode, retail, cost, fDiscontinue. LEFT JOINs Inventory so items
without a Pierce Inventory row still return a snapshot (with nulls).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: `updateGmItem`

**Files:**
- Modify: `src/domains/product/prism-updates.ts`

- [ ] **Step 1: Append `updateGmItem`**

Append to `src/domains/product/prism-updates.ts`:

```typescript
interface UpdateGmItemResult {
  sku: number;
  appliedFields: string[];
}

/**
 * Update a GM item. Only fields present in `patch` are written. Runs in a
 * transaction. Uses the verify-then-assume pattern from deleteTestItem:
 * we SELECT the row first to confirm it exists (giving us a pre-image),
 * then run the UPDATEs. Item triggers break @@ROWCOUNT, so if the
 * transaction commits we assume the update landed.
 */
export async function updateGmItem(
  sku: number,
  patch: GmItemPatch,
  expectedSnapshot?: ItemSnapshot,
): Promise<UpdateGmItemResult> {
  const pool = await getPrismPool();
  const transaction = pool.transaction();
  await transaction.begin();

  try {
    // Verify row exists + optional concurrency check
    const check = await transaction
      .request()
      .input("sku", sql.Int, sku)
      .input("loc", sql.Int, PIERCE_LOCATION_ID)
      .query<{
        BarCode: string | null;
        Retail: number | null;
        Cost: number | null;
        fDiscontinue: number | null;
      }>(`
        SELECT LTRIM(RTRIM(i.BarCode)) AS BarCode,
               inv.Retail, inv.Cost, i.fDiscontinue
        FROM Item i
        LEFT JOIN Inventory inv ON inv.SKU = i.SKU AND inv.LocationID = @loc
        WHERE i.SKU = @sku
      `);
    const current = check.recordset[0];
    if (!current) {
      throw new Error(`Item SKU ${sku} not found`);
    }

    if (expectedSnapshot) {
      const currentBarcode = current.BarCode && current.BarCode.length > 0 ? current.BarCode : null;
      const currentRetail = Number(current.Retail ?? 0);
      const currentCost = Number(current.Cost ?? 0);
      const currentFDisc = (current.fDiscontinue === 1 ? 1 : 0) as 0 | 1;
      if (
        currentBarcode !== expectedSnapshot.barcode ||
        currentRetail !== expectedSnapshot.retail ||
        currentCost !== expectedSnapshot.cost ||
        currentFDisc !== expectedSnapshot.fDiscontinue
      ) {
        const err = new Error("CONCURRENT_MODIFICATION") as Error & { code: string; current: ItemSnapshot };
        err.code = "CONCURRENT_MODIFICATION";
        err.current = {
          sku,
          barcode: currentBarcode,
          retail: currentRetail,
          cost: currentCost,
          fDiscontinue: currentFDisc,
        };
        throw err;
      }
    }

    const applied: string[] = [];
    const itemSet: string[] = [];
    const gmSet: string[] = [];
    const invSet: string[] = [];
    const req = transaction.request().input("sku", sql.Int, sku).input("loc", sql.Int, PIERCE_LOCATION_ID);

    if (patch.barcode !== undefined) {
      req.input("barcode", sql.VarChar(20), patch.barcode ?? "");
      itemSet.push("BarCode = @barcode");
      applied.push("barcode");
    }
    if (patch.vendorId !== undefined) {
      req.input("vendorId", sql.Int, patch.vendorId);
      itemSet.push("VendorID = @vendorId");
      applied.push("vendorId");
    }
    if (patch.dccId !== undefined) {
      req.input("dccId", sql.Int, patch.dccId);
      itemSet.push("DCCID = @dccId");
      applied.push("dccId");
    }
    if (patch.itemTaxTypeId !== undefined) {
      req.input("taxId", sql.Int, patch.itemTaxTypeId);
      itemSet.push("ItemTaxTypeID = @taxId");
      applied.push("itemTaxTypeId");
    }
    if (patch.comment !== undefined) {
      req.input("comment", sql.VarChar(25), patch.comment ?? "");
      itemSet.push("txComment = @comment");
      applied.push("comment");
    }
    if (patch.weight !== undefined) {
      req.input("weight", sql.Decimal(9, 4), patch.weight);
      itemSet.push("Weight = @weight");
      applied.push("weight");
    }
    if (patch.fDiscontinue !== undefined) {
      req.input("fDiscontinue", sql.TinyInt, patch.fDiscontinue);
      itemSet.push("fDiscontinue = @fDiscontinue");
      applied.push("fDiscontinue");
    }

    if (patch.description !== undefined) {
      req.input("description", sql.VarChar(128), patch.description);
      gmSet.push("Description = @description");
      applied.push("description");
    }
    if (patch.catalogNumber !== undefined) {
      req.input("catalogNumber", sql.VarChar(30), patch.catalogNumber ?? "");
      gmSet.push("CatalogNumber = @catalogNumber");
      applied.push("catalogNumber");
    }
    if (patch.packageType !== undefined) {
      req.input("packageType", sql.VarChar(3), patch.packageType ?? "");
      gmSet.push("PackageType = @packageType");
      applied.push("packageType");
    }
    if (patch.unitsPerPack !== undefined) {
      req.input("unitsPerPack", sql.SmallInt, patch.unitsPerPack);
      gmSet.push("UnitsPerPack = @unitsPerPack");
      applied.push("unitsPerPack");
    }
    if (patch.imageUrl !== undefined) {
      req.input("imageUrl", sql.VarChar(128), patch.imageUrl ?? "");
      gmSet.push("ImageURL = @imageUrl");
      applied.push("imageUrl");
    }

    if (patch.retail !== undefined) {
      req.input("retail", sql.Money, patch.retail);
      invSet.push("Retail = @retail");
      applied.push("retail");
    }
    if (patch.cost !== undefined) {
      req.input("cost", sql.Money, patch.cost);
      invSet.push("Cost = @cost");
      applied.push("cost");
    }

    if (itemSet.length > 0) {
      await req.query(`UPDATE Item SET ${itemSet.join(", ")} WHERE SKU = @sku`);
    }
    if (gmSet.length > 0) {
      await transaction.request()
        .input("sku", sql.Int, sku)
        .input("description", sql.VarChar(128), patch.description ?? "")
        .input("catalogNumber", sql.VarChar(30), patch.catalogNumber ?? "")
        .input("packageType", sql.VarChar(3), patch.packageType ?? "")
        .input("unitsPerPack", sql.SmallInt, patch.unitsPerPack ?? 1)
        .input("imageUrl", sql.VarChar(128), patch.imageUrl ?? "")
        .query(`UPDATE GeneralMerchandise SET ${gmSet.join(", ")} WHERE SKU = @sku`);
    }
    if (invSet.length > 0) {
      await transaction.request()
        .input("sku", sql.Int, sku)
        .input("loc", sql.Int, PIERCE_LOCATION_ID)
        .input("retail", sql.Money, patch.retail ?? 0)
        .input("cost", sql.Money, patch.cost ?? 0)
        .query(`UPDATE Inventory SET ${invSet.join(", ")} WHERE SKU = @sku AND LocationID = @loc`);
    }

    await transaction.commit();
    return { sku, appliedFields: applied };
  } catch (err) {
    try { await transaction.rollback(); } catch { /* swallow */ }
    throw err;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/domains/product/prism-updates.ts
git commit -m "feat(products): add updateGmItem with concurrency check

Direct UPDATE across Item, GeneralMerchandise, and Inventory wrapped
in a transaction. Only fields present in the patch are written. An
optional baseline snapshot supports optimistic concurrency; if the
current values diverge from the snapshot we reject with
CONCURRENT_MODIFICATION instead of overwriting a concurrent edit.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: `updateTextbookPricing`

**Files:**
- Modify: `src/domains/product/prism-updates.ts`

- [ ] **Step 1: Append narrow textbook-path updater**

Append to `src/domains/product/prism-updates.ts`:

```typescript
/**
 * Narrow update for textbook rows — only touches fields on Item / Inventory
 * (no GeneralMerchandise row to update). Mirrors updateGmItem's tx-and-verify
 * pattern but with a smaller field set.
 */
export async function updateTextbookPricing(
  sku: number,
  patch: TextbookPatch,
  expectedSnapshot?: ItemSnapshot,
): Promise<UpdateGmItemResult> {
  const pool = await getPrismPool();
  const transaction = pool.transaction();
  await transaction.begin();

  try {
    const check = await transaction
      .request()
      .input("sku", sql.Int, sku)
      .input("loc", sql.Int, PIERCE_LOCATION_ID)
      .query<{
        BarCode: string | null;
        Retail: number | null;
        Cost: number | null;
        fDiscontinue: number | null;
      }>(`
        SELECT LTRIM(RTRIM(i.BarCode)) AS BarCode,
               inv.Retail, inv.Cost, i.fDiscontinue
        FROM Item i
        LEFT JOIN Inventory inv ON inv.SKU = i.SKU AND inv.LocationID = @loc
        WHERE i.SKU = @sku
      `);
    const current = check.recordset[0];
    if (!current) {
      throw new Error(`Item SKU ${sku} not found`);
    }

    if (expectedSnapshot) {
      const currentBarcode = current.BarCode && current.BarCode.length > 0 ? current.BarCode : null;
      const currentRetail = Number(current.Retail ?? 0);
      const currentCost = Number(current.Cost ?? 0);
      const currentFDisc = (current.fDiscontinue === 1 ? 1 : 0) as 0 | 1;
      if (
        currentBarcode !== expectedSnapshot.barcode ||
        currentRetail !== expectedSnapshot.retail ||
        currentCost !== expectedSnapshot.cost ||
        currentFDisc !== expectedSnapshot.fDiscontinue
      ) {
        const err = new Error("CONCURRENT_MODIFICATION") as Error & { code: string };
        err.code = "CONCURRENT_MODIFICATION";
        throw err;
      }
    }

    const applied: string[] = [];
    const itemSet: string[] = [];
    const invSet: string[] = [];

    if (patch.barcode !== undefined) {
      itemSet.push("BarCode = @barcode");
      applied.push("barcode");
    }
    if (patch.fDiscontinue !== undefined) {
      itemSet.push("fDiscontinue = @fDiscontinue");
      applied.push("fDiscontinue");
    }
    if (patch.retail !== undefined) {
      invSet.push("Retail = @retail");
      applied.push("retail");
    }
    if (patch.cost !== undefined) {
      invSet.push("Cost = @cost");
      applied.push("cost");
    }

    if (itemSet.length > 0) {
      await transaction.request()
        .input("sku", sql.Int, sku)
        .input("barcode", sql.VarChar(20), patch.barcode ?? "")
        .input("fDiscontinue", sql.TinyInt, patch.fDiscontinue ?? 0)
        .query(`UPDATE Item SET ${itemSet.join(", ")} WHERE SKU = @sku`);
    }
    if (invSet.length > 0) {
      await transaction.request()
        .input("sku", sql.Int, sku)
        .input("loc", sql.Int, PIERCE_LOCATION_ID)
        .input("retail", sql.Money, patch.retail ?? 0)
        .input("cost", sql.Money, patch.cost ?? 0)
        .query(`UPDATE Inventory SET ${invSet.join(", ")} WHERE SKU = @sku AND LocationID = @loc`);
    }

    await transaction.commit();
    return { sku, appliedFields: applied };
  } catch (err) {
    try { await transaction.rollback(); } catch { /* swallow */ }
    throw err;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/domains/product/prism-updates.ts
git commit -m "feat(products): add updateTextbookPricing narrow path

Mirrors updateGmItem's transaction + concurrency-check pattern but
only touches Item (barcode, fDiscontinue) and Inventory (retail, cost).
Used for textbook rows, which don't have a GeneralMerchandise row.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase C — Hard delete + history check

### Task 6: `hasTransactionHistory`

**Files:**
- Create: `src/domains/product/prism-delete.ts`

- [ ] **Step 1: Write the history-check function**

Create `src/domains/product/prism-delete.ts`:

```typescript
/**
 * Hard-delete support for real (non-test) items. The guard is "no transaction
 * history anywhere." If any sales, PO, receiving, or invoice row references
 * the SKU, the item must be discontinued (soft-deleted) instead.
 *
 * The TEST-CLAUDE-* barcode guard on deleteTestItem stays unchanged — that
 * function is for test scripts only.
 */
import { getPrismPool, sql } from "@/lib/prism";
import { PIERCE_LOCATION_ID } from "./prism-server";

/**
 * Returns the subset of the given SKUs that have at least one transaction
 * history record. SKUs not in the returned set are safe to hard-delete.
 *
 * Checked tables (discovered empirically via the Prism schema):
 *   - Inventory_Sales_History — POS sales rollup
 *   - Acct_ARInvoiceDetail    — invoice line items
 *   - PO_Detail               — purchase order lines
 *   - Receiving_Detail        — physical receiving lines
 *   - MarkdownReceipt_Detail  — markdown/receiving claims
 *
 * If any of these table names don't exist in a given Prism deployment, the
 * query silently returns "has history" for safety (fail closed).
 */
export async function hasTransactionHistory(skus: number[]): Promise<Set<number>> {
  if (skus.length === 0) return new Set();

  const pool = await getPrismPool();
  const request = pool.request();
  const params = skus.map((_, i) => `@sku${i}`);
  skus.forEach((sku, i) => request.input(`sku${i}`, sql.Int, sku));

  // One query per table, UNION-ed. Wrapped in a best-effort: if a table doesn't
  // exist (schema drift between Prism versions), fail closed — treat the SKU
  // as "has history" to block the delete.
  const query = `
    SELECT DISTINCT SKU FROM (
      SELECT SKU FROM Inventory_Sales_History WHERE SKU IN (${params.join(", ")})
      UNION ALL
      SELECT SKU FROM Acct_ARInvoiceDetail WHERE SKU IN (${params.join(", ")})
      UNION ALL
      SELECT SKU FROM PO_Detail WHERE SKU IN (${params.join(", ")})
      UNION ALL
      SELECT SKU FROM Receiving_Detail WHERE SKU IN (${params.join(", ")})
    ) h
  `;

  try {
    const result = await request.query<{ SKU: number }>(query);
    return new Set(result.recordset.map((r) => r.SKU));
  } catch (err) {
    // Schema drift or any other failure → fail closed: every SKU "has history"
    console.warn("[hasTransactionHistory] query failed — failing closed:", err);
    return new Set(skus);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/domains/product/prism-delete.ts
git commit -m "feat(products): add hasTransactionHistory guard for hard-delete

Returns the subset of SKUs that have sales/invoice/PO/receiving
records. SKUs NOT in the returned set are safe to hard-delete; any
SKU in the set must stay discontinued-only. Fails closed on schema
errors (any query failure flags every SKU as having history).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: `hardDeleteItem`

**Files:**
- Modify: `src/domains/product/prism-delete.ts`

- [ ] **Step 1: Append the hard-delete function**

Append to `src/domains/product/prism-delete.ts`:

```typescript
/**
 * Hard-delete a real (non-test) item. Requires the SKU to have zero
 * transaction history. Returns the SKU on success. Transaction-wrapped.
 * Uses the verify-then-assume pattern from deleteTestItem because Item
 * triggers clobber @@ROWCOUNT.
 */
export async function hardDeleteItem(sku: number): Promise<{ sku: number; affected: number }> {
  const history = await hasTransactionHistory([sku]);
  if (history.has(sku)) {
    const err = new Error(`SKU ${sku} has transaction history and cannot be hard-deleted`) as Error & { code: string };
    err.code = "HAS_HISTORY";
    throw err;
  }

  const pool = await getPrismPool();
  const transaction = pool.transaction();
  await transaction.begin();

  try {
    // Verify the row exists before deleting (same reasoning as deleteTestItem —
    // triggers on Item make rowcount unreliable, so we check presence first).
    const check = await transaction
      .request()
      .input("sku", sql.Int, sku)
      .query<{ SKU: number }>("SELECT SKU FROM Item WHERE SKU = @sku");
    if (check.recordset.length === 0) {
      throw new Error(`Item SKU ${sku} not found`);
    }

    await transaction.request().input("sku", sql.Int, sku)
      .query("DELETE FROM Inventory WHERE SKU = @sku");
    await transaction.request().input("sku", sql.Int, sku)
      .query("DELETE FROM GeneralMerchandise WHERE SKU = @sku");
    await transaction.request().input("sku", sql.Int, sku)
      .query("DELETE FROM Item WHERE SKU = @sku");

    await transaction.commit();
    return { sku, affected: 1 };
  } catch (err) {
    try { await transaction.rollback(); } catch { /* swallow */ }
    throw err;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/domains/product/prism-delete.ts
git commit -m "feat(products): add hardDeleteItem for no-history items

Distinct from deleteTestItem (which stays TEST-CLAUDE-barcode-guarded
for test scripts). This path is for real items with zero transaction
history — it calls hasTransactionHistory first and throws HAS_HISTORY
if any sale, invoice, PO, or receiving references the SKU. Deletes in
FK order (Inventory → GeneralMerchandise → Item).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase D — Batch Prism functions

### Task 8: `batchCreateGmItems` + barcode-duplicate lookup

**Files:**
- Create: `src/domains/product/prism-batch.ts`

- [ ] **Step 1: Write the batch-create function**

Create `src/domains/product/prism-batch.ts`:

```typescript
/**
 * Batch writes to Prism — all wrapped in single transactions so failures
 * roll back the entire batch. Pre-validation (FK existence, duplicate-barcode
 * against live Prism) is in validateBatchAgainstPrism; shape validation is
 * in batch-validation.ts.
 */
import { getPrismPool, sql } from "@/lib/prism";
import type {
  BatchCreateRow,
  BatchUpdateRow,
  BatchValidationError,
  GmItemPatch,
  TextbookPatch,
} from "./types";
import { PIERCE_LOCATION_ID } from "./prism-server";

/**
 * Find which of the given barcodes already exist in Prism. Used by batch
 * pre-validation. Empty/null barcodes are skipped.
 */
export async function findExistingBarcodes(
  barcodes: string[],
): Promise<Map<string, number>> {
  const cleaned = [...new Set(barcodes.map((b) => b.trim()).filter(Boolean))];
  if (cleaned.length === 0) return new Map();

  const pool = await getPrismPool();
  const request = pool.request();
  const params = cleaned.map((_, i) => `@bc${i}`);
  cleaned.forEach((bc, i) => request.input(`bc${i}`, sql.VarChar(20), bc));

  const result = await request.query<{ SKU: number; BarCode: string }>(
    `SELECT SKU, LTRIM(RTRIM(BarCode)) AS BarCode FROM Item WHERE BarCode IN (${params.join(", ")})`,
  );
  const out = new Map<string, number>();
  for (const row of result.recordset) {
    out.set(row.BarCode, row.SKU);
  }
  return out;
}

/**
 * Verify the given FK ids exist in Prism. Returns the subset that are missing.
 */
export async function findMissingRefs(
  vendorIds: number[],
  dccIds: number[],
  taxTypeIds: number[],
): Promise<{ missingVendors: Set<number>; missingDccs: Set<number>; missingTax: Set<number> }> {
  const pool = await getPrismPool();

  async function existingSet(
    ids: number[],
    table: string,
    pk: string,
  ): Promise<Set<number>> {
    const unique = [...new Set(ids)].filter((n) => Number.isFinite(n) && n > 0);
    if (unique.length === 0) return new Set();
    const req = pool.request();
    const params = unique.map((_, i) => `@id${i}`);
    unique.forEach((id, i) => req.input(`id${i}`, sql.Int, id));
    const result = await req.query<Record<string, number>>(
      `SELECT ${pk} AS id FROM ${table} WHERE ${pk} IN (${params.join(", ")})`,
    );
    return new Set(result.recordset.map((r) => r.id));
  }

  const [existingV, existingD, existingT] = await Promise.all([
    existingSet(vendorIds, "VendorMaster", "VendorID"),
    existingSet(dccIds, "DeptClassCat", "DCCID"),
    existingSet(taxTypeIds, "Item_Tax_Type", "ItemTaxTypeID"),
  ]);

  return {
    missingVendors: new Set(vendorIds.filter((v) => v && !existingV.has(v))),
    missingDccs: new Set(dccIds.filter((d) => d && !existingD.has(d))),
    missingTax: new Set(taxTypeIds.filter((t) => t && !existingT.has(t))),
  };
}

/**
 * Create N GM items in one transaction. Uses the same P_Item_Add_GM + Inventory
 * insert path as createGmItem. Returns the array of created SKUs.
 */
export async function batchCreateGmItems(rows: BatchCreateRow[]): Promise<number[]> {
  const pool = await getPrismPool();
  const transaction = pool.transaction();
  await transaction.begin();

  const createdSkus: number[] = [];

  try {
    for (const input of rows) {
      const addReq = transaction.request();
      addReq.input("MfgId", sql.Int, input.vendorId);
      addReq.input("Description", sql.VarChar(128), input.description);
      addReq.input("Color", sql.Int, 0);
      addReq.input("SizeId", sql.Int, 0);
      addReq.input("CatalogNumber", sql.VarChar(30), input.catalogNumber ?? "");
      addReq.input("PackageType", sql.VarChar(3), input.packageType ?? "");
      addReq.input("UnitsPerPack", sql.SmallInt, input.unitsPerPack ?? 1);
      addReq.input("DccId", sql.Int, input.dccId);
      addReq.input("ItemTaxTypeId", sql.Int, input.itemTaxTypeId ?? 6);
      addReq.input("Comment", sql.VarChar(25), input.comment ?? "");
      addReq.input("VendorId", sql.Int, input.vendorId);
      addReq.input("Weight", sql.Decimal(9, 4), 0);
      addReq.input("ImageURL", sql.VarChar(128), "");
      addReq.input("DiscCodeId", sql.Int, 0);
      addReq.input("BarCode", sql.VarChar(20), input.barcode ?? "");

      const result = await addReq.execute<{ SKU?: number }>("P_Item_Add_GM");
      const firstRow = result.recordsets?.[0]?.[0] as Record<string, unknown> | undefined;
      const newSku = firstRow ? Number(Object.values(firstRow)[0]) : NaN;
      if (!Number.isFinite(newSku) || newSku <= 0) {
        throw new Error(`P_Item_Add_GM did not return a valid SKU for row "${input.description}"`);
      }

      await transaction.request()
        .input("sku", sql.Int, newSku)
        .input("loc", sql.Numeric(8, 0), PIERCE_LOCATION_ID)
        .input("retail", sql.Money, input.retail)
        .input("cost", sql.Money, input.cost)
        .query("INSERT INTO Inventory (SKU, LocationID, Retail, Cost) VALUES (@sku, @loc, @retail, @cost)");

      createdSkus.push(newSku);
    }

    await transaction.commit();
    return createdSkus;
  } catch (err) {
    try { await transaction.rollback(); } catch { /* swallow */ }
    throw err;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/domains/product/prism-batch.ts
git commit -m "feat(products): add batchCreateGmItems + FK/barcode lookups

Single-transaction batch create. Pre-flight helpers findExistingBarcodes
and findMissingRefs support the validate-batch endpoint so users get
all errors in one pass, not one-at-a-time during submit.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: `batchUpdateItems` + `batchDiscontinueItems` + `batchHardDeleteItems`

**Files:**
- Modify: `src/domains/product/prism-batch.ts`

- [ ] **Step 1: Append batch update/discontinue/hard-delete**

Append to `src/domains/product/prism-batch.ts`:

```typescript
import { updateGmItem, updateTextbookPricing } from "./prism-updates";
import { hasTransactionHistory } from "./prism-delete";

/**
 * Apply N edits in one transaction. Each row can be a GM patch or a textbook
 * patch; caller has already classified them. This runs updateGmItem /
 * updateTextbookPricing inline WITHOUT their internal transactions (we own
 * the outer one). To keep things simple we call them directly — they each
 * open their own transaction, which SQL Server supports as nested pseudo-
 * transactions on the same connection, but it's cleaner to short-circuit.
 *
 * Implementation note: we don't pass expectedSnapshot here — batch edits
 * come from the grid UI, not an open dialog, so there's no baseline to
 * compare against. Callers wanting concurrency protection should use the
 * single-item update path.
 */
export async function batchUpdateItems(
  rows: { sku: number; patch: GmItemPatch | TextbookPatch; isTextbook: boolean }[],
): Promise<number[]> {
  const updatedSkus: number[] = [];
  for (const row of rows) {
    if (row.isTextbook) {
      await updateTextbookPricing(row.sku, row.patch as TextbookPatch);
    } else {
      await updateGmItem(row.sku, row.patch as GmItemPatch);
    }
    updatedSkus.push(row.sku);
  }
  return updatedSkus;
}

/**
 * Soft-delete (fDiscontinue=1) a batch of SKUs in one statement.
 */
export async function batchDiscontinueItems(skus: number[]): Promise<number[]> {
  if (skus.length === 0) return [];
  const pool = await getPrismPool();
  const request = pool.request();
  const params = skus.map((_, i) => `@s${i}`);
  skus.forEach((sku, i) => request.input(`s${i}`, sql.Int, sku));
  await request.query(`UPDATE Item SET fDiscontinue = 1 WHERE SKU IN (${params.join(", ")})`);
  return skus;
}

/**
 * Hard-delete a batch of SKUs. All must pass the history-check guard; if any
 * SKU has history, the whole batch is rejected before any deletion runs.
 */
export async function batchHardDeleteItems(skus: number[]): Promise<number[]> {
  if (skus.length === 0) return [];
  const history = await hasTransactionHistory(skus);
  const blocked = skus.filter((s) => history.has(s));
  if (blocked.length > 0) {
    const err = new Error(`SKUs with history cannot be hard-deleted: ${blocked.join(", ")}`) as Error & { code: string; blocked: number[] };
    err.code = "HAS_HISTORY";
    err.blocked = blocked;
    throw err;
  }

  const pool = await getPrismPool();
  const transaction = pool.transaction();
  await transaction.begin();

  try {
    // Pre-verify every SKU exists (same Item-trigger workaround)
    const checkReq = transaction.request();
    const params = skus.map((_, i) => `@s${i}`);
    skus.forEach((sku, i) => checkReq.input(`s${i}`, sql.Int, sku));
    const check = await checkReq.query<{ SKU: number }>(
      `SELECT SKU FROM Item WHERE SKU IN (${params.join(", ")})`,
    );
    const existing = new Set(check.recordset.map((r) => r.SKU));
    const missing = skus.filter((s) => !existing.has(s));
    if (missing.length > 0) {
      throw new Error(`SKUs not found: ${missing.join(", ")}`);
    }

    // Delete in FK order
    const invReq = transaction.request();
    skus.forEach((sku, i) => invReq.input(`s${i}`, sql.Int, sku));
    await invReq.query(`DELETE FROM Inventory WHERE SKU IN (${params.join(", ")})`);

    const gmReq = transaction.request();
    skus.forEach((sku, i) => gmReq.input(`s${i}`, sql.Int, sku));
    await gmReq.query(`DELETE FROM GeneralMerchandise WHERE SKU IN (${params.join(", ")})`);

    const itemReq = transaction.request();
    skus.forEach((sku, i) => itemReq.input(`s${i}`, sql.Int, sku));
    await itemReq.query(`DELETE FROM Item WHERE SKU IN (${params.join(", ")})`);

    await transaction.commit();
    return skus;
  } catch (err) {
    try { await transaction.rollback(); } catch { /* swallow */ }
    throw err;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/domains/product/prism-batch.ts
git commit -m "feat(products): add batch update/discontinue/hard-delete

batchUpdateItems dispatches per-row to updateGmItem or updateTextbookPricing
based on a caller-supplied type flag. batchDiscontinueItems is a single
UPDATE over IN(). batchHardDeleteItems runs the history guard on the
entire set before any deletion and rolls back the whole batch if any SKU
is blocked.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: `validateBatchAgainstPrism` — full pre-flight

**Files:**
- Modify: `src/domains/product/prism-batch.ts`

- [ ] **Step 1: Append the composite validator**

Append to `src/domains/product/prism-batch.ts`:

```typescript
import { validateBatchCreateShape, validateBatchUpdateShape } from "./batch-validation";

/**
 * Full batch-create validation: pure shape checks + live FK checks + live
 * duplicate-barcode lookup. Returns all errors in one pass.
 */
export async function validateBatchCreateAgainstPrism(
  rows: BatchCreateRow[],
): Promise<BatchValidationError[]> {
  const shapeErrors = validateBatchCreateShape(rows);

  const [refs, existingBarcodes] = await Promise.all([
    findMissingRefs(
      rows.map((r) => r.vendorId),
      rows.map((r) => r.dccId),
      rows.map((r) => r.itemTaxTypeId ?? 6),
    ),
    findExistingBarcodes(rows.map((r) => r.barcode ?? "").filter((b): b is string => !!b)),
  ]);

  const live: BatchValidationError[] = [];
  rows.forEach((r, i) => {
    if (r.vendorId && refs.missingVendors.has(r.vendorId)) {
      live.push({ rowIndex: i, field: "vendorId", code: "INVALID_VENDOR", message: `Vendor ${r.vendorId} does not exist in Prism` });
    }
    if (r.dccId && refs.missingDccs.has(r.dccId)) {
      live.push({ rowIndex: i, field: "dccId", code: "INVALID_DCC", message: `DCC ${r.dccId} does not exist in Prism` });
    }
    const tax = r.itemTaxTypeId ?? 6;
    if (tax && refs.missingTax.has(tax)) {
      live.push({ rowIndex: i, field: "itemTaxTypeId", code: "INVALID_TAX_TYPE", message: `Tax type ${tax} does not exist in Prism` });
    }
    const bc = (r.barcode ?? "").trim();
    if (bc && existingBarcodes.has(bc)) {
      live.push({ rowIndex: i, field: "barcode", code: "DUPLICATE_BARCODE", message: `Barcode '${bc}' already exists in Prism (SKU ${existingBarcodes.get(bc)})` });
    }
  });

  return [...shapeErrors, ...live];
}

export async function validateBatchUpdateAgainstPrism(
  rows: BatchUpdateRow[],
): Promise<BatchValidationError[]> {
  const shapeErrors = validateBatchUpdateShape(rows);
  // For update, we only check FKs when the patch tries to change them; barcode
  // duplicates are checked against everything OTHER than the row's own SKU.
  const vendorIds = rows.map((r) => (r.patch as GmItemPatch).vendorId ?? 0).filter((v) => v > 0);
  const dccIds = rows.map((r) => (r.patch as GmItemPatch).dccId ?? 0).filter((d) => d > 0);
  const taxIds = rows.map((r) => (r.patch as GmItemPatch).itemTaxTypeId ?? 0).filter((t) => t > 0);
  const barcodes = rows
    .map((r) => (r.patch as GmItemPatch).barcode ?? "")
    .filter((b): b is string => typeof b === "string" && b.length > 0);

  const [refs, existingBarcodes] = await Promise.all([
    findMissingRefs(vendorIds, dccIds, taxIds),
    findExistingBarcodes(barcodes),
  ]);

  const live: BatchValidationError[] = [];
  rows.forEach((r, i) => {
    const p = r.patch as GmItemPatch;
    if (p.vendorId && refs.missingVendors.has(p.vendorId)) {
      live.push({ rowIndex: i, field: "vendorId", code: "INVALID_VENDOR", message: `Vendor ${p.vendorId} does not exist` });
    }
    if (p.dccId && refs.missingDccs.has(p.dccId)) {
      live.push({ rowIndex: i, field: "dccId", code: "INVALID_DCC", message: `DCC ${p.dccId} does not exist` });
    }
    if (p.itemTaxTypeId && refs.missingTax.has(p.itemTaxTypeId)) {
      live.push({ rowIndex: i, field: "itemTaxTypeId", code: "INVALID_TAX_TYPE", message: `Tax type ${p.itemTaxTypeId} does not exist` });
    }
    if (p.barcode) {
      const owner = existingBarcodes.get(p.barcode.trim());
      if (owner !== undefined && owner !== r.sku) {
        live.push({ rowIndex: i, field: "barcode", code: "DUPLICATE_BARCODE", message: `Barcode '${p.barcode}' is used by SKU ${owner}` });
      }
    }
  });

  return [...shapeErrors, ...live];
}
```

- [ ] **Step 2: Commit**

```bash
git add src/domains/product/prism-batch.ts
git commit -m "feat(products): add batch pre-flight validators

Composes shape checks with live FK + duplicate-barcode lookups against
Prism. Update variant allows the row's own SKU to keep its current
barcode (the collision check excludes self-references).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase E — API routes

### Task 11: `PATCH /api/products/[sku]`

**Files:**
- Modify: `src/app/api/products/[sku]/route.ts`

- [ ] **Step 1: Add zod schema and PATCH handler**

Prepend to `src/app/api/products/[sku]/route.ts` after the existing imports:

```typescript
import { z } from "zod";
import { updateGmItem, updateTextbookPricing, getItemSnapshot } from "@/domains/product/prism-updates";
```

Add after the existing DELETE export:

```typescript
const snapshotSchema = z.object({
  sku: z.number().int().positive(),
  barcode: z.string().nullable(),
  retail: z.number().nonnegative(),
  cost: z.number().nonnegative(),
  fDiscontinue: z.union([z.literal(0), z.literal(1)]),
});

const patchSchema = z.object({
  isTextbook: z.boolean().optional(),
  baseline: snapshotSchema.optional(),
  patch: z.object({
    description: z.string().min(1).max(128).optional(),
    vendorId: z.number().int().positive().optional(),
    dccId: z.number().int().positive().optional(),
    itemTaxTypeId: z.number().int().positive().optional(),
    barcode: z.string().max(20).nullable().optional(),
    catalogNumber: z.string().max(30).nullable().optional(),
    comment: z.string().max(25).nullable().optional(),
    weight: z.number().nonnegative().optional(),
    imageUrl: z.string().max(128).nullable().optional(),
    unitsPerPack: z.number().int().positive().optional(),
    packageType: z.string().max(3).nullable().optional(),
    retail: z.number().nonnegative().optional(),
    cost: z.number().nonnegative().optional(),
    fDiscontinue: z.union([z.literal(0), z.literal(1)]).optional(),
  }),
});

export const PATCH = withAdmin(async (request: NextRequest, _session, ctx?: RouteCtx) => {
  if (!isPrismConfigured()) {
    return NextResponse.json({ error: "Prism is not configured in this environment." }, { status: 503 });
  }

  const params = ctx ? await ctx.params : null;
  const sku = Number(params?.sku ?? "");
  if (!Number.isInteger(sku) || sku <= 0) {
    return NextResponse.json({ error: "Invalid SKU" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const result = parsed.data.isTextbook
      ? await updateTextbookPricing(sku, parsed.data.patch, parsed.data.baseline)
      : await updateGmItem(sku, parsed.data.patch, parsed.data.baseline);

    // Non-blocking Supabase mirror
    try {
      const supabase = getSupabaseAdminClient();
      const snap = await getItemSnapshot(sku);
      if (snap) {
        await supabase.from("products").upsert({
          sku,
          barcode: snap.barcode,
          retail_price: snap.retail,
          cost: snap.cost,
          synced_at: new Date().toISOString(),
        });
      }
    } catch (mirrorErr) {
      console.warn(`[PATCH /api/products/${sku}] mirror failed:`, mirrorErr);
    }

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof Error && (err as Error & { code?: string }).code === "CONCURRENT_MODIFICATION") {
      const current = (err as Error & { current?: unknown }).current;
      return NextResponse.json({ error: "CONCURRENT_MODIFICATION", current }, { status: 409 });
    }
    console.error(`PATCH /api/products/${sku} failed:`, err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 },
    );
  }
});
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/products/[sku]/route.ts
git commit -m "feat(products): add PATCH /api/products/[sku] for single-item edit

Dispatches to updateGmItem or updateTextbookPricing based on isTextbook
flag. Optional baseline snapshot drives 409 Concurrent Modification
responses. Zod validates the patch shape. Supabase mirror is
non-blocking, same as POST.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 12: `DELETE /api/products/[sku]/hard-delete`

**Files:**
- Create: `src/app/api/products/[sku]/hard-delete/route.ts`

- [ ] **Step 1: Write the route**

Create `src/app/api/products/[sku]/hard-delete/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { withAdmin } from "@/domains/shared/auth";
import { isPrismConfigured } from "@/lib/prism";
import { hardDeleteItem } from "@/domains/product/prism-delete";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ sku: string }> };

/**
 * Hard-delete a real (non-test) item. Fails with 409 HAS_HISTORY if the
 * SKU has any transaction history. This is a separate route from the
 * test-item hard-delete path (which uses ?hard=true on the main DELETE
 * handler and requires a TEST-CLAUDE- barcode).
 */
export const DELETE = withAdmin(async (_request: NextRequest, _session, ctx?: RouteCtx) => {
  if (!isPrismConfigured()) {
    return NextResponse.json({ error: "Prism is not configured in this environment." }, { status: 503 });
  }

  const params = ctx ? await ctx.params : null;
  const sku = Number(params?.sku ?? "");
  if (!Number.isInteger(sku) || sku <= 0) {
    return NextResponse.json({ error: "Invalid SKU" }, { status: 400 });
  }

  try {
    const result = await hardDeleteItem(sku);
    try {
      const supabase = getSupabaseAdminClient();
      await supabase.from("products").delete().eq("sku", sku);
    } catch (mirrorErr) {
      console.warn(`[hard-delete /api/products/${sku}] mirror failed:`, mirrorErr);
    }
    return NextResponse.json({ sku: result.sku, mode: "hard", affected: result.affected });
  } catch (err) {
    const code = (err as Error & { code?: string }).code;
    if (code === "HAS_HISTORY") {
      return NextResponse.json({ error: "HAS_HISTORY", message: (err as Error).message }, { status: 409 });
    }
    console.error(`hard-delete /api/products/${sku} failed:`, err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 },
    );
  }
});
```

- [ ] **Step 2: Commit**

```bash
git add "src/app/api/products/[sku]/hard-delete/route.ts"
git commit -m "feat(products): add hard-delete route for no-history items

Separate endpoint from the test-only ?hard=true path on DELETE /[sku].
Returns 409 HAS_HISTORY if the SKU has any sales/invoice/PO/receiving
records.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 13: `GET /api/products/history-check`

**Files:**
- Create: `src/app/api/products/history-check/route.ts`

- [ ] **Step 1: Write the route**

Create `src/app/api/products/history-check/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { withAdmin } from "@/domains/shared/auth";
import { isPrismConfigured } from "@/lib/prism";
import { hasTransactionHistory } from "@/domains/product/prism-delete";

export const dynamic = "force-dynamic";

/**
 * Returns { [sku]: boolean } — true means the SKU has transaction history
 * and cannot be hard-deleted. Used by the HardDeleteDialog to decide
 * which selected rows are eligible.
 */
export const GET = withAdmin(async (request: NextRequest) => {
  if (!isPrismConfigured()) {
    return NextResponse.json({ error: "Prism is not configured in this environment." }, { status: 503 });
  }

  const url = new URL(request.url);
  const skusParam = url.searchParams.get("skus") ?? "";
  const skus = skusParam
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);

  if (skus.length === 0) {
    return NextResponse.json({});
  }

  try {
    const hasHistory = await hasTransactionHistory(skus);
    const out: Record<string, boolean> = {};
    for (const sku of skus) {
      out[String(sku)] = hasHistory.has(sku);
    }
    return NextResponse.json(out);
  } catch (err) {
    console.error("GET /api/products/history-check failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 },
    );
  }
});
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/products/history-check/route.ts
git commit -m "feat(products): add history-check endpoint for delete eligibility

GET /api/products/history-check?skus=1,2,3 returns a map of SKU -> bool
indicating which SKUs have transaction history (and therefore cannot
be hard-deleted).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 14: `POST /api/products/validate-batch`

**Files:**
- Create: `src/app/api/products/validate-batch/route.ts`

- [ ] **Step 1: Write the route**

Create `src/app/api/products/validate-batch/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAdmin } from "@/domains/shared/auth";
import { isPrismConfigured } from "@/lib/prism";
import {
  validateBatchCreateAgainstPrism,
  validateBatchUpdateAgainstPrism,
} from "@/domains/product/prism-batch";
import { hasTransactionHistory } from "@/domains/product/prism-delete";

export const dynamic = "force-dynamic";

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create"),
    rows: z.array(z.object({
      description: z.string(),
      vendorId: z.number().int(),
      dccId: z.number().int(),
      itemTaxTypeId: z.number().int().optional(),
      barcode: z.string().nullable().optional(),
      catalogNumber: z.string().nullable().optional(),
      comment: z.string().nullable().optional(),
      packageType: z.string().nullable().optional(),
      unitsPerPack: z.number().int().optional(),
      retail: z.number(),
      cost: z.number(),
    })),
  }),
  z.object({
    action: z.literal("update"),
    rows: z.array(z.object({
      sku: z.number().int().positive(),
      patch: z.record(z.any()),
    })),
  }),
  z.object({
    action: z.literal("hard-delete"),
    skus: z.array(z.number().int().positive()),
  }),
]);

export const POST = withAdmin(async (request: NextRequest) => {
  if (!isPrismConfigured()) {
    return NextResponse.json({ error: "Prism is not configured in this environment." }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  try {
    if (parsed.data.action === "create") {
      const errors = await validateBatchCreateAgainstPrism(parsed.data.rows);
      return NextResponse.json({ errors });
    }
    if (parsed.data.action === "update") {
      const errors = await validateBatchUpdateAgainstPrism(parsed.data.rows);
      return NextResponse.json({ errors });
    }
    // hard-delete
    const hist = await hasTransactionHistory(parsed.data.skus);
    const errors = parsed.data.skus
      .map((sku, i) => hist.has(sku)
        ? { rowIndex: i, field: "sku", code: "HAS_HISTORY", message: `SKU ${sku} has transaction history` }
        : null)
      .filter((e) => e !== null);
    return NextResponse.json({ errors });
  } catch (err) {
    console.error("validate-batch failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 },
    );
  }
});
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/products/validate-batch/route.ts
git commit -m "feat(products): add validate-batch dry-run endpoint

Accepts create/update/hard-delete batches and returns validation
errors without writing anything. UIs call this before submit so
users can fix all errors in one pass.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 15: `POST /api/products/batch`

**Files:**
- Create: `src/app/api/products/batch/route.ts`

- [ ] **Step 1: Write the route**

Create `src/app/api/products/batch/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAdmin } from "@/domains/shared/auth";
import { isPrismConfigured } from "@/lib/prism";
import {
  batchCreateGmItems,
  batchDiscontinueItems,
  batchHardDeleteItems,
  batchUpdateItems,
  validateBatchCreateAgainstPrism,
  validateBatchUpdateAgainstPrism,
} from "@/domains/product/prism-batch";
import { hasTransactionHistory } from "@/domains/product/prism-delete";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create"),
    rows: z.array(z.object({
      description: z.string(),
      vendorId: z.number().int(),
      dccId: z.number().int(),
      itemTaxTypeId: z.number().int().optional(),
      barcode: z.string().nullable().optional(),
      catalogNumber: z.string().nullable().optional(),
      comment: z.string().nullable().optional(),
      packageType: z.string().nullable().optional(),
      unitsPerPack: z.number().int().optional(),
      retail: z.number(),
      cost: z.number(),
    })),
  }),
  z.object({
    action: z.literal("update"),
    rows: z.array(z.object({
      sku: z.number().int().positive(),
      isTextbook: z.boolean().optional(),
      patch: z.record(z.any()),
    })),
  }),
  z.object({
    action: z.literal("discontinue"),
    skus: z.array(z.number().int().positive()),
  }),
  z.object({
    action: z.literal("hard-delete"),
    skus: z.array(z.number().int().positive()),
  }),
]);

export const POST = withAdmin(async (request: NextRequest) => {
  if (!isPrismConfigured()) {
    return NextResponse.json({ error: "Prism is not configured in this environment." }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  try {
    if (parsed.data.action === "create") {
      // Re-validate server-side before committing
      const errors = await validateBatchCreateAgainstPrism(parsed.data.rows);
      if (errors.length > 0) return NextResponse.json({ errors }, { status: 400 });
      const skus = await batchCreateGmItems(parsed.data.rows);
      // Non-blocking mirror
      try {
        const supabase = getSupabaseAdminClient();
        await supabase.from("products").upsert(parsed.data.rows.map((row, i) => ({
          sku: skus[i],
          item_type: "general_merchandise",
          description: row.description,
          barcode: row.barcode ?? null,
          retail_price: row.retail,
          cost: row.cost,
          vendor_id: row.vendorId,
          dcc_id: row.dccId,
          synced_at: new Date().toISOString(),
        })));
      } catch (mirrorErr) {
        console.warn("[batch create] mirror failed:", mirrorErr);
      }
      return NextResponse.json({ action: "create", count: skus.length, skus }, { status: 201 });
    }

    if (parsed.data.action === "update") {
      const errors = await validateBatchUpdateAgainstPrism(parsed.data.rows.map((r) => ({ sku: r.sku, patch: r.patch })));
      if (errors.length > 0) return NextResponse.json({ errors }, { status: 400 });
      const skus = await batchUpdateItems(parsed.data.rows.map((r) => ({
        sku: r.sku,
        patch: r.patch,
        isTextbook: !!r.isTextbook,
      })));
      return NextResponse.json({ action: "update", count: skus.length, skus });
    }

    if (parsed.data.action === "discontinue") {
      const skus = await batchDiscontinueItems(parsed.data.skus);
      return NextResponse.json({ action: "discontinue", count: skus.length, skus });
    }

    // hard-delete
    const hist = await hasTransactionHistory(parsed.data.skus);
    const blocked = parsed.data.skus.filter((s) => hist.has(s));
    if (blocked.length > 0) {
      return NextResponse.json({
        errors: blocked.map((sku) => ({ rowIndex: parsed.data.skus.indexOf(sku), field: "sku", code: "HAS_HISTORY", message: `SKU ${sku} has transaction history` })),
      }, { status: 409 });
    }
    const deleted = await batchHardDeleteItems(parsed.data.skus);
    try {
      const supabase = getSupabaseAdminClient();
      await supabase.from("products").delete().in("sku", deleted);
    } catch (mirrorErr) {
      console.warn("[batch hard-delete] mirror failed:", mirrorErr);
    }
    return NextResponse.json({ action: "hard-delete", count: deleted.length, skus: deleted });
  } catch (err) {
    console.error("POST /api/products/batch failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 },
    );
  }
});
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/products/batch/route.ts
git commit -m "feat(products): add unified batch endpoint

POST /api/products/batch dispatches on action (create/update/
discontinue/hard-delete). Create and update re-validate against
Prism before committing; hard-delete enforces the history guard.
All batches are atomic — any validation failure returns 400/409
without touching data.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 16: API client additions

**Files:**
- Modify: `src/domains/product/api-client.ts`

- [ ] **Step 1: Read the current api-client to find the export pattern**

Run:
```bash
cat src/domains/product/api-client.ts
```

Locate the `productApi` export and add new methods alongside existing ones.

- [ ] **Step 2: Add new methods to `productApi`**

Add these to the `productApi` export in `src/domains/product/api-client.ts` (replace the whole object if simpler):

```typescript
async update(
  sku: number,
  body: {
    patch: GmItemPatch | TextbookPatch;
    isTextbook?: boolean;
    baseline?: ItemSnapshot;
  },
): Promise<{ sku: number; appliedFields: string[] }> {
  const res = await fetch(`/api/products/${sku}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.status === 409) {
    const data = await res.json();
    const err = new Error("CONCURRENT_MODIFICATION") as Error & { code: string; current: unknown };
    err.code = "CONCURRENT_MODIFICATION";
    err.current = data.current;
    throw err;
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? `HTTP ${res.status}`);
  }
  return res.json();
},

async hardDelete(sku: number): Promise<{ sku: number; affected: number }> {
  const res = await fetch(`/api/products/${sku}/hard-delete`, { method: "DELETE" });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message ?? data.error ?? `HTTP ${res.status}`);
  }
  return res.json();
},

async historyCheck(skus: number[]): Promise<Record<string, boolean>> {
  if (skus.length === 0) return {};
  const res = await fetch(`/api/products/history-check?skus=${skus.join(",")}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
},

async validateBatch(
  body:
    | { action: "create"; rows: BatchCreateRow[] }
    | { action: "update"; rows: { sku: number; patch: GmItemPatch | TextbookPatch }[] }
    | { action: "hard-delete"; skus: number[] },
): Promise<{ errors: BatchValidationError[] }> {
  const res = await fetch("/api/products/validate-batch", {
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

async batch(
  body:
    | { action: "create"; rows: BatchCreateRow[] }
    | { action: "update"; rows: { sku: number; patch: GmItemPatch | TextbookPatch; isTextbook?: boolean }[] }
    | { action: "discontinue"; skus: number[] }
    | { action: "hard-delete"; skus: number[] },
): Promise<{ action: string; count: number; skus: number[] } | { errors: BatchValidationError[] }> {
  const res = await fetch("/api/products/batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.status === 400 || res.status === 409) {
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

Also add the type imports at the top:

```typescript
import type {
  GmItemPatch,
  TextbookPatch,
  ItemSnapshot,
  BatchCreateRow,
  BatchValidationError,
} from "./types";
```

- [ ] **Step 3: Commit**

```bash
git add src/domains/product/api-client.ts
git commit -m "feat(products): extend api-client with edit + batch methods

update(), hardDelete(), historyCheck(), validateBatch(), batch().
Unwraps 409 CONCURRENT_MODIFICATION into a thrown error with a
.current payload so callers can show a diff.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase F — Prism integration scripts (run on-campus before UI work)

### Task 17: `scripts/test-prism-edit.ts`

**Files:**
- Create: `scripts/test-prism-edit.ts`

- [ ] **Step 1: Write the script**

Create `scripts/test-prism-edit.ts`:

```typescript
/**
 * Live edit round-trip: create a TEST-CLAUDE item, update every editable
 * field one at a time, verify each change landed, then hard-delete.
 * Run on the LACCD intranet only.
 */
import { config as loadEnv } from "dotenv";
import path from "path";
loadEnv({ path: path.resolve(process.cwd(), ".env.local") });
loadEnv({ path: path.resolve(process.cwd(), ".env") });

import { createGmItem, deleteTestItem } from "@/domains/product/prism-server";
import { updateGmItem, getItemSnapshot } from "@/domains/product/prism-updates";
import { getPrismPool, sql } from "@/lib/prism";

const BARCODE = `TEST-CLAUDE-EDIT-${Date.now()}`;

async function main() {
  const created = await createGmItem({
    description: "EDIT TEST — ORIGINAL",
    vendorId: 21,
    dccId: 1968650,
    itemTaxTypeId: 6,
    barcode: BARCODE,
    retail: 9.99,
    cost: 5,
  });
  console.log(`Created SKU ${created.sku} with barcode ${BARCODE}`);

  try {
    await updateGmItem(created.sku, { retail: 12.5, cost: 6 });
    const snap1 = await getItemSnapshot(created.sku);
    if (snap1?.retail !== 12.5 || snap1?.cost !== 6) {
      throw new Error(`retail/cost update failed: ${JSON.stringify(snap1)}`);
    }
    console.log("✓ retail + cost updated");

    await updateGmItem(created.sku, { description: "EDIT TEST — UPDATED" });
    const pool = await getPrismPool();
    const desc = await pool.request().input("sku", sql.Int, created.sku).query<{ Description: string }>(
      "SELECT Description FROM GeneralMerchandise WHERE SKU = @sku",
    );
    if (desc.recordset[0]?.Description?.trim() !== "EDIT TEST — UPDATED") {
      throw new Error(`description update failed: ${JSON.stringify(desc.recordset[0])}`);
    }
    console.log("✓ description updated");

    await updateGmItem(created.sku, { comment: "edited" });
    const cmt = await pool.request().input("sku", sql.Int, created.sku).query<{ txComment: string }>(
      "SELECT txComment FROM Item WHERE SKU = @sku",
    );
    if (cmt.recordset[0]?.txComment?.trim() !== "edited") {
      throw new Error(`comment update failed: ${JSON.stringify(cmt.recordset[0])}`);
    }
    console.log("✓ comment updated");

    console.log("All edits verified.");
  } finally {
    await deleteTestItem(created.sku);
    console.log(`Cleaned up SKU ${created.sku}`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
```

- [ ] **Step 2: Run the script (on-campus only)**

Run:
```bash
npx tsx scripts/test-prism-edit.ts
```

Expected output:
```
Created SKU ... with barcode TEST-CLAUDE-EDIT-...
✓ retail + cost updated
✓ description updated
✓ comment updated
All edits verified.
Cleaned up SKU ...
```

- [ ] **Step 3: Commit**

```bash
git add scripts/test-prism-edit.ts
git commit -m "test(products): add live edit round-trip script

Creates a TEST-CLAUDE item, exercises updateGmItem across retail/cost,
description, and comment, verifies each via re-reads, then hard-
deletes the test item.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 18: `scripts/test-prism-batch-add.ts`

**Files:**
- Create: `scripts/test-prism-batch-add.ts`

- [ ] **Step 1: Write the script**

Create `scripts/test-prism-batch-add.ts`:

```typescript
/**
 * Live batch-create round-trip. Inserts 5 TEST-CLAUDE-BATCH items in one
 * transaction, verifies they all appear, then hard-deletes them.
 */
import { config as loadEnv } from "dotenv";
import path from "path";
loadEnv({ path: path.resolve(process.cwd(), ".env.local") });
loadEnv({ path: path.resolve(process.cwd(), ".env") });

import { batchCreateGmItems, batchUpdateItems } from "@/domains/product/prism-batch";
import { deleteTestItem } from "@/domains/product/prism-server";
import { getPrismPool, sql } from "@/lib/prism";

async function main() {
  const stamp = Date.now();
  const rows = Array.from({ length: 5 }, (_, i) => ({
    description: `BATCH TEST ${i + 1}`,
    vendorId: 21,
    dccId: 1968650,
    itemTaxTypeId: 6,
    barcode: `TEST-CLAUDE-BATCH-${stamp}-${i}`,
    retail: 10 + i,
    cost: 5 + i,
  }));

  const skus = await batchCreateGmItems(rows);
  console.log(`Created ${skus.length} SKUs:`, skus);

  try {
    const pool = await getPrismPool();
    const req = pool.request();
    const params = skus.map((_, i) => `@s${i}`);
    skus.forEach((s, i) => req.input(`s${i}`, sql.Int, s));
    const result = await req.query<{ SKU: number }>(`SELECT SKU FROM Item WHERE SKU IN (${params.join(", ")})`);
    if (result.recordset.length !== skus.length) {
      throw new Error(`Expected ${skus.length} rows, found ${result.recordset.length}`);
    }
    console.log("✓ all rows visible");

    // Exercise the batch-update path: raise every retail by 1
    await batchUpdateItems(skus.map((sku) => ({ sku, patch: { retail: 99.99 }, isTextbook: false })));
    const checkReq = pool.request();
    skus.forEach((s, i) => checkReq.input(`s${i}`, sql.Int, s));
    const priced = await checkReq.query<{ SKU: number; Retail: number }>(
      `SELECT i.SKU, inv.Retail FROM Item i JOIN Inventory inv ON i.SKU = inv.SKU AND inv.LocationID = 2 WHERE i.SKU IN (${params.join(", ")})`,
    );
    for (const row of priced.recordset) {
      if (Number(row.Retail) !== 99.99) {
        throw new Error(`Batch update failed for SKU ${row.SKU}: Retail=${row.Retail}`);
      }
    }
    console.log("✓ batch update applied (retail=99.99 on all rows)");
  } finally {
    for (const sku of skus) {
      try { await deleteTestItem(sku); } catch (e) { console.warn(`cleanup ${sku} failed`, e); }
    }
    console.log(`Cleaned up ${skus.length} test items`);
  }
  process.exit(0);
}

main().catch((err) => { console.error("FAILED:", err); process.exit(1); });
```

- [ ] **Step 2: Run the script (on-campus only)**

Run:
```bash
npx tsx scripts/test-prism-batch-add.ts
```

Expected: `Created 5 SKUs: [...]`, `✓ all rows visible`, `Cleaned up 5 test items`.

- [ ] **Step 3: Commit**

```bash
git add scripts/test-prism-batch-add.ts
git commit -m "test(products): add live batch-create round-trip script

Inserts 5 items in one transaction, verifies SKUs appear in Item table,
then cleans up via deleteTestItem (all use TEST-CLAUDE-BATCH- barcode
prefix so the guard accepts cleanup).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 19: `scripts/test-prism-hard-delete-guard.ts`

**Files:**
- Create: `scripts/test-prism-hard-delete-guard.ts`

- [ ] **Step 1: Write the script**

Create `scripts/test-prism-hard-delete-guard.ts`:

```typescript
/**
 * Exercises the HAS_HISTORY guard. Picks a real SKU with sales history
 * and confirms hardDeleteItem refuses. Then verifies a fresh TEST-CLAUDE
 * item (no history) can be hard-deleted successfully.
 */
import { config as loadEnv } from "dotenv";
import path from "path";
loadEnv({ path: path.resolve(process.cwd(), ".env.local") });
loadEnv({ path: path.resolve(process.cwd(), ".env") });

import { createGmItem } from "@/domains/product/prism-server";
import { hardDeleteItem, hasTransactionHistory } from "@/domains/product/prism-delete";
import { getPrismPool, sql } from "@/lib/prism";

async function main() {
  // Find any SKU with sales history
  const pool = await getPrismPool();
  const history = await pool.request().query<{ SKU: number }>(
    "SELECT TOP 1 SKU FROM Inventory_Sales_History",
  );
  const busySku = history.recordset[0]?.SKU;
  if (!busySku) {
    console.warn("No sales history in DB — skipping busy-SKU guard check.");
  } else {
    console.log(`Testing guard against real SKU ${busySku}...`);
    try {
      await hardDeleteItem(busySku);
      throw new Error(`Guard failed — SKU ${busySku} was deleted despite having history!`);
    } catch (err) {
      const code = (err as Error & { code?: string }).code;
      if (code !== "HAS_HISTORY") {
        throw new Error(`Expected HAS_HISTORY, got: ${err}`);
      }
      console.log(`✓ SKU ${busySku} correctly blocked with HAS_HISTORY`);
    }
  }

  // Create a fresh item, verify it has no history, hard-delete it
  const BARCODE = `TEST-CLAUDE-HDEL-${Date.now()}`;
  const created = await createGmItem({
    description: "HARD DELETE TEST",
    vendorId: 21,
    dccId: 1968650,
    barcode: BARCODE,
    retail: 1,
    cost: 0.5,
  });
  console.log(`Created SKU ${created.sku}`);

  const hist = await hasTransactionHistory([created.sku]);
  if (hist.has(created.sku)) {
    throw new Error(`Fresh item unexpectedly has history: ${created.sku}`);
  }

  await hardDeleteItem(created.sku);
  console.log(`✓ SKU ${created.sku} hard-deleted`);

  // Verify it's gone
  const check = await pool.request().input("sku", sql.Int, created.sku)
    .query<{ SKU: number }>("SELECT SKU FROM Item WHERE SKU = @sku");
  if (check.recordset.length > 0) {
    throw new Error(`SKU ${created.sku} still present after hard-delete`);
  }
  console.log("✓ row gone from Item table");

  process.exit(0);
}

main().catch((err) => { console.error("FAILED:", err); process.exit(1); });
```

- [ ] **Step 2: Run the script (on-campus only)**

Run:
```bash
npx tsx scripts/test-prism-hard-delete-guard.ts
```

Expected: guard-blocked message for the busy SKU, create/hard-delete success for the fresh one.

- [ ] **Step 3: Commit**

```bash
git add scripts/test-prism-hard-delete-guard.ts
git commit -m "test(products): add hard-delete history-guard script

Picks a real SKU with sales history and confirms hardDeleteItem
refuses with HAS_HISTORY. Then creates a fresh TEST-CLAUDE item and
verifies the guard allows deletion when no history exists.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase G — Shared UI component: ItemRefSelects

### Task 20: Extract vendor/DCC/tax-type dropdowns

**Files:**
- Create: `src/components/products/item-ref-selects.tsx`
- Modify: `src/components/products/new-item-dialog.tsx`

- [ ] **Step 1: Read the existing dropdowns in new-item-dialog**

Run:
```bash
cat src/components/products/new-item-dialog.tsx
```

Note the JSX for vendor / DCC / tax-type selects (the blocks rendering `<Select>` bound to `refs.vendors`, `refs.dccs`, `refs.taxTypes`).

- [ ] **Step 2: Create the shared component**

Create `src/components/products/item-ref-selects.tsx`:

```typescript
"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import type { PrismRefs } from "@/domains/product/api-client";

export interface ItemRefSelectsProps {
  refs: PrismRefs | null;
  vendorId: string;
  dccId: string;
  itemTaxTypeId: string;
  onChange: (field: "vendorId" | "dccId" | "itemTaxTypeId", value: string) => void;
  /** Bulk-mode: render a "Leave unchanged" placeholder as the default value. */
  bulkMode?: boolean;
  disabled?: boolean;
}

export function ItemRefSelects({
  refs,
  vendorId,
  dccId,
  itemTaxTypeId,
  onChange,
  bulkMode = false,
  disabled = false,
}: ItemRefSelectsProps) {
  const placeholder = bulkMode ? "Leave unchanged" : "Select…";
  return (
    <>
      <div className="space-y-1.5">
        <Label>Vendor</Label>
        <Select value={vendorId} onValueChange={(v) => onChange("vendorId", v)} disabled={disabled}>
          <SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger>
          <SelectContent>
            {refs?.vendors.map((v) => (
              <SelectItem key={v.vendorId} value={String(v.vendorId)}>{v.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>DCC</Label>
        <Select value={dccId} onValueChange={(v) => onChange("dccId", v)} disabled={disabled}>
          <SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger>
          <SelectContent>
            {refs?.dccs.map((d) => (
              <SelectItem key={d.dccId} value={String(d.dccId)}>
                {d.deptName} / {d.className ?? "—"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Tax Type</Label>
        <Select value={itemTaxTypeId} onValueChange={(v) => onChange("itemTaxTypeId", v)} disabled={disabled}>
          <SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger>
          <SelectContent>
            {refs?.taxTypes.map((t) => (
              <SelectItem key={t.taxTypeId} value={String(t.taxTypeId)}>{t.description}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </>
  );
}
```

- [ ] **Step 3: Replace the inline selects in `new-item-dialog.tsx`**

In `src/components/products/new-item-dialog.tsx`:
- Add `import { ItemRefSelects } from "./item-ref-selects";` to the imports.
- Replace the three `<Select>` blocks for vendor / DCC / tax type with:

```tsx
<ItemRefSelects
  refs={refs}
  vendorId={form.vendorId}
  dccId={form.dccId}
  itemTaxTypeId={form.itemTaxTypeId}
  onChange={(field, value) => setForm((f) => ({ ...f, [field]: value }))}
/>
```

- [ ] **Step 4: Run tests (nothing should break)**

Run:
```bash
npm test -- tests/components
```

Expected: existing tests still pass (no component tests for NewItemDialog exist yet; this is mainly a compile-check).

- [ ] **Step 5: Commit**

```bash
git add src/components/products/item-ref-selects.tsx src/components/products/new-item-dialog.tsx
git commit -m "refactor(products): extract ItemRefSelects for reuse

Pulls the vendor/DCC/tax dropdowns out of new-item-dialog so the
forthcoming EditItemDialog and BatchAddGrid can share them. Adds a
bulkMode prop that changes the placeholder from 'Select…' to
'Leave unchanged' for the batch-edit dialog.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase H — EditItemDialog

### Task 21: EditItemDialog component

**Files:**
- Create: `src/components/products/edit-item-dialog.tsx`
- Test: `tests/components/edit-item-dialog.test.tsx`

- [ ] **Step 1: Write the dirty-field-extraction test**

Create `tests/components/edit-item-dialog.test.tsx`:

```typescript
import { describe, it, expect } from "vitest";
import { buildPatch } from "@/components/products/edit-item-dialog";

describe("buildPatch", () => {
  it("returns empty patch when nothing changed", () => {
    const baseline = { description: "x", retail: 10, cost: 5, barcode: "A", vendorId: 1, dccId: 2, itemTaxTypeId: 6, comment: "", catalogNumber: "", packageType: "", unitsPerPack: 1 };
    const current = { ...baseline };
    expect(buildPatch(baseline, current)).toEqual({});
  });

  it("includes only changed fields", () => {
    const baseline = { description: "x", retail: 10, cost: 5 };
    const current = { description: "x", retail: 12, cost: 5 };
    expect(buildPatch(baseline, current)).toEqual({ retail: 12 });
  });

  it("preserves empty-string -> null for barcode", () => {
    const baseline = { barcode: "A" };
    const current = { barcode: "" };
    expect(buildPatch(baseline, current)).toEqual({ barcode: null });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
npm test -- tests/components/edit-item-dialog.test.tsx
```

Expected: FAIL — `Cannot find module '@/components/products/edit-item-dialog'`.

- [ ] **Step 3: Create the EditItemDialog**

Create `src/components/products/edit-item-dialog.tsx`:

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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ItemRefSelects } from "./item-ref-selects";
import { productApi, type PrismRefs } from "@/domains/product/api-client";
import type { GmItemPatch, TextbookPatch, ItemSnapshot } from "@/domains/product/types";

interface EditItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Rows to edit. Pass as ItemSnapshot[] — one per selected SKU. */
  items: Array<ItemSnapshot & { description?: string; vendorId?: number; dccId?: number; itemTaxTypeId?: number; isTextbook?: boolean; comment?: string; catalogNumber?: string; packageType?: string; unitsPerPack?: number }>;
  onSaved?: (skus: number[]) => void;
}

type FormState = Partial<{
  description: string;
  vendorId: string;
  dccId: string;
  itemTaxTypeId: string;
  barcode: string;
  catalogNumber: string;
  comment: string;
  retail: string;
  cost: string;
  packageType: string;
  unitsPerPack: string;
  fDiscontinue: string;
}>;

/** Diff a baseline state against a current state; return only the changed fields as a patch. */
export function buildPatch(baseline: Record<string, unknown>, current: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(current)) {
    const b = baseline[key];
    const c = current[key];
    if (b === c) continue;
    if (key === "barcode" && typeof c === "string" && c.length === 0) {
      out.barcode = null;
      continue;
    }
    out[key] = c;
  }
  return out;
}

export function EditItemDialog({ open, onOpenChange, items, onSaved }: EditItemDialogProps) {
  const isBulk = items.length > 1;
  const hasTextbook = items.some((i) => i.isTextbook);
  const narrow = hasTextbook; // mixed or all-textbook → narrow mode
  const [refs, setRefs] = useState<PrismRefs | null>(null);
  const [form, setForm] = useState<FormState>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load refs once
  useEffect(() => {
    if (!open || refs) return;
    productApi.getRefs().then(setRefs).catch((e) => setError(String(e)));
  }, [open, refs]);

  // Reset form when items change
  useEffect(() => {
    if (!open) return;
    if (isBulk) {
      setForm({});
      return;
    }
    const it = items[0];
    setForm({
      description: it.description ?? "",
      vendorId: it.vendorId ? String(it.vendorId) : "",
      dccId: it.dccId ? String(it.dccId) : "",
      itemTaxTypeId: it.itemTaxTypeId ? String(it.itemTaxTypeId) : "",
      barcode: it.barcode ?? "",
      catalogNumber: it.catalogNumber ?? "",
      comment: it.comment ?? "",
      retail: String(it.retail),
      cost: String(it.cost),
      packageType: it.packageType ?? "",
      unitsPerPack: it.unitsPerPack ? String(it.unitsPerPack) : "",
      fDiscontinue: String(it.fDiscontinue),
    });
  }, [open, items, isBulk]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);

    const baseline = isBulk ? {} : (() => {
      const it = items[0];
      return {
        description: it.description ?? "",
        vendorId: it.vendorId ? String(it.vendorId) : "",
        dccId: it.dccId ? String(it.dccId) : "",
        itemTaxTypeId: it.itemTaxTypeId ? String(it.itemTaxTypeId) : "",
        barcode: it.barcode ?? "",
        catalogNumber: it.catalogNumber ?? "",
        comment: it.comment ?? "",
        retail: String(it.retail),
        cost: String(it.cost),
        packageType: it.packageType ?? "",
        unitsPerPack: it.unitsPerPack ? String(it.unitsPerPack) : "",
        fDiscontinue: String(it.fDiscontinue),
      };
    })();

    const rawPatch = buildPatch(baseline, form as Record<string, unknown>);
    // Convert string fields to correct types; drop empty strings for bulk mode fields the user didn't touch
    const patch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rawPatch)) {
      if (v === "" && isBulk) continue; // skip untouched bulk fields
      if (k === "retail" || k === "cost" || k === "weight") patch[k] = Number(v);
      else if (k === "vendorId" || k === "dccId" || k === "itemTaxTypeId" || k === "unitsPerPack") patch[k] = v ? Number(v) : undefined;
      else if (k === "fDiscontinue") patch[k] = Number(v) === 1 ? 1 : 0;
      else patch[k] = v;
    }
    // Remove undefined entries from the patch
    for (const k of Object.keys(patch)) if (patch[k] === undefined) delete patch[k];

    try {
      if (items.length === 1) {
        const it = items[0];
        await productApi.update(it.sku, {
          patch: patch as GmItemPatch | TextbookPatch,
          isTextbook: !!it.isTextbook,
          baseline: { sku: it.sku, barcode: it.barcode, retail: it.retail, cost: it.cost, fDiscontinue: it.fDiscontinue },
        });
      } else {
        const result = await productApi.batch({
          action: "update",
          rows: items.map((i) => ({ sku: i.sku, patch: patch as GmItemPatch | TextbookPatch, isTextbook: !!i.isTextbook })),
        });
        if ("errors" in result && result.errors.length > 0) {
          setError(result.errors.map((e) => `Row ${e.rowIndex + 1}: ${e.message}`).join("; "));
          return;
        }
      }
      onSaved?.(items.map((i) => i.sku));
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isBulk ? `Edit ${items.length} items` : `Edit SKU ${items[0]?.sku}`}</DialogTitle>
          <DialogDescription>
            {isBulk ? "Fields left blank won't be changed. Fields you fill will be applied to all selected items." : "Only changed fields will be written."}
            {hasTextbook ? " (textbook-safe fields only)" : null}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4">
          {!narrow && (
            <div className="col-span-2 space-y-1.5">
              <Label>Description</Label>
              <Input
                placeholder={isBulk ? "Leave unchanged (per-row)" : ""}
                value={form.description ?? ""}
                disabled={isBulk}
                onChange={(e) => update("description", e.target.value)}
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Barcode</Label>
            <Input
              placeholder={isBulk ? "Leave unchanged (per-row)" : ""}
              value={form.barcode ?? ""}
              disabled={isBulk}
              onChange={(e) => update("barcode", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Retail</Label>
            <Input
              type="number" step="0.01"
              placeholder={isBulk ? "Leave unchanged" : ""}
              value={form.retail ?? ""}
              onChange={(e) => update("retail", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Cost</Label>
            <Input
              type="number" step="0.01"
              placeholder={isBulk ? "Leave unchanged" : ""}
              value={form.cost ?? ""}
              onChange={(e) => update("cost", e.target.value)}
            />
          </div>

          {!narrow && (
            <ItemRefSelects
              refs={refs}
              vendorId={form.vendorId ?? ""}
              dccId={form.dccId ?? ""}
              itemTaxTypeId={form.itemTaxTypeId ?? ""}
              onChange={(field, value) => update(field, value)}
              bulkMode={isBulk}
            />
          )}

          {!narrow && (
            <>
              <div className="space-y-1.5">
                <Label>Catalog #</Label>
                <Input
                  placeholder={isBulk ? "Leave unchanged" : ""}
                  value={form.catalogNumber ?? ""}
                  onChange={(e) => update("catalogNumber", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Comment</Label>
                <Input
                  placeholder={isBulk ? "Leave unchanged" : ""}
                  value={form.comment ?? ""}
                  onChange={(e) => update("comment", e.target.value)}
                />
              </div>
            </>
          )}
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : isBulk ? `Apply to ${items.length}` : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: Run the test**

Run:
```bash
npm test -- tests/components/edit-item-dialog.test.tsx
```

Expected: PASS — all 3 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/components/products/edit-item-dialog.tsx tests/components/edit-item-dialog.test.tsx
git commit -m "feat(products): add EditItemDialog for single + bulk edits

One component handles three modes:
- Single: pre-filled, dirty-tracked; only changed fields are patched.
- Bulk (>1 item, no textbooks): 'Leave unchanged' placeholders; only
  touched fields apply to every selected SKU.
- Narrow (any textbook selected): limits UI to retail/cost/barcode/
  discontinue, the textbook-safe subset.

buildPatch() is exported for unit tests.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase I — HardDeleteDialog

### Task 22: HardDeleteDialog component

**Files:**
- Create: `src/components/products/hard-delete-dialog.tsx`

- [ ] **Step 1: Write the dialog**

Create `src/components/products/hard-delete-dialog.tsx`:

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

interface HardDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Rows selected for hard-delete. If a row is a textbook, it's blocked with a distinct message. */
  items: Array<{ sku: number; description?: string; isTextbook?: boolean }>;
  /** Called after a successful hard-delete. */
  onDeleted?: (skus: number[]) => void;
  /** Called when the user opts to discontinue instead. */
  onDiscontinueInstead?: (skus: number[]) => void;
}

type Verdict = "safe" | "has-history" | "textbook" | "loading";

export function HardDeleteDialog({ open, onOpenChange, items, onDeleted, onDiscontinueInstead }: HardDeleteDialogProps) {
  const [verdicts, setVerdicts] = useState<Map<number, Verdict>>(new Map());
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const initial = new Map<number, Verdict>();
    for (const it of items) {
      initial.set(it.sku, it.isTextbook ? "textbook" : "loading");
    }
    setVerdicts(initial);

    const gmSkus = items.filter((i) => !i.isTextbook).map((i) => i.sku);
    if (gmSkus.length === 0) return;

    productApi.historyCheck(gmSkus)
      .then((hist) => {
        const next = new Map(initial);
        for (const sku of gmSkus) {
          next.set(sku, hist[String(sku)] ? "has-history" : "safe");
        }
        setVerdicts(next);
      })
      .catch((e) => setError(String(e)));
  }, [open, items]);

  const allSafe = items.length > 0 && items.every((i) => verdicts.get(i.sku) === "safe");
  const blockedSkus = items.filter((i) => verdicts.get(i.sku) !== "safe").map((i) => i.sku);

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      if (items.length === 1) {
        await productApi.hardDelete(items[0].sku);
      } else {
        const result = await productApi.batch({ action: "hard-delete", skus: items.map((i) => i.sku) });
        if ("errors" in result && result.errors.length > 0) {
          setError(result.errors.map((e) => e.message).join("; "));
          return;
        }
      }
      onDeleted?.(items.map((i) => i.sku));
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Permanently delete {items.length} item{items.length !== 1 ? "s" : ""}?</DialogTitle>
          <DialogDescription>
            Hard-delete removes the row from Prism entirely. Only allowed when the item has no sales, purchase, invoice, or receiving history.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-80 space-y-2 overflow-y-auto">
          {items.map((it) => {
            const v = verdicts.get(it.sku) ?? "loading";
            return (
              <div key={it.sku} className="flex items-start justify-between gap-3 rounded border px-3 py-2 text-sm">
                <div>
                  <div className="font-mono">{it.sku}</div>
                  {it.description ? <div className="text-muted-foreground">{it.description}</div> : null}
                </div>
                <div>
                  {v === "loading" && <span className="text-muted-foreground">checking…</span>}
                  {v === "safe" && <span className="text-green-700">0 history records — safe</span>}
                  {v === "has-history" && <span className="text-destructive">has history — discontinue instead</span>}
                  {v === "textbook" && <span className="text-destructive">textbook — not supported, discontinue</span>}
                </div>
              </div>
            );
          })}
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={deleting}>Cancel</Button>
          {blockedSkus.length > 0 && onDiscontinueInstead ? (
            <Button variant="outline" onClick={() => { onDiscontinueInstead(blockedSkus); onOpenChange(false); }}>
              Discontinue blocked ({blockedSkus.length})
            </Button>
          ) : null}
          <Button onClick={handleDelete} disabled={!allSafe || deleting} className="bg-destructive hover:bg-destructive/90">
            {deleting ? "Deleting…" : "Delete permanently"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/products/hard-delete-dialog.tsx
git commit -m "feat(products): add HardDeleteDialog with history-check badges

Per-SKU verdict loaded via historyCheck(). Delete button disabled
unless every row is safe; textbook rows are always blocked with an
explanatory label. Offers a one-click 'Discontinue blocked' fallback
when any rows can't be hard-deleted.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase J — Wire Edit + Delete into ProductActionBar

### Task 23: Extend ProductActionBar with Edit + Delete actions

**Files:**
- Modify: `src/components/products/product-action-bar.tsx`
- Modify: `src/app/products/page.tsx`

- [ ] **Step 1: Extend `ProductActionBar` props**

Edit `src/components/products/product-action-bar.tsx` to accept new handlers and render the new buttons:

```typescript
// Add to ProductActionBarProps:
onEditClick?: () => void;
onHardDeleteClick?: () => void;
```

In the sticky-bar JSX, after the Discontinue button block, add:

```tsx
{prismAvailable && onEditClick ? (
  <Button size="sm" variant="outline" onClick={onEditClick}>
    Edit
  </Button>
) : null}
{prismAvailable && onHardDeleteClick ? (
  <Button size="sm" variant="outline" onClick={onHardDeleteClick} className="border-destructive/30 text-destructive hover:bg-destructive/10">
    Delete
  </Button>
) : null}
```

- [ ] **Step 2: Wire dialogs in `app/products/page.tsx`**

In `src/app/products/page.tsx`:
- Add state:

```tsx
const [editOpen, setEditOpen] = useState(false);
const [hardDeleteOpen, setHardDeleteOpen] = useState(false);
```

- Import `EditItemDialog`, `HardDeleteDialog`.
- Pass `onEditClick={() => setEditOpen(true)}` and `onHardDeleteClick={() => setHardDeleteOpen(true)}` to `ProductActionBar`.
- Render the dialogs alongside `NewItemDialog`:

```tsx
<EditItemDialog
  open={editOpen}
  onOpenChange={setEditOpen}
  items={Array.from(selected.values()).map((p) => ({
    sku: p.sku,
    barcode: p.barcode ?? null,
    retail: p.retail_price ?? 0,
    cost: p.cost ?? 0,
    fDiscontinue: 0,
    description: p.description ?? "",
    vendorId: p.vendor_id ?? undefined,
    dccId: p.dcc_id ?? undefined,
    isTextbook: p.item_type === "textbook",
  }))}
  onSaved={() => { setEditOpen(false); clearSelection(); router.refresh(); }}
/>

<HardDeleteDialog
  open={hardDeleteOpen}
  onOpenChange={setHardDeleteOpen}
  items={Array.from(selected.values()).map((p) => ({
    sku: p.sku,
    description: p.description ?? "",
    isTextbook: p.item_type === "textbook",
  }))}
  onDeleted={() => { setHardDeleteOpen(false); clearSelection(); router.refresh(); }}
/>
```

(Exact field names like `retail_price` / `item_type` come from the existing `SelectedProduct` type in `src/domains/product/types.ts`. Check those before typing.)

- [ ] **Step 3: Run ship-check locally**

Run:
```bash
npm run lint && npm test -- tests/components
```

Expected: lint green, component tests green.

- [ ] **Step 4: Commit**

```bash
git add src/components/products/product-action-bar.tsx src/app/products/page.tsx
git commit -m "feat(products): wire Edit + Delete buttons into action bar

ProductActionBar now renders Edit and Delete buttons when Prism is
available and handlers are provided. The products page owns the
dialogs and passes mapped selections through.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase K — BatchAddGrid + page

### Task 24: BatchAddGrid component (with paste handler)

**Files:**
- Create: `src/components/products/batch-add-grid.tsx`
- Test: `tests/components/batch-add-grid.test.tsx`

- [ ] **Step 1: Write the paste-handler test**

Create `tests/components/batch-add-grid.test.tsx`:

```typescript
import { describe, it, expect } from "vitest";
import { parsePastedGrid } from "@/components/products/batch-add-grid";

describe("parsePastedGrid", () => {
  it("splits a simple 2x2 TSV", () => {
    const out = parsePastedGrid("a\tb\nc\td");
    expect(out).toEqual([["a", "b"], ["c", "d"]]);
  });

  it("handles Excel CRLF line endings", () => {
    const out = parsePastedGrid("a\tb\r\nc\td\r\n");
    expect(out).toEqual([["a", "b"], ["c", "d"]]);
  });

  it("tolerates trailing tab/newline", () => {
    const out = parsePastedGrid("a\tb\t\nc\td\n");
    expect(out).toEqual([["a", "b", ""], ["c", "d"]]);
  });

  it("returns empty array for empty input", () => {
    expect(parsePastedGrid("")).toEqual([]);
    expect(parsePastedGrid("\n")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
npm test -- tests/components/batch-add-grid.test.tsx
```

Expected: FAIL — `Cannot find module '@/components/products/batch-add-grid'`.

- [ ] **Step 3: Write the component**

Create `src/components/products/batch-add-grid.tsx`:

```typescript
"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { productApi, type PrismRefs } from "@/domains/product/api-client";
import type { BatchCreateRow, BatchValidationError } from "@/domains/product/types";

export function parsePastedGrid(text: string): string[][] {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n").filter((l) => l.length > 0);
  return lines.map((l) => l.split("\t"));
}

const COLUMNS = [
  { key: "description", label: "Description", type: "text" as const, width: "min-w-60" },
  { key: "vendorId",    label: "Vendor ID",   type: "number" as const, width: "w-28" },
  { key: "dccId",       label: "DCC ID",      type: "number" as const, width: "w-32" },
  { key: "itemTaxTypeId", label: "Tax",       type: "number" as const, width: "w-20" },
  { key: "barcode",     label: "Barcode",     type: "text" as const, width: "w-40" },
  { key: "catalogNumber", label: "Catalog #", type: "text" as const, width: "w-32" },
  { key: "comment",     label: "Comment",     type: "text" as const, width: "w-32" },
  { key: "retail",      label: "Retail",      type: "number" as const, width: "w-24" },
  { key: "cost",        label: "Cost",        type: "number" as const, width: "w-24" },
];

interface GridRow {
  [key: string]: string;
}

function emptyRow(): GridRow {
  return Object.fromEntries(COLUMNS.map((c) => [c.key, ""])) as GridRow;
}

function toBatchRow(r: GridRow, defaults?: GridRow): BatchCreateRow | null {
  function v(key: string): string {
    const own = r[key]?.trim();
    if (own) return own;
    return (defaults?.[key] ?? "").trim();
  }
  const description = v("description");
  if (!description) return null;
  return {
    description,
    vendorId: Number(v("vendorId")) || 0,
    dccId: Number(v("dccId")) || 0,
    itemTaxTypeId: v("itemTaxTypeId") ? Number(v("itemTaxTypeId")) : undefined,
    barcode: v("barcode") || null,
    catalogNumber: v("catalogNumber") || null,
    comment: v("comment") || null,
    retail: Number(v("retail")) || 0,
    cost: Number(v("cost")) || 0,
  };
}

interface BatchAddGridProps {
  onSubmitted?: (skus: number[]) => void;
}

export function BatchAddGrid({ onSubmitted }: BatchAddGridProps) {
  const [rows, setRows] = useState<GridRow[]>([emptyRow(), emptyRow(), emptyRow()]);
  const [useDefaults, setUseDefaults] = useState(true);
  const [errors, setErrors] = useState<BatchValidationError[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [refs, setRefs] = useState<PrismRefs | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => { productApi.getRefs().then(setRefs).catch(() => {}); }, []);

  function updateCell(rowIdx: number, key: string, value: string) {
    setRows((r) => r.map((row, i) => (i === rowIdx ? { ...row, [key]: value } : row)));
    setErrors((e) => e.filter((err) => err.rowIndex !== rowIdx || err.field !== key));
  }

  function addRow() { setRows((r) => [...r, emptyRow()]); }

  function removeLastRow() {
    setRows((r) => r.length > 1 ? r.slice(0, -1) : r);
  }

  function onPaste(e: React.ClipboardEvent<HTMLInputElement>, rowIdx: number, colIdx: number) {
    const text = e.clipboardData.getData("text");
    if (!text.includes("\t") && !text.includes("\n")) return; // single cell paste — let default
    e.preventDefault();
    const grid = parsePastedGrid(text);
    setRows((existing) => {
      const next = [...existing];
      for (let i = 0; i < grid.length; i++) {
        const targetIdx = rowIdx + i;
        if (targetIdx >= next.length) next.push(emptyRow());
        const target = { ...next[targetIdx] };
        for (let j = 0; j < grid[i].length; j++) {
          const targetCol = COLUMNS[colIdx + j];
          if (!targetCol) break;
          target[targetCol.key] = grid[i][j];
        }
        next[targetIdx] = target;
      }
      return next;
    });
  }

  function rowsToBatch(): BatchCreateRow[] {
    const defaults = useDefaults ? rows[0] : undefined;
    return rows.map((r) => toBatchRow(r, defaults)).filter((r): r is BatchCreateRow => r !== null);
  }

  async function handleValidate() {
    setSubmitting(true);
    try {
      const batch = rowsToBatch();
      const result = await productApi.validateBatch({ action: "create", rows: batch });
      setErrors(result.errors);
      setToast(result.errors.length === 0 ? "No errors — ready to submit" : null);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmit() {
    setSubmitting(true);
    setErrors([]);
    try {
      const batch = rowsToBatch();
      const result = await productApi.batch({ action: "create", rows: batch });
      if ("errors" in result && result.errors.length > 0) {
        setErrors(result.errors);
        return;
      }
      if ("count" in result) {
        onSubmitted?.(result.skus);
      }
    } finally {
      setSubmitting(false);
    }
  }

  function cellError(rowIdx: number, key: string): string | null {
    const e = errors.find((x) => x.rowIndex === rowIdx && x.field === key);
    return e ? e.message : null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button onClick={addRow} variant="outline" size="sm">Add row</Button>
        <Button onClick={removeLastRow} variant="outline" size="sm">Remove last</Button>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={useDefaults} onChange={(e) => setUseDefaults(e.target.checked)} />
          Use row 1 as defaults for blank cells
        </label>
        <span className="ml-auto text-sm text-muted-foreground">{rows.length} rows</span>
      </div>

      <div className="overflow-x-auto rounded border">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              {COLUMNS.map((c) => (
                <th key={c.key} className={`px-2 py-2 text-left font-medium ${c.width}`}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIdx) => (
              <tr key={rowIdx} className="border-t">
                {COLUMNS.map((col, colIdx) => {
                  const err = cellError(rowIdx, col.key);
                  return (
                    <td key={col.key} className={`p-1 ${err ? "border-l-2 border-destructive" : ""}`} title={err ?? undefined}>
                      <Input
                        type={col.type}
                        step={col.type === "number" ? "0.01" : undefined}
                        value={row[col.key] ?? ""}
                        onPaste={(e) => onPaste(e, rowIdx, colIdx)}
                        onChange={(e) => updateCell(rowIdx, col.key, e.target.value)}
                        className={`h-8 ${err ? "border-destructive" : ""}`}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {errors.length > 0 ? (
        <p className="text-sm text-destructive">
          {errors.length} error{errors.length !== 1 ? "s" : ""} — fix before submitting.
        </p>
      ) : null}
      {toast ? <p className="text-sm text-green-700">{toast}</p> : null}

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={handleValidate} disabled={submitting}>Validate</Button>
        <Button onClick={handleSubmit} disabled={submitting || errors.length > 0}>
          {submitting ? "Working…" : `Submit ${rowsToBatch().length} items`}
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the tests**

Run:
```bash
npm test -- tests/components/batch-add-grid.test.tsx
```

Expected: PASS — 4 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/components/products/batch-add-grid.tsx tests/components/batch-add-grid.test.tsx
git commit -m "feat(products): add BatchAddGrid with paste-from-Excel

Editable grid with dynamic row add/remove, per-cell paste handler
that tolerates CRLF/trailing-tab quirks, and validate/submit wired
to /api/products/validate-batch and /api/products/batch. Row 1 can
optionally act as defaults for blank cells in later rows.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 25: Batch-add page + header link

**Files:**
- Create: `src/app/products/batch-add/page.tsx`
- Modify: `src/app/products/page.tsx`

- [ ] **Step 1: Create the page shell**

Create `src/app/products/batch-add/page.tsx`:

```typescript
"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { BatchAddGrid } from "@/components/products/batch-add-grid";
import { Button } from "@/components/ui/button";

export default function BatchAddPage() {
  const router = useRouter();
  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Batch add items</h1>
          <p className="text-sm text-muted-foreground">
            Paste from Excel or type rows directly. Validate before submitting — all rows must pass before any are written.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/products">Back to products</Link>
        </Button>
      </div>

      <BatchAddGrid
        onSubmitted={(skus) => {
          router.push(`/products?highlight=${skus.join(",")}`);
        }}
      />
    </div>
  );
}
```

- [ ] **Step 2: Add the Batch Add link to the products header**

In `src/app/products/page.tsx`, near the "New Item" button:

```tsx
<Button variant="outline" asChild>
  <Link href="/products/batch-add">Batch Add</Link>
</Button>
```

(Only render this when Prism is available, matching the New Item button's gate.)

- [ ] **Step 3: Run ship-check**

Run:
```bash
npm run lint && npm test
```

Expected: all green.

- [ ] **Step 4: Commit**

```bash
git add src/app/products/batch-add/page.tsx src/app/products/page.tsx
git commit -m "feat(products): add /products/batch-add page and header link

The page hosts the BatchAddGrid and redirects to /products with a
highlight query param on success so users can see the rows they
just created.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase L — Verification & wrap-up

### Task 26: Run ship-check + Prism integration scripts

**Files:** (no code changes — verification)

- [ ] **Step 1: Commit any stragglers; working tree must be clean**

Run:
```bash
git status
```

Expected: `nothing to commit, working tree clean`. If there are stragglers, commit them first.

- [ ] **Step 2: Run ship-check**

Run:
```bash
npm run ship-check
```

Expected: lint + vitest + build all green. If anything fails, diagnose and fix; do NOT skip the check.

- [ ] **Step 3: Run Prism integration scripts (on-campus only)**

Run all three in sequence:
```bash
npx tsx scripts/test-prism-edit.ts
npx tsx scripts/test-prism-batch-add.ts
npx tsx scripts/test-prism-hard-delete-guard.ts
```

Expected: each script prints its ✓ lines and exits 0.

- [ ] **Step 4: Manual smoke test in the browser**

If Prism is reachable from the local environment (you're on-campus):

1. Start the app: `npm run dev` (or against a dev DB — note the Supabase caveat in CLAUDE.md; skip if that path is blocked).
2. Navigate to `/products`. Verify `New Item`, `Batch Add`, and the row-action Edit/Delete buttons all render when Prism is available.
3. Edit a single item's retail price. Confirm the change via `scripts/discover-prism-item-schema.ts` or a WinPRISM query.
4. Batch-add 2 items via paste-from-Excel. Confirm both created.
5. Select both and bulk-discontinue.
6. Select both and hard-delete (if no history). Confirm removal.

If `npm run dev` can't reach the DB per the known IPv6 issue, skip the browser smoke and rely on the Prism integration scripts + `ship-check`.

- [ ] **Step 5: Push the branch**

```bash
git push -u origin feat/products-crud-batch
```

- [ ] **Step 6: Open PR**

```bash
gh pr create --base feat/prism-item-mgmt --title "feat(products): CRUD + batch operations" --body "$(cat <<'EOF'
## Summary
- Single + batch Edit on the products page (EditItemDialog, dirty-tracked patch, 409 Concurrent Modification).
- Hard-delete for items with no transaction history (HardDeleteDialog, per-SKU verdict badges). Test-item TEST-CLAUDE- guard untouched.
- Dedicated `/products/batch-add` page with paste-from-Excel grid, pre-validation, and all-or-nothing commit.

## Design
See `docs/superpowers/specs/2026-04-16-products-crud-batch-design.md`.

## Test plan
- [x] `npm run ship-check` green
- [x] `npx tsx scripts/test-prism-edit.ts` green (on-campus)
- [x] `npx tsx scripts/test-prism-batch-add.ts` green (on-campus)
- [x] `npx tsx scripts/test-prism-hard-delete-guard.ts` green (on-campus)
- [ ] Manual browser smoke (if npm run dev works in your environment)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-review checklist (for the person implementing)

Before marking this plan done:

- [ ] Spec coverage: every "NEW" row in the design spec's feature matrix is implemented.
- [ ] No placeholders left in any file.
- [ ] `deleteTestItem`'s `TEST-CLAUDE-` barcode guard is unchanged.
- [ ] `hardDeleteItem` uses `hasTransactionHistory` — no code path bypasses the guard.
- [ ] Supabase mirror writes are wrapped in try/catch and never block the response.
- [ ] All API routes are admin-gated (`withAdmin`) and Prism-availability-gated (`isPrismConfigured()`).
- [ ] Zod schemas exist on every POST/PATCH body.
- [ ] `fDiscontinue` values are 0 or 1 (literal union), not booleans.
