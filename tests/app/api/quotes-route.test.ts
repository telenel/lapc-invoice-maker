import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
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

const mockGetServerSession = vi.mocked(getServerSession);
const mockQuoteService = vi.mocked(quoteService, true);

describe("GET /api/quotes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes creatorId through for admin-scoped quote views", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: "admin-1", role: "admin" },
    } as never);
    mockQuoteService.list.mockResolvedValue({
      quotes: [],
      total: 0,
      page: 1,
      pageSize: 20,
    } as never);

    const req = new NextRequest(
      "http://localhost/api/quotes?quoteStatus=SENT&creatorId=user-123",
    );

    await GET(req);

    expect(mockQuoteService.list).toHaveBeenCalledWith(
      expect.objectContaining({
        quoteStatus: "SENT",
        creatorId: "user-123",
      }),
    );
  });

  it("still forces non-admins to their own creatorId", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: "user-999", role: "user" },
    } as never);
    mockQuoteService.list.mockResolvedValue({
      quotes: [],
      total: 0,
      page: 1,
      pageSize: 20,
    } as never);

    const req = new NextRequest(
      "http://localhost/api/quotes?quoteStatus=SENT&creatorId=user-123",
    );

    await GET(req);

    expect(mockQuoteService.list).toHaveBeenCalledWith(
      expect.objectContaining({
        creatorId: "user-999",
      }),
    );
  });
});
