import { describe, it, expect } from "vitest";
import { validateBatchCreateShape, validateBatchUpdateShape } from "@/domains/product/batch-validation";
import type { BatchCreateRow, BatchUpdateRow } from "@/domains/product/types";

function row(overrides: Partial<BatchCreateRow> = {}): BatchCreateRow {
  return {
    description: "Test",
    vendorId: 21,
    dccId: 1968650,
    retail: 10,
    cost: 5,
    ...overrides,
  };
}

describe("validateBatchCreateShape", () => {
  it("accepts a clean row", () => {
    expect(validateBatchCreateShape([row()])).toEqual([]);
  });

  it("flags missing dccId", () => {
    const errors = validateBatchCreateShape([row({ dccId: 0 })]);
    expect(errors).toContainEqual(
      expect.objectContaining({ rowIndex: 0, field: "dccId", code: "MISSING_REQUIRED" }),
    );
  });

  it("flags missing vendorId", () => {
    const errors = validateBatchCreateShape([row({ vendorId: 0 })]);
    expect(errors).toContainEqual(
      expect.objectContaining({ rowIndex: 0, field: "vendorId", code: "MISSING_REQUIRED" }),
    );
  });

  it("flags missing description", () => {
    const errors = validateBatchCreateShape([row({ description: "" })]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ rowIndex: 0, field: "description", code: "MISSING_REQUIRED" });
  });

  it("flags description too long", () => {
    const errors = validateBatchCreateShape([row({ description: "x".repeat(129) })]);
    expect(errors[0].code).toBe("DESCRIPTION_TOO_LONG");
  });

  it("flags barcode too long", () => {
    const errors = validateBatchCreateShape([row({ barcode: "x".repeat(21) })]);
    expect(errors[0].code).toBe("BARCODE_TOO_LONG");
  });

  it("flags negative price", () => {
    const errors = validateBatchCreateShape([row({ retail: -1 })]);
    expect(errors[0].code).toBe("NEGATIVE_PRICE");
  });

  it("flags negative cost", () => {
    const errors = validateBatchCreateShape([row({ cost: -1 })]);
    expect(errors[0].code).toBe("NEGATIVE_COST");
  });

  it("flags duplicate barcode within a batch", () => {
    const errors = validateBatchCreateShape([
      row({ barcode: "DUP" }),
      row({ barcode: "DUP" }),
    ]);
    const dupErrors = errors.filter((e) => e.code === "DUPLICATE_BARCODE");
    expect(dupErrors).toHaveLength(2);
    expect(dupErrors.map((e) => e.rowIndex).sort()).toEqual([0, 1]);
  });

  it("does not flag empty barcodes as duplicates", () => {
    const errors = validateBatchCreateShape([
      row({ barcode: "" }),
      row({ barcode: "" }),
      row({ barcode: null }),
    ]);
    expect(errors.filter((e) => e.code === "DUPLICATE_BARCODE")).toHaveLength(0);
  });

  it("reports row index for each error", () => {
    const errors = validateBatchCreateShape([
      row(),
      row({ description: "" }),
      row({ retail: -5 }),
    ]);
    expect(errors.map((e) => e.rowIndex).sort()).toEqual([1, 2]);
  });

  it("requires the canonical PIER inventory row when inventory is provided", () => {
    const errors = validateBatchCreateShape([
      row({
        inventory: [
          { locationId: 3, retail: 10, cost: 5 },
          { locationId: 4, retail: 10, cost: 5 },
        ],
      }),
    ]);

    expect(errors).toContainEqual(
      expect.objectContaining({
        rowIndex: 0,
        field: "inventory",
        code: "MISSING_REQUIRED",
        message: "Inventory must include the canonical PIER row",
      }),
    );
  });
});

describe("validateBatchUpdateShape", () => {
  it("accepts a clean update", () => {
    const rows: BatchUpdateRow[] = [{ sku: 100, patch: { retail: 12 } }];
    expect(validateBatchUpdateShape(rows)).toEqual([]);
  });

  it("flags missing SKU and skips other checks on that row", () => {
    const rows: BatchUpdateRow[] = [{ sku: 0, patch: { retail: -1 } }];
    const errors = validateBatchUpdateShape(rows);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ field: "sku", code: "MISSING_REQUIRED" });
  });

  it("flags negative retail in patch", () => {
    const rows: BatchUpdateRow[] = [{ sku: 100, patch: { retail: -1 } }];
    const errors = validateBatchUpdateShape(rows);
    expect(errors[0].code).toBe("NEGATIVE_PRICE");
  });

  it("flags negative cost in patch", () => {
    const rows: BatchUpdateRow[] = [{ sku: 100, patch: { cost: -1 } }];
    const errors = validateBatchUpdateShape(rows);
    expect(errors[0].code).toBe("NEGATIVE_COST");
  });

  it("flags over-long description in patch", () => {
    const rows: BatchUpdateRow[] = [{ sku: 100, patch: { description: "x".repeat(129) } }];
    const errors = validateBatchUpdateShape(rows);
    expect(errors[0].code).toBe("DESCRIPTION_TOO_LONG");
  });

  it("flags over-long barcode in patch", () => {
    const rows: BatchUpdateRow[] = [{ sku: 100, patch: { barcode: "x".repeat(21) } }];
    const errors = validateBatchUpdateShape(rows);
    expect(errors[0].code).toBe("BARCODE_TOO_LONG");
  });

  it("flags over-long imageUrl in patch with IMAGE_URL_TOO_LONG code", () => {
    const rows: BatchUpdateRow[] = [{ sku: 100, patch: { imageUrl: "x".repeat(129) } }];
    const errors = validateBatchUpdateShape(rows);
    expect(errors[0].code).toBe("IMAGE_URL_TOO_LONG");
  });

  it("produces no errors when patch only contains unrelated fields", () => {
    const rows: BatchUpdateRow[] = [{ sku: 100, patch: { vendorId: 21 } }];
    expect(validateBatchUpdateShape(rows)).toEqual([]);
  });
});
