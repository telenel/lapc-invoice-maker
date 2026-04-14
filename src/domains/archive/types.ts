import type { ArchivedBySummary } from "@/domains/invoice/types";

export type ArchiveDocumentType = "INVOICE" | "QUOTE";

export interface ArchivedDocumentResponse {
  id: string;
  type: ArchiveDocumentType;
  invoiceNumber: string | null;
  quoteNumber: string | null;
  status: string | null;
  quoteStatus: string | null;
  department: string;
  creatorId: string;
  creatorName: string;
  recipientName: string | null;
  recipientOrg: string | null;
  totalAmount: number;
  createdAt: string;
  archivedAt: string;
  archivedBy: ArchivedBySummary | null;
}

export interface ArchiveFilters {
  type?: ArchiveDocumentType | "all";
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface ArchiveListResponse {
  documents: ArchivedDocumentResponse[];
  total: number;
  page: number;
  pageSize: number;
}
