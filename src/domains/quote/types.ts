// src/domains/quote/types.ts
import type { StaffSummary } from "@/domains/staff/types";

// ── Constants ──────────────────────────────────────────────────────────────

export type QuoteStatus = "DRAFT" | "SENT" | "ACCEPTED" | "DECLINED" | "EXPIRED";

// ── DTOs ──────────────────────────────────────────────────────────────────

export interface QuoteItemResponse {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  extendedPrice: number;
  sortOrder: number;
}

export interface QuoteResponse {
  id: string;
  quoteNumber: string | null;
  quoteStatus: QuoteStatus;
  date: string;
  expirationDate: string | null;
  type: string;
  department: string;
  category: string;
  accountCode: string;
  accountNumber: string;
  approvalChain: string[];
  notes: string;
  totalAmount: number;
  recipientName: string;
  recipientEmail: string;
  recipientOrg: string;
  pdfPath: string | null;
  shareToken: string | null;
  createdAt: string;
  staff: StaffSummary;
  creatorId: string;
  creatorName: string;
  items: QuoteItemResponse[];
  convertedToInvoice?: { id: string; invoiceNumber: string | null } | null;
}

// ── Inputs ─────────────────────────────────────────────────────────────────

export interface CreateLineItemInput {
  description: string;
  quantity: number;
  unitPrice: number;
  sortOrder?: number;
}

export interface CreateQuoteInput {
  date: string;
  staffId: string;
  department: string;
  category: string;
  accountCode?: string;
  accountNumber?: string;
  approvalChain?: string[];
  notes?: string;
  items: CreateLineItemInput[];
  expirationDate: string;
  recipientName: string;
  recipientEmail?: string;
  recipientOrg?: string;
}

export interface UpdateQuoteInput {
  date?: string;
  staffId?: string;
  department?: string;
  category?: string;
  accountCode?: string;
  accountNumber?: string;
  approvalChain?: string[];
  notes?: string;
  items?: CreateLineItemInput[];
  expirationDate?: string;
  recipientName?: string;
  recipientEmail?: string;
  recipientOrg?: string;
  quoteStatus?: QuoteStatus;
}

export interface QuoteFilters {
  search?: string;
  quoteStatus?: QuoteStatus | "all";
  department?: string;
  category?: string;
  creatorId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface QuoteViewResponse {
  id: string;
  viewedAt: string;
  ipAddress: string | null;
  userAgent: string | null;
  referrer: string | null;
  viewport: string | null;
  durationSeconds: number | null;
  respondedWith: string | null;
}
