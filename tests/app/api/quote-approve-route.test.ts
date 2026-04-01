import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/domains/quote/service", () => ({
  quoteService: {
    getById: vi.fn(),
    approveManually: vi.fn(),
  },
}));

import { getServerSession } from "next-auth";
import { quoteService } from "@/domains/quote/service";
import { POST } from "@/app/api/quotes/[id]/approve/route";

describe("POST /api/quotes/[id]/approve", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "u1", role: "admin" },
    } as never);
    vi.mocked(quoteService.getById).mockResolvedValue({
      id: "q1",
      creatorId: "u1",
    } as never);
  });

  it("forwards manual approval payment details to the quote service", async () => {
    vi.mocked(quoteService.approveManually).mockResolvedValue({
      success: true,
      status: "ACCEPTED",
    } as never);

    const response = await POST(
      new NextRequest("http://localhost/api/quotes/q1/approve", {
        method: "POST",
        body: JSON.stringify({
          paymentMethod: "CHECK",
          accountNumber: "SAP-12345",
        }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ id: "q1" }) },
    );

    expect(response.status).toBe(200);
    expect(quoteService.approveManually).toHaveBeenCalledWith("q1", {
      paymentMethod: "CHECK",
      accountNumber: "SAP-12345",
    });
  });
});
