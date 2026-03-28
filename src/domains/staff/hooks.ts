"use client";

import { useState, useEffect, useCallback } from "react";
import { staffApi } from "./api-client";
import { handleApiError } from "@/domains/shared/errors";
import type { StaffResponse, StaffDetailResponse, StaffFilters } from "./types";
import type { PaginatedResponse } from "@/domains/shared/types";

export function useStaffList(filters?: StaffFilters) {
  const [data, setData] = useState<StaffResponse[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      setData(await staffApi.list(filters));
    } catch (e) {
      handleApiError(e, "Failed to load staff");
    } finally {
      setLoading(false);
    }
  }, [filters?.search]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, refetch };
}

export function useStaffListPaginated(filters: StaffFilters & { page: number; pageSize: number }) {
  const [data, setData] = useState<PaginatedResponse<StaffResponse> | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      setData(await staffApi.listPaginated(filters));
    } catch (e) {
      handleApiError(e, "Failed to load staff");
    } finally {
      setLoading(false);
    }
  }, [filters.search, filters.page, filters.pageSize]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, refetch };
}

export function useStaff(id: string | null) {
  const [data, setData] = useState<StaffDetailResponse | null>(null);
  const [loading, setLoading] = useState(!!id);

  const refetch = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      setData(await staffApi.getById(id));
    } catch (e) {
      handleApiError(e, "Failed to load staff member");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, refetch };
}
