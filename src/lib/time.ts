import { LOS_ANGELES_TIME_ZONE } from "@/lib/date-utils";

const PORTAL_LOCALE = "en-US";
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const WALL_CLOCK_TIME_PATTERN = /^(\d{1,2})(?::?(\d{2}))?([ap]m?)?$/;

function padTimePart(value: number): string {
  return String(value).padStart(2, "0");
}

function parsePortalDateValue(value: Date | string | number): Date {
  if (value instanceof Date) return value;
  if (typeof value === "string" && DATE_KEY_PATTERN.test(value.trim())) {
    return new Date(`${value.trim()}T12:00:00.000Z`);
  }
  return new Date(value);
}

export function normalizeWallClockTimeInput(value: string): string | null {
  const trimmed = value.trim().toLowerCase().replace(/\s+/g, "");
  if (!trimmed) return null;

  const match = trimmed.match(WALL_CLOCK_TIME_PATTERN);
  if (!match) return null;

  let hour = Number(match[1]);
  const minute = match[2] ? Number(match[2]) : 0;
  const meridiem = match[3];

  if (!Number.isInteger(hour) || !Number.isInteger(minute) || minute < 0 || minute > 59) {
    return null;
  }

  if (meridiem) {
    if (hour < 1 || hour > 12) return null;
    if (meridiem.startsWith("p") && hour < 12) hour += 12;
    if (meridiem.startsWith("a") && hour === 12) hour = 0;
  } else if (hour < 0 || hour > 23) {
    return null;
  }

  return `${padTimePart(hour)}:${padTimePart(minute)}`;
}

export function formatWallClockTime(value: string | null | undefined): string {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return "";

  const normalized = normalizeWallClockTimeInput(trimmed);
  if (!normalized) return trimmed;

  const [hourPart, minutePart] = normalized.split(":");
  const hour = Number(hourPart);
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;

  return `${displayHour}:${minutePart} ${suffix}`;
}

export function buildWallClockTimeOptions(
  values: Iterable<string | null | undefined> = [],
): Array<{ value: string; label: string }> {
  const optionValues = new Set<string>();

  for (let hour = 0; hour < 24; hour += 1) {
    for (let minute = 0; minute < 60; minute += 15) {
      optionValues.add(`${padTimePart(hour)}:${padTimePart(minute)}`);
    }
  }

  for (const value of Array.from(values)) {
    if (!value) continue;
    const normalized = normalizeWallClockTimeInput(value);
    if (normalized) optionValues.add(normalized);
  }

  return Array.from(optionValues)
    .sort((a, b) => a.localeCompare(b))
    .map((value) => ({
      value,
      label: formatWallClockTime(value),
    }));
}

export function formatLosAngelesDate(
  value: Date | string | number,
  options?: Intl.DateTimeFormatOptions,
): string {
  const date = parsePortalDateValue(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat(PORTAL_LOCALE, {
    timeZone: LOS_ANGELES_TIME_ZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
    ...options,
  }).format(date);
}

export function formatLosAngelesTime(
  value: Date | string | number,
  options?: Intl.DateTimeFormatOptions,
): string {
  const date = parsePortalDateValue(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat(PORTAL_LOCALE, {
    timeZone: LOS_ANGELES_TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    ...options,
  }).format(date);
}

export function formatLosAngelesDateTime(
  value: Date | string | number,
  options?: Intl.DateTimeFormatOptions,
): string {
  const date = parsePortalDateValue(value);
  if (Number.isNaN(date.getTime())) return "";

  const formatOptions = options?.dateStyle || options?.timeStyle
    ? {
        timeZone: LOS_ANGELES_TIME_ZONE,
        hour12: true,
        ...options,
      }
    : {
        timeZone: LOS_ANGELES_TIME_ZONE,
        month: "short" as const,
        day: "numeric" as const,
        year: "numeric" as const,
        hour: "numeric" as const,
        minute: "2-digit" as const,
        hour12: true,
        ...options,
      };

  return new Intl.DateTimeFormat(PORTAL_LOCALE, formatOptions).format(date);
}

export function formatLosAngelesDateTimeRange(
  start: Date | string | number,
  end?: Date | string | number | null,
  allDay = false,
): string {
  const dateLabel = formatLosAngelesDate(start, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  if (allDay) return `${dateLabel} · All Day`;

  const startLabel = formatLosAngelesTime(start);
  if (!end) return `${dateLabel} · ${startLabel}`;

  return `${dateLabel} · ${startLabel} – ${formatLosAngelesTime(end)}`;
}
