import { describe, expect, it } from "vitest";
import { accumulateGroupedRollups, accumulateProductSummary } from "@/domains/product/summary";

describe("accumulateProductSummary", () => {
  it("computes stock value, gross profit, value at risk, and units per receipt", () => {
    const summary = accumulateProductSummary(
      [
        {
          sku: 1,
          stock_on_hand: 10,
          cost: 5,
          retail_price: 10,
          revenue_30d: 40,
          revenue_90d: 60,
          revenue_1y: 120,
          units_sold_30d: 4,
          units_sold_90d: 6,
          units_sold_1y: 12,
          txns_1y: 3,
          margin_ratio: 0.5,
          stock_coverage_days: 18,
          effective_last_sale_date: "2026-04-10T00:00:00.000Z",
          aggregates_ready: true,
          sales_aggregates_computed_at: "2026-04-18T12:00:00.000Z",
        },
        {
          sku: 2,
          stock_on_hand: 8,
          cost: 7,
          retail_price: 9,
          revenue_30d: 0,
          revenue_90d: 0,
          revenue_1y: 0,
          units_sold_30d: 0,
          units_sold_90d: 0,
          units_sold_1y: 0,
          txns_1y: 0,
          margin_ratio: 0.22,
          stock_coverage_days: null,
          effective_last_sale_date: null,
          aggregates_ready: false,
          sales_aggregates_computed_at: null,
        },
      ],
      "1y",
      new Date("2026-04-18T18:00:00.000Z").getTime(),
    );

    expect(summary.metrics.stockCost).toBe(106);
    expect(summary.metrics.grossProfit1y).toBe(60);
    expect(summary.metrics.inventoryAtRiskCost).toBe(56);
    expect(summary.metrics.unitsPerReceipt1y).toBeCloseTo(4);
    expect(summary.freshness.analyticsPendingCount).toBe(1);
  });
});

describe("accumulateGroupedRollups", () => {
  it("groups by DCC and computes share of inventory value", () => {
    const rows = [
      {
        sku: 1,
        dept_num: 10,
        class_num: 20,
        cat_num: 30,
        dept_name: "Books",
        class_name: "Course",
        cat_name: "Math",
        vendor_id: 101,
        stock_on_hand: 5,
        cost: 10,
        revenue_1y: 200,
        margin_ratio: 0.4,
      },
      {
        sku: 2,
        dept_num: 10,
        class_num: 20,
        cat_num: 30,
        dept_name: "Books",
        class_name: "Course",
        cat_name: "Math",
        vendor_id: 101,
        stock_on_hand: 3,
        cost: 12,
        revenue_1y: 100,
        margin_ratio: 0.3,
      },
      {
        sku: 3,
        dept_num: 11,
        class_num: 10,
        cat_num: 5,
        dept_name: "Supplies",
        class_name: "Art",
        cat_name: "Pens",
        vendor_id: 202,
        stock_on_hand: 4,
        cost: 8,
        revenue_1y: 150,
        margin_ratio: 0.2,
      },
    ];

    const rollups = accumulateGroupedRollups(rows, "dcc");
    expect(rollups[0]).toMatchObject({
      label: "10.20.30 · Books › Course › Math",
      skuCount: 2,
      stockCost: 86,
    });
    expect(rollups[0].shareOfStockCost).toBeGreaterThan(0.7);
  });
});
