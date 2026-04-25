import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRawUnsafe: vi.fn(),
    invoice: {
      findMany: vi.fn(),
    },
    printQuote: {
      findMany: vi.fn(),
    },
    syncRun: {
      findFirst: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { analyticsRepository } from "@/domains/analytics/repository";

type QueryCall = {
  sql: string;
  params: unknown[];
};

function getQueryCalls(): QueryCall[] {
  return vi.mocked(prisma.$queryRawUnsafe).mock.calls.map(([sql, ...params]) => ({
    sql: typeof sql === "string" ? sql : "",
    params,
  }));
}

function findQueryCall(predicate: (sql: string) => boolean) {
  const call = getQueryCalls().find((entry) => predicate(entry.sql));
  expect(call).toBeDefined();
  return call!;
}

describe("analyticsRepository non-merchandise filters", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-21T12:00:00.000Z"));
    vi.clearAllMocks();
    vi.mocked(prisma.$queryRawUnsafe).mockResolvedValue([] as never);
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.printQuote.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.syncRun.findFirst).mockResolvedValue(null as never);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("binds non-merch SKU and department filters into all product-performance queries", async () => {
    await analyticsRepository.findOperationsSnapshot({
      dateFrom: "2026-03-01",
      dateTo: "2026-03-31",
    });

    const topProductQueries = getQueryCalls().filter((call) =>
      call.sql.includes("MAX(pwd.trend_direction) AS trend_direction"),
    );
    expect(topProductQueries).toHaveLength(2);
    for (const call of topProductQueries) {
      expect(call.sql).toContain("sd.sku NOT IN");
      expect(call.sql).toContain("p.dept_name");
      expect(call.sql).toContain("p.cat_name");
      expect(call.params.at(-2)).toEqual([1, 2]);
      expect(call.params.at(-1)).toEqual(["SHIPPING", "WEB SHIPPING", "GIFT"]);
    }

    const productTrendsQuery = findQueryCall((sql) =>
      sql.includes("FROM products_with_derived pwd") && sql.includes("WHERE pwd.trend_direction = $1"),
    );
    expect(productTrendsQuery.sql).toContain("pwd.sku NOT IN");
    expect(productTrendsQuery.sql).toContain("pwd.dept_name");
    expect(productTrendsQuery.sql).toContain("pwd.cat_name");
    expect(productTrendsQuery.params.at(-2)).toEqual([1, 2]);
    expect(productTrendsQuery.params.at(-1)).toEqual(["SHIPPING", "WEB SHIPPING", "GIFT"]);

    const newProductsQuery = findQueryCall((sql) =>
      sql.includes("FROM products_with_derived pwd") && sql.includes("WHERE pwd.first_sale_date_computed >= $1::date"),
    );
    expect(newProductsQuery.sql).toContain("pwd.sku NOT IN");
    expect(newProductsQuery.sql).toContain("pwd.dept_name");
    expect(newProductsQuery.sql).toContain("pwd.cat_name");
    expect(newProductsQuery.params.at(-2)).toEqual([1, 2]);
    expect(newProductsQuery.params.at(-1)).toEqual(["SHIPPING", "WEB SHIPPING", "GIFT"]);

    const categoryMixQuery = findQueryCall((sql) =>
      sql.includes("AS category") && sql.includes("GROUP BY COALESCE(NULLIF(TRIM(p.dept_name), ''), 'Uncategorized')"),
    );
    expect(categoryMixQuery.sql).toContain("sd.sku NOT IN");
    expect(categoryMixQuery.sql).toContain("p.dept_name");
    expect(categoryMixQuery.sql).toContain("p.cat_name");
    expect(categoryMixQuery.params.at(-2)).toEqual([1, 2]);
    expect(categoryMixQuery.params.at(-1)).toEqual(["SHIPPING", "WEB SHIPPING", "GIFT"]);

    const revenueConcentrationQuery = findQueryCall((sql) =>
      sql.includes("GROUP BY sd.sku") &&
      sql.includes("ORDER BY revenue DESC") &&
      !sql.includes("MAX(pwd.trend_direction) AS trend_direction"),
    );
    expect(revenueConcentrationQuery.sql).toContain("LEFT JOIN products p");
    expect(revenueConcentrationQuery.sql).toContain("sd.sku NOT IN");
    expect(revenueConcentrationQuery.sql).toContain("p.dept_name");
    expect(revenueConcentrationQuery.sql).toContain("p.cat_name");
    expect(revenueConcentrationQuery.params.at(-2)).toEqual([1, 2]);
    expect(revenueConcentrationQuery.params.at(-1)).toEqual(["SHIPPING", "WEB SHIPPING", "GIFT"]);
  });
});
