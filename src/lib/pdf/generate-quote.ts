import { readFile } from "fs/promises";
import path from "path";
import { renderQuote, type QuotePDFData } from "./templates/quote";
import { renderHtmlToPdf } from "./puppeteer";

async function htmlToPdf(html: string): Promise<Buffer> {
  return renderHtmlToPdf(html);
}

export async function generateQuotePDF(
  data: Omit<QuotePDFData, "logoDataUri">
): Promise<Buffer> {
  const logoPath = path.join(process.cwd(), "public", "lapc-logo.png");
  const logoBuffer = await readFile(logoPath);
  const logoBase64 = logoBuffer.toString("base64");
  const logoDataUri = "data:image/png;base64," + logoBase64;

  const html = renderQuote({ ...data, logoDataUri });
  const pdfBuffer = await htmlToPdf(html);

  return pdfBuffer;
}
