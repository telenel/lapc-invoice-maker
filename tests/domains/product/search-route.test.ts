import { describe, expect, it } from "vitest";
import {
  buildProductBrowseRow,
  buildProductLocationVariance,
  type ProductInventorySliceRow,
} from "@/domains/product/search-route";
import type { Product } from "@/domains/product/types";

function buildBaseProduct(overrides: Partial<Product> = {}): Product {
  return {
    sku: 101,
    barcode: "123",
    item_type: "general_merchandise",
    description: "Pierce mug",
    author: null,
    title: null,
    isbn: null,
    edition: null,
    retail_price: 19.99,
    cost: 8.5,
    stock_on_hand: 10,
    catalog_number: null,
    vendor_id: 21,
    dcc_id: 7,
    product_type: null,
    color_id: 0,
    created_at: null,
    updated_at: "2026-04-20T00:00:00.000Z",
    last_sale_date: "2026-04-18T00:00:00.000Z",
    synced_at: "2026-04-20T00:00:00.000Z",
    dept_num: null,
    class_num: null,
    cat_num: null,
    dept_name: null,
    class_name: null,
    cat_name: null,
    units_sold_30d: 12,
    units_sold_90d: 20,
    units_sold_1y: 42,
    units_sold_3y: 70,
    units_sold_lifetime: 100,
    revenue_30d: 240,
    revenue_90d: 400,
    revenue_1y: 840,
    revenue_3y: 1400,
    revenue_lifetime: 2000,
    txns_1y: 14,
    txns_lifetime: 30,
    first_sale_date_computed: null,
    last_sale_date_computed: "2026-04-19T00:00:00.000Z",
    sales_aggregates_computed_at: null,
    effective_last_sale_date: "2026-04-18T00:00:00.000Z",
    aggregates_ready: true,
    margin_ratio: null,
    stock_coverage_days: null,
    trend_direction: null,
    discontinued: false,
    ...overrides,
  };
}

describe("buildProductLocationVariance", () => {
  it("reports whether selected location values differ", () => {
    const slices: ProductInventorySliceRow[] = [
      {
        locationId: 2,
        locationAbbrev: "PIER",
        retailPrice: 19.99,
        cost: 8.5,
        stockOnHand: 10,
        lastSaleDate: "2026-04-18T00:00:00.000Z",
      },
      {
        locationId: 3,
        locationAbbrev: "PCOP",
        retailPrice: 21.99,
        cost: 8.5,
        stockOnHand: 4,
        lastSaleDate: "2026-04-17T00:00:00.000Z",
      },
    ];

    expect(buildProductLocationVariance(slices)).toEqual({
      retailPriceVaries: true,
      costVaries: false,
      stockVaries: true,
      lastSaleDateVaries: true,
    });
  });
});

describe("buildProductBrowseRow", () => {
  it("copies the primary-location values into the legacy product fields and computes variance", () => {
    const base = buildBaseProduct();
    const slices: ProductInventorySliceRow[] = [
      {
        locationId: 2,
        locationAbbrev: "PIER",
        retailPrice: 19.99,
        cost: 8.5,
        stockOnHand: 10,
        lastSaleDate: "2026-04-18T00:00:00.000Z",
      },
      {
        locationId: 3,
        locationAbbrev: "PCOP",
        retailPrice: 21.99,
        cost: 8.5,
        stockOnHand: 4,
        lastSaleDate: "2026-04-17T00:00:00.000Z",
      },
    ];

    const row = buildProductBrowseRow(base, slices, [2, 3]);

    expect(row.primary_location_id).toBe(2);
    expect(row.primary_location_abbrev).toBe("PIER");
    expect(row.retail_price).toBe(19.99);
    expect(row.cost).toBe(8.5);
    expect(row.stock_on_hand).toBe(10);
    expect(row.last_sale_date).toBe("2026-04-18T00:00:00.000Z");
    expect(row.effective_last_sale_date).toBe("2026-04-18T00:00:00.000Z");
    expect(row.location_variance).toEqual({
      retailPriceVaries: true,
      costVaries: false,
      stockVaries: true,
      lastSaleDateVaries: true,
    });
    expect(row.selected_inventories).toEqual(slices);
  });

  it("preserves the base effective sale-date chain when the primary slice has no last sale", () => {
    const base = buildBaseProduct({
      last_sale_date: "2026-04-11T00:00:00.000Z",
      effective_last_sale_date: "2026-04-12T00:00:00.000Z",
    });
    const slices: ProductInventorySliceRow[] = [
      {
        locationId: 3,
        locationAbbrev: "PCOP",
        retailPrice: 23.99,
        cost: 9.25,
        stockOnHand: 3,
        lastSaleDate: null,
      },
      {
        locationId: 4,
        locationAbbrev: "PFS",
        retailPrice: 23.99,
        cost: 9.25,
        stockOnHand: 3,
        lastSaleDate: "2026-04-10T00:00:00.000Z",
      },
    ];

    const row = buildProductBrowseRow(base, slices, [3, 4]);

    expect(row.primary_location_id).toBe(3);
    expect(row.primary_location_abbrev).toBe("PCOP");
    expect(row.last_sale_date).toBeNull();
    expect(row.effective_last_sale_date).toBe("2026-04-12T00:00:00.000Z");
  });

  it("keeps legacy values when the selected primary location is missing from the slices", () => {
    const base = buildBaseProduct({
      retail_price: 15.5,
      cost: 5.25,
      stock_on_hand: 9,
      last_sale_date: "2026-04-08T00:00:00.000Z",
      effective_last_sale_date: "2026-04-09T00:00:00.000Z",
    });
    const slices: ProductInventorySliceRow[] = [
      {
        locationId: 4,
        locationAbbrev: "PFS",
        retailPrice: 18.5,
        cost: 6.25,
        stockOnHand: 1,
        lastSaleDate: "2026-04-05T00:00:00.000Z",
      },
    ];

    const row = buildProductBrowseRow(base, slices, [2, 4]);

    expect(row.primary_location_id).toBeNull();
    expect(row.primary_location_abbrev).toBeNull();
    expect(row.retail_price).toBe(15.5);
    expect(row.cost).toBe(5.25);
    expect(row.stock_on_hand).toBe(9);
    expect(row.last_sale_date).toBe("2026-04-08T00:00:00.000Z");
    expect(row.effective_last_sale_date).toBe("2026-04-09T00:00:00.000Z");
    expect(row.location_variance).toEqual({
      retailPriceVaries: false,
      costVaries: false,
      stockVaries: false,
      lastSaleDateVaries: false,
    });
  });
});
