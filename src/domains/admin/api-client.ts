import { ApiError } from "@/domains/shared/types";
import type {
  UserResponse,
  UserWithTemporaryPasswordResponse,
  AccountCodeResponse,
  DbHealthResponse,
  DbHealthErrorResponse,
  CreateUserInput,
  UpdateUserInput,
  CreateAccountCodeInput,
  BatchActionInput,
  BatchActionResponse,
} from "./types";

const BASE_USERS = "/api/admin/users";
const BASE_ACCOUNT_CODES = "/api/admin/account-codes";
const BASE_DB_HEALTH = "/api/admin/db-health";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw await ApiError.fromResponse(res);
  return res.json();
}

export const adminApi = {
  async listUsers(): Promise<UserResponse[]> {
    return request<UserResponse[]>(BASE_USERS);
  },

  async createUser(input: CreateUserInput): Promise<UserWithTemporaryPasswordResponse> {
    return request<UserWithTemporaryPasswordResponse>(BASE_USERS, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  },

  async updateUser(
    id: string,
    input: UpdateUserInput | { resetPassword: true },
  ): Promise<UserResponse | UserWithTemporaryPasswordResponse> {
    return request<UserResponse | UserWithTemporaryPasswordResponse>(`${BASE_USERS}/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  },

  async deleteUser(id: string): Promise<void> {
    const res = await fetch(`${BASE_USERS}/${id}`, { method: "DELETE" });
    if (!res.ok) throw await ApiError.fromResponse(res);
  },

  async listAccountCodes(): Promise<AccountCodeResponse[]> {
    return request<AccountCodeResponse[]>(BASE_ACCOUNT_CODES);
  },

  async createAccountCode(input: CreateAccountCodeInput): Promise<AccountCodeResponse> {
    return request<AccountCodeResponse>(BASE_ACCOUNT_CODES, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  },

  async deleteAccountCode(id: string): Promise<void> {
    const res = await fetch(`${BASE_ACCOUNT_CODES}/${id}`, { method: "DELETE" });
    if (!res.ok) throw await ApiError.fromResponse(res);
  },

  async getDbHealth(): Promise<DbHealthResponse | DbHealthErrorResponse> {
    return request<DbHealthResponse | DbHealthErrorResponse>(BASE_DB_HEALTH);
  },

  async batchInvoices(input: BatchActionInput): Promise<BatchActionResponse> {
    return request<BatchActionResponse>("/api/admin/invoices/batch", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  },

  async batchQuotes(input: BatchActionInput): Promise<BatchActionResponse> {
    return request<BatchActionResponse>("/api/admin/quotes/batch", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  },
};
