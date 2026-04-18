import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdminClient: vi.fn() }));

import { getServerSession } from "next-auth";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { GET } from "@/app/api/products/dcc-list/route";

beforeEach(() => { vi.clearAllMocks(); });

describe("GET /api/products/dcc-list", () => {
  it("dedupes and sorts DCC entries", async () => {
    (getServerSession as ReturnType<typeof vi.fn>).mockResolvedValue({ user: { id: "u1", role: "admin" } });
    const rows = [
      { dept_num: 10, class_num: 20, cat_num: 1, dept_name: "A", class_name: "B", cat_name: "C" },
      { dept_num: 10, class_num: 20, cat_num: 1, dept_name: "A", class_name: "B", cat_name: "C" },
      { dept_num: 5, class_num: 1, cat_num: null, dept_name: "X", class_name: "Y", cat_name: null },
    ];
    (getSupabaseAdminClient as ReturnType<typeof vi.fn>).mockReturnValue({
      from: () => ({ select: () => ({ not: () => Promise.resolve({ data: rows, error: null }) }) }),
    });

    const res = await GET(new NextRequest("http://x/api/products/dcc-list"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(2);
    expect(body.items[0].deptNum).toBe(5);
    expect(body.items[1].deptNum).toBe(10);
  });
});
