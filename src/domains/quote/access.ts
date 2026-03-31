import type { QuoteResponse } from "./types";

export function canViewQuoteDetails(
  quote: Pick<QuoteResponse, "creatorId" | "convertedToInvoice">,
  userId: string,
  isAdmin: boolean,
): boolean {
  if (isAdmin) return true;
  if (quote.creatorId === userId) return true;
  return quote.convertedToInvoice?.createdBy === userId;
}
