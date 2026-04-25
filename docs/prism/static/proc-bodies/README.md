# Recovered Prism stored-procedure bodies

These `.sql` files are the recovered bodies of WinPRISM stored procedures, reconstructed from the SQL Server plan cache (`sys.dm_exec_query_stats` + `sys.dm_exec_sql_text`). The `pdt` login lacks `VIEW DEFINITION` on Prism, so neither `OBJECT_DEFINITION()` nor `sys.sql_modules` returns the source — but the plan cache stores executed statements indexed by their containing object, which means we can recover proc bodies statement-by-statement after they've been called.

## How these were captured

```bash
npx tsx scripts/prism-probe-proc-body.ts <proc-name> [<proc-name> ...]
```

The script writes a deduplicated, offset-ordered stitching of every cached statement whose `containing_object` matches the requested proc names. Output lands in `tmp/prism-proc-body-<proc>-<timestamp>.sql`; copy the relevant ones into this folder for durable storage.

See [`../plan-cache-method.md`](../plan-cache-method.md) for the full methodology.

## What's in this folder

| File | Description |
|---|---|
| `P_Item_Add_GM.sql` | Adds an Item + GeneralMerchandise row pair. Called by laportal `createGmItem` and by WPAdmin's Item Maintenance "Add" button. |
| `SP_ARCreateInvoiceHdr.sql` | The canonical "promote a receipt to an AR invoice" entrypoint. Called ~10,000+ times per day at Pierce — every receipt with a non-zero AR-account tender hits this. Inserts into `Acct_ARInvoice_Header` + `Acct_ARInvoice_Tender`. |
| `SP_ARCreateInvoiceDtl.sql` | Companion: copies a single transaction-detail line into `Acct_ARInvoice_Detail`. Called once per (receipt, line) pair. |
| `SP_ARCreateMOTran.sql` | The mail-order / special-order receipt-create proc on the POS side. Originates the Transaction that the Hdr/Dtl procs later promote. |
| `SP_ARAutogenInvoices.sql` | Batch invoice generator — the proc behind WPAdmin's "Generate Invoices" button. Inlines all of its work (does NOT delegate to `SP_ARCreateInvoiceHdr`/`Dtl`). |

## Caveats and limits

1. **Plan cache is volatile.** Statements get evicted under memory pressure or after the server restarts. If a proc has rarely-executed branches, those statements may not be cached at the moment of capture.
2. **Re-run after eviction to fill gaps.** If a proc's recovered body has obvious gaps (e.g. a cursor `DECLARE` with no matching `FETCH`), re-run the probe after exercising the proc — the missing statements will materialize in the cache.
3. **Comments are stripped.** Plan-cached SQL preserves `--` line comments, but block comments (`/* ... */`) and any logic the optimizer rewrote are not exact source.
4. **Multi-line statements may show with whitespace normalized.** The SQL is functionally identical to the proc body but may not match the original character-for-character.
5. **Order is by statement_start_offset.** This is the byte offset into the proc body, so the order is the same as the source — but if a statement is repeated at multiple offsets (e.g. inside a loop), only the unique text shows once.

## When to re-capture

- After Prism is upgraded (procs may be replaced).
- After a SQL Server restart (cache is cold; wait until procs have been exercised).
- When a proc's `modify_date` (visible via `sys.objects`) is newer than a captured `.sql` file.
