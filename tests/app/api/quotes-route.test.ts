import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/domains/quote/service", () => ({
  quoteService: {
    list: vi.fn(),
    create: vi.fn(),
  },
}));

import { getServerSession } from "next-auth";
import { quoteService } from "@/domains/quote/service";
import { GET } from "@/app/api/quotes/route";

describe("GET /api/quotes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "u1", role: "user" },
    } as never);
    vi.mocked(quoteService.list).mockResolvedValue({
      quotes: [],
      total: 0,
      page: 1,
      pageSize: 20,
    } as never);
  });

  it("does not scope non-admin quote lists to the current user", async () => {
    const response = await GET(
      new NextRequest(
        "http://localhost/api/quotes?quoteStatus=SENT&creatorId=other-user&page=2&pageSize=10&sortBy=totalAmount&sortOrder=asc"
      ),
    );

    expect(response.status).toBe(200);
    expect(quoteService.list).toHaveBeenCalledWith({
      search: undefined,
      quoteStatus: "SENT",
      department: undefined,
      category: undefined,
      creatorId: "other-user",
      dateFrom: undefined,
      dateTo: undefined,
      amountMin: undefined,
      amountMax: undefined,
      page: 2,
      pageSize: 10,
      sortBy: "totalAmount",
      sortOrder: "asc",
    });
  });

  it("returns 400 for invalid quote status", async () => {
    const response = await GET(new NextRequest("http://localhost/api/quotes?quoteStatus=INVALID"));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toEqual({ error: "Invalid quoteStatus value" });
  });

  it("returns 400 for invalid pagination values", async () => {
    const response = await GET(new NextRequest("http://localhost/api/quotes?page=abc&pageSize=0"));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toEqual({ error: "Invalid page value" });
  });

  it("returns 400 for invalid numeric amount filter", async () => {
    const response = await GET(new NextRequest("http://localhost/api/quotes?amountMin=abc&amountMax=10"));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toEqual({ error: "Invalid amountMin value" });
  });

  it("returns 400 when amountMin is greater than amountMax", async () => {
    const response = await GET(new NextRequest("http://localhost/api/quotes?amountMin=100&amountMax=10"));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toEqual({ error: "amountMin must be less than or equal to amountMax" });
  });

  it("returns 400 for invalid dateFrom value", async () => {
    const response = await GET(new NextRequest("http://localhost/api/quotes?dateFrom=bad-date"));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toEqual({ error: "Invalid dateFrom value" });
  });

  it("returns 400 for invalid dateTo value", async () => {
    const response = await GET(new NextRequest("http://localhost/api/quotes?dateTo=not-a-date"));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toEqual({ error: "Invalid dateTo value" });
  });

  it("returns 400 when dateFrom is greater than dateTo", async () => {
    const response = await GET(new NextRequest("http://localhost/api/quotes?dateFrom=2026-04-09&dateTo=2026-04-08"));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toEqual({ error: "dateFrom must be less than or equal to dateTo" });
  });
});
