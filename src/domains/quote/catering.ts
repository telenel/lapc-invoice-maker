import type { CateringDetails } from "./types";

type CustomerCateringRequirementInput = {
  eventDate?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  location?: string | null;
  setupRequired?: boolean | null;
  setupTime?: string | null;
  takedownRequired?: boolean | null;
  takedownTime?: string | null;
};

function padTimePart(value: number): string {
  return String(value).padStart(2, "0");
}

export function normalizeQuoteTimeInput(value: string): string | null {
  const trimmed = value.trim().toLowerCase().replace(/\s+/g, "");
  if (!trimmed) return null;

  const match = trimmed.match(/^(\d{1,2})(?::?(\d{2}))?([ap]m?)?$/);
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

export function getMissingCustomerCateringRequirements(
  details: CustomerCateringRequirementInput | null | undefined,
): string[] {
  const missing: string[] = [];

  if (!details?.eventDate?.trim()) missing.push("event date");
  if (!normalizeQuoteTimeInput(details?.startTime ?? "")) missing.push("start time");
  if (!normalizeQuoteTimeInput(details?.endTime ?? "")) missing.push("end time");
  if (!details?.contactName?.trim()) missing.push("contact name");
  if (!details?.contactPhone?.trim()) missing.push("contact number");
  if (!details?.location?.trim()) missing.push("event location");
  if (details?.setupRequired && !normalizeQuoteTimeInput(details.setupTime ?? "")) missing.push("setup time");
  if (details?.takedownRequired && !normalizeQuoteTimeInput(details.takedownTime ?? "")) missing.push("takedown time");

  return missing;
}

export function sanitizeCustomerProvidedCateringDetails(details: CateringDetails): CateringDetails {
  return {
    ...details,
    headcount: undefined,
    eventName: "",
    location: "",
    setupRequired: false,
    setupTime: "",
    setupInstructions: "",
    takedownRequired: false,
    takedownTime: "",
    takedownInstructions: "",
    specialInstructions: "",
  };
}
