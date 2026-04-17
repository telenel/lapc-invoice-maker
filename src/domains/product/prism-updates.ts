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

interface UpdateGmItemResult {
  sku: number;
  appliedFields: string[];
}

/**
 * Update a GM item. Only fields present in `patch` are written. Runs in a
 * transaction. Uses the verify-then-assume pattern from deleteTestItem:
 * we SELECT the row first to confirm it exists (giving us a pre-image),
 * then run the UPDATEs. Item triggers break @@ROWCOUNT, so if the
 * transaction commits we assume the update landed.
 */
export async function updateGmItem(
  sku: number,
  patch: GmItemPatch,
  expectedSnapshot?: ItemSnapshot,
): Promise<UpdateGmItemResult> {
  const pool = await getPrismPool();
  const transaction = pool.transaction();
  await transaction.begin();

  try {
    // Verify row exists + optional concurrency check
    const check = await transaction
      .request()
      .input("sku", sql.Int, sku)
      .input("loc", sql.Int, PIERCE_LOCATION_ID)
      .query<{
        BarCode: string | null;
        Retail: number | null;
        Cost: number | null;
        fDiscontinue: number | null;
      }>(`
        SELECT LTRIM(RTRIM(i.BarCode)) AS BarCode,
               inv.Retail, inv.Cost, i.fDiscontinue
        FROM Item i
        LEFT JOIN Inventory inv ON inv.SKU = i.SKU AND inv.LocationID = @loc
        WHERE i.SKU = @sku
      `);
    const current = check.recordset[0];
    if (!current) {
      throw new Error(`Item SKU ${sku} not found`);
    }

    if (expectedSnapshot) {
      const currentBarcode = current.BarCode && current.BarCode.length > 0 ? current.BarCode : null;
      const currentRetail = Number(current.Retail ?? 0);
      const currentCost = Number(current.Cost ?? 0);
      const currentFDisc = (current.fDiscontinue === 1 ? 1 : 0) as 0 | 1;
      if (
        currentBarcode !== expectedSnapshot.barcode ||
        currentRetail !== expectedSnapshot.retail ||
        currentCost !== expectedSnapshot.cost ||
        currentFDisc !== expectedSnapshot.fDiscontinue
      ) {
        const err = new Error("CONCURRENT_MODIFICATION") as Error & { code: string; current: ItemSnapshot };
        err.code = "CONCURRENT_MODIFICATION";
        err.current = {
          sku,
          barcode: currentBarcode,
          retail: currentRetail,
          cost: currentCost,
          fDiscontinue: currentFDisc,
        };
        throw err;
      }
    }

    const applied: string[] = [];
    const itemSet: string[] = [];
    const gmSet: string[] = [];
    const invSet: string[] = [];
    const req = transaction.request().input("sku", sql.Int, sku).input("loc", sql.Int, PIERCE_LOCATION_ID);

    if (patch.barcode !== undefined) {
      req.input("barcode", sql.VarChar(20), patch.barcode ?? "");
      itemSet.push("BarCode = @barcode");
      applied.push("barcode");
    }
    if (patch.vendorId !== undefined) {
      req.input("vendorId", sql.Int, patch.vendorId);
      itemSet.push("VendorID = @vendorId");
      applied.push("vendorId");
    }
    if (patch.dccId !== undefined) {
      req.input("dccId", sql.Int, patch.dccId);
      itemSet.push("DCCID = @dccId");
      applied.push("dccId");
    }
    if (patch.itemTaxTypeId !== undefined) {
      req.input("taxId", sql.Int, patch.itemTaxTypeId);
      itemSet.push("ItemTaxTypeID = @taxId");
      applied.push("itemTaxTypeId");
    }
    if (patch.comment !== undefined) {
      req.input("comment", sql.VarChar(25), patch.comment ?? "");
      itemSet.push("txComment = @comment");
      applied.push("comment");
    }
    if (patch.weight !== undefined) {
      req.input("weight", sql.Decimal(9, 4), patch.weight);
      itemSet.push("Weight = @weight");
      applied.push("weight");
    }
    if (patch.fDiscontinue !== undefined) {
      req.input("fDiscontinue", sql.TinyInt, patch.fDiscontinue);
      itemSet.push("fDiscontinue = @fDiscontinue");
      applied.push("fDiscontinue");
    }

    if (patch.description !== undefined) {
      req.input("description", sql.VarChar(128), patch.description);
      gmSet.push("Description = @description");
      applied.push("description");
    }
    if (patch.catalogNumber !== undefined) {
      req.input("catalogNumber", sql.VarChar(30), patch.catalogNumber ?? "");
      gmSet.push("CatalogNumber = @catalogNumber");
      applied.push("catalogNumber");
    }
    if (patch.packageType !== undefined) {
      req.input("packageType", sql.VarChar(3), patch.packageType ?? "");
      gmSet.push("PackageType = @packageType");
      applied.push("packageType");
    }
    if (patch.unitsPerPack !== undefined) {
      req.input("unitsPerPack", sql.SmallInt, patch.unitsPerPack);
      gmSet.push("UnitsPerPack = @unitsPerPack");
      applied.push("unitsPerPack");
    }
    if (patch.imageUrl !== undefined) {
      req.input("imageUrl", sql.VarChar(128), patch.imageUrl ?? "");
      gmSet.push("ImageURL = @imageUrl");
      applied.push("imageUrl");
    }

    if (patch.retail !== undefined) {
      req.input("retail", sql.Money, patch.retail);
      invSet.push("Retail = @retail");
      applied.push("retail");
    }
    if (patch.cost !== undefined) {
      req.input("cost", sql.Money, patch.cost);
      invSet.push("Cost = @cost");
      applied.push("cost");
    }

    if (itemSet.length > 0) {
      await req.query(`UPDATE Item SET ${itemSet.join(", ")} WHERE SKU = @sku`);
    }
    if (gmSet.length > 0) {
      await transaction.request()
        .input("sku", sql.Int, sku)
        .input("description", sql.VarChar(128), patch.description ?? "")
        .input("catalogNumber", sql.VarChar(30), patch.catalogNumber ?? "")
        .input("packageType", sql.VarChar(3), patch.packageType ?? "")
        .input("unitsPerPack", sql.SmallInt, patch.unitsPerPack ?? 1)
        .input("imageUrl", sql.VarChar(128), patch.imageUrl ?? "")
        .query(`UPDATE GeneralMerchandise SET ${gmSet.join(", ")} WHERE SKU = @sku`);
    }
    if (invSet.length > 0) {
      await transaction.request()
        .input("sku", sql.Int, sku)
        .input("loc", sql.Int, PIERCE_LOCATION_ID)
        .input("retail", sql.Money, patch.retail ?? 0)
        .input("cost", sql.Money, patch.cost ?? 0)
        .query(`UPDATE Inventory SET ${invSet.join(", ")} WHERE SKU = @sku AND LocationID = @loc`);
    }

    await transaction.commit();
    return { sku, appliedFields: applied };
  } catch (err) {
    try { await transaction.rollback(); } catch { /* swallow */ }
    throw err;
  }
}

/**
 * Narrow update for textbook rows — only touches fields on Item / Inventory
 * (no GeneralMerchandise row to update). Mirrors updateGmItem's tx-and-verify
 * pattern but with a smaller field set.
 */
export async function updateTextbookPricing(
  sku: number,
  patch: TextbookPatch,
  expectedSnapshot?: ItemSnapshot,
): Promise<UpdateGmItemResult> {
  const pool = await getPrismPool();
  const transaction = pool.transaction();
  await transaction.begin();

  try {
    const check = await transaction
      .request()
      .input("sku", sql.Int, sku)
      .input("loc", sql.Int, PIERCE_LOCATION_ID)
      .query<{
        BarCode: string | null;
        Retail: number | null;
        Cost: number | null;
        fDiscontinue: number | null;
      }>(`
        SELECT LTRIM(RTRIM(i.BarCode)) AS BarCode,
               inv.Retail, inv.Cost, i.fDiscontinue
        FROM Item i
        LEFT JOIN Inventory inv ON inv.SKU = i.SKU AND inv.LocationID = @loc
        WHERE i.SKU = @sku
      `);
    const current = check.recordset[0];
    if (!current) {
      throw new Error(`Item SKU ${sku} not found`);
    }

    if (expectedSnapshot) {
      const currentBarcode = current.BarCode && current.BarCode.length > 0 ? current.BarCode : null;
      const currentRetail = Number(current.Retail ?? 0);
      const currentCost = Number(current.Cost ?? 0);
      const currentFDisc = (current.fDiscontinue === 1 ? 1 : 0) as 0 | 1;
      if (
        currentBarcode !== expectedSnapshot.barcode ||
        currentRetail !== expectedSnapshot.retail ||
        currentCost !== expectedSnapshot.cost ||
        currentFDisc !== expectedSnapshot.fDiscontinue
      ) {
        const err = new Error("CONCURRENT_MODIFICATION") as Error & { code: string };
        err.code = "CONCURRENT_MODIFICATION";
        throw err;
      }
    }

    const applied: string[] = [];
    const itemSet: string[] = [];
    const invSet: string[] = [];

    if (patch.barcode !== undefined) {
      itemSet.push("BarCode = @barcode");
      applied.push("barcode");
    }
    if (patch.fDiscontinue !== undefined) {
      itemSet.push("fDiscontinue = @fDiscontinue");
      applied.push("fDiscontinue");
    }
    if (patch.retail !== undefined) {
      invSet.push("Retail = @retail");
      applied.push("retail");
    }
    if (patch.cost !== undefined) {
      invSet.push("Cost = @cost");
      applied.push("cost");
    }

    if (itemSet.length > 0) {
      await transaction.request()
        .input("sku", sql.Int, sku)
        .input("barcode", sql.VarChar(20), patch.barcode ?? "")
        .input("fDiscontinue", sql.TinyInt, patch.fDiscontinue ?? 0)
        .query(`UPDATE Item SET ${itemSet.join(", ")} WHERE SKU = @sku`);
    }
    if (invSet.length > 0) {
      await transaction.request()
        .input("sku", sql.Int, sku)
        .input("loc", sql.Int, PIERCE_LOCATION_ID)
        .input("retail", sql.Money, patch.retail ?? 0)
        .input("cost", sql.Money, patch.cost ?? 0)
        .query(`UPDATE Inventory SET ${invSet.join(", ")} WHERE SKU = @sku AND LocationID = @loc`);
    }

    await transaction.commit();
    return { sku, appliedFields: applied };
  } catch (err) {
    try { await transaction.rollback(); } catch { /* swallow */ }
    throw err;
  }
}
