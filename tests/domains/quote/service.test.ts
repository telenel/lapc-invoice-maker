// tests/domains/quote/service.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/domains/quote/repository", () => ({
  findMany: vi.fn(),
  findById: vi.fn(),
  findAcceptedPublicPaymentCandidate: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  deleteById: vi.fn(),
  markSent: vi.fn(),
  markSentWithToken: vi.fn(),
  getShareToken: vi.fn(),
  createView: vi.fn(),
  updateViewDuration: vi.fn(),
  updateViewResponse: vi.fn(),
  findViewsByInvoiceId: vi.fn(),
  findFollowUpsByInvoiceId: vi.fn(),
  hasRecentView: vi.fn(),
  findByShareToken: vi.fn(),
  applyPublicPaymentResolution: vi.fn(),
  applyPublicQuoteResponse: vi.fn(),
  syncPublicPaymentDetails: vi.fn(),
  createFollowUp: vi.fn(),
  generateNumber: vi.fn(),
  expireOverdue: vi.fn(),
}));

vi.mock("@/domains/pdf/service", () => ({
  pdfService: {
    generateQuote: vi.fn(),
    readPdf: vi.fn(),
    deletePdfFiles: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
    invoice: {
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/domains/notification/service", () => ({
  notificationService: {
    createAndPublish: vi.fn(),
  },
}));

import * as quoteRepository from "@/domains/quote/repository";
import { pdfService } from "@/domains/pdf/service";
import { quoteService } from "@/domains/quote/service";

const mockRepo = vi.mocked(quoteRepository, true);
const mockPdfService = vi.mocked(pdfService, true);

// ── Fixture helpers ───────────────────────────────────────────────────────

function makeQuote(overrides: Record<string, unknown> = {}) {
  return {
    id: "q1",
    quoteNumber: "Q-2026-0001",
    quoteStatus: "DRAFT",
    type: "QUOTE",
    date: new Date("2026-01-15"),
    expirationDate: new Date("2026-02-15"),
    department: "IT",
    category: "SUPPLIES",
    accountCode: "AC1",
    accountNumber: "12345",
    paymentMethod: null,
    paymentAccountNumber: null,
    approvalChain: ["Bob"],
    notes: "Test notes",
    totalAmount: "150.00",
    recipientName: "Jane Doe",
    recipientEmail: "jane@test.com",
    recipientOrg: "ACME Corp",
    pdfPath: null,
    createdAt: new Date("2026-01-01"),
    staffId: "s1",
    staff: { id: "s1", name: "Alice", title: "Manager", department: "IT" },
    contact: null,
    creator: { id: "u1", name: "Admin", username: "admin" },
    items: [
      {
        id: "i1",
        description: "Widget",
        quantity: "3",
        unitPrice: "25.00",
        extendedPrice: "75.00",
        sortOrder: 0,
      },
      {
        id: "i2",
        description: "Gadget",
        quantity: "3",
        unitPrice: "25.00",
        extendedPrice: "75.00",
        sortOrder: 1,
      },
    ],
    convertedToInvoice: null,
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe("quoteService", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  // ── list ────────────────────────────────────────────────────────────────

  describe("list", () => {
    it("returns paginated QuoteResponse array with DTO mapping", async () => {
      const quote = makeQuote();
      mockRepo.findMany.mockResolvedValue({
        quotes: [quote],
        total: 1,
        page: 1,
        pageSize: 20,
      } as never);

      const result = await quoteService.list({ page: 1, pageSize: 20 });

      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
      expect(result.quotes).toHaveLength(1);

      const q = result.quotes[0];
      expect(q.id).toBe("q1");
      expect(q.quoteNumber).toBe("Q-2026-0001");
      expect(q.date).toBe("2026-01-15T00:00:00.000Z");
      expect(q.expirationDate).toBe("2026-02-15T00:00:00.000Z");
      expect(q.totalAmount).toBe(150);
      expect(q.staff).toEqual({ id: "s1", name: "Alice", title: "Manager", department: "IT" });
      expect(q.items).toHaveLength(2);
      expect(q.items[0].quantity).toBe(3);
      expect(q.items[0].unitPrice).toBe(25);
      expect(q.items[0].extendedPrice).toBe(75);
    });

    it("maps null expirationDate to null", async () => {
      const quote = makeQuote({ expirationDate: null });
      mockRepo.findMany.mockResolvedValue({
        quotes: [quote],
        total: 1,
        page: 1,
        pageSize: 20,
      } as never);

      const result = await quoteService.list({});

      expect(result.quotes[0].expirationDate).toBeNull();
    });
  });

  // ── getById ─────────────────────────────────────────────────────────────

  describe("getById", () => {
    it("returns null when quote not found", async () => {
      mockRepo.findById.mockResolvedValue(null);

      const result = await quoteService.getById("missing");

      expect(result).toBeNull();
    });

    it("returns null when record is not type QUOTE", async () => {
      mockRepo.findById.mockResolvedValue(makeQuote({ type: "INVOICE" }) as never);

      const result = await quoteService.getById("q1");

      expect(result).toBeNull();
    });

    it("returns mapped QuoteResponse for existing quote", async () => {
      const quote = makeQuote();
      mockRepo.findById.mockResolvedValue(quote as never);

      const result = await quoteService.getById("q1");

      expect(result).not.toBeNull();
      expect(result!.id).toBe("q1");
      expect(result!.createdAt).toBe("2026-01-01T00:00:00.000Z");
      expect(result!.creatorName).toBe("Admin");
    });

    it("auto-expires a DRAFT quote past its expiration date", async () => {
      const pastDate = new Date("2020-01-01");
      const quote = makeQuote({ expirationDate: pastDate, quoteStatus: "DRAFT" });
      mockRepo.findById.mockResolvedValue(quote as never);
      mockRepo.update.mockResolvedValue(quote as never);

      const result = await quoteService.getById("q1");

      expect(mockRepo.update).toHaveBeenCalledWith("q1", { quoteStatus: "EXPIRED" });
      expect(result!.quoteStatus).toBe("EXPIRED");
    });

    it("auto-expires a SENT quote past its expiration date", async () => {
      const pastDate = new Date("2020-01-01");
      const quote = makeQuote({ expirationDate: pastDate, quoteStatus: "SENT" });
      mockRepo.findById.mockResolvedValue(quote as never);
      mockRepo.update.mockResolvedValue(quote as never);

      await quoteService.getById("q1");

      expect(mockRepo.update).toHaveBeenCalledWith("q1", { quoteStatus: "EXPIRED" });
    });

    it("does not expire an ACCEPTED quote even if past date", async () => {
      const pastDate = new Date("2020-01-01");
      const quote = makeQuote({ expirationDate: pastDate, quoteStatus: "ACCEPTED" });
      mockRepo.findById.mockResolvedValue(quote as never);

      await quoteService.getById("q1");

      expect(mockRepo.update).not.toHaveBeenCalled();
    });
  });

  describe("submitPublicPaymentDetails", () => {
    it("syncs quote and converted invoice payment details", async () => {
      mockRepo.findAcceptedPublicPaymentCandidate.mockResolvedValue({
        id: "q1",
        quoteNumber: "Q-1",
        recipientEmail: "jane@example.com",
        createdBy: "u1",
        paymentMethod: null,
        convertedToInvoice: { id: "inv1" },
      } as never);
      mockRepo.applyPublicPaymentResolution.mockResolvedValue(undefined as never);

      const result = await quoteService.submitPublicPaymentDetails("token", {
        paymentMethod: "ACCOUNT_NUMBER",
        accountNumber: "SAP-12345",
      });

      expect(result?.id).toBe("q1");
      expect(mockRepo.applyPublicPaymentResolution).toHaveBeenCalledWith(
        "q1",
        {
          paymentMethod: "ACCOUNT_NUMBER",
          paymentAccountNumber: "SAP-12345",
        },
        {
          recipientEmail: "jane@example.com",
          subject: "Payment details provided for Q-1",
          metadata: {
            paymentMethod: "ACCOUNT_NUMBER",
            paymentAccountNumber: "SAP-12345",
          },
        },
        "inv1",
      );
    });

    it("rejects overwriting already-resolved public payment details", async () => {
      mockRepo.findAcceptedPublicPaymentCandidate.mockResolvedValue({
        id: "q1",
        quoteNumber: "Q-1",
        recipientEmail: "jane@example.com",
        createdBy: "u1",
        paymentMethod: "CHECK",
        convertedToInvoice: { id: "inv1" },
      } as never);

      await expect(
        quoteService.submitPublicPaymentDetails("token", {
          paymentMethod: "ACCOUNT_NUMBER",
          accountNumber: "SAP-12345",
        }),
      ).rejects.toMatchObject({
        code: "PAYMENT_ALREADY_RESOLVED",
      });

      expect(mockRepo.applyPublicPaymentResolution).not.toHaveBeenCalled();
    });

    it("blocks public payment updates when the converted invoice is finalized", async () => {
      mockRepo.findAcceptedPublicPaymentCandidate.mockResolvedValue({
        id: "q1",
        quoteNumber: "Q-1",
        recipientEmail: "jane@example.com",
        createdBy: "u1",
        paymentMethod: null,
        convertedToInvoice: { id: "inv1" },
      } as never);
      mockRepo.applyPublicPaymentResolution.mockRejectedValue(
        Object.assign(new Error("Cannot update a finalized invoice"), {
          code: "FORBIDDEN",
        }),
      );

      await expect(
        quoteService.submitPublicPaymentDetails("token", {
          paymentMethod: "CHECK",
        }),
      ).rejects.toMatchObject({
        code: "FORBIDDEN",
      });

      expect(mockRepo.createFollowUp).not.toHaveBeenCalled();
    });
  });

  describe("respondToQuote", () => {
    it("applies approval-time payment details atomically for a pre-converted invoice", async () => {
      mockRepo.findByShareToken.mockResolvedValue(
        makeQuote({
          quoteStatus: "SENT",
          expirationDate: new Date("2099-02-15"),
          convertedToInvoice: { id: "inv1", invoiceNumber: "INV-2026-0001" },
        }) as never,
      );
      mockRepo.applyPublicQuoteResponse.mockResolvedValue(undefined as never);

      await quoteService.respondToQuote(
        "token",
        "ACCEPTED",
        "view-1",
        { paymentMethod: "ACCOUNT_NUMBER", accountNumber: "SAP-12345" },
      );

      expect(mockRepo.applyPublicQuoteResponse).toHaveBeenCalledWith(
        "q1",
        {
          response: "ACCEPTED",
          acceptedAt: expect.any(Date),
          convertedInvoiceId: "inv1",
          viewId: "view-1",
          paymentDetails: {
            paymentMethod: "ACCOUNT_NUMBER",
            paymentAccountNumber: "SAP-12345",
          },
          cateringDetails: undefined,
        },
      );
      expect(mockRepo.update).not.toHaveBeenCalled();
      expect(mockRepo.updateViewResponse).not.toHaveBeenCalled();
    });

    it("syncs catering details to the converted invoice inside the public approval transaction", async () => {
      mockRepo.findByShareToken.mockResolvedValue(
        makeQuote({
          quoteStatus: "SENT",
          expirationDate: new Date("2099-02-15"),
          isCateringEvent: true,
          convertedToInvoice: { id: "inv1", invoiceNumber: "INV-2026-0001" },
        }) as never,
      );
      mockRepo.applyPublicQuoteResponse.mockResolvedValue(undefined as never);

      await quoteService.respondToQuote(
        "token",
        "ACCEPTED",
        undefined,
        { paymentMethod: "CHECK" },
        {
          eventDate: "2026-03-31",
          startTime: "10:00",
          endTime: "11:00",
          location: "Campus",
          contactName: "Jane",
          contactPhone: "555-1111",
          setupRequired: false,
          takedownRequired: false,
        },
      );

      expect(mockRepo.applyPublicQuoteResponse).toHaveBeenCalledWith(
        "q1",
        expect.objectContaining({
          response: "ACCEPTED",
          convertedInvoiceId: "inv1",
          cateringDetails: expect.objectContaining({
            location: "Campus",
            contactName: "Jane",
          }),
        }),
      );
    });

    it("rejects catering details for non-catering quotes", async () => {
      mockRepo.findByShareToken.mockResolvedValue(
        makeQuote({
          quoteStatus: "SENT",
          expirationDate: new Date("2099-02-15"),
          isCateringEvent: false,
        }) as never,
      );

      await expect(
        quoteService.respondToQuote(
          "token",
          "ACCEPTED",
          undefined,
          { paymentMethod: "CHECK" },
          {
            eventDate: "2026-03-31",
            startTime: "10:00",
            endTime: "11:00",
            location: "Campus",
            contactName: "Jane",
            contactPhone: "555-1111",
            setupRequired: false,
            takedownRequired: false,
          },
        ),
      ).rejects.toMatchObject({
        code: "INVALID_INPUT",
      });

      expect(mockRepo.applyPublicQuoteResponse).not.toHaveBeenCalled();
    });
  });

  // ── create ──────────────────────────────────────────────────────────────

  describe("create", () => {
    it("calls generateNumber and creates with calculated line items", async () => {
      mockRepo.generateNumber.mockResolvedValue("Q-2026-0001" as never);
      mockRepo.create.mockResolvedValue(makeQuote() as never);

      const input = {
        date: "2026-01-15",
        expirationDate: "2026-02-15",
        staffId: "s1",
        department: "IT",
        category: "SUPPLIES",
        accountCode: "AC1",
        recipientName: "Jane Doe",
        items: [
          { description: "Widget", quantity: 3, unitPrice: 25, sortOrder: 0 },
          { description: "Gadget", quantity: 3, unitPrice: 25, sortOrder: 1 },
        ],
      };

      const result = await quoteService.create(input, "u1");

      expect(mockRepo.generateNumber).toHaveBeenCalledOnce();
      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ staffId: "s1", department: "IT" }),
        [
          expect.objectContaining({ description: "Widget", extendedPrice: 75 }),
          expect.objectContaining({ description: "Gadget", extendedPrice: 75 }),
        ],
        150,
        "u1",
        "Q-2026-0001"
      );
      expect(result.id).toBe("q1");
    });

    it("calculates extendedPrice as quantity * unitPrice", async () => {
      mockRepo.generateNumber.mockResolvedValue("Q-2026-0001" as never);
      mockRepo.create.mockResolvedValue(makeQuote() as never);

      await quoteService.create(
        {
          date: "2026-01-15",
          expirationDate: "2026-02-15",
          staffId: "s1",
          department: "IT",
          category: "SUPPLIES",
          recipientName: "Jane",
          items: [{ description: "Item", quantity: 4, unitPrice: 10 }],
        },
        "u1"
      );

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.any(Object),
        [expect.objectContaining({ extendedPrice: 40 })],
        40,
        "u1",
        "Q-2026-0001"
      );
    });
  });

  // ── update ──────────────────────────────────────────────────────────────

  describe("update", () => {
    it("throws NOT_FOUND when quote does not exist", async () => {
      mockRepo.findById.mockResolvedValue(null);

      await expect(quoteService.update("missing", { notes: "x" })).rejects.toMatchObject({
        message: "Quote not found",
        code: "NOT_FOUND",
      });
    });

    it("throws NOT_FOUND when record is not type QUOTE", async () => {
      mockRepo.findById.mockResolvedValue(makeQuote({ type: "INVOICE" }) as never);

      await expect(quoteService.update("q1", {})).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("throws FORBIDDEN for DECLINED quotes", async () => {
      mockRepo.findById.mockResolvedValue(makeQuote({ quoteStatus: "DECLINED" }) as never);

      await expect(quoteService.update("q1", {})).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("throws FORBIDDEN for EXPIRED quotes", async () => {
      mockRepo.findById.mockResolvedValue(makeQuote({ quoteStatus: "EXPIRED" }) as never);

      await expect(quoteService.update("q1", {})).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("updates without items for a DRAFT quote", async () => {
      const quote = makeQuote();
      mockRepo.findById.mockResolvedValue(quote as never);
      mockRepo.update.mockResolvedValue({ ...quote, notes: "Updated" } as never);

      const result = await quoteService.update("q1", { notes: "Updated" });

      expect(mockRepo.update).toHaveBeenCalledWith("q1", { notes: "Updated" });
      expect(result.notes).toBe("Updated");
    });

    it("recalculates totals when items are provided", async () => {
      const quote = makeQuote();
      mockRepo.findById.mockResolvedValue(quote as never);
      mockRepo.update.mockResolvedValue(quote as never);

      await quoteService.update("q1", {
        items: [{ description: "New Item", quantity: 2, unitPrice: 50 }],
      });

      expect(mockRepo.update).toHaveBeenCalledWith(
        "q1",
        {},
        [expect.objectContaining({ extendedPrice: 100 })],
        100
      );
    });

    it("also updates SENT quotes (only ACCEPTED/DECLINED/EXPIRED are blocked)", async () => {
      const quote = makeQuote({ quoteStatus: "SENT" });
      mockRepo.findById.mockResolvedValue(quote as never);
      mockRepo.update.mockResolvedValue({ ...quote, notes: "x" } as never);

      await expect(quoteService.update("q1", { notes: "x" })).resolves.toBeDefined();
    });

    it("allows ACCEPTED quotes to update when they have not been converted", async () => {
      const quote = makeQuote({ quoteStatus: "ACCEPTED", convertedToInvoice: null });
      mockRepo.findById.mockResolvedValue(quote as never);
      mockRepo.update.mockResolvedValue({ ...quote, notes: "Updated after approval" } as never);

      await expect(quoteService.update("q1", { notes: "Updated after approval" })).resolves.toBeDefined();
    });

    it("throws FORBIDDEN when an accepted quote has already been converted", async () => {
      mockRepo.findById.mockResolvedValue(
        makeQuote({
          quoteStatus: "ACCEPTED",
          convertedToInvoice: { id: "inv1", invoiceNumber: "INV-2026-0001" },
        }) as never,
      );

      await expect(quoteService.update("q1", { notes: "x" })).rejects.toMatchObject({
        code: "FORBIDDEN",
        message: "Cannot update a quote that has already been converted to an invoice",
      });
    });
  });

  // ── delete ──────────────────────────────────────────────────────────────

  describe("delete", () => {
    it("throws NOT_FOUND when quote does not exist", async () => {
      mockRepo.findById.mockResolvedValue(null);

      await expect(quoteService.delete("missing")).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("calls repository deleteById", async () => {
      mockRepo.findById.mockResolvedValue(makeQuote() as never);
      mockRepo.deleteById.mockResolvedValue(undefined as never);

      await quoteService.delete("q1");

      expect(mockRepo.deleteById).toHaveBeenCalledWith("q1");
    });

    it("cleans up PDF before deleting when pdfPath is set", async () => {
      mockRepo.findById.mockResolvedValue(makeQuote({ pdfPath: "/path/to/quote.pdf" }) as never);
      mockRepo.deleteById.mockResolvedValue(undefined as never);
      mockPdfService.deletePdfFiles.mockResolvedValue(undefined as never);

      await quoteService.delete("q1");

      expect(mockPdfService.deletePdfFiles).toHaveBeenCalledWith("/path/to/quote.pdf", null);
      expect(mockRepo.deleteById).toHaveBeenCalledWith("q1");
    });

    it("skips PDF cleanup when pdfPath is null", async () => {
      mockRepo.findById.mockResolvedValue(makeQuote({ pdfPath: null }) as never);
      mockRepo.deleteById.mockResolvedValue(undefined as never);

      await quoteService.delete("q1");

      expect(mockPdfService.deletePdfFiles).not.toHaveBeenCalled();
    });
  });

  // ── markSent ─────────────────────────────────────────────────────────────

  describe("markSent", () => {
    it("throws NOT_FOUND when quote does not exist", async () => {
      mockRepo.findById.mockResolvedValue(null);

      await expect(quoteService.markSent("missing")).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("throws FORBIDDEN when quote is not DRAFT", async () => {
      mockRepo.findById.mockResolvedValue(makeQuote({ quoteStatus: "SENT" }) as never);

      await expect(quoteService.markSent("q1")).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("calls repository markSentWithToken for a DRAFT quote", async () => {
      mockRepo.findById.mockResolvedValue(makeQuote({ quoteStatus: "DRAFT" }) as never);
      mockRepo.markSentWithToken.mockResolvedValue(undefined as never);

      const result = await quoteService.markSent("q1");

      expect(mockRepo.markSentWithToken).toHaveBeenCalledWith("q1", expect.any(String));
      expect(result).toHaveProperty("shareToken");
    });
  });

  // ── convertToInvoice ─────────────────────────────────────────────────────

  describe("convertToInvoice", () => {
    it("throws NOT_FOUND when quote does not exist", async () => {
      mockRepo.findById.mockResolvedValue(null);

      await expect(quoteService.convertToInvoice("missing", "u1")).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
    });

    it("throws FORBIDDEN for DECLINED quotes", async () => {
      mockRepo.findById.mockResolvedValue(makeQuote({ quoteStatus: "DECLINED" }) as never);

      await expect(quoteService.convertToInvoice("q1", "u1")).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
    });

    it("throws FORBIDDEN for EXPIRED quotes", async () => {
      mockRepo.findById.mockResolvedValue(makeQuote({ quoteStatus: "EXPIRED" }) as never);

      await expect(quoteService.convertToInvoice("q1", "u1")).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
    });

    it("creates invoice and marks quote ACCEPTED via transaction", async () => {
      const { prisma } = await import("@/lib/prisma");
      const mockPrisma = vi.mocked(prisma, true);

      const newInvoice = { id: "inv1", invoiceNumber: "INV-2026-0001" };
      mockPrisma.$transaction.mockResolvedValue([newInvoice, {}] as never);
      mockRepo.findById.mockResolvedValue(makeQuote({ quoteStatus: "DRAFT" }) as never);

      const result = await quoteService.convertToInvoice("q1", "u1");

      expect(mockPrisma.$transaction).toHaveBeenCalledOnce();
      expect(mockPrisma.invoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            accountNumber: "12345",
            paymentMethod: null,
            paymentAccountNumber: null,
          }),
        }),
      );
      expect(result).toEqual(newInvoice);
    });

    it("allows ACCEPTED quotes to convert when they have not been converted yet", async () => {
      const { prisma } = await import("@/lib/prisma");
      const mockPrisma = vi.mocked(prisma, true);

      const newInvoice = { id: "inv1", invoiceNumber: "INV-2026-0001" };
      mockPrisma.$transaction.mockResolvedValue([newInvoice, {}] as never);
      mockRepo.findById.mockResolvedValue(
        makeQuote({ quoteStatus: "ACCEPTED", convertedToInvoice: null }) as never,
      );

      await expect(quoteService.convertToInvoice("q1", "u1")).resolves.toEqual(newInvoice);
    });

    it("throws FORBIDDEN when quote has already been converted", async () => {
      mockRepo.findById.mockResolvedValue(
        makeQuote({
          quoteStatus: "ACCEPTED",
          convertedToInvoice: { id: "inv1", invoiceNumber: "INV-2026-0001" },
        }) as never,
      );

      await expect(quoteService.convertToInvoice("q1", "u1")).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
    });

    it("preserves payment details separately from the quote charge account", async () => {
      const { prisma } = await import("@/lib/prisma");
      const mockPrisma = vi.mocked(prisma, true);

      const newInvoice = { id: "inv1", invoiceNumber: "INV-2026-0001" };
      mockPrisma.$transaction.mockResolvedValue([newInvoice, {}] as never);
      mockRepo.findById.mockResolvedValue(
        makeQuote({
          quoteStatus: "ACCEPTED",
          accountNumber: "INTERNAL-001",
          paymentMethod: "ACCOUNT_NUMBER",
          paymentAccountNumber: "SAP-12345",
        }) as never,
      );

      await quoteService.convertToInvoice("q1", "u1");

      expect(mockPrisma.invoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            accountNumber: "INTERNAL-001",
            paymentMethod: "ACCOUNT_NUMBER",
            paymentAccountNumber: "SAP-12345",
          }),
        }),
      );
    });
  });

  // ── generatePdf ──────────────────────────────────────────────────────────

  describe("generatePdf", () => {
    it("throws NOT_FOUND when quote does not exist", async () => {
      mockRepo.findById.mockResolvedValue(null);

      await expect(quoteService.generatePdf("missing")).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
    });

    it("throws NOT_FOUND when record is not type QUOTE", async () => {
      mockRepo.findById.mockResolvedValue(makeQuote({ type: "INVOICE" }) as never);

      await expect(quoteService.generatePdf("q1")).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("calls pdfService.generateQuote with correct mapped data", async () => {
      const quote = makeQuote();
      mockRepo.findById.mockResolvedValue(quote as never);
      mockPdfService.generateQuote.mockResolvedValue("/pdf/q1.pdf" as never);
      mockPdfService.readPdf.mockResolvedValue(Buffer.from("pdf-bytes") as never);

      const result = await quoteService.generatePdf("q1");

      expect(mockPdfService.generateQuote).toHaveBeenCalledWith(
        expect.objectContaining({
          quoteNumber: "Q-2026-0001",
          date: "January 15, 2026",
          expirationDate: "February 15, 2026",
          recipientName: "Jane Doe",
          recipientEmail: "jane@test.com",
          recipientOrg: "ACME Corp",
          department: "IT",
          category: "SUPPLIES",
          accountCode: "AC1",
          notes: "Test notes",
          totalAmount: 150,
          items: [
            expect.objectContaining({
              description: "Widget",
              quantity: 3,
              unitPrice: "25",
              extendedPrice: "75",
            }),
            expect.objectContaining({
              description: "Gadget",
              quantity: 3,
              unitPrice: "25",
              extendedPrice: "75",
            }),
          ],
        })
      );

      expect(mockPdfService.readPdf).toHaveBeenCalledWith("/pdf/q1.pdf");
      expect(result.buffer).toBeInstanceOf(Buffer);
      expect(result.filename).toBe("Q-2026-0001");
    });

    it("uses 'DRAFT' as quoteNumber when quote has no number", async () => {
      const quote = makeQuote({ quoteNumber: null });
      mockRepo.findById.mockResolvedValue(quote as never);
      mockPdfService.generateQuote.mockResolvedValue("/pdf/q1.pdf" as never);
      mockPdfService.readPdf.mockResolvedValue(Buffer.from("") as never);

      const result = await quoteService.generatePdf("q1");

      expect(mockPdfService.generateQuote).toHaveBeenCalledWith(
        expect.objectContaining({ quoteNumber: "DRAFT" })
      );
      expect(result.filename).toBe("quote");
    });
  });

  describe("getFollowUps", () => {
    it("maps follow-up rows to response DTOs", async () => {
      mockRepo.findFollowUpsByInvoiceId.mockResolvedValue([
        {
          id: "fu1",
          type: "PAYMENT_REMINDER",
          recipientEmail: "jane@test.com",
          subject: "Payment details needed",
          sentAt: new Date("2026-03-31T17:00:00.000Z"),
          metadata: { attempt: 2 },
        },
      ] as never);

      const result = await quoteService.getFollowUps("q1");

      expect(mockRepo.findFollowUpsByInvoiceId).toHaveBeenCalledWith("q1");
      expect(result).toEqual([
        {
          id: "fu1",
          type: "PAYMENT_REMINDER",
          recipientEmail: "jane@test.com",
          subject: "Payment details needed",
          sentAt: "2026-03-31T17:00:00.000Z",
          metadata: { attempt: 2 },
        },
      ]);
    });
  });
});
