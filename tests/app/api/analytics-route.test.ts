import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/domains/analytics/service", () => ({
  analyticsService: {
    getAnalytics: vi.fn(),
  },
}));

import { getServerSession } from "next-auth";
import { analyticsService } from "@/domains/analytics/service";
import { GET } from "@/app/api/analytics/route";

describe("GET /api/analytics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "u1", role: "admin" } } as never);
    vi.mocked(analyticsService.getAnalytics).mockResolvedValue({
      summary: {
        count: 0,
        total: 0,
        finalizedCount: 0,
        finalizedTotal: 0,
        expectedCount: 0,
        expectedTotal: 0,
      },
      byCategory: [],
      byMonth: [],
      byDepartment: [],
      trend: [],
      byUser: [],
    } as never);
  });

  it("returns 400 when dateFrom is not a valid date", async () => {
    const response = await GET(new NextRequest("http://localhost/api/analytics?dateFrom=not-a-date"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid dateFrom value" });
  });

  it("returns 400 when dateTo is not a valid date", async () => {
    const response = await GET(new NextRequest("http://localhost/api/analytics?dateTo=bad-date"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid dateTo value" });
  });

  it("returns 400 when dateFrom is greater than dateTo", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/analytics?dateFrom=2026-04-09&dateTo=2026-04-08"),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "dateFrom must be less than or equal to dateTo",
    });
  });

  it("allows authenticated non-admin users to view analytics", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "u1", role: "user" } } as never);

    const response = await GET(new NextRequest("http://localhost/api/analytics"));

    expect(response.status).toBe(200);
    expect(analyticsService.getAnalytics).toHaveBeenCalledWith({ dateFrom: undefined, dateTo: undefined });
  });
});
