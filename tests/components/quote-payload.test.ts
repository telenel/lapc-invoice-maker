import { describe, expect, it } from "vitest";
import { buildQuotePayload } from "@/components/quote/payload";
import type { QuoteFormData } from "@/components/quote/quote-form";

function createForm(overrides: Partial<QuoteFormData> = {}): QuoteFormData {
  return {
    date: "2026-03-31",
    staffId: "",
    department: "Operations",
    category: "SUPPLIES",
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
      {
        _key: "item-2",
        description: "",
        quantity: 1,
        unitPrice: 0,
        extendedPrice: 0,
        sortOrder: 1,
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

describe("buildQuotePayload", () => {
  it("drops blank trailing items before route validation", () => {
    const payload = buildQuotePayload(createForm());

    expect(payload.items).toHaveLength(1);
    expect(payload.items[0].description).toBe("LUNCH");
  });
});
