"use client";

import { useState, useEffect, useCallback } from "react";
import { requisitionApi } from "./api-client";
import { useSSE } from "@/lib/use-sse";
import type {
  RequisitionResponse,
  RequisitionListResponse,
  RequisitionFilters,
  RequisitionStats,
} from "./types";

export function useRequisitions(initialFilters: RequisitionFilters = {}) {
  const [data, setData] = useState<RequisitionListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [filters, setFilters] = useState(initialFilters);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await requisitionApi.list(filters);
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e : new Error("Failed to load requisitions"));
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  useSSE("requisition-changed", () => void fetchData());

  return { data, loading, error, filters, setFilters, refetch: fetchData };
}

export function useRequisition(id: string) {
  const [data, setData] = useState<RequisitionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await requisitionApi.getById(id);
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e : new Error("Failed to load requisition"));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  useSSE("requisition-changed", () => void fetchData());

  return { data, loading, error, refetch: fetchData };
}

export function useRequisitionStats() {
  const [data, setData] = useState<RequisitionStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const result = await requisitionApi.getStats();
      setData(result);
    } catch {
      // Stats are non-critical
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  useSSE("requisition-changed", () => void fetchData());

  return { data, loading, refetch: fetchData };
}
