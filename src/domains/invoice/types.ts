// src/domains/invoice/types.ts
import type { StaffSummary } from "@/domains/staff/types";
import type { ContactResponse } from "@/domains/contact/types";
import type { InvoiceStatus } from "./constants";

// ── DTOs ──

/** Staff shape on InvoiceResponse — includes contact fields available in detail view */
export interface InvoiceStaffDetail extends StaffSummary {
  extension: string | null;
  email: string | null;
}

export interface InvoicePdfMetadata {
  signatures?: { line1?: string; line2?: string; line3?: string };
  signatureStaffIds?: { line1?: string; line2?: string; line3?: string };
  semesterYearDept?: string;
  contactName?: string;
  contactExtension?: string;
  internalNotes?: string;
}

export interface ArchivedBySummary {
  id: string;
  name: string;
}

export interface InvoiceContactSummary {
  id: string;
  name: string;
  org: string;
}

export interface InvoiceResponse {
  id: string;
  invoiceNumber: string | null;
  date: string;
  staffId: string | null;
  status: InvoiceStatus;
  type: string;
  department: string;
  category: string;
  accountCode: string;
  accountNumber: string;
  approvalChain: string[];
  notes: string;
  totalAmount: number;
  isRecurring: boolean;
  recurringInterval: string | null;
  recurringEmail: string | null;
  isRunning: boolean;
  runningTitle: string | null;
  pdfPath: string | null;
  pdfMetadata: InvoicePdfMetadata | null;
  prismcorePath: string | null;
  marginEnabled: boolean;
  marginPercent: number | null;
  taxEnabled: boolean;
  taxRate: number;
  isCateringEvent: boolean;
  cateringDetails: unknown;
  createdAt: string;
  archivedAt?: string | null;
  archivedBy?: ArchivedBySummary | null;
  staff: InvoiceStaffDetail | null;
  contact: ContactResponse | null;
  creatorId: string;
  creatorName: string;
  viewerAccess?: {
    canViewInvoice: boolean;
    canManageActions: boolean;
    canDuplicateInvoice: boolean;
  };
  items: InvoiceItemResponse[];
}

export interface InvoiceListItemResponse {
  id: string;
  invoiceNumber: string | null;
  date: string;
  staffId: string | null;
  status: InvoiceStatus;
  type: string;
  department: string;
  category: string;
  accountCode: string;
  accountNumber: string;
  notes: string;
  totalAmount: number;
  isRecurring: boolean;
  isRunning: boolean;
  runningTitle: string | null;
  createdAt: string;
  staff: StaffSummary | null;
  contact: InvoiceContactSummary | null;
  creatorId: string;
  creatorName: string;
  itemCount: number;
  firstItemDescription: string | null;
}

export interface InvoiceExportRow {
  invoiceNumber: string | null;
  date: string;
  category: string;
  staffName: string;
  department: string;
  accountNumber: string;
  accountCode: string;
  totalAmount: number;
  status: InvoiceStatus;
  itemDescriptions: string[];
  notes: string;
}

export interface InvoiceItemResponse {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  extendedPrice: number;
  sortOrder: number;
  isTaxable: boolean;
  costPrice: number | null;
  marginOverride: number | null;
  sku: string | null;
}

export interface CreateLineItemInput {
  description: string;
  quantity: number;
  unitPrice: number;
  sortOrder?: number;
  isTaxable?: boolean;
  costPrice?: number;
  marginOverride?: number;
  sku?: string | null;
}

export interface CreateInvoiceInput {
  invoiceNumber?: string | null;
  date: string;
  staffId?: string;
  contactId?: string;
  department: string;
  category: string;
  accountCode?: string;
  accountNumber?: string;
  approvalChain?: string[];
  notes?: string;
  items: CreateLineItemInput[];
  isRecurring?: boolean;
  recurringInterval?: string;
  recurringEmail?: string;
  isRunning?: boolean;
  runningTitle?: string;
  status?: "DRAFT";
  marginEnabled?: boolean;
  marginPercent?: number;
  taxEnabled?: boolean;
  taxRate?: number;
  isCateringEvent?: boolean;
  cateringDetails?: unknown;
  prismcorePath?: string | null;
  pdfMetadata?: InvoicePdfMetadata;
}

export interface InvoiceFilters {
  search?: string;
  status?: InvoiceStatus;
  staffId?: string;
  department?: string;
  category?: string;
  dateFrom?: string;
  dateTo?: string;
  createdFrom?: string;
  createdTo?: string;
  amountMin?: number;
  amountMax?: number;
  creatorId?: string;
  isRunning?: boolean;
  needsAccountNumber?: boolean;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface FinalizeInput {
  prismcorePath?: string;
  signatures?: { line1?: string; line2?: string; line3?: string };
  signatureStaffIds?: { line1?: string; line2?: string; line3?: string };
  semesterYearDept?: string;
  contactName?: string;
  contactExtension?: string;
}

export interface InvoiceListResponse {
  invoices: InvoiceListItemResponse[];
  total: number;
  page: number;
  pageSize: number;
}

export interface InvoiceStatsResponse {
  total: number;
  sumTotalAmount: number;
}

export interface CreatorStatEntry {
  id: string;
  name: string;
  invoiceCount: number;
  totalAmount: number;
}

export type CreatorStatsStatus = "DRAFT" | "FINAL" | "ALL";

export interface CreatorStatsResponse {
  users: CreatorStatEntry[];
}
