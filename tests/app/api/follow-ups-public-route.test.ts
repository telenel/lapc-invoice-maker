import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/domains/follow-up/service", () => ({
  followUpService: {
    getPublicSummary: vi.fn(),
    submitAccountNumber: vi.fn(),
  },
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(),
}));

import { followUpService } from "@/domains/follow-up/service";
import { checkRateLimit } from "@/lib/rate-limit";
import { GET } from "@/app/api/follow-ups/public/[token]/route";
import { POST } from "@/app/api/follow-ups/public/[token]/submit/route";

describe("GET /api/follow-ups/public/[token]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(followUpService.getPublicSummary).mockResolvedValue(null);
  });

  it("returns 400 for an empty follow-up token", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/follow-ups/public/   "),
      { params: Promise.resolve({ token: "   " }) },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid token" });
    expect(followUpService.getPublicSummary).not.toHaveBeenCalled();
  });

  it("normalizes summary token before lookup", async () => {
    vi.mocked(followUpService.getPublicSummary).mockResolvedValue({
      invoiceNumber: "INV-1",
      quoteNumber: null,
      type: "INVOICE",
      description: "",
      totalAmount: 125,
      creatorName: "Bookstore",
      currentAttempt: 1,
      maxAttempts: 5,
      seriesStatus: "ACTIVE",
    } as never);

    const response = await GET(
      new NextRequest("http://localhost/api/follow-ups/public/token"),
      { params: Promise.resolve({ token: "  token  " }) },
    );

    expect(response.status).toBe(200);
    expect(followUpService.getPublicSummary).toHaveBeenCalledWith("token");
    expect(await response.json()).toEqual(
      expect.objectContaining({
        invoiceNumber: "INV-1",
        type: "INVOICE",
      }),
    );
  });

  it("returns 500 when follow-up lookup fails", async () => {
    vi.mocked(followUpService.getPublicSummary).mockRejectedValueOnce(new Error("boom"));

    const response = await GET(
      new NextRequest("http://localhost/api/follow-ups/public/token"),
      { params: Promise.resolve({ token: "token" }) },
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Internal server error" });
  });
});

describe("POST /api/follow-ups/public/[token]/submit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(checkRateLimit).mockResolvedValue({
      allowed: true,
      retryAfterMs: 0,
    } as never);
  });

  it("returns 400 for invalid/empty account numbers", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/follow-ups/public/token/submit", {
        method: "POST",
        body: JSON.stringify({ accountNumber: "   " }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ token: "token" }) },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "accountNumber is required" });
    expect(followUpService.submitAccountNumber).not.toHaveBeenCalled();
  });

  it("rejects non-object payloads before attempting submission", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/follow-ups/public/token/submit", {
        method: "POST",
        body: JSON.stringify([1, 2, 3]),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ token: "token" }) },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid request body" });
    expect(followUpService.submitAccountNumber).not.toHaveBeenCalled();
  });

  it("normalizes token and account number and passes trimmed values to the service", async () => {
    vi.mocked(followUpService.submitAccountNumber).mockResolvedValue({ success: true });

    const response = await POST(
      new NextRequest("http://localhost/api/follow-ups/public/token/submit", {
        method: "POST",
        body: JSON.stringify({ accountNumber: "  ACCT-1  " }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ token: "  token  " }) },
    );

    expect(response.status).toBe(200);
    expect(followUpService.submitAccountNumber).toHaveBeenCalledWith("token", "ACCT-1");
    expect(await response.json()).toEqual({ success: true });
  });

  it("returns already-resolved when the follow-up link is already complete", async () => {
    vi.mocked(followUpService.submitAccountNumber).mockResolvedValue({
      success: true,
      alreadyResolved: true,
    } as never);

    const response = await POST(
      new NextRequest("http://localhost/api/follow-ups/public/token/submit", {
        method: "POST",
        body: JSON.stringify({ accountNumber: "ACCT-1" }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ token: "token" }) },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ alreadyResolved: true });
  });
});
