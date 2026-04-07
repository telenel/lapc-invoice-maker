import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/domains/quote/service", () => ({
  quoteService: {
    list: vi.fn(),
    create: vi.fn(),
  },
}));

import { getServerSession } from "next-auth";
import { quoteService } from "@/domains/quote/service";
import { GET } from "@/app/api/quotes/route";

describe("GET /api/quotes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "u1", role: "user" },
    } as never);
    vi.mocked(quoteService.list).mockResolvedValue({
      quotes: [],
      total: 0,
      page: 1,
      pageSize: 20,
    } as never);
  });

  it("does not scope non-admin quote lists to the current user", async () => {
    const response = await GET(
      new NextRequest(
        "http://localhost/api/quotes?quoteStatus=SENT&creatorId=other-user&page=2&pageSize=10&sortBy=totalAmount&sortOrder=asc"
      ),
    );

    expect(response.status).toBe(200);
    expect(quoteService.list).toHaveBeenCalledWith({
      search: undefined,
      quoteStatus: "SENT",
      department: undefined,
      category: undefined,
      creatorId: "other-user",
      dateFrom: undefined,
      dateTo: undefined,
      amountMin: undefined,
      amountMax: undefined,
      page: 2,
      pageSize: 10,
      sortBy: "totalAmount",
      sortOrder: "asc",
    });
  });
});
