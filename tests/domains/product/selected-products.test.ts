import { describe, expect, it } from "vitest";
import { browseRowToSelectedProduct } from "@/domains/product/selected-products";
import type { ProductBrowseRow } from "@/domains/product/types";

describe("browseRowToSelectedProduct", () => {
  it("keeps pricingLocationId null when the browse row has no current-scope inventory slice", () => {
    const selected = browseRowToSelectedProduct({
      sku: 1001,
      description: "Pierce Hoodie",
      title: null,
      retail_price: null,
      cost: null,
      primary_location_id: null,
      selected_inventories: [],
      barcode: "123456789012",
      author: null,
      isbn: null,
      edition: null,
      catalog_number: "HD-1001",
      vendor_id: 21,
      item_type: "general_merchandise",
      discontinued: false,
    } as unknown as ProductBrowseRow);

    expect(selected.pricingLocationId).toBeNull();
    expect(selected.retailPrice).toBeNull();
    expect(selected.cost).toBeNull();
  });
});
