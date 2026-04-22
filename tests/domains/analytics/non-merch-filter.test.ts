import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRawUnsafe: vi.fn(),
    invoice: { findMany: vi.fn() },
    printQuote: { findMany: vi.fn() },
    syncRun: { findFirst: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { analyticsRepository } from "@/domains/analytics/repository";
import { NON_MERCH_DEPT_NAMES, NON_MERCH_SKUS } from "@/domains/product/non-merch-skus";

type Call = [sql: string, ...params: unknown[]];

const RANGE = { dateFrom: "2026-01-01", dateTo: "2026-01-31" };

function sqlCalls(): Call[] {
  return vi
    .mocked(prisma.$queryRawUnsafe)
    .mock.calls.map((call) => call as unknown as Call);
}

function findSqlContaining(needle: string): Call | undefined {
  return sqlCalls().find(([sql]) => sql.includes(needle));
}

function expectNonMerchFilter(call: Call | undefined, { needsProductsJoin = false } = {}) {
  expect(call, "expected query to be invoked").toBeDefined();
  const [sql, ...params] = call!;

  // Hard-exclusion on the non-merch SKU list via a bound int[] parameter.
  expect(sql).toMatch(/NOT IN \(\s*SELECT UNNEST\(\$\d+::int\[\]\)\s*\)/);

  // Department-name fallback via a bound text[] parameter.
  expect(sql).toMatch(/<> ALL\(\$\d+::text\[\]\)/);

  if (needsProductsJoin) {
    expect(sql).toMatch(/JOIN products\b/);
  }

  // Both constants are passed as parameters.
  expect(params).toEqual(
    expect.arrayContaining([
      expect.arrayContaining([...NON_MERCH_SKUS]),
      expect.arrayContaining(NON_MERCH_DEPT_NAMES.map((name) => name.toUpperCase())),
    ]),
  );
}

describe("non-merchandise SKU filter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.$queryRawUnsafe).mockResolvedValue([] as never);
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.printQuote.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.syncRun.findFirst).mockResolvedValue(null as never);
  });

  it("exposes the shared non-merch constants", () => {
    expect(NON_MERCH_SKUS).toEqual([1, 2]);
    expect(NON_MERCH_DEPT_NAMES.map((name) => name.toUpperCase())).toEqual(
      expect.arrayContaining(["SHIPPING", "WEB SHIPPING", "GIFT"]),
    );
  });

  it("filters non-merch SKUs out of findTopProducts (units + revenue cards)", async () => {
    await analyticsRepository.findOperationsSnapshot(RANGE);

    const unitsCall = sqlCalls().find(
      ([sql]) => sql.includes("MAX(pwd.trend_direction)") && sql.includes("units DESC, revenue DESC"),
    );
    const revenueCall = sqlCalls().find(
      ([sql]) => sql.includes("MAX(pwd.trend_direction)") && sql.includes("revenue DESC, units DESC"),
    );

    expectNonMerchFilter(unitsCall);
    expectNonMerchFilter(revenueCall);
  });

  it("filters non-merch SKUs out of findCategoryMix", async () => {
    await analyticsRepository.findOperationsSnapshot(RANGE);
    const call = findSqlContaining("GROUP BY COALESCE(NULLIF(TRIM(p.dept_name)");
    expectNonMerchFilter(call);
  });

  it("filters non-merch SKUs out of findRevenueConcentration and joins products for the dept fallback", async () => {
    await analyticsRepository.findOperationsSnapshot(RANGE);
    const call = sqlCalls().find(
      ([sql]) =>
        sql.includes("GROUP BY st.sku") &&
        sql.includes("HAVING COALESCE(SUM(st.ext_price), 0) > 0") &&
        !sql.includes("MAX(pwd.trend_direction)"),
    );
    expectNonMerchFilter(call, { needsProductsJoin: true });
  });

  it("filters non-merch SKUs out of findProductTrends (accelerating + decelerating)", async () => {
    await analyticsRepository.findOperationsSnapshot(RANGE);
    const calls = sqlCalls().filter(
      ([sql]) => sql.includes("FROM products_with_derived pwd") && sql.includes("pwd.trend_direction = $1"),
    );
    expect(calls).toHaveLength(2);
    for (const call of calls) {
      expectNonMerchFilter(call);
    }
  });

  it("filters non-merch SKUs out of findNewProducts", async () => {
    await analyticsRepository.findOperationsSnapshot(RANGE);
    const call = sqlCalls().find(
      ([sql]) =>
        sql.includes("FROM products_with_derived pwd") &&
        sql.includes("pwd.first_sale_date_computed >= $1::date"),
    );
    expectNonMerchFilter(call);
  });
});
