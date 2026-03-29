// src/domains/invoice/repository.ts
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { CalculatedLineItem } from "./calculations";
import type { InvoiceFilters } from "./types";

// ── Shared include shapes ──────────────────────────────────────────────────

const listInclude = {
  staff: { select: { id: true, name: true, title: true, department: true } },
  contact: { select: { id: true, name: true, email: true, phone: true, org: true, department: true, title: true, notes: true, createdAt: true } },
  creator: { select: { id: true, name: true, username: true } },
  items: { orderBy: { sortOrder: "asc" as const } },
  _count: { select: { items: true } },
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
} as const;

// ── Where builder ──────────────────────────────────────────────────────────

function buildWhere(filters: InvoiceFilters): Prisma.InvoiceWhereInput {
  const where: Prisma.InvoiceWhereInput = { type: "INVOICE" };

  if (filters.status) {
    where.status = filters.status;
  }
  if (filters.staffId) {
    where.staffId = filters.staffId;
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
  if (filters.isRunning) {
    where.isRunning = true;
  }
  if (filters.createdFrom || filters.createdTo) {
    where.createdAt = {};
    if (filters.createdFrom) where.createdAt.gte = new Date(filters.createdFrom);
    if (filters.createdTo) where.createdAt.lte = new Date(filters.createdTo + "T23:59:59.999Z");
  }
  if (filters.dateFrom || filters.dateTo) {
    where.date = {};
    if (filters.dateFrom) where.date.gte = new Date(filters.dateFrom);
    if (filters.dateTo) where.date.lte = new Date(filters.dateTo);
  }
  if (filters.amountMin != null || filters.amountMax != null) {
    where.totalAmount = {};
    if (filters.amountMin != null) where.totalAmount.gte = String(filters.amountMin);
    if (filters.amountMax != null) where.totalAmount.lte = String(filters.amountMax);
  }
  if (filters.search) {
    where.OR = [
      { invoiceNumber: { contains: filters.search, mode: "insensitive" } },
      { department: { contains: filters.search, mode: "insensitive" } },
      { staff: { name: { contains: filters.search, mode: "insensitive" } } },
      { contact: { name: { contains: filters.search, mode: "insensitive" } } },
      { notes: { contains: filters.search, mode: "insensitive" } },
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
  "invoiceNumber",
  "totalAmount",
  "department",
  "status",
]);

// ── Repository methods ─────────────────────────────────────────────────────

/**
 * Paginated list of invoices with complex filtering.
 */
export async function findMany(filters: InvoiceFilters & {
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}) {
  const where = buildWhere(filters);
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.max(1, filters.pageSize ?? 20);
  const sortField = ALLOWED_SORT_FIELDS.has(filters.sortBy ?? "") ? (filters.sortBy ?? "createdAt") : "createdAt";
  const sortDir = filters.sortOrder ?? "desc";

  const [invoices, total] = await prisma.$transaction([
    prisma.invoice.findMany({
      where,
      include: listInclude,
      orderBy: { [sortField]: sortDir },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.invoice.count({ where }),
  ]);

  return { invoices, total, page, pageSize };
}

/**
 * Single invoice with all relations (staff with extension/email, items).
 */
export async function findById(id: string) {
  return prisma.invoice.findUnique({
    where: { id },
    include: detailInclude,
  });
}

/**
 * Create an invoice with pre-calculated line items.
 */
export async function create(
  input: {
    invoiceNumber?: string | null;
    date: string;
    staffId?: string;
    contactId?: string;
    department: string;
    category: string;
    accountCode: string;
    accountNumber?: string;
    approvalChain?: string[];
    notes?: string;
    isRecurring?: boolean;
    recurringInterval?: string;
    recurringEmail?: string;
    isRunning?: boolean;
    runningTitle?: string;
    status?: "DRAFT" | "PENDING_CHARGE";
    marginEnabled?: boolean;
    marginPercent?: number;
    taxEnabled?: boolean;
    taxRate?: number;
    isCateringEvent?: boolean;
    cateringDetails?: Prisma.InputJsonValue;
  },
  calculatedItems: CalculatedLineItem[],
  totalAmount: number,
  creatorId: string
) {
  const { date, status, invoiceNumber, ...invoiceData } = input;
  const normalizedInvoiceNumber = invoiceNumber || null;

  return prisma.invoice.create({
    data: {
      ...invoiceData,
      invoiceNumber: normalizedInvoiceNumber,
      ...(status ? { status } : {}),
      date: new Date(date),
      createdBy: creatorId,
      totalAmount,
      items: {
        create: calculatedItems.map((item) => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          extendedPrice: item.extendedPrice,
          sortOrder: item.sortOrder,
          isTaxable: item.isTaxable,
          costPrice: item.costPrice,
          marginOverride: item.marginOverride,
        })),
      },
    },
    include: detailInclude,
  });
}

/**
 * Update an invoice, optionally replacing all line items in a transaction.
 */
export async function update(
  id: string,
  input: {
    date?: string;
    [key: string]: unknown;
  },
  calculatedItems?: CalculatedLineItem[],
  totalAmount?: number
) {
  const { date, ...rest } = input;
  const updateData: Record<string, unknown> = { ...rest };
  if (date) {
    updateData.date = new Date(date);
  }

  if (calculatedItems != null && totalAmount != null) {
    updateData.totalAmount = totalAmount;

    const [, invoice] = await prisma.$transaction([
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
              isTaxable: item.isTaxable,
              costPrice: item.costPrice,
              marginOverride: item.marginOverride,
            })),
          },
        },
        include: detailInclude,
      }),
    ]);

    return invoice;
  }

  return prisma.invoice.update({
    where: { id },
    data: updateData,
    include: detailInclude,
  });
}

/**
 * Hard delete an invoice (cascade removes items via DB constraint).
 */
export async function deleteById(id: string) {
  return prisma.invoice.delete({ where: { id } });
}

/**
 * Mark an invoice as FINAL, set pdfPath and optional prismcorePath.
 */
export async function finalize(
  id: string,
  pdfPath: string,
  prismcorePath?: string
) {
  return prisma.invoice.update({
    where: { id },
    data: {
      status: "FINAL",
      pdfPath,
      prismcorePath: prismcorePath ?? null,
    },
  });
}

/**
 * Aggregate count and sum for stats panel (no records returned).
 */
export async function countAndSum(filters: InvoiceFilters) {
  const where = buildWhere(filters);

  const [agg, total] = await prisma.$transaction([
    prisma.invoice.aggregate({ where, _sum: { totalAmount: true } }),
    prisma.invoice.count({ where }),
  ]);

  return {
    total,
    sumTotalAmount: Number(agg._sum.totalAmount ?? 0),
  };
}

/**
 * Aggregate invoice counts and totals grouped by creator for the current month.
 */
export async function countByCreator(status?: string) {
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const invoices = await prisma.invoice.findMany({
    where: {
      type: "INVOICE",
      status: status ? (status as "FINAL" | "PENDING_CHARGE") : { in: ["FINAL", "PENDING_CHARGE"] },
      createdAt: { gte: firstOfMonth },
    },
    select: {
      totalAmount: true,
      creator: { select: { id: true, name: true } },
    },
  });

  const userMap = new Map<string, { id: string; name: string; invoiceCount: number; totalAmount: number }>();
  for (const inv of invoices) {
    const key = inv.creator.id;
    const existing = userMap.get(key);
    if (existing) {
      existing.invoiceCount++;
      existing.totalAmount += Number(inv.totalAmount);
    } else {
      userMap.set(key, {
        id: inv.creator.id,
        name: inv.creator.name,
        invoiceCount: 1,
        totalAmount: Number(inv.totalAmount),
      });
    }
  }

  const users = Array.from(userMap.values()).sort((a, b) => b.totalAmount - a.totalAmount);
  return { users };
}

/**
 * Increment usageCount on matching QuickPickItem and SavedLineItem records
 * for the given department and item descriptions.
 */
export async function incrementQuickPickUsage(
  department: string,
  descriptions: string[]
) {
  if (descriptions.length === 0) return;

  await Promise.all([
    prisma.quickPickItem.updateMany({
      where: {
        OR: [{ department }, { department: "__ALL__" }],
        description: { in: descriptions },
      },
      data: { usageCount: { increment: 1 } },
    }),
    prisma.savedLineItem.updateMany({
      where: {
        department,
        description: { in: descriptions },
      },
      data: { usageCount: { increment: 1 } },
    }),
  ]);
}
