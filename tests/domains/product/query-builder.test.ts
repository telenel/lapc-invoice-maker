import { describe, expect, it } from "vitest";
import { EMPTY_FILTERS } from "@/domains/product/constants";
import { buildProductQueryPlan, shouldRequireAggregatesReady } from "@/domains/product/query-builder";

describe("query-builder", () => {
  it("keeps simple catalog queries on the base products table", () => {
    const plan = buildProductQueryPlan({
      ...EMPTY_FILTERS,
      search: "hoodie",
      sortBy: "sku",
      sortDir: "asc",
    });

    expect(plan).toMatchObject({
      source: "products",
      lastSaleField: "last_sale_date",
      requireAggregatesReady: false,
      sortField: "sku",
      ascending: true,
    });
  });

  it("moves analytics filters onto the derived view and gates on computed aggregates", () => {
    const filters = {
      ...EMPTY_FILTERS,
      unitsSoldWindow: "30d" as const,
      minUnitsSold: "5",
      trendDirection: "accelerating" as const,
      maxStockCoverageDays: "30",
    };

    expect(shouldRequireAggregatesReady(filters)).toBe(true);
    expect(buildProductQueryPlan(filters)).toMatchObject({
      source: "products_with_derived",
      requireAggregatesReady: true,
    });
  });

  it("maps last-sale sorting to the effective computed date when derived data is needed", () => {
    const plan = buildProductQueryPlan({
      ...EMPTY_FILTERS,
      sortBy: "days_since_sale",
      sortDir: "asc",
    });

    expect(plan).toMatchObject({
      source: "products_with_derived",
      lastSaleField: "effective_last_sale_date",
      sortField: "effective_last_sale_date",
      ascending: false,
    });
  });

  it("sorts margin server-side through the derived margin_ratio column", () => {
    const plan = buildProductQueryPlan({
      ...EMPTY_FILTERS,
      sortBy: "margin",
      sortDir: "desc",
    });

    expect(plan).toMatchObject({
      source: "products_with_derived",
      sortField: "margin_ratio",
      ascending: false,
    });
  });
});
