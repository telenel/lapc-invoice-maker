// src/domains/analytics/repository.ts
import { prisma } from "@/lib/prisma";
import type { AnalyticsFilters } from "./types";

function buildDateFilter(filters: AnalyticsFilters): Record<string, unknown> {
  const where: Record<string, unknown> = { type: "INVOICE" as const };
  if (filters.dateFrom || filters.dateTo) {
    where.date = {
      ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}),
      ...(filters.dateTo ? { lte: new Date(filters.dateTo) } : {}),
    };
  }
  return where;
}

export const analyticsRepository = {
  async groupByCategory(filters: AnalyticsFilters) {
    return prisma.invoice.groupBy({
      by: ["category"],
      _count: true,
      _sum: { totalAmount: true },
      where: buildDateFilter(filters),
    });
  },

  async groupByDepartment(filters: AnalyticsFilters) {
    return prisma.invoice.groupBy({
      by: ["department"],
      _count: true,
      _sum: { totalAmount: true },
      where: buildDateFilter(filters),
      orderBy: { _sum: { totalAmount: "desc" } },
      take: 10,
    });
  },

  async findInvoicesForMonthly(filters: AnalyticsFilters) {
    return prisma.invoice.findMany({
      where: buildDateFilter(filters),
      select: { date: true, totalAmount: true },
      orderBy: { date: "asc" },
    });
  },

  async groupByUser(filters: AnalyticsFilters) {
    return prisma.invoice.groupBy({
      by: ["createdBy"],
      _count: true,
      _sum: { totalAmount: true },
      where: buildDateFilter(filters),
    });
  },

  async findUsersByIds(ids: string[]) {
    return prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true },
    });
  },
};
