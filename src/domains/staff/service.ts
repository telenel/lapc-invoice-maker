// src/domains/staff/service.ts
import { staffRepository } from "./repository";
import type {
  StaffResponse,
  StaffDetailResponse,
  StaffFilters,
  CreateStaffInput,
  UpdateStaffInput,
  UpsertAccountNumberInput,
  AccountNumberResponse,
} from "./types";
import type { PaginatedResponse } from "@/domains/shared/types";

function toStaffResponse(staff: {
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
}): StaffResponse {
  return {
    id: staff.id,
    name: staff.name,
    title: staff.title,
    department: staff.department,
    accountCode: staff.accountCode,
    extension: staff.extension,
    email: staff.email,
    phone: staff.phone,
    approvalChain: staff.approvalChain,
    active: staff.active,
  };
}

function toDetailResponse(staff: Awaited<ReturnType<typeof staffRepository.findById>>): StaffDetailResponse | null {
  if (!staff) return null;
  return {
    ...toStaffResponse(staff),
    accountNumbers: staff.accountNumbers.map((a) => ({
      id: a.id,
      accountCode: a.accountCode,
      description: a.description,
      lastUsedAt: a.lastUsedAt?.toISOString() ?? null,
    })),
    signerHistories: staff.signerHistories.map((h) => ({
      position: h.position,
      signer: {
        id: h.signer.id,
        name: h.signer.name,
        title: h.signer.title,
        department: h.signer.department,
      },
    })),
  };
}

export const staffService = {
  async list(filters: StaffFilters): Promise<StaffResponse[]> {
    const staff = await staffRepository.findMany(filters);
    return staff.map(toStaffResponse);
  },

  async listPaginated(filters: StaffFilters & { page: number; pageSize: number }): Promise<PaginatedResponse<StaffResponse>> {
    const { data, total } = await staffRepository.findManyPaginated(filters);
    return {
      data: data.map(toStaffResponse),
      total,
      page: filters.page,
      pageSize: filters.pageSize,
    };
  },

  async getById(id: string): Promise<StaffDetailResponse | null> {
    const staff = await staffRepository.findById(id);
    return toDetailResponse(staff);
  },

  async create(input: CreateStaffInput): Promise<StaffResponse> {
    const staff = await staffRepository.create(input);
    return toStaffResponse(staff);
  },

  async update(id: string, input: UpdateStaffInput): Promise<StaffDetailResponse | null> {
    const staff = await staffRepository.update(id, input);
    return toDetailResponse(staff);
  },

  async partialUpdate(id: string, input: UpdateStaffInput): Promise<StaffDetailResponse | null> {
    const staff = await staffRepository.partialUpdate(id, input);
    return toDetailResponse(staff);
  },

  async softDelete(id: string): Promise<void> {
    await staffRepository.softDelete(id);
  },

  async getAccountNumbers(staffId: string): Promise<AccountNumberResponse[]> {
    const rows = await staffRepository.findAccountNumbers(staffId);
    return rows.map((a) => ({
      id: a.id,
      accountCode: a.accountCode,
      description: a.description,
      lastUsedAt: a.lastUsedAt?.toISOString() ?? null,
    }));
  },

  async upsertAccountNumber(input: UpsertAccountNumberInput): Promise<void> {
    await staffRepository.upsertAccountNumber(input);
  },

  async recordSignerHistory(invoiceId: string, staffId: string, position: number, signerId: string): Promise<void> {
    await staffRepository.upsertSignerHistory(invoiceId, staffId, position, signerId);
  },
};
