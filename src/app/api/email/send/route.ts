import { NextRequest, NextResponse } from "next/server";
import { withAuth, forbiddenResponse } from "@/domains/shared/auth";
import { sendEmail, type EmailAttachment } from "@/lib/email";
import { escapeHtml } from "@/lib/html";
import { quoteService } from "@/domains/quote/service";

interface QuoteShareData {
  quoteNumber: string | null;
  recipientName: string | null;
  shareUrl: string;
  quoteId?: string;
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

export const POST = withAuth(async (req: NextRequest, session) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { type, to, data } = body as {
    type?: unknown;
    to?: unknown;
    data?: unknown;
  };

  if (
    typeof type !== "string" ||
    typeof to !== "string" ||
    !data ||
    typeof data !== "object" ||
    Array.isArray(data)
  ) {
    return NextResponse.json(
      { error: "type, to, and data are required" },
      { status: 400 }
    );
  }

  let subject: string;
  let html: string;
  let attachments: EmailAttachment[] | undefined;

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

      // Attach PDF if quoteId is provided
      if (shareData.quoteId) {
        const quote = await quoteService.getById(shareData.quoteId);
        if (!quote) {
          return NextResponse.json({ error: "Quote not found" }, { status: 404 });
        }
        if (session.user.role !== "admin" && quote.creatorId !== session.user.id) {
          return forbiddenResponse();
        }

        try {
          const { buffer, filename } = await quoteService.generatePdf(shareData.quoteId, {
            includePublicShareLink: true,
          });
          const safeName = (filename ?? "quote").replace(/[^a-zA-Z0-9\-]/g, "-");
          attachments = [{
            Name: `Quote-${safeName}.pdf`,
            ContentBytes: buffer.toString("base64"),
          }];
        } catch (err) {
          console.warn("Failed to generate PDF for email attachment:", err);
          // Continue without attachment — email is more important
        }
      }
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

  const success = await sendEmail(to, subject, html, attachments);
  if (!success) {
    return NextResponse.json(
      {
        error: "Failed to send email",
        detail: !process.env.POWER_AUTOMATE_EMAIL_URL ? "not_configured" : "webhook_rejected",
        recipient: to,
      },
      { status: 502 }
    );
  }
  return NextResponse.json({
    success: true,
    recipient: to,
    timestamp: new Date().toISOString(),
  });
});
