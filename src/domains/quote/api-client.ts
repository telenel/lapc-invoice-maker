// src/domains/quote/api-client.ts
import { ApiError } from "@/domains/shared/types";
import type {
  QuoteResponse,
  CreateQuoteInput,
  UpdateQuoteInput,
  QuoteFilters,
  PublicQuoteResponse,
  QuotePublicSettingsResponse,
  QuotePublicPaymentSubmission,
  QuotePublicResponseSubmission,
} from "./types";

const BASE = "/api/quotes";
const PUBLIC_BASE = "/api/quotes/public";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const method = init?.method?.toUpperCase() ?? "GET";
  const res = await fetch(url, method === "GET" ? { ...init, cache: "no-store" } : init);
  if (!res.ok) throw await ApiError.fromResponse(res);
  return res.json();
}

function buildFilterParams(filters: QuoteFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.quoteStatus) params.set("quoteStatus", filters.quoteStatus);
  if (filters.department) params.set("department", filters.department);
  if (filters.category) params.set("category", filters.category);
  if (filters.creatorId) params.set("creatorId", filters.creatorId);
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) params.set("dateTo", filters.dateTo);
  if (filters.amountMin !== undefined) params.set("amountMin", String(filters.amountMin));
  if (filters.amountMax !== undefined) params.set("amountMax", String(filters.amountMax));
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

  async approveManually(id: string): Promise<{ success: boolean }> {
    return request<{ success: boolean }>(`${BASE}/${id}/approve`, {
      method: "POST",
    });
  },

  async getViews(id: string): Promise<import("./types").QuoteViewResponse[]> {
    return request<import("./types").QuoteViewResponse[]>(`${BASE}/${id}/views`);
  },

  async getFollowUps(id: string): Promise<import("./types").QuoteFollowUpResponse[]> {
    return request<import("./types").QuoteFollowUpResponse[]>(`${BASE}/${id}/follow-ups`);
  },

  async getPublicQuote(token: string): Promise<PublicQuoteResponse> {
    return request<PublicQuoteResponse>(`${PUBLIC_BASE}/${token}`);
  },

  async getPublicSettings(keys?: string[]): Promise<QuotePublicSettingsResponse> {
    const params = new URLSearchParams();
    if (keys?.length) params.set("keys", keys.join(","));
    const query = params.toString();
    return request<QuotePublicSettingsResponse>(`${PUBLIC_BASE}/settings${query ? `?${query}` : ""}`);
  },

  async registerPublicView(token: string, viewport?: string): Promise<{ viewId: string }> {
    return request<{ viewId: string }>(`${PUBLIC_BASE}/${token}/view`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ viewport }),
    });
  },

  recordPublicViewDuration(token: string, viewId: string, durationSeconds: number): void {
    const body = JSON.stringify({ durationSeconds });
    const url = `${PUBLIC_BASE}/${token}/view/${viewId}`;

    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
      return;
    }

    void fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    });
  },

  async respondToPublicQuote(token: string, input: QuotePublicResponseSubmission): Promise<{ success: boolean; status: "ACCEPTED" | "DECLINED" }> {
    return request<{ success: boolean; status: "ACCEPTED" | "DECLINED" }>(`${PUBLIC_BASE}/${token}/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  },

  async submitPublicPaymentDetails(token: string, input: QuotePublicPaymentSubmission): Promise<{ success: boolean }> {
    return request<{ success: boolean }>(`${PUBLIC_BASE}/${token}/payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  },
};
