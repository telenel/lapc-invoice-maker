import type { InvoiceResponse } from "@/domains/invoice/types";

export const COPYTECH_IMPORT_REQUIRED_HEADERS = [
  "invoice_date",
  "department",
  "account_number",
  "sku",
  "quantity",
] as const;

export const COPYTECH_IMPORT_OPTIONAL_HEADERS = [
  "requester_name",
  "account_code",
  "job_id",
  "job_date",
  "description_override",
  "unit_price_override",
  "notes",
  "chargeable",
  "charge_reason",
  "raw_impressions",
] as const;

export interface CopyTechImportCsvFormat {
  requiredHeaders: readonly string[];
  optionalHeaders: readonly string[];
  exampleCsv: string;
  notes: string[];
}

export interface CopyTechImportError {
  rowNumber: number;
  field: string;
  message: string;
}

export interface CopyTechImportWarning {
  rowNumber: number;
  field: string;
  message: string;
}

export interface CopyTechImportRowInput {
  rowNumber: number;
  invoiceDate: string;
  department: string;
  accountNumber: string;
  accountCode: string;
  requesterName: string;
  jobId: string;
  jobDate: string;
  sku: number;
  quantity: number;
  descriptionOverride: string;
  unitPriceOverride: number | null;
  notes: string;
  chargeable: boolean;
  chargeReason: string;
  rawImpressions: number | null;
}

export interface CopyTechProductSnapshot {
  sku: number;
  description: string | null;
  retailPrice: number | null;
  costPrice: number | null;
  itemTaxTypeId: number | null;
  discontinued: boolean | null;
}

export interface CopyTechResolvedLineItem {
  rowNumber: number;
  jobId: string;
  jobDate: string;
  sku: number;
  quantity: number;
  description: string;
  unitPrice: number;
  extendedPrice: number;
  costPrice: number | null;
  productDescription: string | null;
  productUnitPrice: number | null;
  usedDescriptionOverride: boolean;
  usedUnitPriceOverride: boolean;
  notes: string;
  chargeReason: string;
  rawImpressions: number | null;
}

export interface CopyTechInvoiceDraftPreview {
  groupKey: string;
  invoiceDate: string;
  department: string;
  accountNumber: string;
  accountCode: string;
  requesterName: string;
  lineItems: CopyTechResolvedLineItem[];
  totalAmount: number;
  notes: string;
}

export interface CopyTechImportPreview {
  format: CopyTechImportCsvFormat;
  rowCount: number;
  skippedRowCount: number;
  validRowCount: number;
  invoiceCount: number;
  totalAmount: number;
  errors: CopyTechImportError[];
  warnings: CopyTechImportWarning[];
  invoices: CopyTechInvoiceDraftPreview[];
}

export interface CopyTechImportCommitResult {
  preview: CopyTechImportPreview;
  createdInvoices: InvoiceResponse[];
}
