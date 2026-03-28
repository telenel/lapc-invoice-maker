// src/domains/quote/api-client.ts
import { ApiError } from "@/domains/shared/types";
import type {
  QuoteResponse,
  CreateQuoteInput,
  UpdateQuoteInput,
  QuoteFilters,
} from "./types";

const BASE = "/api/quotes";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw await ApiError.fromResponse(res);
  return res.json();
}

function buildFilterParams(filters: QuoteFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.quoteStatus) params.set("quoteStatus", filters.quoteStatus);
  if (filters.department) params.set("department", filters.department);
  if (filters.category) params.set("category", filters.category);
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) params.set("dateTo", filters.dateTo);
  if (filters.page) params.set("page", String(filters.page));
  if (filters.pageSize) params.set("pageSize", String(filters.pageSize));
  if (filters.sortBy) params.set("sortBy", filters.sortBy);
  if (filters.sortOrder) params.set("sortOrder", filters.sortOrder);
  return params;
}

export interface QuoteListResponse {
  quotes: QuoteResponse[];
  total: number;
  page: number;
  pageSize: number;
}

export const quoteApi = {
  async list(filters: QuoteFilters = {}): Promise<QuoteListResponse> {
    const params = buildFilterParams(filters);
    return request<QuoteListResponse>(`${BASE}?${params}`);
  },

  async getById(id: string): Promise<QuoteResponse> {
    return request<QuoteResponse>(`${BASE}/${id}`);
  },

  async create(input: CreateQuoteInput): Promise<QuoteResponse> {
    return request<QuoteResponse>(BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  },

  async update(id: string, input: UpdateQuoteInput): Promise<QuoteResponse> {
    return request<QuoteResponse>(`${BASE}/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  },

  async delete(id: string): Promise<void> {
    const res = await fetch(`${BASE}/${id}`, { method: "DELETE" });
    if (!res.ok) throw await ApiError.fromResponse(res);
  },

  async markSent(id: string): Promise<{ success: boolean; shareUrl: string }> {
    return request<{ success: boolean; shareUrl: string }>(`${BASE}/${id}/send`, {
      method: "POST",
    });
  },

  async convertToInvoice(id: string): Promise<{ invoice: QuoteResponse; redirectTo: string }> {
    return request<{ invoice: QuoteResponse; redirectTo: string }>(`${BASE}/${id}/convert`, {
      method: "POST",
    });
  },

  async getPdf(id: string): Promise<Blob> {
    const res = await fetch(`${BASE}/${id}/pdf`);
    if (!res.ok) throw await ApiError.fromResponse(res);
    return res.blob();
  },

  async getViews(id: string): Promise<import("./types").QuoteViewResponse[]> {
    return request<import("./types").QuoteViewResponse[]>(`${BASE}/${id}/views`);
  },
};
