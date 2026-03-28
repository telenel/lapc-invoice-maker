// src/domains/invoice/constants.ts
export const TAX_RATE = 0.095;

export const INVOICE_STATUSES = ["DRAFT", "FINAL", "PENDING_CHARGE"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];
