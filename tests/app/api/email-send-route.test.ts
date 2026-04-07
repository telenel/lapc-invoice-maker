import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/lib/email", () => ({
  sendEmail: vi.fn(),
}));

vi.mock("@/domains/quote/service", () => ({
  quoteService: {
    getById: vi.fn(),
    generatePdf: vi.fn(),
  },
}));

import { getServerSession } from "next-auth";
import { sendEmail } from "@/lib/email";
import { quoteService } from "@/domains/quote/service";
import { POST } from "@/app/api/email/send/route";

describe("POST /api/email/send", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "u1", role: "admin" },
    } as never);
    vi.mocked(sendEmail).mockResolvedValue(true as never);
    vi.mocked(quoteService.generatePdf).mockResolvedValue({
      buffer: Buffer.from("pdf"),
      filename: "Q-1",
    } as never);
  });

  it("uses view-only wording for closed quote share emails", async () => {
    vi.mocked(quoteService.getById).mockResolvedValue({
      id: "quote-1",
      quoteNumber: "Q-1",
      quoteStatus: "ACCEPTED",
      recipientName: "Jane",
      recipientEmail: "jane@example.com",
      creatorId: "u1",
    } as never);
    const response = await POST(
      new NextRequest("http://localhost/api/email/send", {
        method: "POST",
        body: JSON.stringify({
          type: "quote-share",
          to: "jane@example.com",
          data: {
            quoteId: "quote-1",
            quoteNumber: "Q-1",
            recipientName: "Jane",
            shareUrl: "https://laportal.example.com/quotes/review/share-token",
            quoteStatus: "ACCEPTED",
          },
        }),
        headers: { "Content-Type": "application/json" },
      }),
    );

    expect(response.status).toBe(200);
    expect(sendEmail).toHaveBeenCalledWith(
      "jane@example.com",
      "Quote Q-1 from Los Angeles Pierce College",
      expect.stringContaining("You can view the quote using the link below:"),
      expect.any(Array),
    );
    expect(vi.mocked(sendEmail).mock.calls[0]?.[2]).not.toContain("Please review and respond to the quote");
  });

  it("keeps response-request wording for open quote share emails", async () => {
    vi.mocked(quoteService.getById).mockResolvedValue({
      id: "quote-1",
      quoteNumber: "Q-1",
      quoteStatus: "SENT",
      recipientName: "Jane",
      recipientEmail: "jane@example.com",
      creatorId: "u1",
    } as never);
    await POST(
      new NextRequest("http://localhost/api/email/send", {
        method: "POST",
        body: JSON.stringify({
          type: "quote-share",
          to: "jane@example.com",
          data: {
            quoteId: "quote-1",
            quoteNumber: "Q-1",
            recipientName: "Jane",
            shareUrl: "https://laportal.example.com/quotes/review/share-token",
            quoteStatus: "SENT",
          },
        }),
        headers: { "Content-Type": "application/json" },
      }),
    );

    expect(sendEmail).toHaveBeenCalledWith(
      "jane@example.com",
      "Quote Q-1 from Los Angeles Pierce College",
      expect.stringContaining("Please review and respond to the quote using the link below:"),
      expect.any(Array),
    );
  });
});
