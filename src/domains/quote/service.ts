// src/domains/quote/service.ts
import * as quoteRepository from "./repository";
import { pdfService } from "@/domains/pdf/service";
import { formatDateFromDate, formatCurrency } from "@/domains/shared/formatters";
import type {
  QuoteResponse,
  QuoteItemResponse,
  QuoteFilters,
  CreateQuoteInput,
  UpdateQuoteInput,
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
    createdAt: quote.createdAt.toISOString(),
    staff,
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
   * Mark a DRAFT quote as SENT.
   */
  async markSent(id: string): Promise<void> {
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
    await quoteRepository.markSent(id);
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
        unitPrice: formatCurrency(Number(item.unitPrice)),
        extendedPrice: formatCurrency(Number(item.extendedPrice)),
      })),
      totalAmount: Number(quote.totalAmount),
    });

    const buffer = await pdfService.readPdf(pdfPath);
    const filename = quote.quoteNumber ?? "quote";

    return { buffer, filename };
  },
};
