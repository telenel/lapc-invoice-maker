# WinPRISM / WPAdmin reverse-engineering knowledge base

This folder is the durable, repo-resident knowledge base for everything we have learned about the WinPRISM / WPAdmin / PrismCore stack — the proprietary ERP that runs the LACCD bookstores, including LA Pierce. It is intentionally portable: clone the repo on any box, open `docs/prism/`, and you have everything.

The goal is to learn enough about WinPRISM to safely re-implement its core item-management behaviors inside `laportal` so Pierce can leave PrismCore behind. Every doc here serves that goal.

## Hard rule — Prism is read-only

**Never issue `INSERT`, `UPDATE`, `DELETE`, `MERGE`, `EXEC` of a writing proc, or DDL against `winprism-la` without Marcos's explicit per-operation acknowledgment.** This applies to ad-hoc queries, discovery scripts, snapshot/diff workflows, and any agent-initiated test row. Read-only by default, ask first, always. The shipped production write paths in `laportal` (the ones that fire from real user clicks) are unaffected — the rule is about analysis and exploration. See `CLAUDE.md` at the repo root for the full statement.

The Supabase mirror (`wzhuuhxzxrzyasxvuagb`) is a writable copy — that is normal engineering work and is not subject to this rule.

## Quick navigation

| I want to... | Go to |
|---|---|
| Understand the overall shape of the Prism database (table / proc / view counts, ER scale) | [`SCHEMA.md`](SCHEMA.md) |
| Know which fields Pierce actually populates (% fill rate per column) | [`field-usage.md`](field-usage.md) |
| Know what specific WPAdmin actions write (observed via snapshot/diff) | [`winprism-reverse-engineering.md`](winprism-reverse-engineering.md) |
| See every table touched by a given binary (e.g. ItemMnt.dll, WPAdmin.exe) | [`static/binaries/`](static/binaries/) |
| Find every binary that touches a given table | [`static/by-table.md`](static/by-table.md) |
| Find every binary that calls a given stored proc | [`static/by-proc.md`](static/by-proc.md) |
| See the per-binary statement summary at a glance | [`static/catalog.md`](static/catalog.md) |
| Read a static-only analysis of a specific WPAdmin action | [`static/actions/`](static/actions/) |
| Recover a stored proc's body without `VIEW DEFINITION` | [`static/plan-cache-method.md`](static/plan-cache-method.md) |
| Read a recovered Prism stored-proc body | [`static/proc-bodies/`](static/proc-bodies/) |
| Map a Pierce staff member to their Prism `SUID` for laportal audit-stamping | [`user-identity-mapping.md`](user-identity-mapping.md) |
| Look up which script does what | [`tooling.md`](tooling.md) |
| Verify a recent feature against the Prism schema | [`phase-1-verification-2026-04-19.md`](phase-1-verification-2026-04-19.md) |

## The three tracks

Every reverse-engineering effort here falls into one of three complementary tracks. Use them together — each one's blind spots are covered by the other two.

### 1. Schema track — the static catalog of Prism

Direct queries against SQL Server's system catalogs to enumerate the surface area of the database itself.

- [`SCHEMA.md`](SCHEMA.md) — top-level reference. **962 tables, 4,654 procs, 1,472 views, 210 functions, 475 triggers, 7,927 columns.** Generated 2026-04-17.
- [`field-usage.md`](field-usage.md) — for every editable column on Item / GeneralMerchandise / Textbook / Inventory, what % of Pierce rows actually have a value. The source of truth for "primary tab vs advanced toggle" UI decisions.
- [`raw/inventory.json`](raw/inventory.json) — 2.4 MB raw catalog dump. Source for `SCHEMA.md`. Regenerate via `scripts/discover-prism-full.ts`.
- [`field-usage-snapshot-2026-04-19.json`](field-usage-snapshot-2026-04-19.json) — raw counts behind `field-usage.md`.
- [`ref-data-snapshot-2026-04-19.json`](ref-data-snapshot-2026-04-19.json) — Pierce-relevant lookup tables (DCC, TagType, Tax_Type, etc.) snapshotted for offline use.

### 2. Dynamic-analysis track — observed write paths

Snapshot the database, perform a UI action in WPAdmin, snapshot again, diff. The diff is the action's true write set — including triggers, audit rows, and side-effects we would never have predicted.

- [`winprism-reverse-engineering.md`](winprism-reverse-engineering.md) — the experiment log. Each experiment captures a specific WPAdmin action ("create a new top-level DCC", "create a new GM item via Item Maintenance and close before update") and documents every table mutation, including noise tables to ignore in future diffs.
- Scripts: [`prism-snapshot.ts`](../../scripts/prism-snapshot.ts) and [`prism-diff.ts`](../../scripts/prism-diff.ts).

When we need ground truth — "what does this button _actually_ do, including the parts I do not expect" — this track has the answer. It is slow and human-driven (someone has to click the button) but it is authoritative.

### 3. Static-analysis track — the binary's full repertoire

The WPAdmin client and its module DLLs are 32-bit native C++ binaries with embedded SQL strings. We extract every printable string and parse out SQL statements, proc names, and view names. The result is the upper bound of what each module _could_ do.

- [`static/README.md`](static/README.md) — approach, outputs, limitations.
- [`static/catalog.md`](static/catalog.md) — per-binary summary table (17 binaries).
- [`static/by-table.md`](static/by-table.md), [`static/by-proc.md`](static/by-proc.md), [`static/by-view.md`](static/by-view.md) — cross-binary indexes.
- [`static/binaries/<binary>.md`](static/binaries/) — per-binary deep-dive: write surface, read surface, raw SQL, sample UI strings.
- [`strings/<binary>.{strings,sql,procs}.txt`](strings/) — raw extraction substrate.
- Scripts: [`prism-probe-clr.ps1`](../../scripts/prism-probe-clr.ps1), [`prism-extract-strings.ps1`](../../scripts/prism-extract-strings.ps1), [`prism-analyze-binaries.ts`](../../scripts/prism-analyze-binaries.ts).

When we need to know "what is the universe of writes this module is _capable_ of, even ones we have never seen fire" — this track has the answer. It is fast and fully automatable (no human, no clicks) but composed-at-runtime SQL is invisible to it.

## File map

```
docs/prism/
├─ README.md                                 ← you are here
├─ SCHEMA.md                                 — full Prism schema reference (962 tables, etc.)
├─ field-usage.md                            — Pierce per-column fill-rate snapshot
├─ field-usage-snapshot-2026-04-19.json      — raw counts for field-usage.md
├─ ref-data-snapshot-2026-04-19.json         — Pierce ref-data snapshot
├─ phase-1-verification-2026-04-19.md        — verification artifact: product_inventory split
├─ tooling.md                                — every prism-related script in this repo
├─ winprism-reverse-engineering.md           — DYNAMIC analysis: snapshot/diff experiments
├─ raw/
│  └─ inventory.json                         — full catalog dump (regenerable)
├─ strings/                                  — STATIC analysis raw substrate
│  ├─ <binary>.strings.txt                   — every printable string ≥6 chars
│  ├─ <binary>.sql.txt                       — pre-filtered SQL-bearing lines
│  └─ <binary>.procs.txt                     — pre-filtered proc-name strings
└─ static/                                   — STATIC analysis structured output
   ├─ README.md                              — approach, limitations, regen
   ├─ catalog.md                             — per-binary summary table
   ├─ catalog.json                           — machine-readable inventory
   ├─ by-table.md                            — table → binaries that touch it
   ├─ by-proc.md                             — proc → binaries that call it
   ├─ by-view.md                             — view → binaries that query it
   └─ binaries/
      └─ <binary>.md                         — per-binary deep-dive
```

## Glossary

| Term | Meaning |
|---|---|
| **Prism / WinPRISM** | The proprietary ERP from PrismRBS that runs the LACCD bookstores. Backed by SQL Server. |
| **WPAdmin** | The back-office administrative client. Where item maintenance, vendor maintenance, accounting, etc. happen. |
| **WinPrism.exe** | The main Windows client (POS + back-office shell). |
| **PrismCore** | The web-based front end built on top of Prism. The thing `laportal` is replacing for Pierce. |
| **Pierce / PIER / PCOP / PFS** | LA Pierce College locations. `LocationID IN (2, 3, 4)`. PBO (LocationID 5) is excluded. |
| **DCC** | Department / Class / Category — Prism's three-level item taxonomy. The `DeptClassCat` junction table assigns a surrogate `DCCID` per triplet. |
| **SKU** | Prism's primary item identifier (`Item.SKU`). |
| **PRISM SQL login** | The shared WinPRISM SQL login for analysis boxes. Keep the username/password out of source control. The account has full read+write despite what `sys.database_permissions` shows; we keep the read-only convention by policy. |
| **Item / ItemMaster / GeneralMerchandise / Textbook** | The four-table item model. `Item` is the pointer/identity row, the others are domain-specific attribute tables. |
| **Inventory** | Per-(SKU, LocationID) stock + status row. |
| **`E_*` procs** | A common Prism stored-proc prefix. Example: `E_CreateItemsFromStyle`, `E_StyleTemplateDetail_Set`. |
| **`VW_*` views** | A common Prism view prefix. Example: `VW_ITM_MASTER`, `VW_DCC_LOOKUP`. |

## How to bootstrap on a fresh box

```bash
git clone <repo> laportal
cd laportal
npm install

# Open the index
start docs/prism/README.md   # Windows
# or
open  docs/prism/README.md   # macOS

# Re-generate the schema reference (LACCD intranet only)
npx tsx scripts/discover-prism-full.ts

# Re-generate the static-analysis catalog (anywhere — needs WinPRISM install on disk)
powershell.exe -ExecutionPolicy Bypass -File scripts/prism-extract-strings.ps1
npx tsx scripts/prism-analyze-binaries.ts
```

Everything in this folder except the static-analysis substrate (`strings/`, `static/`) is portable across boxes without re-running anything. The static-analysis substrate is regenerable from a Pierce-installed WinPRISM client — keep it checked in so other boxes can read it without needing the install.

## Contributing new findings

This is an active, append-only knowledge base. When you discover something:

1. **Schema fact** (table layout, column type, FK, default value) → add to [`SCHEMA.md`](SCHEMA.md) Appendix A or a new appendix.
2. **Observed write path from a UI action** → add a new "Experiment N" section to [`winprism-reverse-engineering.md`](winprism-reverse-engineering.md), including BEFORE/AFTER snapshot names and the diff summary.
3. **Static-analysis finding** (new proc, new write surface inferred from a binary) → it is already in `static/` if you re-run the analyzer; if you uncover something the analyzer missed (e.g. composed SQL), drop a note in [`static/README.md`](static/README.md) under "Limitations" or in the relevant binary's per-file doc.
4. **Field-usage update** → re-run `analyze-prism-field-usage.ts` and commit the new snapshot. Do not delete the older snapshot — they are dated for trend analysis.
5. **New script** → add a row in [`tooling.md`](tooling.md) under the right section.

Date-stamp anything that captures a point-in-time observation (snapshots, verification reports, sync results). Use `YYYY-MM-DD` and put the date in the filename.

## See also

- `CLAUDE.md` (repo root) — read-only rule + project conventions.
- `docs/PROJECT-OVERVIEW.md` — laportal's overall architecture.
- `docs/SUPABASE-MIGRATION-STATUS.md` — Supabase mirror state.
