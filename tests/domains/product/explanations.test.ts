import { describe, expect, it } from "vitest";
import { buildProductExplanationChips, getCoverageBand, getRecommendedAction } from "@/domains/product/explanations";
import { EMPTY_FILTERS } from "@/domains/product/constants";

describe("product explanations", () => {
  it("explains why a row matches a stockout-risk style view", () => {
    const product = {
      sku: 1,
      stock_on_hand: 2,
      units_sold_30d: 7,
      units_sold_1y: 50,
      txns_1y: 20,
      margin_ratio: 0.08,
      stock_coverage_days: 9,
      trend_direction: "accelerating",
      effective_last_sale_date: "2026-04-17T00:00:00.000Z",
      aggregates_ready: true,
      sales_aggregates_computed_at: "2026-04-18T12:00:00.000Z",
      discontinued: false,
    };

    const filters = {
      ...EMPTY_FILTERS,
      maxStock: "2",
      unitsSoldWindow: "30d" as const,
      minUnitsSold: "5",
    };
    const chips = buildProductExplanationChips(product, filters);

    expect(chips).toContain("Stock <= 2");
    expect(chips).toContain("30d units: 7");
    expect(getCoverageBand(product.stock_coverage_days)).toBe("critical");
    expect(getRecommendedAction(product)).toBe("Reorder");
  });
});
