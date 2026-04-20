import { describe, expect, it } from "vitest";
import { buildBarcodePrintHtml } from "@/components/products/barcode-print-view";

describe("barcode print view", () => {
  it("uses the vendor label in the print html", () => {
    const html = buildBarcodePrintHtml([
      {
        sku: 12,
        description: "Pierce Mug",
        retailPrice: 12.5,
        cost: 4.25,
        barcode: null,
        author: null,
        title: null,
        isbn: null,
        edition: null,
        catalogNumber: null,
        vendorId: 42,
        itemType: "general_merchandise",
        vendorLabel: "PENS ETC",
      },
    ]);

    expect(html).toContain("Vendor: PENS ETC");
    expect(html).not.toContain("Vendor: #42");
  });

  it("renders a neutral vendor fallback when the label is missing", () => {
    const html = buildBarcodePrintHtml([
      {
        sku: 12,
        description: "Pierce Mug",
        retailPrice: 12.5,
        cost: 4.25,
        barcode: null,
        author: null,
        title: null,
        isbn: null,
        edition: null,
        catalogNumber: null,
        vendorId: 42,
        itemType: "general_merchandise",
      },
    ]);

    expect(html).toContain("Vendor: Vendor unavailable");
    expect(html).not.toContain("Vendor: #42");
  });
});
