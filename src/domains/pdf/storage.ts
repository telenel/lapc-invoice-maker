import {
  downloadDocument,
  invoicePdfObjectKey,
  printQuotePdfObjectKey,
  quotePdfObjectKey,
  removeDocument,
  uploadDocument,
  uploadPdfObjectKey,
} from "@/lib/document-storage";

export const pdfStorage = {
  quoteKey(quoteId: string, quoteNumber: string): string {
    return quotePdfObjectKey(quoteId, quoteNumber);
  },

  invoiceKey(invoiceId: string, invoiceNumber: string): string {
    return invoicePdfObjectKey(invoiceId, invoiceNumber);
  },

  printQuoteKey(quoteId: string, quoteNumber: string): string {
    return printQuotePdfObjectKey(quoteId, quoteNumber);
  },

  uploadKey(filename: string): string {
    return uploadPdfObjectKey(filename);
  },

  async read(objectKey: string): Promise<Buffer> {
    return downloadDocument(objectKey);
  },

  async write(objectKey: string, data: Buffer): Promise<string> {
    return uploadDocument(objectKey, data);
  },

  async delete(objectKey: string): Promise<void> {
    await removeDocument(objectKey);
  },

  async safeDelete(objectKey: string): Promise<void> {
    try {
      await removeDocument(objectKey);
    } catch {
      // File may not exist
    }
  },
};
