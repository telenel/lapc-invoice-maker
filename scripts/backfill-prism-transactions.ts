/**
 * One-time backfill: pulls 3 years of Pierce POS transaction lines from Prism
 * into Supabase `sales_transactions`, then runs the aggregate recompute.
 *
 * Idempotent guard: exits early if backfill_completed_at is already set.
 * Safe to re-run after a partial failure because of ON CONFLICT on tran_dtl_id.
 *
 * Usage:
 *   npx tsx scripts/backfill-prism-transactions.ts
 *   npx tsx scripts/backfill-prism-transactions.ts --force  (bypass idempotency)
 *
 * Prerequisites:
 *   - Prism tunnel is up (campus Windows or SSH bridge).
 *   - SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are in .env / .env.local.
 *   - The Phase A migration has been applied.
 */
import { config as loadEnv } from "dotenv";
import path from "path";
loadEnv({ path: path.resolve(process.cwd(), ".env.local") });
loadEnv({ path: path.resolve(process.cwd(), ".env") });

import { getPrismPool, sql, isPrismConfigured } from "@/lib/prism";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { PIERCE_LOCATION_ID } from "@/domains/product/prism-server";
import { runAggregateRecompute } from "@/domains/product/sales-aggregates";

const PAGE_SIZE = 5000;
const INSERT_CHUNK = 1000;
const YEARS_BACK = 3;

interface PrismTxnRow {
  TranDtlID: number | string;
  TransactionID: number | string;
  SKU: number | string;
  TranTypeID: number | null;
  LocationID: number;
  UserID: number | null;
  POSID: number | null;
  RegisterID: number | null;
  ReceiptID: number | string | null;
  TranNumber: number | null;
  PosLineNumber: number | null;
  Qty: number | null;
  Price: number | null;
  ExtPrice: number | null;
  DiscountAmt: number | null;
  MarkDownAmt: number | null;
  TaxAmt: number | null;
  Description: string | null;
  HdrFStatus: number | null;
  DtlFStatus: number | null;
  FInvoiced: number | null;
  TranTotal: number | null;
  TaxTotal: number | null;
  ProcessDate: Date;
  CreateDate: Date | null;
  DtlCreateDate: Date | null;
}

const PRISM_TXN_SELECT = `
  SELECT TOP (@pageSize)
    td.TranDtlID,
    th.TransactionID,
    td.SKU,
    th.TranTypeID,
    th.LocationID,
    th.UserID,
    th.POSID,
    th.RegisterID,
    th.ReceiptID,
    th.TranNumber,
    td.PosLineNumber,
    td.Qty,
    td.Price,
    td.ExtPrice,
    td.DiscountAmt,
    td.MarkDownAmt,
    td.TaxAmt,
    LTRIM(RTRIM(td.Description)) AS Description,
    th.fStatus   AS HdrFStatus,
    td.fStatus   AS DtlFStatus,
    th.fInvoiced AS FInvoiced,
    th.TranTotal,
    th.TaxTotal,
    th.ProcessDate,
    th.CreateDate,
    td.CreateDate AS DtlCreateDate
  FROM Transaction_Detail td
  INNER JOIN Transaction_Header th ON th.TransactionID = td.TransactionID
  WHERE th.LocationID = @loc
    AND th.ProcessDate >= DATEADD(year, -@years, GETDATE())
    AND td.TranDtlID > @cursor
  ORDER BY td.TranDtlID
`;

function toSupabaseRow(r: PrismTxnRow) {
  return {
    tran_dtl_id:      Number(r.TranDtlID),
    transaction_id:   Number(r.TransactionID),
    sku:              Number(r.SKU),
    tran_type_id:     r.TranTypeID,
    location_id:      r.LocationID,
    user_id:          r.UserID,
    pos_id:           r.POSID,
    register_id:      r.RegisterID,
    receipt_id:       r.ReceiptID != null ? Number(r.ReceiptID) : null,
    tran_number:      r.TranNumber,
    pos_line_number:  r.PosLineNumber,
    qty:              r.Qty,
    price:            r.Price,
    ext_price:        r.ExtPrice,
    discount_amt:     r.DiscountAmt,
    markdown_amt:     r.MarkDownAmt,
    tax_amt:          r.TaxAmt,
    description:      r.Description,
    hdr_f_status:     r.HdrFStatus,
    dtl_f_status:     r.DtlFStatus,
    f_invoiced:       r.FInvoiced,
    tran_total:       r.TranTotal,
    tax_total:        r.TaxTotal,
    process_date:     r.ProcessDate.toISOString(),
    create_date:      r.CreateDate?.toISOString() ?? null,
    dtl_create_date:  r.DtlCreateDate?.toISOString() ?? null,
  };
}

async function main() {
  const force = process.argv.includes("--force");
  if (!isPrismConfigured()) {
    throw new Error("Prism is not configured. Set PRISM_SERVER / PRISM_USER / PRISM_PASSWORD.");
  }

  const supabase = getSupabaseAdminClient();

  const { data: state, error: stateErr } = await supabase
    .from("sales_transactions_sync_state")
    .select("backfill_completed_at,last_transaction_id,total_rows")
    .eq("id", 1)
    .single();
  if (stateErr) throw new Error(`sync_state read failed: ${stateErr.message}`);
  if (state?.backfill_completed_at && !force) {
    console.log(`Backfill already completed at ${state.backfill_completed_at}. Use --force to re-run.`);
    console.log(`Current: last_transaction_id=${state.last_transaction_id}, total_rows=${state.total_rows}`);
    process.exit(0);
  }

  console.log("=== Pierce transaction backfill starting ===");
  console.log(`LocationID=${PIERCE_LOCATION_ID}, years_back=${YEARS_BACK}, page_size=${PAGE_SIZE}`);

  const started = Date.now();
  const pool = await getPrismPool();

  const preflight = await pool.request()
    .input("loc", sql.Int, PIERCE_LOCATION_ID)
    .input("years", sql.Int, YEARS_BACK)
    .query<{ ExpectedRows: number }>(`
      SELECT COUNT(*) AS ExpectedRows
      FROM Transaction_Detail td
      INNER JOIN Transaction_Header th ON th.TransactionID = td.TransactionID
      WHERE th.LocationID = @loc
        AND th.ProcessDate >= DATEADD(year, -@years, GETDATE())
    `);
  const expected = preflight.recordset[0]?.ExpectedRows ?? 0;
  console.log(`Pre-flight: ${expected.toLocaleString()} rows expected from Prism.`);

  let cursor = 0;
  let totalInserted = 0;
  let maxTransactionId = Number(state?.last_transaction_id ?? 0);
  let maxProcessDate: Date | null = null;

  while (true) {
    const page = await pool.request()
      .input("loc", sql.Int, PIERCE_LOCATION_ID)
      .input("years", sql.Int, YEARS_BACK)
      .input("cursor", sql.BigInt, cursor)
      .input("pageSize", sql.Int, PAGE_SIZE)
      .query<PrismTxnRow>(PRISM_TXN_SELECT);

    if (page.recordset.length === 0) break;

    const rows = page.recordset.map(toSupabaseRow);
    for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
      const chunk = rows.slice(i, i + INSERT_CHUNK);
      const { error: insErr } = await supabase
        .from("sales_transactions")
        .upsert(chunk, { onConflict: "tran_dtl_id", ignoreDuplicates: true });
      if (insErr) throw new Error(`Supabase insert failed: ${insErr.message}`);
    }
    totalInserted += rows.length;

    const lastRow = page.recordset[page.recordset.length - 1];
    cursor = Number(lastRow.TranDtlID);
    maxTransactionId = Math.max(maxTransactionId, Number(lastRow.TransactionID));
    maxProcessDate = lastRow.ProcessDate;

    const pct = expected > 0 ? ((totalInserted / expected) * 100).toFixed(1) : "?";
    console.log(`  progress: ${totalInserted.toLocaleString()} / ${expected.toLocaleString()} (${pct}%) — last TranDtlID=${cursor}`);

    if (page.recordset.length < PAGE_SIZE) break;
  }

  const { count: finalCount, error: countErr } = await supabase
    .from("sales_transactions")
    .select("*", { count: "exact", head: true });
  if (countErr) throw new Error(`Supabase count failed: ${countErr.message}`);
  console.log(`Supabase sales_transactions now has ${finalCount?.toLocaleString() ?? "?"} rows.`);

  const { error: updErr } = await supabase
    .from("sales_transactions_sync_state")
    .update({
      backfill_completed_at: new Date().toISOString(),
      last_transaction_id: maxTransactionId,
      last_process_date: maxProcessDate?.toISOString() ?? null,
      total_rows: finalCount ?? 0,
    })
    .eq("id", 1);
  if (updErr) throw new Error(`sync_state update failed: ${updErr.message}`);

  console.log("Running aggregate recompute...");
  const recStart = Date.now();
  const affected = await runAggregateRecompute(supabase);
  console.log(`Recompute touched ${affected.toLocaleString()} products in ${Date.now() - recStart}ms.`);

  console.log(`=== Done. Total elapsed: ${((Date.now() - started) / 1000).toFixed(1)}s ===`);
}

main().catch((e) => { console.error(e); process.exit(1); });
