import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/domains/quote/service", () => ({
  quoteService: {
    getById: vi.fn(),
    markSent: vi.fn(),
  },
}));

import { getServerSession } from "next-auth";
import { quoteService } from "@/domains/quote/service";
import { POST } from "@/app/api/quotes/[id]/send/route";

describe("POST /api/quotes/[id]/send", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXTAUTH_URL = "https://laportal.example.com";
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "u1", role: "admin" },
    } as never);
    vi.mocked(quoteService.getById).mockResolvedValue({
      id: "q1",
      creatorId: "u1",
    } as never);
    vi.mocked(quoteService.markSent).mockResolvedValue({
      shareToken: "share-token",
    } as never);
  });

  it("builds the share URL from NEXTAUTH_URL instead of request headers", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/quotes/q1/send", {
        method: "POST",
        headers: {
          origin: "https://attacker.example.com",
        },
      }),
      { params: Promise.resolve({ id: "q1" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      shareUrl: "https://laportal.example.com/quotes/review/share-token",
    });
  });
});
