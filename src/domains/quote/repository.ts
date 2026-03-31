// src/domains/quote/repository.ts
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { QuoteFilters } from "./types";

// ── Shared include shapes ──────────────────────────────────────────────────

const listInclude = {
  staff: { select: { id: true, name: true, title: true, department: true } },
  contact: { select: { id: true, name: true, email: true, phone: true, org: true, department: true, title: true, notes: true, createdAt: true } },
  creator: { select: { id: true, name: true, username: true } },
  items: { orderBy: { sortOrder: "asc" as const } },
} as const;

const detailInclude = {
  staff: {
    select: {
      id: true,
      name: true,
      title: true,
      department: true,
      extension: true,
      email: true,
    },
  },
  contact: { select: { id: true, name: true, email: true, phone: true, org: true, department: true, title: true, notes: true, createdAt: true } },
  creator: { select: { id: true, name: true, username: true } },
  items: { orderBy: { sortOrder: "asc" as const } },
  convertedToInvoice: { select: { id: true, invoiceNumber: true } },
  revisedFromQuote: { select: { id: true, quoteNumber: true } },
  revisedToQuote: { select: { id: true, quoteNumber: true } },
} as const;

// ── Where builder ──────────────────────────────────────────────────────────

function buildWhere(filters: QuoteFilters): Prisma.InvoiceWhereInput {
  const where: Prisma.InvoiceWhereInput = { type: "QUOTE" };

  if (filters.quoteStatus && filters.quoteStatus !== "all") {
    where.quoteStatus = filters.quoteStatus as Prisma.InvoiceWhereInput["quoteStatus"];
  }
  if (filters.department) {
    where.department = { contains: filters.department, mode: "insensitive" };
  }
  if (filters.category) {
    where.category = filters.category as Prisma.InvoiceWhereInput["category"];
  }
  if (filters.creatorId) {
    where.createdBy = filters.creatorId;
  }
  if (filters.dateFrom || filters.dateTo) {
    where.date = {};
    if (filters.dateFrom) where.date.gte = new Date(filters.dateFrom);
    if (filters.dateTo) where.date.lte = new Date(filters.dateTo);
  }
  if (filters.search) {
    where.OR = [
      { quoteNumber: { contains: filters.search, mode: "insensitive" } },
      { department: { contains: filters.search, mode: "insensitive" } },
      { recipientName: { contains: filters.search, mode: "insensitive" } },
      { recipientOrg: { contains: filters.search, mode: "insensitive" } },
      { staff: { name: { contains: filters.search, mode: "insensitive" } } },
      { contact: { name: { contains: filters.search, mode: "insensitive" } } },
      {
        items: {
          some: { description: { contains: filters.search, mode: "insensitive" } },
        },
      },
    ];
  }

  return where;
}

// ── Allowed sort fields ────────────────────────────────────────────────────

const ALLOWED_SORT_FIELDS = new Set([
  "createdAt",
  "updatedAt",
  "date",
  "quoteNumber",
  "totalAmount",
  "department",
  "expirationDate",
]);

// ── Repository methods ─────────────────────────────────────────────────────

/**
 * Auto-expire DRAFT/SENT quotes that are past their expiration date.
 */
export async function expireOverdue(): Promise<void> {
  await prisma.invoice.updateMany({
    where: {
      type: "QUOTE",
      quoteStatus: { in: ["DRAFT", "SENT", "SUBMITTED_EMAIL", "SUBMITTED_MANUAL"] },
      expirationDate: { lt: new Date() },
    },
    data: { quoteStatus: "EXPIRED" },
  });
}

/**
 * Paginated list of quotes with complex filtering.
 */
export async function findMany(filters: QuoteFilters) {
  // Auto-expire before listing
  await expireOverdue();

  const where = buildWhere(filters);
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.max(1, filters.pageSize ?? 20);
  const sortField = ALLOWED_SORT_FIELDS.has(filters.sortBy ?? "")
    ? (filters.sortBy ?? "createdAt")
    : "createdAt";
  const sortDir = filters.sortOrder ?? "desc";

  const [quotes, total] = await prisma.$transaction([
    prisma.invoice.findMany({
      where,
      include: listInclude,
      orderBy: { [sortField]: sortDir },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.invoice.count({ where }),
  ]);

  return { quotes, total, page, pageSize };
}

/**
 * Single quote with all relations (staff with extension/email, items, convertedToInvoice).
 */
export async function findById(id: string) {
  return prisma.invoice.findUnique({
    where: { id },
    include: detailInclude,
  });
}

/**
 * Find a quote by its public share token.
 */
export async function findByShareToken(token: string) {
  return prisma.invoice.findUnique({
    where: { shareToken: token },
    include: detailInclude,
  });
}

export async function findAcceptedPublicPaymentCandidate(token: string) {
  return prisma.invoice.findFirst({
    where: { shareToken: token, type: "QUOTE", quoteStatus: "ACCEPTED" },
    select: {
      id: true,
      quoteNumber: true,
      recipientEmail: true,
      createdBy: true,
      paymentMethod: true,
      convertedToInvoice: { select: { id: true, createdBy: true } },
    },
  });
}

export interface CalculatedLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  extendedPrice: number;
  sortOrder: number;
  isTaxable?: boolean;
  marginOverride?: number;
  costPrice?: number;
}

/**
 * Create a quote with pre-calculated line items.
 */
export async function create(
  input: {
    date: string;
    staffId?: string;
    contactId?: string;
    department: string;
    category: string;
    accountCode?: string;
    accountNumber?: string;
    approvalChain?: string[];
    notes?: string;
    expirationDate: string;
    recipientName: string;
    recipientEmail?: string;
    recipientOrg?: string;
    isCateringEvent?: boolean;
    cateringDetails?: Prisma.InputJsonValue;
    marginEnabled?: boolean;
    marginPercent?: number;
    taxEnabled?: boolean;
  },
  calculatedItems: CalculatedLineItem[],
  totalAmount: number,
  creatorId: string,
  quoteNumber: string
) {
  const { date, expirationDate, accountCode, isCateringEvent, cateringDetails, marginEnabled, marginPercent, taxEnabled, ...quoteData } = input;

  return prisma.invoice.create({
    data: {
      ...quoteData,
      accountCode: accountCode ?? "",
      type: "QUOTE",
      quoteStatus: "DRAFT",
      quoteNumber,
      date: new Date(date),
      expirationDate: new Date(expirationDate),
      createdBy: creatorId,
      totalAmount,
      isCateringEvent: isCateringEvent ?? false,
      cateringDetails: cateringDetails ?? undefined,
      marginEnabled: marginEnabled ?? false,
      marginPercent: marginPercent ?? undefined,
      taxEnabled: taxEnabled ?? false,
      items: {
        create: calculatedItems.map((item) => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          extendedPrice: item.extendedPrice,
          sortOrder: item.sortOrder,
          isTaxable: item.isTaxable ?? true,
          marginOverride: item.marginOverride ?? undefined,
          costPrice: item.costPrice ?? undefined,
        })),
      },
    },
    include: detailInclude,
  });
}

/**
 * Update a quote, optionally replacing all line items in a transaction.
 */
export async function update(
  id: string,
  input: {
    date?: string;
    expirationDate?: string;
    [key: string]: unknown;
  },
  calculatedItems?: CalculatedLineItem[],
  totalAmount?: number
) {
  const { date, expirationDate, ...rest } = input;
  const updateData: Record<string, unknown> = { ...rest };
  if (date) updateData.date = new Date(date as string);
  if (expirationDate) updateData.expirationDate = new Date(expirationDate as string);

  if (calculatedItems != null && totalAmount != null) {
    updateData.totalAmount = totalAmount;

    const [, quote] = await prisma.$transaction([
      prisma.invoiceItem.deleteMany({ where: { invoiceId: id } }),
      prisma.invoice.update({
        where: { id },
        data: {
          ...updateData,
          items: {
            create: calculatedItems.map((item) => ({
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              extendedPrice: item.extendedPrice,
              sortOrder: item.sortOrder,
              isTaxable: item.isTaxable ?? true,
              marginOverride: item.marginOverride ?? undefined,
              costPrice: item.costPrice ?? undefined,
            })),
          },
        },
        include: detailInclude,
      }),
    ]);

    return quote;
  }

  return prisma.invoice.update({
    where: { id },
    data: updateData,
    include: detailInclude,
  });
}

/**
 * Hard delete a quote (cascade removes items via DB constraint).
 */
export async function deleteById(id: string) {
  return prisma.invoice.delete({ where: { id } });
}

/**
 * Mark a quote as SENT.
 */
export async function markSent(id: string) {
  return prisma.invoice.update({
    where: { id },
    data: { quoteStatus: "SENT" },
  });
}

/**
 * Mark a quote as SENT and generate a share token.
 */
export async function markSentWithToken(id: string, shareToken: string) {
  return prisma.invoice.update({
    where: { id },
    data: { quoteStatus: "SENT", shareToken },
  });
}

/**
 * Get the share token for an existing quote.
 */
export async function getShareToken(id: string): Promise<string | null> {
  const result = await prisma.invoice.findUnique({
    where: { id },
    select: { shareToken: true },
  });
  return result?.shareToken ?? null;
}

/**
 * Mark a quote as ACCEPTED and record conversion timestamp.
 */
export async function markAccepted(id: string) {
  return prisma.invoice.update({
    where: { id },
    data: { quoteStatus: "ACCEPTED", convertedAt: new Date() },
  });
}

/**
 * Generate the next quote number in the format Q-YYYY-NNNN.
 */
export async function generateNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `Q-${year}-`;

  const latest = await prisma.invoice.findFirst({
    where: {
      type: "QUOTE",
      quoteNumber: { startsWith: prefix },
    },
    orderBy: { quoteNumber: "desc" },
    select: { quoteNumber: true },
  });

  let nextSeq = 1;
  if (latest?.quoteNumber) {
    const seqStr = latest.quoteNumber.replace(prefix, "");
    const parsed = parseInt(seqStr, 10);
    if (!isNaN(parsed)) nextSeq = parsed + 1;
  }

  return `${prefix}${String(nextSeq).padStart(4, "0")}`;
}

/**
 * Record a quote view.
 */
export async function createView(data: {
  invoiceId: string;
  ipAddress?: string;
  userAgent?: string;
  referrer?: string;
  viewport?: string;
}) {
  return prisma.quoteView.create({ data });
}

/**
 * Update view duration (called via sendBeacon on page unload).
 */
export async function updateViewDuration(viewId: string, durationSeconds: number) {
  return prisma.quoteView.update({
    where: { id: viewId },
    data: { durationSeconds },
  });
}

/**
 * Update the respondedWith field on a view.
 */
export async function updateViewResponse(viewId: string, respondedWith: string) {
  return prisma.quoteView.update({
    where: { id: viewId },
    data: { respondedWith },
  });
}

export async function syncPublicPaymentDetails(
  quoteId: string,
  paymentDetails: { paymentMethod: string; paymentAccountNumber: string | null },
  convertedInvoiceId?: string
) {
  return prisma.$transaction(async (tx) => {
    await tx.invoice.update({
      where: { id: quoteId },
      data: paymentDetails,
    });

    if (!convertedInvoiceId) return;

    const convertedInvoice = await tx.invoice.findUnique({
      where: { id: convertedInvoiceId },
      select: { status: true },
    });

    if (!convertedInvoice) {
      throw Object.assign(new Error("Converted invoice not found"), { code: "NOT_FOUND" });
    }

    if (convertedInvoice.status === "FINAL") {
      throw Object.assign(new Error("Cannot update a finalized invoice"), { code: "FORBIDDEN" });
    }

    await tx.invoice.update({
      where: { id: convertedInvoiceId },
      data: paymentDetails,
    });
  });
}

export async function applyPublicPaymentResolution(
  quoteId: string,
  paymentDetails: { paymentMethod: string; paymentAccountNumber: string | null },
  followUp: {
    recipientEmail: string;
    subject: string;
    metadata: Prisma.InputJsonValue;
  },
  convertedInvoiceId?: string,
) {
  return prisma.$transaction(async (tx) => {
    const lockedQuote = await tx.$queryRaw<Array<{
      id: string;
      paymentMethod: string | null;
      quoteStatus: string | null;
    }>>`
      SELECT id, payment_method AS "paymentMethod", quote_status AS "quoteStatus"
      FROM invoices
      WHERE id = ${quoteId}
      FOR UPDATE
    `;

    if (lockedQuote.length === 0) {
      throw Object.assign(new Error("Quote not found"), { code: "NOT_FOUND" });
    }

    if (lockedQuote[0]?.paymentMethod) {
      throw Object.assign(new Error("Payment details have already been provided"), {
        code: "PAYMENT_ALREADY_RESOLVED",
      });
    }

    if (lockedQuote[0]?.quoteStatus !== "ACCEPTED") {
      throw Object.assign(new Error("This quote is no longer awaiting payment details"), {
        code: "FORBIDDEN",
      });
    }

    await tx.invoice.update({
      where: { id: quoteId },
      data: paymentDetails,
    });

    if (convertedInvoiceId) {
      const convertedInvoice = await tx.invoice.findUnique({
        where: { id: convertedInvoiceId },
        select: { status: true },
      });

      if (!convertedInvoice) {
        throw Object.assign(new Error("Converted invoice not found"), { code: "NOT_FOUND" });
      }

      if (convertedInvoice.status === "FINAL") {
        throw Object.assign(new Error("Cannot update a finalized invoice"), { code: "FORBIDDEN" });
      }

      await tx.invoice.update({
        where: { id: convertedInvoiceId },
        data: paymentDetails,
      });
    }

    await tx.quoteFollowUp.create({
      data: {
        invoiceId: quoteId,
        type: "PAYMENT_RESOLVED",
        recipientEmail: followUp.recipientEmail,
        subject: followUp.subject,
        metadata: followUp.metadata,
      },
    });
  });
}

export async function applyPublicQuoteResponse(
  quoteId: string,
  input: {
    response: "ACCEPTED" | "DECLINED";
    acceptedAt?: Date;
    paymentDetails?: { paymentMethod: string; paymentAccountNumber: string | null };
    cateringDetails?: Prisma.InputJsonValue;
    convertedInvoiceId?: string;
    viewId?: string;
  },
) {
  return prisma.$transaction(async (tx) => {
    const quoteData: Prisma.InvoiceUpdateInput = {
      quoteStatus: input.response,
    };

    if (input.response === "ACCEPTED") {
      quoteData.acceptedAt = input.acceptedAt;

      if (input.paymentDetails) {
        quoteData.paymentMethod = input.paymentDetails.paymentMethod;
        quoteData.paymentAccountNumber = input.paymentDetails.paymentAccountNumber;
      }

      if (input.cateringDetails !== undefined) {
        quoteData.cateringDetails = input.cateringDetails;
      }
    }

    await tx.invoice.update({
      where: { id: quoteId },
      data: quoteData,
    });

    if (input.response === "ACCEPTED" && input.convertedInvoiceId) {
      const convertedInvoice = await tx.invoice.findUnique({
        where: { id: input.convertedInvoiceId },
        select: { status: true },
      });

      if (!convertedInvoice) {
        throw Object.assign(new Error("Converted invoice not found"), { code: "NOT_FOUND" });
      }

      if (convertedInvoice.status === "FINAL") {
        throw Object.assign(new Error("Cannot update a finalized invoice"), { code: "FORBIDDEN" });
      }

      const convertedInvoiceData: Prisma.InvoiceUpdateInput = {};
      if (input.paymentDetails) {
        convertedInvoiceData.paymentMethod = input.paymentDetails.paymentMethod;
        convertedInvoiceData.paymentAccountNumber = input.paymentDetails.paymentAccountNumber;
      }
      if (input.cateringDetails !== undefined) {
        convertedInvoiceData.cateringDetails = input.cateringDetails;
      }

      if (Object.keys(convertedInvoiceData).length > 0) {
        await tx.invoice.update({
          where: { id: input.convertedInvoiceId },
          data: convertedInvoiceData,
        });
      }
    }

    if (input.viewId) {
      const view = await tx.quoteView.findFirst({
        where: { id: input.viewId, invoiceId: quoteId },
        select: { id: true },
      });

      if (!view) {
        throw Object.assign(new Error("Quote activity session not found"), { code: "INVALID_INPUT" });
      }

      await tx.quoteView.update({
        where: { id: input.viewId },
        data: { respondedWith: input.response },
      });
    }
  });
}

export async function createFollowUp(data: {
  invoiceId: string;
  type: string;
  recipientEmail: string;
  subject: string;
  metadata?: Prisma.InputJsonValue;
}) {
  return prisma.quoteFollowUp.create({ data });
}

/**
 * Find all views for a quote (for activity display).
 */
export async function findViewsByInvoiceId(invoiceId: string) {
  return prisma.quoteView.findMany({
    where: { invoiceId },
    orderBy: { viewedAt: "desc" },
  });
}

/**
 * Find all follow-up events for a quote (for activity display).
 */
export async function findFollowUpsByInvoiceId(invoiceId: string) {
  return prisma.quoteFollowUp.findMany({
    where: { invoiceId },
    orderBy: { sentAt: "desc" },
  });
}

/**
 * Check if a view was recorded for this quote in the last N minutes.
 */
export async function hasRecentView(invoiceId: string, withinMinutes: number): Promise<boolean> {
  const since = new Date(Date.now() - withinMinutes * 60 * 1000);
  const count = await prisma.quoteView.count({
    where: {
      invoiceId,
      viewedAt: { gte: since },
    },
  });
  // count > 1 because the current view was already created
  return count > 1;
}
