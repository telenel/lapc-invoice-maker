import puppeteer from "puppeteer";
import { PDFDocument } from "pdf-lib";
import { mkdir, writeFile, readFile } from "fs/promises";
import path from "path";
import { renderCoverSheet, type CoverSheetData } from "./templates/cover-sheet";
import { generateIDPPage, type IDPOverlayData } from "./generate-idp";

// Re-export for backwards compat
export type IDPData = IDPOverlayData;

export interface GenerateInvoicePDFData {
  coverSheet: Omit<CoverSheetData, "logoDataUri">;
  idp: IDPOverlayData;
}

async function htmlToPdf(
  html: string,
  options?: { landscape?: boolean }
): Promise<Buffer> {
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
    ],
  });

  try {
    const page = await browser.newPage();

    await page.setRequestInterception(true);
    page.on("request", (req) => {
      const url = req.url();
      if (url.startsWith("data:") || url.startsWith("file:")) {
        req.continue();
      } else {
        req.abort();
      }
    });

    await page.setContent(html, { waitUntil: "domcontentloaded" });

    const pdfOptions: Parameters<typeof page.pdf>[0] = {
      printBackground: true,
    };

    if (options?.landscape) {
      pdfOptions.width = "11in";
      pdfOptions.height = "8.5in";
    } else {
      pdfOptions.format = "Letter";
    }

    const pdfBuffer = await page.pdf(pdfOptions);

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
