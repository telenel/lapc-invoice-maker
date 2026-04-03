import { PDFDocument } from "pdf-lib";

/**
 * Merges PrismCore PDF pages into the invoice PDF, inserting them
 * after page 1 (the cover sheet) so the order is:
 *   1. Cover Sheet
 *   2..N. PrismCore pages
 *   N+1. IDP
 */
export async function mergePrismCorePDF(
  invoiceBytes: Buffer,
  prismcoreBytes: Buffer
): Promise<Buffer> {
  const invoiceDoc = await PDFDocument.load(invoiceBytes);
  const prismcoreDoc = await PDFDocument.load(prismcoreBytes);

  const prismcorePageCount = prismcoreDoc.getPageCount();
  if (prismcorePageCount === 0) return invoiceBytes;

  const copiedPages = await invoiceDoc.copyPages(
    prismcoreDoc,
    Array.from({ length: prismcorePageCount }, (_, i) => i)
  );

  // Insert after page 1 (index 1) — pushes IDP to the end
  for (let i = 0; i < copiedPages.length; i++) {
    invoiceDoc.insertPage(1 + i, copiedPages[i]);
  }

  const mergedBytes = await invoiceDoc.save();
  return Buffer.from(mergedBytes);
}
