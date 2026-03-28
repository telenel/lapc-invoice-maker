"use client";

import { useState, useEffect, useCallback } from "react";
import { invoiceApi } from "./api-client";
import { handleApiError } from "@/domains/shared/errors";
import type { InvoiceResponse, InvoiceListResponse, InvoiceFilters, InvoiceStatsResponse } from "./types";

export function useInvoices(filters: InvoiceFilters) {
  const [data, setData] = useState<InvoiceListResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      setData(await invoiceApi.list(filters));
    } catch (e) {
      handleApiError(e, "Failed to load invoices");
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(filters)]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, refetch };
}

export function useInvoice(id: string | null) {
  const [data, setData] = useState<InvoiceResponse | null>(null);
  const [loading, setLoading] = useState(!!id);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      setData(await invoiceApi.getById(id));
    } catch (e) {
      setError(e instanceof Error ? e : new Error("Failed to load invoice"));
      handleApiError(e, "Failed to load invoice");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}

export function useInvoiceStats(filters: InvoiceFilters = {}) {
  const [data, setData] = useState<InvoiceStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      setData(await invoiceApi.getStats(filters));
    } catch (e) {
      handleApiError(e, "Failed to load stats");
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(filters)]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, refetch };
}
