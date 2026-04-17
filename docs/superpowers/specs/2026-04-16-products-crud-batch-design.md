# Products CRUD + Batch Operations — Design Spec

**Date:** 2026-04-16
**Branch:** `feat/prism-item-mgmt` (builds on PR #162)
**Status:** Design approved, ready for implementation plan

## Goal

Enable intranet users to fully manage inventory items from the products page — add, edit, discontinue, hard-delete, and perform the same actions in batches — backed by direct writes to WinPRISM SQL Server.

## What exists today (PR #162)

- Single-item **create** via `NewItemDialog` → `POST /api/products` → `createGmItem()` (wraps `P_Item_Add_GM` + Inventory insert).
- Bulk **discontinue** via action bar → `DELETE /api/products/[sku]` → `discontinueItem()` (soft: `UPDATE Item SET fDiscontinue = 1`).
- Test-only hard delete via `deleteTestItem()` guarded to `TEST-CLAUDE-*` barcodes.
- UI write features gated by `probePrism()` health check — hidden when Prism is unreachable (i.e., off-campus).

## What's new

Feature matrix:

| | Single | Batch |
|---|---|---|
| **Add** | Existing (`NewItemDialog`) | **NEW** — dedicated `/products/batch-add` page (grid + paste-from-Excel) |
| **Edit** | **NEW** (`EditItemDialog` from action bar) | **NEW** (same dialog, "leave unchanged" placeholders when N>1) |
| **Discontinue** | Existing, via action bar | Existing, via action bar |
| **Hard delete** | **NEW** (`HardDeleteDialog`, history-check guarded) | **NEW** (same dialog, all selected must pass history check) |

## Scope

### In scope

- **GM items (General Merchandise):** full edit + batch add / edit / discontinue / hard-delete.
- **Textbook items:** narrow edit only — `retail`, `cost`, `barcode`, `fDiscontinue` (the fields that live on `Item` / `Inventory` and don't require touching the Textbook-specific table). No textbook create.
- **Mixed selections:** if a user selects both textbook and GM rows for batch edit, the dialog collapses to the textbook-safe field subset.

### Out of scope for this round

- Textbook creation (stays in the WinPRISM desktop client).
- **Textbook hard-delete.** Textbooks live in a Textbook-specific table (not `GeneralMerchandise`), so `hardDeleteItem` as designed here would leave an orphan row. Textbook rows in a hard-delete selection are blocked with an explanatory message — they can still be discontinued. Textbook hard-delete is a future extension once the Textbook table's delete path is discovered.
- Editing `TypeID`, `Color`, `MfgID`, `UUID`, `Subsystem`, `CreateDate` — system-managed or type-defining, risky to change after creation.
- Stock-quantity adjustments (`StockOnHand`) — that's a receiving operation, not an item-master edit; not part of this spec.
- CSV file upload for batch add (paste-from-Excel covers the use case; file upload can come later if needed).

### Assumed-default decisions

- **Auth gate:** keep existing `withAdmin` + `probePrism` pattern. No new explicit IP-based intranet check — Prism unreachable from prod is the de-facto gate.
- **Supabase mirror:** non-blocking. Mirror runs after Prism commit succeeds; failures log but don't roll back. Nightly sync handles drift.
- **Hard-delete safety:** new `hardDeleteItem()` is distinct from `deleteTestItem()`. The `TEST-CLAUDE-*` barcode guard on `deleteTestItem` stays unchanged and continues to protect test scripts.

## Architecture

```
app/products/page.tsx
├─ Tabs: Textbooks | Merchandise
├─ Filters / table / row selection                        (unchanged)
├─ Header CTAs:
│    [New Item]        (existing dialog)
│    [Batch Add]       → /products/batch-add             NEW
├─ Sticky action bar:
│    Single row:     [Edit] [Discontinue] [Delete*]      Edit, Delete NEW
│    Multi-row:      [Edit N] [Discontinue N] [Delete N*]
│                    (*) Delete button only shown when every selected SKU has zero history
└─ Dialogs:
     EditItemDialog          NEW  — single + bulk, one component
     HardDeleteDialog        NEW  — confirmation with per-SKU history verdict

app/products/batch-add/page.tsx                            NEW
└─ Editable grid + paste-from-Excel + validate/submit
```

### Backend — `src/domains/product/prism-server.ts`

All new exports:

- `updateGmItem(sku: number, patch: GmItemPatch): Promise<UpdatedItem>`
  Single transaction:
    1. Verify SKU exists; snapshot baseline of fields we'll touch.
    2. `UPDATE Item SET <item fields> WHERE SKU = @sku` (barcode, vendorId, dccId, itemTaxTypeId, txComment, weight, fDiscontinue).
    3. `UPDATE GeneralMerchandise SET <gm fields> WHERE SKU = @sku` (description, catalogNumber, packageType, unitsPerPack, weight, imageUrl).
    4. `UPDATE Inventory SET Retail = @retail, Cost = @cost WHERE SKU = @sku AND LocationID = 2`.
    5. Commit. Uses verify-then-assume pattern from `deleteTestItem` to dodge the `Item` trigger rowcount quirks.
  Takes only fields present in `patch` — omitted fields are left untouched.

- `updateTextbookPricing(sku: number, patch: TextbookPatch)`
  Narrow edit path: only `Item.BarCode`, `Item.fDiscontinue`, `Inventory.Retail`, `Inventory.Cost`. Same tx-and-verify pattern.

- `batchCreateGmItems(rows: GmCreateInput[]): Promise<CreatedItem[]>`
  One transaction, N iterations of the same stored-proc + Inventory-insert used by `createGmItem`.

- `batchUpdateItems(patches: { sku: number; patch: GmItemPatch | TextbookPatch }[])`
  One transaction, N `updateGmItem` / `updateTextbookPricing` bodies inlined.

- `batchDiscontinueItems(skus: number[])`
  `UPDATE Item SET fDiscontinue = 1 WHERE SKU IN (...)` — already effectively one statement, wrapped.

- `hardDeleteItem(sku: number)`
  History check → `DELETE FROM Inventory WHERE SKU = @sku; DELETE FROM GeneralMerchandise WHERE SKU = @sku; DELETE FROM Item WHERE SKU = @sku` (FK order), transaction, verify-then-assume.

- `batchHardDeleteItems(skus: number[])`
  Pre-validates all SKUs via `hasTransactionHistory`, then one transaction of N deletes.

- `hasTransactionHistory(skus: number[]): Promise<Set<number>>`
  Single query joining sales history / invoice detail / PO detail / receiving detail against the given SKU list. Returns the subset that has history.

- `validateBatch(action, rows)`
  Pure-read pre-flight. Checks: barcode duplicates (existing + within-batch), FK existence (VendorID, DCCID, ItemTaxTypeID), required-field presence, length limits, numeric range. Returns `{ errors: BatchValidationError[] }` with `{ rowIndex, field, code, message }`.

### API routes — `src/app/api/products/`

| Route | Method | Handler | Purpose |
|---|---|---|---|
| `/api/products` | POST | existing `createGmItem` | Single create (unchanged) |
| `/api/products/[sku]` | DELETE | existing `discontinueItem` | Single soft discontinue (unchanged) |
| `/api/products/[sku]` | **PATCH** | `updateGmItem` / `updateTextbookPricing` | Single edit |
| `/api/products/[sku]/hard-delete` | **DELETE** | `hardDeleteItem` | Single hard delete with history guard |
| `/api/products/batch` | **POST** | dispatches on `body.action` | Unified batch endpoint for create / update / discontinue / hard-delete |
| `/api/products/validate-batch` | **POST** | `validateBatch` | Dry-run validation, no writes |
| `/api/products/history-check` | **GET** | `hasTransactionHistory` | Returns `{ [sku]: boolean }` driving whether "Delete" buttons show |

All routes: `withAdmin` + `isPrismConfigured` guards, identical to existing routes.

## Data flow

### Single edit (hot path)

```
EditItemDialog.onSubmit
  → diff(initialSnapshot, currentForm) → patch of dirty fields only
  → PATCH /api/products/[sku]  body: { patch, baselineSnapshot }
    → withAdmin, probePrism
    → concurrency check: re-read baseline fields; if changed → 409
    → updateGmItem(sku, patch)  — single tx
    → productApi mirror: supabase.upsert (non-blocking, logs on failure)
    → return { sku, updatedFields, newSnapshot }
  → dialog closes, toast "Item SKU … updated", table row refreshed from response
```

### Batch add

```
BatchAddPage.onSubmit (N rows)
  → POST /api/products/validate-batch { action: "create", rows }
    → per-row shape + FK checks
    → one SQL: SELECT BarCode FROM Item WHERE BarCode IN (<rowBarcodes>)
                 → any hits are duplicate errors
    → returns { errors: BatchValidationError[] }
  if errors → render inline (red left border + tooltip), stop
  else → POST /api/products/batch { action: "create", rows }
    → BEGIN TRAN
      for each row: EXEC P_Item_Add_GM + INSERT Inventory (Pierce LocationID=2)
    → COMMIT
    → bulk supabase.upsert (non-blocking)
    → navigate to /products with toast "N items created"
```

### Batch edit / discontinue / hard-delete

Same shape: validate → if clean, commit one transaction, mirror (non-blocking) after. Hard-delete validation includes `hasTransactionHistory` for every SKU.

## Components

### `EditItemDialog` (new)

```
Props: {
  skus: number[]                    // 1 = single edit, >1 = bulk
  initialData: ItemSnapshot[]       // one entry per SKU
  onClose: () => void
  onSaved: (result: UpdateResult) => void
}
```

- **Single mode (`skus.length === 1`)**: all editable fields pre-filled. Dirty-tracking based on a baseline snapshot captured at open. Only dirty fields are sent.
- **Bulk mode (`skus.length > 1`)**: every field shows placeholder `"Leave unchanged (N items)"`. A field is considered dirty only when the user types or selects. `barcode` and `description` are read-only in bulk mode (per-row uniqueness / identity).
- **Mixed-type selection**: if any SKU in the selection is a textbook, dialog renders in **narrow mode** — only retail / cost / barcode (single only) / discontinue-toggle visible, regardless of single-vs-bulk.
- Reuses vendor / DCC / tax-type dropdowns from `NewItemDialog` (extract to a shared `ItemRefSelects` component).
- Shows last-edited timestamp + user if Supabase mirror has that info.

### `BatchAddPage` (`app/products/batch-add/page.tsx`, new)

- Editable grid. Columns match `NewItemDialog` create fields: `description`, `vendor`, `dcc`, `taxType`, `barcode`, `retail`, `cost`, `catalogNumber`, `comment`, `packageType`, `unitsPerPack`.
- **Row 1 defaults:** toggle "Use row 1 as defaults." When on, empty cells in rows ≥ 2 inherit row 1's value on submit. Purely a submit-time thing; the grid still displays blanks until submit.
- **Paste handler:** listens for paste in any cell; splits clipboard text on `\t` and `\n`; fills the grid starting from the pasted cell. Handles Excel's trailing tab/newline. Malformed rows are accepted and flagged as validation errors.
- Buttons: `[Validate]` (dry-run), `[Submit]`, `[Add row]`, `[Remove selected rows]`, `[Clear all]`.
- Error UX: red left border + tooltip per cell, plus a banner "3 errors — fix before submitting." Submit is disabled while errors are present.
- Success → redirect to `/products?tab=merchandise&highlight=<skus>` with toast "N items created."

### `HardDeleteDialog` (new)

- Receives `skus: number[]`. On open, calls `GET /api/products/history-check?skus=...`.
- Renders one row per selected SKU with a badge:
  - Green "0 history records — safe to delete"
  - Red "has 3 sales, 1 PO, 2 receivings — must discontinue instead"
  - Red "textbook — hard-delete not supported, discontinue only"
- `[Delete permanently]` button disabled unless every row is green. Red rows offer `[Discontinue instead]` as a one-click fallback.

### Shared

- Extract `ItemRefSelects` (vendor / DCC / tax) from `NewItemDialog`, reused in `NewItemDialog`, `EditItemDialog`, and `BatchAddPage` grid cells.
- No new global store; batch-add grid is local component state.

## Error handling

### Pre-write validation errors (all batch ops)

Shape: `{ rowIndex: number; field: string; code: string; message: string }[]`.

Codes:
- `DUPLICATE_BARCODE` — collides with existing Item (message includes the existing SKU) or with another row in the batch.
- `INVALID_VENDOR` / `INVALID_DCC` / `INVALID_TAX_TYPE` — FK not found.
- `MISSING_REQUIRED` — required field blank (description, dcc, tax).
- `NEGATIVE_PRICE` / `NEGATIVE_COST` — must be ≥ 0.
- `BARCODE_TOO_LONG` — > 20 chars.
- `DESCRIPTION_TOO_LONG` — > 128 chars.
- `HAS_HISTORY` — hard-delete only; SKU has transaction history.

UI renders them inline (red cell border + tooltip) and in a summary banner.

### Runtime failures during transaction

- Prism connection drop mid-tx → SQL Server rolls back. API returns 503 `PRISM_CONNECTION_LOST` with "No changes saved. Retry when Prism is reachable."
- Concurrency: if baseline re-read shows the row changed since dialog open → 409 `CONCURRENT_MODIFICATION` with the current values. Dialog re-prompts with a diff so user chooses to overwrite or cancel.
- Trigger-quirk collision on UPDATE → caught by verify-then-assume, treated as `CONCURRENT_MODIFICATION`.
- Other SQL errors (unexpected constraint, permission denied) → 500 with the SQL error number + message. No partial state (transaction rolls back).

### Supabase mirror failure (non-blocking)

- Log `[products/mirror] failed to mirror SKU … — nightly sync will repair`.
- UI toast still shows success.

### Auth / availability

- Non-admin → 403 from `withAdmin`, UI redirects to /login.
- Prism unavailable → `probePrism` fails → all write UI hidden (existing pattern).

## Testing

### Unit (Vitest)

- `validateBatch()` with fixtures for every error code: duplicate barcodes (existing + within-batch), invalid FKs, negative price, empty required, overlong fields. Snapshot error shape.
- `hasTransactionHistory()` SQL builder — mocked pool, assert the right tables are queried.
- `EditItemDialog` dirty-field extraction — given baseline + form state, assert the patch payload is correct.
- Bulk-mode "leave unchanged" semantics — assert that untouched fields don't appear in the patch.
- `BatchAddPage` paste handler — given a sample TSV, assert grid populates correctly (including trailing tab/newline).

### Prism integration (new `scripts/test-prism-*.ts`, on-campus only)

- `test-prism-edit.ts` — create TEST-CLAUDE item; edit every editable field individually; assert each change lands in Prism; hard-delete.
- `test-prism-batch-add.ts` — insert 10 `TEST-CLAUDE-BATCH-<n>` items in one batch; verify all SKUs; bulk hard-delete.
- `test-prism-batch-edit.ts` — create 5 test items; apply a bulk price change; verify; hard-delete.
- `test-prism-hard-delete-guard.ts` — attempt to hard-delete a real SKU with history; assert `HAS_HISTORY` error and no row change. Needs an allowlisted fixture SKU that has history.
- Every script cleans up after itself; `TEST-CLAUDE-` barcode guard still protects stray failures.

### E2E (optional, post-merge)

- Playwright: open `/products/batch-add`, paste a small TSV, validate, submit, verify toast and row count. Not part of CI (needs Prism reachability); runnable manually on-campus.

### `ship-check` gate

- Must pass: `npm run lint`, `npm test`, `npm run build`.
- Prism integration scripts run manually on-campus before merge (not part of automated ship-check — they need live DB access).

## Rollout

1. Merge PR #162 first (already done locally; `ebd376b` unpushed — push before starting this work).
2. Build on the same branch or a new `feat/products-crud-batch` branch off `feat/prism-item-mgmt`.
3. Implementation order (driven by the plan phase, not this spec):
   - Schema / types + pre-validation (no UI, no writes).
   - Single edit (`updateGmItem`, PATCH route, `EditItemDialog` single mode).
   - Hard delete (`hardDeleteItem`, history check, `HardDeleteDialog`).
   - Batch endpoints + bulk-edit mode on dialog.
   - `/products/batch-add` page.
4. Ship-check green + Prism integration scripts pass → PR → review → merge.

## Open items worth flagging during implementation

- **Which transaction-history tables to check?** Candidates from the Prism schema: `Inventory_Sales_History`, `Acct_ARInvoiceDetail`, PO detail tables, receiving detail tables. Discovery script should enumerate the exact set before `hasTransactionHistory` is coded.
- **Concurrency tolerance:** baseline-snapshot comparison is strict. If it turns out WinPRISM staff editing the same row is frequent, we may want to relax the check to only the fields actually being changed. Start strict; relax if it's noisy in practice.
- **Paste handler edge cases:** different clipboards (Excel vs Google Sheets vs plain text) use different line endings. Implementation should test `\r\n`, `\n`, and mixed.
