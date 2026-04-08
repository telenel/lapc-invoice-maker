import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/domains/invoice/service", () => ({
  invoiceService: {
    list: vi.fn(),
  },
}));

import { getServerSession } from "next-auth";
import { invoiceService } from "@/domains/invoice/service";
import { GET } from "@/app/api/invoices/export/route";

describe("GET /api/invoices/export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "u1", role: "user" },
    } as never);
    vi.mocked(invoiceService.list).mockResolvedValue({
      invoices: [],
      total: 0,
      page: 1,
      pageSize: 100000,
    } as never);
  });

  it("forwards the full invoice filter contract for authenticated exports", async () => {
    const response = await GET(
      new NextRequest(
        "http://localhost/api/invoices/export?search=laptop&status=FINAL&staffId=staff-1&department=IT&category=SUPPLIES&dateFrom=2026-04-01&dateTo=2026-04-30&createdFrom=2026-04-01&createdTo=2026-04-30&amountMin=10&amountMax=500&creatorId=other-user&isRunning=true&sortBy=totalAmount&sortOrder=asc"
      ),
    );

    expect(response.status).toBe(200);
    expect(invoiceService.list).toHaveBeenCalledWith({
      search: "laptop",
      status: "FINAL",
      staffId: "staff-1",
      department: "IT",
      category: "SUPPLIES",
      dateFrom: "2026-04-01",
      dateTo: "2026-04-30",
      createdFrom: "2026-04-01",
      createdTo: "2026-04-30",
      amountMin: 10,
      amountMax: 500,
      creatorId: "other-user",
      isRunning: true,
      page: 1,
      pageSize: 100000,
      sortBy: "totalAmount",
      sortOrder: "asc",
    });
  });

  it("returns 400 for invalid amount filters", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/invoices/export?amountMin=abc&amountMax=10"),
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toEqual({ error: "Invalid amountMin value" });
  });

  it("returns 400 when amountMin is greater than amountMax", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/invoices/export?amountMin=100&amountMax=10"),
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toEqual({ error: "amountMin must be less than or equal to amountMax" });
  });
});
