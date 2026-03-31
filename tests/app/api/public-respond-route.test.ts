import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/domains/quote/service", () => ({
  quoteService: {
    getByShareToken: vi.fn(),
    respondToQuote: vi.fn(),
  },
}));

import { quoteService } from "@/domains/quote/service";
import { POST } from "@/app/api/quotes/public/[token]/respond/route";

describe("POST /api/quotes/public/[token]/respond", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(quoteService.getByShareToken).mockResolvedValue({
      id: "q1",
      quoteStatus: "SENT",
      isCateringEvent: false,
    } as never);
  });

  it("does not persist catering details when payment validation fails", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/quotes/public/token/respond", {
        method: "POST",
        body: JSON.stringify({
          response: "ACCEPTED",
          paymentMethod: "ACCOUNT_NUMBER",
          cateringDetails: {
            location: "Campus",
            contactName: "Jane",
            contactPhone: "555-1111",
          },
        }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ token: "token" }) },
    );

    expect(response.status).toBe(400);
    expect(quoteService.respondToQuote).not.toHaveBeenCalled();
  });

  it("passes catering details through the quote response flow", async () => {
    vi.mocked(quoteService.respondToQuote).mockResolvedValue({
      id: "q1",
      quoteStatus: "ACCEPTED",
    } as never);

    const response = await POST(
      new NextRequest("http://localhost/api/quotes/public/token/respond", {
        method: "POST",
        body: JSON.stringify({
          response: "ACCEPTED",
          paymentMethod: "CHECK",
          cateringDetails: {
            location: "Campus",
            contactName: "Jane",
            contactPhone: "555-1111",
          },
        }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ token: "token" }) },
    );

    expect(response.status).toBe(200);
    expect(quoteService.respondToQuote).toHaveBeenCalledWith(
      "token",
      "ACCEPTED",
      undefined,
      {
        paymentMethod: "CHECK",
        accountNumber: undefined,
      },
      expect.objectContaining({
        location: "Campus",
        contactName: "Jane",
        contactPhone: "555-1111",
      }),
    );
  });

  it("passes the raw account number shape through to the quote service", async () => {
    vi.mocked(quoteService.respondToQuote).mockResolvedValue({
      id: "q1",
      quoteStatus: "ACCEPTED",
    } as never);

    const response = await POST(
      new NextRequest("http://localhost/api/quotes/public/token/respond", {
        method: "POST",
        body: JSON.stringify({
          response: "ACCEPTED",
          paymentMethod: "ACCOUNT_NUMBER",
          accountNumber: "SAP-12345",
        }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ token: "token" }) },
    );

    expect(response.status).toBe(200);
    expect(quoteService.respondToQuote).toHaveBeenCalledWith(
      "token",
      "ACCEPTED",
      undefined,
      {
        paymentMethod: "ACCOUNT_NUMBER",
        accountNumber: "SAP-12345",
      },
      undefined,
    );
  });

  it("requires catering details when approving a catering quote", async () => {
    vi.mocked(quoteService.getByShareToken).mockResolvedValue({
      id: "q1",
      quoteStatus: "SENT",
      isCateringEvent: true,
    } as never);

    const response = await POST(
      new NextRequest("http://localhost/api/quotes/public/token/respond", {
        method: "POST",
        body: JSON.stringify({
          response: "ACCEPTED",
          paymentMethod: "CHECK",
        }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ token: "token" }) },
    );

    expect(response.status).toBe(400);
    expect(quoteService.respondToQuote).not.toHaveBeenCalled();
  });
});
