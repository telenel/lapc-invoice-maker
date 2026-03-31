import { prisma } from "@/lib/prisma";
import { sendEmail, type EmailAttachment } from "@/lib/email";
import { escapeHtml } from "@/lib/html";
import { businessDaysBetween } from "@/lib/date-utils";
import { safePublishAll } from "@/lib/sse";

const FOLLOW_UP_INTERVAL_BUSINESS_DAYS = 7;
const PAYMENT_FOLLOW_UP_LOCK_KEY = 318742;
const PAYMENT_REMINDER_CLAIM = "PAYMENT_REMINDER_CLAIM";
const PAYMENT_REMINDER_CLAIM_TTL_MINUTES = 30;

function startOfDay(date: Date): Date {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

async function claimPaymentFollowUp(quoteId: string, now: Date) {
  return prisma.$transaction(async (tx) => {
    const lockedQuotes = await tx.$queryRaw<Array<{
      id: string;
      quoteNumber: string | null;
      quoteStatus: string | null;
      recipientName: string | null;
      recipientEmail: string | null;
      shareToken: string | null;
      acceptedAt: Date | null;
      updatedAt: Date;
      paymentMethod: string | null;
      createdBy: string;
    }>>`
      SELECT
        id,
        quote_number AS "quoteNumber",
        quote_status AS "quoteStatus",
        recipient_name AS "recipientName",
        recipient_email AS "recipientEmail",
        share_token AS "shareToken",
        accepted_at AS "acceptedAt",
        updated_at AS "updatedAt",
        payment_method AS "paymentMethod",
        created_by AS "createdBy"
      FROM invoices
      WHERE id = ${quoteId}
      FOR UPDATE
    `;

    const quote = lockedQuotes[0];
    if (
      !quote ||
      quote.quoteStatus !== "ACCEPTED" ||
      quote.paymentMethod ||
      !quote.recipientEmail ||
      !quote.shareToken
    ) {
      return null;
    }

    const convertedInvoice = await tx.invoice.findFirst({
      where: { convertedFromQuoteId: quoteId },
      select: { status: true, createdBy: true },
    });
    if (convertedInvoice?.status === "FINAL") {
      return null;
    }

    const staleClaimThreshold = new Date(now.getTime() - PAYMENT_REMINDER_CLAIM_TTL_MINUTES * 60 * 1000);
    const activeClaim = await tx.quoteFollowUp.findFirst({
      where: {
        invoiceId: quoteId,
        type: PAYMENT_REMINDER_CLAIM,
        sentAt: { gte: staleClaimThreshold },
      },
      orderBy: { sentAt: "desc" },
    });
    if (activeClaim) {
      return null;
    }

    await tx.quoteFollowUp.deleteMany({
      where: {
        invoiceId: quoteId,
        type: PAYMENT_REMINDER_CLAIM,
        sentAt: { lt: staleClaimThreshold },
      },
    });

    const lastFollowUp = await tx.quoteFollowUp.findFirst({
      where: { invoiceId: quoteId, type: "PAYMENT_REMINDER" },
      orderBy: { sentAt: "desc" },
    });
    const referenceDate = lastFollowUp ? lastFollowUp.sentAt : (quote.acceptedAt ?? quote.updatedAt);
    const daysSince = businessDaysBetween(startOfDay(referenceDate), startOfDay(now));
    if (daysSince < FOLLOW_UP_INTERVAL_BUSINESS_DAYS) {
      return null;
    }

    const attemptNumber = await tx.quoteFollowUp.count({
      where: { invoiceId: quoteId, type: "PAYMENT_REMINDER" },
    }) + 1;
    const quoteNum = quote.quoteNumber ?? "your quote";
    const subject = `Payment details needed — ${quoteNum}`;
    const followUp = await tx.quoteFollowUp.create({
      data: {
        invoiceId: quote.id,
        type: PAYMENT_REMINDER_CLAIM,
        recipientEmail: quote.recipientEmail,
        subject,
        metadata: { attempt: attemptNumber },
      },
    });

    return {
      creatorId: convertedInvoice?.createdBy ?? quote.createdBy,
      followUpId: followUp.id,
      quoteId: quote.id,
      quoteNum,
      recipientEmail: quote.recipientEmail,
      recipientName: quote.recipientName,
      shareToken: quote.shareToken,
      attemptNumber,
      subject,
    };
  });
}

/**
 * Find ACCEPTED quotes with incomplete payment info and send reminders
 * if enough business days have passed since the last follow-up (or acceptance).
 */
export async function checkAndSendPaymentFollowUps(): Promise<void> {
  const now = new Date();
  const candidates = await prisma.$transaction(async (tx) => {
    const result = await tx.$queryRaw<Array<{ acquired: boolean }>>`
      SELECT pg_try_advisory_xact_lock(${PAYMENT_FOLLOW_UP_LOCK_KEY}) AS acquired
    `;
    if (result[0]?.acquired !== true) return [];

    // Find quotes that are ACCEPTED, have type QUOTE, and no paymentMethod
    return tx.invoice.findMany({
      where: {
        type: "QUOTE",
        quoteStatus: "ACCEPTED",
        paymentMethod: null,
        shareToken: { not: null },
        OR: [
          { convertedToInvoice: null },
          { convertedToInvoice: { is: { status: { not: "FINAL" } } } },
        ],
      },
      include: {
        followUps: {
          where: { type: "PAYMENT_REMINDER" },
          orderBy: { sentAt: "desc" },
          take: 1,
        },
        creator: { select: { id: true, name: true } },
      },
    });
  });
  const appUrl = process.env.NEXTAUTH_URL ?? "https://laportal.montalvo.io";

  for (const quote of candidates) {
    const lastFollowUp = quote.followUps[0];
    const referenceDate = lastFollowUp ? lastFollowUp.sentAt : (quote.acceptedAt ?? quote.updatedAt);
    const daysSince = businessDaysBetween(startOfDay(referenceDate), startOfDay(now));

    if (daysSince < FOLLOW_UP_INTERVAL_BUSINESS_DAYS || !quote.recipientEmail || !quote.shareToken) {
      continue;
    }

    const claim = await claimPaymentFollowUp(quote.id, now);
    if (!claim) continue;

    const paymentUrl = `${appUrl}/quotes/payment/${claim.shareToken}`;
    const html = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #1a1a1a;">Payment Details Needed</h2>
  <p>Hello${claim.recipientName ? ` ${escapeHtml(claim.recipientName)}` : ""},</p>
  <p>You approved quote <strong>${escapeHtml(claim.quoteNum)}</strong>, but we still need your payment information to process the order.</p>
  <p style="margin: 24px 0;">
    <a href="${escapeHtml(paymentUrl)}" style="background-color: #16a34a; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">Provide Payment Details</a>
  </p>
  <p style="color: #666; font-size: 14px;">Or copy this link: ${escapeHtml(paymentUrl)}</p>
  <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 24px 0;" />
  <p style="color: #999; font-size: 12px;">Los Angeles Pierce College Bookstore</p>
</div>`;

    let attachments: EmailAttachment[] | undefined;
    try {
      const { quoteService } = await import("./service");
      const { buffer, filename } = await quoteService.generatePdf(claim.quoteId);
      const safeName = (filename ?? "quote").replace(/[^a-zA-Z0-9\-]/g, "-");
      attachments = [{ Name: `Quote-${safeName}.pdf`, ContentBytes: buffer.toString("base64") }];
    } catch {
      // PDF is non-critical for follow-up
    }

    const sent = await sendEmail(claim.recipientEmail, claim.subject, html, attachments);
    if (!sent) {
      await prisma.quoteFollowUp.delete({ where: { id: claim.followUpId } }).catch(() => {});
      continue;
    }

    await prisma.quoteFollowUp.update({
      where: { id: claim.followUpId },
      data: { type: "PAYMENT_REMINDER" },
    });

    try {
      const { notificationService } = await import("@/domains/notification/service");
      await notificationService.createAndPublish({
        userId: claim.creatorId,
        type: "PAYMENT_FOLLOWUP_SENT",
        title: `Payment reminder sent for ${claim.quoteNum}`,
        message: `Reminder #${claim.attemptNumber} sent to ${claim.recipientEmail}`,
        quoteId: claim.quoteId,
      });
    } catch {
      // Non-critical
    }

    safePublishAll({ type: "quote-changed" });
  }
}
