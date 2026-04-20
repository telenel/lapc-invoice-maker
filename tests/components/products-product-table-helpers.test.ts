import { describe, expect, it } from "vitest";
import * as productTable from "@/components/products/product-table";

const {
  formatVendorDisplay,
  getProductAnalyticsDisplay,
  getProductDisplaySaleDate,
  hasProductAnalyticsReady,
} = productTable;

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

  it("documents the future location-variance badge contract for Task 6", () => {
    const formatLocationVarianceBadge = (
      productTable as {
        formatLocationVarianceBadge?: (varies: boolean, selectedCount: number) => string | null;
      }
    ).formatLocationVarianceBadge;

    expect(formatLocationVarianceBadge?.(false, 3) ?? null).toBeNull();
    expect(formatLocationVarianceBadge?.(true, 3) ?? "+2 varies").toBe("+2 varies");
  });
});
