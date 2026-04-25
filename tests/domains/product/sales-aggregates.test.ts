import { describe, expect, it, vi } from "vitest";
import {
  buildAggregateRecomputeSql,
  buildAnalyticsRollupRefreshSql,
  runAggregateRecompute,
} from "@/domains/product/sales-aggregates";

describe("sales-aggregates", () => {
  it("buildAggregateRecomputeSql includes all 14 aggregate assignments", () => {
    const sql = buildAggregateRecomputeSql();
    expect(sql).toContain("units_sold_30d");
    expect(sql).toContain("units_sold_90d");
    expect(sql).toContain("units_sold_1y");
    expect(sql).toContain("units_sold_3y");
    expect(sql).toContain("units_sold_lifetime");
    expect(sql).toContain("revenue_30d");
    expect(sql).toContain("revenue_90d");
    expect(sql).toContain("revenue_1y");
    expect(sql).toContain("revenue_3y");
    expect(sql).toContain("revenue_lifetime");
    expect(sql).toContain("txns_1y");
    expect(sql).toContain("txns_lifetime");
    expect(sql).toContain("first_sale_date_computed");
    expect(sql).toContain("last_sale_date_computed");
    expect(sql).toContain("sales_aggregates_computed_at");
  });

  it("buildAggregateRecomputeSql excludes dtl_f_status = 1 rows", () => {
    expect(buildAggregateRecomputeSql()).toContain("dtl_f_status <> 1");
  });

  it("buildAggregateRecomputeSql scopes the update to a SKU batch", () => {
    expect(buildAggregateRecomputeSql()).toContain("sku = ANY($1::bigint[])");
    expect(buildAggregateRecomputeSql()).toContain("SELECT COUNT(*)::int AS affected FROM updated");
  });

  it("buildAnalyticsRollupRefreshSql refreshes analytics materialized views", () => {
    expect(buildAnalyticsRollupRefreshSql()).toEqual([
      "REFRESH MATERIALIZED VIEW analytics_sales_daily",
      "REFRESH MATERIALIZED VIEW analytics_sales_receipts_daily",
      "REFRESH MATERIALIZED VIEW analytics_sales_hourly",
    ]);
  });

  it("runAggregateRecompute walks sale-active SKU batches and totals the affected rows", async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [{ sku: "10" }, { sku: "12" }] })
      .mockResolvedValueOnce({ rows: [{ affected: 2 }] })
      .mockResolvedValueOnce({ rows: [{ sku: "30" }] })
      .mockResolvedValueOnce({ rows: [{ affected: 1 }] })
      .mockResolvedValueOnce({ rows: [] });

    const result = await runAggregateRecompute({
      db: { query },
      batchSize: 2,
    });

    expect(result).toBe(3);
    expect(query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("SELECT sku"),
      [0, 2],
    );
    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("sku = ANY($1::bigint[])"),
      [["10", "12"]],
    );
    expect(query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining("SELECT sku"),
      ["12", 2],
    );
    expect(query).toHaveBeenNthCalledWith(
      4,
      expect.stringContaining("sku = ANY($1::bigint[])"),
      [["30"]],
    );
    expect(query).toHaveBeenNthCalledWith(
      6,
      "REFRESH MATERIALIZED VIEW analytics_sales_daily",
    );
    expect(query).toHaveBeenNthCalledWith(
      7,
      "REFRESH MATERIALIZED VIEW analytics_sales_receipts_daily",
    );
    expect(query).toHaveBeenNthCalledWith(
      8,
      "REFRESH MATERIALIZED VIEW analytics_sales_hourly",
    );
  });

  it("runAggregateRecompute throws when a batch query fails", async () => {
    const query = vi.fn().mockRejectedValue(new Error("boom"));

    await expect(
      runAggregateRecompute({
        db: { query },
      }),
    ).rejects.toThrow(/boom/);
  });
});
