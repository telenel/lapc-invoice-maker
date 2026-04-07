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
}

export interface InvoiceResponse {
  id: string;
  invoiceNumber: string | null;
  date: string;
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
  staff: InvoiceStaffDetail | null;
  contact: ContactResponse | null;
  creatorId: string;
  creatorName: string;
  items: InvoiceItemResponse[];
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
}

export interface CreateLineItemInput {
  description: string;
  quantity: number;
  unitPrice: number;
  sortOrder?: number;
  isTaxable?: boolean;
  costPrice?: number;
  marginOverride?: number;
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
  status?: "DRAFT" | "PENDING_CHARGE";
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
  invoices: InvoiceResponse[];
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

export interface CreatorStatsResponse {
  users: CreatorStatEntry[];
}
