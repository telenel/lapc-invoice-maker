// tests/domains/pdf/service.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/pdf/generate", () => ({
  generateInvoicePDF: vi.fn(),
}));

vi.mock("@/lib/pdf/generate-quote", () => ({
  generateQuotePDF: vi.fn(),
}));

vi.mock("@/lib/pdf/merge", () => ({
  mergePrismCorePDF: vi.fn(),
}));

vi.mock("@/domains/pdf/storage", () => ({
  pdfStorage: {
    read: vi.fn(),
    write: vi.fn(),
    safeDelete: vi.fn(),
  },
}));

import { generateInvoicePDF } from "@/lib/pdf/generate";
import { generateQuotePDF } from "@/lib/pdf/generate-quote";
import { mergePrismCorePDF } from "@/lib/pdf/merge";
import { pdfStorage } from "@/domains/pdf/storage";
import { pdfService } from "@/domains/pdf/service";
import type { GenerateInvoicePDFInput, QuotePDFData } from "@/domains/pdf/types";

const mockGenerateInvoicePDF = vi.mocked(generateInvoicePDF);
const mockGenerateQuotePDF = vi.mocked(generateQuotePDF);
const mockMergePrismCorePDF = vi.mocked(mergePrismCorePDF);
const mockStorage = vi.mocked(pdfStorage, true);

describe("pdfService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("generateInvoice", () => {
    it("calls generateInvoicePDF with quantity converted to string", async () => {
      mockGenerateInvoicePDF.mockResolvedValue(Buffer.from("invoice-pdf") as never);
      mockStorage.write.mockResolvedValue("invoices/inv1/INV-001.pdf" as never);

      const input: GenerateInvoicePDFInput = {
        coverSheet: {
          date: "2026-03-01",
          semesterYearDept: "Spring 2026 - IT",
          invoiceNumber: "INV-001",
          chargeAccountNumber: "1234",
          accountCode: "AC1",
          totalAmount: "500.00",
          signatures: [{ name: "Alice", title: "Director" }],
        },
        idp: {
          date: "2026-03-01",
          department: "IT",
          documentNumber: "DOC-001",
          requestingDept: "Library",
          sapAccount: "SAP-01",
          estimatedCost: "500.00",
          approverName: "Bob",
          contactName: "Carol",
          contactPhone: "555-1234",
          totalAmount: "500.00",
          items: [
            {
              description: "Projector rental",
              quantity: 2,
              unitPrice: "250.00",
              extendedPrice: "500.00",
            },
          ],
        },
      };

      const result = await pdfService.generateInvoice(
        input,
        "invoices/inv1/INV-001.pdf"
      );

      expect(mockGenerateInvoicePDF).toHaveBeenCalledOnce();
      const calledWith = mockGenerateInvoicePDF.mock.calls[0][0];
      expect(calledWith.idp.items[0].quantity).toBe("2");
      expect(mockStorage.write).toHaveBeenCalledWith(
        "invoices/inv1/INV-001.pdf",
        Buffer.from("invoice-pdf")
      );
      expect(result).toBe("invoices/inv1/INV-001.pdf");
    });
  });

  describe("mergePrismCore", () => {
    it("reads both documents, merges them, and writes the merged invoice", async () => {
      mockStorage.read
        .mockResolvedValueOnce(Buffer.from("invoice-bytes") as never)
        .mockResolvedValueOnce(Buffer.from("prismcore-bytes") as never);
      mockMergePrismCorePDF.mockResolvedValue(Buffer.from("merged-bytes") as never);
      mockStorage.write.mockResolvedValue("/data/pdfs/invoice.pdf" as never);

      await pdfService.mergePrismCore("/data/pdfs/invoice.pdf", "uploads/prismcore.pdf");

      expect(mockStorage.read).toHaveBeenNthCalledWith(1, "/data/pdfs/invoice.pdf");
      expect(mockStorage.read).toHaveBeenNthCalledWith(2, "uploads/prismcore.pdf");
      expect(mockMergePrismCorePDF).toHaveBeenCalledWith(
        Buffer.from("invoice-bytes"),
        Buffer.from("prismcore-bytes")
      );
      expect(mockStorage.write).toHaveBeenCalledWith(
        "/data/pdfs/invoice.pdf",
        Buffer.from("merged-bytes")
      );
    });
  });

  describe("generateQuote", () => {
    it("calls generateQuotePDF with unitPrice and extendedPrice converted to numbers", async () => {
      mockGenerateQuotePDF.mockResolvedValue(Buffer.from("quote-pdf") as never);
      mockStorage.write.mockResolvedValue("quotes/q1/Q-001.pdf" as never);

      const data: QuotePDFData = {
        quoteNumber: "Q-001",
        date: "2026-03-01",
        expirationDate: "2026-04-01",
        recipientName: "Dave",
        recipientEmail: "dave@test.com",
        recipientOrg: "LAPC",
        department: "IT",
        category: "AV",
        accountCode: "AC1",
        notes: "Please check",
        totalAmount: 750,
        marginEnabled: false,
        taxEnabled: false,
        taxRate: 0.0975,
        isCateringEvent: false,
        cateringDetails: null,
        items: [
          {
            description: "Camera rental",
            quantity: 3,
            unitPrice: "250.00",
            extendedPrice: "750.00",
            isTaxable: true,
            costPrice: null,
          },
        ],
      };

      const result = await pdfService.generateQuote(data, "quotes/q1/Q-001.pdf");

      expect(mockGenerateQuotePDF).toHaveBeenCalledOnce();
      const calledWith = mockGenerateQuotePDF.mock.calls[0][0];
      expect(calledWith.items[0].unitPrice).toBe(250);
      expect(calledWith.items[0].extendedPrice).toBe(750);
      expect(mockStorage.write).toHaveBeenCalledWith(
        "quotes/q1/Q-001.pdf",
        Buffer.from("quote-pdf")
      );
      expect(result).toBe("quotes/q1/Q-001.pdf");
    });

    it("can render a quote buffer without writing to storage", async () => {
      mockGenerateQuotePDF.mockResolvedValue(Buffer.from("quote-pdf") as never);

      const data: QuotePDFData = {
        quoteNumber: "Q-001",
        date: "2026-03-01",
        expirationDate: "2026-04-01",
        recipientName: "Dave",
        recipientEmail: "dave@test.com",
        recipientOrg: "LAPC",
        department: "IT",
        category: "AV",
        accountCode: "AC1",
        notes: "Please check",
        totalAmount: 750,
        marginEnabled: false,
        taxEnabled: false,
        taxRate: 0.0975,
        isCateringEvent: false,
        cateringDetails: null,
        items: [
          {
            description: "Camera rental",
            quantity: 3,
            unitPrice: "250.00",
            extendedPrice: "750.00",
            isTaxable: true,
            costPrice: null,
          },
        ],
      };

      const result = await pdfService.generateQuoteBuffer(data);

      expect(mockGenerateQuotePDF).toHaveBeenCalledOnce();
      expect(result).toEqual(Buffer.from("quote-pdf"));
      expect(mockStorage.write).not.toHaveBeenCalled();
    });
  });

  describe("readPdf", () => {
    it("delegates to pdfStorage.read with the absolute path", async () => {
      const mockBuffer = Buffer.from("pdf content");
      mockStorage.read.mockResolvedValue(mockBuffer as never);

      const result = await pdfService.readPdf("/data/pdfs/invoice.pdf");

      expect(mockStorage.read).toHaveBeenCalledWith("/data/pdfs/invoice.pdf");
      expect(result).toBe(mockBuffer);
    });
  });

  describe("deletePdfFiles", () => {
    it("calls safeDelete for pdfPath when provided", async () => {
      mockStorage.safeDelete.mockResolvedValue(undefined as never);

      await pdfService.deletePdfFiles("/data/pdfs/invoice.pdf", null);

      expect(mockStorage.safeDelete).toHaveBeenCalledWith("/data/pdfs/invoice.pdf");
    });

    it("deletes the stored PrismCore object key when provided", async () => {
      mockStorage.safeDelete.mockResolvedValue(undefined as never);

      await pdfService.deletePdfFiles(null, "uploads/prismcore.pdf");

      expect(mockStorage.safeDelete).toHaveBeenCalledWith("uploads/prismcore.pdf");
    });

    it("handles null paths gracefully without calling safeDelete", async () => {
      await pdfService.deletePdfFiles(null, null);

      expect(mockStorage.safeDelete).not.toHaveBeenCalled();
    });
  });
});
