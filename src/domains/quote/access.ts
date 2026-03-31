import type { QuoteResponse } from "./types";

export interface QuoteViewerAccess {
  canViewQuote: boolean;
  canManageActions: boolean;
  canViewActivity: boolean;
  canViewSensitiveFields: boolean;
}

export function getQuoteViewerAccess(
  quote: Pick<QuoteResponse, "creatorId" | "convertedToInvoice">,
  userId: string,
  isAdmin: boolean,
): QuoteViewerAccess {
  if (isAdmin || quote.creatorId === userId) {
    return {
      canViewQuote: true,
      canManageActions: true,
      canViewActivity: true,
      canViewSensitiveFields: true,
    };
  }

  if (quote.convertedToInvoice?.createdBy === userId) {
    return {
      canViewQuote: true,
      canManageActions: false,
      canViewActivity: false,
      canViewSensitiveFields: false,
    };
  }

  return {
    canViewQuote: false,
    canManageActions: false,
    canViewActivity: false,
    canViewSensitiveFields: false,
  };
}

export function canViewQuoteDetails(
  quote: Pick<QuoteResponse, "creatorId" | "convertedToInvoice">,
  userId: string,
  isAdmin: boolean,
): boolean {
  return getQuoteViewerAccess(quote, userId, isAdmin).canViewQuote;
}

export function canViewQuoteActivity(
  quote: Pick<QuoteResponse, "creatorId" | "convertedToInvoice">,
  userId: string,
  isAdmin: boolean,
): boolean {
  return getQuoteViewerAccess(quote, userId, isAdmin).canViewActivity;
}

export function redactQuoteForViewer<T extends QuoteResponse>(
  quote: T,
  access: QuoteViewerAccess,
): T {
  if (access.canViewSensitiveFields) {
    return {
      ...quote,
      viewerAccess: access,
    };
  }

  return {
    ...quote,
    pdfPath: null,
    accountCode: "",
    accountNumber: "",
    approvalChain: [],
    marginEnabled: false,
    marginPercent: null,
    taxEnabled: false,
    taxRate: 0,
    shareToken: null,
    recipientEmail: "",
    recipientOrg: "",
    paymentMethod: null,
    paymentAccountNumber: null,
    contact: quote.contact
      ? {
          ...quote.contact,
          id: "",
          notes: null,
          createdAt: "",
        }
      : null,
    items: quote.items.map((item) => ({
      ...item,
      costPrice: null,
      marginOverride: null,
    })),
    viewerAccess: access,
  };
}
