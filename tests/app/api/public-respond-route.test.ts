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

  it("rejects catering details for non-catering quotes", async () => {
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

    expect(response.status).toBe(400);
    expect(quoteService.respondToQuote).not.toHaveBeenCalled();
  });

  it("passes catering details through the quote response flow for catering quotes", async () => {
    vi.mocked(quoteService.getByShareToken).mockResolvedValue({
      id: "q1",
      quoteStatus: "SENT",
      isCateringEvent: true,
    } as never);
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

  it("does not preserve omitted optional catering fields from the existing quote", async () => {
    vi.mocked(quoteService.getByShareToken).mockResolvedValue({
      id: "q1",
      quoteStatus: "SENT",
      isCateringEvent: true,
      cateringDetails: {
        eventDate: "2026-04-15",
        startTime: "10:00",
        endTime: "12:00",
        location: "Bookstore",
        contactName: "Jane",
        contactPhone: "555-1111",
        contactEmail: "jane@example.com",
        setupRequired: true,
        takedownRequired: false,
      },
    } as never);
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
    const cateringDetails = vi.mocked(quoteService.respondToQuote).mock.calls[0]?.[4] as Record<string, unknown> | undefined;
    expect(cateringDetails).toBeDefined();
    expect(cateringDetails).not.toHaveProperty("headcount");
    expect(cateringDetails).not.toHaveProperty("setupTime");
    expect(cateringDetails).not.toHaveProperty("takedownTime");
    expect(cateringDetails).not.toHaveProperty("specialInstructions");
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

  it("returns 409 when approval-time payment details are already resolved", async () => {
    vi.mocked(quoteService.respondToQuote).mockRejectedValue(
      Object.assign(new Error("Payment details have already been provided"), {
        code: "PAYMENT_ALREADY_RESOLVED",
      }),
    );

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

    expect(response.status).toBe(409);
  });
});
