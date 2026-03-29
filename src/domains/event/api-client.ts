import { ApiError } from "@/domains/shared/types";
import type { EventResponse, CreateEventInput, UpdateEventInput, CalendarEventItem } from "./types";

const BASE = "/api/events";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw await ApiError.fromResponse(res);
  return res.json() as Promise<T>;
}

export const eventApi = {
  async list(start: string, end: string): Promise<CalendarEventItem[]> {
    return request<CalendarEventItem[]>(
      `${BASE}?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`
    );
  },

  async getById(id: string): Promise<EventResponse> {
    return request<EventResponse>(`${BASE}/${id}`);
  },

  async create(input: CreateEventInput): Promise<EventResponse> {
    return request<EventResponse>(BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  },

  async update(id: string, input: UpdateEventInput): Promise<EventResponse> {
    return request<EventResponse>(`${BASE}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  },

  async remove(id: string): Promise<void> {
    await request(`${BASE}/${id}`, { method: "DELETE" });
  },
};
