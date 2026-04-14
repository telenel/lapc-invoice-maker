import { prisma } from "@/lib/prisma";
import { buildIncludedFinanceWhere } from "@/domains/shared/finance";
import type { AnalyticsFilters } from "./types";

export const analyticsRepository = {
  async findFinanceDocuments(filters: AnalyticsFilters) {
    return prisma.invoice.findMany({
      where: buildIncludedFinanceWhere(filters.dateFrom, filters.dateTo),
      select: {
        type: true,
        status: true,
        quoteStatus: true,
        convertedToInvoice: { select: { id: true } },
        date: true,
        totalAmount: true,
        category: true,
        department: true,
        createdBy: true,
      },
      orderBy: { date: "asc" },
    }).then((documents) =>
      documents.map((document) => ({
        ...document,
        convertedToInvoiceId: document.convertedToInvoice?.id ?? null,
      })),
    );
  },

  async findUsersByIds(ids: string[]) {
    if (ids.length === 0) {
      return [];
    }

    return prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true },
    });
  },
};
