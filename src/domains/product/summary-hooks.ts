"use client";

import { useCallback, useEffect, useState, useDeferredValue } from "react";
import { productApi } from "./api-client";
import { serializeFiltersToSearchParams } from "./view-serializer";
import type { ProductFilters } from "./types";
import type {
  ProductAnalysisWindow,
  ProductRollupGroup,
  ProductRollupsResponse,
  ProductSummaryResponse,
} from "./summary-types";

export function useProductSummary(filters: ProductFilters, analysisWindow: ProductAnalysisWindow) {
  const [summary, setSummary] = useState<ProductSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const deferredSearch = useDeferredValue(filters.search);

  const effectiveFilters: ProductFilters = {
    ...filters,
    search: deferredSearch,
  };

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = serializeFiltersToSearchParams(effectiveFilters);
      params.set("analysisWindow", analysisWindow);
      const data = await productApi.getSummary(params.toString());
      setSummary(data);
    } catch (err) {
      setSummary(null);
      setError(err instanceof Error ? err.message : "Failed to load product summary");
    } finally {
      setLoading(false);
    }
  }, [analysisWindow, JSON.stringify(effectiveFilters)]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { summary, loading, error, refetch };
}

export function useProductRollups(filters: ProductFilters, group: ProductRollupGroup) {
  const [rollups, setRollups] = useState<ProductRollupsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const deferredSearch = useDeferredValue(filters.search);

  const effectiveFilters: ProductFilters = {
    ...filters,
    search: deferredSearch,
  };

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = serializeFiltersToSearchParams(effectiveFilters);
      params.set("group", group);
      const data = await productApi.getRollups(params.toString());
      setRollups(data);
    } catch (err) {
      setRollups(null);
      setError(err instanceof Error ? err.message : "Failed to load product rollups");
    } finally {
      setLoading(false);
    }
  }, [group, JSON.stringify(effectiveFilters)]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { rollups, loading, error, refetch };
}
