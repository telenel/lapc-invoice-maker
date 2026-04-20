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
  TextbookDetailsPatch,
  ItemSnapshot,
  ProductEditPatchV2,
  ItemPatch,
  GmDetailsPatch,
  InventoryPatchPerLocation,
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
      ItemTaxTypeID: number | null;
      Retail: number | null;
      Cost: number | null;
      fDiscontinue: number | null;
    }>(`
      SELECT i.SKU,
             LTRIM(RTRIM(i.BarCode)) AS BarCode,
             i.ItemTaxTypeID,
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
    itemTaxTypeId: row.ItemTaxTypeID == null ? null : Number(row.ItemTaxTypeID),
    retail: row.Retail == null ? null : Number(row.Retail),
    cost: row.Cost == null ? null : Number(row.Cost),
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
  textbook: TextbookDetailsPatch;
  inventory: InventoryPatchPerLocation[];
  primaryInventory: PrimaryInventoryPatch;
}

function isV2UpdaterInput(patch: ProductUpdaterInput): patch is ProductEditPatchV2 {
  return "item" in patch || "gm" in patch || "textbook" in patch || "inventory" in patch || "primaryInventory" in patch;
}

function normalizeUpdaterInput(patch: ProductUpdaterInput): ProductWriteBuckets {
  if (isV2UpdaterInput(patch)) {
    return {
      item: { ...(patch.item ?? {}) },
      gm: { ...(patch.gm ?? {}) },
      textbook: { ...(patch.textbook ?? {}) },
      inventory: patch.inventory ?? [],
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
    textbook: {},
    inventory: [],
    primaryInventory: {
      retail: patch.retail,
      cost: patch.cost,
    },
  };
}

function hasInventoryWriteFields(patch: InventoryPatchPerLocation): boolean {
  return [
    patch.retail,
    patch.cost,
    patch.expectedCost,
    patch.tagTypeId,
    patch.statusCodeId,
    patch.estSales,
    patch.estSalesLocked,
    patch.fInvListPriceFlag,
    patch.fTxWantListFlag,
    patch.fTxBuybackListFlag,
    patch.fNoReturns,
  ].some((value) => value !== undefined);
}

function getInventoryPatches(normalizedPatch: ProductWriteBuckets): InventoryPatchPerLocation[] {
  if (normalizedPatch.inventory.length > 0) {
    return normalizedPatch.inventory;
  }

  if (normalizedPatch.primaryInventory.retail === undefined && normalizedPatch.primaryInventory.cost === undefined) {
    return [];
  }

  return [
    {
      locationId: PIERCE_LOCATION_ID,
      retail: normalizedPatch.primaryInventory.retail,
      cost: normalizedPatch.primaryInventory.cost,
    },
  ];
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
        ItemTaxTypeID: number | null;
        Retail: number | null;
        Cost: number | null;
        fDiscontinue: number | null;
      }>(`
        SELECT LTRIM(RTRIM(i.BarCode)) AS BarCode,
               i.ItemTaxTypeID,
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
      const currentTaxTypeId = current.ItemTaxTypeID == null ? null : Number(current.ItemTaxTypeID);
      const currentRetail = current.Retail == null ? null : Number(current.Retail);
      const currentCost = current.Cost == null ? null : Number(current.Cost);
      const currentFDisc = (current.fDiscontinue === 1 ? 1 : 0) as 0 | 1;
      if (
        currentBarcode !== expectedSnapshot.barcode ||
        (expectedSnapshot.itemTaxTypeId !== undefined &&
          currentTaxTypeId !== expectedSnapshot.itemTaxTypeId) ||
        currentRetail !== expectedSnapshot.retail ||
        currentCost !== expectedSnapshot.cost ||
        currentFDisc !== expectedSnapshot.fDiscontinue
      ) {
        const err = new Error("CONCURRENT_MODIFICATION") as Error & { code: string; current: ItemSnapshot };
        err.code = "CONCURRENT_MODIFICATION";
        err.current = {
          sku,
          barcode: currentBarcode,
          itemTaxTypeId: currentTaxTypeId,
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
    for (const inventoryPatch of getInventoryPatches(normalizedPatch)) {
      if (!hasInventoryWriteFields(inventoryPatch)) {
        continue;
      }

      const inventorySet: string[] = [];
      const inventoryReq = transaction.request().input("sku", sql.Int, sku).input("loc", sql.Int, inventoryPatch.locationId);

      if (inventoryPatch.retail !== undefined) {
        inventoryReq.input("retail", sql.Money, inventoryPatch.retail);
        inventorySet.push("Retail = @retail");
        applied.push(`inventory:${inventoryPatch.locationId}:retail`);
      }
      if (inventoryPatch.cost !== undefined) {
        inventoryReq.input("cost", sql.Money, inventoryPatch.cost);
        inventorySet.push("Cost = @cost");
        applied.push(`inventory:${inventoryPatch.locationId}:cost`);
      }
      if (inventoryPatch.expectedCost !== undefined) {
        inventoryReq.input("expectedCost", sql.Money, inventoryPatch.expectedCost);
        inventorySet.push("ExpectedCost = @expectedCost");
        applied.push(`inventory:${inventoryPatch.locationId}:expectedCost`);
      }
      if (inventoryPatch.tagTypeId !== undefined) {
        inventoryReq.input("tagTypeId", sql.Int, inventoryPatch.tagTypeId);
        inventorySet.push("TagTypeID = @tagTypeId");
        applied.push(`inventory:${inventoryPatch.locationId}:tagTypeId`);
      }
      if (inventoryPatch.statusCodeId !== undefined) {
        inventoryReq.input("statusCodeId", sql.Int, inventoryPatch.statusCodeId);
        inventorySet.push("StatusCodeID = @statusCodeId");
        applied.push(`inventory:${inventoryPatch.locationId}:statusCodeId`);
      }
      if (inventoryPatch.estSales !== undefined) {
        inventoryReq.input("estSales", sql.Decimal(9, 4), inventoryPatch.estSales);
        inventorySet.push("EstSales = @estSales");
        applied.push(`inventory:${inventoryPatch.locationId}:estSales`);
      }
      if (inventoryPatch.estSalesLocked !== undefined) {
        inventoryReq.input("estSalesLocked", sql.Bit, inventoryPatch.estSalesLocked);
        inventorySet.push("EstSalesLocked = @estSalesLocked");
        applied.push(`inventory:${inventoryPatch.locationId}:estSalesLocked`);
      }
      if (inventoryPatch.fInvListPriceFlag !== undefined) {
        inventoryReq.input("fInvListPriceFlag", sql.Bit, inventoryPatch.fInvListPriceFlag);
        inventorySet.push("fInvListPriceFlag = @fInvListPriceFlag");
        applied.push(`inventory:${inventoryPatch.locationId}:fInvListPriceFlag`);
      }
      if (inventoryPatch.fTxWantListFlag !== undefined) {
        inventoryReq.input("fTxWantListFlag", sql.Bit, inventoryPatch.fTxWantListFlag);
        inventorySet.push("fTxWantListFlag = @fTxWantListFlag");
        applied.push(`inventory:${inventoryPatch.locationId}:fTxWantListFlag`);
      }
      if (inventoryPatch.fTxBuybackListFlag !== undefined) {
        inventoryReq.input("fTxBuybackListFlag", sql.Bit, inventoryPatch.fTxBuybackListFlag);
        inventorySet.push("fTxBuybackListFlag = @fTxBuybackListFlag");
        applied.push(`inventory:${inventoryPatch.locationId}:fTxBuybackListFlag`);
      }
      if (inventoryPatch.fNoReturns !== undefined) {
        inventoryReq.input("fNoReturns", sql.Bit, inventoryPatch.fNoReturns);
        inventorySet.push("fNoReturns = @fNoReturns");
        applied.push(`inventory:${inventoryPatch.locationId}:fNoReturns`);
      }

      if (inventorySet.length > 0) {
        await inventoryReq.query(`UPDATE Inventory SET ${inventorySet.join(", ")} WHERE SKU = @sku AND LocationID = @loc`);
      }
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
        ItemTaxTypeID: number | null;
        Retail: number | null;
        Cost: number | null;
        fDiscontinue: number | null;
      }>(`
        SELECT LTRIM(RTRIM(i.BarCode)) AS BarCode,
               i.ItemTaxTypeID,
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
      const currentTaxTypeId = current.ItemTaxTypeID == null ? null : Number(current.ItemTaxTypeID);
      const currentRetail = current.Retail == null ? null : Number(current.Retail);
      const currentCost = current.Cost == null ? null : Number(current.Cost);
      const currentFDisc = (current.fDiscontinue === 1 ? 1 : 0) as 0 | 1;
      if (
        currentBarcode !== expectedSnapshot.barcode ||
        (expectedSnapshot.itemTaxTypeId !== undefined &&
          currentTaxTypeId !== expectedSnapshot.itemTaxTypeId) ||
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
    const textbookSet: string[] = [];

    if (normalizedPatch.item.barcode !== undefined) {
      itemSet.push("BarCode = @barcode");
      applied.push("barcode");
    }
    if (normalizedPatch.item.itemTaxTypeId !== undefined) {
      itemSet.push("ItemTaxTypeID = @taxId");
      applied.push("itemTaxTypeId");
    }
    if (normalizedPatch.item.fDiscontinue !== undefined) {
      itemSet.push("fDiscontinue = @fDiscontinue");
      applied.push("fDiscontinue");
    }

    if (normalizedPatch.textbook.author !== undefined) {
      textbookSet.push("Author = @author");
      applied.push("author");
    }
    if (normalizedPatch.textbook.title !== undefined) {
      textbookSet.push("Title = @title");
      applied.push("title");
    }
    if (normalizedPatch.textbook.isbn !== undefined) {
      textbookSet.push("ISBN = @isbn");
      applied.push("isbn");
    }
    if (normalizedPatch.textbook.edition !== undefined) {
      textbookSet.push("Edition = @edition");
      applied.push("edition");
    }
    if (normalizedPatch.textbook.bindingId !== undefined) {
      textbookSet.push("BindingID = @bindingId");
      applied.push("bindingId");
    }
    if (normalizedPatch.textbook.imprint !== undefined) {
      textbookSet.push("Imprint = @imprint");
      applied.push("imprint");
    }
    if (normalizedPatch.textbook.copyright !== undefined) {
      textbookSet.push("Copyright = @copyright");
      applied.push("copyright");
    }
    if (normalizedPatch.textbook.textStatusId !== undefined) {
      textbookSet.push("TextStatusID = @textStatusId");
      applied.push("textStatusId");
    }
    if (normalizedPatch.textbook.statusDate !== undefined) {
      textbookSet.push("StatusDate = @statusDate");
      applied.push("statusDate");
    }

    if (itemSet.length > 0) {
      const itemReq = transaction.request().input("sku", sql.Int, sku);
      if (normalizedPatch.item.barcode !== undefined) {
        itemReq.input("barcode", sql.VarChar(20), normalizedPatch.item.barcode ?? "");
      }
      if (normalizedPatch.item.itemTaxTypeId !== undefined) {
        itemReq.input("taxId", sql.Int, normalizedPatch.item.itemTaxTypeId);
      }
      if (normalizedPatch.item.fDiscontinue !== undefined) {
        itemReq.input("fDiscontinue", sql.TinyInt, normalizedPatch.item.fDiscontinue ?? 0);
      }
      await itemReq.query(`UPDATE Item SET ${itemSet.join(", ")} WHERE SKU = @sku`);
    }
    if (textbookSet.length > 0) {
      const textbookReq = transaction.request().input("sku", sql.Int, sku);

      if (normalizedPatch.textbook.author !== undefined) {
        textbookReq.input("author", sql.VarChar(128), normalizedPatch.textbook.author ?? null);
      }
      if (normalizedPatch.textbook.title !== undefined) {
        textbookReq.input("title", sql.VarChar(128), normalizedPatch.textbook.title ?? null);
      }
      if (normalizedPatch.textbook.isbn !== undefined) {
        textbookReq.input("isbn", sql.VarChar(20), normalizedPatch.textbook.isbn ?? null);
      }
      if (normalizedPatch.textbook.edition !== undefined) {
        textbookReq.input("edition", sql.VarChar(20), normalizedPatch.textbook.edition ?? null);
      }
      if (normalizedPatch.textbook.bindingId !== undefined) {
        textbookReq.input("bindingId", sql.Int, normalizedPatch.textbook.bindingId);
      }
      if (normalizedPatch.textbook.imprint !== undefined) {
        textbookReq.input("imprint", sql.VarChar(50), normalizedPatch.textbook.imprint ?? null);
      }
      if (normalizedPatch.textbook.copyright !== undefined) {
        textbookReq.input("copyright", sql.VarChar(16), normalizedPatch.textbook.copyright ?? null);
      }
      if (normalizedPatch.textbook.textStatusId !== undefined) {
        textbookReq.input("textStatusId", sql.Int, normalizedPatch.textbook.textStatusId);
      }
      if (normalizedPatch.textbook.statusDate !== undefined) {
        textbookReq.input(
          "statusDate",
          sql.DateTime,
          normalizedPatch.textbook.statusDate ? new Date(normalizedPatch.textbook.statusDate) : null,
        );
      }

      await textbookReq.query(`UPDATE Textbook SET ${textbookSet.join(", ")} WHERE SKU = @sku`);
    }
    for (const inventoryPatch of getInventoryPatches(normalizedPatch)) {
      if (!hasInventoryWriteFields(inventoryPatch)) {
        continue;
      }

      const inventorySet: string[] = [];
      const inventoryReq = transaction.request().input("sku", sql.Int, sku).input("loc", sql.Int, inventoryPatch.locationId);

      if (inventoryPatch.retail !== undefined) {
        inventoryReq.input("retail", sql.Money, inventoryPatch.retail);
        inventorySet.push("Retail = @retail");
        applied.push(`inventory:${inventoryPatch.locationId}:retail`);
      }
      if (inventoryPatch.cost !== undefined) {
        inventoryReq.input("cost", sql.Money, inventoryPatch.cost);
        inventorySet.push("Cost = @cost");
        applied.push(`inventory:${inventoryPatch.locationId}:cost`);
      }
      if (inventoryPatch.expectedCost !== undefined) {
        inventoryReq.input("expectedCost", sql.Money, inventoryPatch.expectedCost);
        inventorySet.push("ExpectedCost = @expectedCost");
        applied.push(`inventory:${inventoryPatch.locationId}:expectedCost`);
      }
      if (inventoryPatch.tagTypeId !== undefined) {
        inventoryReq.input("tagTypeId", sql.Int, inventoryPatch.tagTypeId);
        inventorySet.push("TagTypeID = @tagTypeId");
        applied.push(`inventory:${inventoryPatch.locationId}:tagTypeId`);
      }
      if (inventoryPatch.statusCodeId !== undefined) {
        inventoryReq.input("statusCodeId", sql.Int, inventoryPatch.statusCodeId);
        inventorySet.push("StatusCodeID = @statusCodeId");
        applied.push(`inventory:${inventoryPatch.locationId}:statusCodeId`);
      }
      if (inventoryPatch.estSales !== undefined) {
        inventoryReq.input("estSales", sql.Decimal(9, 4), inventoryPatch.estSales);
        inventorySet.push("EstSales = @estSales");
        applied.push(`inventory:${inventoryPatch.locationId}:estSales`);
      }
      if (inventoryPatch.estSalesLocked !== undefined) {
        inventoryReq.input("estSalesLocked", sql.Bit, inventoryPatch.estSalesLocked);
        inventorySet.push("EstSalesLocked = @estSalesLocked");
        applied.push(`inventory:${inventoryPatch.locationId}:estSalesLocked`);
      }
      if (inventoryPatch.fInvListPriceFlag !== undefined) {
        inventoryReq.input("fInvListPriceFlag", sql.Bit, inventoryPatch.fInvListPriceFlag);
        inventorySet.push("fInvListPriceFlag = @fInvListPriceFlag");
        applied.push(`inventory:${inventoryPatch.locationId}:fInvListPriceFlag`);
      }
      if (inventoryPatch.fTxWantListFlag !== undefined) {
        inventoryReq.input("fTxWantListFlag", sql.Bit, inventoryPatch.fTxWantListFlag);
        inventorySet.push("fTxWantListFlag = @fTxWantListFlag");
        applied.push(`inventory:${inventoryPatch.locationId}:fTxWantListFlag`);
      }
      if (inventoryPatch.fTxBuybackListFlag !== undefined) {
        inventoryReq.input("fTxBuybackListFlag", sql.Bit, inventoryPatch.fTxBuybackListFlag);
        inventorySet.push("fTxBuybackListFlag = @fTxBuybackListFlag");
        applied.push(`inventory:${inventoryPatch.locationId}:fTxBuybackListFlag`);
      }
      if (inventoryPatch.fNoReturns !== undefined) {
        inventoryReq.input("fNoReturns", sql.Bit, inventoryPatch.fNoReturns);
        inventorySet.push("fNoReturns = @fNoReturns");
        applied.push(`inventory:${inventoryPatch.locationId}:fNoReturns`);
      }

      if (inventorySet.length > 0) {
        await inventoryReq.query(`UPDATE Inventory SET ${inventorySet.join(", ")} WHERE SKU = @sku AND LocationID = @loc`);
      }
    }

    await transaction.commit();
    return { sku, appliedFields: applied };
  } catch (err) {
    try { await transaction.rollback(); } catch { /* swallow */ }
    throw err;
  }
}
