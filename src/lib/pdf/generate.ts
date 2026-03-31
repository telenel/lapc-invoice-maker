import { PDFDocument } from "pdf-lib";
import { mkdir, writeFile, readFile } from "fs/promises";
import path from "path";
import { renderCoverSheet, type CoverSheetData } from "./templates/cover-sheet";
import { generateIDPPage, type IDPOverlayData } from "./generate-idp";
import { renderHtmlToPdf } from "./puppeteer";

// Re-export for backwards compat
export type IDPData = IDPOverlayData;

export interface GenerateInvoicePDFData {
  coverSheet: Omit<CoverSheetData, "logoDataUri">;
  idp: IDPOverlayData;
}

async function htmlToPdf(html: string): Promise<Buffer> {
  return renderHtmlToPdf(html);
}

/**
 * Generates a combined PDF with CoverSheet (page 1) and IDP (page 2).
 * Returns the absolute file path to the saved PDF.
 */
export async function generateInvoicePDF(
  data: GenerateInvoicePDFData
): Promise<string> {
  // Read logo and convert to base64 data URI
  const logoPath = path.join(process.cwd(), "public", "lapc-logo.png");
  const logoBuffer = await readFile(logoPath);
  const logoBase64 = logoBuffer.toString("base64");
  const logoDataUri = "data:image/png;base64," + logoBase64;

  const coverSheetHtml = renderCoverSheet({ ...data.coverSheet, logoDataUri });

  // Generate cover sheet via Puppeteer, IDP via template overlay
  const [coverSheetPdf, idpPdf] = await Promise.all([
    htmlToPdf(coverSheetHtml),
    generateIDPPage(data.idp),
  ]);

  // Merge into one PDF using pdf-lib
  const mergedDoc = await PDFDocument.create();

  const coverDoc = await PDFDocument.load(coverSheetPdf);
  const idpDoc = await PDFDocument.load(idpPdf);

  const [coverPage] = await mergedDoc.copyPages(coverDoc, [0]);
  mergedDoc.addPage(coverPage);

  const idpPageCount = idpDoc.getPageCount();
  const idpPages = await mergedDoc.copyPages(
    idpDoc,
    Array.from({ length: idpPageCount }, (_, i) => i)
  );
  for (const p of idpPages) {
    mergedDoc.addPage(p);
  }

  const mergedBytes = await mergedDoc.save();

  // Save to data/pdfs directory
  const pdfDir = path.join(process.cwd(), "data", "pdfs");
  await mkdir(pdfDir, { recursive: true });

  const filename = `${data.coverSheet.invoiceNumber}.pdf`;
  const filePath = path.join(pdfDir, filename);
  await writeFile(filePath, mergedBytes);

  return filePath;
}
