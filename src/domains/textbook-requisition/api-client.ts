import { ApiError } from "@/domains/shared/types";
import type {
  RequisitionResponse,
  RequisitionListResponse,
  RequisitionFilters,
  CreateRequisitionInput,
  UpdateRequisitionInput,
  RequisitionStats,
  RequisitionSubmitAck,
  NotificationResult,
} from "./types";

const BASE = "/api/textbook-requisitions";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const method = init?.method?.toUpperCase() ?? "GET";
  const res = await fetch(url, method === "GET" ? { ...init, cache: "no-store" } : init);
  if (!res.ok) throw await ApiError.fromResponse(res);
  return res.json();
}

function buildFilterParams(filters: RequisitionFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.status) params.set("status", filters.status);
  if (filters.term) params.set("term", filters.term);
  if (filters.year !== undefined) params.set("year", String(filters.year));
  if (filters.page) params.set("page", String(filters.page));
  if (filters.pageSize) params.set("pageSize", String(filters.pageSize));
  if (filters.sortBy) params.set("sortBy", filters.sortBy);
  if (filters.sortOrder) params.set("sortOrder", filters.sortOrder);
  return params;
}

export const requisitionApi = {
  async list(filters: RequisitionFilters = {}): Promise<RequisitionListResponse> {
    const params = buildFilterParams(filters);
    return request<RequisitionListResponse>(`${BASE}?${params}`);
  },

  async getById(id: string): Promise<RequisitionResponse> {
    return request<RequisitionResponse>(`${BASE}/${id}`);
  },

  async create(input: CreateRequisitionInput): Promise<RequisitionResponse> {
    return request<RequisitionResponse>(BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  },

  async submitPublic(
    input: Omit<CreateRequisitionInput, "status" | "source" | "staffNotes">,
  ): Promise<RequisitionSubmitAck> {
    return request<RequisitionSubmitAck>(`${BASE}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  },

  async update(id: string, input: UpdateRequisitionInput): Promise<RequisitionResponse> {
    return request<RequisitionResponse>(`${BASE}/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  },

  async updateStatus(id: string, status: string): Promise<RequisitionResponse> {
    return request<RequisitionResponse>(`${BASE}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
  },

  async delete(id: string): Promise<void> {
    const res = await fetch(`${BASE}/${id}`, { method: "DELETE" });
    if (!res.ok) throw await ApiError.fromResponse(res);
  },

  async sendNotification(
    id: string,
    emailType: "ordered" | "on-shelf",
  ): Promise<NotificationResult> {
    return request<NotificationResult>(`${BASE}/${id}/notify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emailType }),
    });
  },

  async getStats(): Promise<RequisitionStats> {
    return request<RequisitionStats>(`${BASE}?statsOnly=true`);
  },

  async getDistinctYears(): Promise<number[]> {
    return request<number[]>(`${BASE}?yearsOnly=true`);
  },

  async exportCsv(filters: RequisitionFilters = {}): Promise<Blob> {
    const params = buildFilterParams(filters);
    const res = await fetch(`${BASE}/export?${params}`);
    if (!res.ok) throw await ApiError.fromResponse(res);
    return res.blob();
  },
};
