import { describe, expect, it } from "vitest";
import { EMPTY_FILTERS } from "@/domains/product/constants";
import { buildProductQueryPlan, hasAnalyticsProductFilters } from "@/domains/product/queries";

describe("buildProductQueryPlan", () => {
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
      unitsSoldWindow: "1y" as const,
      minUnitsSold: "10",
    };

    expect(hasAnalyticsProductFilters(filters)).toBe(true);
    expect(buildProductQueryPlan(filters)).toMatchObject({
      source: "products_with_derived",
      requireAggregatesReady: true,
    });
  });

  it("does not gate zero-sale aggregate filters on computed aggregate rows", () => {
    const filters = {
      ...EMPTY_FILTERS,
      unitsSoldWindow: "1y" as const,
      maxUnitsSold: "0",
    };

    expect(hasAnalyticsProductFilters(filters)).toBe(true);
    expect(buildProductQueryPlan(filters)).toMatchObject({
      source: "products_with_derived",
      requireAggregatesReady: false,
    });
  });

  it("does not gate never-sold lifetime filters on computed aggregate rows", () => {
    const plan = buildProductQueryPlan({
      ...EMPTY_FILTERS,
      neverSoldLifetime: true,
    });

    expect(plan).toMatchObject({
      source: "products_with_derived",
      requireAggregatesReady: false,
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

  it("routes edited-since-sync filters through the derived view", () => {
    const plan = buildProductQueryPlan({
      ...EMPTY_FILTERS,
      editedSinceSync: true,
    });

    expect(plan).toMatchObject({
      source: "products_with_derived",
    });
  });

  it("routes recent-edited filters through the derived view", () => {
    const plan = buildProductQueryPlan({
      ...EMPTY_FILTERS,
      editedWithin: "7d",
    });

    expect(plan).toMatchObject({
      source: "products_with_derived",
    });
  });
});
