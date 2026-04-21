/**
 * Batch writes to Prism. `batchCreateGmItems`, `batchHardDeleteItems`, and
 * `batchUpdateItems` each run under a single Prism transaction — any row-
 * level failure rolls back every row in the batch. `batchUpdateItems` also
 * accepts per-row `baseline` snapshots for optimistic concurrency; failures
 * throw with `code: "CONCURRENT_MODIFICATION"` and `rowIndex`.
 *
 * Pre-validation (FK existence, duplicate-barcode against live Prism) is in
 * validateBatchAgainstPrism; shape validation is in batch-validation.ts.
 */
import { getPrismPool, sql } from "@/lib/prism";
import type {
  BatchCreateRow,
  BatchUpdateRow,
  BatchUpdateRowWithBaseline,
  BatchValidationError,
  GmItemPatch,
} from "./types";
import { PIERCE_LOCATION_ID } from "./prism-server";
import { applyItemPatchInTransaction } from "./prism-updates";
import { hasTransactionHistory } from "./prism-delete";
import { validateBatchCreateShape, validateBatchUpdateShape } from "./batch-validation";

/**
 * Find which of the given barcodes already exist in Prism. Used by batch
 * pre-validation. Empty/null barcodes are skipped.
 */
export async function findExistingBarcodes(
  barcodes: string[],
): Promise<Map<string, number>> {
  const cleaned = Array.from(new Set(barcodes.map((b) => b.trim()).filter(Boolean)));
  if (cleaned.length === 0) return new Map();

  const pool = await getPrismPool();
  const request = pool.request();
  const params = cleaned.map((_, i) => `@bc${i}`);
  cleaned.forEach((bc, i) => request.input(`bc${i}`, sql.VarChar(20), bc));

  const result = await request.query<{ SKU: number; BarCode: string }>(
    `SELECT SKU, LTRIM(RTRIM(BarCode)) AS BarCode FROM Item WHERE BarCode IN (${params.join(", ")})`,
  );
  const out = new Map<string, number>();
  for (const row of result.recordset) {
    out.set(row.BarCode, row.SKU);
  }
  return out;
}

/**
 * Verify the given FK ids exist in Prism. Returns the subset that are missing.
 */
export async function findMissingRefs(
  vendorIds: number[],
  dccIds: number[],
  taxTypeIds: number[],
): Promise<{ missingVendors: Set<number>; missingDccs: Set<number>; missingTax: Set<number> }> {
  const pool = await getPrismPool();

  async function existingSet(
    ids: number[],
    table: string,
    pk: string,
  ): Promise<Set<number>> {
    const unique = Array.from(new Set(ids)).filter((n) => Number.isFinite(n) && n > 0);
    if (unique.length === 0) return new Set();
    const req = pool.request();
    const params = unique.map((_, i) => `@id${i}`);
    unique.forEach((id, i) => req.input(`id${i}`, sql.Int, id));
    const result = await req.query<Record<string, number>>(
      `SELECT ${pk} AS id FROM ${table} WHERE ${pk} IN (${params.join(", ")})`,
    );
    return new Set(result.recordset.map((r) => r.id));
  }

  const [existingV, existingD, existingT] = await Promise.all([
    existingSet(vendorIds, "VendorMaster", "VendorID"),
    existingSet(dccIds, "DeptClassCat", "DCCID"),
    existingSet(taxTypeIds, "Item_Tax_Type", "ItemTaxTypeID"),
  ]);

  return {
    missingVendors: new Set(vendorIds.filter((v) => v && !existingV.has(v))),
    missingDccs: new Set(dccIds.filter((d) => d && !existingD.has(d))),
    missingTax: new Set(taxTypeIds.filter((t) => t && !existingT.has(t))),
  };
}

/**
 * Create N GM items in one transaction. Uses the same P_Item_Add_GM + Inventory
 * insert path as createGmItem. Returns the array of created SKUs.
 */
export async function batchCreateGmItems(rows: BatchCreateRow[]): Promise<number[]> {
  const pool = await getPrismPool();
  const transaction = pool.transaction();
  await transaction.begin();

  const createdSkus: number[] = [];

  try {
    for (const input of rows) {
      const inventoryRows = input.inventory && input.inventory.length > 0
        ? input.inventory
        : [{ locationId: PIERCE_LOCATION_ID, retail: input.retail, cost: input.cost }];
      const canonicalInventoryRows = inventoryRows.some((row) => row.locationId === PIERCE_LOCATION_ID)
        ? inventoryRows
        : [{ locationId: PIERCE_LOCATION_ID, retail: input.retail, cost: input.cost }, ...inventoryRows];

      const addReq = transaction.request();
      addReq.input("MfgId", sql.Int, input.vendorId);
      addReq.input("Description", sql.VarChar(128), input.description);
      addReq.input("Color", sql.Int, 0);
      addReq.input("SizeId", sql.Int, 0);
      addReq.input("CatalogNumber", sql.VarChar(30), input.catalogNumber ?? "");
      addReq.input("PackageType", sql.VarChar(3), input.packageType ?? "");
      addReq.input("UnitsPerPack", sql.SmallInt, input.unitsPerPack ?? 1);
      addReq.input("DccId", sql.Int, input.dccId);
      addReq.input("ItemTaxTypeId", sql.Int, input.itemTaxTypeId ?? 6);
      addReq.input("Comment", sql.VarChar(25), input.comment ?? "");
      addReq.input("VendorId", sql.Int, input.vendorId);
      addReq.input("Weight", sql.Decimal(9, 4), 0);
      addReq.input("ImageURL", sql.VarChar(128), "");
      addReq.input("DiscCodeId", sql.Int, 0);
      addReq.input("BarCode", sql.VarChar(20), input.barcode ?? "");

      const result = await addReq.execute<{ SKU?: number }>("P_Item_Add_GM");
      const firstRow = result.recordsets?.[0]?.[0] as Record<string, unknown> | undefined;
      const newSku = firstRow ? Number(Object.values(firstRow)[0]) : NaN;
      if (!Number.isFinite(newSku) || newSku <= 0) {
        throw new Error(`P_Item_Add_GM did not return a valid SKU for row "${input.description}"`);
      }

      for (const inventoryRow of canonicalInventoryRows) {
        await transaction.request()
          .input("sku", sql.Int, newSku)
          .input("loc", sql.Numeric(8, 0), inventoryRow.locationId)
          .input("retail", sql.Money, inventoryRow.retail)
          .input("cost", sql.Money, inventoryRow.cost)
          .query("INSERT INTO Inventory (SKU, LocationID, Retail, Cost) VALUES (@sku, @loc, @retail, @cost)");
      }

      createdSkus.push(newSku);
    }

    await transaction.commit();
    return createdSkus;
  } catch (err) {
    try { await transaction.rollback(); } catch { /* swallow */ }
    throw err;
  }
}

/**
 * Apply N item edits in ONE Prism transaction. Each row's baseline is
 * checked inside the transaction before its UPDATE; any throw (concurrency
 * mismatch or SQL failure) rolls back every row. Caller gets zero
 * partial-commit hazard.
 *
 * Concurrency errors carry `code: "CONCURRENT_MODIFICATION"`, `rowIndex`
 * (the index of the row that failed, 0-based), `sku`, and `current` (the
 * ItemSnapshot the server actually saw).
 */
export async function batchUpdateItems(
  rows: BatchUpdateRowWithBaseline[],
): Promise<number[]> {
  if (rows.length === 0) return [];
  const pool = await getPrismPool();
  const transaction = pool.transaction();
  await transaction.begin();

  const updated: number[] = [];
  try {
    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i];
      try {
        await applyItemPatchInTransaction(transaction, {
          sku: row.sku,
          isTextbook: row.isTextbook ?? false,
          patch: row.patch,
          baseline: row.baseline,
        });
        updated.push(row.sku);
      } catch (err) {
        // Attach rowIndex + sku so the route can shape a precise 409 payload.
        // Wrap non-Error throws (drivers rarely produce these, but defensive)
        // so the annotation always reaches the route layer — if the caller
        // can't tell which row failed, the dialog can't show a useful
        // message.
        const annotated = err instanceof Error ? err : new Error(String(err));
        (annotated as Error & { rowIndex?: number; sku?: number; cause?: unknown }).rowIndex = i;
        (annotated as Error & { rowIndex?: number; sku?: number; cause?: unknown }).sku = row.sku;
        if (!(err instanceof Error)) {
          (annotated as Error & { cause?: unknown }).cause = err;
        }
        throw annotated;
      }
    }
    await transaction.commit();
    return updated;
  } catch (err) {
    try { await transaction.rollback(); } catch { /* swallow */ }
    throw err;
  }
}

/**
 * Soft-delete (fDiscontinue=1) a batch of SKUs in one statement.
 */
export async function batchDiscontinueItems(skus: number[]): Promise<number[]> {
  if (skus.length === 0) return [];
  const pool = await getPrismPool();
  const request = pool.request();
  const params = skus.map((_, i) => `@s${i}`);
  skus.forEach((sku, i) => request.input(`s${i}`, sql.Int, sku));
  await request.query(`UPDATE Item SET fDiscontinue = 1 WHERE SKU IN (${params.join(", ")})`);
  return skus;
}

/**
 * Hard-delete a batch of SKUs. All must pass the history-check guard; if any
 * SKU has history, the whole batch is rejected before any deletion runs.
 */
export async function batchHardDeleteItems(skus: number[]): Promise<number[]> {
  if (skus.length === 0) return [];
  const history = await hasTransactionHistory(skus);
  const blocked = skus.filter((s) => history.has(s));
  if (blocked.length > 0) {
    const err = new Error(`SKUs with history cannot be hard-deleted: ${blocked.join(", ")}`) as Error & { code: string; blocked: number[] };
    err.code = "HAS_HISTORY";
    err.blocked = blocked;
    throw err;
  }

  const pool = await getPrismPool();
  const transaction = pool.transaction();
  await transaction.begin();

  try {
    // Pre-verify every SKU exists (same Item-trigger workaround)
    const checkReq = transaction.request();
    const params = skus.map((_, i) => `@s${i}`);
    skus.forEach((sku, i) => checkReq.input(`s${i}`, sql.Int, sku));
    const check = await checkReq.query<{ SKU: number }>(
      `SELECT SKU FROM Item WHERE SKU IN (${params.join(", ")})`,
    );
    const existing = new Set(check.recordset.map((r) => r.SKU));
    const missing = skus.filter((s) => !existing.has(s));
    if (missing.length > 0) {
      throw new Error(`SKUs not found: ${missing.join(", ")}`);
    }

    // Delete in FK order
    const invReq = transaction.request();
    skus.forEach((sku, i) => invReq.input(`s${i}`, sql.Int, sku));
    await invReq.query(`DELETE FROM Inventory WHERE SKU IN (${params.join(", ")})`);

    const gmReq = transaction.request();
    skus.forEach((sku, i) => gmReq.input(`s${i}`, sql.Int, sku));
    await gmReq.query(`DELETE FROM GeneralMerchandise WHERE SKU IN (${params.join(", ")})`);

    const itemReq = transaction.request();
    skus.forEach((sku, i) => itemReq.input(`s${i}`, sql.Int, sku));
    await itemReq.query(`DELETE FROM Item WHERE SKU IN (${params.join(", ")})`);

    await transaction.commit();
    return skus;
  } catch (err) {
    try { await transaction.rollback(); } catch { /* swallow */ }
    throw err;
  }
}

/**
 * Full batch-create validation: pure shape checks + live FK checks + live
 * duplicate-barcode lookup. Returns all errors in one pass.
 */
export async function validateBatchCreateAgainstPrism(
  rows: BatchCreateRow[],
): Promise<BatchValidationError[]> {
  const shapeErrors = validateBatchCreateShape(rows);

  const [refs, existingBarcodes] = await Promise.all([
    findMissingRefs(
      rows.map((r) => r.vendorId),
      rows.map((r) => r.dccId),
      rows.map((r) => r.itemTaxTypeId ?? 6),
    ),
    findExistingBarcodes(rows.map((r) => r.barcode ?? "").filter((b): b is string => !!b)),
  ]);

  const live: BatchValidationError[] = [];
  rows.forEach((r, i) => {
    if (r.vendorId && refs.missingVendors.has(r.vendorId)) {
      live.push({ rowIndex: i, field: "vendorId", code: "INVALID_VENDOR", message: `Vendor ${r.vendorId} does not exist in Prism` });
    }
    if (r.dccId && refs.missingDccs.has(r.dccId)) {
      live.push({ rowIndex: i, field: "dccId", code: "INVALID_DCC", message: `DCC ${r.dccId} does not exist in Prism` });
    }
    const tax = r.itemTaxTypeId ?? 6;
    if (tax && refs.missingTax.has(tax)) {
      live.push({ rowIndex: i, field: "itemTaxTypeId", code: "INVALID_TAX_TYPE", message: `Tax type ${tax} does not exist in Prism` });
    }
    const bc = (r.barcode ?? "").trim();
    if (bc && existingBarcodes.has(bc)) {
      live.push({ rowIndex: i, field: "barcode", code: "DUPLICATE_BARCODE", message: `Barcode '${bc}' already exists in Prism (SKU ${existingBarcodes.get(bc)})` });
    }
  });

  return [...shapeErrors, ...live];
}

export async function validateBatchUpdateAgainstPrism(
  rows: BatchUpdateRow[],
): Promise<BatchValidationError[]> {
  const shapeErrors = validateBatchUpdateShape(rows);
  // For update, we only check FKs when the patch tries to change them; barcode
  // duplicates are checked against everything OTHER than the row's own SKU.
  const vendorIds = rows.map((r) => (r.patch as GmItemPatch).vendorId ?? 0).filter((v) => v > 0);
  const dccIds = rows.map((r) => (r.patch as GmItemPatch).dccId ?? 0).filter((d) => d > 0);
  const taxIds = rows.map((r) => (r.patch as GmItemPatch).itemTaxTypeId ?? 0).filter((t) => t > 0);
  const barcodes = rows
    .map((r) => (r.patch as GmItemPatch).barcode ?? "")
    .filter((b): b is string => typeof b === "string" && b.length > 0);

  const [refs, existingBarcodes] = await Promise.all([
    findMissingRefs(vendorIds, dccIds, taxIds),
    findExistingBarcodes(barcodes),
  ]);

  const live: BatchValidationError[] = [];
  rows.forEach((r, i) => {
    const p = r.patch as GmItemPatch;
    if (p.vendorId && refs.missingVendors.has(p.vendorId)) {
      live.push({ rowIndex: i, field: "vendorId", code: "INVALID_VENDOR", message: `Vendor ${p.vendorId} does not exist` });
    }
    if (p.dccId && refs.missingDccs.has(p.dccId)) {
      live.push({ rowIndex: i, field: "dccId", code: "INVALID_DCC", message: `DCC ${p.dccId} does not exist` });
    }
    if (p.itemTaxTypeId && refs.missingTax.has(p.itemTaxTypeId)) {
      live.push({ rowIndex: i, field: "itemTaxTypeId", code: "INVALID_TAX_TYPE", message: `Tax type ${p.itemTaxTypeId} does not exist` });
    }
    if (p.barcode) {
      const owner = existingBarcodes.get(p.barcode.trim());
      if (owner !== undefined && owner !== r.sku) {
        live.push({ rowIndex: i, field: "barcode", code: "DUPLICATE_BARCODE", message: `Barcode '${p.barcode}' is used by SKU ${owner}` });
      }
    }
  });

  return [...shapeErrors, ...live];
}
