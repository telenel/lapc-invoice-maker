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

  it("allows authenticated users to load creator-grouped team stats", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/invoices?statsOnly=true&groupBy=creator&status=FINAL"),
    );

    expect(response.status).toBe(200);
    expect(invoiceService.getCreatorStats).toHaveBeenCalledWith("FINAL");
  });
});
