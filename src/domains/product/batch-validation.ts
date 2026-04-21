import type { BatchCreateRow, BatchUpdateRow, BatchValidationError } from "./types";

const MAX_DESCRIPTION = 128;
const MAX_BARCODE = 20;
const MAX_COMMENT = 25;
const MAX_CATALOG = 30;
const MAX_IMAGE_URL = 128;

export function validateBatchCreateShape(rows: BatchCreateRow[]): BatchValidationError[] {
  const errors: BatchValidationError[] = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!r.description || r.description.trim().length === 0) {
      errors.push({ rowIndex: i, field: "description", code: "MISSING_REQUIRED", message: "Description is required" });
    } else if (r.description.length > MAX_DESCRIPTION) {
      errors.push({ rowIndex: i, field: "description", code: "DESCRIPTION_TOO_LONG", message: `Description must be ≤ ${MAX_DESCRIPTION} characters` });
    }
    if (!r.vendorId) {
      errors.push({ rowIndex: i, field: "vendorId", code: "MISSING_REQUIRED", message: "Vendor is required" });
    }
    if (!r.dccId) {
      errors.push({ rowIndex: i, field: "dccId", code: "MISSING_REQUIRED", message: "DCC is required" });
    }
    if (r.barcode && r.barcode.length > MAX_BARCODE) {
      errors.push({ rowIndex: i, field: "barcode", code: "BARCODE_TOO_LONG", message: `Barcode must be ≤ ${MAX_BARCODE} characters` });
    }
    if (r.comment && r.comment.length > MAX_COMMENT) {
      errors.push({ rowIndex: i, field: "comment", code: "COMMENT_TOO_LONG", message: `Comment must be ≤ ${MAX_COMMENT} characters` });
    }
    if (r.catalogNumber && r.catalogNumber.length > MAX_CATALOG) {
      errors.push({ rowIndex: i, field: "catalogNumber", code: "CATALOG_TOO_LONG", message: `Catalog number must be ≤ ${MAX_CATALOG} characters` });
    }
    if (typeof r.retail !== "number" || r.retail < 0) {
      errors.push({ rowIndex: i, field: "retail", code: "NEGATIVE_PRICE", message: "Retail must be ≥ 0" });
    }
    if (typeof r.cost !== "number" || r.cost < 0) {
      errors.push({ rowIndex: i, field: "cost", code: "NEGATIVE_COST", message: "Cost must be ≥ 0" });
    }
    if (r.inventory) {
      const seenLocations = new Set<number>();
      for (const inventoryRow of r.inventory) {
        if (inventoryRow.locationId !== 2 && inventoryRow.locationId !== 3 && inventoryRow.locationId !== 4) {
          errors.push({
            rowIndex: i,
            field: "inventory",
            code: "MISSING_REQUIRED",
            message: `Inventory location ${inventoryRow.locationId} is out of scope`,
          });
        }
        if (seenLocations.has(inventoryRow.locationId)) {
          errors.push({
            rowIndex: i,
            field: "inventory",
            code: "MISSING_REQUIRED",
            message: `Duplicate inventory location ${inventoryRow.locationId}`,
          });
        }
        seenLocations.add(inventoryRow.locationId);
        if (typeof inventoryRow.retail !== "number" || inventoryRow.retail < 0) {
          errors.push({ rowIndex: i, field: "inventory", code: "NEGATIVE_PRICE", message: "Inventory retail must be ≥ 0" });
        }
        if (typeof inventoryRow.cost !== "number" || inventoryRow.cost < 0) {
          errors.push({ rowIndex: i, field: "inventory", code: "NEGATIVE_COST", message: "Inventory cost must be ≥ 0" });
        }
      }
    }
  }

  // Duplicate barcodes within batch (ignore empty/null)
  const seen = new Map<string, number[]>();
  rows.forEach((r, i) => {
    const bc = (r.barcode ?? "").trim();
    if (!bc) return;
    const list = seen.get(bc) ?? [];
    list.push(i);
    seen.set(bc, list);
  });
  seen.forEach((indices, bc) => {
    if (indices.length > 1) {
      indices.forEach((i) => {
        errors.push({
          rowIndex: i,
          field: "barcode",
          code: "DUPLICATE_BARCODE",
          message: `Barcode '${bc}' appears on rows ${indices.map((x) => x + 1).join(", ")}`,
        });
      });
    }
  });

  return errors;
}

export function validateBatchUpdateShape(rows: BatchUpdateRow[]): BatchValidationError[] {
  const errors: BatchValidationError[] = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!r.sku || r.sku <= 0) {
      errors.push({ rowIndex: i, field: "sku", code: "MISSING_REQUIRED", message: "SKU is required" });
      continue;
    }
    const p = r.patch;
    if (p.retail !== undefined && p.retail < 0) {
      errors.push({ rowIndex: i, field: "retail", code: "NEGATIVE_PRICE", message: "Retail must be ≥ 0" });
    }
    if (p.cost !== undefined && p.cost < 0) {
      errors.push({ rowIndex: i, field: "cost", code: "NEGATIVE_COST", message: "Cost must be ≥ 0" });
    }
    if ("description" in p && p.description !== undefined && p.description.length > MAX_DESCRIPTION) {
      errors.push({ rowIndex: i, field: "description", code: "DESCRIPTION_TOO_LONG", message: `Description must be ≤ ${MAX_DESCRIPTION} characters` });
    }
    if (p.barcode !== undefined && p.barcode !== null && p.barcode.length > MAX_BARCODE) {
      errors.push({ rowIndex: i, field: "barcode", code: "BARCODE_TOO_LONG", message: `Barcode must be ≤ ${MAX_BARCODE} characters` });
    }
    if ("imageUrl" in p && p.imageUrl !== undefined && p.imageUrl !== null && p.imageUrl.length > MAX_IMAGE_URL) {
      errors.push({ rowIndex: i, field: "imageUrl", code: "IMAGE_URL_TOO_LONG", message: `Image URL must be ≤ ${MAX_IMAGE_URL} characters` });
    }
  }
  return errors;
}
