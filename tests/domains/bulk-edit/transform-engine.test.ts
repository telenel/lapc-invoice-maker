import { describe, it, expect } from "vitest";
import { applyTransform, validateTransform } from "@/domains/bulk-edit/transform-engine";
import type { BulkEditSourceRow, BulkEditTransform } from "@/domains/bulk-edit/types";

function row(overrides: Partial<BulkEditSourceRow> = {}): BulkEditSourceRow {
  return {
    sku: 100001,
    description: "TEST ITEM",
    barcode: "UPC1",
    retail: 10.0,
    cost: 5.0,
    vendorId: 21,
    dccId: 1968650,
    itemTaxTypeId: 6,
    itemType: "general_merchandise",
    fDiscontinue: 0,
    ...overrides,
  };
}

describe("applyTransform — pricing modes", () => {
  it("none leaves retail/cost unchanged", () => {
    const t: BulkEditTransform = { pricing: { mode: "none" }, catalog: {} };
    const result = applyTransform(row(), t);
    expect(result.after.retail).toBe(10);
    expect(result.after.cost).toBe(5);
    expect(result.changedFields).toEqual([]);
  });

  it("uplift 5% raises retail by 5 percent, rounded to 2 decimals", () => {
    const t: BulkEditTransform = { pricing: { mode: "uplift", percent: 5 }, catalog: {} };
    const result = applyTransform(row({ retail: 10.0 }), t);
    expect(result.after.retail).toBe(10.5);
    expect(result.changedFields).toContain("retail");
  });

  it("uplift -10% lowers retail", () => {
    const t: BulkEditTransform = { pricing: { mode: "uplift", percent: -10 }, catalog: {} };
    const result = applyTransform(row({ retail: 20 }), t);
    expect(result.after.retail).toBe(18);
  });

  it("absolute set applies the same retail to every row", () => {
    const t: BulkEditTransform = { pricing: { mode: "absolute", retail: 12.99 }, catalog: {} };
    const result = applyTransform(row({ retail: 3 }), t);
    expect(result.after.retail).toBe(12.99);
  });

  it("margin mode sets retail = cost / (1 - margin)", () => {
    const t: BulkEditTransform = { pricing: { mode: "margin", targetMargin: 0.4 }, catalog: {} };
    const result = applyTransform(row({ cost: 6 }), t);
    expect(result.after.retail).toBe(10); // 6 / 0.6
  });

  it("cost absolute without preserveMargin updates only cost", () => {
    const t: BulkEditTransform = {
      pricing: { mode: "cost", newCost: { kind: "absolute", value: 8.5 }, preserveMargin: false },
      catalog: {},
    };
    const result = applyTransform(row({ cost: 5, retail: 10 }), t);
    expect(result.after.cost).toBe(8.5);
    expect(result.after.retail).toBe(10);
  });

  it("cost absolute WITH preserveMargin updates cost and recomputes retail to preserve current margin", () => {
    // Current margin on retail=10, cost=5 is 50%. New cost 6 -> new retail = 6 / 0.5 = 12
    const t: BulkEditTransform = {
      pricing: { mode: "cost", newCost: { kind: "absolute", value: 6 }, preserveMargin: true },
      catalog: {},
    };
    const result = applyTransform(row({ cost: 5, retail: 10 }), t);
    expect(result.after.cost).toBe(6);
    expect(result.after.retail).toBe(12);
  });

  it("cost uplift with preserveMargin", () => {
    // 3% cost uplift on 5 = 5.15; current margin 50%; new retail = 5.15 / 0.5 = 10.30
    const t: BulkEditTransform = {
      pricing: { mode: "cost", newCost: { kind: "uplift", percent: 3 }, preserveMargin: true },
      catalog: {},
    };
    const result = applyTransform(row({ cost: 5, retail: 10 }), t);
    expect(result.after.cost).toBe(5.15);
    expect(result.after.retail).toBe(10.3);
  });
});

describe("applyTransform — warnings", () => {
  it("warns when resulting retail < resulting cost", () => {
    const t: BulkEditTransform = { pricing: { mode: "absolute", retail: 3 }, catalog: {} };
    const result = applyTransform(row({ cost: 5, retail: 10 }), t);
    expect(result.warnings.some((w) => w.code === "NEGATIVE_MARGIN")).toBe(true);
  });

  it("warns on zero retail in margin mode (cannot derive margin)", () => {
    const t: BulkEditTransform = {
      pricing: { mode: "cost", newCost: { kind: "absolute", value: 6 }, preserveMargin: true },
      catalog: {},
    };
    const result = applyTransform(row({ retail: 0, cost: 5 }), t);
    expect(result.warnings.some((w) => w.code === "ZERO_RETAIL_FOR_MARGIN_MODE")).toBe(true);
  });

  it("warns on >50% jump for absolute set", () => {
    const t: BulkEditTransform = { pricing: { mode: "absolute", retail: 20 }, catalog: {} };
    const result = applyTransform(row({ retail: 10 }), t);
    expect(result.warnings.some((w) => w.code === "LARGE_PRICE_JUMP")).toBe(true);
  });

  it("warns when row is already discontinued", () => {
    const t: BulkEditTransform = { pricing: { mode: "uplift", percent: 5 }, catalog: {} };
    const result = applyTransform(row({ fDiscontinue: 1 }), t);
    expect(result.warnings.some((w) => w.code === "DISCONTINUED_ITEM")).toBe(true);
  });
});

describe("applyTransform — catalog metadata", () => {
  it("applies DCC change and records it as a changed field", () => {
    const t: BulkEditTransform = { pricing: { mode: "none" }, catalog: { dccId: 1968651 } };
    const result = applyTransform(row({ dccId: 1968650 }), t);
    expect(result.after.dccId).toBe(1968651);
    expect(result.changedFields).toContain("dccId");
  });

  it("does not record DCC as a change if value equals current", () => {
    const t: BulkEditTransform = { pricing: { mode: "none" }, catalog: { dccId: 1968650 } };
    const result = applyTransform(row({ dccId: 1968650 }), t);
    expect(result.changedFields).not.toContain("dccId");
  });
});

describe("validateTransform", () => {
  it("rejects a fully no-op transform", () => {
    const errors = validateTransform({ pricing: { mode: "none" }, catalog: {} });
    expect(errors.some((e) => e.code === "NO_OP_TRANSFORM")).toBe(true);
  });

  it("rejects margin >= 1", () => {
    const errors = validateTransform({ pricing: { mode: "margin", targetMargin: 1 }, catalog: {} });
    expect(errors.some((e) => e.code === "INVALID_MARGIN")).toBe(true);
  });

  it("rejects negative absolute retail", () => {
    const errors = validateTransform({ pricing: { mode: "absolute", retail: -1 }, catalog: {} });
    expect(errors.some((e) => e.code === "INVALID_RETAIL")).toBe(true);
  });

  it("accepts a clean transform", () => {
    const errors = validateTransform({ pricing: { mode: "uplift", percent: 5 }, catalog: {} });
    expect(errors).toEqual([]);
  });
});
