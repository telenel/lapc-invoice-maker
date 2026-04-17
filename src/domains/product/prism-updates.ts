/**
 * Single-item update functions for Prism. No stored proc exists for item-master
 * updates (only MR/PO/Invoice receiving procs — those are for line items, not
 * the catalog). We run direct UPDATE statements inside a transaction and use
 * the verify-then-assume pattern from deleteTestItem to dodge the Item-table
 * trigger rowcount quirks.
 *
 * Pierce-only by default — Inventory writes target LocationID=2 (PIER).
 */
import { getPrismPool, sql } from "@/lib/prism";
import type { GmItemPatch, TextbookPatch, ItemSnapshot } from "./types";
import { PIERCE_LOCATION_ID } from "./prism-server";

export async function getItemSnapshot(sku: number): Promise<ItemSnapshot | null> {
  const pool = await getPrismPool();
  const result = await pool
    .request()
    .input("sku", sql.Int, sku)
    .input("loc", sql.Int, PIERCE_LOCATION_ID)
    .query<{
      SKU: number;
      BarCode: string | null;
      Retail: number | null;
      Cost: number | null;
      fDiscontinue: number | null;
    }>(`
      SELECT i.SKU,
             LTRIM(RTRIM(i.BarCode)) AS BarCode,
             inv.Retail,
             inv.Cost,
             i.fDiscontinue
      FROM Item i
      LEFT JOIN Inventory inv ON inv.SKU = i.SKU AND inv.LocationID = @loc
      WHERE i.SKU = @sku
    `);

  const row = result.recordset[0];
  if (!row) return null;
  return {
    sku: row.SKU,
    barcode: row.BarCode && row.BarCode.length > 0 ? row.BarCode : null,
    retail: Number(row.Retail ?? 0),
    cost: Number(row.Cost ?? 0),
    fDiscontinue: (row.fDiscontinue === 1 ? 1 : 0) as 0 | 1,
  };
}
