import { describe, it, expect } from "vitest";
import { validateBatchCreateShape } from "@/domains/product/batch-validation";
import type { BatchCreateRow } from "@/domains/product/types";

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
});
