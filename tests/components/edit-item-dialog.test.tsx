import { describe, it, expect } from "vitest";
import { buildPatch } from "@/components/products/edit-item-dialog";

describe("buildPatch", () => {
  it("returns empty patch when nothing changed", () => {
    const baseline = { description: "x", retail: 10, cost: 5, barcode: "A", vendorId: 1, dccId: 2, itemTaxTypeId: 6, comment: "", catalogNumber: "", packageType: "", unitsPerPack: 1 };
    const current = { ...baseline };
    expect(buildPatch(baseline, current)).toEqual({});
  });

  it("includes only changed fields", () => {
    const baseline = { description: "x", retail: 10, cost: 5 };
    const current = { description: "x", retail: 12, cost: 5 };
    expect(buildPatch(baseline, current)).toEqual({ retail: 12 });
  });

  it("preserves empty-string -> null for barcode", () => {
    const baseline = { barcode: "A" };
    const current = { barcode: "" };
    expect(buildPatch(baseline, current)).toEqual({ barcode: null });
  });
});
