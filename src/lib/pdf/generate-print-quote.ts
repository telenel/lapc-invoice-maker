import puppeteer from "puppeteer";
import { pdfStorage } from "@/domains/pdf/storage";
import { renderPrintQuote, type PrintQuotePdfData } from "./templates/print-quote";

async function htmlToPdf(html: string): Promise<Buffer> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();

    await page.setRequestInterception(true);
    page.on("request", (request) => {
      const url = request.url();
      if (url.startsWith("data:") || url.startsWith("file:")) {
        request.continue();
      } else {
        request.abort();
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

export async function generatePrintQuotePdf(data: PrintQuotePdfData): Promise<string> {
  const html = renderPrintQuote(data);
  const pdfBuffer = await htmlToPdf(html);

  await pdfStorage.ensureDir();
  const filePath = pdfStorage.pathFor(`${data.quoteNumber}.pdf`);
  await pdfStorage.write(filePath, pdfBuffer);

  return filePath;
}
