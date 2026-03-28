import puppeteer from "puppeteer";
import { mkdir, writeFile, readFile } from "fs/promises";
import path from "path";
import { renderQuote, type QuotePDFData } from "./templates/quote";

async function htmlToPdf(html: string): Promise<Buffer> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
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
    const pdfBuffer = await page.pdf({
      format: "Letter",
      printBackground: true,
    });
    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}

export async function generateQuotePDF(
  data: Omit<QuotePDFData, "logoDataUri">
): Promise<string> {
  const logoPath = path.join(process.cwd(), "public", "lapc-logo.png");
  const logoBuffer = await readFile(logoPath);
  const logoBase64 = logoBuffer.toString("base64");
  const logoDataUri = "data:image/png;base64," + logoBase64;

  const html = renderQuote({ ...data, logoDataUri });
  const pdfBuffer = await htmlToPdf(html);

  const pdfDir = path.join(process.cwd(), "data", "pdfs");
  await mkdir(pdfDir, { recursive: true });

  const filename = `${data.quoteNumber}.pdf`;
  const filePath = path.join(pdfDir, filename);
  await writeFile(filePath, pdfBuffer);

  return filePath;
}
