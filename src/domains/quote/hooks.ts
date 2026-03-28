"use client";

import { useState, useEffect, useCallback } from "react";
import { quoteApi } from "./api-client";
import { handleApiError } from "@/domains/shared/errors";
import type { QuoteResponse, QuoteFilters } from "./types";
import type { QuoteListResponse } from "./api-client";

export function useQuotes(filters: QuoteFilters) {
  const [data, setData] = useState<QuoteListResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      setData(await quoteApi.list(filters));
    } catch (e) {
      handleApiError(e, "Failed to load quotes");
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(filters)]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, refetch };
}

export function useQuote(id: string | null) {
  const [data, setData] = useState<QuoteResponse | null>(null);
  const [loading, setLoading] = useState(!!id);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      setData(await quoteApi.getById(id));
    } catch (e) {
      setError(e instanceof Error ? e : new Error("Failed to load quote"));
      handleApiError(e, "Failed to load quote");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}
