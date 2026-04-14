// tests/domains/shared/formatters.test.ts
import { describe, it, expect } from "vitest";
import {
  formatAmount,
  formatCurrency,
  formatDate,
  formatDateLong,
  formatDateCompact,
  getInitials,
} from "@/domains/shared/formatters";

describe("formatAmount", () => {
  it("formats number to dollar string with commas", () => {
    expect(formatAmount(1234.5)).toBe("$1,234.50");
  });

  it("handles string input (Prisma Decimal)", () => {
    expect(formatAmount("999.9")).toBe("$999.90");
  });

  it("handles zero", () => {
    expect(formatAmount(0)).toBe("$0.00");
  });
});

describe("formatCurrency", () => {
  it("formats number to $X.XX without commas", () => {
    expect(formatCurrency(1234.5)).toBe("$1234.50");
  });

  it("handles string input", () => {
    expect(formatCurrency("50")).toBe("$50.00");
  });
});

describe("formatDate", () => {
  it("formats ISO date to short format", () => {
    expect(formatDate("2026-03-15")).toBe("Mar 15, 2026");
  });

  it("formats timestamps in Los Angeles time instead of UTC", () => {
    expect(formatDate("2026-04-14T05:30:00.000Z")).toBe("Apr 13, 2026");
  });
});

describe("formatDateLong", () => {
  it("formats ISO date to long format", () => {
    expect(formatDateLong("2026-03-15")).toBe("March 15, 2026");
  });
});

describe("formatDateCompact", () => {
  it("formats ISO date to compact format", () => {
    expect(formatDateCompact("2026-03-15")).toBe("Mar 15");
  });
});

describe("getInitials", () => {
  it("extracts initials from full name", () => {
    expect(getInitials("John Doe")).toBe("JD");
  });

  it("limits to 2 characters", () => {
    expect(getInitials("John Michael Doe")).toBe("JM");
  });
});
