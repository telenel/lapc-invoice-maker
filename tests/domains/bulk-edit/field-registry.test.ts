import { describe, expect, it } from "vitest";
import {
  bulkEditFieldPickerFields,
  bulkEditFieldPickerSections,
  bulkEditFieldRegistry,
  getBulkEditFieldDefinition,
} from "@/domains/bulk-edit/field-registry";
import { productEditableFieldRegistry } from "@/domains/product/editable-fields";

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
      "comment",
      "fDiscontinue",
    ]);

    expect(bulkEditFieldPickerSections[1]?.fields.map((field) => field.id)).toEqual([
      "retail",
      "cost",
      "stockOnHand",
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
      "weight",
      "imageUrl",
      "altVendorId",
      "mfgId",
      "size",
      "colorId",
      "orderIncrement",
    ]);

    expect(bulkEditFieldPickerSections[3]?.fields.map((field) => field.id)).toEqual([
      "styleId",
      "itemSeasonCodeId",
      "usedDccId",
      "minOrderQtyItem",
      "fListPriceFlag",
      "fPerishable",
      "fIdRequired",
    ]);
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
      "comment",
      "fDiscontinue",
      "retail",
      "cost",
      "stockOnHand",
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
      "weight",
      "imageUrl",
      "altVendorId",
      "mfgId",
      "size",
      "colorId",
      "orderIncrement",
      "styleId",
      "itemSeasonCodeId",
      "usedDccId",
      "minOrderQtyItem",
      "fListPriceFlag",
      "fPerishable",
      "fIdRequired",
    ]);

    expect(getBulkEditFieldDefinition("vendorId")).toBe(bulkEditFieldRegistry.vendorId);
    expect(getBulkEditFieldDefinition("retail")).toBe(bulkEditFieldRegistry.retail);
  });

  it("marks inventory fields as location-aware and keeps their fill-rate hints", () => {
    expect(bulkEditFieldRegistry.retail).toMatchObject({
      id: "retail",
      label: "Retail",
      group: "inventory",
      fillRateLabel: "98.4% / 98.9%",
      locationAware: true,
      requiresLocation: true,
    });

    expect(bulkEditFieldRegistry.expectedCost).toMatchObject({
      id: "expectedCost",
      label: "Expected Cost",
      group: "inventory",
      fillRateLabel: "39.6% / 81.9%",
      locationAware: true,
      requiresLocation: true,
    });

    expect(bulkEditFieldRegistry.fTxWantListFlag).toMatchObject({
      id: "fTxWantListFlag",
      label: "Want List",
      group: "inventory",
      fillRateLabel: "4.9% / 76.2%",
      locationAware: true,
      requiresLocation: true,
    });
  });

  it("captures the remaining GM and textbook fields used by the picker slice", () => {
    expect(bulkEditFieldRegistry.description).toMatchObject({
      id: "description",
      label: "Description",
      group: "primary",
      fillRateLabel: "100.0%",
      locationAware: false,
      requiresLocation: false,
    });

    expect(bulkEditFieldRegistry.packageType).toMatchObject({
      id: "packageType",
      label: "Package Type",
      group: "more",
      fillRateLabel: "100.0%",
      locationAware: false,
      requiresLocation: false,
      refSource: "packageTypes",
      refOptionKey: "packageTypes",
    });

    expect(bulkEditFieldRegistry.unitsPerPack).toMatchObject({
      id: "unitsPerPack",
      label: "Units per Pack",
      group: "more",
      fillRateLabel: "15.0%",
      locationAware: false,
      requiresLocation: false,
    });

    expect(bulkEditFieldRegistry.colorId).toMatchObject({
      id: "colorId",
      label: "Color",
      group: "more",
      refSource: "colors",
      refOptionKey: "colors",
    });

    expect(bulkEditFieldRegistry.fListPriceFlag).toMatchObject({
      id: "fListPriceFlag",
      label: "List Price Flag",
      group: "advanced",
      locationAware: false,
      requiresLocation: false,
    });
  });

  it("reuses the shared product editable-field catalog", () => {
    expect(bulkEditFieldRegistry.retail).toBe(productEditableFieldRegistry.retail as typeof bulkEditFieldRegistry.retail);
    expect(bulkEditFieldRegistry.vendorId).toBe(productEditableFieldRegistry.vendorId as typeof bulkEditFieldRegistry.vendorId);
  });
});
