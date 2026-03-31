import { describe, expect, it } from "vitest";
import { getQuoteValidationErrors } from "@/components/quote/validation";
import type { QuoteFormData } from "@/components/quote/quote-form";

function createForm(overrides: Partial<QuoteFormData> = {}): QuoteFormData {
  return {
    date: "2026-03-31",
    staffId: "",
    department: "Operations",
    category: "",
    accountCode: "",
    accountNumber: "",
    approvalChain: [],
    contactName: "",
    contactExtension: "",
    contactEmail: "",
    contactPhone: "",
    notes: "",
    items: [
      {
        _key: "item-1",
        description: "LUNCH",
        quantity: 1,
        unitPrice: 10,
        extendedPrice: 10,
        sortOrder: 0,
        isTaxable: true,
        marginOverride: null,
        costPrice: null,
      },
    ],
    expirationDate: "2026-04-30",
    recipientName: "Pierce College",
    recipientEmail: "",
    recipientOrg: "",
    marginEnabled: false,
    marginPercent: 0,
    taxEnabled: false,
    isCateringEvent: false,
    cateringDetails: {
      eventDate: "2026-03-31",
      startTime: "",
      endTime: "",
      location: "",
      contactName: "",
      contactPhone: "",
      contactEmail: "",
      headcount: undefined,
      eventName: "",
      setupRequired: false,
      setupTime: "",
      setupInstructions: "",
      takedownRequired: false,
      takedownTime: "",
      takedownInstructions: "",
      specialInstructions: "",
    },
    ...overrides,
  };
}

describe("getQuoteValidationErrors", () => {
  it("does not require customer-supplied catering details during default quote save flow", () => {
    const errors = getQuoteValidationErrors(
      createForm({ isCateringEvent: true }),
      { requireCateringDetails: false },
    );

    expect(errors).not.toHaveProperty("cateringDetails.location");
    expect(errors).not.toHaveProperty("cateringDetails.contactName");
    expect(errors).not.toHaveProperty("cateringDetails.contactPhone");
  });

  it("requires catering details when override mode opts into creator-side entry", () => {
    const errors = getQuoteValidationErrors(
      createForm({ isCateringEvent: true }),
      { requireCateringDetails: true },
    );

    expect(errors["cateringDetails.location"]).toBe("Event location is required");
    expect(errors["cateringDetails.contactName"]).toBe(
      "Event contact name is required",
    );
    expect(errors["cateringDetails.contactPhone"]).toBe(
      "Event contact phone is required",
    );
  });
});
