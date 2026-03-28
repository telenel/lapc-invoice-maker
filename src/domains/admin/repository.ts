// src/domains/admin/repository.ts
import { prisma } from "@/lib/prisma";
import type { CreateUserInput, UpdateUserInput, CreateAccountCodeInput } from "./types";

const userSelect = {
  id: true,
  username: true,
  name: true,
  email: true,
  role: true,
  active: true,
  setupComplete: true,
  createdAt: true,
} as const;

const accountCodeInclude = {
  staff: { select: { id: true, name: true, department: true } },
} as const;

export const adminRepository = {
  // ── User queries ──

  async findAllUsers() {
    return prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: userSelect,
    });
  },

  async findUserById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      select: { ...userSelect, name: true },
    });
  },

  async findUserByUsername(username: string) {
    return prisma.user.findUnique({ where: { username } });
  },

  async findUserByUsernameExcluding(username: string, excludeId: string) {
    return prisma.user.findFirst({
      where: { username, NOT: { id: excludeId } },
    });
  },

  async createUser(data: {
    username: string;
    passwordHash: string;
    name: string;
  }) {
    return prisma.user.create({
      data: {
        username: data.username,
        passwordHash: data.passwordHash,
        name: data.name,
        role: "user",
      },
      select: userSelect,
    });
  },

  async updateUser(id: string, data: UpdateUserInput) {
    return prisma.user.update({
      where: { id },
      data,
      select: userSelect,
    });
  },

  async resetUserPassword(id: string, data: { passwordHash: string; username: string }) {
    return prisma.user.update({
      where: { id },
      data: {
        passwordHash: data.passwordHash,
        setupComplete: false,
        username: data.username,
      },
      select: userSelect,
    });
  },

  async deleteUser(id: string) {
    return prisma.user.delete({ where: { id } });
  },

  // ── Account code queries ──

  async findAllAccountCodes() {
    return prisma.staffAccountNumber.findMany({
      include: accountCodeInclude,
      orderBy: [{ accountCode: "asc" }, { createdAt: "desc" }],
    });
  },

  async findStaffById(id: string) {
    return prisma.staff.findUnique({ where: { id } });
  },

  async createAccountCode(data: CreateAccountCodeInput) {
    return prisma.staffAccountNumber.create({
      data: {
        staffId: data.staffId,
        accountCode: data.accountCode.trim(),
        description: data.description.trim(),
      },
      include: accountCodeInclude,
    });
  },

  async deleteAccountCode(id: string) {
    return prisma.staffAccountNumber.delete({ where: { id } });
  },

  // ── DB health queries ──

  async getTableCounts() {
    const [
      users,
      staff,
      invoices,
      invoiceItems,
      categories,
      quickPickItems,
      staffAccountNumbers,
      staffSignerHistory,
      savedLineItems,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.staff.count(),
      prisma.invoice.count(),
      prisma.invoiceItem.count(),
      prisma.category.count(),
      prisma.quickPickItem.count(),
      prisma.staffAccountNumber.count(),
      prisma.staffSignerHistory.count(),
      prisma.savedLineItem.count(),
    ]);
    return {
      users,
      staff,
      invoices,
      invoiceItems,
      categories,
      quickPickItems,
      staffAccountNumbers,
      staffSignerHistory,
      savedLineItems,
    };
  },

  async getDatabaseSize(): Promise<string | null> {
    try {
      const result = await prisma.$queryRaw<{ size: string }[]>`
        SELECT pg_size_pretty(pg_database_size(current_database())) as size
      `;
      return result[0]?.size ?? null;
    } catch {
      return null;
    }
  },
};
