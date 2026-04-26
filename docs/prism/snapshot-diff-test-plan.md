# Snapshot/diff acceptance plan for laportal Prism writes

**Audience:** the operator (Marcos) doing supervised first-runs of every laportal feature that writes to the WinPRISM SQL Server. Every action below produces a documented, expected mutation set; this plan turns "did the feature work?" from "looks ok in the UI" into a byte-level audit against the real database.

**Tools:**
- [`scripts/prism-snapshot.ts`](../../scripts/prism-snapshot.ts) — captures row counts + `CHECKSUM_AGG` per table, plus full row contents for small lookup tables. Read-only.
- [`scripts/prism-diff.ts`](../../scripts/prism-diff.ts) — pure file I/O comparison of two snapshot JSONs. Identifies which tables changed and (for small tables) which rows.

**Hard rule:** every write below is initiated **by the operator's user click in the shipped UI**. The plan is read-only on this side — we just observe what the UI causes. No autonomous Prism writes.

---

## 1. General workflow (every test follows this)

```bash
# 1. Snapshot BEFORE the action
npx tsx scripts/prism-snapshot.ts > tmp/snapshots/<feature>-<test-id>-before.json

# 2. Perform the action via the UI in a browser
# (e.g. click Roll forward, click Create, edit a SKU, etc.)

# 3. Snapshot AFTER the action
npx tsx scripts/prism-snapshot.ts > tmp/snapshots/<feature>-<test-id>-after.json

# 4. Diff
npx tsx scripts/prism-diff.ts \
  tmp/snapshots/<feature>-<test-id>-before.json \
  tmp/snapshots/<feature>-<test-id>-after.json \
  > tmp/diffs/<feature>-<test-id>.txt

# 5. Compare the actual diff against the EXPECTED MUTATIONS
#    listed under each feature in §3.
```

If the actual diff exactly matches the expected set: ✅ pass — the feature is bit-for-bit correct against the documented contract.

If anything extra shows up, or anything expected is missing: ⛔ stop. Investigate before doing any further runs of the feature.

---

## 2. Test data conventions

To keep tests cleanly distinguishable from real Pierce data:

| Resource | Test pattern | Cleanup |
|---|---|---|
| Test agency code | `PSU26TESTCLAUDE`, `PSU26TESTCLAUDE2`, … | Manual `SP_AcctAgencyDelete` after sign-off (only if no FK references — see §4) |
| Test item barcode | `TEST-CLAUDE-<n>` | Existing `scripts/test-prism-cleanup.ts` deletes any item with this prefix |
| Test SKU range | Items with `Description LIKE 'TEST CLAUDE%'` | Same |
| Test customer | Skip — the agency tests don't touch `Acct_Agency_Customer` | n/a |
| Snapshot dir | `tmp/snapshots/` (gitignored) | n/a |

PSU26 specifically because the prior probe confirmed there are zero PSU26 agencies as of 2026-04-26 — anything you create there is unambiguously a test artifact.

---

## 3. Per-feature acceptance criteria

Run in this order — least-risky first, most-risky last.

### Test A — Single-account add, **Mirror mode** (`/admin/agencies/new`)

**Lowest risk.** Source-row inheritance is the safest pattern (we copy known-good values).

| Step | Detail |
|---|---|
| **Test ID** | `mirror-001` |
| **Source** | Pick any current PSP25 agency you don't mind cloning twice (e.g. `PSP25EOPSDEPT`). |
| **Target** | `PSU26TESTCLAUDE` |
| **UI flow** | `/admin/agencies/new` → Mirror existing → search `PSP25EOPSDEPT` → pick → enter `PSU26TESTCLAUDE` for both Account Code and Name → Create account |

**Expected diff:**

| Table | Change | Detail |
|---|---|---|
| `Acct_Agency` | +1 row | new AgencyID with all 50 inherited fields from the source row, AgencyNumber=`PSU26TESTCLAUDE`, Name=`PSU26TESTCLAUDE` |
| `Acct_Agency_Tax_Codes` | +N rows | Cartesian — one row per row in `Tax_Codes`, populated automatically by the `TI_Acct_Agency` trigger |
| `pos_update` | +M rows | one type-6 row per row in `Location` (M = location count), pushed by `SP_ARAcctResendToPos` |

**Should NOT change:** `Acct_Agency_Customer`, `Acct_Agency_DCC` (Pierce-empty for EOPS-family), `Acct_Agency_NonMerch` (same).

**If the source happens to have DCC rows:** then `Acct_Agency_DCC` should also gain a copy via `SP_AcctAgencyCopyDCC`. Flag this in the diff and confirm against the source's DCC row count.

**Cleanup:** verify the test agency has no `Acct_Agency_Customer` rows, then delete it manually:
```sql
EXEC SP_AcctAgencyDelete @agencyid = <new_agency_id>;
```

---

### Test B — Single-account add, **Build from scratch** (`/admin/agencies/new`)

**Medium risk.** This exercises the full 52-column INSERT contract with our Pierce-default fallbacks instead of source-row inheritance.

| Step | Detail |
|---|---|
| **Test ID** | `create-001` |
| **AgencyNumber** | `PSU26TESTCLAUDE2` |
| **Name** | `PSU26TESTCLAUDE2` |
| **Type** | 2 (Campus) — to mirror an "EOPSDEPT"-style account |
| **Tender Code** | 12 (A/R CHARGE) |
| **Statement Code** | 6 (Month End) |
| **All other fields** | leave at form defaults (don't expand the address section) |
| **UI flow** | `/admin/agencies/new` → Build from scratch → fill required fields → Create account |

**Expected diff:** identical shape to Test A, but the new `Acct_Agency` row's values come from `PIERCE_AGENCY_DEFAULTS` instead of a source row.

| Table | Change |
|---|---|
| `Acct_Agency` | +1 row, `MaxDays=30`, `StatementCodeID=6`, `TenderCode=12`, `fInvoiceInAR=1`, `NonMerchOptID=2`, etc. (matches the [empirical Pierce defaults from create-ar-agency.md §6](static/actions/create-ar-agency.md#6-closing-the-gap-without-a-literal-capture-2026-04-25-update)) |
| `Acct_Agency_Tax_Codes` | +N rows (trigger) |
| `pos_update` | +M rows (proc) |

**Should NOT change:** any sub-table (no template = nothing to copy).

**Acceptance check:** the new `Acct_Agency` row's column values should exactly match the row produced by Test A for the universally-identical columns (StatementCodeID, ChangeLimit, MaxDays, etc.). Run a side-by-side query:

```sql
SELECT * FROM Acct_Agency
WHERE AgencyNumber IN ('PSU26TESTCLAUDE', 'PSU26TESTCLAUDE2');
```

The two rows should be identical except for AgencyNumber, Name, AgencyID, and any field that the source row of Test A sets non-default (e.g. CreditLimit if the source had one).

**Cleanup:** same as Test A.

---

### Test C — Bulk semester rollover (`/admin/agencies`)

**Higher risk** because it's a multi-agency transaction loop. We run it small first.

| Step | Detail |
|---|---|
| **Test ID** | `roll-001` |
| **Source** | `PSP25` (71 known agencies) |
| **Target** | `PSU26` (currently 0 agencies — fully clean target) |
| **UI flow** | `/admin/agencies` → Source `PSP25`, Target `PSU26` → Find agencies → **deselect all but ONE row** (e.g. just `PSP25EOPSDEPT`) → Roll forward 1 agency |

**Why one row first:** the rollover is per-clone-transaction, so a 1-agency roll is functionally a single-account mirror. If it works, the bulk path works — the only delta vs Test A is the loop overhead.

**Expected diff:** identical to Test A.

**After Test C-1 passes**, escalate to a small batch:

| Step | Detail |
|---|---|
| **Test ID** | `roll-002` |
| **Source** | `PSP25` |
| **Target** | `PSU26` (will already have one row from C-1 — the others are still missing) |
| **UI flow** | Find agencies → select 5 rows that don't already have PSU26 counterparts (e.g. EOPSGRANT, USVETS, ASO, UMOJA, ATHL) → Roll forward 5 |

**Expected diff:**

| Table | Change |
|---|---|
| `Acct_Agency` | +5 rows |
| `Acct_Agency_Tax_Codes` | +5×N rows (trigger fires per agency) |
| `pos_update` | +5×M rows (proc fires per agency) |

The result panel in the UI should show **5 created, 0 skipped, 0 errors**. The `[Already exists]` badges should flip on those rows in-place (per the fix from Codex feedback) without losing the result panel.

**Cleanup:** delete each test agency:
```sql
DECLARE @ids TABLE (AgencyID int);
INSERT INTO @ids
  SELECT AgencyID FROM Acct_Agency
  WHERE AgencyNumber LIKE 'PSU26%' AND AgencyNumber <> 'PSU26TESTCLAUDE'
                                  AND AgencyNumber <> 'PSU26TESTCLAUDE2';
-- then SP_AcctAgencyDelete each row in turn
```

(Or, if you want, leave the test PSU26 rows in place and let them serve as the basis for an eventual real PSU26 rollover when summer registration actually opens.)

---

### Test D — Item create (`/products`, existing PR #162 flow)

**Already in production** but never explicitly snapshot/diff-tested. Worth re-running once now that we have the snapshot/diff scripts.

| Step | Detail |
|---|---|
| **Test ID** | `item-create-001` |
| **Item description** | `TEST CLAUDE GM 001` |
| **Barcode** | `TEST-CLAUDE-001` |
| **Vendor** | any small Pierce vendor |
| **DCC** | any active Pierce DCC (e.g. school supplies) |
| **Retail/Cost** | $1.00 / $0.50 |
| **Inventory** | Pierce only (LocationID 2) |
| **UI flow** | `/products` → Add Item → fill form → Create |

**Expected diff:**

| Table | Change |
|---|---|
| `Item` | +1 row (the pointer/identity row) |
| `ItemMaster` | +1 row (the master attribute row) |
| `GeneralMerchandise` | +1 row (the GM-specific attribute row) |
| `Inventory` | +1 row at LocationID 2 with retail=$1.00, cost=$0.50 |

The exact set is what `P_Item_Add_GM` produces. The `prism-server.ts` createGmItem function then adds the Inventory row for each requested location.

**Should NOT change:** anything else. If `pos_update` shows new entries, that's a side-effect we haven't documented for items — flag it.

**Cleanup:**
```bash
npx tsx scripts/test-prism-cleanup.ts
```
(deletes every item with barcode prefix `TEST-CLAUDE-`)

---

### Test E — Item discontinue (`/products`)

| Step | Detail |
|---|---|
| **Test ID** | `item-discontinue-001` |
| **Subject** | re-create `TEST-CLAUDE-002`, then discontinue it |
| **UI flow** | Find the item → Discontinue button |

**Expected diff:**

| Table | Change |
|---|---|
| `Item` | 1 row updated (`fDiscontinue` 0 → 1) |

**Should NOT change:** `Inventory`, `ItemMaster`, `GeneralMerchandise`, or anything else. If `pos_update` gets entries, document that as a discontinue side-effect.

---

### Test F — Item edit (`/products` edit flow)

| Step | Detail |
|---|---|
| **Test ID** | `item-edit-001` |
| **Subject** | a `TEST-CLAUDE-*` item from D or E |
| **Edits** | change retail $1.00 → $2.00; change description to add a suffix |
| **UI flow** | open item detail → edit fields → save |

**Expected diff:** depends on which fields edited — should be a 1-row UPDATE on whichever of `Item`/`ItemMaster`/`GeneralMerchandise`/`Inventory` is the source-of-truth for each edited field. Document the actual diff so we have a verified contract for item-edit (currently the gap per CLAUDE.md memory).

---

### Test G — Item hard-delete guard (`/products` test items only)

| Step | Detail |
|---|---|
| **Test ID** | `item-delete-guard-001` |
| **Subject** | a `TEST-CLAUDE-*` item with **no** sales/PO history |
| **UI flow** | hard-delete via the existing test-only path |

**Expected diff:** rows DELETED from `Item`, `ItemMaster`, `GeneralMerchandise`, `Inventory`. Should fail loudly if the item has any FK references in `Transaction_Detail`, `PO_Detail`, etc. (existing HAS_HISTORY guard).

---

## 4. What to do if a diff is unexpected

1. **Stop.** Do not run any further write tests.
2. Save both snapshots and the diff output to `tmp/diffs/incident-<timestamp>/`.
3. Identify the unexpected table(s):
   - **If extra rows appeared in a table you didn't expect** — there's a trigger or side-effect we haven't documented. Recover the trigger body via `scripts/prism-probe-proc-body.ts` (read-only) and update the appropriate doc under `docs/prism/static/actions/`.
   - **If expected rows are missing** — the feature didn't fire as designed. Roll back if possible (delete the test agency / item), then file a fix.
4. **For agencies**, the rollback is `EXEC SP_AcctAgencyDelete @agencyid = <id>` — but only if no FK references exist (no `Acct_Agency_Customer`, no `Acct_Adjust_Header`, etc.). For test runs against PSU26 / TESTCLAUDE codes, FK references should never be present.
5. **For items**, the rollback is `scripts/test-prism-cleanup.ts` (gated on `TEST-CLAUDE-*`).

---

## 5. Operator checklist (printable)

Use this when running tests:

```
[ ] Test A — Mirror clone (PSP25EOPSDEPT → PSU26TESTCLAUDE)
    [ ] before snapshot saved
    [ ] action performed
    [ ] after snapshot saved
    [ ] diff matches expected (Acct_Agency +1, Tax_Codes +N, pos_update +M)
    [ ] cleanup: SP_AcctAgencyDelete

[ ] Test B — Build from scratch (PSU26TESTCLAUDE2)
    [ ] before / action / after / diff
    [ ] columns match Test A's row except identity fields
    [ ] cleanup

[ ] Test C-1 — Single-row rollover (PSP25 → PSU26, one agency)
    [ ] before / action / after / diff
    [ ] result panel persists after success (no Codex regression)
    [ ] cleanup

[ ] Test C-2 — 5-row rollover (PSP25 → PSU26, five agencies)
    [ ] before / action / after / diff
    [ ] result panel shows 5 created, 0 errors
    [ ] [Already exists] badges flipped in-place
    [ ] cleanup

[ ] Test D — Item create (TEST-CLAUDE-001)
    [ ] before / action / after / diff
    [ ] Item + ItemMaster + GM + Inventory rows
    [ ] cleanup

[ ] Test E — Item discontinue
[ ] Test F — Item edit
[ ] Test G — Item hard-delete guard
```

---

## 6. After all tests pass

- **Update the confidence-rating table** in [`docs/prism/static/actions/agency-binary-findings.md`](static/actions/agency-binary-findings.md) §8 to reflect the verified state. Each green test bumps that flow from ~95% to ~98%.
- **Optionally**, add the per-feature expected-diff content from §3 above as fixture files under `tmp/snapshots/golden/` so future regression tests can compare against the canonical mutations without re-running the whole flow.
- **Memory update**: drop a note in auto-memory (`reference_prism_database.md`) that snapshot/diff acceptance is the gate for any new Prism-write feature in laportal.

---

## 7. What NOT to test in this round

- **Prism `pos_update` consumption** — that's the registers' job, not laportal's. Verifying the queue rows land is enough; the register-side sync is out of scope for this plan.
- **PrismCore web visibility** — `SP_ARAcctResendToWeb` only fires for `fAccessibleOnline=1` agencies, and Test A/B/C don't toggle that. If you want to also test the web push, add a Test C-3 with an EOPSGRANT-style template (which has `fAccessibleOnline=1`) and verify a row appears in whatever table that proc writes to (proc body not yet recovered — would need a separate plan-cache probe).
- **Race conditions** — single-operator, single-clone-at-a-time flow. No need to load-test.
