import { describe, expect, it } from "vitest";
import { buildBulkPatchForRow } from "@/domains/bulk-edit/patch-builder";
import type { BulkEditSourceRow } from "@/domains/bulk-edit/types";

function sourceRow(overrides: Partial<BulkEditSourceRow> = {}): BulkEditSourceRow {
  return {
    sku: 101,
    description: "Old description",
    barcode: "OLD-BARCODE",
    retail: 9.99,
    cost: 4.5,
    vendorId: 21,
    dccId: 100,
    itemTaxTypeId: 6,
    itemType: "general_merchandise",
    fDiscontinue: 0,
    inventoryByLocation: [
      {
        locationId: 2,
        retail: 9.99,
        cost: 4.5,
        stockOnHand: 11,
        expectedCost: 4.25,
        tagTypeId: 6,
        statusCodeId: 11,
        estSales: 8,
        estSalesLocked: false,
        fInvListPriceFlag: false,
        fTxWantListFlag: false,
        fTxBuybackListFlag: false,
        fNoReturns: false,
      },
      {
        locationId: 3,
        retail: 8.99,
        cost: 3.75,
        stockOnHand: 4,
        expectedCost: 3.5,
        tagTypeId: 4,
        statusCodeId: 12,
        estSales: 7,
        estSalesLocked: true,
        fInvListPriceFlag: true,
        fTxWantListFlag: false,
        fTxBuybackListFlag: true,
        fNoReturns: true,
      },
    ],
    ...overrides,
  };
}

describe("buildBulkPatchForRow", () => {
  it("maps item, GM, textbook, and inventory fields into a v2 patch", () => {
    const result = buildBulkPatchForRow(
      sourceRow({
        itemType: "textbook",
        title: "Old title",
      }),
      {
        fieldIds: ["description", "barcode", "title", "retail", "stockOnHand", "tagTypeId", "fDiscontinue"],
        inventoryScope: 3,
        values: {
          description: "New description",
          barcode: "NEW-BARCODE",
          title: "New title",
          retail: 12.5,
          stockOnHand: 22,
          tagTypeId: 7,
          fDiscontinue: true,
        },
      },
    );

    expect(result.patch).toEqual({
      item: {
        barcode: "NEW-BARCODE",
        fDiscontinue: 1,
      },
      gm: {
        description: "New description",
      },
      textbook: {
        title: "New title",
      },
      inventory: [
        {
          locationId: 3,
          retail: 12.5,
          stockOnHand: 22,
          tagTypeId: 7,
        },
      ],
    });
    expect(result.changedFields).toEqual(["description", "barcode", "title", "retail", "stockOnHand", "tagTypeId", "fDiscontinue"]);
  });

  it("maps inventory fields to every targeted location when the scope is all", () => {
    const result = buildBulkPatchForRow(sourceRow(), {
      fieldIds: ["cost", "fInvListPriceFlag"],
      inventoryScope: "all",
      values: {
        cost: 6.25,
        fInvListPriceFlag: true,
      },
    });

    expect(result.patch.inventory).toEqual([
      {
        locationId: 2,
        cost: 6.25,
        fInvListPriceFlag: true,
      },
      {
        locationId: 3,
        cost: 6.25,
        fInvListPriceFlag: true,
      },
    ]);
    expect(result.changedFields).toEqual(["cost", "fInvListPriceFlag"]);
  });
});
