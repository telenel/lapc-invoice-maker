import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildTools } from "@/domains/chat/tools";
import { invoiceService } from "@/domains/invoice/service";
import { quoteService } from "@/domains/quote/service";
import type { InvoiceResponse } from "@/domains/invoice/types";
import type { QuoteResponse } from "@/domains/quote/types";

function makeInvoice(overrides: Partial<InvoiceResponse> = {}): InvoiceResponse {
  return {
    id: "inv-1",
    invoiceNumber: "AG-100",
    date: "2026-04-13",
    status: "FINAL",
    type: "INVOICE",
    department: "Operations",
    category: "SUPPLIES",
    accountCode: "",
    accountNumber: "",
    approvalChain: [],
    notes: "",
    totalAmount: 100,
    isRecurring: false,
    recurringInterval: null,
    recurringEmail: null,
    isRunning: false,
    runningTitle: null,
    pdfPath: null,
    pdfMetadata: null,
    prismcorePath: null,
    marginEnabled: false,
    marginPercent: null,
    taxEnabled: false,
    taxRate: 0,
    isCateringEvent: false,
    cateringDetails: null,
    createdAt: "2026-04-13T00:00:00.000Z",
    archivedAt: null,
    archivedBy: null,
    staff: null,
    contact: null,
    creatorId: "user-1",
    creatorName: "Owner User",
    items: [],
    ...overrides,
  };
}

function makeQuote(overrides: Partial<QuoteResponse> = {}): QuoteResponse {
  return {
    id: "quote-1",
    quoteNumber: "Q-100",
    quoteStatus: "ACCEPTED",
    date: "2026-04-13",
    expirationDate: "2026-05-13",
    type: "QUOTE",
    department: "Operations",
    category: "SUPPLIES",
    accountCode: "",
    accountNumber: "",
    approvalChain: [],
    notes: "",
    totalAmount: 100,
    recipientName: "Recipient",
    recipientEmail: "",
    recipientOrg: "",
    pdfPath: null,
    shareToken: null,
    createdAt: "2026-04-13T00:00:00.000Z",
    archivedAt: null,
    archivedBy: null,
    staff: null,
    contact: null,
    creatorId: "user-1",
    creatorName: "Owner User",
    items: [],
    isCateringEvent: false,
    cateringDetails: null,
    marginEnabled: false,
    marginPercent: null,
    taxEnabled: false,
    taxRate: 0,
    paymentMethod: null,
    paymentAccountNumber: null,
    paymentDetailsResolved: false,
    convertedToInvoice: null,
    revisedFromQuote: null,
    revisedToQuote: null,
    ...overrides,
  };
}

describe("chat delete tools", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("archives finalized invoices for the owner instead of blocking deletion", async () => {
    const getByIdSpy = vi.spyOn(invoiceService, "getById").mockResolvedValue(makeInvoice());
    const archiveSpy = vi.spyOn(invoiceService, "archive").mockResolvedValue();

    const tools = buildTools({ id: "user-1", name: "Owner User", role: "user" });
    const result = await tools.deleteInvoice.execute!(
      {
        id: "inv-1",
        confirmed: true,
      },
      {} as never
    );

    expect(getByIdSpy).toHaveBeenCalledWith("inv-1", { includeArchived: true });
    expect(archiveSpy).toHaveBeenCalledWith("inv-1", "user-1");
    expect(result).toEqual({
      message: "Invoice moved to the Deleted Archive. [View Invoice](/invoices/inv-1)",
    });
  });

  it("allows admins to archive another user's accepted quote", async () => {
    const getByIdSpy = vi
      .spyOn(quoteService, "getById")
      .mockResolvedValue(makeQuote({ creatorId: "user-2", creatorName: "Quote Owner" }));
    const archiveSpy = vi.spyOn(quoteService, "archive").mockResolvedValue();

    const tools = buildTools({ id: "admin-1", name: "Admin User", role: "admin" });
    const result = await tools.deleteQuote.execute!(
      {
        id: "quote-1",
        confirmed: true,
      },
      {} as never
    );

    expect(getByIdSpy).toHaveBeenCalledWith("quote-1", { includeArchived: true });
    expect(archiveSpy).toHaveBeenCalledWith("quote-1", "admin-1");
    expect(result).toEqual({
      message: "Quote moved to the Deleted Archive. [View Quote](/quotes/quote-1)",
    });
  });

  it("returns an archive status message instead of archiving an already archived invoice", async () => {
    vi.spyOn(invoiceService, "getById").mockResolvedValue(
      makeInvoice({ archivedAt: "2026-04-13T10:00:00.000Z" })
    );
    const archiveSpy = vi.spyOn(invoiceService, "archive").mockResolvedValue();

    const tools = buildTools({ id: "user-1", name: "Owner User", role: "user" });
    const result = await tools.deleteInvoice.execute!(
      {
        id: "inv-1",
        confirmed: true,
      },
      {} as never
    );

    expect(archiveSpy).not.toHaveBeenCalled();
    expect(result).toEqual({
      message: "Invoice is already in the Deleted Archive. [View Invoice](/invoices/inv-1)",
    });
  });
});
