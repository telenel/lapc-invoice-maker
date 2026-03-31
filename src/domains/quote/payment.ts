export const QUOTE_PAYMENT_METHODS = [
  "ACCOUNT_NUMBER",
  "CHECK",
  "CASH",
  "CREDIT_CARD",
] as const;

export type QuotePaymentMethod = (typeof QUOTE_PAYMENT_METHODS)[number];

export interface QuotePaymentDetailsInput {
  paymentMethod?: string;
  accountNumber?: string;
}

export interface NormalizedQuotePaymentDetails {
  paymentMethod: QuotePaymentMethod;
  accountNumber: string | null;
}

function isQuotePaymentMethod(value: string): value is QuotePaymentMethod {
  return QUOTE_PAYMENT_METHODS.includes(value as QuotePaymentMethod);
}

export function normalizeQuotePaymentDetails(
  input?: QuotePaymentDetailsInput
): NormalizedQuotePaymentDetails | undefined {
  if (!input?.paymentMethod) return undefined;

  const paymentMethod = String(input.paymentMethod).trim().toUpperCase();
  if (!isQuotePaymentMethod(paymentMethod)) {
    throw Object.assign(new Error("Invalid payment method"), { code: "INVALID_INPUT" });
  }

  const accountNumber = input.accountNumber?.trim() || null;
  if (paymentMethod === "ACCOUNT_NUMBER" && !accountNumber) {
    throw Object.assign(new Error("Account number is required for account number payments"), {
      code: "INVALID_INPUT",
    });
  }

  return {
    paymentMethod,
    accountNumber: paymentMethod === "ACCOUNT_NUMBER" ? accountNumber : null,
  };
}
