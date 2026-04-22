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
  staffAccountNumbers: number;
  staffSignerHistory: number;
  savedLineItems: number;
  rateLimitEvents: number;
  jobRuns: number;
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
      configuredMode: "app" | "supabase";
      activeMode: "app" | "supabase";
      confirmed: boolean;
      cronSecretConfigured: boolean;
    };
    storage: {
      legacyFilesystemFallbackEnabled: boolean;
      invoicePdfPaths: number;
      prismcorePaths: number;
      printQuotePdfPaths: number;
      totalLegacyReferences: number;
    };
  };
  jobs: {
    summaries: Array<{
      jobKey: string;
      activeSchedulerMode: "app" | "supabase";
      configuredSchedulerMode: "app" | "supabase";
      lastStatus: string | null;
      lastStartedAt: string | null;
      lastFinishedAt: string | null;
      lastDurationMs: number | null;
      lastRunner: string | null;
    }>;
    recentRuns: Array<{
      id: string;
      jobKey: string;
      schedulerMode: string;
      runner: string | null;
      status: string;
      startedAt: string;
      finishedAt: string | null;
      durationMs: number | null;
      details: unknown;
    }>;
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
