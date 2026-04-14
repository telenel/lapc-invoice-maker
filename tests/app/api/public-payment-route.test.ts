import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/domains/quote/service", () => ({
  quoteService: {
    getByShareToken: vi.fn(),
    submitPublicPaymentDetails: vi.fn(),
  },
  isPublicPaymentLinkAvailable: vi.fn(),
}));

vi.mock("@/lib/sse", () => ({
  safePublishAll: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(),
}));

import { quoteService } from "@/domains/quote/service";
import { isPublicPaymentLinkAvailable } from "@/domains/quote/service";
import { safePublishAll } from "@/lib/sse";
import { checkRateLimit } from "@/lib/rate-limit";
import { POST } from "@/app/api/quotes/public/[token]/payment/route";

describe("POST /api/quotes/public/[token]/payment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(checkRateLimit).mockResolvedValue({
      allowed: true,
      retryAfterMs: 0,
    } as never);
    vi.mocked(quoteService.getByShareToken).mockResolvedValue({
      id: "q1",
      quoteStatus: "ACCEPTED",
      convertedToInvoice: null,
    } as never);
    vi.mocked(isPublicPaymentLinkAvailable).mockReturnValue(true);
  });

  it("returns 400 when the JSON body is null", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/quotes/public/token/payment", {
        method: "POST",
        body: "null",
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ token: "token" }) },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid request body" });
    expect(quoteService.getByShareToken).not.toHaveBeenCalled();
    expect(quoteService.submitPublicPaymentDetails).not.toHaveBeenCalled();
    expect(safePublishAll).not.toHaveBeenCalled();
  });

  it("returns 400 when the JSON body is malformed", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/quotes/public/token/payment", {
        method: "POST",
        body: "{invalid json",
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ token: "token" }) },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid request body" });
    expect(quoteService.getByShareToken).not.toHaveBeenCalled();
    expect(quoteService.submitPublicPaymentDetails).not.toHaveBeenCalled();
    expect(safePublishAll).not.toHaveBeenCalled();
  });

  it("normalizes whitespace in the public token", async () => {
    vi.mocked(quoteService.submitPublicPaymentDetails).mockResolvedValue({
      id: "q1",
      quoteNumber: "Q-1",
      recipientEmail: "jane@example.com",
      paymentMethod: null,
      convertedToInvoice: null,
      updatedConvertedInvoice: false,
    } as never);

    const response = await POST(
      new NextRequest("http://localhost/api/quotes/public/token/payment", {
        method: "POST",
        body: JSON.stringify({
          paymentMethod: "CHECK",
        }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ token: "  token  " }) },
    );

    expect(response.status).toBe(200);
    expect(quoteService.getByShareToken).toHaveBeenCalledWith("token");
    expect(quoteService.submitPublicPaymentDetails).toHaveBeenCalledWith("token", {
      paymentMethod: "CHECK",
      accountNumber: undefined,
    });
  });

  it("treats archived quotes as unavailable for public payment submissions", async () => {
    vi.mocked(quoteService.getByShareToken).mockResolvedValue({
      id: "q1",
      quoteStatus: "ACCEPTED",
      convertedToInvoice: null,
      archivedAt: "2026-04-13T12:00:00.000Z",
    } as never);

    const response = await POST(
      new NextRequest("http://localhost/api/quotes/public/token/payment", {
        method: "POST",
        body: JSON.stringify({
          paymentMethod: "CHECK",
        }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ token: "token" }) },
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Quote not found or not accepted" });
    expect(quoteService.submitPublicPaymentDetails).not.toHaveBeenCalled();
  });

  it("updates the converted invoice alongside the quote", async () => {
    vi.mocked(quoteService.submitPublicPaymentDetails).mockResolvedValue({
      id: "q1",
      quoteNumber: "Q-1",
      recipientEmail: "jane@example.com",
      paymentMethod: null,
      convertedToInvoice: null,
      updatedConvertedInvoice: true,
    } as never);

    const response = await POST(
      new NextRequest("http://localhost/api/quotes/public/token/payment", {
        method: "POST",
        body: JSON.stringify({
          paymentMethod: "ACCOUNT_NUMBER",
          accountNumber: "SAP-12345",
        }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ token: "token" }) },
    );

    expect(response.status).toBe(200);
    expect(quoteService.submitPublicPaymentDetails).toHaveBeenCalledWith("token", {
      paymentMethod: "ACCOUNT_NUMBER",
      accountNumber: "SAP-12345",
    });
    expect(safePublishAll).toHaveBeenCalledWith({ type: "invoice-changed" });
  });

  it("emits invoice SSE when conversion appears during payment submission", async () => {
    vi.mocked(quoteService.submitPublicPaymentDetails).mockResolvedValue({
      id: "q1",
      quoteNumber: "Q-1",
      recipientEmail: "jane@example.com",
      paymentMethod: null,
      convertedToInvoice: null,
      updatedConvertedInvoice: true,
    } as never);

    const response = await POST(
      new NextRequest("http://localhost/api/quotes/public/token/payment", {
        method: "POST",
        body: JSON.stringify({
          paymentMethod: "CHECK",
        }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ token: "token" }) },
    );

    expect(response.status).toBe(200);
    expect(safePublishAll).toHaveBeenCalledWith({ type: "invoice-changed" });
  });

  it("rejects attempts to overwrite already-provided payment details", async () => {
    vi.mocked(quoteService.submitPublicPaymentDetails).mockRejectedValue(
      Object.assign(new Error("Payment details have already been provided"), {
        code: "PAYMENT_ALREADY_RESOLVED",
      }),
    );

    const response = await POST(
      new NextRequest("http://localhost/api/quotes/public/token/payment", {
        method: "POST",
        body: JSON.stringify({
          paymentMethod: "ACCOUNT_NUMBER",
          accountNumber: "SAP-99999",
        }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ token: "token" }) },
    );

    expect(response.status).toBe(409);
    expect(safePublishAll).not.toHaveBeenCalled();
  });

  it("blocks public payment updates when the converted invoice is finalized", async () => {
    vi.mocked(quoteService.submitPublicPaymentDetails).mockRejectedValue(
      Object.assign(new Error("Cannot update a finalized invoice"), {
        code: "FORBIDDEN",
      }),
    );

    const response = await POST(
      new NextRequest("http://localhost/api/quotes/public/token/payment", {
        method: "POST",
        body: JSON.stringify({
          paymentMethod: "CHECK",
        }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ token: "token" }) },
    );

    expect(response.status).toBe(409);
    expect(safePublishAll).not.toHaveBeenCalled();
  });

  it("blocks payment submissions when the payment link is not available", async () => {
    vi.mocked(isPublicPaymentLinkAvailable).mockReturnValue(false);
    vi.mocked(quoteService.getByShareToken).mockResolvedValue({
      id: "q1",
      quoteStatus: "ACCEPTED",
      convertedToInvoice: { id: "inv1" },
    } as never);

    const response = await POST(
      new NextRequest("http://localhost/api/quotes/public/token/payment", {
        method: "POST",
        body: JSON.stringify({
          paymentMethod: "CHECK",
        }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ token: "token" }) },
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "Payment link is no longer available" });
    expect(quoteService.submitPublicPaymentDetails).not.toHaveBeenCalled();
    expect(safePublishAll).not.toHaveBeenCalled();
  });

  it("still submits payment details for accepted quotes when the payment link is available", async () => {
    vi.mocked(quoteService.getByShareToken).mockResolvedValue({
      id: "q1",
      quoteStatus: "ACCEPTED",
      convertedToInvoice: null,
    } as never);
    vi.mocked(quoteService.submitPublicPaymentDetails).mockResolvedValue({
      id: "q1",
      quoteNumber: "Q-1",
      recipientEmail: "jane@example.com",
      paymentMethod: null,
      convertedToInvoice: null,
      updatedConvertedInvoice: true,
    } as never);

    const response = await POST(
      new NextRequest("http://localhost/api/quotes/public/token/payment", {
        method: "POST",
        body: JSON.stringify({
          paymentMethod: "CHECK",
        }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ token: "token" }) },
    );

    expect(response.status).toBe(200);
    expect(quoteService.submitPublicPaymentDetails).toHaveBeenCalledWith("token", {
      paymentMethod: "CHECK",
      accountNumber: undefined,
    });
    expect(safePublishAll).toHaveBeenCalledWith({ type: "quote-changed" });
    expect(safePublishAll).toHaveBeenCalledWith({ type: "invoice-changed" });
  });
});
