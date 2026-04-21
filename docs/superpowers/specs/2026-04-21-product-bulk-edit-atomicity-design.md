# Product Bulk Edit — Atomicity & Primary-Location Concurrency Design Spec

**Date:** 2026-04-21
**Branch:** `fix/product-edit-regressions` (continuing on the current branch per operator; new commits land on top of the 4 dead-end hotfix commits and will be squashed or cherry-picked at PR time)
**Status:** Drafted for execution
**Parent context:** `~/.claude/plans/yes-that-s-fine-you-proud-toucan.md` (PR #229 Phase 2 redesign), four rounds of Codex adversarial review on `fix/product-edit-regressions`
**Superseded hotfix attempts:** commits `11b2546`, `470966e`, `325ed84`, `f7fef14` on this branch (UI-only workarounds that each failed adversarial review)

---

## Goal

Make the product edit dialog's bulk save path atomic across all selected rows and make optimistic-concurrency protection work on PCOP and PFS primary locations, not just PIER. Ship one coordinated server + client change so an adversarial reviewer can't find a partial-commit hazard, a PIER-hardcode landmine, or a mirage recovery path.

---

## Why This Fix Exists

PR #229 shipped Phase 2 of the product edit dialog redesign with three bugs originally flagged by Codex:

1. **[high] Partial-commit hazard in bulk save.** The bulk branch fired `Promise.all(items.map(sku => productApi.update(sku, ...)))`. A failure on row 2 after row 1 committed left a half-done selection with no recovery.
2. **[high] Concurrency baseline hard-coded to PIER.** Both the client snapshot source and the server's concurrency SELECT hard-coded `LocationID = 2`. On PCOP- or PFS-scoped pages, the client baseline (from the browse row's primary-location values) mismatches what the server reads → false `409 CONCURRENT_MODIFICATION` on every save.
3. **[medium] Accordion disclosure bug.** Fixed cleanly in hotfix commit `11b2546`; tests in `tests/components/ui/accordion.test.tsx`. Not revisited here.

Four rounds of hotfix attempts on `fix/product-edit-regressions` tried UI-only workarounds (sequential per-row PATCH, partial-commit flag, "close and reopen to retry" guidance). Each failed adversarial review because the backend could not support what the UI was promising:

- `batchUpdateItems` is not transactional (the file-top docstring lies) and explicitly punts on concurrency.
- `updateGmItem` / `updateTextbookPricing` hard-code `PIERCE_LOCATION_ID` in their concurrency SELECT.
- The dialog's `items` prop is a snapshot of the parent page's `useProductSearch` cache, which only refetches when `onSaved` fires — so "close and reopen to retry" never rehydrates the baseline, guaranteeing repeat 409s.

This spec fixes the backend to make the UI's promise true.

---

## Hard Rules

These stay non-negotiable:

1. **Zero partial commits.** If any row in a bulk save fails for any reason, zero rows in the backend mutate.
2. **Optimistic concurrency preserved for every row.** No row writes without its per-row baseline being checked against current state in the same transaction.
3. **PBO (`LocationID = 5`) remains excluded** from product-catalog work.
4. **Legacy dialog untouched.** `NEXT_PUBLIC_PRODUCTS_EDIT_DIALOG_V2=false` path keeps the existing legacy PATCH body shape with PIER hardcodes.
5. **Surgical changes only.** No architectural churn outside what this fix requires.
6. **Files ≤800 lines, functions <50 lines, no `any`, no mutation, no `React.FC`.**
7. **TDD.** Failing test first, minimal implementation, refactor.
8. **Codex adversarial review verbatim before every push** that opens or updates a PR.

---

## Current Code Reality

**Server — `src/domains/product/prism-updates.ts`:**

- `updateGmItem` (lines 170–473) and `updateTextbookPricing` (lines 480–776) each open their own Prism transaction, run a concurrency SELECT bound to `@loc = PIERCE_LOCATION_ID`, then apply patch fields, then commit.
- The `primaryInventory` fallback at line 154–161 also targets `PIERCE_LOCATION_ID`. (Only hit by legacy V1 callers; out of scope.)
- Per-location inventory writes at lines 398+ and 701+ already honor `inventoryPatch.locationId` correctly.

**Server — `src/domains/product/prism-batch.ts`:**

- `batchUpdateItems` at lines 161–174 is a plain for-loop calling `updateGmItem` / `updateTextbookPricing` per row. Each call opens its own transaction. The docstring at lines 148–160 admits "batch edits come from the grid UI, not an open dialog, so there's no baseline to compare against."
- No single outer transaction. No baseline support.

**Server — `src/app/api/products/batch/route.ts`:**

- `action: "update"` schema (lines 42–49) accepts rows as `{ sku, isTextbook?, patch: z.record(...) }` with no baseline field.

**Server — `src/app/api/products/[sku]/route.ts`:**

- PATCH v2 body schema accepts `baseline: snapshotSchema.optional()`. Passes it through to `updateGmItem` / `updateTextbookPricing`. Returns `409 { error: "CONCURRENT_MODIFICATION", current }` on mismatch.

**Client — `src/domains/product/api-client.ts`:**

- `productApi.batch` (lines 275–296) accepts `{ action: "update", rows: [{ sku, patch, isTextbook? }] }` with no baseline.
- `productApi.update` (lines 218–239) handles 409 by throwing an Error with `code: "CONCURRENT_MODIFICATION"` and `current`.

**Client — `src/components/products/edit-item-dialog-v2/edit-item-dialog-v2.tsx`:**

- Single-item save path (lines 283–310) extracts a PIER baseline explicitly (hardcoded `locationId === 2`).
- Bulk save path (lines 311–389) loops sequentially with per-row `productApi.update` calls, each carrying a baseline built from the row's primary-location `retail`/`cost`. On failure, sets `bulkPartialCommit` to disable Save, shows "Close and reopen to retry" — which the round-4 review proved is a mirage because the parent never refetches.

**Client — `src/app/products/page.tsx`:**

- `editableSelectedItems` (lines 229–240) maps `product.retailPrice` / `product.cost` into items. Those values reflect the browse row's primary location (whatever is in `filters.locationIds[0]`), not PIER.
- `onSaved` callback (line 431) is wired as `() => { setEditOpen(false); refetch(); }` — no partial-success hook.

**Tests:**

- `tests/app/api/products-batch-route.test.ts` mocks `batchUpdateItems` entirely. Needs new cases for the extended update schema.
- `src/components/products/edit-item-dialog-v2.test.tsx` has sequential-bulk tests that need replacing.
- No existing unit tests for `batchUpdateItems` internals. New file needed.

---

## Recommended Approach

**Combine two coordinated changes:**

**A. Transactional, baseline-aware `batchUpdateItems`.** One Prism transaction wraps all rows. Each row's baseline is checked before its UPDATE. Any throw (concurrency or otherwise) rolls back every row.

**B. Primary-location-aware concurrency check in `updateGmItem` / `updateTextbookPricing`.** Add `primaryLocationId` to `ItemSnapshot`. The server's concurrency SELECT uses `@loc = baseline.primaryLocationId` instead of `PIERCE_LOCATION_ID`. Unblocks non-PIER single-item saves (closing Codex's original finding #2) and makes atomic bulk correct on PCOP/PFS pages.

**Refactor shape.** Extract `applyItemPatchInTransaction(tx, { sku, isTextbook, patch, baseline })` as a helper that takes an already-open transaction. `updateGmItem` / `updateTextbookPricing` become thin wrappers (open tx → helper → commit or rollback). `batchUpdateItems` opens one tx and calls the helper per row. One source of truth for the SQL; no duplication.

**Error semantics.** Fail-fast, all-or-nothing. First baseline mismatch or SQL error aborts the transaction. Server returns `409 { error: "CONCURRENT_MODIFICATION", rowIndex, sku, current }` for concurrency; `500 { error: message }` for other failures. No row commits when any row fails.

---

## File-Level Changes

### Server

**`src/domains/product/types.ts`**

- Extend `ItemSnapshot` with `primaryLocationId: ProductLocationId` as a required field.
- Add new exported type `BatchUpdateRowWithBaseline = { sku: number; isTextbook?: boolean; patch: GmItemPatch | TextbookPatch | ProductEditPatchV2; baseline: ItemSnapshot }`.
- `BatchUpdateRow` (legacy, used by validators) stays for backward compat with the V1 shape.

**`src/domains/product/prism-updates.ts`**

1. Export a new `applyItemPatchInTransaction(tx: Transaction, input: { sku: number; isTextbook: boolean; patch: ProductUpdaterInput; baseline?: ItemSnapshot }): Promise<{ sku: number; appliedFields: string[] }>`.
   - Body is the inner guts of today's `updateGmItem` / `updateTextbookPricing`, parameterized on `isTextbook` to select the correct field set (Item + GeneralMerchandise vs. Item + Textbook).
   - The concurrency SELECT binds `@loc` to `baseline?.primaryLocationId ?? PIERCE_LOCATION_ID` (fallback preserves old behavior if no baseline).
   - Throws `CONCURRENT_MODIFICATION` Error with `current` matching today's shape, plus `current.primaryLocationId` echoing the location it read.
2. `updateGmItem` and `updateTextbookPricing` shrink to: `const tx = pool.transaction(); await tx.begin(); try { const r = await applyItemPatchInTransaction(tx, { ...args, isTextbook }); await tx.commit(); return r; } catch { try { await tx.rollback(); } catch {} throw; }`.
3. `getItemSnapshot` (line 24) emits `primaryLocationId: PIERCE_LOCATION_ID` to satisfy the new required field. Follow-up could make it location-aware, but not needed for this spec.

**`src/domains/product/prism-batch.ts`**

1. Update the file-top docstring — remove the false "all wrapped in single transactions" claim, remove the "callers that need concurrency should use the single-item path" punt.
2. Change `batchUpdateItems` signature to accept `BatchUpdateRowWithBaseline[]`.
3. Rewrite body to: open one `pool.transaction()`, loop rows calling `applyItemPatchInTransaction(tx, row)`, push SKU on success. On throw, attach `rowIndex` to the error before re-throwing, rollback, propagate.

**`src/app/api/products/batch/route.ts`**

1. Extend `action: "update"` row schema to require `baseline` matching the same Zod snapshot schema the single-item PATCH already uses (`sku`, `barcode`, `itemTaxTypeId?`, `retail`, `cost`, `fDiscontinue`, `primaryLocationId`).
2. Adapt the `batchUpdateItems` call site to pass baseline through.
3. On `CONCURRENT_MODIFICATION` from `batchUpdateItems`, return `409 { error: "CONCURRENT_MODIFICATION", rowIndex, sku, current }`.
4. `validateBatchUpdateAgainstPrism` call is unchanged (it doesn't care about baselines).

**`src/app/api/products/[sku]/route.ts`**

- Extend the v2 `snapshotSchema` in `normalizePatchBody` to include `primaryLocationId: z.union([z.literal(2), z.literal(3), z.literal(4)])`. Thread through to `updateGmItem` / `updateTextbookPricing` unchanged (baseline param stays optional).
- No behavior change for callers that don't send the field; they'll hit the helper's `?? PIERCE_LOCATION_ID` fallback. But the v2 client will always send it after this spec ships.

### Client

**`src/domains/product/api-client.ts`**

1. `productApi.batch` — the `update` rows type gets `baseline: ItemSnapshot` required. Other actions unchanged.
2. Add 409 handling to `productApi.batch` that mirrors `productApi.update`: parse response, throw Error with `code: "CONCURRENT_MODIFICATION"`, `rowIndex`, `sku`, `current`.

**`src/components/products/edit-item-dialog-v2/edit-item-dialog-v2.tsx`**

1. Single-item save path (lines 283–310):
   - Change `entry.locationId === 2` to `entry.locationId === resolvedPrimaryLocationId`.
   - Add `primaryLocationId: resolvedPrimaryLocationId` to the baseline object.
   - Remove the "Concurrency baseline intentionally snapshots Pierce" comment block.
2. Bulk save path (lines 311–389):
   - Delete the entire sequential for-loop plus the `bulkPartialCommit` logic.
   - Replace with a single `productApi.batch({ action: "update", rows })` call. Each row: `{ sku: item.sku, isTextbook: item.isTextbook ?? false, patch: v2Patch, baseline: { sku, barcode: item.barcode, retail: item.retail, cost: item.cost, fDiscontinue: item.fDiscontinue, primaryLocationId: resolvedPrimaryLocationId } }`.
   - On success, call `onSaved(items.map(i => i.sku))` and close. On thrown error, show the error message and keep the dialog open (existing behavior). No `bulkPartialCommit`, no "Close and reopen" copy, no disabled Save.
3. Delete the `bulkPartialCommit` state declaration (lines 84–91), its reset in the open-effect (line 143), and the `title` attribute on the Save button (line 510). Delete the no-longer-accurate comment block explaining why sequential was chosen (lines 311–335).

---

## Error Handling Matrix

| Failure | Server response | Client surface |
|---|---|---|
| Batch row N baseline mismatch | `409 { error: "CONCURRENT_MODIFICATION", rowIndex: N, sku, current }` | Error thrown by `productApi.batch`. Dialog shows: "Row N (SKU S) has been modified since you opened this dialog. No changes were saved. Close and retry." Dialog stays open, `onSaved` not called. |
| Batch row N SQL failure (FK, type, etc.) | `500 { error: message }` | Dialog shows the message. No rows committed. Dialog stays open. |
| Batch validation (missing baseline, malformed) | `400 { error: zodFlatten }` | Dialog shows "Invalid request — please reopen." Shouldn't happen in practice. |
| Single-item 409 | Unchanged | Unchanged |
| Single-item 5xx | Unchanged | Unchanged |

**Key invariant the tests must prove:** When any row fails, the backend store has zero writes from that batch call. Not "N−1 of N". Zero.

---

## Test Strategy

**New file — `tests/domains/product/prism-batch.test.ts` (unit tests on `batchUpdateItems`):**

1. Two rows, both baselines match → both apply, pool transaction commits once, returned SKUs match input order.
2. Two rows, row-2 baseline mismatch → pool transaction rolls back, error thrown carries `code: "CONCURRENT_MODIFICATION"` and `rowIndex: 1`, neither row's UPDATE SQL ran.
3. Three rows, row-3 raises a non-concurrency SQL error → rollback, error propagates with `rowIndex: 2`, no rows updated.
4. Mixed GM + textbook rows in one call → correct function path selected per row, single transaction.
5. Zero rows → no transaction opened, returns `[]`.

Uses a fake `getPrismPool` that records SQL issued per `Request` and supports `begin`/`commit`/`rollback` on a shared `Transaction`. No existing `mssql` transaction fake pattern exists in `tests/domains/product/` (the Prisma `$transaction` mocks in `tests/domains/quote/service.test.ts` are a different driver shape). The fake will be built in this spec's test file and kept co-located; if reuse emerges, extract later.

**Extend — `tests/app/api/products-batch-route.test.ts`:**

1. Update schema now requires `baseline`: a row missing `baseline` returns 400.
2. `batchUpdateItems` throws `CONCURRENT_MODIFICATION` with `rowIndex` and `current` → route returns 409 with that payload.
3. `batchUpdateItems` throws a generic Error → route returns 500.
4. Success path — baseline present, `batchUpdateItems` resolves — route returns `{ action: "update", count, skus }`.

**Replace — `src/components/products/edit-item-dialog-v2.test.tsx` (the sequential-bulk block, approximately lines 1070–1250):**

1. Bulk save with 3 rows → exactly one `productApi.batch` call, payload shape correct (each row carries `baseline` with `primaryLocationId`).
2. Bulk save success → `onSaved` called once with all SKUs, dialog closes.
3. Bulk save throws → `onSaved` not called, dialog stays open, error visible. Save button re-enables as soon as the failing promise settles (no `bulkPartialCommit` gate); the operator can retry or cancel. Because the whole batch either committed or didn't, retry after fixing the conflict is safe without reopening.
4. Single-item save on PCOP (`primaryLocationId={3}`) → baseline carries `primaryLocationId: 3`, retail/cost sourced from `detail.inventoryByLocation` entry with `locationId === 3`.
5. Accordion and existing single-item concurrency tests — keep as-is.

**TDD order:**

1. Write `prism-batch.test.ts` zero-commit test first. Red.
2. Implement `applyItemPatchInTransaction` extraction + refactor wrappers. Green on single-item tests.
3. Rewrite `batchUpdateItems`. Green on new zero-commit test.
4. Extend route schema + test. Red → Green.
5. Update client `productApi.batch` signature + test. Red → Green.
6. Rewrite dialog bulk branch + test. Red → Green.
7. Update single-item dialog branch to send `primaryLocationId`. Green (helper fallback handles missing field).

---

## Rollout & Compatibility

**Wire format change.** `ItemSnapshot` gains a required `primaryLocationId`. Producers:

- `getItemSnapshot` (reads) → emits `PIERCE_LOCATION_ID`. Callers that use this as a display snapshot are unaffected.
- Single-item PATCH 409 `current` payload → echoes whatever `@loc` the concurrency SELECT used.
- Batch 409 `current` payload → same.
- Dialog (writer) → always sends `resolvedPrimaryLocationId`.

**Server fallback.** The helper uses `baseline?.primaryLocationId ?? PIERCE_LOCATION_ID` so callers that omit the entire `baseline` object (e.g. the V1 legacy PATCH path, which never sent one) behave exactly as today. The Zod schema rule: when `baseline` IS supplied, `primaryLocationId` is required inside it — partial/legacy snapshots that include `retail`/`cost` but lack `primaryLocationId` are rejected with 400. This prevents the ambiguity where an old-shape baseline would silently fall back to PIER and bypass the new concurrency guarantee. V1 legacy path sends no baseline, V2 path (after this PR) always sends a complete one.

**Feature flag.** None. The legacy dialog (behind `NEXT_PUBLIC_PRODUCTS_EDIT_DIALOG_V2=false`) keeps the legacy PATCH body shape which never carried `primaryLocationId`. It continues to hit the server's PIER fallback. Explicitly out of scope for this spec.

**Migration.** None required — all schema changes are in-memory TS types and Zod shapes. No Supabase migrations.

---

## Out of Scope / Follow-Ups

1. Legacy dialog still hardcodes PIER — gated by the feature flag, which is off in prod per the handoff.
2. Batch route's `action: "update"` has no Supabase mirror write (pre-existing gap in PR #229's batch endpoint). Not a regression. Track as a follow-up.
3. `primaryInventory` fallback in `normalizeUpdaterInput` (prism-updates.ts:156) still targets `PIERCE_LOCATION_ID`. Only reached by V1 legacy callers that already send correct data. Leaving.
4. `getItemSnapshot` emitting PIER regardless of caller intent — fine for 409 display, not a write correctness issue. Could be improved to take a `locationId` param in a separate cleanup.
5. Four dead-end commits on `fix/product-edit-regressions` (`11b2546`, `470966e`, `325ed84`, `f7fef14`) — stay in branch history for reference; squash or cherry-pick the accordion fix at PR time.

---

## Success Criteria

An adversarial reviewer can verify the fix shipped correctly if:

1. `tests/domains/product/prism-batch.test.ts` proves row-2 failure rolls back row-1 — zero writes land.
2. Bulk dialog save on a PCOP-scoped page with 3+ rows, no concurrent edits → all rows commit atomically, zero false 409s.
3. Bulk dialog save with a real concurrent edit to row 3 mid-flow → 409 returned, zero rows changed in Prism, dialog shows crisp "Row 3 (SKU S) changed since opening" and stays open.
4. Single-item save on a PCOP-scoped page → no false 409 (today it hits one).
5. Codex adversarial review of HEAD passes clean without stamping manually.
6. `npm run ship-check` passes (stamp enforced by pre-push hook).
7. `NEXT_PUBLIC_PRODUCTS_EDIT_DIALOG_V2=false` still routes to the legacy dialog, which still works exactly as before (no regression on the feature-flag fallback).

---

## Risks & Mitigations

**Risk: extraction of `applyItemPatchInTransaction` accidentally changes single-item semantics.**
Mitigation: keep `updateGmItem` / `updateTextbookPricing` public signatures identical. All existing single-item tests must pass before touching batch. If a single-item test turns red during extraction, stop and investigate — don't push forward.

**Risk: `mssql` library's transaction API doesn't share state between `Request` objects the way we expect.**
Mitigation: the codebase already uses `transaction.request()` heavily in `batchCreateGmItems`, `batchHardDeleteItems`, `prism-delete`, and elsewhere. Pattern is proven. If something surprises us, the test suite catches it before the fix lands.

**Risk: large transaction holds locks long enough to contend with live Prism traffic.**
Mitigation: the bulk payload is bounded by the UI (typical selection <50 rows). Each row's writes are narrow UPDATE statements on indexed PKs. Lock duration is on the order of milliseconds per row. Acceptable.

**Risk: `CONCURRENT_MODIFICATION` error carries a `rowIndex` that could leak enumeration order.**
Mitigation: enumeration order is the order the client sent — no security implication. Error payload matches existing single-item 409 shape plus two diagnostic fields.

---

## Implementation Checklist (for writing-plans)

- [ ] Extend `ItemSnapshot` in `src/domains/product/types.ts`; add `BatchUpdateRowWithBaseline`.
- [ ] Extract `applyItemPatchInTransaction` in `src/domains/product/prism-updates.ts`; shrink `updateGmItem` / `updateTextbookPricing` to thin wrappers; `getItemSnapshot` emits `primaryLocationId`.
- [ ] Rewrite `batchUpdateItems` in `src/domains/product/prism-batch.ts` to a transactional + baseline-aware loop; update docstrings.
- [ ] Extend `action: "update"` schema in `src/app/api/products/batch/route.ts`; map 409 with `rowIndex`.
- [ ] Extend v2 snapshot Zod schema in `src/app/api/products/[sku]/route.ts`.
- [ ] Update `productApi.batch` signature and 409 parsing in `src/domains/product/api-client.ts`.
- [ ] Rewrite bulk save branch and update single-item baseline in `src/components/products/edit-item-dialog-v2/edit-item-dialog-v2.tsx`; delete `bulkPartialCommit` state.
- [ ] New tests: `tests/domains/product/prism-batch.test.ts`.
- [ ] Extended tests: `tests/app/api/products-batch-route.test.ts`.
- [ ] Replaced tests: the sequential-bulk block in `src/components/products/edit-item-dialog-v2.test.tsx`.
- [ ] Run `npm test`, `npm run lint`, `npm run build` (or `npx tsc --noEmit`) — all green.
- [ ] Run Codex adversarial review verbatim before the first push. Block on any CRITICAL/HIGH finding.
- [ ] Verify on `localhost:3000` with `prismAvailable` forced true — single-item on PIER/PCOP, bulk on PIER/PCOP, simulated concurrency via directly mutating the mocked Prism snapshot between dialog-open and Save click.
