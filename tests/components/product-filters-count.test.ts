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

  it("counts dccComposite as one filter and suppresses the triple when it is set", () => {
    const filters = {
      ...EMPTY_FILTERS,
      dccComposite: "30-10-10",
      deptNum: "30",
      classNum: "10",
      catNum: "10",
    };
    expect(getProductActiveFilterCount(filters)).toBe(1);
  });

  it("still counts individual segments when dccComposite is not set", () => {
    const filters = {
      ...EMPTY_FILTERS,
      deptNum: "30",
      classNum: "10",
    };
    expect(getProductActiveFilterCount(filters)).toBe(2);
  });
});
