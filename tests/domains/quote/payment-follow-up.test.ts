import { describe, expect, it } from "vitest";
import {
  getQuotePaymentFollowUpBadgeState,
  PAYMENT_FOLLOW_UP_MAX_ATTEMPTS,
} from "@/domains/quote/payment-follow-up";

describe("getQuotePaymentFollowUpBadgeState", () => {
  it("returns an active 1/5 badge immediately after acceptance when payment is unresolved", () => {
    expect(
      getQuotePaymentFollowUpBadgeState({
        quoteStatus: "ACCEPTED",
        paymentDetailsResolved: false,
        hasShareToken: true,
        hasRecipientEmail: true,
        hasConvertedInvoice: false,
        sentAttempts: 0,
      }),
    ).toEqual({
      seriesStatus: "ACTIVE",
      currentAttempt: 1,
      maxAttempts: PAYMENT_FOLLOW_UP_MAX_ATTEMPTS,
    });
  });

  it("advances the active badge after reminders have already been sent", () => {
    expect(
      getQuotePaymentFollowUpBadgeState({
        quoteStatus: "ACCEPTED",
        paymentDetailsResolved: false,
        hasShareToken: true,
        hasRecipientEmail: true,
        hasConvertedInvoice: false,
        sentAttempts: 2,
      }),
    ).toEqual({
      seriesStatus: "ACTIVE",
      currentAttempt: 3,
      maxAttempts: PAYMENT_FOLLOW_UP_MAX_ATTEMPTS,
    });
  });

  it("returns exhausted after the fifth reminder has already been sent", () => {
    expect(
      getQuotePaymentFollowUpBadgeState({
        quoteStatus: "ACCEPTED",
        paymentDetailsResolved: false,
        hasShareToken: true,
        hasRecipientEmail: true,
        hasConvertedInvoice: false,
        sentAttempts: PAYMENT_FOLLOW_UP_MAX_ATTEMPTS,
      }),
    ).toEqual({
      seriesStatus: "EXHAUSTED",
      currentAttempt: PAYMENT_FOLLOW_UP_MAX_ATTEMPTS,
      maxAttempts: PAYMENT_FOLLOW_UP_MAX_ATTEMPTS,
    });
  });

  it("returns null when the quote no longer qualifies for payment follow-up", () => {
    expect(
      getQuotePaymentFollowUpBadgeState({
        quoteStatus: "ACCEPTED",
        paymentDetailsResolved: true,
        hasShareToken: true,
        hasRecipientEmail: true,
        hasConvertedInvoice: false,
        sentAttempts: 0,
      }),
    ).toBeNull();
  });
});
