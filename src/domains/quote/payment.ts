export const QUOTE_PAYMENT_METHODS = [
  "ACCOUNT_NUMBER",
  "CHECK",
  "CASH",
  "CREDIT_CARD",
] as const;

export type QuotePaymentMethod = (typeof QUOTE_PAYMENT_METHODS)[number];

export const QUOTE_PAYMENT_METHOD_LABELS: Record<QuotePaymentMethod, string> = {
  ACCOUNT_NUMBER: "Account Number",
  CHECK: "Check",
  CASH: "Cash",
  CREDIT_CARD: "Credit Card",
};

export const QUOTE_BOOKSTORE_ADDRESS_LINES = [
  "Los Angeles Pierce College Bookstore",
  "6201 Winnetka Ave",
  "Woodland Hills, CA 91371",
] as const;

export interface QuotePaymentMethodGuidance {
  title: string;
  description: string;
  calloutTitle: string;
  calloutLines: readonly string[];
}

export interface QuotePaymentDetailsInput {
  paymentMethod?: string;
  accountNumber?: string | null;
}

export interface NormalizedQuotePaymentDetails {
  paymentMethod: QuotePaymentMethod;
  paymentAccountNumber: string | null;
}

function isQuotePaymentMethod(value: string): value is QuotePaymentMethod {
  return QUOTE_PAYMENT_METHODS.includes(value as QuotePaymentMethod);
}

export function coerceQuotePaymentMethod(
  value?: QuotePaymentMethod | string | null,
): QuotePaymentMethod | null {
  const normalized = typeof value === "string" ? value.trim().toUpperCase() : "";
  return isQuotePaymentMethod(normalized) ? normalized : null;
}

export function getQuotePaymentMethodLabel(value: QuotePaymentMethod | string): string {
  const paymentMethod = coerceQuotePaymentMethod(value);
  if (paymentMethod) {
    return QUOTE_PAYMENT_METHOD_LABELS[paymentMethod];
  }

  return String(value)
    .trim()
    .toUpperCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function getQuotePaymentMethodGuidance(
  value?: QuotePaymentMethod | string | null,
): QuotePaymentMethodGuidance | null {
  const paymentMethod = coerceQuotePaymentMethod(value);
  if (!paymentMethod || paymentMethod === "ACCOUNT_NUMBER") {
    return null;
  }

  if (paymentMethod === "CHECK") {
    return {
      title: "Mail Your Check",
      description:
        "Check payments are not collected online. Please mail your check to the Los Angeles Pierce College Bookstore.",
      calloutTitle: "Make checks payable to and mail to",
      calloutLines: QUOTE_BOOKSTORE_ADDRESS_LINES,
    };
  }

  const label = QUOTE_PAYMENT_METHOD_LABELS[paymentMethod];
  return {
    title: `${label} Payments Are In-Store Only`,
    description: `${label} payments must be completed in person at the Los Angeles Pierce College Bookstore.`,
    calloutTitle: "Complete payment in person at",
    calloutLines: QUOTE_BOOKSTORE_ADDRESS_LINES,
  };
}

export function normalizeQuotePaymentDetails(
  input?: QuotePaymentDetailsInput
): NormalizedQuotePaymentDetails | undefined {
  if (!input?.paymentMethod) return undefined;

  const paymentMethod = String(input.paymentMethod).trim().toUpperCase();
  if (!isQuotePaymentMethod(paymentMethod)) {
    throw Object.assign(new Error("Invalid payment method"), { code: "INVALID_INPUT" });
  }

  const paymentAccountNumber = input.accountNumber?.trim() || null;
  if (paymentMethod === "ACCOUNT_NUMBER" && !paymentAccountNumber) {
    throw Object.assign(new Error("Account number is required for account number payments"), {
      code: "INVALID_INPUT",
    });
  }

  return {
    paymentMethod,
    paymentAccountNumber: paymentMethod === "ACCOUNT_NUMBER" ? paymentAccountNumber : null,
  };
}
