import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/domains/follow-up/service", () => ({
  followUpService: {
    getBadgeStatesForInvoices: vi.fn(),
    getBadgeState: vi.fn(),
  },
}));

import { getServerSession } from "next-auth";
import { followUpService } from "@/domains/follow-up/service";
import { GET } from "@/app/api/follow-ups/badge/route";

describe("GET /api/follow-ups/badge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "u1", role: "user" },
    } as never);
    vi.mocked(followUpService.getBadgeStatesForInvoices).mockResolvedValue({
      inv1: { seriesStatus: "ACTIVE", currentAttempt: 1, maxAttempts: 5 },
    } as never);
    vi.mocked(followUpService.getBadgeState).mockResolvedValue({
      seriesStatus: "ACTIVE",
      currentAttempt: 1,
      maxAttempts: 5,
    } as never);
  });

  it("returns 400 for an empty invoiceIds batch", async () => {
    const response = await GET(new NextRequest("http://localhost/api/follow-ups/badge?invoiceIds=,   ,"));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "invoiceIds cannot be empty",
    });
    expect(followUpService.getBadgeStatesForInvoices).not.toHaveBeenCalled();
  });

  it("returns 400 when invoiceIds is explicitly provided but empty", async () => {
    const response = await GET(new NextRequest("http://localhost/api/follow-ups/badge?invoiceIds="));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "invoiceIds cannot be empty",
    });
    expect(followUpService.getBadgeStatesForInvoices).not.toHaveBeenCalled();
    expect(followUpService.getBadgeState).not.toHaveBeenCalled();
  });

  it("normalizes and deduplicates invoiceIds before querying", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/follow-ups/badge?invoiceIds=inv1,%20inv2,inv1,,  "),
    );

    expect(response.status).toBe(200);
    expect(followUpService.getBadgeStatesForInvoices).toHaveBeenCalledWith(["inv1", "inv2"]);
    await expect(response.json()).resolves.toEqual({
      inv1: { seriesStatus: "ACTIVE", currentAttempt: 1, maxAttempts: 5 },
    });
  });

  it("trims invoiceId for single mode", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/follow-ups/badge?invoiceId=  inv-123  "),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      seriesStatus: "ACTIVE",
      currentAttempt: 1,
      maxAttempts: 5,
    });
    expect(followUpService.getBadgeState).toHaveBeenCalledWith("inv-123");
  });
});
