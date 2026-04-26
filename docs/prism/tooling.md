# Prism reverse-engineering tooling — script catalog

Every script in this repo that reads, probes, analyzes, or interacts with WinPRISM. Grouped by purpose. All paths are relative to the repo root.

## Read-only rule

> **PRISM IS STRICTLY READ-ONLY** unless Marcos has explicitly authorized a specific write in the current conversation. This rule is repeated in `CLAUDE.md` at the repo root and in user/global instructions. The `test-prism-*.ts` scripts are the only ones that perform writes, and they all guard with the `TEST-CLAUDE-` barcode prefix. Re-read `CLAUDE.md` before running anything that does not have `READ-ONLY` in its docstring.

The Supabase mirror at project `wzhuuhxzxrzyasxvuagb` is fully writable; that constraint applies to the WinPRISM SQL Server only.

## 1 — Schema discovery (read-only)

These map the static structure of the Prism database. Output feeds [`SCHEMA.md`](SCHEMA.md) and [`field-usage.md`](field-usage.md).

| Script | Purpose |
|---|---|
| [`scripts/discover-prism-full.ts`](../../scripts/discover-prism-full.ts) | Dumps tables, procs, views, functions, triggers, FKs, permission metadata to `docs/prism/raw/inventory.json`. Re-run after any schema change. |
| [`scripts/discover-prism-item-schema.ts`](../../scripts/discover-prism-item-schema.ts) | Item / GeneralMerchandise / Inventory schema deep-dive. Used to design the item-edit feature. |
| [`scripts/discover-prism-status-and-binding-refs.ts`](../../scripts/discover-prism-status-and-binding-refs.ts) | Resolves the lookup tables behind `Inventory.StatusCodeID` and `Textbook.BindingID`. |
| [`scripts/analyze-prism-locations.ts`](../../scripts/analyze-prism-locations.ts) | Lists every Prism Location row with activity flags. Confirms LocationIDs 2/3/4 are Pierce. |
| [`scripts/analyze-prism-field-usage.ts`](../../scripts/analyze-prism-field-usage.ts) | Per-column population stats at Pierce, scoped to active GM and recently-sold textbooks. Output → `docs/prism/field-usage.md` + `docs/prism/field-usage-snapshot-2026-04-19.json`. |
| [`scripts/analyze-prism-default-values.ts`](../../scripts/analyze-prism-default-values.ts) | For high-fill columns, dumps the actual value distribution to distinguish "everyone uses this" from "everyone uses the default." |

## 2 — Targeted probes (read-only)

One-off investigations that answered a specific question. Kept in-tree because the same question often comes up again on a different SKU / location / column.

| Script | Question it answered |
|---|---|
| [`scripts/probe-prism-txn-volume.ts`](../../scripts/probe-prism-txn-volume.ts) | How big is a 3-year Pierce transaction pull? Sized the backfill. |
| [`scripts/probe-prism-txn-columns.ts`](../../scripts/probe-prism-txn-columns.ts) | Which Transaction_Header / Transaction_Detail columns are populated and usable? |
| [`scripts/probe-prism-txn-columns-v2.ts`](../../scripts/probe-prism-txn-columns-v2.ts) | Round 2 with corrected assumptions: `fStatus` is a bitmask, `ExtPrice` is revenue (not `SaleAmt`). |
| [`scripts/probe-prism-est-sales.ts`](../../scripts/probe-prism-est-sales.ts) | Is `Inventory_EstSales` still being populated, and do values look real? |
| [`scripts/probe-prism-membership.ts`](../../scripts/probe-prism-membership.ts) | What's actually stored in `Transaction_Header.MembershipID`? |
| [`scripts/inspect-prism-sku.ts`](../../scripts/inspect-prism-sku.ts) | All Item / Inventory / Textbook / GM rows for a given SKU, including every date column. |
| [`scripts/prism-inspect-dcc.ts`](../../scripts/prism-inspect-dcc.ts) | All rows in Prism that reference a given DCCID, plus parent Dept/Class lookups. |

## 3 — Dynamic reverse engineering (snapshot + diff)

Captures what WPAdmin actually writes when a user clicks a button. See [`winprism-reverse-engineering.md`](winprism-reverse-engineering.md) for the experiment log.

| Script | Purpose |
|---|---|
| [`scripts/prism-snapshot.ts`](../../scripts/prism-snapshot.ts) | Capture row counts + `CHECKSUM_AGG` per table, plus full rows for small tables. Read-only. Output → `tmp/prism-snapshots/<name>.json`. |
| [`scripts/prism-diff.ts`](../../scripts/prism-diff.ts) | Compare two snapshots. Identifies tables that mutated and (for small tables) row-level NEW/DELETED/UPDATED diffs. Pure file I/O — no DB calls. |

**Workflow:** snapshot BEFORE the user action, the user clicks the button, snapshot AFTER, diff. The diff reveals every table the action touched and (for the small lookup tables we capture in full) the exact row contents that changed.

## 4 — Static reverse engineering (binary string extraction)

Reads the WPAdmin client binaries on disk to extract embedded SQL, proc names, view names, and UI strings. See [`static/README.md`](static/README.md) for the full approach and findings.

| Script | Purpose |
|---|---|
| [`scripts/prism-probe-clr.ps1`](../../scripts/prism-probe-clr.ps1) | Classifies every `.exe` / `.dll` under `C:\Program Files (x86)\WinPRISM\` as native vs .NET. |
| [`scripts/prism-extract-strings.ps1`](../../scripts/prism-extract-strings.ps1) | Extracts ASCII + UTF-16LE printable runs from each binary. Pre-filters to SQL-bearing and proc-name lines. Output → `docs/prism/strings/`. |
| [`scripts/prism-extract-mfc-recordset.ps1`](../../scripts/prism-extract-mfc-recordset.ps1) | **Recovers MFC recordset column bindings in original byte order** by scanning the binary around `[dbo].[<TableName>]` anchors. Yields the literal column list MFC uses for INSERT/SELECT/UPDATE — closes the gap that `prism-extract-strings.ps1` opens (the latter sorts alphabetically and breaks contiguous SQL). Pass `-Tables Acct_Agency,Acct_Agency_Customer` etc. See [`static/actions/agency-binary-findings.md`](static/actions/agency-binary-findings.md) for an applied example. |
| [`scripts/prism-analyze-binaries.ts`](../../scripts/prism-analyze-binaries.ts) | Parses the strings dumps into a structured per-binary inventory: tables (with INSERT/UPDATE/DELETE/SELECT split), stored procs, views, raw SQL statements. Output → `docs/prism/static/`. |
| [`scripts/prism-probe-proc-body.ts`](../../scripts/prism-probe-proc-body.ts) | **Plan-cache method**: recovers a stored proc's body statement-by-statement from `sys.dm_exec_query_stats`, sidestepping the missing `VIEW DEFINITION` permission. See [`static/plan-cache-method.md`](static/plan-cache-method.md). |

## 5 — Production write paths (NOT analysis tools)

These hit real Prism tables for real reasons. They are documented here for awareness, not because they are part of the reverse-engineering toolkit. They run against test SKUs only and are gated by barcode-prefix safety guards.

| Script | Purpose |
|---|---|
| `scripts/test-prism-create-only.ts` | Create one test item, leave it. |
| `scripts/test-prism-cleanup.ts` | Delete every TEST-CLAUDE-* item. |
| `scripts/test-prism-flow.ts` | Full create → discontinue → hard-delete round trip. |
| `scripts/test-prism-edit.ts` | Live edit round-trip on every editable field. |
| `scripts/test-prism-batch-add.ts` | Batch insert + update + cleanup on 5 items. |
| `scripts/test-prism-hard-delete-guard.ts` | Verify the HAS_HISTORY guard refuses to delete items with PO history. |
| `scripts/test-prism-pull-sync.ts` | Verify `runPrismPull` is idempotent. |
| `scripts/test-prism-sync-classification.ts` | Validate the new sync query against Prism (no writes). |
| `scripts/test-prism-sync-dcc-estsales.ts` | Verify DCC + EstSales extensions of the sync. |
| `scripts/backfill-prism-transactions.ts` | One-time 3-year POS pull into Supabase. Idempotent via `tran_dtl_id` ON CONFLICT. |

## Prerequisites for running anything Prism-touching

1. **Network reachable.** Either on the LACCD intranet, or on a box with the SSH tunnel bridge active (see `reference_prism_tunnel_bridge.md` in auto-memory).
2. **`.env.local`** with `PRISM_SERVER=winprism-la`, `PRISM_DATABASE=prism`, `PRISM_USER=<prism-read-login>`, `PRISM_PASSWORD=<prism-password>`.
3. **`@/lib/prism`** import: every script uses `getPrismPool()` + tagged `sql` template helper from `src/lib/prism.ts`.

The static-analysis scripts (`prism-probe-clr.ps1`, `prism-extract-strings.ps1`, `prism-analyze-binaries.ts`) need only the WinPRISM client install on disk — no database, no network. They run anywhere the binaries exist.

## How to add a new script

1. Drop it in `scripts/` matching the existing naming (`<verb>-prism-<scope>.ts`).
2. Lead with a `/** ... */` docstring stating: read-only or write, scope (Pierce / district / SKU-specific), output location.
3. If it's a probe that answers a question once, leave it in-tree anyway — the same question always comes back.
4. If it touches Prism, default to read-only. Get explicit approval per CLAUDE.md before adding any write path.
5. Add a row to the appropriate table above.
