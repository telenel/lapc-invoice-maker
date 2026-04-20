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
import type {
  GmItemPatch,
  TextbookPatch,
  ItemSnapshot,
  ProductEditPatchV2,
  ItemPatch,
  GmDetailsPatch,
  PrimaryInventoryPatch,
} from "./types";
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

export type ProductUpdaterInput = GmItemPatch | TextbookPatch | ProductEditPatchV2;

interface ProductWriteBuckets {
  item: ItemPatch;
  gm: GmDetailsPatch;
  primaryInventory: PrimaryInventoryPatch;
}

function isV2UpdaterInput(patch: ProductUpdaterInput): patch is ProductEditPatchV2 {
  return "item" in patch || "gm" in patch || "primaryInventory" in patch;
}

function normalizeUpdaterInput(patch: ProductUpdaterInput): ProductWriteBuckets {
  if (isV2UpdaterInput(patch)) {
    return {
      item: { ...(patch.item ?? {}) },
      gm: { ...(patch.gm ?? {}) },
      primaryInventory: { ...(patch.primaryInventory ?? {}) },
    };
  }

  return {
    item: {
      barcode: patch.barcode,
      vendorId: "vendorId" in patch ? patch.vendorId : undefined,
      dccId: "dccId" in patch ? patch.dccId : undefined,
      itemTaxTypeId: "itemTaxTypeId" in patch ? patch.itemTaxTypeId : undefined,
      comment: "comment" in patch ? patch.comment : undefined,
      weight: "weight" in patch ? patch.weight : undefined,
      fDiscontinue: patch.fDiscontinue,
    },
    gm: {
      description: "description" in patch ? patch.description : undefined,
      catalogNumber: "catalogNumber" in patch ? patch.catalogNumber : undefined,
      packageType: "packageType" in patch ? patch.packageType : undefined,
      unitsPerPack: "unitsPerPack" in patch ? patch.unitsPerPack : undefined,
      imageUrl: "imageUrl" in patch ? patch.imageUrl : undefined,
    },
    primaryInventory: {
      retail: patch.retail,
      cost: patch.cost,
    },
  };
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
  patch: ProductUpdaterInput,
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

    const normalizedPatch = normalizeUpdaterInput(patch);
    const applied: string[] = [];
    const itemSet: string[] = [];
    const gmSet: string[] = [];
    const invSet: string[] = [];
    const req = transaction.request().input("sku", sql.Int, sku).input("loc", sql.Int, PIERCE_LOCATION_ID);

    if (normalizedPatch.item.barcode !== undefined) {
      req.input("barcode", sql.VarChar(20), normalizedPatch.item.barcode ?? "");
      itemSet.push("BarCode = @barcode");
      applied.push("barcode");
    }
    if (normalizedPatch.item.vendorId !== undefined) {
      req.input("vendorId", sql.Int, normalizedPatch.item.vendorId);
      itemSet.push("VendorID = @vendorId");
      applied.push("vendorId");
    }
    if (normalizedPatch.item.dccId !== undefined) {
      req.input("dccId", sql.Int, normalizedPatch.item.dccId);
      itemSet.push("DCCID = @dccId");
      applied.push("dccId");
    }
    if (normalizedPatch.item.itemTaxTypeId !== undefined) {
      req.input("taxId", sql.Int, normalizedPatch.item.itemTaxTypeId);
      itemSet.push("ItemTaxTypeID = @taxId");
      applied.push("itemTaxTypeId");
    }
    if (normalizedPatch.item.comment !== undefined) {
      req.input("comment", sql.VarChar(25), normalizedPatch.item.comment ?? "");
      itemSet.push("txComment = @comment");
      applied.push("comment");
    }
    if (normalizedPatch.item.weight !== undefined) {
      req.input("weight", sql.Decimal(9, 4), normalizedPatch.item.weight);
      itemSet.push("Weight = @weight");
      applied.push("weight");
    }
    if (normalizedPatch.item.fDiscontinue !== undefined) {
      req.input("fDiscontinue", sql.TinyInt, normalizedPatch.item.fDiscontinue);
      itemSet.push("fDiscontinue = @fDiscontinue");
      applied.push("fDiscontinue");
    }

    if (normalizedPatch.gm.description !== undefined) {
      req.input("description", sql.VarChar(128), normalizedPatch.gm.description);
      gmSet.push("Description = @description");
      applied.push("description");
    }
    if (normalizedPatch.gm.catalogNumber !== undefined) {
      req.input("catalogNumber", sql.VarChar(30), normalizedPatch.gm.catalogNumber ?? "");
      gmSet.push("CatalogNumber = @catalogNumber");
      applied.push("catalogNumber");
    }
    if (normalizedPatch.gm.packageType !== undefined) {
      req.input("packageType", sql.VarChar(3), normalizedPatch.gm.packageType ?? "");
      gmSet.push("PackageType = @packageType");
      applied.push("packageType");
    }
    if (normalizedPatch.gm.unitsPerPack !== undefined) {
      req.input("unitsPerPack", sql.SmallInt, normalizedPatch.gm.unitsPerPack);
      gmSet.push("UnitsPerPack = @unitsPerPack");
      applied.push("unitsPerPack");
    }
    if (normalizedPatch.gm.imageUrl !== undefined) {
      req.input("imageUrl", sql.VarChar(128), normalizedPatch.gm.imageUrl ?? "");
      gmSet.push("ImageURL = @imageUrl");
      applied.push("imageUrl");
    }

    if (normalizedPatch.primaryInventory.retail !== undefined) {
      req.input("retail", sql.Money, normalizedPatch.primaryInventory.retail);
      invSet.push("Retail = @retail");
      applied.push("retail");
    }
    if (normalizedPatch.primaryInventory.cost !== undefined) {
      req.input("cost", sql.Money, normalizedPatch.primaryInventory.cost);
      invSet.push("Cost = @cost");
      applied.push("cost");
    }

    if (itemSet.length > 0) {
      await req.query(`UPDATE Item SET ${itemSet.join(", ")} WHERE SKU = @sku`);
    }
    if (gmSet.length > 0) {
      await transaction.request()
        .input("sku", sql.Int, sku)
        .input("description", sql.VarChar(128), normalizedPatch.gm.description ?? "")
        .input("catalogNumber", sql.VarChar(30), normalizedPatch.gm.catalogNumber ?? "")
        .input("packageType", sql.VarChar(3), normalizedPatch.gm.packageType ?? "")
        .input("unitsPerPack", sql.SmallInt, normalizedPatch.gm.unitsPerPack ?? 1)
        .input("imageUrl", sql.VarChar(128), normalizedPatch.gm.imageUrl ?? "")
        .query(`UPDATE GeneralMerchandise SET ${gmSet.join(", ")} WHERE SKU = @sku`);
    }
    if (invSet.length > 0) {
      await transaction.request()
        .input("sku", sql.Int, sku)
        .input("loc", sql.Int, PIERCE_LOCATION_ID)
        .input("retail", sql.Money, normalizedPatch.primaryInventory.retail ?? 0)
        .input("cost", sql.Money, normalizedPatch.primaryInventory.cost ?? 0)
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
  patch: ProductUpdaterInput,
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

    const normalizedPatch = normalizeUpdaterInput(patch);
    const applied: string[] = [];
    const itemSet: string[] = [];
    const invSet: string[] = [];

    if (normalizedPatch.item.barcode !== undefined) {
      itemSet.push("BarCode = @barcode");
      applied.push("barcode");
    }
    if (normalizedPatch.item.fDiscontinue !== undefined) {
      itemSet.push("fDiscontinue = @fDiscontinue");
      applied.push("fDiscontinue");
    }
    if (normalizedPatch.primaryInventory.retail !== undefined) {
      invSet.push("Retail = @retail");
      applied.push("retail");
    }
    if (normalizedPatch.primaryInventory.cost !== undefined) {
      invSet.push("Cost = @cost");
      applied.push("cost");
    }

    if (itemSet.length > 0) {
      await transaction.request()
        .input("sku", sql.Int, sku)
        .input("barcode", sql.VarChar(20), normalizedPatch.item.barcode ?? "")
        .input("fDiscontinue", sql.TinyInt, normalizedPatch.item.fDiscontinue ?? 0)
        .query(`UPDATE Item SET ${itemSet.join(", ")} WHERE SKU = @sku`);
    }
    if (invSet.length > 0) {
      await transaction.request()
        .input("sku", sql.Int, sku)
        .input("loc", sql.Int, PIERCE_LOCATION_ID)
        .input("retail", sql.Money, normalizedPatch.primaryInventory.retail ?? 0)
        .input("cost", sql.Money, normalizedPatch.primaryInventory.cost ?? 0)
        .query(`UPDATE Inventory SET ${invSet.join(", ")} WHERE SKU = @sku AND LocationID = @loc`);
    }

    await transaction.commit();
    return { sku, appliedFields: applied };
  } catch (err) {
    try { await transaction.rollback(); } catch { /* swallow */ }
    throw err;
  }
}
