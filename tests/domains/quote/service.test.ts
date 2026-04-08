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
    generateQuoteBuffer: vi.fn(),
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
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    followUp: {
      create: vi.fn(),
    },
    quoteView: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/domains/notification/service", () => ({
  notificationService: {
    createAndPublish: vi.fn(),
  },
}));

vi.mock("@/lib/email", () => ({
  sendEmail: vi.fn(),
}));

vi.mock("@/lib/html", () => ({
  escapeHtml: (value: string) => value,
}));

vi.mock("@/lib/sse", () => ({
  safePublishAll: vi.fn(),
}));

import * as quoteRepository from "@/domains/quote/repository";
import { pdfService } from "@/domains/pdf/service";
import { prisma } from "@/lib/prisma";
import { notificationService } from "@/domains/notification/service";
import { safePublishAll } from "@/lib/sse";
import { isPublicPaymentLinkAvailable, quoteService } from "@/domains/quote/service";

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

    it("includes converted invoice ownership in the mapped quote response", async () => {
      const quote = makeQuote({
        convertedToInvoice: { id: "inv1", invoiceNumber: "INV-2026-0001", createdBy: "u2" },
      });
      mockRepo.findById.mockResolvedValue(quote as never);

      const result = await quoteService.getById("q1");

      expect(result?.convertedToInvoice).toEqual({
        id: "inv1",
        invoiceNumber: "INV-2026-0001",
        createdBy: "u2",
      });
    });

    it("does not mark finalized converted invoices as payment resolved without a payment method", async () => {
      const quote = makeQuote({
        quoteStatus: "ACCEPTED",
        convertedToInvoice: {
          id: "inv1",
          invoiceNumber: "INV-2026-0001",
          status: "FINAL",
          createdBy: "u2",
        },
      });
      mockRepo.findById.mockResolvedValue(quote as never);

      const result = await quoteService.getById("q1");

      expect(result?.paymentDetailsResolved).toBe(false);
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
    it("submits payment details for accepted, unconverted quotes", async () => {
      mockRepo.findAcceptedPublicPaymentCandidate.mockResolvedValue({
        id: "q1",
        quoteNumber: "Q-1",
        recipientEmail: "jane@example.com",
        createdBy: "u1",
        paymentMethod: null,
        convertedToInvoice: null,
      } as never);
      const tx = {
        $queryRaw: vi.fn()
          .mockResolvedValueOnce([{ id: "q1", paymentMethod: null, quoteStatus: "ACCEPTED" }])
          .mockResolvedValueOnce([]),
        invoice: {
          update: vi.fn(),
        },
        followUp: {
          create: vi.fn(),
        },
      };
      vi.mocked(prisma.$transaction).mockImplementationOnce(async (callback) => callback(tx as never) as never);

      const result = await quoteService.submitPublicPaymentDetails("token", {
        paymentMethod: "ACCOUNT_NUMBER",
        accountNumber: "SAP-12345",
      });

      expect(result?.id).toBe("q1");
      expect(result?.paymentMethod).toBe("ACCOUNT_NUMBER");
      expect(result?.convertedToInvoice).toBeNull();
      expect(result).not.toHaveProperty("createdBy");
      expect(result?.updatedConvertedInvoice).toBe(false);
      expect(tx.invoice.update).toHaveBeenNthCalledWith(1, {
        where: { id: "q1" },
        data: {
          paymentMethod: "ACCOUNT_NUMBER",
          paymentAccountNumber: "SAP-12345",
        },
      });
      expect(tx.followUp.create).toHaveBeenCalledWith({
        data: {
          invoiceId: "q1",
          type: "PAYMENT_RESOLVED",
          recipientEmail: "jane@example.com",
          subject: "Payment details provided for Q-1",
          metadata: {
            paymentMethod: "ACCOUNT_NUMBER",
          },
        },
      });
      expect(vi.mocked(notificationService.createAndPublish)).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "u1",
          message: "Payment method: ACCOUNT_NUMBER",
        }),
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

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("rejects payment submissions for already converted quotes", async () => {
      mockRepo.findAcceptedPublicPaymentCandidate.mockResolvedValue({
        id: "q1",
        quoteNumber: "Q-1",
        recipientEmail: "jane@example.com",
        createdBy: "u1",
        paymentMethod: null,
        convertedToInvoice: { id: "inv1" },
      } as never);

      await expect(
        quoteService.submitPublicPaymentDetails("token", {
          paymentMethod: "CHECK",
        }),
      ).rejects.toMatchObject({
        code: "FORBIDDEN",
      });

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("re-checks for conversion inside the transaction", async () => {
      mockRepo.findAcceptedPublicPaymentCandidate.mockResolvedValue({
        id: "q1",
        quoteNumber: "Q-1",
        recipientEmail: "jane@example.com",
        createdBy: "u1",
        paymentMethod: null,
        convertedToInvoice: null,
      } as never);
      const tx = {
        $queryRaw: vi.fn()
          .mockResolvedValueOnce([{ id: "q1", paymentMethod: null, quoteStatus: "ACCEPTED" }])
          .mockResolvedValueOnce([{ id: "inv1", status: "FINAL", paymentMethod: null }]),
        invoice: {
          update: vi.fn(),
        },
        followUp: {
          create: vi.fn(),
        },
      };
      vi.mocked(prisma.$transaction).mockImplementationOnce(async (callback) => callback(tx as never) as never);

      await expect(
        quoteService.submitPublicPaymentDetails("token", {
          paymentMethod: "CHECK",
        }),
      ).rejects.toMatchObject({
        code: "FORBIDDEN",
      });

      expect(tx.invoice.update).not.toHaveBeenCalled();
      expect(tx.followUp.create).not.toHaveBeenCalled();
    });
  });

  describe("isPublicPaymentLinkAvailable", () => {
    it("is true for accepted quotes with no converted invoice", () => {
      expect(
        isPublicPaymentLinkAvailable({
          quoteStatus: "ACCEPTED",
          convertedToInvoice: null,
          paymentMethod: null,
        }),
      ).toBe(true);
    });

    it("is false for accepted quotes with a converted invoice", () => {
      expect(
        isPublicPaymentLinkAvailable({
          quoteStatus: "ACCEPTED",
          convertedToInvoice: { id: "inv1", invoiceNumber: "INV-1", status: "DRAFT", createdBy: null },
          paymentMethod: null,
        }),
      ).toBe(false);
    });

    it("is false for accepted quotes with existing payment details", () => {
      expect(
        isPublicPaymentLinkAvailable({
          quoteStatus: "ACCEPTED",
          convertedToInvoice: null,
          paymentMethod: "CHECK",
        }),
      ).toBe(false);
    });

    it("is false for sent quotes even without conversion", () => {
      expect(
        isPublicPaymentLinkAvailable({
          quoteStatus: "SENT",
          convertedToInvoice: null,
        }),
      ).toBe(false);
    });

    it("is false for SUBMITTED_EMAIL and SUBMITTED_MANUAL states", () => {
      expect(
        isPublicPaymentLinkAvailable({
          quoteStatus: "SUBMITTED_EMAIL",
          convertedToInvoice: null,
        }),
      ).toBe(false);
      expect(
        isPublicPaymentLinkAvailable({
          quoteStatus: "SUBMITTED_MANUAL",
          convertedToInvoice: null,
        }),
      ).toBe(false);
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
      const tx = {
        $queryRaw: vi.fn()
          .mockResolvedValueOnce([{ id: "q1", quoteStatus: "SENT", paymentMethod: null }])
          .mockResolvedValueOnce([{ id: "inv1", status: "DRAFT", paymentMethod: null }]),
        invoice: {
          update: vi.fn(),
        },
        quoteView: {
          findFirst: vi.fn().mockResolvedValue({ id: "view-1" }),
          update: vi.fn(),
        },
      };
      vi.mocked(prisma.$transaction).mockImplementationOnce(async (callback) => callback(tx as never) as never);

      await quoteService.respondToQuote(
        "token",
        "ACCEPTED",
        "view-1",
        { paymentMethod: "ACCOUNT_NUMBER", accountNumber: "SAP-12345" },
      );

      expect(tx.invoice.update).toHaveBeenNthCalledWith(1, {
        where: { id: "inv1" },
        data: {
          paymentMethod: "ACCOUNT_NUMBER",
          paymentAccountNumber: "SAP-12345",
        },
      });
      expect(tx.invoice.update).toHaveBeenNthCalledWith(2, {
        where: { id: "q1" },
        data: {
          quoteStatus: "ACCEPTED",
          acceptedAt: expect.any(Date),
          paymentMethod: "ACCOUNT_NUMBER",
          paymentAccountNumber: "SAP-12345",
        },
      });
      expect(tx.quoteView.update).toHaveBeenCalledWith({
        where: { id: "view-1" },
        data: { respondedWith: "ACCEPTED" },
      });
      expect(mockRepo.update).not.toHaveBeenCalled();
      expect(mockRepo.updateViewResponse).not.toHaveBeenCalled();
      expect(vi.mocked(safePublishAll)).toHaveBeenCalledWith({ type: "quote-changed" });
      expect(vi.mocked(safePublishAll)).toHaveBeenCalledWith({ type: "invoice-changed" });
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
      const tx = {
        $queryRaw: vi.fn()
          .mockResolvedValueOnce([{ id: "q1", quoteStatus: "SENT", paymentMethod: null }])
          .mockResolvedValueOnce([{ id: "inv1", status: "DRAFT", paymentMethod: null }]),
        invoice: {
          update: vi.fn(),
        },
        quoteView: {
          findFirst: vi.fn(),
          update: vi.fn(),
        },
      };
      vi.mocked(prisma.$transaction).mockImplementationOnce(async (callback) => callback(tx as never) as never);

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

      expect(tx.invoice.update).toHaveBeenNthCalledWith(1, {
        where: { id: "inv1" },
        data: expect.objectContaining({
          paymentMethod: "CHECK",
          cateringDetails: expect.objectContaining({
            location: "Campus",
            contactName: "Jane",
          }),
        }),
      });
      expect(tx.invoice.update).toHaveBeenNthCalledWith(2, {
        where: { id: "q1" },
        data: expect.objectContaining({
          quoteStatus: "ACCEPTED",
          paymentMethod: "CHECK",
          cateringDetails: expect.objectContaining({
            location: "Campus",
            contactName: "Jane",
          }),
        }),
      });
    });

    it("preserves setup and takedown instructions from the locked quote records", async () => {
      mockRepo.findByShareToken.mockResolvedValue(
        makeQuote({
          quoteStatus: "SENT",
          expirationDate: new Date("2099-02-15"),
          isCateringEvent: true,
          cateringDetails: {
            setupInstructions: "stale quote setup",
            takedownInstructions: "stale quote takedown",
          },
          convertedToInvoice: { id: "inv1", invoiceNumber: "INV-2026-0001" },
        }) as never,
      );
      const tx = {
        $queryRaw: vi.fn()
          .mockResolvedValueOnce([{
            id: "q1",
            quoteStatus: "SENT",
            paymentMethod: null,
            cateringDetails: {
              setupInstructions: "locked quote setup",
              takedownInstructions: "locked quote takedown",
            },
          }])
          .mockResolvedValueOnce([{
            id: "inv1",
            status: "DRAFT",
            paymentMethod: null,
            cateringDetails: {
              setupInstructions: "locked invoice setup",
              takedownInstructions: "locked invoice takedown",
            },
          }]),
        invoice: {
          update: vi.fn(),
        },
        quoteView: {
          findFirst: vi.fn(),
          update: vi.fn(),
        },
      };
      vi.mocked(prisma.$transaction).mockImplementationOnce(async (callback) => callback(tx as never) as never);

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

      expect(tx.invoice.update).toHaveBeenNthCalledWith(1, {
        where: { id: "inv1" },
        data: expect.objectContaining({
          cateringDetails: expect.objectContaining({
            setupInstructions: "locked invoice setup",
            takedownInstructions: "locked invoice takedown",
          }),
        }),
      });
      expect(tx.invoice.update).toHaveBeenNthCalledWith(2, {
        where: { id: "q1" },
        data: expect.objectContaining({
          cateringDetails: expect.objectContaining({
            setupInstructions: "locked quote setup",
            takedownInstructions: "locked quote takedown",
          }),
        }),
      });
    });

    it("rejects late declines after the quote has been converted", async () => {
      mockRepo.findByShareToken.mockResolvedValue(
        makeQuote({
          quoteStatus: "SENT",
          expirationDate: new Date("2099-02-15"),
        }) as never,
      );
      const tx = {
        $queryRaw: vi.fn()
          .mockResolvedValueOnce([{ id: "q1", quoteStatus: "SENT", paymentMethod: null, cateringDetails: null }])
          .mockResolvedValueOnce([{ id: "inv1", status: "DRAFT", paymentMethod: null, cateringDetails: null }]),
        invoice: {
          update: vi.fn(),
        },
        quoteView: {
          findFirst: vi.fn(),
          update: vi.fn(),
        },
      };
      vi.mocked(prisma.$transaction).mockImplementationOnce(async (callback) => callback(tx as never) as never);

      await expect(
        quoteService.respondToQuote(
          "token",
          "DECLINED",
        ),
      ).rejects.toMatchObject({
        code: "FORBIDDEN",
        message: "This quote is no longer available",
      });

      expect(tx.invoice.update).not.toHaveBeenCalled();
    });

    it("rejects late plain approvals after the quote has been converted", async () => {
      mockRepo.findByShareToken.mockResolvedValue(
        makeQuote({
          quoteStatus: "SENT",
          expirationDate: new Date("2099-02-15"),
        }) as never,
      );
      const tx = {
        $queryRaw: vi.fn()
          .mockResolvedValueOnce([{ id: "q1", quoteStatus: "SENT", paymentMethod: null, cateringDetails: null }])
          .mockResolvedValueOnce([{ id: "inv1", status: "DRAFT", paymentMethod: null, cateringDetails: null }]),
        invoice: {
          update: vi.fn(),
        },
        quoteView: {
          findFirst: vi.fn(),
          update: vi.fn(),
        },
      };
      vi.mocked(prisma.$transaction).mockImplementationOnce(async (callback) => callback(tx as never) as never);

      await expect(
        quoteService.respondToQuote(
          "token",
          "ACCEPTED",
        ),
      ).rejects.toMatchObject({
        code: "FORBIDDEN",
        message: "This quote is no longer available",
      });

      expect(tx.invoice.update).not.toHaveBeenCalled();
    });

    it("rejects a quote that expires after the initial guard but before the locked check", async () => {
      mockRepo.findByShareToken.mockResolvedValue(
        makeQuote({
          quoteStatus: "SENT",
          expirationDate: new Date("2099-02-15"),
        }) as never,
      );
      const tx = {
        $queryRaw: vi.fn().mockResolvedValueOnce([
          {
            id: "q1",
            quoteStatus: "SENT",
            paymentMethod: null,
            expirationDate: new Date("2026-03-01"),
            cateringDetails: null,
          },
        ]),
        invoice: {
          update: vi.fn(),
        },
        quoteView: {
          findFirst: vi.fn(),
          update: vi.fn(),
        },
      };
      vi.mocked(prisma.$transaction).mockImplementationOnce(async (callback) => callback(tx as never) as never);

      await expect(
        quoteService.respondToQuote(
          "token",
          "ACCEPTED",
        ),
      ).rejects.toMatchObject({
        code: "FORBIDDEN",
        message: "This quote has expired",
      });

      expect(mockRepo.update).toHaveBeenCalledWith("q1", { quoteStatus: "EXPIRED" });
      expect(tx.invoice.update).not.toHaveBeenCalled();
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

      expect(prisma.$transaction).not.toHaveBeenCalled();
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

    it("retries quote creation when the generated quote number collides", async () => {
      mockRepo.generateNumber
        .mockResolvedValueOnce("Q-2026-0001" as never)
        .mockResolvedValueOnce("Q-2026-0002" as never);
      mockRepo.create
        .mockRejectedValueOnce({ code: "P2002" } as never)
        .mockResolvedValueOnce(makeQuote({ quoteNumber: "Q-2026-0002" }) as never);

      const result = await quoteService.create(
        {
          date: "2026-01-15",
          expirationDate: "2026-02-15",
          staffId: "s1",
          department: "IT",
          category: "SUPPLIES",
          recipientName: "Jane",
          items: [{ description: "Item", quantity: 1, unitPrice: 10 }],
        },
        "u1",
      );

      expect(mockRepo.generateNumber).toHaveBeenCalledTimes(2);
      expect(mockRepo.create).toHaveBeenNthCalledWith(
        1,
        expect.any(Object),
        expect.any(Array),
        10,
        "u1",
        "Q-2026-0001",
      );
      expect(mockRepo.create).toHaveBeenNthCalledWith(
        2,
        expect.any(Object),
        expect.any(Array),
        10,
        "u1",
        "Q-2026-0002",
      );
      expect(result.quoteNumber).toBe("Q-2026-0002");
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

    it("reopens accepted quotes to draft when a meaningful edit is made", async () => {
      const quote = makeQuote({
        quoteStatus: "ACCEPTED",
        convertedToInvoice: null,
        acceptedAt: new Date("2026-01-20T00:00:00.000Z"),
        paymentMethod: "CHECK",
        paymentAccountNumber: null,
      });
      mockRepo.findById.mockResolvedValue(quote as never);
      mockRepo.update.mockResolvedValue({
        ...quote,
        quoteStatus: "DRAFT",
        notes: "Updated after approval",
        acceptedAt: null,
        paymentMethod: null,
        paymentAccountNumber: null,
      } as never);

      await quoteService.update("q1", { notes: "Updated after approval" });

      expect(mockRepo.update).toHaveBeenCalledWith("q1", {
        notes: "Updated after approval",
        quoteStatus: "DRAFT",
        acceptedAt: null,
        paymentMethod: null,
        paymentAccountNumber: null,
      });
    });

    it("keeps accepted quotes accepted when the submitted edit is a no-op", async () => {
      const quote = makeQuote({
        quoteStatus: "ACCEPTED",
        convertedToInvoice: null,
        acceptedAt: new Date("2026-01-20T00:00:00.000Z"),
        paymentMethod: "CHECK",
      });
      mockRepo.findById.mockResolvedValue(quote as never);
      mockRepo.update.mockResolvedValue(quote as never);

      await quoteService.update("q1", { notes: "Test notes" });

      expect(mockRepo.update).toHaveBeenCalledWith("q1", { notes: "Test notes" });
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

  // ── approveManually ────────────────────────────────────────────────────

  describe("updateViewDurationForToken", () => {
    it("only updates a view when it belongs to the provided quote token", async () => {
      mockRepo.findByShareToken.mockResolvedValue(makeQuote({ id: "q1", type: "QUOTE" }) as never);
      const mockPrisma = vi.mocked(prisma, true);
      mockPrisma.quoteView.findFirst.mockResolvedValue({ id: "view-1" } as never);
      mockRepo.updateViewDuration.mockResolvedValue(undefined as never);

      await quoteService.updateViewDurationForToken("token", "view-1", 38);

      expect(mockRepo.findByShareToken).toHaveBeenCalledWith("token");
      expect(mockPrisma.quoteView.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "view-1", invoiceId: "q1" },
        }),
      );
      expect(mockRepo.updateViewDuration).toHaveBeenCalledWith("view-1", 38);
    });

    it("throws when the view does not belong to the quote token", async () => {
      mockRepo.findByShareToken.mockResolvedValue(makeQuote({ id: "q1", type: "QUOTE" }) as never);
      const mockPrisma = vi.mocked(prisma, true);
      mockPrisma.quoteView.findFirst.mockResolvedValue(null);

      await expect(quoteService.updateViewDurationForToken("token", "view-1", 38)).rejects.toMatchObject({
        code: "INVALID_INPUT",
      });
      expect(mockRepo.updateViewDuration).not.toHaveBeenCalled();
    });
  });

  describe("approveManually", () => {
    it("stores payment details when approving a quote manually", async () => {
      const quote = makeQuote({
        quoteStatus: "SENT",
        expirationDate: new Date("2099-02-15"),
      });
      mockRepo.findById.mockResolvedValue(quote as never);
      mockRepo.update.mockResolvedValue({ ...quote, quoteStatus: "ACCEPTED" } as never);

      await quoteService.approveManually("q1", {
        paymentMethod: "CHECK",
      });

      expect(mockRepo.update).toHaveBeenCalledWith("q1", {
        quoteStatus: "ACCEPTED",
        acceptedAt: expect.any(Date),
        paymentMethod: "CHECK",
        paymentAccountNumber: null,
      });
      expect(notificationService.createAndPublish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "QUOTE_APPROVED",
          quoteId: "q1",
        }),
      );
    });

    it("syncs payment details to a converted invoice when approving a quote manually", async () => {
      const quote = makeQuote({
        quoteStatus: "SENT",
        expirationDate: new Date("2099-02-15"),
        convertedToInvoice: { id: "inv1", invoiceNumber: "INV-2026-0001", status: "DRAFT", createdBy: "u1", paymentMethod: null },
      });
      mockRepo.findById.mockResolvedValue(quote as never);
      const mockPrisma = vi.mocked(prisma, true);
      const tx = {
        $queryRaw: vi.fn().mockResolvedValue([
          { id: "inv1", status: "DRAFT", paymentMethod: null },
        ]),
        invoice: {
          update: vi.fn().mockResolvedValue({}),
        },
      };
      mockPrisma.$transaction.mockImplementationOnce(async (callback) => callback(tx as never) as never);

      await quoteService.approveManually("q1", {
        paymentMethod: "ACCOUNT_NUMBER",
        accountNumber: "SAP-12345",
      });

      expect(tx.invoice.update).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          where: { id: "q1" },
          data: expect.objectContaining({
            quoteStatus: "ACCEPTED",
            acceptedAt: expect.any(Date),
            paymentMethod: "ACCOUNT_NUMBER",
            paymentAccountNumber: "SAP-12345",
          }),
        }),
      );
      expect(tx.invoice.update).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          where: { id: "inv1" },
          data: expect.objectContaining({
            paymentMethod: "ACCOUNT_NUMBER",
            paymentAccountNumber: "SAP-12345",
          }),
        }),
      );
    });

    it("rejects manual approval for catering quotes missing required customer event details", async () => {
      const quote = makeQuote({
        quoteStatus: "SENT",
        expirationDate: new Date("2099-02-15"),
        isCateringEvent: true,
        cateringDetails: {
          eventDate: "2026-04-07",
          startTime: "",
          endTime: "",
          location: "",
          contactName: "Jane Doe",
          contactPhone: "555-1111",
          setupRequired: true,
          setupTime: "13:30",
          takedownRequired: true,
          takedownTime: "",
        },
      });
      mockRepo.findById.mockResolvedValue(quote as never);

      await expect(quoteService.approveManually("q1")).rejects.toMatchObject({
        code: "INVALID_INPUT",
      });
      expect(mockRepo.update).not.toHaveBeenCalled();
      expect(notificationService.createAndPublish).not.toHaveBeenCalled();
    });

    it("allows staff to provide missing catering details during manual approval", async () => {
      const quote = makeQuote({
        quoteStatus: "SENT",
        expirationDate: new Date("2099-02-15"),
        isCateringEvent: true,
        cateringDetails: {
          eventDate: "2026-04-07",
          startTime: "13:00",
          endTime: "14:00",
          location: "",
          contactName: "Jane Doe",
          contactPhone: "555-1111",
          setupRequired: false,
          takedownRequired: false,
        },
      });
      mockRepo.findById.mockResolvedValue(quote as never);
      mockRepo.update.mockResolvedValue({ ...quote, quoteStatus: "ACCEPTED" } as never);

      await quoteService.approveManually("q1", {
        cateringDetails: {
          location: "Library 101",
        },
      });

      expect(mockRepo.update).toHaveBeenCalledWith("q1", expect.objectContaining({
        quoteStatus: "ACCEPTED",
        cateringDetails: expect.objectContaining({
          location: "Library 101",
          startTime: "13:00",
          endTime: "14:00",
          contactName: "Jane Doe",
        }),
      }));
    });
  });

  // ── markSent ─────────────────────────────────────────────────────────────

  describe("markSent", () => {
    it("throws NOT_FOUND when quote does not exist", async () => {
      const { prisma } = await import("@/lib/prisma");
      const mockPrisma = vi.mocked(prisma, true);
      const tx = { $queryRaw: vi.fn().mockResolvedValue([]) };
      mockPrisma.$transaction.mockImplementationOnce(async (callback) => callback(tx as never) as never);

      await expect(quoteService.markSent("missing")).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("throws FORBIDDEN when quote is accepted and not sendable", async () => {
      const { prisma } = await import("@/lib/prisma");
      const mockPrisma = vi.mocked(prisma, true);
      const tx = {
        $queryRaw: vi.fn().mockResolvedValue([{ id: "q1", type: "QUOTE", quoteStatus: "ACCEPTED", shareToken: "token" }]),
      };
      mockPrisma.$transaction.mockImplementationOnce(async (callback) => callback(tx as never) as never);

      await expect(quoteService.markSent("q1")).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("generates and persists a share token when sending a DRAFT quote", async () => {
      const { prisma } = await import("@/lib/prisma");
      const mockPrisma = vi.mocked(prisma, true);
      const tx = {
        $queryRaw: vi.fn().mockResolvedValue([{ id: "q1", type: "QUOTE", quoteStatus: "DRAFT", shareToken: null }]),
        invoice: {
          update: vi.fn().mockResolvedValue({}),
        },
      };
      mockPrisma.$transaction.mockImplementationOnce(async (callback) => callback(tx as never) as never);

      const result = await quoteService.markSent("q1");

      expect(tx.invoice.update).toHaveBeenCalledWith({
        where: { id: "q1" },
        data: { quoteStatus: "SENT", shareToken: expect.any(String) },
      });
      expect(result).toHaveProperty("shareToken");
    });

    it("returns the existing token without mutating state when quote is already sent", async () => {
      const { prisma } = await import("@/lib/prisma");
      const mockPrisma = vi.mocked(prisma, true);
      const tx = {
        $queryRaw: vi.fn().mockResolvedValue([{ id: "q1", type: "QUOTE", quoteStatus: "SENT", shareToken: "existing-token" }]),
        invoice: {
          update: vi.fn(),
        },
      };
      mockPrisma.$transaction.mockImplementationOnce(async (callback) => callback(tx as never) as never);

      const result = await quoteService.markSent("q1");

      expect(result.shareToken).toBe("existing-token");
      expect(tx.invoice.update).not.toHaveBeenCalled();
    });
  });

  describe("markSubmittedEmail", () => {
    it("treats a repeated SUBMITTED_EMAIL transition as a no-op", async () => {
      const { prisma } = await import("@/lib/prisma");
      const mockPrisma = vi.mocked(prisma, true);
      const tx = {
        $queryRaw: vi.fn().mockResolvedValue([{ id: "q1", type: "QUOTE", quoteStatus: "SUBMITTED_EMAIL" }]),
        invoice: {
          update: vi.fn(),
        },
      };
      mockPrisma.$transaction.mockImplementationOnce(async (callback) => callback(tx as never) as never);

      await expect(quoteService.markSubmittedEmail("q1")).resolves.toBeUndefined();

      expect(tx.invoice.update).not.toHaveBeenCalled();
      expect(safePublishAll).not.toHaveBeenCalled();
    });

    it("throws when quote is not in a SENDable state", async () => {
      const { prisma } = await import("@/lib/prisma");
      const mockPrisma = vi.mocked(prisma, true);
      const tx = {
        $queryRaw: vi.fn().mockResolvedValue([{ id: "q1", type: "QUOTE", quoteStatus: "ACCEPTED" }]),
        invoice: {
          update: vi.fn(),
        },
      };
      mockPrisma.$transaction.mockImplementationOnce(async (callback) => callback(tx as never) as never);

      await expect(quoteService.markSubmittedEmail("q1")).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(tx.invoice.update).not.toHaveBeenCalled();
      expect(safePublishAll).not.toHaveBeenCalled();
    });
  });

  describe("markSubmittedManual", () => {
    it("treats a repeated SUBMITTED_MANUAL transition as a no-op", async () => {
      const { prisma } = await import("@/lib/prisma");
      const mockPrisma = vi.mocked(prisma, true);
      const tx = {
        $queryRaw: vi.fn().mockResolvedValue([{ id: "q1", type: "QUOTE", quoteStatus: "SUBMITTED_MANUAL", shareToken: null }]),
        invoice: {
          update: vi.fn(),
        },
      };
      mockPrisma.$transaction.mockImplementationOnce(async (callback) => callback(tx as never) as never);

      await expect(quoteService.markSubmittedManual("q1")).resolves.toBeUndefined();

      expect(tx.invoice.update).not.toHaveBeenCalled();
      expect(safePublishAll).not.toHaveBeenCalled();
    });

    it("throws when quote is already submitted via email", async () => {
      const { prisma } = await import("@/lib/prisma");
      const mockPrisma = vi.mocked(prisma, true);
      const tx = {
        $queryRaw: vi.fn().mockResolvedValue([{ id: "q1", type: "QUOTE", quoteStatus: "SUBMITTED_EMAIL", shareToken: "manual-token" }]),
        invoice: {
          update: vi.fn(),
        },
      };
      mockPrisma.$transaction.mockImplementationOnce(async (callback) => callback(tx as never) as never);

      await expect(quoteService.markSubmittedManual("q1")).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(tx.invoice.update).not.toHaveBeenCalled();
      expect(safePublishAll).not.toHaveBeenCalled();
    });
  });

  describe("createRevision", () => {
    it("locks the source quote before creating a revision and transitions the source to REVISED", async () => {
      const { prisma } = await import("@/lib/prisma");
      const mockPrisma = vi.mocked(prisma, true);
      const sourceQuote = makeQuote({ quoteStatus: "DECLINED" });
      const revisedQuote = makeQuote({ id: "rev1", quoteStatus: "DRAFT", quoteNumber: "Q-2026-0002" });

      mockRepo.findById
        .mockResolvedValueOnce(sourceQuote as never)
        .mockResolvedValueOnce(revisedQuote as never);

      const tx = {
        $queryRaw: vi.fn().mockResolvedValue([{ id: "q1", type: "QUOTE", quoteStatus: "DECLINED" }]),
        invoice: {
          create: vi.fn().mockResolvedValue({ id: "rev1", quoteNumber: "Q-2026-0002" }),
          update: vi.fn().mockResolvedValue({}),
        },
      };
      mockPrisma.$transaction.mockImplementationOnce(async (callback) => callback(tx as never) as never);

      const result = await quoteService.createRevision("q1", "u1");

      expect(tx.invoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            quoteStatus: "DRAFT",
            quoteNumber: expect.any(String),
            revisedFromQuoteId: "q1",
          }),
        }),
      );
      expect(tx.invoice.update).toHaveBeenCalledWith({
        where: { id: "q1" },
        data: { quoteStatus: "REVISED" },
      });
      expect(mockRepo.findById).toHaveBeenCalledWith("rev1");
      expect(result.id).toBe("rev1");
    });

    it("rejects revision when the quote transitions out of DECLINED/EXPIRED after the lock is acquired", async () => {
      const { prisma } = await import("@/lib/prisma");
      const mockPrisma = vi.mocked(prisma, true);
      const sourceQuote = makeQuote({ quoteStatus: "DECLINED" });
      mockRepo.findById.mockResolvedValue(sourceQuote as never);

      const tx = {
        $queryRaw: vi.fn().mockResolvedValue([{ id: "q1", type: "QUOTE", quoteStatus: "SENT" }]),
        invoice: {
          create: vi.fn(),
          update: vi.fn(),
        },
      };
      mockPrisma.$transaction.mockImplementationOnce(async (callback) => callback(tx as never) as never);

      await expect(quoteService.createRevision("q1", "u1")).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(tx.invoice.create).not.toHaveBeenCalled();
      expect(tx.invoice.update).not.toHaveBeenCalled();
    });
  });

  // ── convertToInvoice ─────────────────────────────────────────────────────

  describe("convertToInvoice", () => {
    it("throws NOT_FOUND when quote does not exist", async () => {
      const { prisma } = await import("@/lib/prisma");
      const mockPrisma = vi.mocked(prisma, true);
      const tx = {
        $queryRaw: vi.fn().mockResolvedValue([]),
        invoice: {
          findFirst: vi.fn(),
          findUnique: vi.fn(),
          create: vi.fn(),
          update: vi.fn(),
        },
      };
      mockPrisma.$transaction.mockImplementationOnce(async (callback) => callback(tx as never) as never);

      await expect(quoteService.convertToInvoice("missing", "u1")).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
    });

    it("throws FORBIDDEN for DECLINED quotes", async () => {
      const { prisma } = await import("@/lib/prisma");
      const mockPrisma = vi.mocked(prisma, true);
      const tx = {
        $queryRaw: vi.fn().mockResolvedValue([{ id: "q1" }]),
        invoice: {
          findFirst: vi.fn().mockResolvedValue(null),
          findUnique: vi.fn().mockResolvedValue(makeQuote({ quoteStatus: "DECLINED" })),
          create: vi.fn(),
          update: vi.fn(),
        },
      };
      mockPrisma.$transaction.mockImplementationOnce(async (callback) => callback(tx as never) as never);

      await expect(quoteService.convertToInvoice("q1", "u1")).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
    });

    it("throws FORBIDDEN for EXPIRED quotes", async () => {
      const { prisma } = await import("@/lib/prisma");
      const mockPrisma = vi.mocked(prisma, true);
      const tx = {
        $queryRaw: vi.fn().mockResolvedValue([{ id: "q1" }]),
        invoice: {
          findFirst: vi.fn().mockResolvedValue(null),
          findUnique: vi.fn().mockResolvedValue(makeQuote({ quoteStatus: "EXPIRED" })),
          create: vi.fn(),
          update: vi.fn(),
        },
      };
      mockPrisma.$transaction.mockImplementationOnce(async (callback) => callback(tx as never) as never);

      await expect(quoteService.convertToInvoice("q1", "u1")).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
    });

    it("preserves the accepted response state when converting an accepted quote", async () => {
      const { prisma } = await import("@/lib/prisma");
      const mockPrisma = vi.mocked(prisma, true);
      const acceptedAt = new Date("2026-03-01T10:00:00.000Z");

      const newInvoice = { id: "inv1", invoiceNumber: "INV-2026-0001" };
      const tx = {
        $queryRaw: vi.fn().mockResolvedValue([{ id: "q1" }]),
        invoice: {
          findFirst: vi.fn().mockResolvedValue(null),
          findUnique: vi.fn().mockResolvedValue(makeQuote({
            quoteStatus: "ACCEPTED",
            acceptedAt,
            paymentMethod: "CHECK",
          })),
          create: vi.fn().mockResolvedValue(newInvoice),
          update: vi.fn().mockResolvedValue({}),
        },
      };
      mockPrisma.$transaction.mockImplementationOnce(async (callback) => callback(tx as never) as never);

      const result = await quoteService.convertToInvoice("q1", "u1");

      expect(mockPrisma.$transaction).toHaveBeenCalledOnce();
      expect(tx.invoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            accountNumber: "12345",
            paymentMethod: "CHECK",
            paymentAccountNumber: null,
          }),
        }),
      );
      expect(tx.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "q1" },
          data: expect.objectContaining({
            quoteStatus: "ACCEPTED",
            acceptedAt,
            convertedAt: expect.any(Date),
          }),
        }),
      );
      expect(result).toEqual(newInvoice);
    });

    it("allows ACCEPTED quotes to convert when payment details are resolved", async () => {
      const { prisma } = await import("@/lib/prisma");
      const mockPrisma = vi.mocked(prisma, true);

      const newInvoice = { id: "inv1", invoiceNumber: "INV-2026-0001" };
      const tx = {
        $queryRaw: vi.fn().mockResolvedValue([{ id: "q1" }]),
        invoice: {
          findFirst: vi.fn().mockResolvedValue(null),
          findUnique: vi.fn().mockResolvedValue(
            makeQuote({
              quoteStatus: "ACCEPTED",
              convertedToInvoice: null,
              paymentMethod: "CHECK",
            }),
          ),
          create: vi.fn().mockResolvedValue(newInvoice),
          update: vi.fn().mockResolvedValue({}),
        },
      };
      mockPrisma.$transaction.mockImplementationOnce(async (callback) => callback(tx as never) as never);

      await expect(quoteService.convertToInvoice("q1", "u1")).resolves.toEqual(newInvoice);
    });

    it("throws FORBIDDEN for ACCEPTED quotes without resolved payment details", async () => {
      const { prisma } = await import("@/lib/prisma");
      const mockPrisma = vi.mocked(prisma, true);
      const tx = {
        $queryRaw: vi.fn().mockResolvedValue([{ id: "q1" }]),
        invoice: {
          findFirst: vi.fn().mockResolvedValue(null),
          findUnique: vi.fn().mockResolvedValue(
            makeQuote({
              quoteStatus: "ACCEPTED",
              convertedToInvoice: null,
              paymentMethod: null,
            }),
          ),
          create: vi.fn(),
          update: vi.fn(),
        },
      };
      mockPrisma.$transaction.mockImplementationOnce(async (callback) => callback(tx as never) as never);

      await expect(quoteService.convertToInvoice("q1", "u1")).rejects.toMatchObject({
        code: "FORBIDDEN",
        message: "Cannot convert an accepted quote until payment details are resolved",
      });
      expect(tx.invoice.create).not.toHaveBeenCalled();
    });

    it("throws FORBIDDEN when quote has already been converted", async () => {
      const { prisma } = await import("@/lib/prisma");
      const mockPrisma = vi.mocked(prisma, true);
      const tx = {
        $queryRaw: vi.fn().mockResolvedValue([{ id: "q1" }]),
        invoice: {
          findFirst: vi.fn().mockResolvedValue({ id: "inv1", invoiceNumber: "INV-2026-0001" }),
          findUnique: vi.fn(),
          create: vi.fn(),
          update: vi.fn(),
        },
      };
      mockPrisma.$transaction.mockImplementationOnce(async (callback) => callback(tx as never) as never);

      await expect(quoteService.convertToInvoice("q1", "u1")).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
    });

    it("preserves payment details separately from the quote charge account", async () => {
      const { prisma } = await import("@/lib/prisma");
      const mockPrisma = vi.mocked(prisma, true);

      const newInvoice = { id: "inv1", invoiceNumber: "INV-2026-0001" };
      const tx = {
        $queryRaw: vi.fn().mockResolvedValue([{ id: "q1" }]),
        invoice: {
          findFirst: vi.fn().mockResolvedValue(null),
          findUnique: vi.fn().mockResolvedValue(
            makeQuote({
              quoteStatus: "ACCEPTED",
              accountNumber: "INTERNAL-001",
              paymentMethod: "ACCOUNT_NUMBER",
              paymentAccountNumber: "SAP-12345",
            }),
          ),
          create: vi.fn().mockResolvedValue(newInvoice),
          update: vi.fn().mockResolvedValue({}),
        },
      };
      mockPrisma.$transaction.mockImplementationOnce(async (callback) => callback(tx as never) as never);

      await quoteService.convertToInvoice("q1", "u1");

      expect(tx.invoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            accountNumber: "INTERNAL-001",
            paymentMethod: "ACCOUNT_NUMBER",
            paymentAccountNumber: "SAP-12345",
          }),
        }),
      );
    });

    it("creates from the locked in-transaction quote snapshot", async () => {
      const { prisma } = await import("@/lib/prisma");
      const mockPrisma = vi.mocked(prisma, true);

      const newInvoice = { id: "inv1", invoiceNumber: "INV-2026-0001" };
      const tx = {
        $queryRaw: vi.fn().mockResolvedValue([{ id: "q1" }]),
        invoice: {
          findFirst: vi.fn().mockResolvedValue(null),
          findUnique: vi.fn().mockResolvedValue(
            makeQuote({
              quoteStatus: "ACCEPTED",
              paymentMethod: "CHECK",
              paymentAccountNumber: null,
              cateringDetails: { location: "Campus" },
            }),
          ),
          create: vi.fn().mockResolvedValue(newInvoice),
          update: vi.fn().mockResolvedValue({}),
        },
      };
      mockPrisma.$transaction.mockImplementationOnce(async (callback) => callback(tx as never) as never);

      await quoteService.convertToInvoice("q1", "u1");

      expect(tx.invoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            paymentMethod: "CHECK",
            paymentAccountNumber: null,
            cateringDetails: { location: "Campus" },
          }),
        }),
      );
    });

    it("preserves an existing acceptance timestamp when converting an already accepted quote", async () => {
      const { prisma } = await import("@/lib/prisma");
      const mockPrisma = vi.mocked(prisma, true);

      const acceptedAt = new Date("2026-03-25T17:00:00.000Z");
      const newInvoice = { id: "inv1", invoiceNumber: "INV-2026-0001" };
      const tx = {
        $queryRaw: vi.fn().mockResolvedValue([{ id: "q1" }]),
        invoice: {
          findFirst: vi.fn().mockResolvedValue(null),
          findUnique: vi.fn().mockResolvedValue(
            makeQuote({
              quoteStatus: "ACCEPTED",
              acceptedAt,
              paymentMethod: "CHECK",
            }),
          ),
          create: vi.fn().mockResolvedValue(newInvoice),
          update: vi.fn().mockResolvedValue({}),
        },
      };
      mockPrisma.$transaction.mockImplementationOnce(async (callback) => callback(tx as never) as never);

      await quoteService.convertToInvoice("q1", "u1");

      expect(tx.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "q1" },
          data: expect.objectContaining({
            quoteStatus: "ACCEPTED",
            acceptedAt,
            convertedAt: expect.any(Date),
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
      mockPdfService.generateQuoteBuffer.mockResolvedValue(Buffer.from("pdf-bytes") as never);

      const result = await quoteService.generatePdf("q1");

      expect(mockPdfService.generateQuoteBuffer).toHaveBeenCalledWith(
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
          shareToken: null,
          appUrl: undefined,
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
      expect(result.buffer).toBeInstanceOf(Buffer);
      expect(result.filename).toBe("Q-2026-0001");
    });

    it("includes the public share link only when explicitly requested", async () => {
      const quote = makeQuote({ shareToken: "share-token" });
      mockRepo.findById.mockResolvedValue(quote as never);
      mockPdfService.generateQuoteBuffer.mockResolvedValue(Buffer.from("pdf-bytes") as never);

      await quoteService.generatePdf("q1", { includePublicShareLink: true });

      expect(mockPdfService.generateQuoteBuffer).toHaveBeenCalledWith(
        expect.objectContaining({
          shareToken: "share-token",
          appUrl: expect.any(String),
        })
      );
    });

    it("uses 'DRAFT' as quoteNumber when quote has no number", async () => {
      const quote = makeQuote({ quoteNumber: null });
      mockRepo.findById.mockResolvedValue(quote as never);
      mockPdfService.generateQuoteBuffer.mockResolvedValue(Buffer.from("") as never);

      const result = await quoteService.generatePdf("q1");

      expect(mockPdfService.generateQuoteBuffer).toHaveBeenCalledWith(
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
