import { ApiError } from "@/domains/shared/types";

const BASE = "/api/user-quick-picks";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw await ApiError.fromResponse(res);
  return res.json();
}

export interface UserQuickPickResponse {
  id: string;
  description: string;
  unitPrice: number;
  department: string;
  usageCount: number;
  isCurrentDept?: boolean;
}

export interface CreateUserQuickPickInput {
  description: string;
  unitPrice: number;
  department: string;
}

export const userQuickPicksApi = {
  async list(department?: string): Promise<UserQuickPickResponse[]> {
    const params = new URLSearchParams();
    if (department) params.set("department", department);
    const qs = params.toString();
    return request<UserQuickPickResponse[]>(`${BASE}${qs ? `?${qs}` : ""}`);
  },

  async create(input: CreateUserQuickPickInput): Promise<UserQuickPickResponse> {
    return request<UserQuickPickResponse>(BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  },

  async delete(id: string): Promise<void> {
    const params = new URLSearchParams({ id });
    const res = await fetch(`${BASE}?${params}`, { method: "DELETE" });
    if (!res.ok) throw await ApiError.fromResponse(res);
  },
};
