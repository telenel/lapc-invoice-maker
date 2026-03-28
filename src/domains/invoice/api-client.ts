import { ApiError } from "@/domains/shared/types";
import type {
  InvoiceResponse,
  CreateInvoiceInput,
  InvoiceFilters,
  FinalizeInput,
  InvoiceStatsResponse,
} from "./types";
import type { PaginatedResponse } from "@/domains/shared/types";

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
  if (filters.page) params.set("page", String(filters.page));
  if (filters.pageSize) params.set("pageSize", String(filters.pageSize));
  if (filters.sortBy) params.set("sortBy", filters.sortBy);
  if (filters.sortOrder) params.set("sortOrder", filters.sortOrder);
  return params;
}

export const invoiceApi = {
  async list(filters: InvoiceFilters = {}): Promise<PaginatedResponse<InvoiceResponse>> {
    const params = buildFilterParams(filters);
    return request<PaginatedResponse<InvoiceResponse>>(`${BASE}?${params}`);
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
