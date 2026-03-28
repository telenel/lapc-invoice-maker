// tests/domains/staff/service.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/domains/staff/repository", () => ({
  staffRepository: {
    findMany: vi.fn(),
    findManyPaginated: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    partialUpdate: vi.fn(),
    softDelete: vi.fn(),
    findAccountNumbers: vi.fn(),
    upsertAccountNumber: vi.fn(),
    upsertSignerHistory: vi.fn(),
  },
}));

import { staffRepository } from "@/domains/staff/repository";
import { staffService } from "@/domains/staff/service";

const mockRepo = vi.mocked(staffRepository, true);

describe("staffService", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("list", () => {
    it("returns mapped StaffResponse array", async () => {
      const staffList = [
        { id: "s1", name: "Alice", title: "Manager", department: "IT", accountCode: "", extension: "", email: "", phone: "", approvalChain: [], active: true, accountNumbers: [] },
      ];
      mockRepo.findMany.mockResolvedValue(staffList as never);

      const result = await staffService.list({ search: "alice" });

      expect(mockRepo.findMany).toHaveBeenCalledWith({ search: "alice" });
      expect(result).toEqual([
        expect.objectContaining({ id: "s1", name: "Alice" }),
      ]);
    });
  });

  describe("listPaginated", () => {
    it("returns paginated response", async () => {
      mockRepo.findManyPaginated.mockResolvedValue({ data: [], total: 0 } as never);

      const result = await staffService.listPaginated({ search: "", page: 1, pageSize: 20 });

      expect(result).toEqual({ data: [], total: 0, page: 1, pageSize: 20 });
    });
  });

  describe("getById", () => {
    it("returns staff detail DTO with mapped relations", async () => {
      mockRepo.findById.mockResolvedValue({
        id: "s1", name: "Alice", title: "Manager", department: "IT",
        accountCode: "AC1", extension: "x100", email: "alice@test.com", phone: "555-1234",
        approvalChain: ["Bob"], active: true, createdAt: new Date(), updatedAt: new Date(),
        accountNumbers: [
          { id: "a1", staffId: "s1", accountCode: "1234", description: "Main", lastUsedAt: new Date("2026-01-01"), createdAt: new Date() },
        ],
        signerHistories: [
          { id: "h1", staffId: "s1", position: 1, signer: { id: "s2", name: "Bob", title: "Director", department: "IT" } },
        ],
      } as never);

      const result = await staffService.getById("s1");

      expect(result).not.toBeNull();
      expect(result!.accountNumbers[0].accountCode).toBe("1234");
      expect(result!.accountNumbers[0].lastUsedAt).toBe("2026-01-01T00:00:00.000Z");
      expect(result!.signerHistories[0].signer.name).toBe("Bob");
    });

    it("returns null for missing staff", async () => {
      mockRepo.findById.mockResolvedValue(null);
      const result = await staffService.getById("missing");
      expect(result).toBeNull();
    });
  });

  describe("create", () => {
    it("creates and returns StaffResponse", async () => {
      const created = { id: "s1", name: "New", title: "Dev", department: "Eng", accountCode: "", extension: "", email: "", phone: "", approvalChain: [], active: true, accountNumbers: [] };
      mockRepo.create.mockResolvedValue(created as never);

      const result = await staffService.create({ name: "New", title: "Dev", department: "Eng" });

      expect(result.id).toBe("s1");
      expect(result.name).toBe("New");
    });
  });

  describe("update", () => {
    it("updates and returns StaffDetailResponse", async () => {
      mockRepo.update.mockResolvedValue({
        id: "s1", name: "Alice Updated", title: "Senior Manager", department: "IT",
        accountCode: "AC1", extension: "x100", email: "alice@test.com", phone: "555-1234",
        approvalChain: [], active: true, createdAt: new Date(), updatedAt: new Date(),
        accountNumbers: [],
        signerHistories: [],
      } as never);

      const result = await staffService.update("s1", { name: "Alice Updated", title: "Senior Manager" });

      expect(mockRepo.update).toHaveBeenCalledWith("s1", { name: "Alice Updated", title: "Senior Manager" });
      expect(result).not.toBeNull();
      expect(result!.name).toBe("Alice Updated");
    });

    it("returns null when staff not found", async () => {
      mockRepo.update.mockResolvedValue(null as never);
      const result = await staffService.update("missing", { name: "X" });
      expect(result).toBeNull();
    });
  });

  describe("partialUpdate", () => {
    it("partially updates and returns StaffDetailResponse", async () => {
      mockRepo.partialUpdate.mockResolvedValue({
        id: "s1", name: "Alice", title: "Lead", department: "IT",
        accountCode: "AC1", extension: "x100", email: "alice@test.com", phone: "555-1234",
        approvalChain: [], active: true, createdAt: new Date(), updatedAt: new Date(),
        accountNumbers: [],
        signerHistories: [],
      } as never);

      const result = await staffService.partialUpdate("s1", { title: "Lead" });

      expect(mockRepo.partialUpdate).toHaveBeenCalledWith("s1", { title: "Lead" });
      expect(result!.title).toBe("Lead");
    });
  });

  describe("softDelete", () => {
    it("calls repository softDelete", async () => {
      mockRepo.softDelete.mockResolvedValue(undefined as never);

      await staffService.softDelete("s1");

      expect(mockRepo.softDelete).toHaveBeenCalledWith("s1");
    });
  });

  describe("getAccountNumbers", () => {
    it("returns mapped AccountNumberResponse array", async () => {
      const rows = [
        { id: "a1", staffId: "s1", accountCode: "1234", description: "Main", lastUsedAt: new Date("2026-02-15"), createdAt: new Date() },
        { id: "a2", staffId: "s1", accountCode: "5678", description: "Secondary", lastUsedAt: null, createdAt: new Date() },
      ];
      mockRepo.findAccountNumbers.mockResolvedValue(rows as never);

      const result = await staffService.getAccountNumbers("s1");

      expect(mockRepo.findAccountNumbers).toHaveBeenCalledWith("s1");
      expect(result).toHaveLength(2);
      expect(result[0].lastUsedAt).toBe("2026-02-15T00:00:00.000Z");
      expect(result[1].lastUsedAt).toBeNull();
    });
  });

  describe("upsertAccountNumber", () => {
    it("calls repository upsertAccountNumber with input", async () => {
      mockRepo.upsertAccountNumber.mockResolvedValue(undefined as never);

      const input = { staffId: "s1", accountCode: "9999", description: "New Account" };
      await staffService.upsertAccountNumber(input);

      expect(mockRepo.upsertAccountNumber).toHaveBeenCalledWith(input);
    });
  });

  describe("recordSignerHistory", () => {
    it("calls repository upsertSignerHistory with correct args", async () => {
      mockRepo.upsertSignerHistory.mockResolvedValue(undefined as never);

      await staffService.recordSignerHistory("inv1", "s1", 2, "s2");

      expect(mockRepo.upsertSignerHistory).toHaveBeenCalledWith("inv1", "s1", 2, "s2");
    });
  });
});
