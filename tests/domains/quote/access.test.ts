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
      accountCode: "AC1",
      accountNumber: "12345",
      approvalChain: ["Boss"],
      marginEnabled: true,
      marginPercent: 30,
      taxEnabled: true,
      taxRate: 0.08,
      recipientEmail: "jane@example.com",
      recipientOrg: "ACME",
      shareToken: "token-1",
      paymentMethod: "ACCOUNT_NUMBER",
      paymentAccountNumber: "12345",
      pdfPath: "/tmp/q1.pdf",
      contact: {
        id: "c1",
        name: "Vendor",
        email: "vendor@example.com",
        phone: "555-1212",
        org: "ACME",
        department: "Sales",
        title: "Rep",
        notes: "internal-only",
        createdAt: "2026-03-31T00:00:00.000Z",
      },
      items: [
        {
          id: "item-1",
          description: "Widget",
          quantity: 2,
          unitPrice: 10,
          extendedPrice: 20,
          sortOrder: 0,
          isTaxable: true,
          marginOverride: 25,
          costPrice: 8,
        },
      ],
    } as const;

    const redacted = redactQuoteForViewer(quote as never, {
      canViewQuote: true,
      canManageActions: false,
      canViewActivity: false,
      canViewSensitiveFields: false,
    });

    expect(redacted.pdfPath).toBeNull();
    expect(redacted.accountCode).toBe("");
    expect(redacted.accountNumber).toBe("");
    expect(redacted.approvalChain).toEqual([]);
    expect(redacted.marginEnabled).toBe(false);
    expect(redacted.marginPercent).toBeNull();
    expect(redacted.taxEnabled).toBe(false);
    expect(redacted.taxRate).toBe(0);
    expect(redacted.shareToken).toBeNull();
    expect(redacted.recipientEmail).toBe("");
    expect(redacted.recipientOrg).toBe("");
    expect(redacted.paymentMethod).toBeNull();
    expect(redacted.paymentAccountNumber).toBeNull();
    expect(redacted.contact).toEqual({
      id: "",
      name: "Vendor",
      email: "vendor@example.com",
      phone: "555-1212",
      org: "ACME",
      department: "Sales",
      title: "Rep",
      notes: null,
      createdAt: "",
    });
    expect(redacted.items[0].costPrice).toBeNull();
    expect(redacted.items[0].marginOverride).toBeNull();
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
