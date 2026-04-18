/**
 * Incremental sales-transaction pull. Called by /api/sync/prism-pull after
 * the product catalog step succeeds. Pulls any Pierce transactions newer
 * than the stored cursor, inserts them, then recomputes the products
 * aggregates.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ConnectionPool } from "mssql";
import { sql } from "@/lib/prism";
import { PIERCE_LOCATION_ID } from "./prism-server";
import { runAggregateRecompute } from "./sales-aggregates";

const INSERT_CHUNK = 1000;

export interface SalesTxnSyncResult {
  txnsAdded: number;
  aggregatesUpdated: number;
  durationMs: number;
  skipped?: "backfill-not-completed";
}

export async function runSalesTxnSync(deps: {
  supabase: SupabaseClient;
  prism: ConnectionPool;
}): Promise<SalesTxnSyncResult> {
  const start = Date.now();
  const { supabase, prism } = deps;

  const { data: state, error: stateErr } = await supabase
    .from("sales_transactions_sync_state")
    .select("last_transaction_id,backfill_completed_at")
    .eq("id", 1)
    .single();
  if (stateErr) throw new Error(`sync_state read failed: ${stateErr.message}`);
  if (!state?.backfill_completed_at) {
    return {
      txnsAdded: 0,
      aggregatesUpdated: 0,
      durationMs: Date.now() - start,
      skipped: "backfill-not-completed",
    };
  }

  const cursor = Number(state.last_transaction_id ?? 0);
  const page = await prism.request()
    .input("loc", sql.Int, PIERCE_LOCATION_ID)
    .input("cursor", sql.BigInt, cursor)
    .query<Record<string, unknown>>(`
      SELECT
        td.TranDtlID, th.TransactionID, td.SKU,
        th.TranTypeID, th.LocationID, th.UserID, th.POSID, th.RegisterID,
        th.ReceiptID, LTRIM(RTRIM(th.TranNumber)) AS TranNumber,
        td.PosLineNumber, td.Qty, td.Price, td.ExtPrice,
        td.DiscountAmt, td.MarkDownAmt, td.TaxAmt,
        LTRIM(RTRIM(td.Description)) AS Description,
        th.fStatus AS HdrFStatus, td.fStatus AS DtlFStatus, th.fInvoiced AS FInvoiced,
        th.TranTotal, th.TaxTotal, th.ProcessDate, th.CreateDate,
        td.CreateDate AS DtlCreateDate
      FROM Transaction_Detail td
      INNER JOIN Transaction_Header th ON th.TransactionID = td.TransactionID
      WHERE th.LocationID = @loc
        AND th.TransactionID > @cursor
      ORDER BY td.TranDtlID
    `);

  const rows = page.recordset;
  if (rows.length === 0) {
    return { txnsAdded: 0, aggregatesUpdated: 0, durationMs: Date.now() - start };
  }

  const mapped = rows.map(toSupabaseRow);
  for (let i = 0; i < mapped.length; i += INSERT_CHUNK) {
    const chunk = mapped.slice(i, i + INSERT_CHUNK);
    const { error: insErr } = await supabase
      .from("sales_transactions")
      .upsert(chunk, { onConflict: "tran_dtl_id", ignoreDuplicates: true });
    if (insErr) throw new Error(`sales_transactions insert failed: ${insErr.message}`);
  }

  let maxTxnId = cursor;
  let maxProcessDate: Date | null = null;
  for (const r of rows) {
    const tid = Number((r as { TransactionID: number | string }).TransactionID);
    if (tid > maxTxnId) maxTxnId = tid;
    const pd = (r as { ProcessDate: Date }).ProcessDate;
    if (!maxProcessDate || pd > maxProcessDate) maxProcessDate = pd;
  }

  const { count: totalRows } = await supabase
    .from("sales_transactions")
    .select("*", { count: "exact", head: true });

  const { error: updErr } = await supabase
    .from("sales_transactions_sync_state")
    .update({
      last_transaction_id: maxTxnId,
      last_process_date: maxProcessDate?.toISOString() ?? null,
      total_rows: totalRows ?? 0,
    })
    .eq("id", 1);
  if (updErr) throw new Error(`sync_state update failed: ${updErr.message}`);

  const aggregatesUpdated = await runAggregateRecompute(supabase);

  return {
    txnsAdded: rows.length,
    aggregatesUpdated,
    durationMs: Date.now() - start,
  };
}

function toSupabaseRow(r: Record<string, unknown>) {
  const cast = r as {
    TranDtlID: number | string; TransactionID: number | string; SKU: number | string;
    TranTypeID: number | null; LocationID: number; UserID: number | null;
    POSID: number | null; RegisterID: number | null; ReceiptID: number | string | null;
    TranNumber: string | null; PosLineNumber: number | null;
    Qty: number | null; Price: number | null; ExtPrice: number | null;
    DiscountAmt: number | null; MarkDownAmt: number | null; TaxAmt: number | null;
    Description: string | null;
    HdrFStatus: number | null; DtlFStatus: number | null; FInvoiced: number | null;
    TranTotal: number | null; TaxTotal: number | null;
    ProcessDate: Date; CreateDate: Date | null; DtlCreateDate: Date | null;
  };
  return {
    tran_dtl_id:     Number(cast.TranDtlID),
    transaction_id:  Number(cast.TransactionID),
    sku:             Number(cast.SKU),
    tran_type_id:    cast.TranTypeID,
    location_id:     cast.LocationID,
    user_id:         cast.UserID,
    pos_id:          cast.POSID,
    register_id:    cast.RegisterID,
    receipt_id:      cast.ReceiptID != null ? Number(cast.ReceiptID) : null,
    tran_number:     cast.TranNumber != null ? cast.TranNumber.trimEnd() : null,
    pos_line_number: cast.PosLineNumber,
    qty:             cast.Qty,
    price:           cast.Price,
    ext_price:       cast.ExtPrice,
    discount_amt:    cast.DiscountAmt,
    markdown_amt:    cast.MarkDownAmt,
    tax_amt:         cast.TaxAmt,
    description:     cast.Description,
    hdr_f_status:    cast.HdrFStatus,
    dtl_f_status:    cast.DtlFStatus,
    f_invoiced:      cast.FInvoiced,
    tran_total:      cast.TranTotal,
    tax_total:       cast.TaxTotal,
    process_date:    cast.ProcessDate.toISOString(),
    create_date:     cast.CreateDate?.toISOString() ?? null,
    dtl_create_date: cast.DtlCreateDate?.toISOString() ?? null,
  };
}
