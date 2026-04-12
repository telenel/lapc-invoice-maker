import { describe, expect, it, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

import * as quoteService from "@/domains/quote/service";
import { GET } from "@/app/api/quotes/public/[token]/route";

describe("GET /api/quotes/public/[token] payment-link contract", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("returns paymentLinkAvailable=false for SENT quotes without converted invoices", async () => {
    vi.spyOn(quoteService.quoteService, "getByShareToken").mockResolvedValue({
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
      convertedToInvoice: null,
      revisedFromQuote: null,
      revisedToQuote: null,
    } as never);

    const response = await GET(
      new NextRequest("http://localhost/api/quotes/public/token"),
      { params: Promise.resolve({ token: "token" }) },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.paymentLinkAvailable).toBe(false);
    expect(body.responseLinkAvailable).toBe(true);
  });

  it("returns paymentLinkAvailable=true for accepted, unconverted quotes", async () => {
    vi.spyOn(quoteService.quoteService, "getByShareToken").mockResolvedValue({
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
      paymentDetailsResolved: false,
      marginEnabled: false,
      marginPercent: null,
      taxEnabled: false,
      taxRate: 0,
      paymentMethod: null,
      paymentAccountNumber: null,
      convertedToInvoice: null,
      revisedFromQuote: null,
      revisedToQuote: null,
    } as never);

    const response = await GET(
      new NextRequest("http://localhost/api/quotes/public/token"),
      { params: Promise.resolve({ token: "token" }) },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.paymentLinkAvailable).toBe(true);
    expect(body.responseLinkAvailable).toBe(false);
  });

  it("returns paymentLinkAvailable=false for accepted quotes with converted invoices", async () => {
    vi.spyOn(quoteService.quoteService, "getByShareToken").mockResolvedValue({
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
      paymentDetailsResolved: false,
      marginEnabled: false,
      marginPercent: null,
      taxEnabled: false,
      taxRate: 0,
      paymentMethod: null,
      paymentAccountNumber: null,
      convertedToInvoice: { id: "inv-1", invoiceNumber: "INV-1", status: "FINAL", createdBy: "u2" },
      revisedFromQuote: null,
      revisedToQuote: null,
    } as never);

    const response = await GET(
      new NextRequest("http://localhost/api/quotes/public/token"),
      { params: Promise.resolve({ token: "token" }) },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.paymentLinkAvailable).toBe(false);
    expect(body.responseLinkAvailable).toBe(false);
  });

  it("returns paymentLinkAvailable=false for accepted quotes with existing payment details", async () => {
    vi.spyOn(quoteService.quoteService, "getByShareToken").mockResolvedValue({
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
      paymentDetailsResolved: true,
      marginEnabled: false,
      marginPercent: null,
      taxEnabled: false,
      taxRate: 0,
      paymentMethod: "CHECK",
      paymentAccountNumber: null,
      convertedToInvoice: null,
      revisedFromQuote: null,
      revisedToQuote: null,
    } as never);

    const response = await GET(
      new NextRequest("http://localhost/api/quotes/public/token"),
      { params: Promise.resolve({ token: "token" }) },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.paymentLinkAvailable).toBe(false);
    expect(body.responseLinkAvailable).toBe(false);
  });

  it("returns paymentLinkAvailable=false for accepted quotes with non-final converted invoices", async () => {
    vi.spyOn(quoteService.quoteService, "getByShareToken").mockResolvedValue({
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
      paymentDetailsResolved: false,
      marginEnabled: false,
      marginPercent: null,
      taxEnabled: false,
      taxRate: 0,
      paymentMethod: null,
      paymentAccountNumber: null,
      convertedToInvoice: { id: "inv-1", invoiceNumber: "INV-1", status: "DRAFT", createdBy: "u2" },
      revisedFromQuote: null,
      revisedToQuote: null,
    } as never);

    const response = await GET(
      new NextRequest("http://localhost/api/quotes/public/token"),
      { params: Promise.resolve({ token: "token" }) },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.paymentLinkAvailable).toBe(false);
    expect(body.responseLinkAvailable).toBe(false);
  });
});
