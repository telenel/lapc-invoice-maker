import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/domains/follow-up/service", () => ({
  followUpService: {
    initiateMultiple: vi.fn(),
  },
}));

import { getServerSession } from "next-auth";
import { followUpService } from "@/domains/follow-up/service";
import { POST } from "@/app/api/follow-ups/initiate/route";

describe("POST /api/follow-ups/initiate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "u1", role: "user" },
    } as never);
  });

  it("returns 400 when invoiceIds payload is invalid", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/follow-ups/initiate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ invoiceIds: "bad" }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "invoiceIds array is required",
    });
  });

  it("returns 400 when invoiceIds contains non-string values", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/follow-ups/initiate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ invoiceIds: ["inv-1", 42] }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "invoiceIds must contain valid IDs",
    });
    expect(followUpService.initiateMultiple).not.toHaveBeenCalled();
  });

  it("returns 500 when follow-up initiation fails internally", async () => {
    vi.mocked(followUpService.initiateMultiple).mockRejectedValue(new Error("database down"));

    const response = await POST(
      new NextRequest("http://localhost/api/follow-ups/initiate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ invoiceIds: ["inv-1"] }),
      }),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Failed to initiate follow-up requests",
    });
    expect(followUpService.initiateMultiple).toHaveBeenCalledWith(["inv-1"], "u1", false);
  });
});
