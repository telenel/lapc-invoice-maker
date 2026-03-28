import { ApiError } from "@/domains/shared/types";

const BASE = "/api/saved-items";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw await ApiError.fromResponse(res);
  return res.json();
}

export interface SavedItemResponse {
  id: string;
  department: string;
  description: string;
  unitPrice: number;
  usageCount: number;
}

export interface CreateSavedItemInput {
  department: string;
  description: string;
  unitPrice: number;
}

export interface UpdateSavedItemInput {
  department?: string;
  description?: string;
  unitPrice?: number;
}

export const savedItemsApi = {
  async list(department?: string): Promise<SavedItemResponse[]> {
    const params = new URLSearchParams();
    if (department) params.set("department", department);
    const qs = params.toString();
    return request<SavedItemResponse[]>(`${BASE}${qs ? `?${qs}` : ""}`);
  },

  async create(input: CreateSavedItemInput): Promise<SavedItemResponse> {
    return request<SavedItemResponse>(BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  },

  async update(id: string, input: UpdateSavedItemInput): Promise<SavedItemResponse> {
    return request<SavedItemResponse>(`${BASE}/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  },

  async delete(id: string): Promise<void> {
    const res = await fetch(`${BASE}/${id}`, { method: "DELETE" });
    if (!res.ok) throw await ApiError.fromResponse(res);
  },
};
