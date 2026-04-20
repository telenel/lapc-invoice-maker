/**
 * Server-side Prism operations for the product domain.
 *
 * These functions wrap the WinPRISM SQL Server stored procedures and direct
 * INSERT/UPDATE/DELETE statements for catalog management. They are intended
 * to be called from API routes only.
 *
 * Authoritative reference: ~/memory/reference_prism_database.md
 *
 * The create flow always writes a canonical Pierce inventory row (LocationID=2)
 * and can optionally add extra rows for PCOP/PFS in the same transaction.
 */
import { getPrismPool, sql } from "@/lib/prism";
import type { ProductLocationAbbrev, ProductLocationId } from "./types";
import {
  normalizePackageTypeLabel,
  type PrismBindingRef,
  type PrismColorRef,
  type PrismDccRef,
  type PrismPackageTypeRef,
  type PrismStatusCodeRef,
  type PrismTagTypeRef,
  type PrismTaxTypeRef,
  type PrismVendorRef,
} from "./ref-data";

export const PIERCE_LOCATION_ID = 2;
const PIERCE_LOCATION_IDS = "(2, 3, 4)";
const LOCATION_ABBREV_BY_ID: Record<ProductLocationId, ProductLocationAbbrev> = {
  2: "PIER",
  3: "PCOP",
  4: "PFS",
};

export interface CreateInventoryInput {
  locationId: ProductLocationId;
  retail: number;
  cost: number;
}

export interface CreateGmItemInput {
  description: string;
  vendorId: number;
  dccId: number;
  mfgId?: number; // defaults to vendorId
  itemTaxTypeId?: number; // 6 = 9.75% CA standard, 3 = NOT TAXABLE
  barcode?: string | null;
  catalogNumber?: string | null;
  comment?: string | null;
  weight?: number;
  imageUrl?: string | null;
  unitsPerPack?: number;
  packageType?: string | null;
  // Canonical Pierce inventory row mirrored back into products.retail_price/cost.
  retail: number;
  cost: number;
  inventory?: CreateInventoryInput[];
}

export interface CreatedItem {
  sku: number;
  description: string;
  vendorId: number;
  dccId: number;
  barcode: string | null;
  retail: number;
  cost: number;
  inventory: Array<{
    locationId: ProductLocationId;
    locationAbbrev: ProductLocationAbbrev;
    retail: number;
    cost: number;
  }>;
}

/**
 * Create a new General Merchandise item end-to-end:
 *   1. EXEC P_Item_Add_GM → creates Item + ItemMaster + GeneralMerchandise rows, returns new SKU
 *   2. INSERT one Inventory row per requested location, always including Pierce
 *
 * Wrapped in a transaction so a failed inventory insert rolls back the item creation.
 */
export async function createGmItem(input: CreateGmItemInput): Promise<CreatedItem> {
  const pool = await getPrismPool();
  const transaction = pool.transaction();
  await transaction.begin();

  try {
    const inventoryRows: CreateInventoryInput[] =
      input.inventory && input.inventory.length > 0
        ? input.inventory
        : [{ locationId: PIERCE_LOCATION_ID, retail: input.retail, cost: input.cost }];

    // Step 1: P_Item_Add_GM
    const addRequest = transaction.request();
    addRequest.input("MfgId", sql.Int, input.mfgId ?? input.vendorId);
    addRequest.input("Description", sql.VarChar(128), input.description);
    addRequest.input("Color", sql.Int, 0);
    addRequest.input("SizeId", sql.Int, 0);
    addRequest.input("CatalogNumber", sql.VarChar(30), input.catalogNumber ?? "");
    addRequest.input("PackageType", sql.VarChar(3), input.packageType ?? "");
    addRequest.input("UnitsPerPack", sql.SmallInt, input.unitsPerPack ?? 1);
    addRequest.input("DccId", sql.Int, input.dccId);
    addRequest.input("ItemTaxTypeId", sql.Int, input.itemTaxTypeId ?? 6);
    addRequest.input("Comment", sql.VarChar(25), input.comment ?? "");
    addRequest.input("VendorId", sql.Int, input.vendorId);
    addRequest.input("Weight", sql.Decimal(9, 4), input.weight ?? 0);
    addRequest.input("ImageURL", sql.VarChar(128), input.imageUrl ?? "");
    addRequest.input("DiscCodeId", sql.Int, 0);
    addRequest.input("BarCode", sql.VarChar(20), input.barcode ?? "");

    const addResult = await addRequest.execute<{ SKU?: number }>("P_Item_Add_GM");
    // P_Item_Add_GM returns the new SKU as the first column of the first recordset
    const firstRow = addResult.recordsets?.[0]?.[0] as Record<string, unknown> | undefined;
    const newSku = firstRow ? Number(Object.values(firstRow)[0]) : NaN;

    if (!Number.isFinite(newSku) || newSku <= 0) {
      throw new Error("P_Item_Add_GM did not return a valid SKU");
    }

    // Step 2: INSERT one row per requested location into Inventory
    for (const inventoryRow of inventoryRows) {
      const invRequest = transaction.request();
      invRequest.input("sku", sql.Int, newSku);
      invRequest.input("locationId", sql.Numeric(8, 0), inventoryRow.locationId);
      invRequest.input("retail", sql.Money, inventoryRow.retail);
      invRequest.input("cost", sql.Money, inventoryRow.cost);
      await invRequest.query(
        "INSERT INTO Inventory (SKU, LocationID, Retail, Cost) VALUES (@sku, @locationId, @retail, @cost)",
      );
    }

    await transaction.commit();

    const primaryInventory =
      inventoryRows.find((row) => row.locationId === PIERCE_LOCATION_ID) ??
      inventoryRows[0];

    return {
      sku: newSku,
      description: input.description,
      vendorId: input.vendorId,
      dccId: input.dccId,
      barcode: input.barcode ?? null,
      retail: primaryInventory?.retail ?? input.retail,
      cost: primaryInventory?.cost ?? input.cost,
      inventory: inventoryRows.map((row) => ({
        locationId: row.locationId,
        locationAbbrev: LOCATION_ABBREV_BY_ID[row.locationId],
        retail: row.retail,
        cost: row.cost,
      })),
    };
  } catch (err) {
    try { await transaction.rollback(); } catch { /* swallow */ }
    throw err;
  }
}

/**
 * Soft-delete an item by setting fDiscontinue=1.
 * Hard delete is not supported because Items have many FK dependencies
 * (Inventory, Transaction_Detail, PO_Detail, etc.).
 */
export async function discontinueItem(sku: number): Promise<{ affected: number }> {
  const pool = await getPrismPool();
  const result = await pool
    .request()
    .input("sku", sql.Int, sku)
    .query<{ affected: number }>(
      "UPDATE Item SET fDiscontinue = 1 WHERE SKU = @sku; SELECT @@ROWCOUNT AS affected;",
    );
  return { affected: result.recordset[0]?.affected ?? 0 };
}

/**
 * Hard-delete a test item (only intended for items with TEST-CLAUDE- barcode).
 * Will fail if any FK constraints are violated (sales history, etc.).
 *
 * Deletion order: Inventory → Item (GeneralMerchandise is intentionally skipped).
 * The TD_GENERALMERCHANDISE trigger unconditionally raises "Item is used in the
 * system" on any direct DELETE from that table regardless of whether inventory
 * or transaction history exists — pdt does not have DISABLE TRIGGER permission
 * to work around it. Skipping the GM delete leaves an orphaned GM row, but the
 * Item row (the catalog master) is removed so the SKU will not appear in any
 * lookup or transaction path. This is acceptable for test cleanup.
 */
export async function deleteTestItem(sku: number): Promise<{ affected: number }> {
  const pool = await getPrismPool();
  const transaction = pool.transaction();
  await transaction.begin();

  try {
    // Verify it's actually a test item before deleting
    const check = await transaction
      .request()
      .input("sku", sql.Int, sku)
      .query<{ BarCode: string }>("SELECT BarCode FROM Item WHERE SKU = @sku");

    const barcode = check.recordset[0]?.BarCode?.trim() ?? "";
    if (!barcode.startsWith("TEST-CLAUDE-")) {
      throw new Error(
        `Refusing to hard-delete SKU ${sku}: barcode '${barcode}' does not start with TEST-CLAUDE-`,
      );
    }

    // Delete Inventory first (FK dependency), then Item.
    // GeneralMerchandise is intentionally NOT deleted here — TD_GENERALMERCHANDISE
    // trigger blocks it unconditionally (see comment on function).
    await transaction.request().input("sku", sql.Int, sku)
      .query("DELETE FROM Inventory WHERE SKU = @sku");
    // Triggers on Item make both @@ROWCOUNT and the OUTPUT clause unreliable:
    // rowcount gets clobbered, bare OUTPUT is rejected, and trigger recordsets
    // crowd out the OUTPUT-INTO result. We pre-verified the row exists via the
    // barcode check above, so a committed DELETE means one row was removed.
    await transaction.request().input("sku", sql.Int, sku)
      .query("DELETE FROM Item WHERE SKU = @sku");

    await transaction.commit();
    return { affected: 1 };
  } catch (err) {
    try { await transaction.rollback(); } catch { /* swallow */ }
    throw err;
  }
}

export async function listVendors(limit = 200): Promise<PrismVendorRef[]> {
  const pool = await getPrismPool();
  const result = await pool
    .request()
    .input("lim", sql.Int, limit)
    .query<{ VendorID: number; Name: string; PierceItems: number }>(`
      SELECT TOP (@lim)
        v.VendorID,
        LTRIM(RTRIM(v.Name)) AS Name,
        COUNT(DISTINCT i.SKU) AS PierceItems
      FROM VendorMaster v
      INNER JOIN Item i ON i.VendorID = v.VendorID
      INNER JOIN Inventory inv ON i.SKU = inv.SKU AND inv.LocationID IN ${PIERCE_LOCATION_IDS}
      GROUP BY v.VendorID, v.Name
      ORDER BY COUNT(DISTINCT i.SKU) DESC, LTRIM(RTRIM(v.Name)) ASC
    `);
  return result.recordset.map((r) => ({ vendorId: r.VendorID, name: r.Name, pierceItems: Number(r.PierceItems) }));
}

export async function listDccs(limit = 500): Promise<PrismDccRef[]> {
  const pool = await getPrismPool();
  const result = await pool.request().input("lim", sql.Int, limit).query<{
    DCCID: number;
    DeptNum: number | null;
    ClassNum: number | null;
    CatNum: number | null;
    DeptName: string;
    ClassName: string | null;
    CatName: string | null;
    PierceItems: number;
  }>(`
    SELECT TOP (@lim)
      d.DCCID,
      d.Department AS DeptNum,
      d.Class AS ClassNum,
      d.Category AS CatNum,
      LTRIM(RTRIM(dep.DeptName)) AS DeptName,
      LTRIM(RTRIM(cls.ClassName)) AS ClassName,
      LTRIM(RTRIM(cat.CatName)) AS CatName,
      COUNT(DISTINCT i.SKU) AS PierceItems
    FROM DeptClassCat d
    INNER JOIN Item i ON i.DCCID = d.DCCID
    INNER JOIN Inventory inv ON i.SKU = inv.SKU AND inv.LocationID IN ${PIERCE_LOCATION_IDS}
    LEFT JOIN DCC_Department dep ON d.Department = dep.Department
    LEFT JOIN DCC_Class cls ON d.Department = cls.Department AND d.Class = cls.Class
    LEFT JOIN DCC_Category cat ON d.Department = cat.Department AND d.Class = cat.Class AND d.Category = cat.Category
    WHERE d.DCCType = 3
    GROUP BY d.DCCID, d.Department, d.Class, d.Category, dep.DeptName, cls.ClassName, cat.CatName
    ORDER BY COUNT(DISTINCT i.SKU) DESC, LTRIM(RTRIM(dep.DeptName)) ASC, LTRIM(RTRIM(cls.ClassName)) ASC, LTRIM(RTRIM(cat.CatName)) ASC
  `);
  return result.recordset.map((r) => ({
    dccId: r.DCCID,
    deptNum: r.DeptNum,
    classNum: r.ClassNum,
    catNum: r.CatNum,
    deptName: r.DeptName,
    className: r.ClassName,
    catName: r.CatName,
    pierceItems: Number(r.PierceItems),
  }));
}

export async function listTaxTypes(limit = 200): Promise<PrismTaxTypeRef[]> {
  const pool = await getPrismPool();
  const result = await pool.request().input("lim", sql.Int, limit).query<{
    ItemTaxTypeID: number;
    Description: string;
    PierceItems: number;
  }>(`
      SELECT TOP (@lim)
        itt.ItemTaxTypeID,
        LTRIM(RTRIM(itt.Description)) AS Description,
        COUNT(DISTINCT i.SKU) AS PierceItems
    FROM Item_Tax_Type itt
    INNER JOIN Item i ON i.ItemTaxTypeID = itt.ItemTaxTypeID
    INNER JOIN Inventory inv ON inv.SKU = i.SKU AND inv.LocationID IN ${PIERCE_LOCATION_IDS}
    GROUP BY itt.ItemTaxTypeID, itt.Description
    ORDER BY COUNT(DISTINCT i.SKU) DESC, LTRIM(RTRIM(itt.Description)) ASC
  `);
  return result.recordset.map((r) => ({
    taxTypeId: r.ItemTaxTypeID,
    description: r.Description,
    pierceItems: Number(r.PierceItems),
  }));
}

export async function listTagTypes(limit = 200): Promise<PrismTagTypeRef[]> {
  const pool = await getPrismPool();
  const result = await pool.request().input("lim", sql.Int, limit).query<{
    TagTypeID: number;
    Description: string;
    SubSystemID: number | null;
    PierceRows: number;
  }>(`
    SELECT TOP (@lim)
      tt.TagTypeID,
      LTRIM(RTRIM(tt.Description)) AS Description,
      tt.SubSystemID,
      COUNT_BIG(*) AS PierceRows
    FROM TagType tt
    INNER JOIN Inventory inv ON inv.TagTypeID = tt.TagTypeID AND inv.LocationID IN ${PIERCE_LOCATION_IDS}
    GROUP BY tt.TagTypeID, tt.Description, tt.SubSystemID
    ORDER BY COUNT_BIG(*) DESC, LTRIM(RTRIM(tt.Description)) ASC
  `);
  return result.recordset.map((r) => ({
    tagTypeId: r.TagTypeID,
    label: r.Description,
    subsystem: r.SubSystemID,
    pierceRows: Number(r.PierceRows),
  }));
}

export async function listStatusCodes(limit = 200): Promise<PrismStatusCodeRef[]> {
  const pool = await getPrismPool();
  const result = await pool.request().input("lim", sql.Int, limit).query<{
    InvStatusCodeID: number;
    StatusCodeName: string;
    PierceRows: number;
  }>(`
    SELECT TOP (@lim)
      sc.InvStatusCodeID,
      LTRIM(RTRIM(sc.StatusCodeName)) AS StatusCodeName,
      COUNT_BIG(*) AS PierceRows
    FROM InventoryStatusCodes sc
    INNER JOIN Inventory inv ON inv.StatusCodeID = sc.InvStatusCodeID AND inv.LocationID IN ${PIERCE_LOCATION_IDS}
    GROUP BY sc.InvStatusCodeID, sc.StatusCodeName
    ORDER BY COUNT_BIG(*) DESC, LTRIM(RTRIM(sc.StatusCodeName)) ASC
  `);
  return result.recordset.map((r) => ({
    statusCodeId: r.InvStatusCodeID,
    label: r.StatusCodeName,
    pierceRows: Number(r.PierceRows),
  }));
}

export async function listPackageTypes(limit = 200): Promise<PrismPackageTypeRef[]> {
  const pool = await getPrismPool();
  const result = await pool.request().input("lim", sql.Int, limit).query<{
    PackageType: string;
    Description: string | null;
    DefaultQty: number | null;
    PierceItems: number;
  }>(`
    SELECT TOP (@lim)
      pkg.PackageType,
      LTRIM(RTRIM(pkg.Description)) AS Description,
      pkg.DefaultQty,
      COUNT(DISTINCT i.SKU) AS PierceItems
    FROM PackageType pkg
    INNER JOIN GeneralMerchandise gm ON gm.PackageType = pkg.PackageType
    INNER JOIN Item i ON i.SKU = gm.SKU
    INNER JOIN Inventory inv ON inv.SKU = i.SKU AND inv.LocationID IN ${PIERCE_LOCATION_IDS}
    GROUP BY pkg.PackageType, pkg.Description, pkg.DefaultQty
    ORDER BY COUNT(DISTINCT i.SKU) DESC, LTRIM(RTRIM(pkg.Description)) ASC, pkg.PackageType ASC
  `);
  return result.recordset.map((r) => ({
    code: r.PackageType,
    label: normalizePackageTypeLabel({ code: r.PackageType, label: r.Description }),
    defaultQty: r.DefaultQty,
    pierceItems: Number(r.PierceItems),
  }));
}

export async function listColors(limit = 200): Promise<PrismColorRef[]> {
  const pool = await getPrismPool();
  const result = await pool.request().input("lim", sql.Int, limit).query<{
    ColorID: number;
    Description: string;
    PierceItems: number;
  }>(`
    SELECT TOP (@lim)
      c.ColorID,
      LTRIM(RTRIM(c.Description)) AS Description,
      COUNT(DISTINCT i.SKU) AS PierceItems
    FROM Color c
    INNER JOIN GeneralMerchandise gm ON gm.Color = c.ColorID
    INNER JOIN Item i ON i.SKU = gm.SKU
    INNER JOIN Inventory inv ON inv.SKU = i.SKU AND inv.LocationID IN ${PIERCE_LOCATION_IDS}
    GROUP BY c.ColorID, c.Description
    ORDER BY COUNT(DISTINCT i.SKU) DESC, LTRIM(RTRIM(c.Description)) ASC
  `);
  return result.recordset.map((r) => ({
    colorId: r.ColorID,
    label: r.Description,
    pierceItems: Number(r.PierceItems),
  }));
}

export async function listBindings(limit = 200): Promise<PrismBindingRef[]> {
  const pool = await getPrismPool();
  const result = await pool.request().input("lim", sql.Int, limit).query<{
    BindingID: number;
    Name: string;
    PierceBooks: number;
  }>(`
    SELECT TOP (@lim)
      b.BindingID,
      LTRIM(RTRIM(b.Name)) AS Name,
      COUNT(DISTINCT i.SKU) AS PierceBooks
    FROM Binding b
    INNER JOIN Textbook tb ON tb.BindingID = b.BindingID
    INNER JOIN Item i ON i.SKU = tb.SKU
    INNER JOIN Inventory inv ON inv.SKU = i.SKU AND inv.LocationID IN ${PIERCE_LOCATION_IDS}
    GROUP BY b.BindingID, b.Name
    ORDER BY COUNT(DISTINCT i.SKU) DESC, LTRIM(RTRIM(b.Name)) ASC
  `);
  return result.recordset.map((r) => ({
    bindingId: r.BindingID,
    label: r.Name,
    pierceBooks: Number(r.PierceBooks),
  }));
}
