import type { CalendarEventItem } from "@/domains/event/types";
import {
  addDaysToDateKey,
  getDateKeyInLosAngeles,
  zonedDateTimeToUtc,
} from "@/lib/date-utils";
import type {
  AgendaSourceKey,
  AgendaSourceMeta,
  AgendaStreamDay,
  AgendaStreamEvent,
  AgendaStreamStats,
} from "./types";

const AGENDA_SOURCE_META: Record<AgendaSourceKey, AgendaSourceMeta> = {
  MEETING: { label: "Meeting", color: "#3b82f6", icon: "📋" },
  SEMINAR: { label: "Seminar", color: "#8b5cf6", icon: "🎓" },
  VENDOR: { label: "Vendor", color: "#14b8a6", icon: "🏢" },
  OTHER: { label: "Other", color: "#6b7280", icon: "📌" },
  catering: { label: "Catering", color: "#f97316", icon: "🍽️" },
  birthday: { label: "Birthday", color: "#ec4899", icon: "🎂" },
};

const MILLISECONDS_PER_MINUTE = 60_000;
const DEFAULT_EVENT_DURATION_MIN = 30;
const LA_TIME_ZONE = "America/Los_Angeles";
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const FLOATING_DATETIME_PATTERN = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/;
const TIMEZONE_SUFFIX_PATTERN = /(Z|[+-]\d{2}:\d{2})$/;

function getTimePartsInTimeZone(date: Date, timeZone: string): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    hourCycle: "h23",
  }).formatToParts(date);

  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  const minute = Number(parts.find((part) => part.type === "minute")?.value);

  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    throw new Error("Unable to derive time parts in the requested time zone");
  }

  return { hour, minute };
}

function getStartMinutesInLosAngeles(date: Date): number {
  const { hour, minute } = getTimePartsInTimeZone(date, LA_TIME_ZONE);
  return hour * 60 + minute;
}

function parseEventTimestamp(value: string): { date: Date; dateKey: string } {
  if (DATE_ONLY_PATTERN.test(value)) {
    return {
      date: zonedDateTimeToUtc(value, "12:00"),
      dateKey: value,
    };
  }

  const floatingMatch = value.match(FLOATING_DATETIME_PATTERN);
  if (floatingMatch && !TIMEZONE_SUFFIX_PATTERN.test(value)) {
    const [, dateKey, hour, minute] = floatingMatch;
    return {
      date: zonedDateTimeToUtc(dateKey, `${hour}:${minute}`),
      dateKey,
    };
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid calendar event timestamp: ${value}`);
  }

  return {
    date,
    dateKey: getDateKeyInLosAngeles(date),
  };
}

export function getAgendaSourceMeta(source: AgendaSourceKey): AgendaSourceMeta {
  return AGENDA_SOURCE_META[source];
}

export function toAgendaStreamEvent(event: CalendarEventItem): AgendaStreamEvent {
  const start = parseEventTimestamp(event.start);
  const end = event.end ? parseEventTimestamp(event.end) : null;
  const source = event.source === "manual" ? (event.extendedProps.type ?? "OTHER") : event.source;
  const dateKey = start.dateKey;
  const durMin = event.allDay
    ? 24 * 60
    : Math.max(
        0,
        Math.round(
          ((end?.date.getTime() ?? start.date.getTime() + DEFAULT_EVENT_DURATION_MIN * MILLISECONDS_PER_MINUTE) -
            start.date.getTime()) /
            MILLISECONDS_PER_MINUTE,
        ),
      );

  return {
    id: event.id,
    calendarEventId: event.id,
    dateKey,
    startMin: event.allDay ? 0 : getStartMinutesInLosAngeles(start.date),
    durMin,
    source,
    title: event.title,
    metadata: {
      amount: event.extendedProps.totalAmount ?? null,
      location: event.extendedProps.location ?? null,
      headcount: event.extendedProps.headcount ?? null,
      quoteId: event.extendedProps.quoteId ?? null,
      quoteNumber: event.extendedProps.quoteNumber ?? null,
      quoteStatus: event.extendedProps.quoteStatus ?? null,
      staffId: event.extendedProps.staffId ?? null,
      eventId: event.extendedProps.eventId ?? null,
      description: event.extendedProps.description ?? null,
      setupTime: event.extendedProps.setupTime ?? null,
      takedownTime: event.extendedProps.takedownTime ?? null,
    },
    readOnly: event.source !== "manual",
    allDay: event.allDay,
    original: event,
  };
}

export function assignColumns<TEvent extends { id: string; startMin: number; durMin: number }>(
  events: TEvent[],
): Array<TEvent & { col: number; colCount: number }> {
  const sorted = [...events].sort((left, right) => {
    if (left.startMin !== right.startMin) return left.startMin - right.startMin;
    if (left.durMin !== right.durMin) return left.durMin - right.durMin;
    return left.id.localeCompare(right.id);
  });

  const columnEndMinutes: number[] = [];
  let maxColumnCount = 0;

  const positioned = sorted.map((event) => {
    let col = columnEndMinutes.findIndex((endMin) => endMin <= event.startMin);
    if (col === -1) {
      col = columnEndMinutes.length;
      columnEndMinutes.push(0);
    }

    columnEndMinutes[col] = event.startMin + event.durMin;
    maxColumnCount = Math.max(maxColumnCount, columnEndMinutes.length);

    return { ...event, col, colCount: 0 };
  });

  return positioned.map((event) => ({
    ...event,
    colCount: maxColumnCount || 1,
  }));
}

export function buildAgendaStreamDays<TEvent extends { dateKey: string }>(
  weekStart: string,
  events: TEvent[],
): AgendaStreamDay<TEvent>[] {
  return Array.from({ length: 5 }, (_, index) => {
    const dateKey = addDaysToDateKey(weekStart, index);
    return {
      date: zonedDateTimeToUtc(dateKey, "12:00"),
      dateKey,
      events: events.filter((event) => event.dateKey === dateKey),
    };
  });
}

export function buildAgendaStreamStats(
  events: Array<{ source: string; amount?: number | null }>,
): AgendaStreamStats {
  return {
    totalEvents: events.length,
    cateringCount: events.filter((event) => event.source === "catering").length,
    cateringTotal: events.reduce((sum, event) => sum + (event.source === "catering" ? event.amount ?? 0 : 0), 0),
  };
}
