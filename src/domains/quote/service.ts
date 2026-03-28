// src/domains/quote/service.ts
import * as quoteRepository from "./repository";
import { pdfService } from "@/domains/pdf/service";
import { formatDateFromDate } from "@/domains/shared/formatters";
import type {
  QuoteResponse,
  QuoteItemResponse,
  QuoteFilters,
  CreateQuoteInput,
  UpdateQuoteInput,
  QuoteViewResponse,
} from "./types";
import type { StaffSummary } from "@/domains/staff/types";

// ── DTO mapper ─────────────────────────────────────────────────────────────

type QuoteWithRelations = Awaited<ReturnType<typeof quoteRepository.findById>>;

function toQuoteResponse(quote: NonNullable<QuoteWithRelations>): QuoteResponse {
  const staff: StaffSummary = {
    id: quote.staff.id,
    name: quote.staff.name,
    title: quote.staff.title,
    department: quote.staff.department,
  };

  const items: QuoteItemResponse[] = quote.items.map((item) => ({
    id: item.id,
    description: item.description,
    quantity: Number(item.quantity),
    unitPrice: Number(item.unitPrice),
    extendedPrice: Number(item.extendedPrice),
    sortOrder: item.sortOrder,
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
    creatorId: quote.creator.id,
    creatorName: quote.creator.name,
    items,
    convertedToInvoice: "convertedToInvoice" in quote
      ? (quote.convertedToInvoice as { id: string; invoiceNumber: string | null } | null)
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
    };
  });
}

function calculateTotal(items: { extendedPrice: number }[]): number {
  return items.reduce((sum, item) => sum + item.extendedPrice, 0);
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
      (quote.quoteStatus === "DRAFT" || quote.quoteStatus === "SENT")
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
      (quote.quoteStatus === "DRAFT" || quote.quoteStatus === "SENT")
    ) {
      await quoteRepository.update(quote.id, { quoteStatus: "EXPIRED" });
      quote.quoteStatus = "EXPIRED";
    }

    return toQuoteResponse(quote);
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

    return { viewId: view.id };
  },

  /**
   * Update the duration of a page view (called via sendBeacon).
   */
  async updateViewDuration(viewId: string, durationSeconds: number): Promise<void> {
    await quoteRepository.updateViewDuration(viewId, durationSeconds);
  },

  /**
   * Handle a recipient's response (approve/decline) to a quote.
   */
  async respondToQuote(
    token: string,
    response: "ACCEPTED" | "DECLINED",
    viewId?: string
  ): Promise<{ success: boolean; status: string } | null> {
    const quote = await quoteRepository.findByShareToken(token);
    if (!quote || quote.type !== "QUOTE") return null;

    if (quote.quoteStatus !== "SENT") {
      throw Object.assign(
        new Error(
          quote.quoteStatus === "ACCEPTED" || quote.quoteStatus === "DECLINED"
            ? "This quote has already been responded to"
            : "This quote is no longer available"
        ),
        { code: "FORBIDDEN" }
      );
    }

    // Check expiration
    if (quote.expirationDate && new Date(quote.expirationDate) < new Date()) {
      await quoteRepository.update(quote.id, { quoteStatus: "EXPIRED" });
      throw Object.assign(new Error("This quote has expired"), { code: "FORBIDDEN" });
    }

    await quoteRepository.update(quote.id, { quoteStatus: response });

    if (viewId) {
      await quoteRepository.updateViewResponse(viewId, response);
    }

    const { notificationService } = await import("@/domains/notification/service");
    const notifType = response === "ACCEPTED" ? "QUOTE_APPROVED" : "QUOTE_DECLINED";
    const verb = response === "ACCEPTED" ? "approved" : "declined";
    await notificationService.createAndPublishToAll({
      type: notifType,
      title: `${quote.quoteNumber ?? "Quote"} was ${verb}`,
      message: quote.recipientName ? `${verb.charAt(0).toUpperCase() + verb.slice(1)} by ${quote.recipientName}` : undefined,
      quoteId: quote.id,
    });

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
   * Create a quote with calculated line items and a generated quote number.
   */
  async create(input: CreateQuoteInput, creatorId: string): Promise<QuoteResponse> {
    const { items, ...quoteData } = input;
    const calculatedItems = calculateLineItems(items);
    const totalAmount = calculateTotal(calculatedItems);
    const quoteNumber = await quoteRepository.generateNumber();

    const quote = await quoteRepository.create(
      { ...quoteData, accountCode: quoteData.accountCode ?? "" },
      calculatedItems,
      totalAmount,
      creatorId,
      quoteNumber
    );

    return toQuoteResponse(quote as unknown as NonNullable<QuoteWithRelations>);
  },

  /**
   * Update a quote. Blocks updates on ACCEPTED/DECLINED/EXPIRED quotes.
   * Recalculates totals if items are provided.
   */
  async update(id: string, input: UpdateQuoteInput): Promise<QuoteResponse> {
    const existing = await quoteRepository.findById(id);
    if (!existing || existing.type !== "QUOTE") {
      throw Object.assign(new Error("Quote not found"), { code: "NOT_FOUND" });
    }
    if (
      existing.quoteStatus === "ACCEPTED" ||
      existing.quoteStatus === "DECLINED" ||
      existing.quoteStatus === "EXPIRED"
    ) {
      throw Object.assign(
        new Error("Cannot update a quote that is accepted, declined, or expired"),
        { code: "FORBIDDEN" }
      );
    }

    const { items, ...quoteData } = input;

    if (items && Array.isArray(items)) {
      const calculatedItems = calculateLineItems(items);
      const totalAmount = calculateTotal(calculatedItems);
      const updated = await quoteRepository.update(id, quoteData, calculatedItems, totalAmount);
      return toQuoteResponse(updated as unknown as NonNullable<QuoteWithRelations>);
    }

    const updated = await quoteRepository.update(id, quoteData);
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
    return { shareToken };
  },

  /**
   * Convert a quote to a DRAFT invoice.
   * Creates the invoice directly via Prisma (cross-domain conversion).
   */
  async convertToInvoice(id: string, creatorId: string): Promise<{ id: string; invoiceNumber: string | null }> {
    const { prisma } = await import("@/lib/prisma");

    const quote = await quoteRepository.findById(id);
    if (!quote || quote.type !== "QUOTE") {
      throw Object.assign(new Error("Quote not found"), { code: "NOT_FOUND" });
    }
    if (quote.quoteStatus === "ACCEPTED") {
      throw Object.assign(new Error("Quote has already been converted"), { code: "FORBIDDEN" });
    }
    if (quote.quoteStatus === "DECLINED" || quote.quoteStatus === "EXPIRED") {
      throw Object.assign(
        new Error("Cannot convert a declined or expired quote"),
        { code: "FORBIDDEN" }
      );
    }

    const now = new Date();

    const [invoice] = await prisma.$transaction([
      prisma.invoice.create({
        data: {
          type: "INVOICE",
          status: "DRAFT",
          date: quote.date,
          category: quote.category,
          department: quote.department,
          staffId: quote.staffId,
          accountCode: quote.accountCode,
          accountNumber: quote.accountNumber,
          approvalChain: quote.approvalChain ?? [],
          notes: quote.notes,
          totalAmount: quote.totalAmount,
          createdBy: creatorId,
          convertedFromQuoteId: quote.id,
          items: {
            create: quote.items.map((item) => ({
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              extendedPrice: item.extendedPrice,
              sortOrder: item.sortOrder,
            })),
          },
        },
        select: { id: true, invoiceNumber: true },
      }),
      prisma.invoice.update({
        where: { id },
        data: { quoteStatus: "ACCEPTED", convertedAt: now },
      }),
    ]);

    return invoice;
  },

  /**
   * Generate a PDF for the quote and return the file buffer.
   */
  async generatePdf(id: string): Promise<{ buffer: Buffer; filename: string }> {
    const quote = await quoteRepository.findById(id);
    if (!quote || quote.type !== "QUOTE") {
      throw Object.assign(new Error("Quote not found"), { code: "NOT_FOUND" });
    }

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
      })),
      totalAmount: Number(quote.totalAmount),
    });

    const buffer = await pdfService.readPdf(pdfPath);
    const filename = quote.quoteNumber ?? "quote";

    return { buffer, filename };
  },
};
