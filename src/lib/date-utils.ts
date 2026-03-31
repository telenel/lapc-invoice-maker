export const LOS_ANGELES_TIME_ZONE = "America/Los_Angeles";

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function toDateKey(date: Date): string {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function fromDateKey(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00.000Z`);
}

function getDateKeyInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!year || !month || !day) {
    throw new Error(`Unable to format date in time zone: ${timeZone}`);
  }
  return `${year}-${month}-${day}`;
}

function getTimeZoneOffsetMinutes(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);
  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  const minute = Number(parts.find((part) => part.type === "minute")?.value);
  const second = Number(parts.find((part) => part.type === "second")?.value);
  const localAsUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  return (localAsUtc - date.getTime()) / 60000;
}

function addDaysToDateKey(dateKey: string, days: number): string {
  const result = fromDateKey(dateKey);
  result.setUTCDate(result.getUTCDate() + days);
  return toDateKey(result);
}

function isBusinessDayKey(dateKey: string): boolean {
  const dow = fromDateKey(dateKey).getUTCDay();
  return dow !== 0 && dow !== 6;
}

/** Add N business days to a date (skips Sat/Sun). */
export function addBusinessDays(date: Date, days: number): Date {
  let key = toDateKey(date);
  let added = 0;
  while (added < days) {
    key = addDaysToDateKey(key, 1);
    if (isBusinessDayKey(key)) added++;
  }
  return fromDateKey(key);
}

/** Convert a local date/time in a specific time zone to a UTC Date. */
export function zonedDateTimeToUtc(dateKey: string, time: string, timeZone = LOS_ANGELES_TIME_ZONE): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const candidate = new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0));
  const offsetMinutes = getTimeZoneOffsetMinutes(candidate, timeZone);
  return new Date(candidate.getTime() - offsetMinutes * 60_000);
}

/** Count business days between two dates in a specific time zone (exclusive of start, inclusive of end). */
export function businessDaysBetween(start: Date, end: Date, timeZone = LOS_ANGELES_TIME_ZONE): number {
  let count = 0;
  let cursor = getDateKeyInTimeZone(start, timeZone);
  const target = getDateKeyInTimeZone(end, timeZone);
  while (cursor < target) {
    cursor = addDaysToDateKey(cursor, 1);
    if (isBusinessDayKey(cursor)) count++;
  }
  return count;
}

/** Check if a date is a business day (Mon-Fri) using its UTC calendar date. */
export function isBusinessDay(date: Date): boolean {
  return isBusinessDayKey(toDateKey(date));
}

export function startOfDayInTimeZone(date: Date, timeZone = LOS_ANGELES_TIME_ZONE): Date {
  return fromDateKey(getDateKeyInTimeZone(date, timeZone));
}
