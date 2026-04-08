// src/domains/follow-up/service.ts
import { randomUUID } from "crypto";
import { sendEmail } from "@/lib/email";
import { safePublishAll } from "@/lib/sse";
import { followUpRepository } from "./repository";
import { buildAccountFollowUpEmail } from "./email-templates";
import type {
  InitiateFollowUpResult,
  InitiateFollowUpResponse,
  PublicFollowUpSummary,
  FollowUpSeriesStatus,
} from "./types";

const DEFAULT_MAX_ATTEMPTS = 5;
const CLAIM_TTL_MINUTES = 30;

function getAppUrl(): string {
  return process.env.NEXTAUTH_URL ?? "https://laportal.montalvo.io";
}

function uuidToLockKey(uuid: string): bigint {
  // Convert UUID hex chars to a bigint advisory lock key.
  // Strip non-hex characters, take first 15 hex chars (60 bits).
  const hex = uuid.replace(/[^0-9a-fA-F]/g, "").slice(0, 15);
  if (!hex) return BigInt(0);
  return BigInt(`0x${hex}`);
}

type InvoiceForInitiation = {
  id: string;
  invoiceNumber: string | null;
  quoteNumber: string | null;
  type: string;
  accountNumber: string;
  notes: string | null;
  totalAmount: { toNumber?: () => number } | number;
  staffId: string | null;
  createdBy: string;
  staff: { email: string; name: string } | null;
  creator: { id: string; name: string } | null;
};

export const followUpService = {
  async initiateSingle(
    invoice: InvoiceForInitiation,
    userId: string,
    isAdmin: boolean,
  ): Promise<InitiateFollowUpResult> {
    // Pre-flight checks (no lock needed)
    if (invoice.accountNumber && invoice.accountNumber.trim() !== "") {
      return { invoiceId: invoice.id, status: "error", error: "This item already has an account number" };
    }

    if (!invoice.staffId || !invoice.staff?.email) {
      return { invoiceId: invoice.id, status: "error", error: "No recipient — assign a staff member first" };
    }

    if (!isAdmin && invoice.createdBy !== userId) {
      return { invoiceId: invoice.id, status: "error", error: "Not authorized" };
    }

    // Acquire per-invoice advisory lock, re-check within lock, handle stale claims
    const { prisma } = await import("@/lib/prisma");
    const lockKey = uuidToLockKey(invoice.id);

    const claimResult = await prisma.$transaction(async (tx) => {
      // Acquire advisory lock to prevent concurrent initiations for same invoice
      const lockResult = await tx.$queryRaw<Array<{ acquired: boolean }>>`
        SELECT pg_try_advisory_xact_lock(${lockKey}) AS acquired
      `;
      if (lockResult[0]?.acquired !== true) {
        return { locked: true as const };
      }

      // Re-check within lock (TOCTOU prevention)
      const freshInvoice = await tx.invoice.findUnique({
        where: { id: invoice.id },
        select: { accountNumber: true },
      });
      if (freshInvoice?.accountNumber && freshInvoice.accountNumber.trim() !== "") {
        return { alreadyHasAccount: true as const };
      }

      // Check for existing active series
      const existing = await tx.followUp.findFirst({
        where: {
          invoiceId: invoice.id,
          seriesStatus: "ACTIVE",
          type: { in: ["ACCOUNT_FOLLOWUP", "ACCOUNT_FOLLOWUP_CLAIM"] },
        },
      });

      // Handle stale claims
      if (existing && existing.type === "ACCOUNT_FOLLOWUP_CLAIM") {
        const staleThreshold = new Date(Date.now() - CLAIM_TTL_MINUTES * 60 * 1000);
        if (existing.sentAt < staleThreshold) {
          // Stale claim — delete and proceed
          await tx.followUp.delete({ where: { id: existing.id } });
        } else {
          // Fresh claim — in-flight, skip
          return { inFlight: true as const };
        }
      } else if (existing) {
        return { alreadyActive: true as const };
      }

      // Create claim row (durable token before email send)
      const seriesId = randomUUID();
      const shareToken = randomUUID();
      const formUrl = `${getAppUrl()}/account-request/${shareToken}`;
      const totalAmount =
        typeof invoice.totalAmount === "number"
          ? invoice.totalAmount
          : (invoice.totalAmount.toNumber?.() ?? Number(invoice.totalAmount));

      const docNumber =
        invoice.type === "QUOTE"
          ? (invoice.quoteNumber ?? "your quote")
          : (invoice.invoiceNumber ?? "your invoice");

      const { subject, html } = buildAccountFollowUpEmail({
        recipientName: invoice.staff!.name,
        invoiceNumber: invoice.invoiceNumber,
        quoteNumber: invoice.quoteNumber ?? undefined,
        type: invoice.type as "INVOICE" | "QUOTE",
        description: invoice.notes ?? "",
        totalAmount,
        creatorName: invoice.creator?.name ?? "the bookstore",
        formUrl,
        attempt: 1,
        maxAttempts: DEFAULT_MAX_ATTEMPTS,
      });

      const claim = await tx.followUp.create({
        data: {
          invoiceId: invoice.id,
          type: "ACCOUNT_FOLLOWUP_CLAIM",
          recipientEmail: invoice.staff!.email,
          subject,
          seriesId,
          shareToken,
          seriesStatus: "ACTIVE",
          maxAttempts: DEFAULT_MAX_ATTEMPTS,
          metadata: { attempt: 1 },
        },
      });

      return { claim, seriesId, subject, html, docNumber };
    });

    // Handle lock/check failures
    if ("locked" in claimResult) {
      return { invoiceId: invoice.id, status: "error", error: "Another request is in progress — please retry" };
    }
    if ("alreadyHasAccount" in claimResult) {
      return { invoiceId: invoice.id, status: "error", error: "This item already has an account number" };
    }
    if ("inFlight" in claimResult) {
      return { invoiceId: invoice.id, status: "error", error: "A request is already being sent" };
    }
    if ("alreadyActive" in claimResult) {
      return { invoiceId: invoice.id, status: "error", error: "This item already has an active follow-up series" };
    }

    // Send email outside the transaction
    const { claim, seriesId, subject, html, docNumber } = claimResult;
    const sent = await sendEmail(invoice.staff!.email, subject, html);
    if (!sent) {
      await prisma.followUp.delete({ where: { id: claim.id } }).catch(() => {});
      return { invoiceId: invoice.id, status: "error", error: "Email send failed — please retry" };
    }

    // Promote claim
    await prisma.followUp.update({
      where: { id: claim.id },
      data: { type: "ACCOUNT_FOLLOWUP", sentAt: new Date() },
    });

    try {
      const { notificationService } = await import("@/domains/notification/service");
      const notificationData: import("@/domains/notification/types").CreateNotificationInput = {
        userId: invoice.createdBy,
        type: "ACCOUNT_FOLLOWUP_SENT",
        title: `Follow Up 1/${DEFAULT_MAX_ATTEMPTS} Sent`,
        message: `Follow-up 1 sent for ${docNumber} to ${invoice.staff!.name}`,
      };
      // Route notification to correct detail page based on document type
      if (invoice.type === "QUOTE") {
        notificationData.quoteId = invoice.id;
      } else {
        notificationData.invoiceId = invoice.id;
      }
      await notificationService.createAndPublish(notificationData);
    } catch {
      // Non-critical
    }

    safePublishAll({ type: invoice.type === "QUOTE" ? "quote-changed" : "invoice-changed" });

    return { invoiceId: invoice.id, status: "success", seriesId };
  },

  async initiateMultiple(
    invoiceIds: string[],
    userId: string,
    isAdmin: boolean,
  ): Promise<InitiateFollowUpResponse> {
    const { prisma } = await import("@/lib/prisma");
    const invoices = await prisma.invoice.findMany({
      where: { id: { in: invoiceIds } },
      include: {
        staff: { select: { email: true, name: true } },
        creator: { select: { id: true, name: true } },
      },
    });

    const foundIds = new Set(invoices.map((inv: { id: string }) => inv.id));
    const results: InitiateFollowUpResult[] = [];

    // Return explicit errors for IDs not found in the database
    for (const id of invoiceIds) {
      if (!foundIds.has(id)) {
        results.push({ invoiceId: id, status: "error", error: "Invoice/quote not found" });
      }
    }

    // Process found invoices sequentially
    for (const invoice of invoices) {
      const result = await this.initiateSingle(
        invoice as unknown as InvoiceForInitiation,
        userId,
        isAdmin,
      );
      results.push(result);
    }

    const succeeded = results.filter((r) => r.status === "success").length;
    const failed = results.filter((r) => r.status === "error").length;

    return { results, summary: { succeeded, failed } };
  },

  async getPublicSummary(token: string): Promise<PublicFollowUpSummary | null> {
    const row = await followUpRepository.findByShareToken(token);
    if (!row || !row.invoice) return null;

    const inv = row.invoice;
    const attempt = (row.metadata as Record<string, unknown>)?.attempt as number ?? 1;

    return {
      invoiceNumber: inv.invoiceNumber,
      quoteNumber: inv.quoteNumber,
      type: inv.type as "INVOICE" | "QUOTE",
      description: inv.notes ?? "",
      totalAmount: Number(inv.totalAmount),
      creatorName: inv.creator?.name ?? "the bookstore",
      currentAttempt: attempt,
      maxAttempts: row.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
      seriesStatus: (row.seriesStatus as FollowUpSeriesStatus) ?? "ACTIVE",
    };
  },

  async submitAccountNumber(
    token: string,
    accountNumber: string,
  ): Promise<{ success: boolean; alreadyResolved?: boolean; error?: string }> {
    const row = await followUpRepository.findByShareToken(token);
    if (!row || !row.invoice) {
      return { success: false, error: "Invalid or expired link" };
    }

    if (
      row.seriesStatus === "COMPLETED" ||
      row.seriesStatus === "EXHAUSTED" ||
      (row.invoice.accountNumber && row.invoice.accountNumber.trim() !== "")
    ) {
      return { success: true, alreadyResolved: true };
    }

    const trimmed = accountNumber.trim();
    if (!trimmed || trimmed.length > 100) {
      return { success: false, error: "Please provide a valid account number" };
    }

    const { prisma } = await import("@/lib/prisma");
    await prisma.$transaction([
      prisma.invoice.update({
        where: { id: row.invoice.id },
        data: { accountNumber: trimmed },
      }),
      prisma.followUp.updateMany({
        where: { seriesId: row.seriesId! },
        data: { seriesStatus: "COMPLETED" },
      }),
    ]);

    try {
      const { notificationService } = await import("@/domains/notification/service");
      const notifRef = row.invoice.type === "QUOTE"
        ? { quoteId: row.invoice.id }
        : { invoiceId: row.invoice.id };
      await notificationService.createAndPublish({
        userId: row.invoice.createdBy,
        type: "ACCOUNT_NUMBER_RECEIVED",
        title: "Account Number Received",
        message: `Account number received for ${row.invoice.invoiceNumber ?? row.invoice.quoteNumber ?? "item"}`,
        ...notifRef,
      });
    } catch {
      // Non-critical
    }

    const eventType = row.invoice.type === "QUOTE" ? "quote-changed" : "invoice-changed";
    safePublishAll({ type: eventType });

    return { success: true };
  },

  async getBadgeState(invoiceId: string) {
    const latest = await followUpRepository.getLatestFollowUpForInvoice(invoiceId);
    if (!latest || !latest.seriesStatus || latest.seriesStatus === "COMPLETED") return null;

    const attempt = (latest.metadata as Record<string, unknown>)?.attempt as number ?? 1;
    return {
      seriesStatus: latest.seriesStatus as FollowUpSeriesStatus,
      currentAttempt: attempt,
      maxAttempts: latest.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
    };
  },

  async getBadgeStatesForInvoices(invoiceIds: string[]) {
    const rows = await followUpRepository.getFollowUpBadgesForInvoices(invoiceIds);
    const badges: Record<string, { seriesStatus: FollowUpSeriesStatus; currentAttempt: number; maxAttempts: number }> = {};
    for (const row of rows) {
      const attempt = (row.metadata as Record<string, unknown>)?.attempt as number ?? 1;
      badges[row.invoiceId] = {
        seriesStatus: row.seriesStatus as FollowUpSeriesStatus,
        currentAttempt: attempt,
        maxAttempts: row.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
      };
    }
    return badges;
  },
};
