import { describe, expect, it } from "vitest";
import {
  canViewQuoteActivity,
  canViewQuoteDetails,
  getQuoteViewerAccess,
  redactQuoteForViewer,
} from "@/domains/quote/access";

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

  it("limits converted invoice owners to read-only quote-page access", () => {
    const access = getQuoteViewerAccess(
      {
        ...baseQuote,
        convertedToInvoice: { id: "inv-1", invoiceNumber: "INV-1", createdBy: "owner-2" },
      },
      "owner-2",
      false,
    );

    expect(access).toEqual({
      canViewQuote: true,
      canManageActions: false,
      canViewActivity: false,
      canViewSensitiveFields: false,
    });
    expect(
      canViewQuoteActivity(
        {
          ...baseQuote,
          convertedToInvoice: { id: "inv-1", invoiceNumber: "INV-1", createdBy: "owner-2" },
        },
        "owner-2",
        false,
      ),
    ).toBe(false);
  });

  it("redacts sensitive fields for limited viewers", () => {
    const quote = {
      id: "q1",
      quoteNumber: "Q-1",
      creatorId: "creator-1",
      recipientEmail: "jane@example.com",
      recipientOrg: "ACME",
      shareToken: "token-1",
      paymentMethod: "ACCOUNT_NUMBER",
      paymentAccountNumber: "12345",
    } as const;

    const redacted = redactQuoteForViewer(quote as never, {
      canViewQuote: true,
      canManageActions: false,
      canViewActivity: false,
      canViewSensitiveFields: false,
    });

    expect(redacted.shareToken).toBeNull();
    expect(redacted.recipientEmail).toBeNull();
    expect(redacted.recipientOrg).toBeNull();
    expect(redacted.paymentMethod).toBeNull();
    expect(redacted.paymentAccountNumber).toBeNull();
    expect(redacted.viewerAccess).toEqual({
      canViewQuote: true,
      canManageActions: false,
      canViewActivity: false,
      canViewSensitiveFields: false,
    });
  });

  it("blocks unrelated users", () => {
    expect(canViewQuoteDetails(baseQuote, "other-user", false)).toBe(false);
  });

  it("allows admins", () => {
    expect(canViewQuoteDetails(baseQuote, "other-user", true)).toBe(true);
  });
});
