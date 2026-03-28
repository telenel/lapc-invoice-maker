import { generateInvoicePDF } from "@/lib/pdf/generate";
import { generateQuotePDF } from "@/lib/pdf/generate-quote";
import { mergePrismCorePDF } from "@/lib/pdf/merge";
import { pdfStorage } from "./storage";
import type { GenerateInvoicePDFInput, QuotePDFData } from "./types";

export const pdfService = {
  async generateInvoice(input: GenerateInvoicePDFInput): Promise<string> {
    return generateInvoicePDF(input);
  },

  async mergePrismCore(invoicePdfPath: string, prismcoreRelativePath: string): Promise<void> {
    return mergePrismCorePDF(invoicePdfPath, prismcoreRelativePath);
  },

  async generateQuote(data: QuotePDFData): Promise<string> {
    return generateQuotePDF(data);
  },

  async readPdf(absolutePath: string): Promise<Buffer> {
    return pdfStorage.read(absolutePath);
  },

  async deletePdfFiles(pdfPath: string | null, prismcorePath: string | null): Promise<void> {
    if (pdfPath) await pdfStorage.safeDelete(pdfPath);
    if (prismcorePath) {
      const absPath = pdfStorage.resolvePublicPath(prismcorePath);
      await pdfStorage.safeDelete(absPath);
    }
  },
};
