import { ApiError } from "@/domains/shared/types";

const BASE = "/api/categories";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw await ApiError.fromResponse(res);
  return res.json();
}

export interface CategoryResponse {
  id: string;
  name: string;
  label: string;
  active: boolean;
  sortOrder: number;
}

export interface CreateCategoryInput {
  name: string;
  label: string;
  sortOrder?: number;
}

export interface UpdateCategoryInput {
  name?: string;
  active?: boolean;
  sortOrder?: number;
}

export const categoryApi = {
  async list(all?: boolean): Promise<CategoryResponse[]> {
    const params = new URLSearchParams();
    if (all) params.set("all", "true");
    const qs = params.toString();
    return request<CategoryResponse[]>(`${BASE}${qs ? `?${qs}` : ""}`);
  },

  async create(input: CreateCategoryInput): Promise<CategoryResponse> {
    return request<CategoryResponse>(BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  },

  async update(id: string, input: UpdateCategoryInput): Promise<CategoryResponse> {
    return request<CategoryResponse>(`${BASE}/${id}`, {
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
