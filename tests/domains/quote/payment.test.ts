import { describe, expect, it } from "vitest";
import { normalizeQuotePaymentDetails } from "@/domains/quote/payment";

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
});
