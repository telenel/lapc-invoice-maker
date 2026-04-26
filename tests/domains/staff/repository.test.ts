// tests/domains/staff/repository.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    staff: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    staffAccountNumber: {
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
    staffSignerHistory: {
      upsert: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { staffRepository } from "@/domains/staff/repository";

const mockPrisma = vi.mocked(prisma, true);

describe("staffRepository", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("findMany", () => {
    it("returns all active staff when no filters", async () => {
      const staffList = [{ id: "s1", name: "Alice", active: true }];
      mockPrisma.staff.findMany.mockResolvedValue(staffList as never);

      const result = await staffRepository.findMany({});

      expect(mockPrisma.staff.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ active: true }),
          orderBy: { name: "asc" },
        })
      );
      expect(result).toEqual(staffList);
    });

    it("applies search filter across name, department, title, email", async () => {
      mockPrisma.staff.findMany.mockResolvedValue([]);

      await staffRepository.findMany({ search: "alice" });

      expect(mockPrisma.staff.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            active: true,
            OR: [
              { name: { contains: "alice", mode: "insensitive" } },
              { department: { contains: "alice", mode: "insensitive" } },
              { title: { contains: "alice", mode: "insensitive" } },
              { email: { contains: "alice", mode: "insensitive" } },
            ],
          }),
        })
      );
    });
  });

  describe("findDepartments", () => {
    it("selects only active distinct departments", async () => {
      mockPrisma.staff.findMany.mockResolvedValue([
        { department: " CopyTech " },
        { department: "Bookstore" },
        { department: "CopyTech" },
        { department: "" },
      ] as never);

      const result = await staffRepository.findDepartments();

      expect(mockPrisma.staff.findMany).toHaveBeenCalledWith({
        where: { active: true, NOT: { department: "" } },
        select: { department: true },
        distinct: ["department"],
        orderBy: { department: "asc" },
      });
      expect(result).toEqual(["Bookstore", "CopyTech"]);
    });
  });

  describe("findManyPaginated", () => {
    it("paginates when page and pageSize provided", async () => {
      mockPrisma.staff.findMany.mockResolvedValue([]);
      mockPrisma.staff.count.mockResolvedValue(50);

      const result = await staffRepository.findManyPaginated({
        search: "",
        page: 2,
        pageSize: 10,
      });

      expect(mockPrisma.staff.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
        })
      );
      expect(result.total).toBe(50);
    });
  });

  describe("findById", () => {
    it("returns staff with relations", async () => {
      const staff = { id: "s1", name: "Alice", accountNumbers: [], signerHistories: [] };
      mockPrisma.staff.findUnique.mockResolvedValue(staff as never);

      const result = await staffRepository.findById("s1");

      expect(mockPrisma.staff.findUnique).toHaveBeenCalledWith({
        where: { id: "s1" },
        include: {
          accountNumbers: true,
          signerHistories: { include: { signer: true } },
        },
      });
      expect(result).toEqual(staff);
    });
  });

  describe("upsertAccountNumber", () => {
    it("upserts with composite key", async () => {
      const acct = { id: "a1", staffId: "s1", accountCode: "1234" };
      mockPrisma.staffAccountNumber.upsert.mockResolvedValue(acct as never);

      await staffRepository.upsertAccountNumber({
        staffId: "s1",
        accountCode: "1234",
        description: "Main",
      });

      expect(mockPrisma.staffAccountNumber.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { staffId_accountCode: { staffId: "s1", accountCode: "1234" } },
          update: expect.objectContaining({ lastUsedAt: expect.any(Date) }),
          create: expect.objectContaining({ staffId: "s1", accountCode: "1234" }),
        })
      );
    });
  });
});
