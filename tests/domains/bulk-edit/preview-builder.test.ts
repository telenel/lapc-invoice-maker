import { describe, it, expect } from "vitest";
import { buildPreview } from "@/domains/bulk-edit/preview-builder";
import type { BulkEditSourceRow, BulkEditTransform } from "@/domains/bulk-edit/types";

function row(overrides: Partial<BulkEditSourceRow> = {}): BulkEditSourceRow {
  return {
    sku: 1,
    description: "TEST",
    barcode: "UPC",
    retail: 10,
    cost: 5,
    vendorId: 21,
    dccId: 100,
    itemTaxTypeId: 6,
    itemType: "general_merchandise",
    fDiscontinue: 0,
    ...overrides,
  };
}

describe("buildPreview", () => {
  it("rejects empty selection", () => {
    const result = buildPreview([], { pricing: { mode: "uplift", percent: 5 }, catalog: {} });
    expect(result.rows).toEqual([]);
    expect(result.warnings.some((w) => w.code === "NEGATIVE_MARGIN")).toBe(false);
  });

  it("sums pricing delta across rows in cents", () => {
    const t: BulkEditTransform = { pricing: { mode: "uplift", percent: 10 }, catalog: {} };
    const rows = [row({ sku: 1, retail: 10 }), row({ sku: 2, retail: 20 })];
    const result = buildPreview(rows, t);
    // Row 1: 10 -> 11 (+1.00 = 100 cents). Row 2: 20 -> 22 (+2.00 = 200 cents). Total = 300.
    expect(result.totals.pricingDeltaCents).toBe(300);
    expect(result.totals.rowCount).toBe(2);
  });

  it("counts district changes only on rows where the field actually changes", () => {
    const t: BulkEditTransform = { pricing: { mode: "none" }, catalog: { dccId: 200 } };
    const rows = [row({ sku: 1, dccId: 100 }), row({ sku: 2, dccId: 200 })];
    const result = buildPreview(rows, t);
    expect(result.totals.districtChangeCount).toBe(1);
  });

  it("emits a batch-level warning when selection spans multiple DCCs and the transform sets a single DCC", () => {
    const t: BulkEditTransform = { pricing: { mode: "none" }, catalog: { dccId: 999 } };
    const rows = [row({ sku: 1, dccId: 100 }), row({ sku: 2, dccId: 200 })];
    const result = buildPreview(rows, t);
    expect(result.warnings.some((w) => w.message.toLowerCase().includes("multiple"))).toBe(true);
  });
});
