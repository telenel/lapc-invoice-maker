import { ApiError } from "@/domains/shared/types";
import type { UserPreferenceResponse } from "./types";

const BASE = "/api/me/preferences";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw await ApiError.fromResponse(res);
  return res.json();
}

export const userPreferenceApi = {
  async get<T>(key: string): Promise<UserPreferenceResponse<T> | null> {
    return request<UserPreferenceResponse<T> | null>(`${BASE}/${encodeURIComponent(key)}`);
  },

  async save<T>(key: string, value: T): Promise<UserPreferenceResponse<T>> {
    return request<UserPreferenceResponse<T>>(`${BASE}/${encodeURIComponent(key)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value }),
    });
  },

  async clear(key: string): Promise<void> {
    await request<{ ok: true }>(`${BASE}/${encodeURIComponent(key)}`, {
      method: "DELETE",
    });
  },
};
