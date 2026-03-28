import { ApiError } from "@/domains/shared/types";
import type {
  InvoiceResponse,
  InvoiceListResponse,
  CreateInvoiceInput,
  InvoiceFilters,
  FinalizeInput,
  InvoiceStatsResponse,
  CreatorStatsResponse,
} from "./types";

const BASE = "/api/invoices";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw await ApiError.fromResponse(res);
  return res.json();
}

function buildFilterParams(filters: InvoiceFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.status) params.set("status", filters.status);
  if (filters.staffId) params.set("staffId", filters.staffId);
  if (filters.department) params.set("department", filters.department);
  if (filters.category) params.set("category", filters.category);
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) params.set("dateTo", filters.dateTo);
  if (filters.amountMin !== undefined) params.set("amountMin", String(filters.amountMin));
  if (filters.amountMax !== undefined) params.set("amountMax", String(filters.amountMax));
  if (filters.creatorId) params.set("creatorId", filters.creatorId);
  if (filters.isRunning !== undefined) params.set("isRunning", String(filters.isRunning));
  if (filters.page) params.set("page", String(filters.page));
  if (filters.pageSize) params.set("pageSize", String(filters.pageSize));
  if (filters.sortBy) params.set("sortBy", filters.sortBy);
  if (filters.sortOrder) params.set("sortOrder", filters.sortOrder);
  return params;
}

export const invoiceApi = {
  async list(filters: InvoiceFilters = {}): Promise<InvoiceListResponse> {
    const params = buildFilterParams(filters);
    return request<InvoiceListResponse>(`${BASE}?${params}`);
  },

  async getById(id: string): Promise<InvoiceResponse> {
    return request<InvoiceResponse>(`${BASE}/${id}`);
  },

  async create(input: CreateInvoiceInput): Promise<InvoiceResponse> {
    return request<InvoiceResponse>(BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  },

  async update(id: string, input: Partial<CreateInvoiceInput>): Promise<InvoiceResponse> {
    return request<InvoiceResponse>(`${BASE}/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  },

  async delete(id: string): Promise<void> {
    const res = await fetch(`${BASE}/${id}`, { method: "DELETE" });
    if (!res.ok) throw await ApiError.fromResponse(res);
  },

  async finalize(id: string, input: FinalizeInput): Promise<InvoiceResponse> {
    return request<InvoiceResponse>(`${BASE}/${id}/finalize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  },

  async getStats(filters: InvoiceFilters = {}): Promise<InvoiceStatsResponse> {
    const params = buildFilterParams(filters);
    params.set("statsOnly", "true");
    return request<InvoiceStatsResponse>(`${BASE}?${params}`);
  },

  async getCreatorStats(status?: "DRAFT" | "FINAL" | "PENDING_CHARGE"): Promise<CreatorStatsResponse> {
    const params = new URLSearchParams({ statsOnly: "true", groupBy: "creator" });
    if (status) params.set("status", status);
    return request<CreatorStatsResponse>(`${BASE}?${params}`);
  },

  async getPdf(id: string): Promise<Blob> {
    const res = await fetch(`${BASE}/${id}/pdf`);
    if (!res.ok) throw await ApiError.fromResponse(res);
    return res.blob();
  },

  async exportCsv(filters: InvoiceFilters = {}): Promise<Blob> {
    const params = buildFilterParams(filters);
    const res = await fetch(`${BASE}/export?${params}`);
    if (!res.ok) throw await ApiError.fromResponse(res);
    return res.blob();
  },
};
