import { pdfStorage } from "@/domains/pdf/storage";
import { renderPrintQuote, type PrintQuotePdfData } from "./templates/print-quote";
import { renderHtmlToPdf } from "./puppeteer";

async function htmlToPdf(html: string): Promise<Buffer> {
  return renderHtmlToPdf(html);
}

export async function generatePrintQuotePdf(data: PrintQuotePdfData): Promise<string> {
  const html = renderPrintQuote(data);
  const pdfBuffer = await htmlToPdf(html);

  await pdfStorage.ensureDir();
  const filePath = pdfStorage.pathFor(`${data.quoteNumber}.pdf`);
  await pdfStorage.write(filePath, pdfBuffer);

  return filePath;
}
