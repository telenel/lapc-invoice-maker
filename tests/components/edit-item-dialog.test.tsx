import { describe, it, expect } from "vitest";
import { buildPatch } from "@/components/products/edit-item-dialog";
import { resolveEditDialogMode } from "@/components/products/edit-item-dialog-mode";

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

describe("resolveEditDialogMode", () => {
  it("resolves v2 for standard merchandise edits without requiring a feature flag", () => {
    expect(
      resolveEditDialogMode({
        featureFlagEnabled: false,
        override: null,
        hasTextbookSelection: false,
        selectionCount: 1,
      }),
    ).toBe("v2");
  });

  it("forces legacy when the override requests it", () => {
    expect(
      resolveEditDialogMode({
        featureFlagEnabled: true,
        override: "legacy",
        hasTextbookSelection: false,
        selectionCount: 1,
      }),
    ).toBe("legacy");
  });

  it('forces v2 when the override requests it and there is no textbook selection', () => {
    expect(
      resolveEditDialogMode({
        featureFlagEnabled: false,
        override: "v2",
        hasTextbookSelection: false,
        selectionCount: 1,
      }),
    ).toBe("v2");
  });

  it("routes single textbook selections to v2", () => {
    expect(
      resolveEditDialogMode({
        featureFlagEnabled: true,
        override: null,
        hasTextbookSelection: true,
        selectionCount: 1,
      }),
    ).toBe("v2");
  });

  it("routes multi-select textbook edits to v2 so the shared parity surface stays consistent", () => {
    expect(
      resolveEditDialogMode({
        featureFlagEnabled: false,
        override: null,
        hasTextbookSelection: true,
        selectionCount: 2,
      }),
    ).toBe("v2");
  });
});
