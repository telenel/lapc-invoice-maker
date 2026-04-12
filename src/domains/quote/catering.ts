import { normalizeWallClockTimeInput } from "@/lib/time";
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

export function normalizeQuoteTimeInput(value: string): string | null {
  return normalizeWallClockTimeInput(value);
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
