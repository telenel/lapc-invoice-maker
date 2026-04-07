import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/domains/invoice/service", () => ({
  invoiceService: {
    getById: vi.fn(),
  },
}));

vi.mock("@/domains/pdf/service", () => ({
  pdfService: {
    readPdf: vi.fn(),
  },
}));

import { getServerSession } from "next-auth";
import { invoiceService } from "@/domains/invoice/service";
import { pdfService } from "@/domains/pdf/service";
import { GET } from "@/app/api/invoices/[id]/pdf/route";

describe("GET /api/invoices/[id]/pdf", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "viewer-1", role: "user" },
    } as never);
  });

  it("allows authenticated users to open another user's invoice PDF", async () => {
    vi.mocked(invoiceService.getById).mockResolvedValue({
      id: "inv-1",
      creatorId: "owner-1",
      pdfPath: "/pdfs/inv-1.pdf",
      invoiceNumber: "INV-1",
    } as never);
    vi.mocked(pdfService.readPdf).mockResolvedValue(Buffer.from("pdf") as never);

    const response = await GET(
      new NextRequest("http://localhost/api/invoices/inv-1/pdf"),
      { params: Promise.resolve({ id: "inv-1" }) },
    );

    expect(response.status).toBe(200);
    expect(pdfService.readPdf).toHaveBeenCalledWith("/pdfs/inv-1.pdf");
  });
});
