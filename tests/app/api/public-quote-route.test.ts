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
      contact: null,
      creatorId: "u1",
      creatorName: "Admin",
      items: [],
      isCateringEvent: false,
      cateringDetails: null,
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
    expect(body.accountNumber).toBeUndefined();
    expect(body.pdfPath).toBeUndefined();
    expect(body.shareToken).toBeUndefined();
    expect(body.convertedToInvoice).toBeUndefined();
    expect(body.revisedFromQuote).toBeUndefined();
    expect(body.revisedToQuote).toBeUndefined();
  });
});
