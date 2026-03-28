// src/domains/staff/types.ts

// ── Cross-domain (exported for invoice, quote domains) ──
export interface StaffSummary {
  id: string;
  name: string;
  title: string;
  department: string;
}

// ── Internal (repository <-> service) ──
export interface StaffAccountNumberRow {
  id: string;
  staffId: string;
  accountCode: string;
  description: string;
  lastUsedAt: Date | null;
  createdAt: Date;
}

export interface SignerHistoryRow {
  id: string;
  staffId: string;
  position: number;
  signer: {
    id: string;
    name: string;
    title: string;
    department: string;
  };
}

export interface StaffWithRelations {
  id: string;
  name: string;
  title: string;
  department: string;
  accountCode: string;
  extension: string;
  email: string;
  phone: string;
  approvalChain: string[];
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  accountNumbers: StaffAccountNumberRow[];
  signerHistories: SignerHistoryRow[];
}

// ── DTOs (cross network boundary) ──
export interface StaffResponse {
  id: string;
  name: string;
  title: string;
  department: string;
  accountCode: string;
  extension: string;
  email: string;
  phone: string;
  approvalChain: string[];
  active: boolean;
}

export interface StaffDetailResponse extends StaffResponse {
  accountNumbers: AccountNumberResponse[];
  signerHistories: SignerHistoryResponse[];
}

export interface AccountNumberResponse {
  id: string;
  accountCode: string;
  description: string;
  lastUsedAt: string | null;
}

export interface SignerHistoryResponse {
  position: number;
  signer: StaffSummary;
}

// ── Input types ──
export interface StaffFilters {
  search?: string;
  page?: number;
  pageSize?: number;
  paginated?: boolean;
}

export interface CreateStaffInput {
  name: string;
  title: string;
  department: string;
  accountCode?: string;
  extension?: string;
  email?: string;
  phone?: string;
  approvalChain?: string[];
}

export interface UpdateStaffInput extends Partial<CreateStaffInput> {}

export interface UpsertAccountNumberInput {
  staffId: string;
  accountCode: string;
  description?: string;
}
