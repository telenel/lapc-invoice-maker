import type { SupabaseClient } from "@supabase/supabase-js";
import type { ConnectionPool } from "mssql";
import { sql } from "@/lib/prism";
import { getBackfillPageProgress } from "./backfill-progress";
import { PIERCE_LOCATION_ID } from "./prism-server";
import { runAggregateRecompute } from "./sales-aggregates";

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
  TranNumber: string | null;
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
    LTRIM(RTRIM(th.TranNumber)) AS TranNumber,
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

export interface SalesTxnBackfillResult {
  totalInserted: number;
  aggregatesUpdated: number;
  durationMs: number;
}

export async function runSalesTxnBackfill(deps: {
  force?: boolean;
  supabase: SupabaseClient;
  prism: ConnectionPool;
  log?: (message: string) => void;
  now?: () => Date;
  recompute?: () => Promise<number>;
}): Promise<SalesTxnBackfillResult> {
  const {
    force = false,
    supabase,
    prism,
    log = console.log,
    now = () => new Date(),
    recompute = runAggregateRecompute,
  } = deps;

  const started = Date.now();

  const { data: state, error: stateErr } = await supabase
    .from("sales_transactions_sync_state")
    .select("backfill_completed_at,last_transaction_id,total_rows")
    .eq("id", 1)
    .single();
  if (stateErr) throw new Error(`sync_state read failed: ${stateErr.message}`);
  if (state?.backfill_completed_at && !force) {
    log(`Backfill already completed at ${state.backfill_completed_at}. Use --force to re-run.`);
    log(`Current: last_transaction_id=${state.last_transaction_id}, total_rows=${state.total_rows}`);
    return {
      totalInserted: 0,
      aggregatesUpdated: 0,
      durationMs: Date.now() - started,
    };
  }

  log("=== Pierce transaction backfill starting ===");
  log(`LocationID=${PIERCE_LOCATION_ID}, years_back=${YEARS_BACK}, page_size=${PAGE_SIZE}`);

  const preflight = await prism.request()
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
  log(`Pre-flight: ${expected.toLocaleString()} rows expected from Prism.`);

  let cursor = 0;
  let totalInserted = 0;
  let maxTransactionId = Number(state?.last_transaction_id ?? 0);
  let maxProcessDate: Date | null = null;

  while (true) {
    const page = await prism.request()
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

    const progress = getBackfillPageProgress(page.recordset, maxTransactionId);
    cursor = progress.nextCursor;
    maxTransactionId = progress.maxTransactionId;
    maxProcessDate = progress.maxProcessDate;

    const pct = expected > 0 ? ((totalInserted / expected) * 100).toFixed(1) : "?";
    log(`  progress: ${totalInserted.toLocaleString()} / ${expected.toLocaleString()} (${pct}%) — last TranDtlID=${cursor}`);

    if (page.recordset.length < PAGE_SIZE) break;
  }

  const { count: finalCount, error: countErr } = await supabase
    .from("sales_transactions")
    .select("*", { count: "exact", head: true });
  if (countErr) throw new Error(`Supabase count failed: ${countErr.message}`);
  log(`Supabase sales_transactions now has ${finalCount?.toLocaleString() ?? "?"} rows.`);

  const { error: progressErr } = await supabase
    .from("sales_transactions_sync_state")
    .update({
      last_transaction_id: maxTransactionId,
      last_process_date: maxProcessDate?.toISOString() ?? null,
      total_rows: finalCount ?? 0,
    })
    .eq("id", 1);
  if (progressErr) throw new Error(`sync_state progress update failed: ${progressErr.message}`);

  log("Running aggregate recompute...");
  const recStart = Date.now();
  const aggregatesUpdated = await recompute();
  log(`Recompute touched ${aggregatesUpdated.toLocaleString()} products in ${Date.now() - recStart}ms.`);

  const { error: completedErr } = await supabase
    .from("sales_transactions_sync_state")
    .update({
      backfill_completed_at: now().toISOString(),
    })
    .eq("id", 1);
  if (completedErr) throw new Error(`sync_state completion update failed: ${completedErr.message}`);

  log(`=== Done. Total elapsed: ${((Date.now() - started) / 1000).toFixed(1)}s ===`);

  return {
    totalInserted,
    aggregatesUpdated,
    durationMs: Date.now() - started,
  };
}

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
    tran_number:      r.TranNumber != null ? r.TranNumber.trimEnd() : null,
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
