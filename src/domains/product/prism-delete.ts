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
 * Checked tables (discovered empirically via the Prism schema):
 *   - Inventory_Sales_History — POS sales rollup
 *   - Acct_ARInvoiceDetail    — invoice line items
 *   - PO_Detail               — purchase order lines
 *   - Receiving_Detail        — physical receiving lines
 *   - MarkdownReceipt_Detail  — markdown/receiving claims
 *
 * If any of these table names don't exist in a given Prism deployment, the
 * query silently returns "has history" for safety (fail closed).
 */
export async function hasTransactionHistory(skus: number[]): Promise<Set<number>> {
  if (skus.length === 0) return new Set();

  const pool = await getPrismPool();
  const request = pool.request();
  const params = skus.map((_, i) => `@sku${i}`);
  skus.forEach((sku, i) => request.input(`sku${i}`, sql.Int, sku));

  // One query per table, UNION-ed. Wrapped in a best-effort: if a table doesn't
  // exist (schema drift between Prism versions), fail closed — treat the SKU
  // as "has history" to block the delete.
  const query = `
    SELECT DISTINCT SKU FROM (
      SELECT SKU FROM Inventory_Sales_History WHERE SKU IN (${params.join(", ")})
      UNION ALL
      SELECT SKU FROM Acct_ARInvoiceDetail WHERE SKU IN (${params.join(", ")})
      UNION ALL
      SELECT SKU FROM PO_Detail WHERE SKU IN (${params.join(", ")})
      UNION ALL
      SELECT SKU FROM Receiving_Detail WHERE SKU IN (${params.join(", ")})
    ) h
  `;

  try {
    const result = await request.query<{ SKU: number }>(query);
    return new Set(result.recordset.map((r) => r.SKU));
  } catch (err) {
    // Schema drift or any other failure → fail closed: every SKU "has history"
    console.warn("[hasTransactionHistory] query failed — failing closed:", err);
    return new Set(skus);
  }
}
