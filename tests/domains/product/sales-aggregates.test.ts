import { describe, expect, it, vi } from "vitest";
import { buildAggregateRecomputeSql, runAggregateRecompute } from "@/domains/product/sales-aggregates";

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

  it("runAggregateRecompute returns affected SKU count from RPC result", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: 10659, error: null });
    const client = { rpc } as unknown as Parameters<typeof runAggregateRecompute>[0];
    const result = await runAggregateRecompute(client);
    expect(result).toBe(10659);
    expect(rpc).toHaveBeenCalledWith("recompute_product_sales_aggregates");
  });

  it("runAggregateRecompute throws on RPC error", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: "boom" } });
    const client = { rpc } as unknown as Parameters<typeof runAggregateRecompute>[0];
    await expect(runAggregateRecompute(client)).rejects.toThrow(/boom/);
  });
});
