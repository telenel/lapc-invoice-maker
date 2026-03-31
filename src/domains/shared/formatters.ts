// src/domains/shared/formatters.ts

/** Dollar format with commas for display: "$1,234.50" */
export function formatAmount(amount: string | number): string {
  return `$${Number(amount).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Dollar format without commas for PDFs: "$1234.50" */
export function formatCurrency(value: string | number): string {
  return `$${Number(value).toFixed(2)}`;
}

/** "Mar 15, 2026" */
export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** "March 15, 2026" */
export function formatDateLong(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** "Mar 15" */
export function formatDateCompact(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** "JD" from "John Doe" */
export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/** "March 15, 2026" from Date object (for PDF templates) */
export function formatDateFromDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** "March 15, 2026" in Pacific time (for customer-facing PDFs) */
export function formatDatePacific(date: Date): string {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "America/Los_Angeles",
  });
}
