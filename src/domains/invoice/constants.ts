// src/domains/invoice/constants.ts
export const TAX_RATE = 0.0975;

export const INVOICE_STATUSES = ["DRAFT", "FINAL"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];
