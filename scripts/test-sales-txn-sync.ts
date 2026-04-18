/**
 * Smoke test: runs runSalesTxnSync against live Prism + live Supabase,
 * compares Prism-side "rows with TransactionID > cursor" to the Supabase delta.
 *
 * Safe to run anytime after backfill — it only inserts new rows.
 *
 * Usage:  npx tsx scripts/test-sales-txn-sync.ts
 */
import { config as loadEnv } from "dotenv";
import path from "path";
loadEnv({ path: path.resolve(process.cwd(), ".env.local") });
loadEnv({ path: path.resolve(process.cwd(), ".env") });

import { getPrismPool, sql } from "@/lib/prism";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { PIERCE_LOCATION_ID } from "@/domains/product/prism-server";
import { runSalesTxnSync } from "@/domains/product/sales-txn-sync";

async function main() {
  const pool = await getPrismPool();
  const supabase = getSupabaseAdminClient();

  const { data: state } = await supabase
    .from("sales_transactions_sync_state")
    .select("last_transaction_id,backfill_completed_at")
    .eq("id", 1)
    .single();
  if (!state?.backfill_completed_at) {
    throw new Error("Backfill has not completed. Run backfill-prism-transactions.ts first.");
  }
  const cursor = Number(state.last_transaction_id);

  const preflight = await pool.request()
    .input("loc", sql.Int, PIERCE_LOCATION_ID)
    .input("cursor", sql.BigInt, cursor)
    .query<{ ExpectedRows: number }>(`
      SELECT COUNT(*) AS ExpectedRows
      FROM Transaction_Detail td
      INNER JOIN Transaction_Header th ON th.TransactionID = td.TransactionID
      WHERE th.LocationID = @loc AND th.TransactionID > @cursor
    `);
  const expected = preflight.recordset[0]?.ExpectedRows ?? 0;
  console.log(`Expected new rows from Prism (TransactionID > ${cursor}): ${expected.toLocaleString()}`);

  const result = await runSalesTxnSync({ supabase, prism: pool });
  console.log(`runSalesTxnSync returned:`, result);

  if (result.txnsAdded !== expected) {
    console.error(`MISMATCH: inserted ${result.txnsAdded}, expected ${expected}`);
    process.exit(1);
  }
  console.log("OK.");
}

main().catch((e) => { console.error(e); process.exit(1); });
