/**
 * Hard-delete support for real (non-test) items. The guard is "no transaction
 * history anywhere." If any sales, PO, receiving, or invoice row references
 * the SKU, the item must be discontinued (soft-deleted) instead.
 *
 * The TEST-CLAUDE-* barcode guard on deleteTestItem stays unchanged — that
 * function is for test scripts only.
 */
import { getPrismPool, sql } from "@/lib/prism";
import { PIERCE_LOCATION_ID } from "./prism-server";

/**
 * Returns the subset of the given SKUs that have at least one transaction
 * history record. SKUs not in the returned set are safe to hard-delete.
 *
 * Candidate history tables (queried independently; missing ones skipped):
 *   - Inventory_Sales_History — POS sales rollup
 *   - Acct_ARInvoiceDetail    — invoice line items
 *   - PO_Detail               — purchase order lines
 *   - Receiving_Detail        — physical receiving lines
 *
 * If ALL candidate tables fail (unknown schema or connection failure), we
 * fail closed and treat every SKU as "has history" to block the delete.
 */
export async function hasTransactionHistory(skus: number[]): Promise<Set<number>> {
  if (skus.length === 0) return new Set();

  const pool = await getPrismPool();

  // Query each history table independently. Tables absent from this Prism
  // deployment are skipped (logged as warn). At least one must succeed for
  // the guard to be meaningful — if ALL fail we still fail closed and return
  // the full input set.
  const candidateTables = [
    "Inventory_Sales_History",
    "Acct_ARInvoiceDetail",
    "PO_Detail",
    "Receiving_Detail",
  ];

  const hits = new Set<number>();
  let anySucceeded = false;

  for (const table of candidateTables) {
    try {
      const request = pool.request();
      const params = skus.map((_, i) => `@sku${i}`);
      skus.forEach((sku, i) => request.input(`sku${i}`, sql.Int, sku));
      const result = await request.query<{ SKU: number }>(
        `SELECT DISTINCT SKU FROM ${table} WHERE SKU IN (${params.join(", ")})`,
      );
      for (const row of result.recordset) hits.add(row.SKU);
      anySucceeded = true;
    } catch (err) {
      // Missing table or permission issue — skip. Logged once so operators
      // can notice schema drift, but don't let it poison the check.
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("Invalid object name")) {
        console.warn(`[hasTransactionHistory] ${table} check failed:`, msg);
      }
    }
  }

  if (!anySucceeded) {
    console.warn("[hasTransactionHistory] all history tables failed — failing closed");
    return new Set(skus);
  }

  return hits;
}

/**
 * Hard-delete a real (non-test) item. Requires the SKU to have zero
 * transaction history. Returns the SKU on success. Transaction-wrapped.
 * Uses the verify-then-assume pattern from deleteTestItem because Item
 * triggers clobber @@ROWCOUNT.
 */
export async function hardDeleteItem(sku: number): Promise<{ sku: number; affected: number }> {
  const history = await hasTransactionHistory([sku]);
  if (history.has(sku)) {
    const err = new Error(`SKU ${sku} has transaction history and cannot be hard-deleted`) as Error & { code: string };
    err.code = "HAS_HISTORY";
    throw err;
  }

  const pool = await getPrismPool();
  const transaction = pool.transaction();
  await transaction.begin();

  try {
    // Verify the row exists before deleting (same reasoning as deleteTestItem —
    // triggers on Item make rowcount unreliable, so we check presence first).
    const check = await transaction
      .request()
      .input("sku", sql.Int, sku)
      .query<{ SKU: number }>("SELECT SKU FROM Item WHERE SKU = @sku");
    if (check.recordset.length === 0) {
      throw new Error(`Item SKU ${sku} not found`);
    }

    await transaction.request().input("sku", sql.Int, sku)
      .query("DELETE FROM Inventory WHERE SKU = @sku");
    await transaction.request().input("sku", sql.Int, sku)
      .query("DELETE FROM GeneralMerchandise WHERE SKU = @sku");
    await transaction.request().input("sku", sql.Int, sku)
      .query("DELETE FROM Item WHERE SKU = @sku");

    await transaction.commit();
    return { sku, affected: 1 };
  } catch (err) {
    try { await transaction.rollback(); } catch { /* swallow */ }
    throw err;
  }
}
