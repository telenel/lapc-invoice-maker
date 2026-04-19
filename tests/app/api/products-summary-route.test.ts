import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdminClient: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    syncRun: {
      findFirst: vi.fn(),
    },
  },
}));

import { getServerSession } from "next-auth";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { prisma } from "@/lib/prisma";
import { GET } from "@/app/api/products/summary/route";

type QueryPage = { data: unknown[] | null; error: { message: string } | null };

function buildQueryMock(pages: QueryPage[]) {
  const query: Record<string, unknown> = {};
  const chainMethods = [
    "select",
    "in",
    "or",
    "gte",
    "lte",
    "eq",
    "not",
    "ilike",
    "is",
    "filter",
    "order",
  ];

  for (const method of chainMethods) {
    query[method] = vi.fn(() => query);
  }

  query.range = vi.fn(async () => pages.shift() ?? { data: [], error: null });

  return query;
}

describe("GET /api/products/summary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "u1", role: "user" },
    } as never);
  });

  it("returns an exact summary payload with freshness metadata", async () => {
    const query = buildQueryMock([
      {
        data: [
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
        error: null,
      },
      { data: [], error: null },
    ]);

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn(() => query),
    } as never);
    vi.mocked(prisma.syncRun.findFirst).mockResolvedValue({
      status: "partial",
      completedAt: new Date("2026-04-18T12:44:53.171Z"),
    } as never);

    const res = await GET(
      new NextRequest("http://localhost/api/products/summary?tab=merchandise&minStock=1&analysisWindow=30d"),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.metrics).toHaveProperty("inventoryAtRiskCost", 56);
    expect(body.freshness).toHaveProperty("latestSyncStatus", "partial");
    expect(body.analysisWindow).toBe("30d");
  });
});
