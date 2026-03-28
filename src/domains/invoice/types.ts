// src/domains/invoice/types.ts
import type { StaffSummary } from "@/domains/staff/types";
import type { InvoiceStatus } from "./constants";

// ── DTOs ──
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
  prismcorePath: string | null;
  createdAt: string;
  staff: StaffSummary;
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
}

export interface CreateLineItemInput {
  description: string;
  quantity: number;
  unitPrice: number;
  sortOrder?: number;
}

export interface CreateInvoiceInput {
  invoiceNumber?: string | null;
  date: string;
  staffId: string;
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

export interface InvoiceStatsResponse {
  total: number;
  sumTotalAmount: number;
}
