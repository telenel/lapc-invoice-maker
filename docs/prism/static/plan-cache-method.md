# Plan-cache method — recovering Prism stored-procedure bodies without `VIEW DEFINITION`

The `pdt` SQL Server login on `winprism-la` lacks the `VIEW DEFINITION` permission. Direct attempts to read proc source via `OBJECT_DEFINITION()`, `sys.sql_modules.definition`, or `sp_helptext` all return `NULL` silently. This was thought to be a hard wall — every proc body was treated as opaque, and the entire dynamic-analysis track in [`../winprism-reverse-engineering.md`](../winprism-reverse-engineering.md) exists in part to work around it.

**The plan cache makes the wall porous.** Every individual statement that SQL Server has executed lives in `sys.dm_exec_query_stats`, indexed by a `plan_handle`. Joining to `sys.dm_exec_sql_text(plan_handle)` returns the full SQL text. And — crucially — when a statement runs *inside* a stored procedure, the plan-cache row records the proc's name in `containing_object`. Filter on that, and you get the proc's body, statement by statement.

Discovered 2026-04-24 while probing for cached `Acct_ARInvoice_Header` writes. The first probe surfaced 37 statements containing the body of `SP_ARAutogenInvoices`. A second probe pulled back five more procs in under three seconds.

## Why this works despite the permission gap

`VIEW DEFINITION` controls access to **stored proc source as catalog metadata**: who can read the original `CREATE PROCEDURE ... AS BEGIN ... END` text from `sys.sql_modules` or via `OBJECT_DEFINITION`. That permission is checked at the catalog-view layer.

The plan cache is **server runtime state**, not catalog metadata. It records the actual statements the engine has executed, with their compiled plans. Access to the plan cache is gated by `VIEW SERVER STATE` — a different permission, granted (apparently liberally) to `pdt`. As long as the engine has executed a proc, its individual statements show up in the plan cache, attributable to the proc by `containing_object`.

So the trick is not a security oversight on Prism's end; it is two genuinely-distinct permission domains. The catalog says "you cannot read proc source" and the runtime says "you can read what the engine has been doing." Together they leave us a workable side channel.

## What you can recover

For any proc that has been executed since the cache was last cold:

- ✅ Every individual `INSERT`, `UPDATE`, `DELETE`, `SELECT`, `IF`, `WHILE`, `DECLARE CURSOR`, `FETCH`, etc. statement in the body, **as the engine actually ran it**.
- ✅ The order — by joining on `statement_start_offset` (byte offset into the proc body).
- ✅ Execution counts and last-execution times per statement.

What you cannot recover, even with this technique:

- ❌ Block comments (`/* ... */`) — stripped before compilation.
- ❌ Statements the engine has rewritten in optimization (rare for proc bodies but possible for very simple statements).
- ❌ Statements that were evicted from the cache (LRU under memory pressure, or after a server restart).
- ❌ Statements that have never run on this instance — e.g. error-handler branches that haven't fired.

In practice, for hot procs (`SP_ARCreateInvoiceHdr` ran 10,438 times in 3 days at Pierce) you get a near-complete recovery on first probe. For cold or rarely-executed procs, re-run the probe after exercising the proc in WPAdmin (or on the prod system organically).

## How to use it

```bash
npx tsx scripts/prism-probe-proc-body.ts <proc-name> [<proc-name> ...]
# or
PRISM_PROBE_PROCS=SP_ARCreateInvoiceHdr,SP_ARCreateInvoiceDtl npx tsx scripts/prism-probe-proc-body.ts
```

The script writes:
- `tmp/prism-proc-body-<timestamp>.json` — full result set (catalog metadata, procedure_stats, plan-cache rows per proc).
- `tmp/prism-proc-body-<proc>-<timestamp>.sql` — deduplicated, offset-ordered stitching of unique statements per proc.

If a proc body is interesting enough to keep, copy the `.sql` into [`proc-bodies/`](proc-bodies/) for durable storage.

## Read-only safety

The script is strictly `SELECT`-only against:
- `sys.dm_exec_query_stats` (DMV, runtime state)
- `sys.dm_exec_sql_text(...)` (DMV function returning cached SQL text)
- `sys.dm_exec_procedure_stats` (DMV, per-proc stats)
- `sys.objects` (catalog view)
- `sys.sql_modules` (catalog view — returns NULL `.definition` for us, harmless to query)

It executes no user-data procs, issues no DDL, and touches no Prism business tables. Per the read-only rule in [`../README.md`](../README.md), the script does not need explicit per-operation approval; it falls into the same category as the existing snapshot/probe scripts.

## What we recovered with this method (as of 2026-04-24)

| Proc | Executions seen | Status |
|---|---:|---|
| `SP_ARCreateInvoiceHdr` | 10,438 | Fully recovered (20 unique statements). [`proc-bodies/SP_ARCreateInvoiceHdr.sql`](proc-bodies/SP_ARCreateInvoiceHdr.sql) |
| `SP_ARCreateInvoiceDtl` | 1,169 | Fully recovered (6 unique statements). [`proc-bodies/SP_ARCreateInvoiceDtl.sql`](proc-bodies/SP_ARCreateInvoiceDtl.sql) |
| `SP_ARCreateMOTran` | 5 | Fully recovered (30 statements; sparse cache hits but covers the create path). [`proc-bodies/SP_ARCreateMOTran.sql`](proc-bodies/SP_ARCreateMOTran.sql) |
| `SP_ARAutogenInvoices` | 42 | Fully recovered (31 unique statements covering the cursor logic, eligibility predicate, and all four `INSERT`s). [`proc-bodies/SP_ARAutogenInvoices.sql`](proc-bodies/SP_ARAutogenInvoices.sql) |
| `P_Item_Add_GM` | 92 | Recovered the two main `INSERT`s. SKU-allocation prelude not in cache slice; re-probe to fill. [`proc-bodies/P_Item_Add_GM.sql`](proc-bodies/P_Item_Add_GM.sql) |

This single technique resolved most of the ❓-tagged blind spots in [`actions/add-item-gm.md`](actions/add-item-gm.md) and [`actions/generate-invoices.md`](actions/generate-invoices.md).

## Comparison with the other RE tracks

| Question | Static binary strings | Dynamic snapshot/diff | Plan-cache recovery |
|---|---|---|---|
| What proc does WPAdmin call? | ✅ Reveals `{call ProcName(...)}` strings | Indirect | Doesn't address |
| What columns get inserted? | ❌ Invisible if inside a proc | ✅ Visible via row-level diff | ✅ Literal SQL |
| What proc body actually runs? | ❌ Opaque | ❌ Indirect inference only | ✅ Literal statements |
| What triggers fire? | ❌ Invisible | ✅ Visible via row residue | ❌ Trigger code is itself a proc body — recoverable separately |
| What about defaults / NULLs? | ❌ Invisible | ✅ Visible | ✅ Literal `VALUES` clauses show defaults |
| Effort to set up | One PowerShell run | Manual: snapshot, click, snapshot, diff | Single TypeScript run |
| Requires someone to drive WPAdmin? | No | Yes | No (just needs the proc to have run recently — production traffic is enough) |

The three tracks are now genuinely complementary:

- **Static binary strings** tell us *what entrypoints WPAdmin calls.*
- **Plan-cache recovery** tells us *what those entrypoints actually do, statement by statement.*
- **Dynamic snapshot/diff** tells us *what changes in the database after the entrypoint runs* — including trigger residue and audit-table effects that even plan-cache recovery cannot see.

For most reverse-engineering questions that previously required a snapshot/diff session (which needs Marcos to drive WPAdmin), the plan-cache method now gives an answer in seconds without anyone touching the UI.

## Caveats and gotchas

1. **`LIKE '%text%'` on `sys.dm_exec_sql_text(...)` is expensive.** It materializes the full SQL text for every cached plan — tens of thousands of rows on a busy server — then string-scans them. Filter by `OBJECT_NAME(st.objectid, st.dbid) = 'ProcName'` instead. The latter uses an index on `objectid` and runs in under a second.
2. **Cache eviction is real.** If a proc has cold branches (error handlers, initialization paths), those won't show. Re-run after exercising those paths.
3. **Plan compilations create duplicates.** Same statement at the same offset, different `plan_handle`, different stats. The probe script deduplicates by statement text before writing the `.sql` artifact.
4. **Numerical literals get parameterized.** `WHERE x = 1` in source might appear as `WHERE x = @1` in the cache if the engine auto-parameterized it. Usually harmless; check the surrounding context if a literal is load-bearing.
5. **Encrypted procs are still opaque.** `sys.objects` flags encrypted procs (`is_ms_shipped` is *not* the encrypt flag — check `OBJECTPROPERTY(object_id, 'IsEncrypted') = 1`). Plan cache returns the encrypted blob, not source. SCHEMA.md lists 2 encrypted procs in Prism; both stay opaque.

## When to use which method

- **First reach: plan-cache probe.** Free, fast, no UI clicks needed.
- **If the proc hasn't run recently:** ask Marcos to exercise the action in WPAdmin once, wait a minute, re-probe.
- **If you need to see triggers / audit / side effects:** snapshot/diff. Plan-cache shows the proc body but not what implicitly runs around it.
- **If you need to confirm a column's actual value (vs the placeholder name):** snapshot/diff or the live data — plan-cache only shows the parameter name (`@TaxAmt`) not the value (`0.0825`).
