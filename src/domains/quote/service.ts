// src/domains/quote/service.ts
import * as quoteRepository from "./repository";
import { pdfService } from "@/domains/pdf/service";
import { formatDateFromDate } from "@/domains/shared/formatters";
import { calculateTotal } from "@/domains/invoice/calculations";
import {
  addDaysToDateKey,
  fromDateKey,
  getDateKeyInLosAngeles,
  getDateOnlyKey,
  isDateOnlyBeforeTodayInTimeZone,
} from "@/lib/date-utils";
import { prisma } from "@/lib/prisma";
import { safePublishAll } from "@/lib/sse";
import type { Prisma } from "@/generated/prisma/client";
import type {
  QuoteResponse,
  QuoteItemResponse,
  QuoteFilters,
  CreateQuoteInput,
  UpdateQuoteInput,
  QuoteFollowUpResponse,
  QuoteViewResponse,
  CateringDetails,
  QuotePublicPaymentCandidate,
  QuotePaymentDetailsSubmission,
} from "./types";
import type { StaffSummary } from "@/domains/staff/types";
import type { ContactResponse } from "@/domains/contact/types";
import type { ArchivedBySummary } from "@/domains/invoice/types";
import {
  getMissingCustomerCateringRequirements,
  normalizeCateringDetails,
  normalizeQuoteTimeInput,
} from "./catering";
import { normalizeQuotePaymentDetails } from "./payment";
import { getQuotePaymentFollowUpBadgeState } from "./payment-follow-up";

// ── DTO mapper ─────────────────────────────────────────────────────────────

type QuoteWithRelations = Awaited<ReturnType<typeof quoteRepository.findById>>;
const MAX_QUOTE_NUMBER_ATTEMPTS = 3;

function publicResponseErrorMessage(status: string | null | undefined): string {
  return status === "ACCEPTED" || status === "DECLINED" || status === "REVISED"
    ? "This quote has already been responded to"
    : "This quote is no longer available";
}

export function isPublicPaymentLinkAvailable(
  quote: Pick<QuoteResponse, "quoteStatus" | "convertedToInvoice"> & {
    paymentMethod?: string | null;
  }
): boolean {
  if (quote.quoteStatus === "ACCEPTED") {
    return !quote.convertedToInvoice && !quote.paymentMethod;
  }
  return false;
}

export function isPublicQuoteResponseAvailable(
  quote: Pick<QuoteResponse, "quoteStatus" | "convertedToInvoice">
): boolean {
  return !quote.convertedToInvoice
    && ["SENT", "SUBMITTED_EMAIL", "SUBMITTED_MANUAL"].includes(quote.quoteStatus);
}

function isUniqueConstraintViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

function assertQuoteIsActive(quote: { archivedAt?: Date | null }) {
  if (quote.archivedAt) {
    throw Object.assign(
      new Error("Archived quotes must be restored before they can be changed"),
      { code: "FORBIDDEN" },
    );
  }
}

function isQuoteExpired(expirationDate: Date | string | null | undefined, now = new Date()): boolean {
  if (!expirationDate) return false;
  return isDateOnlyBeforeTodayInTimeZone(expirationDate, now);
}

function getDefaultQuoteDateKey(now = new Date()): string {
  return getDateKeyInLosAngeles(now);
}

function getDefaultQuoteExpirationDateKey(now = new Date()): string {
  return addDaysToDateKey(getDefaultQuoteDateKey(now), 30);
}

async function withGeneratedQuoteNumber<T>(operation: (quoteNumber: string) => Promise<T>): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_QUOTE_NUMBER_ATTEMPTS; attempt += 1) {
    const quoteNumber = await quoteRepository.generateNumber();
    try {
      return await operation(quoteNumber);
    } catch (error) {
      lastError = error;
      if (isUniqueConstraintViolation(error) && attempt < MAX_QUOTE_NUMBER_ATTEMPTS - 1) {
        continue;
      }
      throw error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Failed to generate a unique quote number");
}

function toQuoteResponse(quote: NonNullable<QuoteWithRelations>): QuoteResponse {
  const staff: StaffSummary | null = quote.staff
    ? {
        id: quote.staff.id,
        name: quote.staff.name,
        title: quote.staff.title,
        department: quote.staff.department,
      }
    : null;

  const contactRaw = (quote as { contact?: { id: string; name: string; email: string; phone: string; org: string; department: string; title: string; notes: string | null; createdAt: Date } | null }).contact;
  const contact: ContactResponse | null = contactRaw
    ? {
        id: contactRaw.id,
        name: contactRaw.name,
        email: contactRaw.email,
        phone: contactRaw.phone,
        org: contactRaw.org,
        department: contactRaw.department,
        title: contactRaw.title,
        notes: contactRaw.notes,
        createdAt: contactRaw.createdAt.toISOString(),
      }
    : null;

  const convertedToInvoice = "convertedToInvoice" in quote
    ? (quote.convertedToInvoice as { id: string; invoiceNumber: string | null; status?: string | null; createdBy?: string | null; paymentMethod?: string | null } | null)
    : null;
  const convertedInvoiceResponse = convertedToInvoice
    ? {
        id: convertedToInvoice.id,
        invoiceNumber: convertedToInvoice.invoiceNumber,
        ...(convertedToInvoice.status !== undefined ? { status: convertedToInvoice.status } : {}),
        ...(convertedToInvoice.createdBy !== undefined ? { createdBy: convertedToInvoice.createdBy } : {}),
      }
    : null;

  const items: QuoteItemResponse[] = quote.items.map((item) => ({
    id: item.id,
    description: item.description,
    quantity: Number(item.quantity),
    unitPrice: Number(item.unitPrice),
    extendedPrice: Number(item.extendedPrice),
    sortOrder: item.sortOrder,
    isTaxable: item.isTaxable,
    marginOverride: item.marginOverride != null ? Number(item.marginOverride) : null,
    costPrice: item.costPrice != null ? Number(item.costPrice) : null,
    sku: item.sku ?? null,
  }));

  const archivedBy = "archiver" in quote
    ? ((quote as { archiver?: ArchivedBySummary | null }).archiver ?? null)
    : null;

  return {
    id: quote.id,
    quoteNumber: quote.quoteNumber,
    quoteStatus: (quote.quoteStatus ?? "DRAFT") as QuoteResponse["quoteStatus"],
    date: quote.date.toISOString(),
    staffId: quote.staffId ?? null,
    expirationDate: quote.expirationDate ? quote.expirationDate.toISOString() : null,
    type: quote.type,
    department: quote.department,
    category: quote.category,
    accountCode: quote.accountCode,
    accountNumber: quote.accountNumber ?? "",
    approvalChain: (quote.approvalChain as string[]) ?? [],
    notes: quote.notes ?? "",
    totalAmount: Number(quote.totalAmount),
    recipientName: quote.recipientName ?? "",
    recipientEmail: quote.recipientEmail ?? "",
    recipientOrg: quote.recipientOrg ?? "",
    pdfPath: quote.pdfPath,
    shareToken: quote.shareToken ?? null,
    createdAt: quote.createdAt.toISOString(),
    archivedAt: quote.archivedAt?.toISOString() ?? null,
    archivedBy,
    staff,
    contact,
    creatorId: quote.creator.id,
    creatorName: quote.creator.name,
    items,
    isCateringEvent: quote.isCateringEvent,
    cateringDetails: normalizeCateringDetails(quote.cateringDetails as CateringDetails | null),
    marginEnabled: quote.marginEnabled,
    marginPercent: quote.marginPercent != null ? Number(quote.marginPercent) : null,
    taxEnabled: quote.taxEnabled,
    taxRate: Number(quote.taxRate),
    paymentMethod: quote.paymentMethod ?? null,
    paymentAccountNumber:
      ("paymentAccountNumber" in quote
        ? ((quote as { paymentAccountNumber?: string | null }).paymentAccountNumber ?? null)
        : null),
    paymentDetailsResolved: Boolean(quote.paymentMethod || convertedToInvoice?.paymentMethod),
    paymentFollowUpBadge: null,
    convertedToInvoice: convertedInvoiceResponse,
    revisedFromQuote: "revisedFromQuote" in quote && (quote as { revisedFromQuote?: { id: string; quoteNumber: string | null } | null }).revisedFromQuote
      ? { id: (quote as { revisedFromQuote: { id: string; quoteNumber: string | null } }).revisedFromQuote.id, quoteNumber: (quote as { revisedFromQuote: { id: string; quoteNumber: string | null } }).revisedFromQuote.quoteNumber }
      : null,
    revisedToQuote: "revisedToQuote" in quote && (quote as { revisedToQuote?: { id: string; quoteNumber: string | null } | null }).revisedToQuote
      ? { id: (quote as { revisedToQuote: { id: string; quoteNumber: string | null } }).revisedToQuote.id, quoteNumber: (quote as { revisedToQuote: { id: string; quoteNumber: string | null } }).revisedToQuote.quoteNumber }
      : null,
  };
}

async function attachQuotePaymentFollowUpBadges(
  quotes: QuoteResponse[],
): Promise<QuoteResponse[]> {
  const eligibleIds = quotes
    .filter((quote) =>
      quote.quoteStatus === "ACCEPTED" &&
      !quote.paymentDetailsResolved &&
      Boolean(quote.shareToken) &&
      Boolean(quote.recipientEmail) &&
      !quote.convertedToInvoice,
    )
    .map((quote) => quote.id);

  const sentAttemptsByInvoiceId = await quoteRepository.countPaymentReminderAttemptsByInvoiceIds(eligibleIds);

  return quotes.map((quote) => ({
    ...quote,
    paymentFollowUpBadge: getQuotePaymentFollowUpBadgeState({
      quoteStatus: quote.quoteStatus,
      paymentDetailsResolved: quote.paymentDetailsResolved,
      hasShareToken: Boolean(quote.shareToken),
      hasRecipientEmail: Boolean(quote.recipientEmail),
      hasConvertedInvoice: Boolean(quote.convertedToInvoice),
      sentAttempts: sentAttemptsByInvoiceId[quote.id] ?? 0,
    }),
  }));
}

function calculateLineItems(
  items: CreateQuoteInput["items"]
): quoteRepository.CalculatedLineItem[] {
  return items.map((item, index) => {
    const qty = Number(item.quantity);
    const price = Number(item.unitPrice);
    return {
      description: item.description,
      quantity: qty,
      unitPrice: price,
      extendedPrice: qty * price,
      sortOrder: item.sortOrder ?? index,
      isTaxable: item.isTaxable,
      marginOverride: item.marginOverride,
      costPrice: item.costPrice,
      sku: item.sku ?? null,
    };
  });
}

function normalizeQuoteDateInput(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  return getDateOnlyKey(value);
}

function normalizeQuoteItemForComparison(item: {
  description: string;
  quantity: number | string;
  unitPrice: number | string;
  sortOrder?: number | null;
  isTaxable?: boolean | null;
  marginOverride?: number | null;
  costPrice?: number | string | null;
}) {
  return {
    description: item.description,
    quantity: Number(item.quantity),
    unitPrice: Number(item.unitPrice),
    sortOrder: item.sortOrder ?? 0,
    isTaxable: item.isTaxable ?? true,
    marginOverride: item.marginOverride != null ? Number(item.marginOverride) : null,
    costPrice: item.costPrice != null ? Number(item.costPrice) : null,
  };
}

function hasMeaningfulQuoteChanges(
  existing: NonNullable<QuoteWithRelations>,
  input: UpdateQuoteInput,
): boolean {
  if (input.items) {
    const nextItems = input.items.map(normalizeQuoteItemForComparison);
    const currentItems = existing.items.map((item) =>
      normalizeQuoteItemForComparison({
        description: item.description,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        sortOrder: item.sortOrder,
        isTaxable: item.isTaxable,
        marginOverride: item.marginOverride != null ? Number(item.marginOverride) : null,
        costPrice: item.costPrice != null ? Number(item.costPrice) : null,
      })
    );
    if (JSON.stringify(nextItems) !== JSON.stringify(currentItems)) {
      return true;
    }
  }

  const comparisons: Array<[boolean, unknown, unknown]> = [
    [input.date !== undefined, normalizeQuoteDateInput(input.date), normalizeQuoteDateInput(existing.date)],
    [input.staffId !== undefined, input.staffId ?? null, existing.staff?.id ?? null],
    [input.department !== undefined, input.department ?? null, existing.department],
    [input.category !== undefined, input.category ?? null, existing.category],
    [input.accountCode !== undefined, input.accountCode ?? null, existing.accountCode],
    [input.accountNumber !== undefined, input.accountNumber ?? null, existing.accountNumber ?? ""],
    [input.notes !== undefined, input.notes ?? null, existing.notes ?? ""],
    [input.expirationDate !== undefined, normalizeQuoteDateInput(input.expirationDate), normalizeQuoteDateInput(existing.expirationDate)],
    [input.recipientName !== undefined, input.recipientName ?? null, existing.recipientName ?? ""],
    [input.recipientEmail !== undefined, input.recipientEmail ?? null, existing.recipientEmail ?? ""],
    [input.recipientOrg !== undefined, input.recipientOrg ?? null, existing.recipientOrg ?? ""],
    [input.marginEnabled !== undefined, Boolean(input.marginEnabled), existing.marginEnabled],
    [input.marginPercent !== undefined, input.marginPercent != null ? Number(input.marginPercent) : null, existing.marginPercent != null ? Number(existing.marginPercent) : null],
    [input.taxEnabled !== undefined, Boolean(input.taxEnabled), existing.taxEnabled],
    [input.taxRate !== undefined, input.taxRate != null ? Number(input.taxRate) : null, existing.taxRate != null ? Number(existing.taxRate) : null],
    [input.isCateringEvent !== undefined, Boolean(input.isCateringEvent), existing.isCateringEvent],
    [input.cateringDetails !== undefined, JSON.stringify(input.cateringDetails ?? null), JSON.stringify(existing.cateringDetails ?? null)],
  ];

  return comparisons.some(([enabled, nextValue, currentValue]) => enabled && nextValue !== currentValue);
}

// ── Service ────────────────────────────────────────────────────────────────

export const quoteService = {
  /**
   * Paginated list of quotes with filtering, mapped to DTOs.
   * Auto-expires overdue DRAFT/SENT quotes before returning results.
   */
  async list(filters: QuoteFilters) {
    const { quotes, total, page, pageSize } = await quoteRepository.findMany(filters);
    const mappedQuotes = await attachQuotePaymentFollowUpBadges(
      quotes.map((q) => toQuoteResponse(q as unknown as NonNullable<QuoteWithRelations>)),
    );
    return {
      quotes: mappedQuotes,
      total,
      page,
      pageSize,
    };
  },

  /**
   * Single quote by ID, or null if not found / not a quote.
   * Auto-expires if past expiration date.
   */
  async getById(id: string, options?: { includeArchived?: boolean }): Promise<QuoteResponse | null> {
    const quote = await quoteRepository.findById(id, options);
    if (!quote || quote.type !== "QUOTE") return null;

    // Auto-expire if past expiration date
    if (
      isQuoteExpired(quote.expirationDate) &&
      (quote.quoteStatus === "DRAFT" || quote.quoteStatus === "SENT" || quote.quoteStatus === "SUBMITTED_EMAIL" || quote.quoteStatus === "SUBMITTED_MANUAL")
    ) {
      await quoteRepository.update(id, { quoteStatus: "EXPIRED" });
      quote.quoteStatus = "EXPIRED";
    }

    const [withPaymentFollowUp] = await attachQuotePaymentFollowUpBadges([toQuoteResponse(quote)]);
    return withPaymentFollowUp;
  },

  /**
   * Get a quote by its share token (for public access).
   */
  async getByShareToken(token: string): Promise<QuoteResponse | null> {
    const quote = await quoteRepository.findByShareToken(token);
    if (!quote || quote.type !== "QUOTE") return null;

    // Auto-expire if past expiration date
    if (
      isQuoteExpired(quote.expirationDate) &&
      (quote.quoteStatus === "DRAFT" || quote.quoteStatus === "SENT" || quote.quoteStatus === "SUBMITTED_EMAIL" || quote.quoteStatus === "SUBMITTED_MANUAL")
    ) {
      await quoteRepository.update(quote.id, { quoteStatus: "EXPIRED" });
      quote.quoteStatus = "EXPIRED";
    }

    const [withPaymentFollowUp] = await attachQuotePaymentFollowUpBadges([toQuoteResponse(quote)]);
    return withPaymentFollowUp;
  },

  async submitPublicPaymentDetails(
    token: string,
    paymentDetails?: { paymentMethod?: string; accountNumber?: string | null }
  ): Promise<QuotePublicPaymentCandidate | null> {
    const normalizedPayment = normalizeQuotePaymentDetails(paymentDetails);
    if (!normalizedPayment) {
      throw Object.assign(new Error("paymentMethod is required"), { code: "INVALID_INPUT" });
    }

    const quote = await quoteRepository.findAcceptedPublicPaymentCandidate(token);
    if (!quote) return null;
    if (quote.paymentMethod) {
      throw Object.assign(new Error("Payment details have already been provided"), {
        code: "PAYMENT_ALREADY_RESOLVED",
      });
    }
    if (quote.convertedToInvoice) {
      throw Object.assign(new Error("This quote is no longer accepting public payment details"), {
        code: "FORBIDDEN",
      });
    }

    const subject = `Payment details provided for ${quote.quoteNumber ?? "quote"}`;
    const paymentResult = await prisma.$transaction(async (tx) => {
      const lockedQuotes = await tx.$queryRaw<Array<{
        id: string;
        paymentMethod: string | null;
        quoteStatus: string | null;
      }>>`
        SELECT id, payment_method AS "paymentMethod", quote_status AS "quoteStatus"
        FROM invoices
        WHERE id = ${quote.id}
        FOR UPDATE
      `;
      const lockedQuote = lockedQuotes[0];
      if (!lockedQuote) {
        throw Object.assign(new Error("Quote not found"), { code: "NOT_FOUND" });
      }
      if (lockedQuote.quoteStatus !== "ACCEPTED") {
        throw Object.assign(new Error("This quote is no longer awaiting payment details"), {
          code: "FORBIDDEN",
        });
      }
      if (lockedQuote.paymentMethod) {
        throw Object.assign(new Error("Payment details have already been provided"), {
          code: "PAYMENT_ALREADY_RESOLVED",
        });
      }
      const convertedInvoices = await tx.$queryRaw<Array<{
        id: string;
      }>>`
        SELECT id
        FROM invoices
        WHERE converted_from_quote_id = ${quote.id}
        FOR UPDATE
      `;
      if (convertedInvoices[0]) {
        throw Object.assign(new Error("This quote is no longer accepting public payment details"), {
          code: "FORBIDDEN",
        });
      }

      await tx.invoice.update({
        where: { id: quote.id },
        data: {
          paymentMethod: normalizedPayment.paymentMethod,
          paymentAccountNumber: normalizedPayment.paymentAccountNumber,
        },
      });

      const updatedConvertedInvoice = false;

      await tx.followUp.create({
        data: {
          invoiceId: quote.id,
          type: "PAYMENT_RESOLVED",
          recipientEmail: quote.recipientEmail ?? "",
          subject,
          metadata: {
            paymentMethod: normalizedPayment.paymentMethod,
          } as Prisma.InputJsonValue,
        },
      });

      return {
        ownerUserId: quote.createdBy,
        updatedConvertedInvoice,
      };
    });
    const convertedToInvoice = quote.convertedToInvoice as { id: string } | null | undefined;

    try {
      const { notificationService } = await import("@/domains/notification/service");
      await notificationService.createAndPublish({
        userId: paymentResult.ownerUserId,
        type: "PAYMENT_DETAILS_RECEIVED",
        title: `Payment details received for ${quote.quoteNumber ?? "Quote"}`,
        message: `Payment method: ${normalizedPayment.paymentMethod}`,
        quoteId: quote.id,
      });
    } catch (err) {
      console.error("Failed to publish PAYMENT_DETAILS_RECEIVED notification:", err);
    }

    return {
      id: quote.id,
      quoteNumber: quote.quoteNumber,
      recipientEmail: quote.recipientEmail,
      paymentMethod: normalizedPayment.paymentMethod,
      convertedToInvoice: convertedToInvoice ? { id: convertedToInvoice.id } : null,
      updatedConvertedInvoice: paymentResult.updatedConvertedInvoice,
    };
  },

  /**
   * Get the share token for a quote (for share link dialog on already-sent quotes).
   */
  async getShareToken(id: string): Promise<string | null> {
    return quoteRepository.getShareToken(id);
  },

  /**
   * Record a quote page view and optionally trigger a notification.
   */
  async recordView(
    token: string,
    data: { ipAddress?: string; userAgent?: string; referrer?: string; viewport?: string }
  ): Promise<{ viewId: string } | null> {
    const quote = await quoteRepository.findByShareToken(token);
    if (!quote || quote.type !== "QUOTE") return null;

    const view = await quoteRepository.createView({
      invoiceId: quote.id,
      ...data,
    });

    // Debounce: only notify if no view in last 10 minutes
    const hasRecent = await quoteRepository.hasRecentView(quote.id, 10);
    if (!hasRecent) {
      const { notificationService } = await import("@/domains/notification/service");
      await notificationService.createAndPublish({
        userId: quote.createdBy,
        type: "QUOTE_VIEWED",
        title: `${quote.quoteNumber ?? "Quote"} was viewed`,
        message: quote.recipientName ? `Viewed by ${quote.recipientName}` : "Someone viewed your quote",
        quoteId: quote.id,
      });
    }

    safePublishAll({ type: "quote-activity-changed" });
    return { viewId: view.id };
  },

  /**
   * Update the duration of a page view (called via sendBeacon).
   */
  async updateViewDuration(viewId: string, durationSeconds: number): Promise<void> {
    await quoteRepository.updateViewDuration(viewId, durationSeconds);
    safePublishAll({ type: "quote-activity-changed" });
  },

  /**
   * Update the duration of a page view only when it belongs to the supplied quote token.
   */
  async updateViewDurationForToken(token: string, viewId: string, durationSeconds: number): Promise<void> {
    const quote = await quoteRepository.findByShareToken(token);
    if (!quote || quote.type !== "QUOTE") {
      throw Object.assign(new Error("Quote not found"), { code: "NOT_FOUND" });
    }

    const view = await prisma.quoteView.findFirst({
      where: { id: viewId, invoiceId: quote.id },
      select: { id: true },
    });
    if (!view) {
      throw Object.assign(new Error("Quote activity session not found"), { code: "INVALID_INPUT" });
    }

    await quoteRepository.updateViewDuration(viewId, durationSeconds);
    safePublishAll({ type: "quote-activity-changed" });
  },

  /**
   * Handle a recipient's response (approve/decline) to a quote.
   */
  async respondToQuote(
    token: string,
    response: "ACCEPTED" | "DECLINED",
    viewId?: string,
    paymentDetails?: { paymentMethod?: string; accountNumber?: string | null },
    cateringDetails?: CateringDetails
  ): Promise<{ success: boolean; status: string } | null> {
    const quote = await quoteRepository.findByShareToken(token);
    if (!quote || quote.type !== "QUOTE") return null;

    if (!["SENT", "SUBMITTED_EMAIL", "SUBMITTED_MANUAL"].includes(quote.quoteStatus as string)) {
      throw Object.assign(
        new Error(
          quote.quoteStatus === "ACCEPTED" || quote.quoteStatus === "DECLINED" || quote.quoteStatus === "REVISED"
            ? "This quote has already been responded to"
            : "This quote is no longer available"
        ),
        { code: "FORBIDDEN" }
      );
    }

    // Check expiration
    if (isQuoteExpired(quote.expirationDate)) {
      await quoteRepository.update(quote.id, { quoteStatus: "EXPIRED" });
      safePublishAll({ type: "quote-changed" });
      throw Object.assign(new Error("This quote has expired"), { code: "FORBIDDEN" });
    }

    let normalizedPayment: QuotePaymentDetailsSubmission | undefined;
    let normalizedCateringDetails: Prisma.InputJsonValue | undefined;
    const acceptedAt = response === "ACCEPTED" ? new Date() : undefined;
    if (response === "ACCEPTED") {
      normalizedPayment = normalizeQuotePaymentDetails(paymentDetails);
      if (cateringDetails) {
        if (!quote.isCateringEvent) {
          throw Object.assign(new Error("Catering details are only allowed for catering quotes"), {
            code: "INVALID_INPUT",
          });
        }
        normalizedCateringDetails = cateringDetails as unknown as Prisma.InputJsonValue;
      }
    }

    const responseResult = await prisma.$transaction(async (tx): Promise<{ expired: boolean; updatedConvertedInvoice: boolean }> => {
      const lockedQuotes = await tx.$queryRaw<Array<{
        id: string;
        quoteStatus: string | null;
        paymentMethod: string | null;
        expirationDate: Date | null;
        cateringDetails: Prisma.JsonValue | null;
      }>>`
        SELECT
          id,
          quote_status AS "quoteStatus",
          payment_method AS "paymentMethod",
          expiration_date AS "expirationDate",
          catering_details AS "cateringDetails"
        FROM invoices
        WHERE id = ${quote.id}
        FOR UPDATE
      `;
      const lockedQuote = lockedQuotes[0];
      if (!lockedQuote) {
        throw Object.assign(new Error("Quote not found"), { code: "NOT_FOUND" });
      }
      if (!["SENT", "SUBMITTED_EMAIL", "SUBMITTED_MANUAL"].includes(lockedQuote.quoteStatus ?? "")) {
        throw Object.assign(new Error(publicResponseErrorMessage(lockedQuote.quoteStatus)), {
          code: "FORBIDDEN",
        });
      }
      if (isQuoteExpired(lockedQuote.expirationDate)) {
        return { expired: true, updatedConvertedInvoice: false };
      }
      const lockedQuoteCateringDetails = lockedQuote.cateringDetails as CateringDetails | null;
      const convertedInvoices = await tx.$queryRaw<Array<{
        id: string;
        status: string | null;
        paymentMethod: string | null;
        cateringDetails: Prisma.JsonValue | null;
      }>>`
        SELECT id, status, payment_method AS "paymentMethod", catering_details AS "cateringDetails"
        FROM invoices
        WHERE converted_from_quote_id = ${quote.id}
        FOR UPDATE
      `;
      const convertedInvoice = convertedInvoices[0];

      const quoteData: Prisma.InvoiceUpdateInput = {
        quoteStatus: response,
      };

      if (response === "ACCEPTED") {
        quoteData.acceptedAt = acceptedAt;
        if (normalizedPayment) {
          if (lockedQuote.paymentMethod) {
            throw Object.assign(new Error("Payment details have already been provided"), {
              code: "PAYMENT_ALREADY_RESOLVED",
            });
          }
          quoteData.paymentMethod = normalizedPayment.paymentMethod;
          quoteData.paymentAccountNumber = normalizedPayment.paymentAccountNumber;
        }
        if (normalizedCateringDetails !== undefined) {
          quoteData.cateringDetails = {
            ...(normalizedCateringDetails as Record<string, unknown>),
            setupInstructions: lockedQuoteCateringDetails?.setupInstructions ?? undefined,
            takedownInstructions: lockedQuoteCateringDetails?.takedownInstructions ?? undefined,
          };
        }
      }

      let updatedConvertedInvoice = false;
      if (convertedInvoice) {
        if (convertedInvoice.status === "FINAL") {
          throw Object.assign(new Error("Cannot update a finalized invoice"), { code: "FORBIDDEN" });
        }
        if (response !== "ACCEPTED") {
          throw Object.assign(new Error("This quote is no longer available"), { code: "FORBIDDEN" });
        }
        if (!normalizedPayment && normalizedCateringDetails === undefined) {
          throw Object.assign(new Error("This quote is no longer available"), { code: "FORBIDDEN" });
        }
        if (response === "ACCEPTED" && (normalizedPayment || normalizedCateringDetails)) {
          const convertedInvoiceCateringDetails = convertedInvoice.cateringDetails as CateringDetails | null;
          const convertedInvoiceData: Prisma.InvoiceUpdateInput = {};
          if (normalizedPayment) {
            if (convertedInvoice.paymentMethod) {
              throw Object.assign(new Error("Payment details have already been provided"), {
                code: "PAYMENT_ALREADY_RESOLVED",
              });
            }
            convertedInvoiceData.paymentMethod = normalizedPayment.paymentMethod;
            convertedInvoiceData.paymentAccountNumber = normalizedPayment.paymentAccountNumber;
          }
          if (normalizedCateringDetails !== undefined) {
            convertedInvoiceData.cateringDetails = {
              ...(normalizedCateringDetails as Record<string, unknown>),
              setupInstructions: convertedInvoiceCateringDetails?.setupInstructions ?? undefined,
              takedownInstructions: convertedInvoiceCateringDetails?.takedownInstructions ?? undefined,
            };
          }
          if (Object.keys(convertedInvoiceData).length > 0) {
            await tx.invoice.update({
              where: { id: convertedInvoice.id },
              data: convertedInvoiceData,
            });
            updatedConvertedInvoice = true;
          }
        }
      }

      await tx.invoice.update({
        where: { id: quote.id },
        data: quoteData,
      });

      if (viewId) {
        const view = await tx.quoteView.findFirst({
          where: { id: viewId, invoiceId: quote.id },
          select: { id: true },
        });
        if (!view) {
          throw Object.assign(new Error("Quote activity session not found"), { code: "INVALID_INPUT" });
        }
        await tx.quoteView.update({
          where: { id: viewId },
          data: { respondedWith: response },
        });
      }

      return { expired: false, updatedConvertedInvoice };
    });

    if (responseResult.expired) {
      await quoteRepository.update(quote.id, { quoteStatus: "EXPIRED" });
      safePublishAll({ type: "quote-changed" });
      throw Object.assign(new Error("This quote has expired"), { code: "FORBIDDEN" });
    }

    const notifType = response === "ACCEPTED" ? "QUOTE_APPROVED" : "QUOTE_DECLINED";
    const verb = response === "ACCEPTED" ? "approved" : "declined";

    // Notification + email are non-critical — never fail the response
    try {
      const { notificationService } = await import("@/domains/notification/service");
      await notificationService.createAndPublish({
        userId: quote.createdBy,
        type: notifType,
        title: `${quote.quoteNumber ?? "Quote"} was ${verb}`,
        message: quote.recipientName ? `${verb.charAt(0).toUpperCase() + verb.slice(1)} by ${quote.recipientName}` : undefined,
        quoteId: quote.id,
      });
    } catch (err) {
      console.error("[respondToQuote] notification failed:", err);
    }

    try {
      const { sendEmail } = await import("@/lib/email");
      const { escapeHtml } = await import("@/lib/html");
      const quoteUrl = `${process.env.NEXTAUTH_URL}/quotes/${quote.id}`;
      await sendEmail(
        "bookstore@piercecollege.edu",
        `${quote.quoteNumber ?? "Quote"} was ${verb}`,
        `<p>${escapeHtml(quote.quoteNumber ?? "Quote")} was <strong>${verb}</strong>${quote.recipientName ? ` by ${escapeHtml(quote.recipientName)}` : ""}.</p><p><a href="${escapeHtml(quoteUrl)}">View Quote</a></p>`
      );
    } catch {
      // Email is non-critical — don't fail the response
    }

    // Always broadcast after status update, regardless of notification/email failures
    safePublishAll({ type: "quote-changed" });
    if (response === "ACCEPTED" && responseResult.updatedConvertedInvoice) {
      safePublishAll({ type: "invoice-changed" });
    }

    return { success: true, status: response };
  },

  /**
   * Get all views for a quote (for activity display on detail page).
   */
  async getViews(id: string): Promise<QuoteViewResponse[]> {
    const views = await quoteRepository.findViewsByInvoiceId(id);
    return views.map((v) => ({
      id: v.id,
      viewedAt: v.viewedAt.toISOString(),
      ipAddress: v.ipAddress,
      userAgent: v.userAgent,
      referrer: v.referrer,
      viewport: v.viewport,
      durationSeconds: v.durationSeconds,
      respondedWith: v.respondedWith,
    }));
  },

  /**
   * Get all follow-up events for a quote (for activity display on detail page).
   */
  async getFollowUps(id: string): Promise<QuoteFollowUpResponse[]> {
    const followUps = await quoteRepository.findFollowUpsByInvoiceId(id);
    return followUps.map((fu) => ({
      id: fu.id,
      type: fu.type,
      recipientEmail: fu.recipientEmail,
      subject: fu.subject,
      sentAt: fu.sentAt.toISOString(),
      metadata: fu.metadata as Record<string, unknown> | null,
    }));
  },

  /**
   * Create a quote with calculated line items and a generated quote number.
   */
  async create(input: CreateQuoteInput, creatorId: string): Promise<QuoteResponse> {
    const { items, ...quoteData } = input;
    const calculatedItems = calculateLineItems(items);
    const totalAmount = calculateTotal(
      calculatedItems,
      quoteData.marginEnabled,
      quoteData.marginPercent ? Number(quoteData.marginPercent) : undefined,
      quoteData.taxEnabled,
      quoteData.taxRate != null ? Number(quoteData.taxRate) : undefined
    );
    const quote = await withGeneratedQuoteNumber((quoteNumber) => quoteRepository.create(
      {
        ...quoteData,
        accountCode: quoteData.accountCode ?? "",
        cateringDetails: quoteData.cateringDetails as Prisma.InputJsonValue | undefined,
      },
      calculatedItems,
      totalAmount,
      creatorId,
      quoteNumber
    ));

    safePublishAll({ type: "quote-changed" });

    return toQuoteResponse(quote as unknown as NonNullable<QuoteWithRelations>);
  },

  /**
   * Update a quote. Accepted quotes remain editable until they are converted.
   * Recalculates totals if items are provided.
   */
  async update(id: string, input: UpdateQuoteInput): Promise<QuoteResponse> {
    const existing = await quoteRepository.findById(id, { includeArchived: true });
    if (!existing || existing.type !== "QUOTE") {
      throw Object.assign(new Error("Quote not found"), { code: "NOT_FOUND" });
    }
    assertQuoteIsActive(existing);
    if (
      existing.quoteStatus === "DECLINED" ||
      existing.quoteStatus === "EXPIRED" ||
      existing.quoteStatus === "REVISED"
    ) {
      throw Object.assign(
        new Error("Cannot update a quote that is declined, expired, or revised"),
        { code: "FORBIDDEN" }
      );
    }
    if ("convertedToInvoice" in existing && existing.convertedToInvoice) {
      throw Object.assign(
        new Error("Cannot update a quote that has already been converted to an invoice"),
        { code: "FORBIDDEN" }
      );
    }

    const { items, ...quoteData } = input;
    const writableQuoteData = quoteData as UpdateQuoteInput & Record<string, unknown>;
    const reopensAcceptedQuote =
      existing.quoteStatus === "ACCEPTED"
      && !existing.convertedToInvoice
      && hasMeaningfulQuoteChanges(existing, input);

    if (reopensAcceptedQuote) {
      writableQuoteData.quoteStatus = "DRAFT";
      writableQuoteData.acceptedAt = null;
      writableQuoteData.paymentMethod = null;
      writableQuoteData.paymentAccountNumber = null;
    }

    const mEnabled = Boolean(writableQuoteData.marginEnabled ?? existing.marginEnabled);
    const mPercent = writableQuoteData.marginPercent != null ? Number(writableQuoteData.marginPercent) : (existing.marginPercent != null ? Number(existing.marginPercent) : undefined);
    const tEnabled = Boolean(writableQuoteData.taxEnabled ?? existing.taxEnabled);
    const tRate = writableQuoteData.taxRate != null ? Number(writableQuoteData.taxRate) : (existing.taxRate != null ? Number(existing.taxRate) : undefined);

    const needsRecalc = items && Array.isArray(items)
      || writableQuoteData.marginEnabled !== undefined
      || writableQuoteData.marginPercent !== undefined
      || writableQuoteData.taxEnabled !== undefined
      || writableQuoteData.taxRate !== undefined;

    if (needsRecalc) {
      const sourceItems = items && Array.isArray(items)
        ? items
        : existing.items.map((item) => ({
            description: item.description,
            quantity: Number(item.quantity),
            unitPrice: Number(item.unitPrice),
            isTaxable: item.isTaxable,
            costPrice: item.costPrice != null ? Number(item.costPrice) : undefined,
            marginOverride: item.marginOverride != null ? Number(item.marginOverride) : undefined,
          }));
      const calculatedItems = calculateLineItems(sourceItems);
      const totalAmount = calculateTotal(calculatedItems, mEnabled, mPercent, tEnabled, tRate);
      const updated = await quoteRepository.update(id, writableQuoteData, calculatedItems, totalAmount);
      if (writableQuoteData.accountNumber && !existing.accountNumber) {
        closeFollowUpSeriesOnAccountNumber(id).catch(() => {});
      }
      safePublishAll({ type: "quote-changed" });
      return toQuoteResponse(updated as unknown as NonNullable<QuoteWithRelations>);
    }

    const updated = await quoteRepository.update(id, writableQuoteData);
    if (writableQuoteData.accountNumber && !existing.accountNumber) {
      closeFollowUpSeriesOnAccountNumber(id).catch(() => {});
    }
    safePublishAll({ type: "quote-changed" });
    return toQuoteResponse(updated as unknown as NonNullable<QuoteWithRelations>);
  },

  /**
   * Delete a quote, cleaning up PDF files first.
   */
  async delete(id: string): Promise<void> {
    const quote = await quoteRepository.findById(id);
    if (!quote || quote.type !== "QUOTE") {
      throw Object.assign(new Error("Quote not found"), { code: "NOT_FOUND" });
    }
    if (!["DRAFT", "SENT", "DECLINED", "EXPIRED"].includes(quote.quoteStatus ?? "")) {
      throw Object.assign(new Error("Only draft, sent, declined, or expired quotes can be deleted"), {
        code: "FORBIDDEN",
      });
    }

    if (quote.pdfPath) {
      await pdfService.deletePdfFiles(quote.pdfPath, null);
    }

    await quoteRepository.deleteById(id);
  },

  async archive(id: string, actorId: string): Promise<void> {
    const quote = await quoteRepository.findById(id, { includeArchived: true });
    if (!quote || quote.type !== "QUOTE") {
      throw Object.assign(new Error("Quote not found"), { code: "NOT_FOUND" });
    }

    await quoteRepository.archiveById(id, actorId);
    safePublishAll({ type: "quote-changed" });
  },

  async restore(id: string): Promise<QuoteResponse> {
    const quote = await quoteRepository.restoreById(id);
    safePublishAll({ type: "quote-changed" });
    return toQuoteResponse(quote as NonNullable<QuoteWithRelations>);
  },

  /**
   * Manually approve a quote (admin override when client can't use email/public link).
   */
  async approveManually(
    id: string,
    input?: {
      paymentMethod?: string;
      accountNumber?: string | null;
      cateringDetails?: Partial<CateringDetails>;
    }
  ): Promise<{ success: boolean; status: string }> {
    const quote = await quoteRepository.findById(id, { includeArchived: true });
    if (!quote || quote.type !== "QUOTE") {
      throw Object.assign(new Error("Quote not found"), { code: "NOT_FOUND" });
    }
    assertQuoteIsActive(quote);

    if (!["SENT", "SUBMITTED_EMAIL", "SUBMITTED_MANUAL"].includes(quote.quoteStatus as string)) {
      throw Object.assign(
        new Error(
          quote.quoteStatus === "ACCEPTED" || quote.quoteStatus === "DECLINED" || quote.quoteStatus === "REVISED"
            ? "This quote has already been responded to"
            : "This quote is not in a state that can be approved"
        ),
        { code: "FORBIDDEN" }
      );
    }

    // Check expiration
    if (isQuoteExpired(quote.expirationDate)) {
      await quoteRepository.update(quote.id, { quoteStatus: "EXPIRED" });
      throw Object.assign(new Error("This quote has expired"), { code: "FORBIDDEN" });
    }

    const existingCateringDetails = (quote.cateringDetails as CateringDetails | null) ?? null;
    const mergedCateringDetails = quote.isCateringEvent
      ? {
          ...(existingCateringDetails ?? {}),
          ...(input?.cateringDetails ?? {}),
          eventDate: input?.cateringDetails?.eventDate?.trim() ?? existingCateringDetails?.eventDate ?? "",
          startTime:
            input?.cateringDetails?.startTime !== undefined
              ? normalizeQuoteTimeInput(input.cateringDetails.startTime) ?? input.cateringDetails.startTime.trim()
              : existingCateringDetails?.startTime ?? "",
          endTime:
            input?.cateringDetails?.endTime !== undefined
              ? normalizeQuoteTimeInput(input.cateringDetails.endTime) ?? input.cateringDetails.endTime.trim()
              : existingCateringDetails?.endTime ?? "",
          contactName: input?.cateringDetails?.contactName?.trim() ?? existingCateringDetails?.contactName ?? "",
          contactPhone: input?.cateringDetails?.contactPhone?.trim() ?? existingCateringDetails?.contactPhone ?? "",
          location: input?.cateringDetails?.location?.trim() ?? existingCateringDetails?.location ?? "",
          setupRequired: input?.cateringDetails?.setupRequired ?? existingCateringDetails?.setupRequired ?? false,
          setupTime:
            input?.cateringDetails?.setupRequired === false
              ? ""
              : input?.cateringDetails?.setupTime !== undefined
                ? normalizeQuoteTimeInput(input.cateringDetails.setupTime) ?? input.cateringDetails.setupTime.trim()
                : existingCateringDetails?.setupTime ?? "",
          takedownRequired: input?.cateringDetails?.takedownRequired ?? existingCateringDetails?.takedownRequired ?? false,
          takedownTime:
            input?.cateringDetails?.takedownRequired === false
              ? ""
              : input?.cateringDetails?.takedownTime !== undefined
                ? normalizeQuoteTimeInput(input.cateringDetails.takedownTime) ?? input.cateringDetails.takedownTime.trim()
                : existingCateringDetails?.takedownTime ?? "",
          specialInstructions:
            input?.cateringDetails?.specialInstructions ?? existingCateringDetails?.specialInstructions ?? "",
        } satisfies CateringDetails
      : undefined;

    if (quote.isCateringEvent) {
      const missingRequirements = getMissingCustomerCateringRequirements(mergedCateringDetails);
      if (missingRequirements.length > 0) {
        throw Object.assign(
          new Error(
            `Cannot manually approve this catering quote until these event details are filled in: ${missingRequirements.join(", ")}`
          ),
          { code: "INVALID_INPUT" },
        );
      }
    }

    const normalizedPayment = normalizeQuotePaymentDetails(input);
    const acceptedAt = new Date();
    if ((normalizedPayment || mergedCateringDetails) && quote.convertedToInvoice?.id) {
      await prisma.$transaction(async (tx) => {
        const convertedInvoices = await tx.$queryRaw<Array<{
          id: string;
          status: string | null;
          paymentMethod: string | null;
          cateringDetails: Prisma.JsonValue | null;
        }>>`
          SELECT id, status, payment_method AS "paymentMethod", catering_details AS "cateringDetails"
          FROM invoices
          WHERE converted_from_quote_id = ${quote.id}
          FOR UPDATE
        `;
        const convertedInvoice = convertedInvoices[0];
        if (!convertedInvoice) {
          throw Object.assign(new Error("Converted invoice not found"), { code: "NOT_FOUND" });
        }
        if (convertedInvoice.status === "FINAL") {
          throw Object.assign(new Error("Cannot update a finalized invoice"), { code: "FORBIDDEN" });
        }
        if (normalizedPayment && convertedInvoice.paymentMethod) {
          throw Object.assign(new Error("Payment details have already been provided"), {
            code: "PAYMENT_ALREADY_RESOLVED",
          });
        }

        const quoteUpdateData: Prisma.InvoiceUpdateInput = {
          quoteStatus: "ACCEPTED",
          acceptedAt,
        };
        if (normalizedPayment) {
          quoteUpdateData.paymentMethod = normalizedPayment.paymentMethod;
          quoteUpdateData.paymentAccountNumber = normalizedPayment.paymentAccountNumber;
        }
        if (mergedCateringDetails) {
          quoteUpdateData.cateringDetails = mergedCateringDetails as unknown as Prisma.InputJsonValue;
        }

        await tx.invoice.update({
          where: { id: quote.id },
          data: quoteUpdateData,
        });

        const convertedInvoiceData: Prisma.InvoiceUpdateInput = {};
        if (normalizedPayment) {
          convertedInvoiceData.paymentMethod = normalizedPayment.paymentMethod;
          convertedInvoiceData.paymentAccountNumber = normalizedPayment.paymentAccountNumber;
        }
        if (mergedCateringDetails) {
          const convertedInvoiceCateringDetails = convertedInvoice.cateringDetails as CateringDetails | null;
          convertedInvoiceData.cateringDetails = {
            ...mergedCateringDetails,
            setupInstructions: convertedInvoiceCateringDetails?.setupInstructions ?? mergedCateringDetails.setupInstructions,
            takedownInstructions: convertedInvoiceCateringDetails?.takedownInstructions ?? mergedCateringDetails.takedownInstructions,
          };
        }

        if (Object.keys(convertedInvoiceData).length > 0) {
          await tx.invoice.update({
            where: { id: convertedInvoice.id },
            data: convertedInvoiceData,
          });
        }
      });
    } else {
      const updateData: {
        quoteStatus: "ACCEPTED";
        acceptedAt: Date;
        paymentMethod?: string;
        paymentAccountNumber?: string | null;
        cateringDetails?: Prisma.InputJsonValue;
      } = {
        quoteStatus: "ACCEPTED",
        acceptedAt,
      };
      if (normalizedPayment) {
        updateData.paymentMethod = normalizedPayment.paymentMethod;
        updateData.paymentAccountNumber = normalizedPayment.paymentAccountNumber;
      }
      if (mergedCateringDetails) {
        updateData.cateringDetails = mergedCateringDetails as unknown as Prisma.InputJsonValue;
      }

      await quoteRepository.update(quote.id, updateData);
    }

    const { notificationService } = await import("@/domains/notification/service");
    await notificationService.createAndPublish({
      userId: quote.createdBy,
      type: "QUOTE_APPROVED",
      title: `${quote.quoteNumber ?? "Quote"} was manually approved`,
      message: "Approved manually by staff",
      quoteId: quote.id,
    });

    // Send email notification to bookstore (non-critical)
    try {
      const { sendEmail } = await import("@/lib/email");
      const { escapeHtml } = await import("@/lib/html");
      const quoteUrl = `${process.env.NEXTAUTH_URL}/quotes/${quote.id}`;
      await sendEmail(
        "bookstore@piercecollege.edu",
        `${quote.quoteNumber ?? "Quote"} was manually approved`,
        `<p>${escapeHtml(quote.quoteNumber ?? "Quote")} was <strong>manually approved</strong> by staff.</p><p><a href="${escapeHtml(quoteUrl)}">View Quote</a></p>`
      );
    } catch {
      // Email is non-critical — don't fail the response
    }

    safePublishAll({ type: "quote-changed" });

    return { success: true, status: "ACCEPTED" };
  },

  /**
   * Mark a DRAFT quote as SENT and generate a share token.
   * Returns the share token for URL construction.
   */
  async markSent(id: string): Promise<{ shareToken: string }> {
    const existing = await quoteRepository.findById(id, { includeArchived: true });
    if (!existing || existing.type !== "QUOTE") {
      throw Object.assign(new Error("Quote not found"), { code: "NOT_FOUND" });
    }
    assertQuoteIsActive(existing);

    const result = await prisma.$transaction(async (tx) => {
      const lockedQuotes = await tx.$queryRaw<Array<{
        id: string;
        type: string;
        quoteStatus: string | null;
        shareToken: string | null;
      }>>`
        SELECT
          id,
          type,
          quote_status AS "quoteStatus",
          share_token AS "shareToken"
        FROM invoices
        WHERE id = ${id}
        FOR UPDATE
      `;
      const lockedQuote = lockedQuotes[0];
      if (!lockedQuote || lockedQuote.type !== "QUOTE") {
        throw Object.assign(new Error("Quote not found"), { code: "NOT_FOUND" });
      }
      if (lockedQuote.quoteStatus === "SENT") {
        const shareToken = lockedQuote.shareToken ?? crypto.randomUUID();
        if (!lockedQuote.shareToken) {
          await tx.invoice.update({
            where: { id },
            data: { shareToken },
          });
        }
        return { shareToken };
      }
      if (lockedQuote.quoteStatus !== "DRAFT") {
        throw Object.assign(
          new Error("Only draft quotes can be marked as sent"),
          { code: "FORBIDDEN" }
        );
      }
      const shareToken = lockedQuote.shareToken ?? crypto.randomUUID();
      await tx.invoice.update({
        where: { id },
        data: {
          quoteStatus: "SENT",
          shareToken,
        },
      });
      return { shareToken };
    });

    safePublishAll({ type: "quote-changed" });
    return result;
  },

  /**
   * Convert a quote to a DRAFT invoice.
   * Creates the invoice directly via Prisma (cross-domain conversion).
   */
  async convertToInvoice(id: string, creatorId: string): Promise<{ id: string; invoiceNumber: string | null }> {
    const existing = await quoteRepository.findById(id, { includeArchived: true });
    if (!existing || existing.type !== "QUOTE") {
      throw Object.assign(new Error("Quote not found"), { code: "NOT_FOUND" });
    }
    assertQuoteIsActive(existing);

    const { prisma } = await import("@/lib/prisma");
    const now = new Date();
    const invoice = await prisma.$transaction(async (tx) => {
      const lockedQuotes = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id
        FROM invoices
        WHERE id = ${id} AND type = 'QUOTE'
        FOR UPDATE
      `;
      if (lockedQuotes.length === 0) {
        throw Object.assign(new Error("Quote not found"), { code: "NOT_FOUND" });
      }

      const existingConverted = await tx.invoice.findFirst({
        where: { convertedFromQuoteId: id },
        select: { id: true, invoiceNumber: true },
      });
      if (existingConverted) {
        throw Object.assign(new Error("Quote has already been converted"), { code: "FORBIDDEN" });
      }

      const quote = await tx.invoice.findUnique({
        where: { id },
        select: {
          id: true,
          type: true,
          quoteStatus: true,
          acceptedAt: true,
          date: true,
          category: true,
          department: true,
          staffId: true,
          contactId: true,
          accountCode: true,
          accountNumber: true,
          paymentMethod: true,
          paymentAccountNumber: true,
          approvalChain: true,
          notes: true,
          totalAmount: true,
          marginEnabled: true,
          marginPercent: true,
          taxEnabled: true,
          taxRate: true,
          isCateringEvent: true,
          cateringDetails: true,
          items: {
            select: {
              description: true,
              quantity: true,
              unitPrice: true,
              extendedPrice: true,
              sortOrder: true,
              isTaxable: true,
              costPrice: true,
              marginOverride: true,
              sku: true,
            },
          },
        },
      });
      if (!quote || quote.type !== "QUOTE") {
        throw Object.assign(new Error("Quote not found"), { code: "NOT_FOUND" });
      }
      if (quote.quoteStatus !== "ACCEPTED") {
        throw Object.assign(new Error("Only accepted quotes can be converted to invoices"), {
          code: "FORBIDDEN",
        });
      }
      if (!quote.paymentMethod) {
        throw Object.assign(
          new Error("Cannot convert an accepted quote until payment details are resolved"),
          { code: "FORBIDDEN" }
        );
      }

      const createdInvoice = await tx.invoice.create({
        data: {
          type: "INVOICE",
          status: "DRAFT",
          date: quote.date,
          category: quote.category,
          department: quote.department,
          staffId: quote.staffId ?? undefined,
          contactId: quote.contactId ?? undefined,
          accountCode: quote.accountCode,
          accountNumber: quote.accountNumber,
          paymentMethod: quote.paymentMethod,
          paymentAccountNumber: quote.paymentAccountNumber ?? null,
          approvalChain: quote.approvalChain ?? [],
          notes: quote.notes,
          totalAmount: quote.totalAmount,
          marginEnabled: quote.marginEnabled,
          marginPercent: quote.marginPercent,
          taxEnabled: quote.taxEnabled,
          taxRate: quote.taxRate,
          isCateringEvent: quote.isCateringEvent,
          cateringDetails: quote.cateringDetails ?? undefined,
          createdBy: creatorId,
          convertedFromQuoteId: quote.id,
          items: {
            create: quote.items.map((item) => ({
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              extendedPrice: item.extendedPrice,
              sortOrder: item.sortOrder,
              isTaxable: item.isTaxable,
              costPrice: item.costPrice ?? undefined,
              marginOverride: item.marginOverride ?? undefined,
              sku: item.sku ?? undefined,
            })),
          },
        },
        select: { id: true, invoiceNumber: true },
      });

      await tx.invoice.update({
        where: { id },
        data: {
          quoteStatus: quote.quoteStatus,
          acceptedAt: quote.acceptedAt ?? null,
          convertedAt: now,
        },
      });

      return createdInvoice;
    });

    safePublishAll({ type: "quote-changed" });
    safePublishAll({ type: "invoice-changed" });

    return invoice;
  },

  /**
   * Create a revised copy of a declined or expired quote.
   * Marks the original as REVISED and creates a new DRAFT quote with the same data.
   */
  async createRevision(id: string, creatorId: string): Promise<QuoteResponse> {
    const { prisma } = await import("@/lib/prisma");
    const quote = await quoteRepository.findById(id, { includeArchived: true });
    if (!quote || quote.type !== "QUOTE") {
      throw Object.assign(new Error("Quote not found"), { code: "NOT_FOUND" });
    }
    assertQuoteIsActive(quote);
    if (quote.quoteStatus !== "DECLINED" && quote.quoteStatus !== "EXPIRED") {
      throw Object.assign(new Error("Only declined or expired quotes can be revised"), { code: "FORBIDDEN" });
    }

    const now = new Date();
    const dateKey = getDefaultQuoteDateKey(now);
    const expirationDateKey = getDefaultQuoteExpirationDateKey(now);

    const newQuote = await withGeneratedQuoteNumber((quoteNumber) => prisma.$transaction(async (tx) => {
      const lockedQuotes = await tx.$queryRaw<Array<{
        id: string;
        type: string;
        quoteStatus: string | null;
      }>>`
        SELECT id, type, quote_status AS "quoteStatus"
        FROM invoices
        WHERE id = ${id}
        FOR UPDATE
      `;
      const lockedQuote = lockedQuotes[0];
      if (!lockedQuote || lockedQuote.type !== "QUOTE") {
        throw Object.assign(new Error("Quote not found"), { code: "NOT_FOUND" });
      }
      if (lockedQuote.quoteStatus !== "DECLINED" && lockedQuote.quoteStatus !== "EXPIRED") {
        throw Object.assign(
          new Error("Only declined or expired quotes can be revised"),
          { code: "FORBIDDEN" },
        );
      }

      const createdQuote = await tx.invoice.create({
        data: {
          type: "QUOTE",
          status: "DRAFT",
          quoteStatus: "DRAFT",
          quoteNumber,
          date: fromDateKey(dateKey),
          category: quote.category,
          department: quote.department,
          staffId: quote.staffId ?? undefined,
          contactId: (quote as { contactId?: string | null }).contactId ?? undefined,
          accountCode: quote.accountCode,
          accountNumber: quote.accountNumber,
          approvalChain: quote.approvalChain ?? [],
          notes: quote.notes,
          recipientName: quote.recipientName,
          recipientEmail: quote.recipientEmail,
          recipientOrg: quote.recipientOrg,
          expirationDate: fromDateKey(expirationDateKey),
          totalAmount: quote.totalAmount,
          marginEnabled: quote.marginEnabled,
          marginPercent: quote.marginPercent,
          taxEnabled: quote.taxEnabled,
          taxRate: quote.taxRate,
          isCateringEvent: quote.isCateringEvent,
          cateringDetails: quote.cateringDetails ?? undefined,
          createdBy: creatorId,
          revisedFromQuoteId: quote.id,
          items: {
            create: quote.items.map((item) => ({
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              extendedPrice: item.extendedPrice,
              sortOrder: item.sortOrder,
              isTaxable: item.isTaxable,
              costPrice: item.costPrice ?? undefined,
              marginOverride: item.marginOverride ?? undefined,
              sku: item.sku ?? undefined,
            })),
          },
        },
        select: { id: true, invoiceNumber: true },
      });

      await tx.invoice.update({
        where: { id },
        data: { quoteStatus: "REVISED" },
      });

      return createdQuote;
    }));

    // Fetch the full quote with all relations for the response
    const created = await quoteRepository.findById(newQuote.id);
    if (!created) {
      throw new Error(`Failed to fetch newly created revision (id: ${newQuote.id}) as QuoteWithRelations`);
    }
    safePublishAll({ type: "quote-changed" });
    return toQuoteResponse(created);
  },

  /**
   * Duplicate a quote without changing the original's status.
   * Creates a new DRAFT quote with the same data as the source.
   */
  async duplicate(
    id: string,
    creatorId: string,
  ): Promise<{ id: string; quoteNumber: string | null }> {
    const { prisma } = await import("@/lib/prisma");
    const quote = await quoteRepository.findById(id, { includeArchived: true });
    if (!quote || quote.type !== "QUOTE") {
      throw Object.assign(new Error("Quote not found"), { code: "NOT_FOUND" });
    }
    assertQuoteIsActive(quote);

    const now = new Date();
    const dateKey = getDefaultQuoteDateKey(now);
    const expirationDateKey = getDefaultQuoteExpirationDateKey(now);

    const calculatedItems = calculateLineItems(
      quote.items.map((item) => ({
        description: item.description,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        isTaxable: item.isTaxable,
        costPrice: item.costPrice != null ? Number(item.costPrice) : undefined,
        marginOverride:
          item.marginOverride != null ? Number(item.marginOverride) : undefined,
        sku: item.sku ?? undefined,
      })),
    );

    const total = calculateTotal(
      calculatedItems,
      quote.marginEnabled,
      quote.marginPercent != null ? Number(quote.marginPercent) : undefined,
      quote.taxEnabled,
      quote.taxRate != null ? Number(quote.taxRate) : undefined,
    );

    const newQuote = await withGeneratedQuoteNumber((quoteNumber) => prisma.invoice.create({
      data: {
        type: "QUOTE",
        status: "DRAFT",
        quoteStatus: "DRAFT",
        quoteNumber,
        date: fromDateKey(dateKey),
        category: quote.category,
        department: quote.department,
        staffId: quote.staffId ?? undefined,
        contactId: (quote as { contactId?: string | null }).contactId ?? undefined,
        accountCode: quote.accountCode,
        accountNumber: quote.accountNumber,
        approvalChain: quote.approvalChain ?? [],
        notes: quote.notes,
        recipientName: quote.recipientName,
        recipientEmail: quote.recipientEmail,
        recipientOrg: quote.recipientOrg,
        expirationDate: fromDateKey(expirationDateKey),
        totalAmount: total,
        marginEnabled: quote.marginEnabled,
        marginPercent: quote.marginPercent,
        taxEnabled: quote.taxEnabled,
        taxRate: quote.taxRate,
        isCateringEvent: quote.isCateringEvent,
        cateringDetails: quote.cateringDetails ?? undefined,
        createdBy: creatorId,
        items: {
          create: calculatedItems.map((ci) => ({
            description: ci.description,
            quantity: ci.quantity,
            unitPrice: ci.unitPrice,
            extendedPrice: ci.extendedPrice,
            sortOrder: ci.sortOrder,
            isTaxable: ci.isTaxable,
            costPrice: ci.costPrice ?? undefined,
            marginOverride: ci.marginOverride ?? undefined,
            sku: ci.sku ?? undefined,
          })),
        },
      },
      select: { id: true, quoteNumber: true },
    }));

    safePublishAll({ type: "quote-changed" });
    return { id: newQuote.id, quoteNumber: newQuote.quoteNumber };
  },

  /**
   * Mark a SENT quote as submitted via email.
   */
  async markSubmittedEmail(id: string): Promise<void> {
    const existing = await quoteRepository.findById(id, { includeArchived: true });
    if (!existing || existing.type !== "QUOTE") {
      throw Object.assign(new Error("Quote not found"), { code: "NOT_FOUND" });
    }
    assertQuoteIsActive(existing);

    let shouldPublish = false;
    await prisma.$transaction(async (tx) => {
      const lockedQuotes = await tx.$queryRaw<Array<{
        id: string;
        type: string;
        quoteStatus: string | null;
      }>>`
        SELECT
          id,
          type,
          quote_status AS "quoteStatus"
        FROM invoices
        WHERE id = ${id}
        FOR UPDATE
      `;
      const lockedQuote = lockedQuotes[0];
      if (!lockedQuote || lockedQuote.type !== "QUOTE") {
        throw Object.assign(new Error("Quote not found"), { code: "NOT_FOUND" });
      }
      if (lockedQuote.quoteStatus === "SUBMITTED_EMAIL") {
        return;
      }
      if (lockedQuote.quoteStatus !== "SENT") {
        throw Object.assign(
          new Error("Only sent quotes can be marked as submitted via email"),
          { code: "FORBIDDEN" }
        );
      }
      await tx.invoice.update({
        where: { id },
        data: { quoteStatus: "SUBMITTED_EMAIL" },
      });
      shouldPublish = true;
    });

    if (shouldPublish) {
      safePublishAll({ type: "quote-changed" });
    }
  },

  /**
   * Mark a SENT quote as submitted manually.
   * Generates a share token if one does not exist.
   */
  async markSubmittedManual(id: string): Promise<void> {
    const existing = await quoteRepository.findById(id, { includeArchived: true });
    if (!existing || existing.type !== "QUOTE") {
      throw Object.assign(new Error("Quote not found"), { code: "NOT_FOUND" });
    }
    assertQuoteIsActive(existing);

    let shouldPublish = false;
    await prisma.$transaction(async (tx) => {
      const lockedQuotes = await tx.$queryRaw<Array<{
        id: string;
        type: string;
        quoteStatus: string | null;
        shareToken: string | null;
      }>>`
        SELECT
          id,
          type,
          quote_status AS "quoteStatus",
          share_token AS "shareToken"
        FROM invoices
        WHERE id = ${id}
        FOR UPDATE
      `;
      const lockedQuote = lockedQuotes[0];
      if (!lockedQuote || lockedQuote.type !== "QUOTE") {
        throw Object.assign(new Error("Quote not found"), { code: "NOT_FOUND" });
      }
      if (lockedQuote.quoteStatus === "SUBMITTED_MANUAL") {
        if (!lockedQuote.shareToken) {
          await tx.invoice.update({
            where: { id },
            data: { shareToken: crypto.randomUUID() },
          });
          shouldPublish = true;
        }
        return;
      }
      if (lockedQuote.quoteStatus !== "SENT") {
        throw Object.assign(
          new Error("Only sent quotes can be marked as submitted manually"),
          { code: "FORBIDDEN" }
        );
      }
      const data: { quoteStatus: "SUBMITTED_MANUAL"; shareToken?: string } = {
        quoteStatus: "SUBMITTED_MANUAL",
      };
      if (!lockedQuote.shareToken) {
        data.shareToken = crypto.randomUUID();
      }

      await tx.invoice.update({
        where: { id },
        data,
      });
      shouldPublish = true;
    });

    if (shouldPublish) {
      safePublishAll({ type: "quote-changed" });
    }
  },

  async declineManually(id: string): Promise<{ success: boolean; status: "DECLINED" }> {
    const quote = await quoteRepository.findById(id, { includeArchived: true });
    if (!quote || quote.type !== "QUOTE") {
      throw Object.assign(new Error("Quote not found"), { code: "NOT_FOUND" });
    }
    assertQuoteIsActive(quote);
    if (!["SENT", "SUBMITTED_EMAIL", "SUBMITTED_MANUAL"].includes(quote.quoteStatus ?? "")) {
      throw Object.assign(new Error("Only sent quotes can be declined"), { code: "FORBIDDEN" });
    }

    await quoteRepository.update(id, {
      quoteStatus: "DECLINED",
      acceptedAt: null,
      paymentMethod: null,
      paymentAccountNumber: null,
    });
    safePublishAll({ type: "quote-changed" });
    return { success: true, status: "DECLINED" };
  },

  async updateAcceptedPaymentDetails(
    id: string,
    paymentDetails?: { paymentMethod?: string; accountNumber?: string | null }
  ): Promise<QuotePublicPaymentCandidate> {
    const normalizedPayment = normalizeQuotePaymentDetails(paymentDetails);
    if (!normalizedPayment) {
      throw Object.assign(new Error("paymentMethod is required"), { code: "INVALID_INPUT" });
    }

    const quote = await quoteRepository.findById(id, { includeArchived: true });
    if (!quote || quote.type !== "QUOTE") {
      throw Object.assign(new Error("Quote not found"), { code: "NOT_FOUND" });
    }
    assertQuoteIsActive(quote);

    const paymentResult = await prisma.$transaction(async (tx) => {
      const lockedQuotes = await tx.$queryRaw<Array<{
        id: string;
        quoteStatus: string | null;
        quoteNumber: string | null;
        recipientEmail: string | null;
        createdBy: string;
        paymentMethod: string | null;
      }>>`
        SELECT
          id,
          quote_status AS "quoteStatus",
          quote_number AS "quoteNumber",
          recipient_email AS "recipientEmail",
          created_by AS "createdBy",
          payment_method AS "paymentMethod"
        FROM invoices
        WHERE id = ${id} AND type = 'QUOTE'
        FOR UPDATE
      `;
      const lockedQuote = lockedQuotes[0];
      if (!lockedQuote) {
        throw Object.assign(new Error("Quote not found"), { code: "NOT_FOUND" });
      }
      if (lockedQuote.quoteStatus !== "ACCEPTED") {
        throw Object.assign(new Error("This quote is no longer awaiting payment details"), {
          code: "FORBIDDEN",
        });
      }
      if (lockedQuote.paymentMethod) {
        throw Object.assign(new Error("Payment details have already been provided"), {
          code: "PAYMENT_ALREADY_RESOLVED",
        });
      }

      await tx.invoice.update({
        where: { id },
        data: {
          paymentMethod: normalizedPayment.paymentMethod,
          paymentAccountNumber: normalizedPayment.paymentAccountNumber,
        },
      });

      const convertedInvoices = await tx.$queryRaw<Array<{
        id: string;
        status: string | null;
        paymentMethod: string | null;
      }>>`
        SELECT id, status, payment_method AS "paymentMethod"
        FROM invoices
        WHERE converted_from_quote_id = ${id}
        FOR UPDATE
      `;
      const convertedInvoice = convertedInvoices[0];
      let updatedConvertedInvoice = false;
      if (convertedInvoice) {
        if (convertedInvoice.status === "FINAL") {
          throw Object.assign(new Error("Cannot update a finalized invoice"), { code: "FORBIDDEN" });
        }
        if (convertedInvoice.paymentMethod) {
          throw Object.assign(new Error("Payment details have already been provided"), {
            code: "PAYMENT_ALREADY_RESOLVED",
          });
        }
        await tx.invoice.update({
          where: { id: convertedInvoice.id },
          data: {
            paymentMethod: normalizedPayment.paymentMethod,
            paymentAccountNumber: normalizedPayment.paymentAccountNumber,
          },
        });
        updatedConvertedInvoice = true;
      }

      await tx.followUp.create({
        data: {
          invoiceId: id,
          type: "PAYMENT_RESOLVED",
          recipientEmail: lockedQuote.recipientEmail ?? "",
          subject: `Payment details provided for ${lockedQuote.quoteNumber ?? "quote"}`,
          metadata: {
            paymentMethod: normalizedPayment.paymentMethod,
          } as Prisma.InputJsonValue,
        },
      });

      return {
        id: lockedQuote.id,
        quoteNumber: lockedQuote.quoteNumber,
        recipientEmail: lockedQuote.recipientEmail,
        createdBy: lockedQuote.createdBy,
        updatedConvertedInvoice,
        convertedInvoiceId: convertedInvoice?.id ?? null,
      };
    });

    safePublishAll({ type: "quote-changed" });
    if (paymentResult.updatedConvertedInvoice) {
      safePublishAll({ type: "invoice-changed" });
    }

    return {
      id: paymentResult.id,
      quoteNumber: paymentResult.quoteNumber,
      recipientEmail: paymentResult.recipientEmail,
      paymentMethod: normalizedPayment.paymentMethod,
      convertedToInvoice: paymentResult.convertedInvoiceId ? { id: paymentResult.convertedInvoiceId } : null,
      updatedConvertedInvoice: paymentResult.updatedConvertedInvoice,
    };
  },

  /**
   * Generate a PDF for the quote and return the file buffer.
   */
  async generatePdf(
    id: string,
    options?: { includePublicShareLink?: boolean }
  ): Promise<{ buffer: Buffer; filename: string }> {
    const quote = await quoteRepository.findById(id, { includeArchived: true });
    if (!quote || quote.type !== "QUOTE") {
      throw Object.assign(new Error("Quote not found"), { code: "NOT_FOUND" });
    }

    const cateringRaw = quote.cateringDetails as CateringDetails | null;

    const appUrl = process.env.NEXTAUTH_URL ?? "https://laportal.montalvo.io";
    const includePublicShareLink = options?.includePublicShareLink === true;

    const buffer = await pdfService.generateQuoteBuffer({
      quoteNumber: quote.quoteNumber ?? "DRAFT",
      date: formatDateFromDate(new Date(quote.date)),
      expirationDate: quote.expirationDate
        ? formatDateFromDate(new Date(quote.expirationDate))
        : "",
      recipientName: quote.recipientName ?? "",
      recipientEmail: quote.recipientEmail ?? "",
      recipientOrg: quote.recipientOrg ?? "",
      department: quote.department,
      category: quote.category,
      accountCode: quote.accountCode,
      notes: quote.notes ?? "",
      items: quote.items.map((item) => ({
        description: item.description,
        quantity: Number(item.quantity),
        unitPrice: String(Number(item.unitPrice)),
        extendedPrice: String(Number(item.extendedPrice)),
        isTaxable: item.isTaxable,
        costPrice: item.costPrice != null ? String(Number(item.costPrice)) : null,
      })),
      totalAmount: Number(quote.totalAmount),
      marginEnabled: quote.marginEnabled,
      taxEnabled: quote.taxEnabled,
      taxRate: Number(quote.taxRate),
      isCateringEvent: quote.isCateringEvent,
      cateringDetails: cateringRaw
        ? {
            eventName: cateringRaw.eventName,
            eventDate: cateringRaw.eventDate,
            startTime: cateringRaw.startTime,
            endTime: cateringRaw.endTime,
            location: cateringRaw.location,
            contactName: cateringRaw.contactName,
            contactPhone: cateringRaw.contactPhone,
            contactEmail: cateringRaw.contactEmail,
            headcount: cateringRaw.headcount,
            setupRequired: cateringRaw.setupRequired,
            setupTime: cateringRaw.setupTime,
            setupInstructions: cateringRaw.setupInstructions,
            takedownRequired: cateringRaw.takedownRequired,
            takedownTime: cateringRaw.takedownTime,
            takedownInstructions: cateringRaw.takedownInstructions,
            specialInstructions: cateringRaw.specialInstructions,
          }
        : null,
      shareToken: includePublicShareLink ? quote.shareToken : null,
      appUrl: includePublicShareLink ? appUrl : undefined,
    });
    const filename = (quote.quoteNumber ?? "quote").replace(/[\r\n"]/g, "");

    return { buffer, filename };
  },
};

async function closeFollowUpSeriesOnAccountNumber(invoiceId: string): Promise<void> {
  const { prisma } = await import("@/lib/prisma");
  await prisma.followUp.updateMany({
    where: {
      invoiceId,
      seriesStatus: "ACTIVE",
      type: { in: ["ACCOUNT_FOLLOWUP", "ACCOUNT_FOLLOWUP_CLAIM"] },
    },
    data: { seriesStatus: "COMPLETED" },
  });
}
