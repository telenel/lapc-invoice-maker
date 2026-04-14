import { ApiError } from "@/domains/shared/types";
import type { ArchiveFilters, ArchiveListResponse } from "./types";

const BASE = "/api/archive";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const method = init?.method?.toUpperCase() ?? "GET";
  const res = await fetch(url, method === "GET" ? { ...init, cache: "no-store" } : init);
  if (!res.ok) throw await ApiError.fromResponse(res);
  return res.json();
}

export const archiveApi = {
  async list(filters: ArchiveFilters = {}): Promise<ArchiveListResponse> {
    const params = new URLSearchParams();
    if (filters.type) params.set("type", filters.type);
    if (filters.search) params.set("search", filters.search);
    if (filters.page) params.set("page", String(filters.page));
    if (filters.pageSize) params.set("pageSize", String(filters.pageSize));
    return request<ArchiveListResponse>(`${BASE}?${params}`);
  },

  async restore(id: string): Promise<{ success: boolean }> {
    return request<{ success: boolean }>(`${BASE}/${id}/restore`, {
      method: "POST",
    });
  },
};
