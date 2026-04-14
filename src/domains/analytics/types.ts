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
}

export interface AnalyticsFilters {
  dateFrom?: string;
  dateTo?: string;
}
