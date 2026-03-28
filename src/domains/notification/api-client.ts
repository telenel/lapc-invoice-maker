import { ApiError } from "@/domains/shared/types";
import type { NotificationResponse } from "./types";

const BASE = "/api/notifications";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw await ApiError.fromResponse(res);
  return res.json();
}

export interface NotificationListResponse {
  notifications: NotificationResponse[];
  unreadCount: number;
}

export const notificationApi = {
  async list(limit = 20, offset = 0): Promise<NotificationListResponse> {
    return request<NotificationListResponse>(`${BASE}?limit=${limit}&offset=${offset}`);
  },

  async markRead(id: string): Promise<void> {
    await request(`${BASE}/${id}`, { method: "PATCH" });
  },

  async markAllRead(): Promise<void> {
    await request(`${BASE}/read-all`, { method: "PATCH" });
  },
};
