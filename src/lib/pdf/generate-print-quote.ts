import { renderPrintQuote, type PrintQuotePdfData } from "./templates/print-quote";
import { renderHtmlToPdf } from "./puppeteer";

async function htmlToPdf(html: string): Promise<Buffer> {
  return renderHtmlToPdf(html);
}

export async function generatePrintQuotePdf(
  data: PrintQuotePdfData
): Promise<Buffer> {
  const html = renderPrintQuote(data);
  return htmlToPdf(html);
}
