import { ApiError } from "@/domains/shared/types";
import type { UserDraftResponse } from "./types";

const BASE = "/api/me/drafts";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw await ApiError.fromResponse(res);
  return res.json();
}

export const userDraftApi = {
  async get<T>(routeKey: string): Promise<UserDraftResponse<T> | null> {
    const params = new URLSearchParams({ routeKey });
    return request<UserDraftResponse<T> | null>(`${BASE}?${params.toString()}`);
  },

  async save<T>(routeKey: string, data: T): Promise<UserDraftResponse<T>> {
    return request<UserDraftResponse<T>>(BASE, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ routeKey, data }),
    });
  },

  async clear(routeKey: string): Promise<void> {
    const params = new URLSearchParams({ routeKey });
    await request<{ ok: true }>(`${BASE}?${params.toString()}`, {
      method: "DELETE",
    });
  },
};
