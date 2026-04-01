import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/domains/quote/service", () => ({
  quoteService: {
    updateViewDurationForToken: vi.fn(),
  },
}));

import { quoteService } from "@/domains/quote/service";
import { PATCH, POST } from "@/app/api/quotes/public/[token]/view/[viewId]/route";

describe("public view duration route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("persists duration updates from POST beacons", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/quotes/public/token/view/view-1", {
        method: "POST",
        body: JSON.stringify({ durationSeconds: 37.8 }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ token: "token", viewId: "view-1" }) },
    );

    expect(response.status).toBe(200);
    expect(quoteService.updateViewDurationForToken).toHaveBeenCalledWith("token", "view-1", 38);
  });

  it("continues to accept PATCH requests for compatibility", async () => {
    const response = await PATCH(
      new NextRequest("http://localhost/api/quotes/public/token/view/view-1", {
        method: "PATCH",
        body: JSON.stringify({ durationSeconds: 21 }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ token: "token", viewId: "view-1" }) },
    );

    expect(response.status).toBe(200);
    expect(quoteService.updateViewDurationForToken).toHaveBeenCalledWith("token", "view-1", 21);
  });

  it("returns 404 when the view does not belong to the quote token", async () => {
    vi.mocked(quoteService.updateViewDurationForToken).mockRejectedValueOnce(
      Object.assign(new Error("Quote activity session not found"), { code: "INVALID_INPUT" }),
    );

    const response = await POST(
      new NextRequest("http://localhost/api/quotes/public/token/view/view-1", {
        method: "POST",
        body: JSON.stringify({ durationSeconds: 12 }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ token: "token", viewId: "view-1" }) },
    );

    expect(response.status).toBe(404);
    expect(quoteService.updateViewDurationForToken).toHaveBeenCalledWith("token", "view-1", 12);
  });
});
