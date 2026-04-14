import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/domains/invoice/service", () => ({
  invoiceService: {
    getById: vi.fn(),
    update: vi.fn(),
    archive: vi.fn(),
  },
}));

import { getServerSession } from "next-auth";
import { invoiceService } from "@/domains/invoice/service";
import { DELETE, GET } from "@/app/api/invoices/[id]/route";

describe("GET /api/invoices/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "u1", role: "user" },
    } as never);
    vi.mocked(invoiceService.getById).mockResolvedValue({
      id: "inv1",
      creatorId: "u1",
      archivedAt: "2026-04-13T12:00:00.000Z",
    } as never);
  });

  it("loads archived invoices for the owner", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/invoices/inv1"),
      { params: Promise.resolve({ id: " inv1 " }) },
    );

    expect(response.status).toBe(200);
    expect(invoiceService.getById).toHaveBeenCalledWith("inv1", { includeArchived: true });
  });
});

describe("DELETE /api/invoices/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "u1", role: "user" },
    } as never);
    vi.mocked(invoiceService.getById).mockResolvedValue({
      id: "inv1",
      creatorId: "u1",
      type: "INVOICE",
      archivedAt: null,
    } as never);
    vi.mocked(invoiceService.archive).mockResolvedValue(undefined as never);
  });

  it("archives an invoice instead of hard-deleting it", async () => {
    const response = await DELETE(
      new NextRequest("http://localhost/api/invoices/inv1", {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: " inv1 " }) },
    );

    expect(response.status).toBe(200);
    expect(invoiceService.getById).toHaveBeenCalledWith("inv1", { includeArchived: true });
    expect(invoiceService.archive).toHaveBeenCalledWith("inv1", "u1");
  });
});
