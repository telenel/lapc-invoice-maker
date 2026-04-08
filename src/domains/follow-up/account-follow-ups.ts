// src/domains/follow-up/account-follow-ups.ts
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { businessDaysBetween } from "@/lib/date-utils";
import { safePublishAll } from "@/lib/sse";
import { followUpRepository } from "./repository";
import { buildAccountFollowUpEmail } from "./email-templates";

const FOLLOW_UP_INTERVAL_BUSINESS_DAYS = 5;
const CLAIM_TTL_MINUTES = 30;

export async function checkAndSendAccountFollowUps(): Promise<void> {
  const now = new Date();

  // No global advisory lock needed. Concurrency safety comes from the per-series
  // claim mechanism: each series is protected by the ACCOUNT_FOLLOWUP_CLAIM row
  // with a 30-minute TTL. If two cron runs overlap, the second will see fresh
  // claims and skip. Session-scoped advisory locks are unsafe with Prisma's
  // connection pooling (lock and unlock may hit different pooled connections).
  // The runTrackedJob() wrapper in the caller also provides observability —
  // if the job is already "running" in the JobRun table, operators can see it.

  const activeSeries = await followUpRepository.findAllActiveSeries();
  const appUrl = getAppUrl();

  for (const row of activeSeries) {
    const inv = row.invoice;
    if (!inv) continue;

    // Check if account number was manually entered
    if (inv.accountNumber && inv.accountNumber.trim() !== "") {
      await followUpRepository.markSeriesStatus(row.seriesId!, "COMPLETED");
      safePublishAll({ type: inv.type === "QUOTE" ? "quote-changed" : "invoice-changed" });
      continue;
    }

    // Check cadence
    const daysSince = businessDaysBetween(row.sentAt, now);
    if (daysSince < FOLLOW_UP_INTERVAL_BUSINESS_DAYS) continue;

    // Compute next attempt
    const existingCount = await followUpRepository.countAttempts(row.seriesId!);
    const nextAttempt = existingCount + 1;
    const maxAttempts = row.maxAttempts ?? 5;

    // Safety net: should not happen (exhaustion is immediate after final send)
    if (nextAttempt > maxAttempts) {
      await followUpRepository.markSeriesStatus(row.seriesId!, "EXHAUSTED");
      await notifyExhausted(inv);
      continue;
    }

    // Check for existing claims
    const staleThreshold = new Date(now.getTime() - CLAIM_TTL_MINUTES * 60 * 1000);
    const freshClaim = await followUpRepository.findFreshClaimForSeries(row.seriesId!, staleThreshold);
    if (freshClaim) continue; // In-flight

    // Delete stale claims
    await followUpRepository.deleteStaleClaimsForSeries(row.seriesId!, staleThreshold);

    // Recount after stale deletion
    const recountedAttempts = await followUpRepository.countAttempts(row.seriesId!);
    const recountedNext = recountedAttempts + 1;
    if (recountedNext > maxAttempts) {
      await followUpRepository.markSeriesStatus(row.seriesId!, "EXHAUSTED");
      await notifyExhausted(inv);
      continue;
    }

    // Find the share token from the initiator row
    const initiator = await prisma.followUp.findFirst({
      where: { seriesId: row.seriesId!, shareToken: { not: null } },
      select: { shareToken: true },
    });
    if (!initiator?.shareToken) {
      console.warn(`No share token found for series ${row.seriesId}, skipping`);
      continue;
    }
    const shareToken = initiator.shareToken;
    const formUrl = `${appUrl}/account-request/${shareToken}`;
    const totalAmount = Number(inv.totalAmount);

    const { subject, html } = buildAccountFollowUpEmail({
      recipientName: inv.staff?.name ?? "Team Member",
      invoiceNumber: inv.invoiceNumber,
      quoteNumber: inv.quoteNumber,
      type: inv.type as "INVOICE" | "QUOTE",
      description: inv.notes ?? "",
      totalAmount,
      creatorName: inv.creator?.name ?? "the bookstore",
      formUrl,
      attempt: recountedNext,
      maxAttempts,
    });

    const recipientEmail = inv.staff?.email;
    if (!recipientEmail) {
      console.warn(`No staff email for invoice ${inv.id}, skipping series ${row.seriesId}`);
      continue;
    }

    // Create claim
    const claim = await followUpRepository.createClaimRow({
      invoiceId: inv.id,
      seriesId: row.seriesId!,
      shareToken: "", // Only initiator row has the shareToken
      recipientEmail,
      subject,
      maxAttempts,
      attempt: recountedNext,
    });

    // Send email
    const sent = await sendEmail(recipientEmail, subject, html);
    if (!sent) {
      await followUpRepository.deleteClaimRow(claim.id);
      continue;
    }

    // Promote claim
    await followUpRepository.promoteClaimRow(claim.id);

    // Check if this was the final attempt
    if (recountedNext === maxAttempts) {
      await followUpRepository.markSeriesStatus(row.seriesId!, "EXHAUSTED");
      await notifyExhausted(inv);
    } else {
      await notifySent(inv, recountedNext, maxAttempts);
    }

    safePublishAll({ type: inv.type === "QUOTE" ? "quote-changed" : "invoice-changed" });
  }
}

function getAppUrl(): string {
  const appUrl = process.env.NEXTAUTH_URL;
  if (!appUrl) {
    throw new Error("NEXTAUTH_URL is required to generate follow-up links");
  }
  return appUrl;
}

type InvoiceInfo = {
  id: string;
  invoiceNumber: string | null;
  quoteNumber: string | null;
  type: string;
  createdBy: string;
  staff: { email: string; name: string } | null;
  creator: { id: string; name: string } | null;
};

function buildNotificationRef(inv: InvoiceInfo): { quoteId?: string; invoiceId?: string } {
  return inv.type === "QUOTE" ? { quoteId: inv.id } : { invoiceId: inv.id };
}

async function notifySent(inv: InvoiceInfo, attempt: number, maxAttempts: number) {
  try {
    const { notificationService } = await import("@/domains/notification/service");
    const docNum = inv.invoiceNumber ?? inv.quoteNumber ?? "item";
    await notificationService.createAndPublish({
      userId: inv.createdBy,
      type: "ACCOUNT_FOLLOWUP_SENT" as import("@/domains/notification/types").NotificationType,
      title: `Follow Up ${attempt}/${maxAttempts} Sent`,
      message: `Follow-up ${attempt} sent for ${docNum} to ${inv.staff?.name ?? "recipient"}`,
      ...buildNotificationRef(inv),
    });
  } catch {
    // Non-critical
  }
}

async function notifyExhausted(inv: InvoiceInfo) {
  try {
    const { notificationService } = await import("@/domains/notification/service");
    const docNum = inv.invoiceNumber ?? inv.quoteNumber ?? "item";
    await notificationService.createAndPublish({
      userId: inv.createdBy,
      type: "ACCOUNT_FOLLOWUP_EXHAUSTED" as import("@/domains/notification/types").NotificationType,
      title: "Follow-Ups Complete",
      message: `All follow-ups sent for ${docNum} — no account number received`,
      ...buildNotificationRef(inv),
    });
  } catch {
    // Non-critical
  }
  safePublishAll({ type: inv.type === "QUOTE" ? "quote-changed" : "invoice-changed" });
}
