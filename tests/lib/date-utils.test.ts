import { describe, expect, it } from "vitest";
import { startOfDayInTimeZone, zonedDateTimeToUtc } from "@/lib/date-utils";

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
