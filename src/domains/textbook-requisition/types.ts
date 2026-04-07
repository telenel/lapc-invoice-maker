// src/domains/textbook-requisition/types.ts
import type { RequisitionStatus, RequisitionSource, BookBinding, BookType } from "@/generated/prisma/client";

// ── DTOs ──

export interface RequisitionBookResponse {
  id: string;
  bookNumber: number;
  author: string;
  title: string;
  isbn: string;
  edition: string | null;
  copyrightYear: string | null;
  volume: string | null;
  publisher: string | null;
  binding: BookBinding | null;
  bookType: BookType;
  oerLink: string | null;
}

export interface RequisitionNotificationResponse {
  id: string;
  type: string;
  recipientEmail: string;
  subject: string;
  success: boolean;
  sentByUserId: string | null;
  sentByName: string | null;
  sentAt: string;
  errorMessage: string | null;
}

export interface RequisitionResponse {
  id: string;
  instructorName: string;
  phone: string;
  email: string;
  department: string;
  course: string;
  sections: string;
  enrollment: number;
  term: string;
  reqYear: number;
  additionalInfo: string | null;
  staffNotes: string | null;
  status: RequisitionStatus;
  source: RequisitionSource;
  createdBy: string | null;
  creatorName: string | null;
  lastStatusChangedAt: string | null;
  lastStatusChangedByUserId: string | null;
  lastStatusChangedByName: string | null;
  submittedAt: string;
  updatedAt: string;
  books: RequisitionBookResponse[];
  notifications: RequisitionNotificationResponse[];
  attentionFlags: string[];
}

export interface RequisitionListResponse {
  requisitions: RequisitionResponse[];
  total: number;
  page: number;
  pageSize: number;
}

/** Narrow acknowledgment returned to the public faculty form */
export interface RequisitionSubmitAck {
  id: string;
  submittedAt: string;
  department: string;
  course: string;
  term: string;
  reqYear: number;
  bookCount: number;
}

// ── Input types ──

export interface CreateBookInput {
  bookNumber: number;
  author: string;
  title: string;
  isbn: string;
  edition?: string;
  copyrightYear?: string;
  volume?: string;
  publisher?: string;
  binding?: BookBinding | null;
  bookType?: BookType;
  oerLink?: string;
}

export interface CreateRequisitionInput {
  instructorName: string;
  phone: string;
  email: string;
  department: string;
  course: string;
  sections: string;
  enrollment: number;
  term: string;
  reqYear: number;
  additionalInfo?: string;
  staffNotes?: string;
  status?: RequisitionStatus;
  source?: RequisitionSource;
  createdBy?: string;
  books: CreateBookInput[];
}

export interface UpdateRequisitionInput {
  instructorName?: string;
  phone?: string;
  email?: string;
  department?: string;
  course?: string;
  sections?: string;
  enrollment?: number;
  term?: string;
  reqYear?: number;
  additionalInfo?: string | null;
  staffNotes?: string | null;
  status?: RequisitionStatus;
  books?: CreateBookInput[];
}

export interface StatusUpdateInput {
  status: RequisitionStatus;
}

// ── Filters ──

export interface RequisitionFilters {
  search?: string;
  status?: RequisitionStatus;
  term?: string;
  year?: number;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

// ── Stats ──

export interface RequisitionStats {
  total: number;
  pending: number;
  ordered: number;
  onShelf: number;
  needsAttention: number;
}

// ── Notification result ──

export type NotificationOutcome =
  | "sent"             // email sent + all DB writes succeeded
  | "already_sent"     // prior successful send exists (idempotent skip)
  | "in_progress"      // another request is actively sending
  | "partial_failure"  // email sent but DB writes failed — needs manual correction
  | "unknown"          // stale SENDING — may or may not have been delivered
  | "failed";          // email send failed

export interface NotificationResult {
  requisition: RequisitionResponse;
  outcome: NotificationOutcome;
  emailSent: boolean;
  error?: string;
}

// ── Re-exports for convenience ──

export type { RequisitionStatus, RequisitionSource, BookBinding, BookType };
