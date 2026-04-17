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
      errors.push({ rowIndex: i, field: "comment", code: "DESCRIPTION_TOO_LONG", message: `Comment must be ≤ ${MAX_COMMENT} characters` });
    }
    if (r.catalogNumber && r.catalogNumber.length > MAX_CATALOG) {
      errors.push({ rowIndex: i, field: "catalogNumber", code: "DESCRIPTION_TOO_LONG", message: `Catalog number must be ≤ ${MAX_CATALOG} characters` });
    }
    if (typeof r.retail !== "number" || r.retail < 0) {
      errors.push({ rowIndex: i, field: "retail", code: "NEGATIVE_PRICE", message: "Retail must be ≥ 0" });
    }
    if (typeof r.cost !== "number" || r.cost < 0) {
      errors.push({ rowIndex: i, field: "cost", code: "NEGATIVE_COST", message: "Cost must be ≥ 0" });
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
  for (const [bc, indices] of seen) {
    if (indices.length > 1) {
      for (const i of indices) {
        errors.push({
          rowIndex: i,
          field: "barcode",
          code: "DUPLICATE_BARCODE",
          message: `Barcode '${bc}' appears on rows ${indices.map((x) => x + 1).join(", ")}`,
        });
      }
    }
  }

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
    const p = r.patch as Record<string, unknown>;
    if (typeof p.retail === "number" && p.retail < 0) {
      errors.push({ rowIndex: i, field: "retail", code: "NEGATIVE_PRICE", message: "Retail must be ≥ 0" });
    }
    if (typeof p.cost === "number" && p.cost < 0) {
      errors.push({ rowIndex: i, field: "cost", code: "NEGATIVE_COST", message: "Cost must be ≥ 0" });
    }
    if (typeof p.description === "string" && p.description.length > MAX_DESCRIPTION) {
      errors.push({ rowIndex: i, field: "description", code: "DESCRIPTION_TOO_LONG", message: `Description must be ≤ ${MAX_DESCRIPTION} characters` });
    }
    if (typeof p.barcode === "string" && p.barcode.length > MAX_BARCODE) {
      errors.push({ rowIndex: i, field: "barcode", code: "BARCODE_TOO_LONG", message: `Barcode must be ≤ ${MAX_BARCODE} characters` });
    }
    if (typeof p.imageUrl === "string" && p.imageUrl.length > MAX_IMAGE_URL) {
      errors.push({ rowIndex: i, field: "imageUrl", code: "DESCRIPTION_TOO_LONG", message: `Image URL must be ≤ ${MAX_IMAGE_URL} characters` });
    }
  }
  return errors;
}
