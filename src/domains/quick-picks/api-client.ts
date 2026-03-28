import { ApiError } from "@/domains/shared/types";

const BASE = "/api/quick-picks";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw await ApiError.fromResponse(res);
  return res.json();
}

export interface QuickPickResponse {
  id: string;
  description: string;
  defaultPrice: number | string;
  department: string;
  usageCount: number;
}

export interface CreateQuickPickInput {
  description: string;
  unitPrice: number;
  department: string;
}

export interface UpdateQuickPickInput {
  description?: string;
  unitPrice?: number;
  department?: string;
}

export const quickPicksApi = {
  async list(department?: string): Promise<QuickPickResponse[]> {
    const params = new URLSearchParams();
    if (department) params.set("department", department);
    const qs = params.toString();
    return request<QuickPickResponse[]>(`${BASE}${qs ? `?${qs}` : ""}`);
  },

  async create(input: CreateQuickPickInput): Promise<QuickPickResponse> {
    return request<QuickPickResponse>(BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  },

  async update(id: string, input: UpdateQuickPickInput): Promise<QuickPickResponse> {
    return request<QuickPickResponse>(`${BASE}/${id}`, {
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
