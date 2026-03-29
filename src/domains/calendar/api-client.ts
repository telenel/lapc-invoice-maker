import { ApiError } from "@/domains/shared/types";
import type { CalendarEventItem } from "@/domains/event/types";

const BASE = "/api/calendar";

async function request<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw await ApiError.fromResponse(res);
  return res.json();
}

export type CalendarEvent = CalendarEventItem;

export const calendarApi = {
  async getEvents(start: string, end: string): Promise<CalendarEvent[]> {
    return request<CalendarEvent[]>(
      `${BASE}/events?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
    );
  },
};
