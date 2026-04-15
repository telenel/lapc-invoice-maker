import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/domains/invoice/service", () => ({
  invoiceService: {
    getCreatorStats: vi.fn(),
    getStats: vi.fn(),
    list: vi.fn(),
  },
}));

import { getServerSession } from "next-auth";
import { invoiceService } from "@/domains/invoice/service";
import { GET } from "@/app/api/invoices/route";

describe("GET /api/invoices", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "u1", role: "user" },
    } as never);
    vi.mocked(invoiceService.list).mockResolvedValue({
      invoices: [],
      total: 0,
      page: 1,
      pageSize: 20,
    } as never);
    vi.mocked(invoiceService.getStats).mockResolvedValue({
      total: 0,
      sumTotalAmount: 0,
    } as never);
    vi.mocked(invoiceService.getCreatorStats).mockResolvedValue({
      users: [],
    } as never);
  });

  it("does not scope non-admin list results to the current user", async () => {
    const response = await GET(
      new NextRequest(
        "http://localhost/api/invoices?status=FINAL&creatorId=other-user&page=2&pageSize=10&sortBy=totalAmount&sortOrder=asc"
      ),
    );

    expect(response.status).toBe(200);
    expect(invoiceService.list).toHaveBeenCalledWith({
      search: undefined,
      status: "FINAL",
      isRunning: undefined,
      staffId: undefined,
      department: undefined,
      dateFrom: undefined,
      dateTo: undefined,
      createdFrom: undefined,
      createdTo: undefined,
      category: undefined,
      amountMin: undefined,
      amountMax: undefined,
      creatorId: "other-user",
      page: 2,
      pageSize: 10,
      sortBy: "totalAmount",
      sortOrder: "asc",
    });
  });

  it("returns 400 for invalid status", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/invoices?status=BROKEN"),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toEqual({ error: "Invalid status value" });
  });

  it("returns 400 for invalid pagination values", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/invoices?page=abc&pageSize=-3"),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toEqual({ error: "Invalid page value" });
  });

  it("returns 400 for invalid numeric filter values", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/invoices?amountMin=abc&amountMax=10"),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toEqual({ error: "Invalid amountMin value" });
  });

  it("returns 400 when amountMin is greater than amountMax", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/invoices?amountMin=100&amountMax=10"),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toEqual({ error: "amountMin must be less than or equal to amountMax" });
  });

  it("returns 400 for invalid dateFrom value", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/invoices?dateFrom=not-a-date"),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toEqual({ error: "Invalid dateFrom value" });
  });

  it("returns 400 for invalid dateTo value", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/invoices?dateTo=bad-date"),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toEqual({ error: "Invalid dateTo value" });
  });

  it("returns 400 when dateFrom is greater than dateTo", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/invoices?dateFrom=2026-04-09&dateTo=2026-04-08"),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toEqual({ error: "dateFrom must be less than or equal to dateTo" });
  });

  it("returns 400 when createdFrom is greater than createdTo", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/invoices?createdFrom=2026-04-09&createdTo=2026-04-08"),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toEqual({ error: "createdFrom must be less than or equal to createdTo" });
  });

  it("returns 400 for invalid creator stats status", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/invoices?statsOnly=true&groupBy=creator&status=bad"),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toEqual({ error: "Invalid status value" });
  });

  it("allows authenticated users to load creator-grouped team stats", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/invoices?statsOnly=true&groupBy=creator&status=ALL"),
    );

    expect(response.status).toBe(200);
    expect(invoiceService.getCreatorStats).toHaveBeenCalledWith("ALL");
  });
});
