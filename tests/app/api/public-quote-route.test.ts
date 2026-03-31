import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/domains/quote/service", () => ({
  quoteService: {
    getByShareToken: vi.fn(),
  },
}));

import { quoteService } from "@/domains/quote/service";
import { GET } from "@/app/api/quotes/public/[token]/route";

describe("GET /api/quotes/public/[token]", () => {
  it("strips payment details from the public payload", async () => {
    vi.mocked(quoteService.getByShareToken).mockResolvedValue({
      id: "q1",
      quoteNumber: "Q-1",
      quoteStatus: "ACCEPTED",
      date: "2026-03-01T00:00:00.000Z",
      expirationDate: null,
      type: "QUOTE",
      department: "IT",
      category: "SUPPLIES",
      accountCode: "AC1",
      accountNumber: "INTERNAL-001",
      approvalChain: [],
      notes: "",
      totalAmount: 10,
      recipientName: "Jane",
      recipientEmail: "jane@example.com",
      recipientOrg: "",
      pdfPath: null,
      shareToken: "token",
      createdAt: "2026-03-01T00:00:00.000Z",
      staff: null,
      contact: {
        id: "c1",
        name: "Vendor",
        email: "vendor@example.com",
        phone: "555-0000",
        org: "ACME",
        department: "Sales",
        title: "Rep",
        notes: "internal only",
        createdAt: "2026-03-01T00:00:00.000Z",
      },
      creatorId: "u1",
      creatorName: "Admin",
      items: [],
      isCateringEvent: false,
      cateringDetails: null,
      paymentDetailsResolved: true,
      marginEnabled: false,
      marginPercent: null,
      taxEnabled: false,
      taxRate: 0,
      paymentMethod: "ACCOUNT_NUMBER",
      paymentAccountNumber: "SAP-12345",
      convertedToInvoice: null,
      revisedFromQuote: null,
      revisedToQuote: null,
    });

    const response = await GET(
      new NextRequest("http://localhost/api/quotes/public/token"),
      { params: Promise.resolve({ token: "token" }) },
    );

    const body = await response.json();
    expect(body.paymentMethod).toBeUndefined();
    expect(body.paymentAccountNumber).toBeUndefined();
    expect(body.paymentLinkAvailable).toBe(true);
    expect(body.paymentDetailsResolved).toBe(true);
    expect(body.accountNumber).toBeUndefined();
    expect(body.pdfPath).toBeUndefined();
    expect(body.shareToken).toBeUndefined();
    expect(body.convertedToInvoice).toBeUndefined();
    expect(body.revisedFromQuote).toBeUndefined();
    expect(body.revisedToQuote).toBeUndefined();
    expect(body.contact?.id).toBeUndefined();
    expect(body.contact?.notes).toBeUndefined();
    expect(body.contact?.createdAt).toBeUndefined();
    expect(body.creatorId).toBeUndefined();
    expect(body.marginEnabled).toBeUndefined();
  });

  it("marks converted quotes as closed for public payment links", async () => {
    vi.mocked(quoteService.getByShareToken).mockResolvedValue({
      id: "q1",
      quoteNumber: "Q-1",
      quoteStatus: "SENT",
      date: "2026-03-01T00:00:00.000Z",
      expirationDate: null,
      type: "QUOTE",
      department: "IT",
      category: "SUPPLIES",
      accountCode: "AC1",
      accountNumber: "INTERNAL-001",
      approvalChain: [],
      notes: "",
      totalAmount: 10,
      recipientName: "Jane",
      recipientEmail: "jane@example.com",
      recipientOrg: "",
      pdfPath: null,
      shareToken: "token",
      createdAt: "2026-03-01T00:00:00.000Z",
      staff: null,
      contact: null,
      creatorId: "u1",
      creatorName: "Admin",
      items: [],
      isCateringEvent: false,
      cateringDetails: null,
      paymentDetailsResolved: false,
      marginEnabled: false,
      marginPercent: null,
      taxEnabled: false,
      taxRate: 0,
      paymentMethod: null,
      paymentAccountNumber: null,
      convertedToInvoice: { id: "inv1", invoiceNumber: "INV-1" },
      revisedFromQuote: null,
      revisedToQuote: null,
    } as never);

    const response = await GET(
      new NextRequest("http://localhost/api/quotes/public/token"),
      { params: Promise.resolve({ token: "token" }) },
    );

    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.paymentLinkAvailable).toBe(false);
  });
});
