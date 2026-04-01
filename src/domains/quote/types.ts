// src/domains/quote/types.ts
import type { StaffSummary } from "@/domains/staff/types";
import type { ContactResponse } from "@/domains/contact/types";

// ── Constants ──────────────────────────────────────────────────────────────

export type QuoteStatus = "DRAFT" | "SENT" | "SUBMITTED_EMAIL" | "SUBMITTED_MANUAL" | "ACCEPTED" | "DECLINED" | "REVISED" | "EXPIRED";

// ── Catering ──────────────────────────────────────────────────────────────

export interface CateringDetails {
  eventDate: string;
  startTime: string;
  endTime: string;
  location: string;
  contactName: string;
  contactPhone: string;
  contactEmail?: string;
  headcount?: number;
  eventName?: string;
  setupRequired: boolean;
  setupTime?: string;
  setupInstructions?: string;
  takedownRequired: boolean;
  takedownTime?: string;
  takedownInstructions?: string;
  specialInstructions?: string;
}

// ── DTOs ──────────────────────────────────────────────────────────────────

export interface QuoteItemResponse {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  extendedPrice: number;
  sortOrder: number;
  isTaxable: boolean;
  marginOverride: number | null;
  costPrice: number | null;
}

export interface PublicQuoteItemResponse {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  extendedPrice: number;
  sortOrder: number;
  isTaxable: boolean;
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
  staff: StaffSummary | null;
  contact: ContactResponse | null;
  creatorId: string;
  creatorName: string;
  items: QuoteItemResponse[];
  isCateringEvent: boolean;
  cateringDetails: CateringDetails | null;
  marginEnabled: boolean;
  marginPercent: number | null;
  taxEnabled: boolean;
  taxRate: number;
  paymentMethod: string | null;
  paymentAccountNumber: string | null;
  paymentDetailsResolved: boolean;
  viewerAccess?: {
    canViewQuote: boolean;
    canManageActions: boolean;
    canViewActivity: boolean;
    canViewSensitiveFields: boolean;
  };
  convertedToInvoice?: { id: string; invoiceNumber: string | null; status?: string | null; createdBy?: string | null } | null;
  revisedFromQuote?: { id: string; quoteNumber: string | null } | null;
  revisedToQuote?: { id: string; quoteNumber: string | null } | null;
}

export interface PublicQuoteResponse {
  id: string;
  quoteNumber: string | null;
  quoteStatus: QuoteStatus;
  paymentLinkAvailable: boolean;
  date: string;
  expirationDate: string | null;
  department: string;
  category: string;
  notes: string;
  totalAmount: number;
  recipientName: string;
  recipientEmail: string;
  recipientOrg: string;
  staff: {
    name: string;
    title: string;
    department: string;
    extension: string | null;
    email: string | null;
  } | null;
  contact: {
    name: string;
    title: string;
    org: string;
    department: string;
    email: string;
    phone: string;
  } | null;
  items: PublicQuoteItemResponse[];
  isCateringEvent: boolean;
  cateringDetails: CateringDetails | null;
  paymentDetailsResolved: boolean;
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
  staffId?: string;
  contactId?: string;
  department: string;
  category: string;
  accountCode?: string;
  accountNumber?: string;
  approvalChain?: string[];
  notes?: string;
  items: (CreateLineItemInput & {
    isTaxable?: boolean;
    marginOverride?: number;
    costPrice?: number;
  })[];
  expirationDate: string;
  recipientName: string;
  recipientEmail?: string;
  recipientOrg?: string;
  isCateringEvent?: boolean;
  cateringDetails?: CateringDetails;
  marginEnabled?: boolean;
  marginPercent?: number;
  taxEnabled?: boolean;
  taxRate?: number;
}

export interface UpdateQuoteInput {
  date?: string;
  staffId?: string | null;
  department?: string;
  category?: string;
  accountCode?: string;
  accountNumber?: string;
  approvalChain?: string[];
  notes?: string;
  items?: (CreateLineItemInput & {
    isTaxable?: boolean;
    marginOverride?: number;
    costPrice?: number;
  })[];
  expirationDate?: string;
  recipientName?: string;
  recipientEmail?: string;
  recipientOrg?: string;
  quoteStatus?: QuoteStatus;
  isCateringEvent?: boolean;
  cateringDetails?: CateringDetails;
  marginEnabled?: boolean;
  marginPercent?: number;
  taxEnabled?: boolean;
  taxRate?: number;
  paymentMethod?: string;
  paymentAccountNumber?: string | null;
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

export interface QuoteFollowUpResponse {
  id: string;
  type: string;
  recipientEmail: string;
  subject: string;
  sentAt: string;
  metadata: Record<string, unknown> | null;
}

export interface QuotePaymentDetailsSubmission {
  paymentMethod: string;
  paymentAccountNumber: string | null;
}

export interface QuotePublicPaymentCandidate {
  id: string;
  quoteNumber: string | null;
  recipientEmail: string | null;
  paymentMethod: string | null;
  convertedToInvoice: { id: string } | null;
  updatedConvertedInvoice?: boolean;
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

export interface QuotePublicSettingsResponse {
  [key: string]: {
    name?: string;
    phone?: string;
    email?: string;
    note?: string;
  } | undefined;
}

export interface QuotePublicResponseSubmission {
  response: "ACCEPTED" | "DECLINED";
  viewId?: string | null;
  cateringDetails?: CateringDetails;
  paymentMethod?: string;
  accountNumber?: string | null;
}

export interface QuotePublicPaymentSubmission {
  paymentMethod: string;
  accountNumber?: string | null;
}
