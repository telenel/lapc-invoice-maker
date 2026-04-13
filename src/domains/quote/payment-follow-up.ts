import type { FollowUpBadgeState } from "@/domains/follow-up/types";
import type { QuoteStatus } from "./types";

export const PAYMENT_FOLLOW_UP_MAX_ATTEMPTS = 5;

type QuotePaymentFollowUpBadgeInput = {
  quoteStatus: QuoteStatus;
  paymentDetailsResolved: boolean;
  hasShareToken: boolean;
  hasRecipientEmail: boolean;
  hasConvertedInvoice: boolean;
  sentAttempts: number;
};

export function getQuotePaymentFollowUpBadgeState(
  input: QuotePaymentFollowUpBadgeInput,
): FollowUpBadgeState | null {
  if (
    input.quoteStatus !== "ACCEPTED" ||
    input.paymentDetailsResolved ||
    !input.hasShareToken ||
    !input.hasRecipientEmail ||
    input.hasConvertedInvoice
  ) {
    return null;
  }

  const sentAttempts = Math.max(0, Math.floor(input.sentAttempts));

  if (sentAttempts >= PAYMENT_FOLLOW_UP_MAX_ATTEMPTS) {
    return {
      seriesStatus: "EXHAUSTED",
      currentAttempt: PAYMENT_FOLLOW_UP_MAX_ATTEMPTS,
      maxAttempts: PAYMENT_FOLLOW_UP_MAX_ATTEMPTS,
    };
  }

  return {
    seriesStatus: "ACTIVE",
    currentAttempt: Math.min(PAYMENT_FOLLOW_UP_MAX_ATTEMPTS, sentAttempts + 1),
    maxAttempts: PAYMENT_FOLLOW_UP_MAX_ATTEMPTS,
  };
}
