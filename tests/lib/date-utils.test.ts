import { describe, expect, it } from "vitest";
import {
  addDaysToDateKey,
  getDateKeyInLosAngeles,
  getDateOnlyKey,
  isDateOnlyBeforeTodayInTimeZone,
  startOfDayInTimeZone,
  zonedDateTimeToUtc,
} from "@/lib/date-utils";

describe("zonedDateTimeToUtc", () => {
  it("resolves Los Angeles spring DST transition correctly", () => {
    expect(zonedDateTimeToUtc("2026-03-08", "09:00").toISOString()).toBe(
      "2026-03-08T16:00:00.000Z",
    );
  });

  it("resolves Los Angeles fall DST transition correctly", () => {
    expect(zonedDateTimeToUtc("2026-11-01", "09:00").toISOString()).toBe(
      "2026-11-01T17:00:00.000Z",
    );
  });

  it("rejects malformed date keys", () => {
    expect(() => zonedDateTimeToUtc("2026-2-01", "09:00")).toThrow("Invalid date key");
    expect(() => zonedDateTimeToUtc("2026-02-30", "09:00")).toThrow("Invalid date key");
  });

  it("rejects malformed time values", () => {
    expect(() => zonedDateTimeToUtc("2026-03-08", "9:00")).toThrow("Invalid time");
    expect(() => zonedDateTimeToUtc("2026-03-08", "24:00")).toThrow("Invalid time");
  });
});

describe("startOfDayInTimeZone", () => {
  it("returns midnight in the target timezone as a UTC instant", () => {
    expect(
      startOfDayInTimeZone(new Date("2026-03-08T15:30:00.000Z")).toISOString(),
    ).toBe("2026-03-08T08:00:00.000Z");
  });
});

describe("Los Angeles business-date helpers", () => {
  it("derives the current Los Angeles date key instead of the UTC date", () => {
    expect(getDateKeyInLosAngeles(new Date("2026-04-14T05:30:00.000Z"))).toBe("2026-04-13");
  });

  it("preserves a stored date-only value when normalizing JS Date objects", () => {
    expect(getDateOnlyKey(new Date("2026-04-13T00:00:00.000Z"))).toBe("2026-04-13");
  });

  it("treats a date-only value as active for the full Los Angeles business day", () => {
    const now = new Date("2026-04-14T05:30:00.000Z");
    expect(isDateOnlyBeforeTodayInTimeZone("2026-04-13T00:00:00.000Z", now)).toBe(false);
    expect(isDateOnlyBeforeTodayInTimeZone("2026-04-12T00:00:00.000Z", now)).toBe(true);
  });

  it("adds calendar days to date keys without relying on host timezone", () => {
    expect(addDaysToDateKey("2026-04-13", 30)).toBe("2026-05-13");
  });
});
