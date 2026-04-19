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

import { getServerSession } from "next-auth";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { GET } from "@/app/api/products/rollups/route";

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

describe("GET /api/products/rollups", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "u1", role: "user" },
    } as never);
  });

  it("returns exact grouped rollups for the active result set", async () => {
    const query = buildQueryMock([
      {
        data: [
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
        ],
        error: null,
      },
      { data: [], error: null },
    ]);

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn(() => query),
    } as never);

    const res = await GET(
      new NextRequest("http://localhost/api/products/rollups?tab=merchandise&group=dcc"),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.group).toBe("dcc");
    expect(body.rows[0]).toMatchObject({
      label: "10.20.30 · Books › Course › Math",
      stockCost: 86,
    });
  });
});
