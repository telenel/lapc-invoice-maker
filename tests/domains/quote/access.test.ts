import { describe, expect, it } from "vitest";
import { canViewQuoteDetails } from "@/domains/quote/access";

describe("canViewQuoteDetails", () => {
  const baseQuote = {
    creatorId: "creator-1",
    convertedToInvoice: null,
  } as const;

  it("allows the original quote creator", () => {
    expect(canViewQuoteDetails(baseQuote, "creator-1", false)).toBe(true);
  });

  it("allows the converted invoice owner", () => {
    expect(
      canViewQuoteDetails(
        {
          ...baseQuote,
          convertedToInvoice: { id: "inv-1", invoiceNumber: "INV-1", createdBy: "owner-2" },
        },
        "owner-2",
        false,
      ),
    ).toBe(true);
  });

  it("blocks unrelated users", () => {
    expect(canViewQuoteDetails(baseQuote, "other-user", false)).toBe(false);
  });

  it("allows admins", () => {
    expect(canViewQuoteDetails(baseQuote, "other-user", true)).toBe(true);
  });
});
