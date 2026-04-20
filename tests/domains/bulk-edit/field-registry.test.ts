import { describe, expect, it } from "vitest";
import {
  bulkEditFieldPickerFields,
  bulkEditFieldPickerSections,
  bulkEditFieldRegistry,
  getBulkEditFieldDefinition,
} from "@/domains/bulk-edit/field-registry";

describe("bulkEditFieldRegistry", () => {
  it("keeps every registry key aligned with the embedded field id", () => {
    const entries = Object.entries(bulkEditFieldRegistry) as Array<
      [keyof typeof bulkEditFieldRegistry, (typeof bulkEditFieldRegistry)[keyof typeof bulkEditFieldRegistry]]
    >;

    for (const [fieldId, definition] of entries) {
      expect(definition.id).toBe(fieldId);
    }
  });

  it("exposes the picker sections in spec order", () => {
    expect(bulkEditFieldPickerSections.map((section) => section.group)).toEqual([
      "primary",
      "inventory",
      "more",
      "advanced",
    ]);

    expect(bulkEditFieldPickerSections[0]?.fields.map((field) => field.id)).toEqual([
      "description",
      "title",
      "author",
      "isbn",
      "edition",
      "bindingId",
      "barcode",
      "dccId",
      "vendorId",
      "itemTaxTypeId",
      "catalogNumber",
      "fDiscontinue",
    ]);

    expect(bulkEditFieldPickerSections[1]?.fields.map((field) => field.id)).toEqual([
      "retail",
      "cost",
      "expectedCost",
      "tagTypeId",
      "statusCodeId",
      "estSales",
      "fInvListPriceFlag",
      "fTxWantListFlag",
      "fTxBuybackListFlag",
      "fNoReturns",
    ]);

    expect(bulkEditFieldPickerSections[2]?.fields.map((field) => field.id)).toEqual([
      "packageType",
      "unitsPerPack",
    ]);

    expect(bulkEditFieldPickerSections[3]?.fields).toEqual([]);
  });

  it("flattens picker fields in the same order and supports id lookup", () => {
    expect(bulkEditFieldPickerFields.map((field) => field.id)).toEqual([
      "description",
      "title",
      "author",
      "isbn",
      "edition",
      "bindingId",
      "barcode",
      "dccId",
      "vendorId",
      "itemTaxTypeId",
      "catalogNumber",
      "fDiscontinue",
      "retail",
      "cost",
      "expectedCost",
      "tagTypeId",
      "statusCodeId",
      "estSales",
      "fInvListPriceFlag",
      "fTxWantListFlag",
      "fTxBuybackListFlag",
      "fNoReturns",
      "packageType",
      "unitsPerPack",
    ]);

    expect(getBulkEditFieldDefinition("vendorId")).toBe(bulkEditFieldRegistry.vendorId);
    expect(getBulkEditFieldDefinition("retail")).toBe(bulkEditFieldRegistry.retail);
  });

  it("marks inventory fields as location-aware and keeps their fill-rate hints", () => {
    expect(bulkEditFieldRegistry.retail).toEqual({
      id: "retail",
      label: "Retail",
      group: "inventory",
      fillRateLabel: "98.4% / 98.9%",
      requiresLocation: true,
    });

    expect(bulkEditFieldRegistry.expectedCost).toEqual({
      id: "expectedCost",
      label: "Expected Cost",
      group: "inventory",
      fillRateLabel: "39.6% / 81.9%",
      requiresLocation: true,
    });

    expect(bulkEditFieldRegistry.fTxWantListFlag).toEqual({
      id: "fTxWantListFlag",
      label: "Want List",
      group: "inventory",
      fillRateLabel: "4.9% / 76.2%",
      requiresLocation: true,
    });
  });

  it("captures the remaining GM and textbook fields used by the picker slice", () => {
    expect(bulkEditFieldRegistry.description).toMatchObject({
      id: "description",
      label: "Description",
      group: "primary",
      fillRateLabel: "100.0%",
      requiresLocation: false,
    });

    expect(bulkEditFieldRegistry.packageType).toEqual({
      id: "packageType",
      label: "Package Type",
      group: "more",
      fillRateLabel: "100.0%",
      requiresLocation: false,
      refOptionKey: "packageTypes",
    });

    expect(bulkEditFieldRegistry.unitsPerPack).toEqual({
      id: "unitsPerPack",
      label: "Units per Pack",
      group: "more",
      fillRateLabel: "15.0%",
      requiresLocation: false,
    });
  });
});
