import { prisma } from "@/lib/prisma";
import { sendEmail, type EmailAttachment } from "@/lib/email";
import { escapeHtml } from "@/lib/html";
import { businessDaysBetween } from "@/lib/date-utils";

const FOLLOW_UP_INTERVAL_BUSINESS_DAYS = 7;
const PAYMENT_FOLLOW_UP_LOCK_KEY = 318742;

async function acquirePaymentFollowUpLock(): Promise<boolean> {
  const result = await prisma.$queryRaw<Array<{ acquired: boolean }>>`
    SELECT pg_try_advisory_lock(${PAYMENT_FOLLOW_UP_LOCK_KEY}) AS acquired
  `;

  return result[0]?.acquired === true;
}

async function releasePaymentFollowUpLock(): Promise<void> {
  await prisma.$queryRaw`
    SELECT pg_advisory_unlock(${PAYMENT_FOLLOW_UP_LOCK_KEY})
  `;
}

/**
 * Find ACCEPTED quotes with incomplete payment info and send reminders
 * if enough business days have passed since the last follow-up (or acceptance).
 */
export async function checkAndSendPaymentFollowUps(): Promise<void> {
  const lockAcquired = await acquirePaymentFollowUpLock();
  if (!lockAcquired) return;

  const now = new Date();
  try {
    // Find quotes that are ACCEPTED, have type QUOTE, and no paymentMethod
    const candidates = await prisma.invoice.findMany({
      where: {
        type: "QUOTE",
        quoteStatus: "ACCEPTED",
        paymentMethod: null,
        convertedToInvoice: null, // not already converted
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

    const appUrl = process.env.NEXTAUTH_URL ?? "https://laportal.montalvo.io";

    for (const quote of candidates) {
      // Determine the reference date — last follow-up or updatedAt (acceptance time)
      const lastFollowUp = quote.followUps[0];
      const referenceDate = lastFollowUp ? lastFollowUp.sentAt : quote.updatedAt;
      const daysSince = businessDaysBetween(referenceDate, now);

      if (daysSince < FOLLOW_UP_INTERVAL_BUSINESS_DAYS) continue;

      const recipientEmail = quote.recipientEmail;
      if (!recipientEmail) continue;

      const quoteNum = quote.quoteNumber ?? "your quote";
      const paymentUrl = `${appUrl}/quotes/payment/${quote.shareToken}`;
      const attemptNumber = (lastFollowUp
        ? await prisma.quoteFollowUp.count({
            where: { invoiceId: quote.id, type: "PAYMENT_REMINDER" },
          })
        : 0) + 1;

      // Build email
      const subject = `Payment details needed — ${quoteNum}`;
      const html = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #1a1a1a;">Payment Details Needed</h2>
  <p>Hello${quote.recipientName ? ` ${escapeHtml(quote.recipientName)}` : ""},</p>
  <p>You approved quote <strong>${escapeHtml(quoteNum)}</strong>, but we still need your payment information to process the order.</p>
  <p style="margin: 24px 0;">
    <a href="${escapeHtml(paymentUrl)}" style="background-color: #16a34a; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">Provide Payment Details</a>
  </p>
  <p style="color: #666; font-size: 14px;">Or copy this link: ${escapeHtml(paymentUrl)}</p>
  <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 24px 0;" />
  <p style="color: #999; font-size: 12px;">Los Angeles Pierce College Bookstore</p>
</div>`;

      // Try to attach the PDF
      let attachments: EmailAttachment[] | undefined;
      try {
        const { quoteService } = await import("./service");
        const { buffer, filename } = await quoteService.generatePdf(quote.id);
        const safeName = (filename ?? "quote").replace(/[^a-zA-Z0-9\-]/g, "-");
        attachments = [{ Name: `Quote-${safeName}.pdf`, ContentBytes: buffer.toString("base64") }];
      } catch {
        // PDF is non-critical for follow-up
      }

      const sent = await sendEmail(recipientEmail, subject, html, attachments);
      if (!sent) continue;

      // Record the follow-up
      await prisma.quoteFollowUp.create({
        data: {
          invoiceId: quote.id,
          type: "PAYMENT_REMINDER",
          recipientEmail,
          subject,
          metadata: { attempt: attemptNumber },
        },
      });

      // Notify the quote creator
      try {
        const { notificationService } = await import("@/domains/notification/service");
        await notificationService.createAndPublish({
          userId: quote.creator.id,
          type: "PAYMENT_FOLLOWUP_SENT",
          title: `Payment reminder sent for ${quoteNum}`,
          message: `Reminder #${attemptNumber} sent to ${recipientEmail}`,
          quoteId: quote.id,
        });
      } catch {
        // Non-critical
      }
    }
  } finally {
    await releasePaymentFollowUpLock();
  }
}
