import { analyticsService } from "./service";
import type {
  AnalyticsFilters,
  AnalyticsResponse,
  FinanceAnalytics,
  OperationsAnalytics,
} from "./types";

const ANALYTICS_CACHE_TTL_MS = 5 * 60 * 1000;

type CacheEntry<T> = {
  expiresAt: number;
  promise: Promise<T>;
};

const cache = new Map<string, CacheEntry<unknown>>();

function getCacheKey(kind: string, filters: AnalyticsFilters) {
  return `${kind}:${filters.dateFrom ?? ""}:${filters.dateTo ?? ""}`;
}

function getCached<T>(key: string, loader: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const existing = cache.get(key) as CacheEntry<T> | undefined;
  if (existing && existing.expiresAt > now) {
    return existing.promise;
  }

  const promise = loader().catch((error) => {
    cache.delete(key);
    throw error;
  });
  cache.set(key, {
    expiresAt: now + ANALYTICS_CACHE_TTL_MS,
    promise,
  });
  return promise;
}

export const analyticsCache = {
  getFinance(filters: AnalyticsFilters): Promise<FinanceAnalytics> {
    return getCached(getCacheKey("finance", filters), () => analyticsService.getFinanceAnalytics(filters));
  },

  getOperations(filters: AnalyticsFilters): Promise<OperationsAnalytics> {
    return getCached(getCacheKey("operations", filters), () => analyticsService.getOperationsAnalytics(filters));
  },

  getCombined(filters: AnalyticsFilters): Promise<AnalyticsResponse> {
    return getCached(getCacheKey("combined", filters), () => analyticsService.getAnalytics(filters));
  },

  clear() {
    cache.clear();
  },
};
