import { describe, it, expect } from "vitest";
import { buildBulkFieldPreview } from "@/domains/bulk-edit/preview-builder";
import type { PrismRefs } from "@/domains/product/ref-data";
import type { BulkEditSourceRow } from "@/domains/bulk-edit/types";

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

const REFS: PrismRefs = {
  vendors: [{ vendorId: 21, name: "Acme Books", pierceItems: 12 }],
  dccs: [
    {
      dccId: 100,
      deptNum: 10,
      classNum: 20,
      catNum: 30,
      deptName: "Books",
      className: "Sci-Fi",
      catName: "Texts",
      pierceItems: 9,
    },
  ],
  taxTypes: [{ taxTypeId: 6, description: "State Tax", pierceItems: 40 }],
  tagTypes: [{ tagTypeId: 7, label: "Used", subsystem: null, pierceRows: 14 }],
  statusCodes: [{ statusCodeId: 11, label: "Active", pierceRows: 10 }],
  packageTypes: [{ code: "EA", label: "Each", defaultQty: 1, pierceItems: 7 }],
  colors: [],
  bindings: [{ bindingId: 3, label: "Paperback", pierceBooks: 18 }],
};

describe("buildBulkFieldPreview", () => {
  it("renders after labels from normalized patch values instead of raw submitted input", () => {
    const preview = buildBulkFieldPreview(
      [
        row({
          sku: 3,
          description: "Old desc",
          barcode: "ABC-123",
          retail: 10,
          itemType: "general_merchandise",
          inventoryByLocation: [
            {
              locationId: 2,
              retail: 10,
              cost: 5,
              expectedCost: 4.5,
              tagTypeId: 6,
              statusCodeId: 11,
              estSales: 8,
              estSalesLocked: false,
              fInvListPriceFlag: false,
              fTxWantListFlag: false,
              fTxBuybackListFlag: false,
              fNoReturns: false,
            },
          ],
        }),
      ],
      {
        fieldIds: ["barcode", "description", "retail", "fNoReturns"],
        inventoryScope: 2,
        values: {
          barcode: "   ",
          description: "  New desc  ",
          retail: "12.50",
          fNoReturns: "true",
        },
      },
    );

    expect(preview.rows[0]?.cells).toEqual([
      {
        fieldId: "barcode",
        label: "Barcode",
        beforeLabel: "ABC-123",
        afterLabel: "—",
        changed: true,
      },
      {
        fieldId: "description",
        label: "Description",
        beforeLabel: "Old desc",
        afterLabel: "New desc",
        changed: true,
      },
      {
        fieldId: "retail",
        label: "Retail",
        beforeLabel: "10",
        afterLabel: "12.5",
        changed: true,
      },
      {
        fieldId: "fNoReturns",
        label: "No Returns",
        beforeLabel: "No",
        afterLabel: "Yes",
        changed: true,
      },
    ]);
  });

  it("shows all targeted inventory locations when the scope is all", () => {
    const preview = buildBulkFieldPreview(
      [
        row({
          sku: 4,
          retail: 10,
          cost: 5,
          inventoryByLocation: [
            {
              locationId: 2,
              retail: 10,
              cost: 6.25,
              expectedCost: 4.5,
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
              retail: 10,
              cost: 3.75,
              expectedCost: 4.25,
              tagTypeId: 7,
              statusCodeId: 12,
              estSales: 9,
              estSalesLocked: false,
              fInvListPriceFlag: false,
              fTxWantListFlag: false,
              fTxBuybackListFlag: false,
              fNoReturns: false,
            },
          ],
        }),
      ],
      {
        fieldIds: ["cost"],
        inventoryScope: "all",
        values: {
          cost: 6.25,
        },
      },
    );

    expect(preview.rows[0]?.cells).toEqual([
      {
        fieldId: "cost",
        label: "Cost",
        beforeLabel: "2: 6.25, 3: 3.75",
        afterLabel: "2: 6.25, 3: 6.25",
        changed: true,
      },
    ]);
  });

  it("builds field-based cells with before and after labels", () => {
    const preview = buildBulkFieldPreview(
      [
        row({
          sku: 1,
          itemType: "textbook",
          description: "Old desc",
          title: "Old title",
          retail: 9.99,
          cost: 4.5,
          inventoryByLocation: [
            {
              locationId: 2,
              retail: 9.99,
              cost: 4.5,
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
          ],
        }),
      ],
      {
        fieldIds: ["description", "title", "retail", "tagTypeId"],
        inventoryScope: 2,
        values: {
          description: "New desc",
          title: "New title",
          retail: 12.5,
          tagTypeId: 7,
        },
      },
      REFS,
    );

    expect(preview.totals.rowCount).toBe(1);
    expect(preview.totals.changedFieldCount).toBe(4);
    expect(preview.rows[0]).toMatchObject({
      sku: 1,
      description: "Old desc",
      changedFields: ["description", "title", "retail", "tagTypeId"],
      cells: [
        {
          fieldId: "description",
          label: "Description",
          beforeLabel: "Old desc",
          afterLabel: "New desc",
          changed: true,
        },
        {
          fieldId: "title",
          label: "Title",
          beforeLabel: "Old title",
          afterLabel: "New title",
          changed: true,
        },
        {
          fieldId: "retail",
          label: "Retail",
          beforeLabel: "9.99",
          afterLabel: "12.5",
          changed: true,
        },
        {
          fieldId: "tagTypeId",
          label: "Tag Type",
          beforeLabel: "#6",
          afterLabel: "Used",
          changed: true,
        },
      ],
    });
  });

  it("uses committed ref labels for item and inventory lookup fields", () => {
    const preview = buildBulkFieldPreview(
      [
        row({
          sku: 5,
          description: "Ref-backed item",
          vendorId: 21,
          dccId: 100,
          itemTaxTypeId: 6,
          itemType: "textbook",
          bindingId: 3,
          inventoryByLocation: [
            {
              locationId: 2,
              retail: 10,
              cost: 5,
              expectedCost: 4.5,
              tagTypeId: 7,
              statusCodeId: 11,
              estSales: 8,
              estSalesLocked: false,
              fInvListPriceFlag: false,
              fTxWantListFlag: false,
              fTxBuybackListFlag: false,
              fNoReturns: false,
            },
          ],
        }),
      ],
      {
        fieldIds: ["vendorId", "dccId", "itemTaxTypeId", "bindingId", "tagTypeId", "statusCodeId"],
        inventoryScope: 2,
        values: {
          vendorId: 99,
          dccId: 101,
          itemTaxTypeId: 12,
          bindingId: 8,
          tagTypeId: 13,
          statusCodeId: 22,
        },
      },
      REFS,
    );

    expect(preview.rows[0]?.cells).toEqual([
      {
        fieldId: "vendorId",
        label: "Vendor",
        beforeLabel: "Acme Books",
        afterLabel: "#99",
        changed: true,
      },
      {
        fieldId: "dccId",
        label: "DCC",
        beforeLabel: "Books / Sci-Fi",
        afterLabel: "#101",
        changed: true,
      },
      {
        fieldId: "itemTaxTypeId",
        label: "Item Tax Type",
        beforeLabel: "State Tax",
        afterLabel: "#12",
        changed: true,
      },
      {
        fieldId: "bindingId",
        label: "Binding",
        beforeLabel: "Paperback",
        afterLabel: "#8",
        changed: true,
      },
      {
        fieldId: "tagTypeId",
        label: "Tag Type",
        beforeLabel: "Used",
        afterLabel: "#13",
        changed: true,
      },
      {
        fieldId: "statusCodeId",
        label: "Status Code",
        beforeLabel: "Active",
        afterLabel: "#22",
        changed: true,
      },
    ]);
  });

  it("keeps unchanged cells visible with matching before and after labels", () => {
    const preview = buildBulkFieldPreview([
      row({
        sku: 2,
        description: "Same",
        retail: 10,
        cost: 5,
        inventoryByLocation: [
          {
            locationId: 2,
            retail: 9.99,
            cost: 5,
            expectedCost: 4.5,
            tagTypeId: 6,
            statusCodeId: 11,
            estSales: 8,
            estSalesLocked: false,
            fInvListPriceFlag: false,
            fTxWantListFlag: false,
            fTxBuybackListFlag: false,
            fNoReturns: false,
          },
        ],
      }),
    ], {
      fieldIds: ["description", "retail"],
      inventoryScope: 2,
      values: {
        description: "Same",
        retail: 9.99,
      },
    });

    expect(preview.rows[0]?.changedFields).toEqual([]);
    expect(preview.rows[0]?.cells).toEqual([
      {
        fieldId: "description",
        label: "Description",
        beforeLabel: "Same",
        afterLabel: "Same",
        changed: false,
      },
      {
        fieldId: "retail",
        label: "Retail",
        beforeLabel: "9.99",
        afterLabel: "9.99",
        changed: false,
      },
    ]);
  });
});
