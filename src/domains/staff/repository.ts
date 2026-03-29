// src/domains/staff/repository.ts
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type {
  StaffFilters,
  CreateStaffInput,
  UpdateStaffInput,
  UpsertAccountNumberInput,
} from "./types";

function buildWhere(filters: StaffFilters): Prisma.StaffWhereInput {
  const where: Prisma.StaffWhereInput = { active: true };
  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: "insensitive" } },
      { department: { contains: filters.search, mode: "insensitive" } },
      { title: { contains: filters.search, mode: "insensitive" } },
      { email: { contains: filters.search, mode: "insensitive" } },
    ];
  }
  return where;
}

const includeRelations = {
  accountNumbers: true,
  signerHistories: { include: { signer: true } },
} as const;

export const staffRepository = {
  async findMany(filters: StaffFilters) {
    return prisma.staff.findMany({
      where: buildWhere(filters),
      include: { accountNumbers: true },
      orderBy: { name: "asc" as const },
    });
  },

  async findManyPaginated(filters: StaffFilters & { page: number; pageSize: number }) {
    const where = buildWhere(filters);
    const [data, total] = await Promise.all([
      prisma.staff.findMany({
        where,
        include: { accountNumbers: true },
        orderBy: { name: "asc" as const },
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
      }),
      prisma.staff.count({ where }),
    ]);
    return { data, total };
  },

  async findById(id: string) {
    return prisma.staff.findUnique({
      where: { id },
      include: includeRelations,
    });
  },

  async create(data: CreateStaffInput) {
    return prisma.staff.create({
      data: {
        name: data.name,
        title: data.title,
        department: data.department,
        accountCode: data.accountCode ?? "",
        extension: data.extension ?? "",
        email: data.email ?? "",
        phone: data.phone ?? "",
        birthMonth: data.birthMonth ?? null,
        birthDay: data.birthDay ?? null,
        approvalChain: data.approvalChain ?? [],
      },
      include: { accountNumbers: true },
    });
  },

  async update(id: string, data: UpdateStaffInput) {
    return prisma.staff.update({
      where: { id },
      data,
      include: includeRelations,
    });
  },

  async partialUpdate(id: string, data: UpdateStaffInput) {
    return prisma.staff.update({
      where: { id },
      data,
      include: includeRelations,
    });
  },

  async softDelete(id: string) {
    return prisma.staff.update({
      where: { id },
      data: { active: false },
    });
  },

  async findAccountNumbers(staffId: string) {
    return prisma.staffAccountNumber.findMany({
      where: { staffId },
      orderBy: { lastUsedAt: "desc" },
    });
  },

  async upsertAccountNumber(input: UpsertAccountNumberInput) {
    return prisma.staffAccountNumber.upsert({
      where: {
        staffId_accountCode: {
          staffId: input.staffId,
          accountCode: input.accountCode,
        },
      },
      update: {
        description: input.description ?? "",
        lastUsedAt: new Date(),
      },
      create: {
        staffId: input.staffId,
        accountCode: input.accountCode,
        description: input.description ?? "",
      },
    });
  },

  async upsertSignerHistory(_invoiceId: string, staffId: string, position: number, signerStaffId: string) {
    return prisma.staffSignerHistory.upsert({
      where: {
        staffId_signerStaffId_position: { staffId, signerStaffId, position },
      },
      update: { lastUsedAt: new Date() },
      create: { staffId, position, signerStaffId },
    });
  },
};
