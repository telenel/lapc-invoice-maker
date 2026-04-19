import { describe, expect, it } from "vitest";
import { getProductActiveFilterCount } from "@/components/products/product-filters";
import { EMPTY_FILTERS } from "@/domains/product/constants";

describe("getProductActiveFilterCount", () => {
  it("counts analytics-driven filters in the badge total", () => {
    const filters = {
      ...EMPTY_FILTERS,
      unitsSoldWindow: "1y" as const,
      minUnitsSold: "10",
      revenueWindow: "1y" as const,
      minRevenue: "100",
      txnsWindow: "1y" as const,
      minTxns: "5",
      neverSoldLifetime: true,
      firstSaleWithin: "90d" as const,
      trendDirection: "accelerating" as const,
      maxStockCoverageDays: "30",
    };

    expect(getProductActiveFilterCount(filters)).toBe(10);
  });
});
