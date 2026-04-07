import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/domains/quote/service", () => ({
  quoteService: {
    getById: vi.fn(),
    generatePdf: vi.fn(),
  },
}));

import { getServerSession } from "next-auth";
import { quoteService } from "@/domains/quote/service";
import { GET } from "@/app/api/quotes/[id]/pdf/route";

describe("GET /api/quotes/[id]/pdf", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "viewer-1", role: "user" },
    } as never);
  });

  it("returns 403 when a non-admin requests another user's quote PDF", async () => {
    vi.mocked(quoteService.getById).mockResolvedValue({
      id: "quote-1",
      creatorId: "owner-1",
    } as never);

    const response = await GET(
      new NextRequest("http://localhost/api/quotes/quote-1/pdf"),
      { params: Promise.resolve({ id: "quote-1" }) },
    );

    expect(response.status).toBe(403);
    expect(quoteService.generatePdf).not.toHaveBeenCalled();
  });
});
