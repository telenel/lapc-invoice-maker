// src/domains/admin/service.ts
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import type { Prisma } from "@/generated/prisma/client";
import { getJobRunHealth } from "@/lib/job-runs";
import { getPlatformHealth } from "@/lib/platform-health";
import { adminRepository } from "./repository";
import type {
  UserResponse,
  UserWithTemporaryPasswordResponse,
  AccountCodeResponse,
  DbHealthResponse,
  AppSettingResponse,
  CreateUserInput,
  UpdateUserInput,
  CreateAccountCodeInput,
  BatchActionInput,
  BatchActionResponse,
} from "./types";

function generateTemporaryPassword(): string {
  return crypto.randomBytes(12).toString("base64url");
}

function toUserResponse(user: {
  id: string;
  username: string;
  name: string;
  email: string | null;
  role: string;
  active: boolean;
  setupComplete: boolean;
  createdAt: Date;
}): UserResponse {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    email: user.email,
    role: user.role,
    active: user.active,
    setupComplete: user.setupComplete,
    createdAt: user.createdAt.toISOString(),
  };
}

function toAccountCodeResponse(row: {
  id: string;
  staffId: string;
  accountCode: string;
  description: string;
  createdAt: Date;
  staff: { id: string; name: string; department: string };
}): AccountCodeResponse {
  return {
    id: row.id,
    staffId: row.staffId,
    accountCode: row.accountCode,
    description: row.description,
    createdAt: row.createdAt.toISOString(),
    staff: row.staff,
  };
}

async function generateUsername(
  name: string,
  excludeId?: string
): Promise<string> {
  const firstName = name.trim().split(/\s+/)[0].toLowerCase();
  let username = firstName;
  let suffix = 2;

  while (true) {
    const existing = excludeId
      ? await adminRepository.findUserByUsernameExcluding(username, excludeId)
      : await adminRepository.findUserByUsername(username);
    if (!existing) break;
    username = `${firstName}${suffix}`;
    suffix++;
  }

  return username;
}

export const adminService = {
  // ── Users ──

  async listUsers(): Promise<UserResponse[]> {
    const users = await adminRepository.findAllUsers();
    return users.map(toUserResponse);
  },

  async createUser(
    input: CreateUserInput
  ): Promise<UserWithTemporaryPasswordResponse> {
    const username = await generateUsername(input.name);
    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);
    const user = await adminRepository.createUser({
      username,
      passwordHash,
      name: input.name.trim(),
    });
    return { ...toUserResponse(user), temporaryPassword };
  },

  async updateUser(id: string, input: UpdateUserInput): Promise<UserResponse> {
    const data: UpdateUserInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.email !== undefined) data.email = input.email;
    if (input.role !== undefined) data.role = input.role;
    const user = await adminRepository.updateUser(id, data);
    return toUserResponse(user);
  },

  async resetPassword(
    id: string
  ): Promise<UserWithTemporaryPasswordResponse> {
    const existing = await adminRepository.findUserById(id);
    const name = existing?.name ?? "user";
    const username = await generateUsername(name, id);
    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);
    const user = await adminRepository.resetUserPassword(id, {
      passwordHash,
      username,
    });
    return { ...toUserResponse(user), temporaryPassword };
  },

  async deleteUser(id: string): Promise<void> {
    await adminRepository.deleteUser(id);
  },

  // ── Account codes ──

  async listAccountCodes(): Promise<AccountCodeResponse[]> {
    const codes = await adminRepository.findAllAccountCodes();
    return codes.map(toAccountCodeResponse);
  },

  async createAccountCode(
    input: CreateAccountCodeInput
  ): Promise<AccountCodeResponse> {
    const staff = await adminRepository.findStaffById(input.staffId);
    if (!staff) {
      throw Object.assign(new Error("Staff member not found"), {
        statusCode: 404,
      });
    }
    const code = await adminRepository.createAccountCode(input);
    return toAccountCodeResponse(code);
  },

  async deleteAccountCode(id: string): Promise<void> {
    await adminRepository.deleteAccountCode(id);
  },

  // ── App settings ──

  async listSettings(): Promise<AppSettingResponse[]> {
    return adminRepository.findAllSettings();
  },

  async listSettingsByKeys(keys: string[]): Promise<AppSettingResponse[]> {
    if (keys.length === 0) return [];
    return adminRepository.findSettingsByKeys(keys);
  },

  async saveSetting(key: string, value: Prisma.InputJsonValue): Promise<AppSettingResponse> {
    const normalizedKey = key.trim();
    if (!normalizedKey) {
      throw Object.assign(new Error("Setting key is required"), { statusCode: 400 });
    }
    return adminRepository.upsertSetting(normalizedKey, value);
  },

  // ── Batch operations ──

  async batchInvoices(input: BatchActionInput): Promise<BatchActionResponse> {
    const { ids, action, value } = input;
    if (ids.length === 0) return { updated: 0 };

    switch (action) {
      case "delete": {
        const result = await adminRepository.batchDeleteInvoices(ids);
        return { deleted: result.count };
      }
      case "status": {
        if (!value) throw Object.assign(new Error("Value required for status change"), { statusCode: 400 });
        const result = await adminRepository.batchUpdateInvoiceStatus(ids, value);
        return { updated: result.count };
      }
      case "reassign": {
        if (!value) throw Object.assign(new Error("Value required for reassign"), { statusCode: 400 });
        const result = await adminRepository.batchReassignInvoices(ids, value);
        return { updated: result.count };
      }
    }
  },

  async batchQuotes(input: BatchActionInput): Promise<BatchActionResponse> {
    const { ids, action, value } = input;
    if (ids.length === 0) return { updated: 0 };

    switch (action) {
      case "delete": {
        const result = await adminRepository.batchDeleteQuotes(ids);
        return { deleted: result.count };
      }
      case "status": {
        if (!value) throw Object.assign(new Error("Value required for status change"), { statusCode: 400 });
        const result = await adminRepository.batchUpdateQuoteStatus(ids, value);
        return { updated: result.count };
      }
      case "reassign": {
        if (!value) throw Object.assign(new Error("Value required for reassign"), { statusCode: 400 });
        const result = await adminRepository.batchReassignQuotes(ids, value);
        return { updated: result.count };
      }
    }
  },

  // ── DB health ──

  async getDbHealth(): Promise<DbHealthResponse> {
    const [tables, dbSize, platform, jobs] = await Promise.all([
      adminRepository.getTableCounts(),
      adminRepository.getDatabaseSize(),
      getPlatformHealth(),
      getJobRunHealth(),
    ]);
    return {
      status: "connected",
      timestamp: new Date().toISOString(),
      dbSize,
      tables,
      platform,
      jobs,
    };
  },
};
