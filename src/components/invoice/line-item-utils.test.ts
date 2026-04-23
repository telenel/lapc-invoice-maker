import { describe, expect, it } from "vitest";
import {
  appendLineItemsReplacingPlaceholders,
  prepareLineItemsForSubmit,
} from "./line-item-utils";

const blankItem = {
  sku: null,
  description: "",
  quantity: 1,
  unitPrice: 0,
  extendedPrice: 0,
  sortOrder: 0,
  costPrice: null,
  marginOverride: null,
};

const realItem = {
  ...blankItem,
  description: "Workbook",
  unitPrice: 25,
  extendedPrice: 50,
  quantity: 2,
};

describe("line item utils", () => {
  it("prunes placeholder rows before submit and reorders remaining items", () => {
    expect(prepareLineItemsForSubmit([blankItem, { ...realItem, sortOrder: 7 }])).toEqual([
      expect.objectContaining({
        description: "Workbook",
        sortOrder: 0,
      }),
    ]);
  });

  it("keeps partially edited invalid rows and reports the original row number", () => {
    expect(() =>
      prepareLineItemsForSubmit([
        blankItem,
        {
          ...blankItem,
          quantity: 2,
        },
      ]),
    ).toThrow("Line item 2: description is required.");
  });

  it("replaces the default placeholder when catalog items are appended", () => {
    expect(appendLineItemsReplacingPlaceholders([blankItem], [realItem])).toEqual([
      expect.objectContaining({
        description: "Workbook",
        sortOrder: 0,
      }),
    ]);
  });
});
