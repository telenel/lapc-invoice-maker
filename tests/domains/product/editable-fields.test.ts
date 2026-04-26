import { describe, expect, it } from "vitest";
import {
  productEditableFieldRegistry,
  productEditableFieldSections,
} from "@/domains/product/editable-fields";

describe("productEditableFieldSections", () => {
  it("groups product edit fields into the four parity sections", () => {
    expect(productEditableFieldSections.map((section) => section.group)).toEqual([
      "primary",
      "inventory",
      "more",
      "advanced",
    ]);

    expect(productEditableFieldSections[0]?.fields.map((field) => field.id)).toEqual([
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

    expect(productEditableFieldSections[1]?.fields.map((field) => field.id)).toEqual([
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

    expect(productEditableFieldSections[2]?.fields.map((field) => field.id)).toEqual([
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

    expect(productEditableFieldSections[3]?.fields.map((field) => field.id)).toEqual([
      "styleId",
      "itemSeasonCodeId",
      "usedDccId",
      "minOrderQtyItem",
      "fListPriceFlag",
      "fPerishable",
      "fIdRequired",
    ]);
  });

  it("carries edit-surface metadata for representative fields", () => {
    expect(productEditableFieldRegistry.description).toMatchObject({
      id: "description",
      label: "Description",
      group: "primary",
      patchTarget: "gm",
      itemTypes: ["general_merchandise"],
      locationAware: false,
      fillRateLabel: "100.0%",
    });

    expect(productEditableFieldRegistry.barcode).toMatchObject({
      id: "barcode",
      label: "Barcode",
      group: "primary",
      patchTarget: "item",
      itemTypes: ["general_merchandise", "textbook", "used_textbook"],
      locationAware: false,
      fillRateLabel: "69.5% / 94.1%",
    });

    expect(productEditableFieldRegistry.retail).toMatchObject({
      id: "retail",
      label: "Retail",
      group: "inventory",
      patchTarget: "inventory",
      itemTypes: ["general_merchandise", "textbook", "used_textbook"],
      locationAware: true,
      fillRateLabel: "98.4% / 98.9%",
    });

    expect(productEditableFieldRegistry.packageType).toMatchObject({
      id: "packageType",
      label: "Package Type",
      group: "more",
      patchTarget: "gm",
      itemTypes: ["general_merchandise"],
      locationAware: false,
      fillRateLabel: "100.0%",
      refSource: "packageTypes",
    });

    expect(productEditableFieldRegistry.colorId).toMatchObject({
      id: "colorId",
      label: "Color",
      group: "more",
      patchTarget: "gm",
      refSource: "colors",
    });

    expect(productEditableFieldRegistry.fPerishable).toMatchObject({
      id: "fPerishable",
      label: "Perishable",
      group: "advanced",
      patchTarget: "item",
      locationAware: false,
    });
  });
});
