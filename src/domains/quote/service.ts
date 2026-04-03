// src/domains/quote/service.ts
import * as quoteRepository from "./repository";
import { pdfService } from "@/domains/pdf/service";
import { pdfStorage } from "@/domains/pdf/storage";
import { formatDateFromDate } from "@/domains/shared/formatters";
import { calculateTotal } from "@/domains/invoice/calculations";
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
import { normalizeQuotePaymentDetails } from "./payment";

// ── DTO mapper ─────────────────────────────────────────────────────────────

type QuoteWithRelations = Awaited<ReturnType<typeof quoteRepository.findById>>;

function publicResponseErrorMessage(status: string | null | undefined): string {
  return status === "ACCEPTED" || status === "DECLINED" || status === "REVISED"
    ? "This quote has already been responded to"
    : "This quote is no longer available";
}

export function isPublicPaymentLinkAvailable(
  quote: Pick<QuoteResponse, "quoteStatus" | "convertedToInvoice">
): boolean {
  if (quote.quoteStatus === "ACCEPTED") {
    return true;
  }

  if (
    quote.quoteStatus === "SENT" ||
    quote.quoteStatus === "SUBMITTED_EMAIL" ||
    quote.quoteStatus === "SUBMITTED_MANUAL"
  ) {
    return !quote.convertedToInvoice;
  }

  return false;
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
  }));

  return {
    id: quote.id,
    quoteNumber: quote.quoteNumber,
    quoteStatus: (quote.quoteStatus ?? "DRAFT") as QuoteResponse["quoteStatus"],
    date: quote.date.toISOString(),
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
    staff,
    contact,
    creatorId: quote.creator.id,
    creatorName: quote.creator.name,
    items,
    isCateringEvent: quote.isCateringEvent,
    cateringDetails: quote.cateringDetails as CateringDetails | null,
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
    convertedToInvoice: convertedInvoiceResponse,
    revisedFromQuote: "revisedFromQuote" in quote && (quote as { revisedFromQuote?: { id: string; quoteNumber: string | null } | null }).revisedFromQuote
      ? { id: (quote as { revisedFromQuote: { id: string; quoteNumber: string | null } }).revisedFromQuote.id, quoteNumber: (quote as { revisedFromQuote: { id: string; quoteNumber: string | null } }).revisedFromQuote.quoteNumber }
      : null,
    revisedToQuote: "revisedToQuote" in quote && (quote as { revisedToQuote?: { id: string; quoteNumber: string | null } | null }).revisedToQuote
      ? { id: (quote as { revisedToQuote: { id: string; quoteNumber: string | null } }).revisedToQuote.id, quoteNumber: (quote as { revisedToQuote: { id: string; quoteNumber: string | null } }).revisedToQuote.quoteNumber }
      : null,
  };
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
    };
  });
}

// ── Service ────────────────────────────────────────────────────────────────

export const quoteService = {
  /**
   * Paginated list of quotes with filtering, mapped to DTOs.
   * Auto-expires overdue DRAFT/SENT quotes before returning results.
   */
  async list(filters: QuoteFilters) {
    const { quotes, total, page, pageSize } = await quoteRepository.findMany(filters);
    return {
      quotes: quotes.map((q) => toQuoteResponse(q as unknown as NonNullable<QuoteWithRelations>)),
      total,
      page,
      pageSize,
    };
  },

  /**
   * Single quote by ID, or null if not found / not a quote.
   * Auto-expires if past expiration date.
   */
  async getById(id: string): Promise<QuoteResponse | null> {
    const quote = await quoteRepository.findById(id);
    if (!quote || quote.type !== "QUOTE") return null;

    // Auto-expire if past expiration date
    if (
      quote.expirationDate &&
      new Date(quote.expirationDate) < new Date() &&
      (quote.quoteStatus === "DRAFT" || quote.quoteStatus === "SENT" || quote.quoteStatus === "SUBMITTED_EMAIL" || quote.quoteStatus === "SUBMITTED_MANUAL")
    ) {
      await quoteRepository.update(id, { quoteStatus: "EXPIRED" });
      quote.quoteStatus = "EXPIRED";
    }

    return toQuoteResponse(quote);
  },

  /**
   * Get a quote by its share token (for public access).
   */
  async getByShareToken(token: string): Promise<QuoteResponse | null> {
    const quote = await quoteRepository.findByShareToken(token);
    if (!quote || quote.type !== "QUOTE") return null;

    // Auto-expire if past expiration date
    if (
      quote.expirationDate &&
      new Date(quote.expirationDate) < new Date() &&
      (quote.quoteStatus === "DRAFT" || quote.quoteStatus === "SENT" || quote.quoteStatus === "SUBMITTED_EMAIL" || quote.quoteStatus === "SUBMITTED_MANUAL")
    ) {
      await quoteRepository.update(quote.id, { quoteStatus: "EXPIRED" });
      quote.quoteStatus = "EXPIRED";
    }

    return toQuoteResponse(quote);
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

      await tx.invoice.update({
        where: { id: quote.id },
        data: {
          paymentMethod: normalizedPayment.paymentMethod,
          paymentAccountNumber: normalizedPayment.paymentAccountNumber,
        },
      });

      let ownerUserId = quote.createdBy;
      const convertedInvoices = await tx.$queryRaw<Array<{
        id: string;
        status: string | null;
        paymentMethod: string | null;
        createdBy: string;
      }>>`
        SELECT id, status, payment_method AS "paymentMethod", created_by AS "createdBy"
        FROM invoices
        WHERE converted_from_quote_id = ${quote.id}
        FOR UPDATE
      `;
      const convertedInvoice = convertedInvoices[0];
      if (convertedInvoice) {
        ownerUserId = convertedInvoice.createdBy;
      }
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

      await tx.quoteFollowUp.create({
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
        ownerUserId,
        updatedConvertedInvoice,
      };
    });

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
      convertedToInvoice: quote.convertedToInvoice ? { id: quote.convertedToInvoice.id } : null,
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
    if (quote.expirationDate && new Date(quote.expirationDate) < new Date()) {
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
      if (lockedQuote.expirationDate && new Date(lockedQuote.expirationDate) < new Date()) {
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
    const quoteNumber = await quoteRepository.generateNumber();

    const quote = await quoteRepository.create(
      {
        ...quoteData,
        accountCode: quoteData.accountCode ?? "",
        cateringDetails: quoteData.cateringDetails as Prisma.InputJsonValue | undefined,
      },
      calculatedItems,
      totalAmount,
      creatorId,
      quoteNumber
    );

    safePublishAll({ type: "quote-changed" });

    return toQuoteResponse(quote as unknown as NonNullable<QuoteWithRelations>);
  },

  /**
   * Update a quote. Accepted quotes remain editable until they are converted.
   * Recalculates totals if items are provided.
   */
  async update(id: string, input: UpdateQuoteInput): Promise<QuoteResponse> {
    const existing = await quoteRepository.findById(id);
    if (!existing || existing.type !== "QUOTE") {
      throw Object.assign(new Error("Quote not found"), { code: "NOT_FOUND" });
    }
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

    const mEnabled = Boolean(quoteData.marginEnabled ?? existing.marginEnabled);
    const mPercent = quoteData.marginPercent != null ? Number(quoteData.marginPercent) : (existing.marginPercent != null ? Number(existing.marginPercent) : undefined);
    const tEnabled = Boolean(quoteData.taxEnabled ?? existing.taxEnabled);
    const tRate = quoteData.taxRate != null ? Number(quoteData.taxRate) : (existing.taxRate != null ? Number(existing.taxRate) : undefined);

    const needsRecalc = items && Array.isArray(items)
      || quoteData.marginEnabled !== undefined
      || quoteData.marginPercent !== undefined
      || quoteData.taxEnabled !== undefined
      || quoteData.taxRate !== undefined;

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
      const updated = await quoteRepository.update(id, quoteData, calculatedItems, totalAmount);
      safePublishAll({ type: "quote-changed" });
      return toQuoteResponse(updated as unknown as NonNullable<QuoteWithRelations>);
    }

    const updated = await quoteRepository.update(id, quoteData);
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

    if (quote.pdfPath) {
      await pdfService.deletePdfFiles(quote.pdfPath, null);
    }

    await quoteRepository.deleteById(id);
  },

  /**
   * Manually approve a quote (admin override when client can't use email/public link).
   */
  async approveManually(
    id: string,
    paymentDetails?: { paymentMethod?: string; accountNumber?: string | null }
  ): Promise<{ success: boolean; status: string }> {
    const quote = await quoteRepository.findById(id);
    if (!quote || quote.type !== "QUOTE") {
      throw Object.assign(new Error("Quote not found"), { code: "NOT_FOUND" });
    }

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
    if (quote.expirationDate && new Date(quote.expirationDate) < new Date()) {
      await quoteRepository.update(quote.id, { quoteStatus: "EXPIRED" });
      throw Object.assign(new Error("This quote has expired"), { code: "FORBIDDEN" });
    }

    const normalizedPayment = normalizeQuotePaymentDetails(paymentDetails);
    const acceptedAt = new Date();
    if (normalizedPayment && quote.convertedToInvoice?.id) {
      await prisma.$transaction(async (tx) => {
        const convertedInvoices = await tx.$queryRaw<Array<{
          id: string;
          status: string | null;
          paymentMethod: string | null;
        }>>`
          SELECT id, status, payment_method AS "paymentMethod"
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
        if (convertedInvoice.paymentMethod) {
          throw Object.assign(new Error("Payment details have already been provided"), {
            code: "PAYMENT_ALREADY_RESOLVED",
          });
        }

        await tx.invoice.update({
          where: { id: quote.id },
          data: {
            quoteStatus: "ACCEPTED",
            acceptedAt,
            paymentMethod: normalizedPayment.paymentMethod,
            paymentAccountNumber: normalizedPayment.paymentAccountNumber,
          },
        });

        await tx.invoice.update({
          where: { id: convertedInvoice.id },
          data: {
            paymentMethod: normalizedPayment.paymentMethod,
            paymentAccountNumber: normalizedPayment.paymentAccountNumber,
          },
        });
      });
    } else {
      const updateData: {
        quoteStatus: "ACCEPTED";
        acceptedAt: Date;
        paymentMethod?: string;
        paymentAccountNumber?: string | null;
      } = {
        quoteStatus: "ACCEPTED",
        acceptedAt,
      };
      if (normalizedPayment) {
        updateData.paymentMethod = normalizedPayment.paymentMethod;
        updateData.paymentAccountNumber = normalizedPayment.paymentAccountNumber;
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
    const quote = await quoteRepository.findById(id);
    if (!quote || quote.type !== "QUOTE") {
      throw Object.assign(new Error("Quote not found"), { code: "NOT_FOUND" });
    }
    if (quote.quoteStatus !== "DRAFT") {
      throw Object.assign(
        new Error("Only draft quotes can be marked as sent"),
        { code: "FORBIDDEN" }
      );
    }
    const shareToken = quote.shareToken ?? crypto.randomUUID();
    await quoteRepository.markSentWithToken(id, shareToken);
    safePublishAll({ type: "quote-changed" });
    return { shareToken };
  },

  /**
   * Convert a quote to a DRAFT invoice.
   * Creates the invoice directly via Prisma (cross-domain conversion).
   */
  async convertToInvoice(id: string, creatorId: string): Promise<{ id: string; invoiceNumber: string | null }> {
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
            },
          },
        },
      });
      if (!quote || quote.type !== "QUOTE") {
        throw Object.assign(new Error("Quote not found"), { code: "NOT_FOUND" });
      }
      if (quote.quoteStatus === "DECLINED" || quote.quoteStatus === "EXPIRED" || quote.quoteStatus === "REVISED") {
        throw Object.assign(
          new Error("Cannot convert a declined, expired, or revised quote"),
          { code: "FORBIDDEN" }
        );
      }
      if (quote.quoteStatus === "ACCEPTED" && !quote.paymentMethod) {
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
    const quote = await quoteRepository.findById(id);
    if (!quote || quote.type !== "QUOTE") {
      throw Object.assign(new Error("Quote not found"), { code: "NOT_FOUND" });
    }
    if (quote.quoteStatus !== "DECLINED" && quote.quoteStatus !== "EXPIRED") {
      throw Object.assign(new Error("Only declined or expired quotes can be revised"), { code: "FORBIDDEN" });
    }

    const now = new Date();
    const expirationDate = new Date(now);
    expirationDate.setDate(expirationDate.getDate() + 30);

    const quoteNumber = await quoteRepository.generateNumber();

    const [newQuote] = await prisma.$transaction([
      prisma.invoice.create({
        data: {
          type: "QUOTE",
          status: "DRAFT",
          quoteStatus: "DRAFT",
          quoteNumber,
          date: now,
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
          expirationDate,
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
            })),
          },
        },
        select: { id: true, invoiceNumber: true },
      }),
      prisma.invoice.update({
        where: { id },
        data: { quoteStatus: "REVISED" },
      }),
    ]);

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
    const quote = await quoteRepository.findById(id);
    if (!quote || quote.type !== "QUOTE") {
      throw Object.assign(new Error("Quote not found"), { code: "NOT_FOUND" });
    }

    const now = new Date();
    const expirationDate = new Date(now);
    expirationDate.setDate(expirationDate.getDate() + 30);

    const quoteNumber = await quoteRepository.generateNumber();

    const calculatedItems = calculateLineItems(
      quote.items.map((item) => ({
        description: item.description,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        isTaxable: item.isTaxable,
        costPrice: item.costPrice != null ? Number(item.costPrice) : undefined,
        marginOverride:
          item.marginOverride != null ? Number(item.marginOverride) : undefined,
      })),
    );

    const total = calculateTotal(
      calculatedItems,
      quote.marginEnabled,
      quote.marginPercent != null ? Number(quote.marginPercent) : undefined,
      quote.taxEnabled,
      quote.taxRate != null ? Number(quote.taxRate) : undefined,
    );

    const newQuote = await prisma.invoice.create({
      data: {
        type: "QUOTE",
        status: "DRAFT",
        quoteStatus: "DRAFT",
        quoteNumber,
        date: now,
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
        expirationDate,
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
          })),
        },
      },
      select: { id: true, quoteNumber: true },
    });

    safePublishAll({ type: "quote-changed" });
    return { id: newQuote.id, quoteNumber: newQuote.quoteNumber };
  },

  /**
   * Mark a SENT quote as submitted via email.
   */
  async markSubmittedEmail(id: string): Promise<void> {
    const quote = await quoteRepository.findById(id);
    if (!quote || quote.type !== "QUOTE") {
      throw Object.assign(new Error("Quote not found"), { code: "NOT_FOUND" });
    }
    if (quote.quoteStatus !== "SENT") {
      throw Object.assign(new Error("Only sent quotes can be marked as submitted via email"), { code: "FORBIDDEN" });
    }
    await quoteRepository.update(id, { quoteStatus: "SUBMITTED_EMAIL" });
    safePublishAll({ type: "quote-changed" });
  },

  /**
   * Mark a DRAFT or SENT quote as submitted manually.
   * Generates a share token if one does not exist.
   */
  async markSubmittedManual(id: string): Promise<void> {
    const quote = await quoteRepository.findById(id);
    if (!quote || quote.type !== "QUOTE") {
      throw Object.assign(new Error("Quote not found"), { code: "NOT_FOUND" });
    }
    if (quote.quoteStatus !== "SENT" && quote.quoteStatus !== "DRAFT") {
      throw Object.assign(new Error("Only draft or sent quotes can be marked as submitted manually"), { code: "FORBIDDEN" });
    }
    const data: Record<string, unknown> = { quoteStatus: "SUBMITTED_MANUAL" };
    if (!quote.shareToken) {
      data.shareToken = crypto.randomUUID();
    }
    await quoteRepository.update(id, data);
    safePublishAll({ type: "quote-changed" });
  },

  /**
   * Generate a PDF for the quote and return the file buffer.
   */
  async generatePdf(
    id: string,
    options?: { includePublicShareLink?: boolean }
  ): Promise<{ buffer: Buffer; filename: string }> {
    const quote = await quoteRepository.findById(id);
    if (!quote || quote.type !== "QUOTE") {
      throw Object.assign(new Error("Quote not found"), { code: "NOT_FOUND" });
    }

    const cateringRaw = quote.cateringDetails as CateringDetails | null;

    const appUrl = process.env.NEXTAUTH_URL ?? "https://laportal.montalvo.io";
    const includePublicShareLink = options?.includePublicShareLink === true;

    const pdfPath = await pdfService.generateQuote({
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
    }, pdfStorage.quoteKey(id, quote.quoteNumber ?? "quote"));

    const buffer = await pdfService.readPdf(pdfPath);
    const filename = (quote.quoteNumber ?? "quote").replace(/[\r\n"]/g, "");

    return { buffer, filename };
  },
};
