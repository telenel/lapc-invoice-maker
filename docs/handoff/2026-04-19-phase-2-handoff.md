# Item Editor Parity — Phase 2 Handoff

**Created:** 2026-04-19
**Status:** Phase 1 shipped as [PR #215](https://github.com/telenel/laportal/pull/215). Phase 2 not started.
**Purpose:** Self-contained handoff for resuming item-editor-parity work on a new machine / new Claude session. Everything the next session needs is either in this doc or linked from it (no reliance on a specific machine's `~/.claude/projects/` memory dir).

---

## How to start the new session

Clone/pull this repo, check out `main` (once PR #215 is merged) or `feat/item-editor-parity` (if not), then paste this into Claude Code:

```
Continuing laportal item-editor-parity work. Phase 1 is shipped or merging.
Everything you need is in docs/handoff/2026-04-19-phase-2-handoff.md in this repo.
Read that file first, then write the Phase 2 plan at
docs/superpowers/plans/2026-04-19-item-editor-parity-phase-2.md, then execute
it with superpowers:subagent-driven-development on a fresh branch
feat/item-editor-parity-phase-2 cut from main.
```

---

## The hard rules (inline — do not need to pull from local memory)

These are session-spanning rules that govern every decision below. Copy them into the new session's global CLAUDE.md if useful, but the important thing is that they apply throughout this work.

### 1. Prism SQL is strictly READ-ONLY without explicit permission

**Never** issue INSERT, UPDATE, DELETE, MERGE, EXEC-of-writing-procs, or DDL against the WinPRISM SQL Server (`winprism-la`) without Marcos's explicit, per-operation acknowledgment. Every SQL operation against Prism defaults to SELECT / INFORMATION_SCHEMA / sys catalogs only.

**Why:** Prism is district-wide across 9 LACCD colleges; an accidental write can silently corrupt live POS data or trip compliance. Marcos cannot audit every agent write in real time. Read-only by default is the only safe posture.

**How to apply:**
- Any discovery/analysis script defaults to SELECTs only. Narrate "read-only" when proposing it.
- Production write paths already shipped in laportal (e.g., `createGmItem`, `discontinueItem`, `updateGmItem`, `deleteTestItem`) are fine — they run only when a real user clicks a button. The rule is about *new autonomous writes from the agent*.
- For planning / schema reading / proc-parameter inspection — all fine.
- If a Prism write seems necessary (e.g., "we should test that the new UPDATE works"), STOP and ask Marcos. Describe the exact statement, target rows, and rollback plan.
- Applies to both direct SQL (`pool.request().query(...)`) and scripts (`npx tsx scripts/test-prism-*.ts`). Scripts named `test-` can still write.

### 2. PBO (LocationID 5) is strictly excluded

Pierce scope for laportal is **LocationID IN (2, 3, 4)** only — PIER (bookstore), PCOP (CopyTech), PFS (Brahma Cafe). **PBO (Pierce Business Office, LocationID 5) is completely off-limits** — do not analyze, query, sync, surface, or write its data. Use `LocationID IN (2, 3, 4)`, never `IN (2, 3, 4, 5)`.

**Why:** PBO is a separate department (parking permits, transcripts, fees). Marcos does not manage it. Including it pollutes the catalog and risks exposing admin data.

**Enforced at 3 layers in Phase 1's code:** CHECK constraint on `product_inventory.location_id`, `IN (2, 3, 4)` in the Prism sync query, and a `throw` in `shredRecordset` if a LocationID=5 row somehow slips through.

### 3. Laportal must BEAT PrismCore, not mirror it

Design principle for every UI and API decision on the products page: narrow to what Pierce actually uses, show it prominently, keep everything else editable but out of the way. We are not recreating PrismCore in a browser — we are building something measurably more pleasant for add / edit / bulk / browse on the fields Pierce actually populates.

**Concretely for Phase 2:**
- API payloads surface **labels**, not raw numeric IDs.
- Dropdown sort order follows Pierce usage frequency (fill-rate snapshot), most-used first. Users should never have to hunt for the value they'll pick 79% of the time.
- Cache the refs — they change rarely.
- Keep the API shape narrow; don't return every column from the ref table, just `{ id, label }` plus anything genuinely useful.

### 4. Show labels, never numeric IDs, in user-facing UI

Anywhere the portal surfaces a Prism reference value — TagType, ItemTaxType, StatusCode, Vendor, DCC, PackageType, Color, Binding — display the human-readable Description, never the raw numeric ID. Values submitted are still IDs; only the visible text is the label.

**Ref tables confirmed in Phase 1 P1.6:**
- TagType → `TagType.Description`
- Item tax type → `Item_Tax_Type.Description` (e.g., "STATE" / "NOT TAXABLE" / "9.75" / "10.50% TAX")
- Inventory status code → `InventoryStatusCodes.StatusCodeName` keyed by `InvStatusCodeID`
- Package type → `PackageType.Description` (code is 3-char: "EA", "CS", "BX", etc.)
- Binding → `Binding.Name`
- Location abbreviation → `Location.Abbreviation`
- Status_Codes (module-level, NOT the inventory one — don't confuse)

**Not yet discovered:**
- Color (backing `GeneralMerchandise.Color` int FK). Phase 2 has to discover this — probably named `Color`, `Item_Color`, or similar. Use an `INFORMATION_SCHEMA.TABLES` probe.

### 5. Pierce-only scope for Prism writes

When autonomous writes are explicitly authorized (they aren't by default per rule 1), any stored proc that takes `@LocationID` must receive 2, 3, or 4. Never another LACCD campus's LocationID (1 CITY, 6 LAMC, 7 LASC, 8 WEST, 9/10 PAWS, 11 LAVC, 12 ELAC, 13 SGEC, 15 HSKY, 16 LAHC, 17 LATT, 18 LAMC-c-store).

Agency-name prefix rule: Pierce agencies in `Acct_Agency` start with `P` or the literal `PIERCE`. Don't touch other campus prefixes (C/E/H/V/W/T/S etc.).

---

## What Phase 1 shipped (PR #215)

13 commits on `feat/item-editor-parity` branching from main at `1459cd2`:

| # | Commit | Summary |
|---:|---|---|
| 1 | `3c54157` | `product_inventory` table — keyed `(sku, location_id)`, CHECK `IN (2, 3, 4)`, FK cascade to products |
| 2 | `96a8f88` | 31 global columns added to `products` for Item/GM/Textbook editor parity |
| 3 | `72587ca` | Backfill product_inventory from existing PIER rows |
| 4 | `c8042c5` | `PrismItemRow` + `PrismInventoryRow` types split |
| 5 | `39181a0` | `buildPrismPullPageQuery` expanded to 3 locations + 4 ref tables |
| 6 | `571803d` | Fix: AlternateVendorID correctly placed on GM, not Item |
| 7 | `29b3e6f` | Status + Binding ref-table joins (discovered: InventoryStatusCodes, Binding) |
| 8 | `1c9003c` | Pure `shredRecordset` with PBO rejection |
| 9 | `03e3046` | `runPrismPull` rewired to upsert both tables |
| 10 | `d7fd760` | Per-location reap + orphan-SKU cleanup |
| 11 | `86c81b0` | E2E smoke + schema fix (SMALLINT→INTEGER for StatusCodeID sentinel) |
| 12 | `b45ebde` | Dead code removed from analyze-prism-locations script |
| 13 | `2550010` | `for…of Set` → `.forEach` for TS downlevelIteration |

### Verification against dev Supabase (2026-04-19)

| Table | Count |
|---|---:|
| products | 61,395 |
| product_inventory @ PIER (2) | 61,024 |
| product_inventory @ PCOP (3) | 18,511 |
| product_inventory @ PFS (4) | 18,103 |
| product_inventory @ PBO (5) | **0** (hard rule held) |

- FK orphans: 0
- Two back-to-back syncs stable at ~60s each
- Labels populated: "STATE" / "NOT TAXABLE" / "PAPERBACK" / "LARGE w/Price/Color" / "Active"

Full verification notes: `docs/prism/phase-1-verification-2026-04-19.md` (committed on this branch).

---

## Phase 2 scope

Reference: `docs/superpowers/specs/2026-04-19-item-editor-parity-design.md` §Phasing → Phase 2.

**Goal:** Expand `GET /api/products/refs` from the current `{ vendors, dccs, taxTypes }` to include labeled `tagTypes`, `statusCodes`, `packageTypes`, `colors`, `bindings`. Anywhere the UI currently surfaces a raw numeric ID, resolve it to a label.

### Deliverables

- **API change:** `/api/products/refs` returns the expanded payload. Each label array is sorted by Pierce usage frequency (most-used first), with ties broken alphabetically. Cache headers stay `private, max-age=60` (refs change rarely).
- **Sort-hint source:** `docs/prism/field-usage-snapshot-2026-04-19.json` is the fill-rate snapshot; use its distributions as the tiebreaker order. For example, the tag-type dropdown's first entry should be `3 "LARGE w/Price/Color"` (40% usage), then `10000081` (27%), etc.
- **Color ref discovery:** `GeneralMerchandise.Color` is an int FK but we haven't confirmed the ref table. Probe `INFORMATION_SCHEMA.TABLES` for `Color%` / `Item_Color%` / `Master_Color%`. If no dedicated ref table exists, fall back to `SELECT DISTINCT Color FROM GeneralMerchandise` as a self-referencing label source.
- **UI audit:** check `ItemRefSelects`, `new-item-dialog`, `edit-item-dialog`, and any table cell that currently shows an ID. Replace raw ID renders with labels from the new refs payload.

### Out of scope for Phase 2

- Top-of-page location picker (Phase 3)
- Edit dialog redesign / new tabs (Phase 4)
- Inventory tab with multi-location edit (Phase 5)
- Textbook tab + Add dialog v2 (Phase 6)
- Inline row edits (Phase 7)
- Bulk-edit field picker (Phase 8)
- Dropping old flat columns from products (Phase 1c, after Phase 3)

### Expected PR shape

- 1 plan doc (follow Phase 1's structure for task granularity)
- 1 branch: `feat/item-editor-parity-phase-2` cut fresh from main
- ~6-8 tasks: ref-table discovery probe + API handler extension + client hook update + UI swap-outs + tests + ship
- Size: smaller than Phase 1 (no schema changes, no sync changes)

---

## Known quirks the new session must know

1. **Prisma CLI cannot reach dev Supabase from a campus Windows box.** Port 5432 is blocked. Use the Supabase MCP (`apply_migration`, `execute_sql`, project_id `wzhuuhxzxrzyasxvuagb`) instead. This is a pre-existing infra gap; do not waste time trying to fix it.

2. **Codex review stamp gate.** `scripts/publish-pr.sh` blocks unless there's a fresh Codex review stamp at `.git/laportal/codex-review.env` matching HEAD. Marcos authorized bypass — use `gh pr create` directly and `git push --no-verify`.

3. **CRLF line-ending drift on `tests/domains/product/__snapshots__/presets-predicates.test.ts.snap`.** Appears "modified" on every session without actually changing content. `git restore` it before ship-check runs.

4. **npm script on Windows.** `npm run ship-check` fails with "'.' is not recognized" because cmd can't execute `./scripts/ship-check.sh`. Run `bash ./scripts/ship-check.sh` directly instead.

5. **Ship-check requires a clean tree** — no untracked files. Stash before running. The ship-check stamp at `.git/laportal/ship-check.env` must match HEAD for `publish-pr.sh` to work.

6. **Set iteration under tsconfig.** The project target doesn't allow `for…of` over a `Set<T>` — use `.forEach()` or `Array.from(set)` + `for…of`. Tests pass the `for…of` form; the `next build` type-checker fails it.

7. **Pre-existing `_prisma_migrations` divergence.** The project's Prisma migration tracker is out of sync with `supabase_migrations.schema_migrations` (the MCP's record). Multiple recent migrations applied via MCP never made it into `_prisma_migrations`. This is a long-standing thing — not yours to fix unless it blocks you.

---

## Paths you'll reference

- **Master spec** (read first): `docs/superpowers/specs/2026-04-19-item-editor-parity-design.md`
- **Phase 1 plan** (reference for structure/style): `docs/superpowers/plans/2026-04-19-item-editor-parity-phase-1.md`
- **Fill-rate snapshot** (sort-order source of truth): `docs/prism/field-usage.md` + `docs/prism/field-usage-snapshot-2026-04-19.json`
- **Prism schema map**: `docs/prism/SCHEMA.md`
- **Prism raw inventory**: `docs/prism/raw/inventory.json` (2.4 MB, every table/column/proc/view)
- **Phase 1 verification**: `docs/prism/phase-1-verification-2026-04-19.md`
- **Current refs endpoint** (to extend): `src/app/api/products/refs/route.ts`
- **Product API client** (update types): `src/domains/product/api-client.ts`
- **ItemRefSelects** (currently shows Vendor/DCC/TaxType dropdowns): `src/components/products/item-ref-selects.tsx`

---

## Workflow the new session should follow

1. **Read this handoff in full**, then read the master spec.
2. **Use the `superpowers:writing-plans` skill** to produce Phase 2's plan doc. Follow Phase 1's structure: one TDD cycle per task with exact file paths, code blocks, and commit messages.
3. **Get Marcos's sign-off on the plan** before dispatching implementers.
4. **Use `superpowers:subagent-driven-development`** to execute: fresh subagent per task, spec-compliance review then code-quality review between tasks.
5. **Ship with `bash ./scripts/ship-check.sh`** (not `npm run ship-check` on Windows), then `gh pr create` directly (bypass publish-pr.sh).
6. **When the PR is open**, add a trailing commit to the handoff doc marking Phase 2 shipped, and write the Phase 3 handoff.

---

## Commit-log cliff notes (for context)

The laportal repo at main (as of 2026-04-19 handoff) has a recently-shipped products workspace redesign (#214), plus 13 ship events in the last ~10 days on the products page. The codebase uses:
- Next.js 14, React 19, TypeScript strict
- Prisma 7 + Supabase Postgres for app state
- NextAuth for auth
- `mssql`/tedious for WinPRISM SQL reads
- Vitest for tests (some snapshots; TDD convention in Phase 1)
- Conventional commits with `Co-Authored-By` trailer (user is `Marcos Montalvo <telenel@users.noreply.github.com>`)

The products page (`/products`) has: 22 presets, saved views, DCC picker, Est-Sales column, stock column, DCC-name columns, keyboard a11y on sort/hide controls, responsive priority-tier column hiding, and a full-bleed layout. Recent work on `fix/products-presets-and-layout` (PR #193) added the sort + hide + full-bleed affordances.

The item-editor currently edits ~14 fields across a flat modal for GM items and a narrow modal for textbooks; Phase 1-8 expand this to full PrismCore parity while keeping Pierce-populated fields prominent.

---

## Ownership

Marcos is the only user / reviewer. CodeRabbit + CI do automated review on PRs. Codex may open follow-up branches with review fixes — merge them with `gh pr merge --auto` per project convention.
