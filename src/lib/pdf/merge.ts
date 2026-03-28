import { PDFDocument } from "pdf-lib";
import { readFile, writeFile } from "fs/promises";
import path from "path";

/**
 * Merges PrismCore PDF pages into the invoice PDF, inserting them
 * after page 1 (the cover sheet) so the order is:
 *   1. Cover Sheet
 *   2..N. PrismCore pages
 *   N+1. IDP
 */
export async function mergePrismCorePDF(
  invoicePdfPath: string,
  prismcoreRelativePath: string
): Promise<void> {
  const prismcoreAbsPath = path.join(process.cwd(), "public", prismcoreRelativePath);

  // Validate path to prevent directory traversal
  const uploadsDir = path.resolve(process.cwd(), "public", "uploads");
  const resolved = path.resolve(process.cwd(), "public", prismcoreRelativePath);
  if (!resolved.startsWith(uploadsDir)) {
    throw new Error("Invalid prismcore path");
  }

  const [invoiceBytes, prismcoreBytes] = await Promise.all([
    readFile(invoicePdfPath),
    readFile(prismcoreAbsPath),
  ]);

  const invoiceDoc = await PDFDocument.load(invoiceBytes);
  const prismcoreDoc = await PDFDocument.load(prismcoreBytes);

  const prismcorePageCount = prismcoreDoc.getPageCount();
  if (prismcorePageCount === 0) return;

  const copiedPages = await invoiceDoc.copyPages(
    prismcoreDoc,
    Array.from({ length: prismcorePageCount }, (_, i) => i)
  );

  // Insert after page 1 (index 1) — pushes IDP to the end
  for (let i = 0; i < copiedPages.length; i++) {
    invoiceDoc.insertPage(1 + i, copiedPages[i]);
  }

  const mergedBytes = await invoiceDoc.save();
  await writeFile(invoicePdfPath, mergedBytes);
}
