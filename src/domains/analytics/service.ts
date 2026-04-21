import { analyticsRepository } from "./repository";
import {
  isExpectedFinanceDocument,
  isFinalizedFinanceDocument,
  type FinanceDocumentShape,
} from "@/domains/shared/finance";
import { formatAmount } from "@/domains/shared/formatters";
import { getDateKeyInLosAngeles, shiftDateKey } from "@/lib/date-utils";
import type {
  AnalyticsDateRange,
  AnalyticsFilters,
  AnalyticsResponse,
  CategoryStat,
  DepartmentStat,
  MonthStat,
  OperationsAnalytics,
  OperationsSnapshot,
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

const WEEKDAY_LABELS: Record<number, string> = {
  0: "Sunday",
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
};

const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

const EMPTY_OPERATIONS_SNAPSHOT: OperationsSnapshot = {
  salesSummary: {
    revenue: 0,
    units: 0,
    receipts: 0,
    discountAmount: 0,
  },
  monthlySales: [],
  weekdaySales: [],
  hourlySales: [],
  topSelling: [],
  topRevenue: [],
  acceleratingItems: [],
  deceleratingItems: [],
  newItems: [],
  categoryMix: [],
  revenueConcentration: {
    topProductShare: 0,
    skuCountFor80Percent: 0,
    totalSkuCount: 0,
  },
  inventorySummary: {
    deadStockCost: 0,
    lowStockHighDemandCount: 0,
    reorderBreachCount: 0,
  },
  reorderBreachesByLocation: [],
  staleInventoryByLocation: [],
  deadInventory: [],
  slowMovingInventory: [],
  lowStockHighDemand: [],
  copyTechSummary: {
    invoiceRevenue: 0,
    invoiceCount: 0,
    quoteRevenue: 0,
    quoteCount: 0,
  },
  copyTechMonthly: [],
  copyTechServiceMix: [],
  copyTechTopRequesters: [],
  latestSyncRun: null,
};

function resolveDateRange(filters: AnalyticsFilters): AnalyticsDateRange {
  const dateTo = filters.dateTo ?? getDateKeyInLosAngeles();
  return {
    dateFrom: filters.dateFrom ?? shiftDateKey(dateTo, { years: -1 }),
    dateTo,
  };
}

function roundCurrency(value: number): number {
  return Number(value.toFixed(2));
}

function roundPercent(value: number): number {
  return Number(value.toFixed(1));
}

function monthKeyFromDateKey(dateKey: string): string {
  return `${dateKey.slice(0, 7)}`;
}

function fillMonthlySales(
  range: AnalyticsDateRange,
  rows: OperationsSnapshot["monthlySales"],
) {
  const map = new Map(rows.map((row) => [row.month, row]));
  const points: OperationsAnalytics["salesPatterns"]["monthly"] = [];
  const cursor = new Date(`${monthKeyFromDateKey(range.dateFrom)}-01T00:00:00.000Z`);
  const end = new Date(`${monthKeyFromDateKey(range.dateTo)}-01T00:00:00.000Z`);

  while (cursor <= end) {
    const key = `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, "0")}`;
    const existing = map.get(key);
    points.push({
      month: key,
      revenue: roundCurrency(existing?.revenue ?? 0),
      units: roundCurrency(existing?.units ?? 0),
      receipts: existing?.receipts ?? 0,
      discountRate: roundPercent((existing?.discountRate ?? 0) * 100) / 100,
    });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  return points;
}

function fillWeekdaySales(rows: OperationsSnapshot["weekdaySales"]) {
  const map = new Map(rows.map((row) => [row.dayOfWeek, row]));
  return WEEKDAY_ORDER.map((dayOfWeek) => {
    const existing = map.get(dayOfWeek);
    return {
      day: WEEKDAY_LABELS[dayOfWeek],
      revenue: roundCurrency(existing?.revenue ?? 0),
      receipts: existing?.receipts ?? 0,
    };
  });
}

function fillHourlySales(rows: OperationsSnapshot["hourlySales"]) {
  const map = new Map(rows.map((row) => [row.hour, row]));
  return Array.from({ length: 24 }, (_, hour) => {
    const existing = map.get(hour);
    return {
      hour,
      revenue: roundCurrency(existing?.revenue ?? 0),
      receipts: existing?.receipts ?? 0,
    };
  });
}

function buildOperationsHighlights(operations: Omit<OperationsAnalytics, "highlights">) {
  const topWeekday = [...operations.salesPatterns.weekdays]
    .filter((row) => row.receipts > 0 || row.revenue > 0)
    .sort((left, right) => right.receipts - left.receipts || right.revenue - left.revenue)[0];
  const lowStockCount = operations.inventoryHealth.lowStockHighDemandCount;
  const concentration = operations.productPerformance.revenueConcentration;

  return [
    topWeekday
      ? {
        title: `${topWeekday.day} carries the heaviest store traffic`,
        detail: `${topWeekday.receipts} receipts and ${formatAmount(topWeekday.revenue)} in the selected range.`,
        tone: "warning" as const,
      }
      : {
        title: "No mirrored store sales landed in this range",
        detail: "Weekday traffic insights will populate after the selected window includes mirrored Pierce receipts.",
        tone: "neutral" as const,
      },
    concentration.totalSkuCount > 0
      ? {
        title: "Revenue is concentrated in a small slice of the catalog",
        detail: `${concentration.skuCountFor80Percent} of ${concentration.totalSkuCount} selling SKUs account for 80% of mirrored store revenue.`,
        tone: "neutral" as const,
      }
      : {
        title: "Revenue concentration needs mirrored sales activity",
        detail: "The selected range has no selling SKUs yet, so concentration insights will appear after mirrored store sales land.",
        tone: "neutral" as const,
      },
    lowStockCount > 0
      ? {
        title: `${lowStockCount} Pierce items need replenishment soon`,
        detail: "These SKUs are below min stock while recent mirrored demand is still active.",
        tone: "warning" as const,
      }
      : {
        title: "No immediate Pierce stock pressure surfaced",
        detail: "Demand-backed low-stock alerts are clear in the current mirror snapshot.",
        tone: "positive" as const,
      },
  ];
}

function buildOperationsAnalytics(
  range: AnalyticsDateRange,
  snapshot: OperationsSnapshot,
): OperationsAnalytics {
  const hourlyBucketsWithActivity = snapshot.hourlySales.filter(
    (row) => row.revenue > 0 || row.receipts > 0,
  ).length;
  const hourlyAvailable = hourlyBucketsWithActivity > 1;
  const hourlyFallbackMessage = hourlyAvailable
    ? null
    : "Time-of-day traffic is unavailable because the mirrored sales timestamps only resolve to a single effective hour right now.";

  const revenueConcentration = {
    topProductShare: roundPercent(snapshot.revenueConcentration.topProductShare * 100) / 100,
    skuCountFor80Percent: snapshot.revenueConcentration.skuCountFor80Percent,
    totalSkuCount: snapshot.revenueConcentration.totalSkuCount,
    percentOfSkusFor80Percent:
      snapshot.revenueConcentration.totalSkuCount > 0
        ? roundPercent(
          (snapshot.revenueConcentration.skuCountFor80Percent
            / snapshot.revenueConcentration.totalSkuCount) * 100,
        )
        : 0,
  };

  const operations: Omit<OperationsAnalytics, "highlights"> = {
    overview: {
      revenue: roundCurrency(snapshot.salesSummary.revenue),
      units: roundCurrency(snapshot.salesSummary.units),
      receipts: snapshot.salesSummary.receipts,
      averageBasket:
        snapshot.salesSummary.receipts > 0
          ? roundCurrency(snapshot.salesSummary.revenue / snapshot.salesSummary.receipts)
          : 0,
      deadStockCost: roundCurrency(snapshot.inventorySummary.deadStockCost),
      lowStockHighDemandCount: snapshot.inventorySummary.lowStockHighDemandCount,
      reorderBreachCount: snapshot.inventorySummary.reorderBreachCount,
      lastSyncStartedAt: snapshot.latestSyncRun?.startedAt ?? null,
      lastSyncStatus: snapshot.latestSyncRun?.status ?? null,
      txnsAdded: snapshot.latestSyncRun?.txnsAdded ?? null,
    },
    salesPatterns: {
      monthly: fillMonthlySales(range, snapshot.monthlySales),
      weekdays: fillWeekdaySales(snapshot.weekdaySales),
      hourly: fillHourlySales(snapshot.hourlySales),
      hourlyAvailable,
      hourlyFallbackMessage,
    },
    productPerformance: {
      topSelling: snapshot.topSelling,
      topRevenue: snapshot.topRevenue,
      accelerating: snapshot.acceleratingItems,
      decelerating: snapshot.deceleratingItems,
      newItems: snapshot.newItems,
      categoryMix: snapshot.categoryMix,
      revenueConcentration,
    },
    inventoryHealth: {
      deadStockCost: roundCurrency(snapshot.inventorySummary.deadStockCost),
      lowStockHighDemandCount: snapshot.inventorySummary.lowStockHighDemandCount,
      reorderBreachesByLocation: snapshot.reorderBreachesByLocation,
      staleInventoryByLocation: snapshot.staleInventoryByLocation,
      deadInventory: snapshot.deadInventory,
      slowMoving: snapshot.slowMovingInventory,
      lowStockHighDemand: snapshot.lowStockHighDemand,
    },
    copyTech: {
      summary: {
        invoiceRevenue: roundCurrency(snapshot.copyTechSummary.invoiceRevenue),
        quoteRevenue: roundCurrency(snapshot.copyTechSummary.quoteRevenue),
        invoiceCount: snapshot.copyTechSummary.invoiceCount,
        quoteCount: snapshot.copyTechSummary.quoteCount,
      },
      monthly: snapshot.copyTechMonthly,
      serviceMix: snapshot.copyTechServiceMix,
      topRequesters: snapshot.copyTechTopRequesters,
      limitations: [
        "CopyTech POS sales are not yet mirrored into Supabase, so this section uses LAPortal invoices and print quotes instead.",
      ],
    },
    limitations: [
      "Store sales trends reflect the mirrored Pierce POS feed only.",
      "Demand-based inventory alerts focus on PIER because only Pierce POS sales are mirrored today.",
      ...(hourlyFallbackMessage ? [hourlyFallbackMessage] : []),
    ],
  };

  return {
    ...operations,
    highlights: buildOperationsHighlights(operations),
  };
}

export const analyticsService = {
  async getAnalytics(filters: AnalyticsFilters): Promise<AnalyticsResponse> {
    const range = resolveDateRange(filters);
    const [documents, operationsSnapshot] = await Promise.all([
      analyticsRepository.findFinanceDocuments(range),
      analyticsRepository.findOperationsSnapshot(range),
    ]);
    const financeDocuments = documents as FinanceDocument[];

    const byCategory = new Map<string, AggregateBucket>();
    const byMonth = new Map<string, AggregateBucket>();
    const byDepartment = new Map<string, AggregateBucket>();
    const byUser = new Map<string, AggregateBucket>();
    const summary = createBucket();

    for (const document of financeDocuments) {
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
      operations: buildOperationsAnalytics(range, operationsSnapshot ?? EMPTY_OPERATIONS_SNAPSHOT),
    };
  },
};
