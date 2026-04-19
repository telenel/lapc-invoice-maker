import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { ProductTable, getProductAnalyticsDisplay, getProductDisplaySaleDate, hasProductAnalyticsReady } from "@/components/products/product-table";
import { EMPTY_FILTERS } from "@/domains/product/constants";
import {
  Product,
} from "@/domains/product/types";

describe("product table helpers", () => {
  it("prefers the computed effective last-sale date when present", () => {
    expect(getProductDisplaySaleDate({
      effective_last_sale_date: "2026-04-10T00:00:00.000Z",
      last_sale_date_computed: "2026-04-09T00:00:00.000Z",
      last_sale_date: "2026-04-01T00:00:00.000Z",
    })).toBe("2026-04-10T00:00:00.000Z");
  });

  it("treats pending aggregates differently from real zero values", () => {
    expect(hasProductAnalyticsReady({
      aggregates_ready: undefined,
      sales_aggregates_computed_at: null,
    })).toBe(false);
    expect(getProductAnalyticsDisplay({
      aggregates_ready: undefined,
      sales_aggregates_computed_at: null,
    }, 0)).toBe("Pending");

    expect(getProductAnalyticsDisplay({
      aggregates_ready: true,
      sales_aggregates_computed_at: null,
    }, 0)).toBe("0");
  });

  it("renders recommended actions and explanation chips for the active filters", () => {
    const product: Product = {
      sku: 1,
      barcode: "123",
      item_type: "general_merchandise",
      description: "Pierce Hoodie",
      author: null,
      title: null,
      isbn: null,
      edition: null,
      retail_price: 20,
      cost: 10,
      stock_on_hand: 2,
      catalog_number: "HD-1",
      vendor_id: 101,
      dcc_id: 1000,
      product_type: "APPAREL",
      color_id: 0,
      created_at: "2026-04-01T00:00:00.000Z",
      updated_at: "2026-04-18T00:00:00.000Z",
      last_sale_date: "2026-04-17T00:00:00.000Z",
      synced_at: "2026-04-18T00:00:00.000Z",
      dept_num: 10,
      class_num: 20,
      cat_num: 30,
      dept_name: "Books",
      class_name: "Course",
      cat_name: "Math",
      units_sold_30d: 7,
      units_sold_90d: 10,
      units_sold_1y: 50,
      units_sold_3y: 50,
      units_sold_lifetime: 50,
      revenue_30d: 140,
      revenue_90d: 200,
      revenue_1y: 1000,
      revenue_3y: 1000,
      revenue_lifetime: 1000,
      txns_1y: 20,
      txns_lifetime: 20,
      first_sale_date_computed: "2026-01-01T00:00:00.000Z",
      last_sale_date_computed: "2026-04-17T00:00:00.000Z",
      sales_aggregates_computed_at: "2026-04-18T12:00:00.000Z",
      effective_last_sale_date: "2026-04-17T00:00:00.000Z",
      aggregates_ready: true,
      margin_ratio: 0.08,
      stock_coverage_days: 9,
      trend_direction: "accelerating",
      discontinued: false,
    };

    render(React.createElement(ProductTable, {
      tab: "merchandise",
      products: [product],
      total: 1,
      page: 1,
      loading: false,
      sortBy: "sku",
      sortDir: "asc",
      isSelected: () => false,
      onToggle: vi.fn(),
      onToggleAll: vi.fn(),
      onPageChange: vi.fn(),
      onSort: vi.fn(),
      activeFilters: {
        ...EMPTY_FILTERS,
        maxStock: "2",
        unitsSoldWindow: "30d",
        minUnitsSold: "5",
      },
    }));

    expect(screen.getAllByText("Reorder").length).toBeGreaterThan(0);
    expect(screen.getAllByText("critical").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Stock <= 2").length).toBeGreaterThan(0);
  });
});
