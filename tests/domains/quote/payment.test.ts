import { describe, expect, it } from "vitest";
import {
  coerceQuotePaymentMethod,
  getQuotePaymentMethodGuidance,
  getQuotePaymentMethodLabel,
  normalizeQuotePaymentDetails,
} from "@/domains/quote/payment";

describe("normalizeQuotePaymentDetails", () => {
  it("returns undefined when no payment method is provided", () => {
    expect(normalizeQuotePaymentDetails()).toBeUndefined();
    expect(normalizeQuotePaymentDetails({ accountNumber: "123" })).toBeUndefined();
  });

  it("normalizes valid payment methods", () => {
    expect(
      normalizeQuotePaymentDetails({
        paymentMethod: " credit_card ",
        accountNumber: "ignored",
      }),
    ).toEqual({
      paymentMethod: "CREDIT_CARD",
      paymentAccountNumber: null,
    });
  });

  it("requires an account number for account-number payments", () => {
    expect(() =>
      normalizeQuotePaymentDetails({
        paymentMethod: "ACCOUNT_NUMBER",
        accountNumber: "   ",
      }),
    ).toThrowError("Account number is required for account number payments");
  });

  it("preserves a trimmed account number when required", () => {
    expect(
      normalizeQuotePaymentDetails({
        paymentMethod: "ACCOUNT_NUMBER",
        accountNumber: "  SAP-12345  ",
      }),
    ).toEqual({
      paymentMethod: "ACCOUNT_NUMBER",
      paymentAccountNumber: "SAP-12345",
    });
  });

  it("rejects unsupported payment methods", () => {
    expect(() =>
      normalizeQuotePaymentDetails({
        paymentMethod: "WIRE_TRANSFER",
      }),
    ).toThrowError("Invalid payment method");
  });

  it("formats payment method labels for display", () => {
    expect(getQuotePaymentMethodLabel("ACCOUNT_NUMBER")).toBe("Account Number");
    expect(getQuotePaymentMethodLabel("credit_card")).toBe("Credit Card");
  });

  it("coerces valid payment methods and rejects unknown ones", () => {
    expect(coerceQuotePaymentMethod("cash")).toBe("CASH");
    expect(coerceQuotePaymentMethod("wire")).toBeNull();
  });

  it("returns bookstore guidance for offline payment methods", () => {
    expect(getQuotePaymentMethodGuidance("CHECK")).toMatchObject({
      title: "Mail Your Check",
      calloutLines: expect.arrayContaining([
        "Los Angeles Pierce College Bookstore",
        "6201 Winnetka Ave",
        "Woodland Hills, CA 91371",
      ]),
    });

    expect(getQuotePaymentMethodGuidance("CASH")).toMatchObject({
      title: "Cash Payments Are In-Store Only",
    });
    expect(getQuotePaymentMethodGuidance("ACCOUNT_NUMBER")).toBeNull();
  });
});
