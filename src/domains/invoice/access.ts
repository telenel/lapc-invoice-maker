import type { InvoiceResponse } from "./types";

export interface InvoiceViewerAccess {
  canViewInvoice: boolean;
  canManageActions: boolean;
  canDuplicateInvoice: boolean;
}

export function getInvoiceViewerAccess(
  invoice: Pick<InvoiceResponse, "creatorId">,
  userId: string,
  isAdmin: boolean,
): InvoiceViewerAccess {
  if (isAdmin || invoice.creatorId === userId) {
    return {
      canViewInvoice: true,
      canManageActions: true,
      canDuplicateInvoice: true,
    };
  }

  return {
    canViewInvoice: true,
    canManageActions: false,
    canDuplicateInvoice: true,
  };
}

export function canViewInvoiceDetails(
  invoice: Pick<InvoiceResponse, "creatorId">,
  userId: string,
  isAdmin: boolean,
): boolean {
  return getInvoiceViewerAccess(invoice, userId, isAdmin).canViewInvoice;
}

export function annotateInvoiceForViewer<T extends InvoiceResponse>(
  invoice: T,
  access: InvoiceViewerAccess,
): T {
  return {
    ...invoice,
    viewerAccess: access,
  };
}
