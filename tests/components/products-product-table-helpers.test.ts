import React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  formatLocationVarianceBadge,
  formatVendorDisplay,
  getLocationValueRows,
  getProductAnalyticsDisplay,
  getProductDisplaySaleDate,
  hasProductAnalyticsReady,
} from "@/components/products/product-table";
import { ProductTable } from "@/components/products/product-table";
import type { ProductBrowseRow } from "@/domains/product/types";

vi.mock("@/domains/product/vendor-directory", () => ({
  useVendorDirectory: () => ({
    byId: new Map<number, string>(),
  }),
}));

vi.mock("@/components/products/use-hidden-columns", () => ({
  useHiddenColumns: () => ({
    ref: { current: null },
    summary: { tiers: [] },
  }),
}));

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

  it("uses a neutral vendor fallback when the label is missing", () => {
    expect(formatVendorDisplay(null)).toBe("Vendor unavailable");
  });

  it("formats the location-variance badge only when more than one selected location differs", () => {
    expect(formatLocationVarianceBadge(false, 3)).toBeNull();
    expect(formatLocationVarianceBadge(true, 1)).toBeNull();
    expect(formatLocationVarianceBadge(true, 3)).toBe("+2 varies");
  });

  it("formats selected-location rows for the popover", () => {
    const slices = [
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
    ] as const;

    expect(getLocationValueRows(slices, "retailPrice")).toEqual([
      { label: "PIER", value: "$19.99" },
      { label: "PCOP", value: "$21.99" },
    ]);
    expect(getLocationValueRows(slices, "cost")).toEqual([
      { label: "PIER", value: "$8.50" },
      { label: "PCOP", value: "$8.50" },
    ]);
    expect(getLocationValueRows(slices, "stockOnHand")).toEqual([
      { label: "PIER", value: "10" },
      { label: "PCOP", value: "4" },
    ]);
  });
});

describe("product table variance trigger", () => {
  it("opens the retail popover from the varies badge", async () => {
    const user = userEvent.setup();
    const product = {
      sku: 101,
      barcode: null,
      item_type: "textbook",
      description: "Pierce hoodie",
      author: null,
      title: "Pierce hoodie",
      isbn: null,
      edition: null,
      retail_price: 19.99,
      cost: 8.5,
      stock_on_hand: 10,
      catalog_number: null,
      vendor_id: null,
      dcc_id: null,
      product_type: null,
      created_at: null,
      updated_at: "2026-04-20T00:00:00.000Z",
      last_sale_date: null,
      synced_at: "2026-04-20T00:00:00.000Z",
      dept_num: null,
      class_num: null,
      cat_num: null,
      dept_name: null,
      class_name: null,
      cat_name: null,
      units_sold_30d: 0,
      units_sold_90d: 0,
      units_sold_1y: 0,
      units_sold_3y: 0,
      units_sold_lifetime: 0,
      revenue_30d: 0,
      revenue_90d: 0,
      revenue_1y: 0,
      revenue_3y: 0,
      revenue_lifetime: 0,
      txns_1y: 0,
      txns_lifetime: 0,
      first_sale_date_computed: null,
      last_sale_date_computed: null,
      sales_aggregates_computed_at: null,
      effective_last_sale_date: null,
      aggregates_ready: true,
      edited_since_sync: false,
      margin_ratio: null,
      stock_coverage_days: null,
      trend_direction: null,
      discontinued: false,
      primary_location_id: 2,
      primary_location_abbrev: "PIER",
      selected_inventories: [
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
          stockOnHand: 10,
          lastSaleDate: "2026-04-18T00:00:00.000Z",
        },
      ],
      location_variance: {
        retailPriceVaries: true,
        costVaries: false,
        stockVaries: false,
        lastSaleDateVaries: false,
      },
    } as ProductBrowseRow;

    render(React.createElement(ProductTable, {
      tab: "textbooks",
      products: [product],
      total: 1,
      page: 1,
      loading: false,
      sortBy: "sku",
      sortDir: "asc",
      isSelected: () => false,
      onToggle: () => {},
      onToggleAll: () => {},
      onPageChange: () => {},
      onSort: () => {},
      visibleColumns: [],
    }));

    const tableWrap = document.querySelector(".product-table-wrap");
    expect(tableWrap).not.toBeNull();

    const trigger = within(tableWrap as HTMLElement).getByRole("button", {
      name: /retail values vary across locations/i,
    });
    expect(trigger.textContent).toContain("+1 varies");

    await user.click(trigger);

    expect(await screen.findByText("PIER")).toBeTruthy();
    expect(await screen.findByText("PCOP")).toBeTruthy();
    expect(await screen.findByText("$21.99")).toBeTruthy();
  });
});
