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

  it("returns a 400 for malformed manual approval JSON", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/quotes/q1/approve", {
        method: "POST",
        body: "{invalid json",
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ id: "q1" }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid request body",
    });
    expect(quoteService.getById).not.toHaveBeenCalled();
    expect(quoteService.approveManually).not.toHaveBeenCalled();
  });

  it("returns a 400 when the manual approval body is not an object", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/quotes/q1/approve", {
        method: "POST",
        body: "null",
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ id: "q1" }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid request body",
    });
    expect(quoteService.getById).not.toHaveBeenCalled();
    expect(quoteService.approveManually).not.toHaveBeenCalled();
  });

  it("returns a 400 for invalid manual approval payment payloads", async () => {
    vi.mocked(quoteService.approveManually).mockRejectedValue(
      Object.assign(new Error("Invalid payment method"), {
        code: "INVALID_INPUT",
      }),
    );

    const response = await POST(
      new NextRequest("http://localhost/api/quotes/q1/approve", {
        method: "POST",
        body: JSON.stringify({
          paymentMethod: "WIRE_TRANSFER",
        }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ id: "q1" }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid payment method",
    });
  });

  it("returns a 409 when manual approval payment details are already resolved", async () => {
    vi.mocked(quoteService.approveManually).mockRejectedValue(
      Object.assign(new Error("Payment details have already been provided"), {
        code: "PAYMENT_ALREADY_RESOLVED",
      }),
    );

    const response = await POST(
      new NextRequest("http://localhost/api/quotes/q1/approve", {
        method: "POST",
        body: JSON.stringify({
          paymentMethod: "CHECK",
        }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ id: "q1" }) },
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "Payment details have already been provided",
    });
  });
});
