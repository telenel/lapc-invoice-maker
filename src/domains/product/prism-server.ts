/**
 * Server-side Prism operations for the product domain.
 *
 * These functions wrap the WinPRISM SQL Server stored procedures and direct
 * INSERT/UPDATE/DELETE statements for catalog management. They are intended
 * to be called from API routes only.
 *
 * Authoritative reference: ~/memory/reference_prism_database.md
 *
 * Pierce-only by default — we hardcode LocationID=2 (PIER) for inventory rows
 * because that's the laportal's bookstore. If multi-location support is needed
 * later, accept LocationID as a parameter.
 */
import { getPrismPool, sql } from "@/lib/prism";

export const PIERCE_LOCATION_ID = 2;

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
  // Inventory at Pierce (LocationID=2)
  retail: number;
  cost: number;
}

export interface CreatedItem {
  sku: number;
  description: string;
  vendorId: number;
  dccId: number;
  barcode: string | null;
  retail: number;
  cost: number;
}

/**
 * Create a new General Merchandise item end-to-end:
 *   1. EXEC P_Item_Add_GM → creates Item + ItemMaster + GeneralMerchandise rows, returns new SKU
 *   2. INSERT into Inventory for Pierce with retail/cost
 *
 * Wrapped in a transaction so a failed inventory insert rolls back the item creation.
 */
export async function createGmItem(input: CreateGmItemInput): Promise<CreatedItem> {
  const pool = await getPrismPool();
  const transaction = pool.transaction();
  await transaction.begin();

  try {
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

    // Step 2: INSERT into Inventory
    const invRequest = transaction.request();
    invRequest.input("sku", sql.Int, newSku);
    invRequest.input("locationId", sql.Numeric(8, 0), PIERCE_LOCATION_ID);
    invRequest.input("retail", sql.Money, input.retail);
    invRequest.input("cost", sql.Money, input.cost);
    await invRequest.query(
      "INSERT INTO Inventory (SKU, LocationID, Retail, Cost) VALUES (@sku, @locationId, @retail, @cost)",
    );

    await transaction.commit();

    return {
      sku: newSku,
      description: input.description,
      vendorId: input.vendorId,
      dccId: input.dccId,
      barcode: input.barcode ?? null,
      retail: input.retail,
      cost: input.cost,
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

    // Order matters because of FKs
    await transaction.request().input("sku", sql.Int, sku)
      .query("DELETE FROM Inventory WHERE SKU = @sku");
    await transaction.request().input("sku", sql.Int, sku)
      .query("DELETE FROM GeneralMerchandise WHERE SKU = @sku");
    const result = await transaction.request().input("sku", sql.Int, sku)
      .query<{ affected: number }>(
        "DELETE FROM Item WHERE SKU = @sku; SELECT @@ROWCOUNT AS affected;",
      );

    await transaction.commit();
    return { affected: result.recordset[0]?.affected ?? 0 };
  } catch (err) {
    try { await transaction.rollback(); } catch { /* swallow */ }
    throw err;
  }
}

export interface PrismVendor { vendorId: number; name: string }
export interface PrismDcc { dccId: number; deptName: string; className: string | null }
export interface PrismTaxType { taxTypeId: number; description: string }

export async function listVendors(limit = 200): Promise<PrismVendor[]> {
  const pool = await getPrismPool();
  const result = await pool
    .request()
    .input("loc", sql.Int, PIERCE_LOCATION_ID)
    .input("lim", sql.Int, limit)
    .query<{ VendorID: number; Name: string }>(`
      SELECT TOP (@lim) v.VendorID, LTRIM(RTRIM(v.Name)) AS Name
      FROM VendorMaster v
      WHERE EXISTS (
        SELECT 1 FROM Item i
        INNER JOIN Inventory inv ON i.SKU = inv.SKU AND inv.LocationID = @loc
        WHERE i.VendorID = v.VendorID
      )
      ORDER BY v.Name
    `);
  return result.recordset.map((r) => ({ vendorId: r.VendorID, name: r.Name }));
}

export async function listDccs(limit = 500): Promise<PrismDcc[]> {
  const pool = await getPrismPool();
  const result = await pool.request().input("lim", sql.Int, limit).query<{
    DCCID: number;
    DeptName: string;
    ClassName: string | null;
  }>(`
    SELECT TOP (@lim) d.DCCID,
                      LTRIM(RTRIM(dep.DeptName)) AS DeptName,
                      LTRIM(RTRIM(cls.ClassName)) AS ClassName
    FROM DeptClassCat d
    LEFT JOIN DCC_Department dep ON d.Department = dep.Department
    LEFT JOIN DCC_Class cls ON d.Department = cls.Department AND d.Class = cls.Class
    WHERE d.DCCType = 3
    ORDER BY dep.DeptName, cls.ClassName
  `);
  return result.recordset.map((r) => ({
    dccId: r.DCCID,
    deptName: r.DeptName,
    className: r.ClassName,
  }));
}

export async function listTaxTypes(): Promise<PrismTaxType[]> {
  const pool = await getPrismPool();
  const result = await pool.request().query<{
    ItemTaxTypeID: number;
    Description: string;
  }>(`
    SELECT ItemTaxTypeID, LTRIM(RTRIM(Description)) AS Description
    FROM Item_Tax_Type
    ORDER BY ItemTaxTypeID
  `);
  return result.recordset.map((r) => ({
    taxTypeId: r.ItemTaxTypeID,
    description: r.Description,
  }));
}
