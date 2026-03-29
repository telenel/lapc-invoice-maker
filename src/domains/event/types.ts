export type EventType = "MEETING" | "SEMINAR" | "VENDOR" | "OTHER";
export type Recurrence = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";

export const EVENT_TYPE_COLORS: Record<EventType, string> = {
  MEETING: "#3b82f6",
  SEMINAR: "#8b5cf6",
  VENDOR: "#14b8a6",
  OTHER: "#6b7280",
};

export const BIRTHDAY_COLOR = "#ec4899";
export const CATERING_COLOR = "#f97316";

export interface EventResponse {
  id: string;
  title: string;
  description: string | null;
  type: EventType;
  date: string;
  startTime: string | null;
  endTime: string | null;
  allDay: boolean;
  location: string | null;
  color: string;
  recurrence: Recurrence | null;
  recurrenceEnd: string | null;
  reminderMinutes: number | null;
  createdBy: string;
  createdAt: string;
}

export interface CreateEventInput {
  title: string;
  description?: string | null;
  type: EventType;
  date: string;
  startTime?: string | null;
  endTime?: string | null;
  allDay?: boolean;
  location?: string | null;
  recurrence?: Recurrence | null;
  recurrenceEnd?: string | null;
  reminderMinutes?: number | null;
}

export interface UpdateEventInput {
  title?: string;
  description?: string | null;
  type?: EventType;
  date?: string;
  startTime?: string | null;
  endTime?: string | null;
  allDay?: boolean;
  location?: string | null;
  recurrence?: Recurrence | null;
  recurrenceEnd?: string | null;
  reminderMinutes?: number | null;
}

export interface CalendarEventItem {
  id: string;
  title: string;
  start: string;
  end: string | null;
  allDay: boolean;
  color: string;
  borderColor: string;
  textColor: string;
  source: "catering" | "manual" | "birthday";
  extendedProps: {
    type?: EventType;
    location?: string | null;
    headcount?: number | null;
    quoteId?: string | null;
    quoteNumber?: string | null;
    quoteStatus?: string | null;
    staffId?: string | null;
    eventId?: string | null;
    description?: string | null;
    setupTime?: string | null;
    takedownTime?: string | null;
  };
}
