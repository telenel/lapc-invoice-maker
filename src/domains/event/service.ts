import * as eventRepository from "./repository";
import { safePublishAll } from "@/lib/sse";
import { EVENT_TYPE_COLORS } from "./types";
import type {
  EventResponse,
  CreateEventInput,
  UpdateEventInput,
  CalendarEventItem,
  EventType,
  Recurrence,
} from "./types";

function toResponse(event: {
  id: string;
  title: string;
  description: string | null;
  type: string;
  date: Date;
  startTime: string | null;
  endTime: string | null;
  allDay: boolean;
  location: string | null;
  color: string;
  recurrence: string | null;
  recurrenceEnd: Date | null;
  reminderMinutes: number | null;
  createdBy: string;
  createdAt: Date;
}): EventResponse {
  return {
    id: event.id,
    title: event.title,
    description: event.description,
    type: event.type as EventType,
    date: event.date.toISOString().split("T")[0],
    startTime: event.startTime,
    endTime: event.endTime,
    allDay: event.allDay,
    location: event.location,
    color: event.color,
    recurrence: event.recurrence as Recurrence | null,
    recurrenceEnd: event.recurrenceEnd ? event.recurrenceEnd.toISOString().split("T")[0] : null,
    reminderMinutes: event.reminderMinutes,
    createdBy: event.createdBy,
    createdAt: event.createdAt.toISOString(),
  };
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setUTCMonth(result.getUTCMonth() + months);
  return result;
}

function addYears(date: Date, years: number): Date {
  const result = new Date(date);
  result.setUTCFullYear(result.getUTCFullYear() + years);
  return result;
}

function nextOccurrence(date: Date, recurrence: Recurrence): Date {
  switch (recurrence) {
    case "DAILY":
      return addDays(date, 1);
    case "WEEKLY":
      return addDays(date, 7);
    case "MONTHLY":
      return addMonths(date, 1);
    case "YEARLY":
      return addYears(date, 1);
  }
}

function toCalendarItem(
  event: Awaited<ReturnType<typeof eventRepository.findById>>,
  occurrenceDate?: Date
): CalendarEventItem | null {
  if (!event) return null;
  const color = event.color;
  const date = occurrenceDate ?? event.date;
  const dateStr = date.toISOString().split("T")[0];
  const start = !event.allDay && event.startTime ? `${dateStr}T${event.startTime}:00` : dateStr;
  const end = !event.allDay && event.endTime ? `${dateStr}T${event.endTime}:00` : null;

  return {
    id: occurrenceDate ? `${event.id}__${dateStr}` : event.id,
    title: event.title,
    start,
    end,
    allDay: event.allDay,
    color: `${color}26`,
    borderColor: color,
    textColor: color,
    source: "manual",
    extendedProps: {
      type: event.type as EventType,
      location: event.location,
      description: event.description,
      eventId: event.id,
    },
  };
}

function expandRecurring(
  event: NonNullable<Awaited<ReturnType<typeof eventRepository.findById>>>,
  rangeStart: Date,
  rangeEnd: Date
): CalendarEventItem[] {
  if (!event.recurrence) {
    const inRange = event.date >= rangeStart && event.date <= rangeEnd;
    if (!inRange) return [];
    const item = toCalendarItem(event);
    return item ? [item] : [];
  }

  const recurrence = event.recurrence as Recurrence;
  const recurrenceEnd = event.recurrenceEnd ?? null;
  const results: CalendarEventItem[] = [];

  let current = new Date(event.date);
  // Advance past the range start if the event started before the range
  while (current < rangeStart) {
    current = nextOccurrence(current, recurrence);
  }

  while (current <= rangeEnd) {
    if (recurrenceEnd && current > recurrenceEnd) break;
    const item = toCalendarItem(event, current);
    if (item) results.push(item);
    current = nextOccurrence(current, recurrence);
  }

  return results;
}

export const eventService = {
  async create(input: CreateEventInput, userId: string): Promise<EventResponse> {
    const color = EVENT_TYPE_COLORS[input.type];
    const event = await eventRepository.create({
      title: input.title,
      type: input.type,
      date: new Date(input.date),
      color,
      allDay: input.allDay ?? false,
      startTime: input.startTime ?? null,
      endTime: input.endTime ?? null,
      description: input.description ?? null,
      location: input.location ?? null,
      recurrence: input.recurrence ?? null,
      recurrenceEnd: input.recurrenceEnd ? new Date(input.recurrenceEnd) : null,
      reminderMinutes: input.reminderMinutes !== undefined ? input.reminderMinutes : 60,
      createdBy: userId,
    });
    safePublishAll({ type: "calendar-changed" });
    return toResponse(event);
  },

  async getById(id: string): Promise<EventResponse | null> {
    const event = await eventRepository.findById(id);
    if (!event) return null;
    return toResponse(event);
  },

  async update(id: string, input: UpdateEventInput): Promise<EventResponse | null> {
    const existing = await eventRepository.findById(id);
    if (!existing) return null;

    const data: Record<string, unknown> = { ...input };
    if (input.type) {
      data.color = EVENT_TYPE_COLORS[input.type];
    }
    if (input.date !== undefined) {
      data.date = new Date(input.date);
    }
    if (input.recurrenceEnd !== undefined) {
      data.recurrenceEnd = input.recurrenceEnd ? new Date(input.recurrenceEnd) : null;
    }

    const updated = await eventRepository.update(id, data);
    safePublishAll({ type: "calendar-changed" });
    return toResponse(updated);
  },

  async remove(id: string): Promise<void> {
    await eventRepository.remove(id);
    safePublishAll({ type: "calendar-changed" });
  },

  async listForDateRange(start: Date, end: Date): Promise<CalendarEventItem[]> {
    const events = await eventRepository.findByDateRangeIncludingRecurring(start, end);

    const items: CalendarEventItem[] = [];
    for (const event of events) {
      const expanded = expandRecurring(event, start, end);
      items.push(...expanded);
    }

    return items;
  },

  expandRecurring,
};
