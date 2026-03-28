import { ApiError } from "@/domains/shared/types";

const BASE = "/api/calendar";

async function request<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw await ApiError.fromResponse(res);
  return res.json();
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  location: string;
  headcount: number | null;
  quoteId: string;
  quoteNumber: string | null;
  quoteStatus: string;
  setupTime: string | null;
  takedownTime: string | null;
}

export const calendarApi = {
  async getEvents(start: string, end: string): Promise<CalendarEvent[]> {
    return request<CalendarEvent[]>(
      `${BASE}/events?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
    );
  },
};
