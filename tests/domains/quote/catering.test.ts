import { describe, expect, it } from "vitest";
import { normalizeQuoteTimeInput, sanitizeCustomerProvidedCateringDetails } from "@/domains/quote/catering";

describe("normalizeQuoteTimeInput", () => {
  it("normalizes 24-hour inputs", () => {
    expect(normalizeQuoteTimeInput("9")).toBe("09:00");
    expect(normalizeQuoteTimeInput("930")).toBe("09:30");
    expect(normalizeQuoteTimeInput("13:45")).toBe("13:45");
  });

  it("normalizes 12-hour inputs with meridiem", () => {
    expect(normalizeQuoteTimeInput("1pm")).toBe("13:00");
    expect(normalizeQuoteTimeInput("1:30pm")).toBe("13:30");
    expect(normalizeQuoteTimeInput("12:05am")).toBe("00:05");
  });

  it("rejects invalid values", () => {
    expect(normalizeQuoteTimeInput("")).toBeNull();
    expect(normalizeQuoteTimeInput("25:00")).toBeNull();
    expect(normalizeQuoteTimeInput("1:99pm")).toBeNull();
    expect(normalizeQuoteTimeInput("noon")).toBeNull();
  });
});

describe("sanitizeCustomerProvidedCateringDetails", () => {
  it("clears customer-owned fields while preserving staff-owned details", () => {
    expect(
      sanitizeCustomerProvidedCateringDetails({
        eventDate: "2026-04-07",
        startTime: "13:30",
        endTime: "15:00",
        location: "Bookstore",
        contactName: "Marcos A Montalvo",
        contactPhone: "(818) 710-4236",
        contactEmail: "montalma2@piercecollege.edu",
        headcount: 25,
        eventName: "Spring Launch",
        setupRequired: true,
        setupTime: "12:30",
        setupInstructions: "North entrance",
        takedownRequired: true,
        takedownTime: "15:30",
        takedownInstructions: "Loading dock",
        specialInstructions: "Peanut allergy",
      }),
    ).toEqual({
      eventDate: "2026-04-07",
      startTime: "13:30",
      endTime: "15:00",
      location: "",
      contactName: "Marcos A Montalvo",
      contactPhone: "(818) 710-4236",
      contactEmail: "montalma2@piercecollege.edu",
      headcount: undefined,
      eventName: "",
      setupRequired: false,
      setupTime: "",
      setupInstructions: "",
      takedownRequired: false,
      takedownTime: "",
      takedownInstructions: "",
      specialInstructions: "",
    });
  });
});
