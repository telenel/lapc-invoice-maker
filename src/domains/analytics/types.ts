// src/domains/analytics/types.ts

export interface CategoryStat {
  category: string;
  count: number;
  total: number;
  finalizedCount: number;
  finalizedTotal: number;
  expectedCount: number;
  expectedTotal: number;
}

export interface MonthStat {
  month: string;
  count: number;
  total: number;
  finalizedCount: number;
  finalizedTotal: number;
  expectedCount: number;
  expectedTotal: number;
}

export interface DepartmentStat {
  department: string;
  count: number;
  total: number;
  finalizedCount: number;
  finalizedTotal: number;
  expectedCount: number;
  expectedTotal: number;
}

export interface TrendPoint {
  month: string;
  count: number;
  finalizedCount: number;
  expectedCount: number;
}

export interface UserStat {
  user: string;
  count: number;
  total: number;
  finalizedCount: number;
  finalizedTotal: number;
  expectedCount: number;
  expectedTotal: number;
}

export interface AnalyticsSummary {
  count: number;
  total: number;
  finalizedCount: number;
  finalizedTotal: number;
  expectedCount: number;
  expectedTotal: number;
}

export interface AnalyticsResponse {
  summary: AnalyticsSummary;
  byCategory: CategoryStat[];
  byMonth: MonthStat[];
  byDepartment: DepartmentStat[];
  trend: TrendPoint[];
  byUser: UserStat[];
  operations: OperationsAnalytics;
}

export interface FinanceAnalytics {
  summary: AnalyticsSummary;
  byCategory: CategoryStat[];
  byMonth: MonthStat[];
  byDepartment: DepartmentStat[];
  trend: TrendPoint[];
  byUser: UserStat[];
}

export interface AnalyticsFilters {
  dateFrom?: string;
  dateTo?: string;
}

export interface AnalyticsDateRange {
  dateFrom: string;
  dateTo: string;
}

export interface AnalyticsHighlight {
  title: string;
  detail: string;
  tone: "neutral" | "warning" | "positive";
}

export interface SalesPatternMonth {
  month: string;
  revenue: number;
  units: number;
  receipts: number;
  discountRate: number;
}

export interface SalesPatternWeekday {
  day: string;
  revenue: number;
  receipts: number;
}

export interface SalesPatternHour {
  hour: number;
  revenue: number;
  receipts: number;
}

export interface ProductPerformanceRow {
  sku: number;
  description: string;
  department: string;
  units: number;
  revenue: number;
  lastSaleDate: string | null;
  trendDirection: "accelerating" | "decelerating" | "steady" | null;
}

export interface ProductTrendRow {
  sku: number;
  description: string;
  department: string;
  unitsSold30d: number;
  unitsSold1y: number;
  revenue30d: number;
  firstSaleDate: string | null;
  lastSaleDate: string | null;
  trendDirection: "accelerating" | "decelerating" | "steady" | null;
}

export interface CategoryMixRow {
  category: string;
  revenue: number;
  units: number;
}

export interface RevenueConcentration {
  topProductShare: number;
  skuCountFor80Percent: number;
  totalSkuCount: number;
  percentOfSkusFor80Percent: number;
}

export interface InventoryHealthRow {
  sku: number;
  description: string;
  location: string;
  stockOnHand: number;
  minStock: number;
  unitsSold30d: number;
  stockValue: number;
  lastSaleDate: string | null;
  daysSinceLastSale: number | null;
}

export interface LowStockHighDemandRow {
  sku: number;
  description: string;
  location: string;
  stockOnHand: number;
  minStock: number;
  unitsSold30d: number;
  lastSaleDate: string | null;
}

export interface ReorderBreachesByLocation {
  location: string;
  count: number;
}

export interface StaleInventoryByLocation {
  location: string;
  fresh30d: number;
  stale31To90d: number;
  stale91To365d: number;
  staleOver365d: number;
  neverSold: number;
}

export interface CopyTechMonthlyPoint {
  month: string;
  invoiceRevenue: number;
  quoteRevenue: number;
  invoiceCount: number;
  quoteCount: number;
}

export interface CopyTechServiceMixRow {
  service: string;
  revenue: number;
  quantity: number;
}

export interface CopyTechRequesterRow {
  name: string;
  revenue: number;
  invoiceCount: number;
  quoteCount: number;
}

export interface OperationsOverview {
  revenue: number;
  units: number;
  receipts: number;
  averageBasket: number;
  deadStockCost: number;
  lowStockHighDemandCount: number;
  reorderBreachCount: number;
  lastSyncStartedAt: string | null;
  lastSyncStatus: string | null;
  txnsAdded: number | null;
}

export interface OperationsSalesPatterns {
  monthly: SalesPatternMonth[];
  weekdays: SalesPatternWeekday[];
  hourly: SalesPatternHour[];
  hourlyAvailable: boolean;
  hourlyFallbackMessage: string | null;
}

export interface ProductPerformanceAnalytics {
  topSelling: ProductPerformanceRow[];
  topRevenue: ProductPerformanceRow[];
  accelerating: ProductTrendRow[];
  decelerating: ProductTrendRow[];
  newItems: ProductTrendRow[];
  categoryMix: CategoryMixRow[];
  revenueConcentration: RevenueConcentration;
}

export interface InventoryHealthAnalytics {
  deadStockCost: number;
  lowStockHighDemandCount: number;
  reorderBreachesByLocation: ReorderBreachesByLocation[];
  staleInventoryByLocation: StaleInventoryByLocation[];
  deadInventory: InventoryHealthRow[];
  slowMoving: InventoryHealthRow[];
  lowStockHighDemand: LowStockHighDemandRow[];
}

export interface CopyTechAnalytics {
  summary: {
    invoiceRevenue: number;
    quoteRevenue: number;
    invoiceCount: number;
    quoteCount: number;
  };
  monthly: CopyTechMonthlyPoint[];
  serviceMix: CopyTechServiceMixRow[];
  topRequesters: CopyTechRequesterRow[];
  limitations: string[];
}

export interface OperationsAnalytics {
  overview: OperationsOverview;
  highlights: AnalyticsHighlight[];
  salesPatterns: OperationsSalesPatterns;
  productPerformance: ProductPerformanceAnalytics;
  inventoryHealth: InventoryHealthAnalytics;
  copyTech: CopyTechAnalytics;
  limitations: string[];
}

export interface OperationsSnapshot {
  salesSummary: {
    revenue: number;
    units: number;
    receipts: number;
    discountAmount: number;
  };
  monthlySales: Array<{
    month: string;
    revenue: number;
    units: number;
    receipts: number;
    discountRate: number;
  }>;
  weekdaySales: Array<{
    dayOfWeek: number;
    revenue: number;
    receipts: number;
  }>;
  hourlySales: Array<{
    hour: number;
    revenue: number;
    receipts: number;
  }>;
  topSelling: ProductPerformanceRow[];
  topRevenue: ProductPerformanceRow[];
  acceleratingItems: ProductTrendRow[];
  deceleratingItems: ProductTrendRow[];
  newItems: ProductTrendRow[];
  categoryMix: CategoryMixRow[];
  revenueConcentration: {
    topProductShare: number;
    skuCountFor80Percent: number;
    totalSkuCount: number;
  };
  inventorySummary: {
    deadStockCost: number;
    lowStockHighDemandCount: number;
    reorderBreachCount: number;
  };
  reorderBreachesByLocation: ReorderBreachesByLocation[];
  staleInventoryByLocation: StaleInventoryByLocation[];
  deadInventory: InventoryHealthRow[];
  slowMovingInventory: InventoryHealthRow[];
  lowStockHighDemand: LowStockHighDemandRow[];
  copyTechSummary: {
    invoiceRevenue: number;
    invoiceCount: number;
    quoteRevenue: number;
    quoteCount: number;
  };
  copyTechMonthly: CopyTechMonthlyPoint[];
  copyTechServiceMix: CopyTechServiceMixRow[];
  copyTechTopRequesters: CopyTechRequesterRow[];
  latestSyncRun: {
    startedAt: string | null;
    status: string | null;
    txnsAdded: number | null;
  } | null;
}
