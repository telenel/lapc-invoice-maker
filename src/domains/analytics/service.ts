import { analyticsRepository } from "./repository";
import {
  isExpectedFinanceDocument,
  isFinalizedFinanceDocument,
  type FinanceDocumentShape,
} from "@/domains/shared/finance";
import type {
  AnalyticsFilters,
  AnalyticsResponse,
  CategoryStat,
  DepartmentStat,
  MonthStat,
  TrendPoint,
  UserStat,
} from "./types";

type FinanceDocument = FinanceDocumentShape & {
  date: Date;
  totalAmount: unknown;
  category: string;
  department: string;
  createdBy: string;
};

type AggregateBucket = {
  count: number;
  total: number;
  finalizedCount: number;
  finalizedTotal: number;
  expectedCount: number;
  expectedTotal: number;
};

function createBucket(): AggregateBucket {
  return {
    count: 0,
    total: 0,
    finalizedCount: 0,
    finalizedTotal: 0,
    expectedCount: 0,
    expectedTotal: 0,
  };
}

function accumulate(
  map: Map<string, AggregateBucket>,
  key: string,
  amount: number,
  lane: "finalized" | "expected",
) {
  const bucket = map.get(key) ?? createBucket();
  bucket.count += 1;
  bucket.total += amount;

  if (lane === "finalized") {
    bucket.finalizedCount += 1;
    bucket.finalizedTotal += amount;
  } else {
    bucket.expectedCount += 1;
    bucket.expectedTotal += amount;
  }

  map.set(key, bucket);
}

function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function toCategoryStats(map: Map<string, AggregateBucket>): CategoryStat[] {
  return Array.from(map.entries())
    .map(([category, bucket]) => ({ category, ...bucket }))
    .sort((a, b) => b.total - a.total);
}

function toMonthStats(map: Map<string, AggregateBucket>): MonthStat[] {
  return Array.from(map.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([month, bucket]) => ({ month, ...bucket }));
}

function toDepartmentStats(map: Map<string, AggregateBucket>): DepartmentStat[] {
  return Array.from(map.entries())
    .map(([department, bucket]) => ({ department, ...bucket }))
    .sort((a, b) => a.department.localeCompare(b.department));
}

function toTrend(map: Map<string, AggregateBucket>): TrendPoint[] {
  return Array.from(map.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([month, bucket]) => ({
      month,
      count: bucket.count,
      finalizedCount: bucket.finalizedCount,
      expectedCount: bucket.expectedCount,
    }));
}

export const analyticsService = {
  async getAnalytics(filters: AnalyticsFilters): Promise<AnalyticsResponse> {
    const documents = (await analyticsRepository.findFinanceDocuments(filters)) as FinanceDocument[];

    const byCategory = new Map<string, AggregateBucket>();
    const byMonth = new Map<string, AggregateBucket>();
    const byDepartment = new Map<string, AggregateBucket>();
    const byUser = new Map<string, AggregateBucket>();
    const summary = createBucket();

    for (const document of documents) {
      const lane = isFinalizedFinanceDocument(document)
        ? "finalized"
        : isExpectedFinanceDocument(document)
          ? "expected"
          : null;

      if (!lane) {
        continue;
      }

      const amount = Number(document.totalAmount);
      const month = monthKey(new Date(document.date));

      accumulate(byCategory, document.category, amount, lane);
      accumulate(byMonth, month, amount, lane);
      accumulate(byDepartment, document.department, amount, lane);
      accumulate(byUser, document.createdBy, amount, lane);
      summary.count += 1;
      summary.total += amount;
      if (lane === "finalized") {
        summary.finalizedCount += 1;
        summary.finalizedTotal += amount;
      } else {
        summary.expectedCount += 1;
        summary.expectedTotal += amount;
      }
    }

    const users = await analyticsRepository.findUsersByIds(Array.from(byUser.keys()));

    const userStats: UserStat[] = Array.from(byUser.entries())
      .map(([userId, bucket]) => ({
        user: users.find((candidate) => candidate.id === userId)?.name ?? "Unknown",
        ...bucket,
      }))
      .sort((a, b) => b.total - a.total);

    return {
      summary,
      byCategory: toCategoryStats(byCategory),
      byMonth: toMonthStats(byMonth),
      byDepartment: toDepartmentStats(byDepartment),
      trend: toTrend(byMonth),
      byUser: userStats,
    };
  },
};
