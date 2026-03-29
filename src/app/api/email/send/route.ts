import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/domains/shared/auth";
import { sendEmail } from "@/lib/email";
import { escapeHtml } from "@/lib/html";

interface QuoteShareData {
  quoteNumber: string | null;
  recipientName: string | null;
  shareUrl: string;
}

interface QuoteResponseData {
  quoteNumber: string | null;
  recipientName: string | null;
  response: string;
  quoteDetailUrl: string;
}

function buildQuoteShareHtml(data: QuoteShareData): string {
  const name = data.recipientName ? ` ${escapeHtml(data.recipientName)}` : "";
  const quoteNum = escapeHtml(data.quoteNumber ?? "your quote");
  const url = escapeHtml(data.shareUrl);

  return `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #1a1a1a;">Quote from Los Angeles Pierce College</h2>
  <p>Hello${name},</p>
  <p>You have received a quote (<strong>${quoteNum}</strong>) from the Los Angeles Pierce College Bookstore.</p>
  <p>Please review and respond to the quote using the link below:</p>
  <p style="margin: 24px 0;">
    <a href="${url}" style="background-color: #16a34a; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">Review Quote</a>
  </p>
  <p style="color: #666; font-size: 14px;">Or copy this link: ${url}</p>
  <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 24px 0;" />
  <p style="color: #999; font-size: 12px;">Los Angeles Pierce College Bookstore</p>
</div>`;
}

function buildQuoteResponseHtml(data: QuoteResponseData): string {
  const quoteNum = escapeHtml(data.quoteNumber ?? "Quote");
  const name = data.recipientName ? ` by ${escapeHtml(data.recipientName)}` : "";
  const response = escapeHtml(data.response);
  const url = escapeHtml(data.quoteDetailUrl);

  return `<p>${quoteNum} was <strong>${response}</strong>${name}.</p><p><a href="${url}">View Quote</a></p>`;
}

export const POST = withAuth(async (req: NextRequest) => {
  const body = await req.json();
  const { type, to, data } = body as {
    type: string;
    to: string;
    data: Record<string, unknown>;
  };

  if (!type || !to || !data) {
    return NextResponse.json(
      { error: "type, to, and data are required" },
      { status: 400 }
    );
  }

  let subject: string;
  let html: string;

  switch (type) {
    case "quote-share": {
      const shareData = data as unknown as QuoteShareData;
      if (!shareData.shareUrl) {
        return NextResponse.json(
          { error: "data.shareUrl is required for quote-share" },
          { status: 400 }
        );
      }
      subject = `Quote ${shareData.quoteNumber ?? ""} from Los Angeles Pierce College`.trim();
      html = buildQuoteShareHtml(shareData);
      break;
    }
    case "quote-response": {
      const responseData = data as unknown as QuoteResponseData;
      if (!responseData.response || !responseData.quoteDetailUrl) {
        return NextResponse.json(
          { error: "data.response and data.quoteDetailUrl are required for quote-response" },
          { status: 400 }
        );
      }
      subject = `${responseData.quoteNumber ?? "Quote"} was ${responseData.response}`;
      html = buildQuoteResponseHtml(responseData);
      break;
    }
    default:
      return NextResponse.json(
        { error: `Unknown email type: ${type}` },
        { status: 400 }
      );
  }

  const success = await sendEmail(to, subject, html);
  if (!success) {
    return NextResponse.json({ error: "Failed to send email" }, { status: 502 });
  }
  return NextResponse.json({ success: true });
});
