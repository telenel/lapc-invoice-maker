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

export interface UserWithTemporaryPasswordResponse extends UserResponse {
  temporaryPassword: string;
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
  lastUsedAt?: string;
  createdAt: string;
  staff: AccountCodeStaffSummary;
}

// ── DB Health DTOs ──
export interface DbHealthTables {
  [key: string]: number;
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
  platform: {
    supabase: {
      runtimePublicEnv: boolean;
      runtimeAdminEnv: boolean;
      buildPublicEnv: {
        supabaseUrlConfigured: boolean;
        supabaseAnonKeyConfigured: boolean;
      };
    };
    scheduler: {
      mode: "app" | "supabase";
      cronSecretConfigured: boolean;
    };
  };
}

export interface DbHealthErrorResponse {
  status: "error";
  timestamp: string;
  message: string;
}

export interface AppSettingResponse {
  key: string;
  value: unknown;
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

// ── Batch action DTOs ──
export type BatchAction = "status" | "reassign" | "delete";

export interface BatchActionInput {
  ids: string[];
  action: BatchAction;
  value?: string;
}

export interface BatchActionResponse {
  updated?: number;
  deleted?: number;
}
