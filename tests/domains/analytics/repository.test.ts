import { beforeEach, describe, expect, it, vi } from "vitest";

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

describe("analyticsRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.$queryRawUnsafe).mockResolvedValue([] as never);
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.printQuote.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.syncRun.findFirst).mockResolvedValue(null as never);
  });

  it("excludes archived CopyTech invoices from operations analytics", async () => {
    await analyticsRepository.findOperationsSnapshot({
      dateFrom: "2026-01-01",
      dateTo: "2026-01-31",
    });

    const copyTechQueries = vi
      .mocked(prisma.$queryRawUnsafe)
      .mock.calls.map(([sql]) => sql)
      .filter((sql): sql is string => typeof sql === "string" && sql.includes("category = 'COPY_TECH'"));

    expect(copyTechQueries.length).toBeGreaterThan(0);
    expect(copyTechQueries.every((sql) => sql.includes("archived_at IS NULL"))).toBe(true);
  });

  it("keeps zero-stock rows in reorder breach counts while filtering stock-only aggregates", async () => {
    await analyticsRepository.findOperationsSnapshot({
      dateFrom: "2026-01-01",
      dateTo: "2026-01-31",
    });

    const inventorySummaryQuery = vi
      .mocked(prisma.$queryRawUnsafe)
      .mock.calls.map(([sql]) => sql)
      .find((sql): sql is string => typeof sql === "string" && sql.includes("AS reorder_breach_count"));

    expect(inventorySummaryQuery).toBeDefined();
    expect(inventorySummaryQuery?.match(/COALESCE\(inv\.stock_on_hand, 0\) > 0/g)).toHaveLength(2);
    expect(inventorySummaryQuery).not.toMatch(
      /LEFT JOIN products p\s+ON p\.sku = inv\.sku\s+WHERE\s+COALESCE\(inv\.stock_on_hand,\s*0\)\s*>\s*0\b/,
    );
  });

  it("uses analytics sales rollups instead of raw transaction scans for range charts", async () => {
    await analyticsRepository.findOperationsSnapshot({
      dateFrom: "2026-01-01",
      dateTo: "2026-01-31",
    });

    const sql = vi
      .mocked(prisma.$queryRawUnsafe)
      .mock.calls.map(([statement]) => String(statement))
      .join("\n");

    expect(sql).toContain("analytics_sales_daily");
    expect(sql).toContain("analytics_sales_receipts_daily");
    expect(sql).toContain("analytics_sales_hourly");
    expect(sql).not.toContain("(st.process_date AT TIME ZONE 'America/Los_Angeles')::date BETWEEN");
  });

  it("reads receipt KPIs from receipt-grain rollups instead of SKU-grain rollups", async () => {
    await analyticsRepository.findOperationsSnapshot({
      dateFrom: "2026-01-01",
      dateTo: "2026-01-31",
    });

    const sql = vi
      .mocked(prisma.$queryRawUnsafe)
      .mock.calls.map(([statement]) => String(statement))
      .join("\n");

    expect(sql).toContain("SUM(sr.receipts)");
    expect(sql).not.toContain("SUM(sd.receipts)");
  });
});
