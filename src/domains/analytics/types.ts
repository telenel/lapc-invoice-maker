// src/domains/analytics/types.ts

export interface CategoryStat {
  category: string;
  count: number;
  total: number;
}

export interface MonthStat {
  month: string;
  count: number;
  total: number;
}

export interface DepartmentStat {
  department: string;
  count: number;
  total: number;
}

export interface TrendPoint {
  month: string;
  count: number;
}

export interface UserStat {
  user: string;
  count: number;
  total: number;
}

export interface AnalyticsResponse {
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
