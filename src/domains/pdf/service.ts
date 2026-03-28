import { generateInvoicePDF, type GenerateInvoicePDFData } from "@/lib/pdf/generate";
import { generateQuotePDF } from "@/lib/pdf/generate-quote";
import { mergePrismCorePDF } from "@/lib/pdf/merge";
import { pdfStorage } from "./storage";
import type { GenerateInvoicePDFInput, QuotePDFData } from "./types";

export const pdfService = {
  async generateInvoice(input: GenerateInvoicePDFInput): Promise<string> {
    // Bridge: domain IDPOverlayData has quantity: number, but lib expects quantity: string
    const adapted: GenerateInvoicePDFData = {
      coverSheet: input.coverSheet,
      idp: {
        ...input.idp,
        items: input.idp.items.map((item) => ({
          ...item,
          quantity: String(item.quantity),
        })),
      },
    };
    return generateInvoicePDF(adapted);
  },

  async mergePrismCore(invoicePdfPath: string, prismcoreRelativePath: string): Promise<void> {
    return mergePrismCorePDF(invoicePdfPath, prismcoreRelativePath);
  },

  async generateQuote(data: QuotePDFData): Promise<string> {
    // Bridge: domain QuotePDFData has unitPrice/extendedPrice as strings,
    // but the quote template expects numbers. Convert here.
    const adapted = {
      ...data,
      items: data.items.map((item) => ({
        ...item,
        unitPrice: Number(item.unitPrice),
        extendedPrice: Number(item.extendedPrice),
      })),
    };
    return generateQuotePDF(adapted);
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
