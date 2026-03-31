/** Add N business days to a date (skips Sat/Sun). */
export function addBusinessDays(date: Date, days: number): Date {
  const result = new Date(date);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const dow = result.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return result;
}

/** Count business days between two dates (exclusive of start, inclusive of end). */
export function businessDaysBetween(start: Date, end: Date): number {
  let count = 0;
  const cursor = new Date(start);
  while (cursor < end) {
    cursor.setDate(cursor.getDate() + 1);
    const dow = cursor.getDay();
    if (dow !== 0 && dow !== 6) count++;
  }
  return count;
}

/** Check if a date is a business day (Mon-Fri). */
export function isBusinessDay(date: Date): boolean {
  const dow = date.getDay();
  return dow !== 0 && dow !== 6;
}
