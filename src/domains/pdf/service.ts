import { generateInvoicePDF, type GenerateInvoicePDFData } from "@/lib/pdf/generate";
import { generateQuotePDF } from "@/lib/pdf/generate-quote";
import { mergePrismCorePDF } from "@/lib/pdf/merge";
import { pdfStorage } from "./storage";
import type { GenerateInvoicePDFInput, QuotePDFData } from "./types";

function adaptQuotePdfData(data: QuotePDFData) {
  return {
    ...data,
    items: data.items.map((item) => ({
      ...item,
      unitPrice: Number(item.unitPrice),
      extendedPrice: Number(item.extendedPrice),
      costPrice: item.costPrice != null ? Number(item.costPrice) : null,
    })),
  };
}

export const pdfService = {
  async generateInvoice(
    input: GenerateInvoicePDFInput,
    objectKey: string
  ): Promise<string> {
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
    const pdfBuffer = await generateInvoicePDF(adapted);
    return pdfStorage.write(objectKey, pdfBuffer);
  },

  async mergePrismCore(invoicePdfPath: string, prismcorePath: string): Promise<void> {
    const [invoiceBytes, prismcoreBytes] = await Promise.all([
      pdfStorage.read(invoicePdfPath),
      pdfStorage.read(prismcorePath),
    ]);
    const mergedPdf = await mergePrismCorePDF(invoiceBytes, prismcoreBytes);
    await pdfStorage.write(invoicePdfPath, mergedPdf);
  },

  async generateQuote(data: QuotePDFData, objectKey: string): Promise<string> {
    const pdfBuffer = await this.generateQuoteBuffer(data);
    return pdfStorage.write(objectKey, pdfBuffer);
  },

  async generateQuoteBuffer(data: QuotePDFData): Promise<Buffer> {
    return generateQuotePDF(adaptQuotePdfData(data));
  },

  async readPdf(objectKey: string): Promise<Buffer> {
    return pdfStorage.read(objectKey);
  },

  async deletePdfFiles(pdfPath: string | null, prismcorePath: string | null): Promise<void> {
    if (pdfPath) await pdfStorage.safeDelete(pdfPath);
    if (prismcorePath) await pdfStorage.safeDelete(prismcorePath);
  },
};
