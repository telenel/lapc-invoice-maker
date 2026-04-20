import { describe, expect, it } from "vitest";
import {
  formatLocationVarianceBadge,
  formatVendorDisplay,
  getLocationValueRows,
  getProductAnalyticsDisplay,
  getProductDisplaySaleDate,
  hasProductAnalyticsReady,
} from "@/components/products/product-table";

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
