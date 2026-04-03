import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/document-storage", () => ({
  downloadDocument: vi.fn(),
  uploadDocument: vi.fn(),
  removeDocument: vi.fn(),
  invoicePdfObjectKey: vi.fn((invoiceId: string, invoiceNumber: string) => `invoices/${invoiceId}/${invoiceNumber}.pdf`),
  quotePdfObjectKey: vi.fn((quoteId: string, quoteNumber: string) => `quotes/${quoteId}/${quoteNumber}.pdf`),
  printQuotePdfObjectKey: vi.fn((quoteId: string, quoteNumber: string) => `print-quotes/${quoteId}/${quoteNumber}.pdf`),
  uploadPdfObjectKey: vi.fn((filename: string) => `uploads/${filename}`),
}));

import {
  downloadDocument,
  invoicePdfObjectKey,
  printQuotePdfObjectKey,
  quotePdfObjectKey,
  removeDocument,
  uploadDocument,
  uploadPdfObjectKey,
} from "@/lib/document-storage";
import { pdfStorage } from "@/domains/pdf/storage";

const mockDownloadDocument = vi.mocked(downloadDocument);
const mockUploadDocument = vi.mocked(uploadDocument);
const mockRemoveDocument = vi.mocked(removeDocument);
const mockInvoicePdfObjectKey = vi.mocked(invoicePdfObjectKey);
const mockQuotePdfObjectKey = vi.mocked(quotePdfObjectKey);
const mockPrintQuotePdfObjectKey = vi.mocked(printQuotePdfObjectKey);
const mockUploadPdfObjectKey = vi.mocked(uploadPdfObjectKey);

describe("pdfStorage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reads a PDF object and returns buffer", async () => {
    mockDownloadDocument.mockResolvedValue(Buffer.from("fake-pdf"));

    const buf = await pdfStorage.read("quotes/q1/Q-001.pdf");

    expect(mockDownloadDocument).toHaveBeenCalledWith("quotes/q1/Q-001.pdf");
    expect(buf.toString()).toBe("fake-pdf");
  });

  it("writes a PDF object and returns the object key", async () => {
    mockUploadDocument.mockResolvedValue("quotes/q1/Q-001.pdf");

    const key = await pdfStorage.write("quotes/q1/Q-001.pdf", Buffer.from("pdf"));

    expect(mockUploadDocument).toHaveBeenCalledWith("quotes/q1/Q-001.pdf", Buffer.from("pdf"));
    expect(key).toBe("quotes/q1/Q-001.pdf");
  });

  it("deletes objects safely", async () => {
    mockRemoveDocument.mockResolvedValue(undefined);

    await pdfStorage.delete("uploads/file.pdf");
    await pdfStorage.safeDelete("uploads/file.pdf");

    expect(mockRemoveDocument).toHaveBeenCalledTimes(2);
    expect(mockRemoveDocument).toHaveBeenCalledWith("uploads/file.pdf");
  });

  it("builds expected storage object keys", () => {
    expect(pdfStorage.invoiceKey("inv1", "AG-001")).toBe("invoices/inv1/AG-001.pdf");
    expect(pdfStorage.quoteKey("q1", "Q-001")).toBe("quotes/q1/Q-001.pdf");
    expect(pdfStorage.printQuoteKey("pq1", "PSQ-001")).toBe("print-quotes/pq1/PSQ-001.pdf");
    expect(pdfStorage.uploadKey("file.pdf")).toBe("uploads/file.pdf");

    expect(mockInvoicePdfObjectKey).toHaveBeenCalledWith("inv1", "AG-001");
    expect(mockQuotePdfObjectKey).toHaveBeenCalledWith("q1", "Q-001");
    expect(mockPrintQuotePdfObjectKey).toHaveBeenCalledWith("pq1", "PSQ-001");
    expect(mockUploadPdfObjectKey).toHaveBeenCalledWith("file.pdf");
  });
});
