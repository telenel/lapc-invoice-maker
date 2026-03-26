import puppeteer from "puppeteer";
import { PDFDocument } from "pdf-lib";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { renderCoverSheet, type CoverSheetData } from "./templates/cover-sheet";
import { renderIDP, type IDPData } from "./templates/idp";

export interface GenerateInvoicePDFData {
  coverSheet: CoverSheetData;
  idp: IDPData;
}

async function htmlToPdf(html: string): Promise<Buffer> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });

    const pdfBuffer = await page.pdf({
      format: "Letter",
      printBackground: true,
    });

    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}

/**
 * Generates a combined PDF with CoverSheet (page 1) and IDP (page 2).
 * Returns the absolute file path to the saved PDF.
 */
export async function generateInvoicePDF(
  data: GenerateInvoicePDFData
): Promise<string> {
  const coverSheetHtml = renderCoverSheet(data.coverSheet);
  const idpHtml = renderIDP(data.idp);

  // Generate both pages as separate PDFs
  const [coverSheetPdf, idpPdf] = await Promise.all([
    htmlToPdf(coverSheetHtml),
    htmlToPdf(idpHtml),
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
