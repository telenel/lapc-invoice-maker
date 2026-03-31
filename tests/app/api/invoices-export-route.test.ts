import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

vi.mock("@/domains/invoice/service", () => ({
  invoiceService: {
    list: vi.fn(),
  },
}));

import { getServerSession } from "next-auth";
import { invoiceService } from "@/domains/invoice/service";
import { GET } from "@/app/api/invoices/export/route";

const mockGetServerSession = vi.mocked(getServerSession);
const mockInvoiceService = vi.mocked(invoiceService, true);

describe("GET /api/invoices/export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("forwards creator and running filters for admin exports", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: "admin-1", role: "admin" },
    } as never);
    mockInvoiceService.list.mockResolvedValue({
      invoices: [],
      total: 0,
      page: 1,
      pageSize: 100_000,
    } as never);

    const req = new NextRequest(
      "http://localhost/api/invoices/export?status=DRAFT&creatorId=user-123&isRunning=true",
    );

    await GET(req);

    expect(mockInvoiceService.list).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "DRAFT",
        creatorId: "user-123",
        isRunning: true,
      }),
    );
  });

  it("still scopes non-admin exports to the signed-in user", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: "user-999", role: "user" },
    } as never);
    mockInvoiceService.list.mockResolvedValue({
      invoices: [],
      total: 0,
      page: 1,
      pageSize: 100_000,
    } as never);

    const req = new NextRequest(
      "http://localhost/api/invoices/export?creatorId=user-123&isRunning=true",
    );

    await GET(req);

    expect(mockInvoiceService.list).toHaveBeenCalledWith(
      expect.objectContaining({
        creatorId: "user-999",
        isRunning: true,
      }),
    );
  });
});
