import { ApiError } from "@/domains/shared/types";
import type {
  StaffResponse,
  StaffDetailResponse,
  StaffFilters,
  CreateStaffInput,
  UpdateStaffInput,
  AccountNumberResponse,
  UpsertAccountNumberInput,
} from "./types";
import type { PaginatedResponse } from "@/domains/shared/types";

const BASE = "/api/staff";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw await ApiError.fromResponse(res);
  return res.json();
}

export const staffApi = {
  async list(filters?: StaffFilters): Promise<StaffResponse[]> {
    const params = new URLSearchParams();
    if (filters?.search) params.set("search", filters.search);
    const qs = params.toString();
    return request<StaffResponse[]>(`${BASE}${qs ? `?${qs}` : ""}`);
  },

  async listPaginated(filters: StaffFilters & { page: number; pageSize: number }): Promise<PaginatedResponse<StaffResponse>> {
    const params = new URLSearchParams({
      paginated: "true",
      page: String(filters.page),
      pageSize: String(filters.pageSize),
    });
    if (filters.search) params.set("search", filters.search);
    return request<PaginatedResponse<StaffResponse>>(`${BASE}?${params}`);
  },

  async getById(id: string): Promise<StaffDetailResponse> {
    return request<StaffDetailResponse>(`${BASE}/${id}`);
  },

  async create(input: CreateStaffInput): Promise<StaffResponse> {
    return request<StaffResponse>(BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  },

  async update(id: string, input: UpdateStaffInput): Promise<StaffDetailResponse> {
    return request<StaffDetailResponse>(`${BASE}/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  },

  async partialUpdate(id: string, input: UpdateStaffInput): Promise<StaffDetailResponse> {
    return request<StaffDetailResponse>(`${BASE}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  },

  async delete(id: string): Promise<void> {
    const res = await fetch(`${BASE}/${id}`, { method: "DELETE" });
    if (!res.ok) throw await ApiError.fromResponse(res);
  },

  async getAccountNumbers(staffId: string): Promise<AccountNumberResponse[]> {
    return request<AccountNumberResponse[]>(`${BASE}/${staffId}/account-numbers`);
  },

  async upsertAccountNumber(staffId: string, input: Omit<UpsertAccountNumberInput, "staffId">): Promise<void> {
    await request(`${BASE}/${staffId}/account-numbers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  },
};
