// src/domains/admin/types.ts

// ── User DTOs ──
export interface UserResponse {
  id: string;
  username: string;
  name: string;
  email: string | null;
  role: string;
  active: boolean;
  setupComplete: boolean;
  createdAt: string;
}

// ── Account Code DTOs ──
export interface AccountCodeStaffSummary {
  id: string;
  name: string;
  department: string;
}

export interface AccountCodeResponse {
  id: string;
  staffId: string;
  accountCode: string;
  description: string;
  createdAt: string;
  staff: AccountCodeStaffSummary;
}

// ── DB Health DTOs ──
export interface DbHealthTables {
  users: number;
  staff: number;
  invoices: number;
  invoiceItems: number;
  categories: number;
  quickPickItems: number;
  staffAccountNumbers: number;
  staffSignerHistory: number;
  savedLineItems: number;
}

export interface DbHealthResponse {
  status: "connected" | "error";
  timestamp: string;
  dbSize: string | null;
  tables: DbHealthTables;
}

export interface DbHealthErrorResponse {
  status: "error";
  timestamp: string;
  message: string;
}

// ── Input types ──
export interface CreateUserInput {
  name: string;
}

export interface UpdateUserInput {
  name?: string;
  email?: string;
  role?: string;
}

export interface ResetPasswordInput {
  resetPassword: true;
}

export interface CreateAccountCodeInput {
  staffId: string;
  accountCode: string;
  description: string;
}
