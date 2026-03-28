// src/domains/analytics/service.ts
import { analyticsRepository } from "./repository";
import type {
  AnalyticsFilters,
  AnalyticsResponse,
  MonthStat,
  TrendPoint,
} from "./types";

function aggregateByMonth(
  invoices: { date: Date; totalAmount: unknown }[]
): { byMonth: MonthStat[]; trend: TrendPoint[] } {
  const monthMap = new Map<string, { count: number; total: number }>();

  for (const inv of invoices) {
    const d = new Date(inv.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const existing = monthMap.get(key) ?? { count: 0, total: 0 };
    monthMap.set(key, {
      count: existing.count + 1,
      total: existing.total + Number(inv.totalAmount),
    });
  }

  const sorted = Array.from(monthMap.entries()).sort(([a], [b]) =>
    a.localeCompare(b)
  );

  const byMonth: MonthStat[] = sorted.map(([month, data]) => ({
    month,
    count: data.count,
    total: data.total,
  }));

  const trend: TrendPoint[] = sorted.map(([month, data]) => ({
    month,
    count: data.count,
  }));

  return { byMonth, trend };
}

export const analyticsService = {
  async getAnalytics(filters: AnalyticsFilters): Promise<AnalyticsResponse> {
    const [categoryGroups, departmentGroups, invoices, userGroups] =
      await Promise.all([
        analyticsRepository.groupByCategory(filters),
        analyticsRepository.groupByDepartment(filters),
        analyticsRepository.findInvoicesForMonthly(filters),
        analyticsRepository.groupByUser(filters),
      ]);

    const byCategory = categoryGroups.map((g) => ({
      category: g.category,
      count: g._count,
      total: Number(g._sum.totalAmount ?? 0),
    }));

    const byDepartment = departmentGroups.map((g) => ({
      department: g.department,
      count: g._count,
      total: Number(g._sum.totalAmount ?? 0),
    }));

    const { byMonth, trend } = aggregateByMonth(invoices);

    const userIds = userGroups.map((g) => g.createdBy);
    const users = await analyticsRepository.findUsersByIds(userIds);

    const byUser = userGroups
      .map((g) => {
        const user = users.find((u) => u.id === g.createdBy);
        return {
          user: user?.name ?? "Unknown",
          count: g._count,
          total: Number(g._sum?.totalAmount ?? 0),
        };
      })
      .sort((a, b) => b.total - a.total);

    return { byCategory, byMonth, byDepartment, trend, byUser };
  },
};
