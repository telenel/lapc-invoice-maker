import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { ArchiveFilters } from "./types";

const archiveListInclude = {
  creator: { select: { id: true, name: true } },
  archiver: { select: { id: true, name: true } },
} as const;

function buildWhere(filters: ArchiveFilters, userId: string, isAdmin: boolean): Prisma.InvoiceWhereInput {
  const where: Prisma.InvoiceWhereInput = {
    archivedAt: { not: null },
    ...(isAdmin ? {} : { createdBy: userId }),
  };

  if (filters.type && filters.type !== "all") {
    where.type = filters.type;
  }

  if (filters.search) {
    where.OR = [
      { invoiceNumber: { contains: filters.search, mode: "insensitive" } },
      { quoteNumber: { contains: filters.search, mode: "insensitive" } },
      { department: { contains: filters.search, mode: "insensitive" } },
      { recipientName: { contains: filters.search, mode: "insensitive" } },
      { recipientOrg: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  return where;
}

export async function findMany(filters: ArchiveFilters, userId: string, isAdmin: boolean) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.max(1, filters.pageSize ?? 20);
  const where = buildWhere(filters, userId, isAdmin);

  const [documents, total] = await prisma.$transaction([
    prisma.invoice.findMany({
      where,
      include: archiveListInclude,
      orderBy: { archivedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.invoice.count({ where }),
  ]);

  return { documents, total, page, pageSize };
}

export async function findById(id: string) {
  return prisma.invoice.findUnique({
    where: { id },
    include: archiveListInclude,
  });
}
