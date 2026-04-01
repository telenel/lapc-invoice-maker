import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/domains/quote/service", () => ({
  quoteService: {
    getByShareToken: vi.fn(),
    submitPublicPaymentDetails: vi.fn(),
  },
}));

vi.mock("@/lib/sse", () => ({
  safePublishAll: vi.fn(),
}));

import { quoteService } from "@/domains/quote/service";
import { safePublishAll } from "@/lib/sse";
import { POST } from "@/app/api/quotes/public/[token]/payment/route";

describe("POST /api/quotes/public/[token]/payment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(quoteService.getByShareToken).mockResolvedValue({
      id: "q1",
      quoteStatus: "ACCEPTED",
      convertedToInvoice: null,
    } as never);
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

  it("still submits payment details for converted accepted quotes that remain unresolved", async () => {
    vi.mocked(quoteService.getByShareToken).mockResolvedValue({
      id: "q1",
      quoteStatus: "ACCEPTED",
      convertedToInvoice: { id: "inv1" },
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

  it("returns 404 when the quote disappears during the locked payment update", async () => {
    vi.mocked(quoteService.submitPublicPaymentDetails).mockRejectedValue(
      Object.assign(new Error("Quote not found"), {
        code: "NOT_FOUND",
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

    expect(response.status).toBe(404);
    expect(safePublishAll).not.toHaveBeenCalled();
  });
});
