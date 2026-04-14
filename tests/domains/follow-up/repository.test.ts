// tests/domains/follow-up/repository.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    followUp: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    $transaction: vi.fn((fn: (tx: unknown) => unknown) =>
      fn({
        followUp: {
          findFirst: vi.fn(),
          findMany: vi.fn(),
          create: vi.fn(),
          update: vi.fn(),
          updateMany: vi.fn(),
          deleteMany: vi.fn(),
          count: vi.fn(),
        },
        invoice: { findUnique: vi.fn(), update: vi.fn() },
        $queryRaw: vi.fn(),
      }),
    ),
  },
}));

import { followUpRepository } from "@/domains/follow-up/repository";

describe("followUpRepository", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("findActiveSeriesByInvoiceId", () => {
    it("should query for ACTIVE series by invoiceId", async () => {
      const { prisma } = await import("@/lib/prisma");
      (prisma.followUp.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        null,
      );
      const result =
        await followUpRepository.findActiveSeriesByInvoiceId("inv-1");
      expect(prisma.followUp.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            invoiceId: "inv-1",
            seriesStatus: "ACTIVE",
            type: expect.objectContaining({ in: expect.any(Array) }),
            invoice: { is: { archivedAt: null } },
          }),
        }),
      );
      expect(result).toBeNull();
    });
  });

  describe("getLatestFollowUpForInvoice", () => {
    it("should return the latest follow-up row for badge computation", async () => {
      const { prisma } = await import("@/lib/prisma");
      const mockRow = {
        id: "fu-1",
        seriesStatus: "ACTIVE",
        maxAttempts: 5,
        metadata: { attempt: 2 },
      };
      (prisma.followUp.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockRow,
      );
      const result =
        await followUpRepository.getLatestFollowUpForInvoice("inv-1");
      expect(result).toEqual(mockRow);
    });
  });

  describe("getFollowUpBadgesForInvoices", () => {
    it("should return empty array for empty invoiceIds", async () => {
      const result =
        await followUpRepository.getFollowUpBadgesForInvoices([]);
      expect(result).toEqual([]);
    });

    it("should query with distinct invoiceId for badge data", async () => {
      const { prisma } = await import("@/lib/prisma");
      const mockRows = [
        { id: "fu-1", invoiceId: "inv-1", seriesStatus: "ACTIVE" },
        { id: "fu-2", invoiceId: "inv-2", seriesStatus: "EXHAUSTED" },
      ];
      (
        prisma.followUp.findMany as ReturnType<typeof vi.fn>
      ).mockResolvedValue(mockRows);
      const result = await followUpRepository.getFollowUpBadgesForInvoices([
        "inv-1",
        "inv-2",
      ]);
      expect(result).toEqual(mockRows);
      expect(prisma.followUp.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            invoiceId: { in: ["inv-1", "inv-2"] },
            seriesStatus: { in: ["ACTIVE", "EXHAUSTED"] },
            invoice: { is: { archivedAt: null } },
          }),
          distinct: ["invoiceId"],
        }),
      );
    });
  });

  describe("findByShareToken", () => {
    it("should query by shareToken with invoice include", async () => {
      const { prisma } = await import("@/lib/prisma");
      const mockRow = {
        id: "fu-1",
        shareToken: "tok-abc",
        invoice: { id: "inv-1", invoiceNumber: "AG-001" },
      };
      (prisma.followUp.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockRow,
      );
      const result = await followUpRepository.findByShareToken("tok-abc");
      expect(result).toEqual(mockRow);
      expect(prisma.followUp.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            shareToken: "tok-abc",
            invoice: { is: { archivedAt: null } },
          },
          include: expect.objectContaining({
            invoice: expect.any(Object),
          }),
        }),
      );
    });
  });

  describe("countAttempts", () => {
    it("should count only ACCOUNT_FOLLOWUP rows in the series", async () => {
      const { prisma } = await import("@/lib/prisma");
      (prisma.followUp.count as ReturnType<typeof vi.fn>).mockResolvedValue(3);
      const result = await followUpRepository.countAttempts("series-1");
      expect(result).toBe(3);
      expect(prisma.followUp.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { seriesId: "series-1", type: "ACCOUNT_FOLLOWUP" },
        }),
      );
    });
  });

  describe("markSeriesStatus", () => {
    it("should update all rows in the series", async () => {
      const { prisma } = await import("@/lib/prisma");
      (
        prisma.followUp.updateMany as ReturnType<typeof vi.fn>
      ).mockResolvedValue({ count: 3 });
      await followUpRepository.markSeriesStatus("series-1", "COMPLETED");
      expect(prisma.followUp.updateMany).toHaveBeenCalledWith({
        where: { seriesId: "series-1" },
        data: { seriesStatus: "COMPLETED" },
      });
    });
  });

  describe("createClaimRow", () => {
    it("should create a claim row with shareToken on first attempt", async () => {
      const { prisma } = await import("@/lib/prisma");
      const mockCreated = { id: "fu-new" };
      (prisma.followUp.create as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockCreated,
      );
      const result = await followUpRepository.createClaimRow({
        invoiceId: "inv-1",
        seriesId: "series-1",
        shareToken: "tok-abc",
        recipientEmail: "test@example.com",
        subject: "Account needed",
        maxAttempts: 5,
        attempt: 1,
      });
      expect(result).toEqual(mockCreated);
      expect(prisma.followUp.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            invoiceId: "inv-1",
            type: "ACCOUNT_FOLLOWUP_CLAIM",
            shareToken: "tok-abc",
            seriesStatus: "ACTIVE",
            metadata: { attempt: 1 },
            sentAt: expect.any(Date),
          }),
        }),
      );
    });

    it("should omit shareToken on subsequent attempts", async () => {
      const { prisma } = await import("@/lib/prisma");
      (prisma.followUp.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "fu-new",
      });
      await followUpRepository.createClaimRow({
        invoiceId: "inv-1",
        seriesId: "series-1",
        shareToken: "tok-abc",
        recipientEmail: "test@example.com",
        subject: "Reminder",
        maxAttempts: 5,
        attempt: 2,
      });
      expect(prisma.followUp.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            shareToken: undefined,
            metadata: { attempt: 2 },
          }),
        }),
      );
    });
  });

  describe("promoteClaimRow", () => {
    it("should update type to ACCOUNT_FOLLOWUP and set sentAt", async () => {
      const { prisma } = await import("@/lib/prisma");
      const mockUpdated = { id: "fu-1", type: "ACCOUNT_FOLLOWUP" };
      (prisma.followUp.update as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockUpdated,
      );
      const result = await followUpRepository.promoteClaimRow("fu-1");
      expect(result).toEqual(mockUpdated);
      expect(prisma.followUp.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "fu-1" },
          data: expect.objectContaining({
            type: "ACCOUNT_FOLLOWUP",
            sentAt: expect.any(Date),
          }),
        }),
      );
    });
  });

  describe("deleteClaimRow", () => {
    it("should delete and swallow errors", async () => {
      const { prisma } = await import("@/lib/prisma");
      (prisma.followUp.delete as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("not found"),
      );
      await expect(
        followUpRepository.deleteClaimRow("fu-missing"),
      ).resolves.toBeUndefined();
    });
  });

  describe("deleteStaleClaimsForSeries", () => {
    it("should delete claim rows older than threshold", async () => {
      const { prisma } = await import("@/lib/prisma");
      const threshold = new Date("2026-01-01");
      (
        prisma.followUp.deleteMany as ReturnType<typeof vi.fn>
      ).mockResolvedValue({ count: 2 });
      await followUpRepository.deleteStaleClaimsForSeries(
        "series-1",
        threshold,
      );
      expect(prisma.followUp.deleteMany).toHaveBeenCalledWith({
        where: {
          seriesId: "series-1",
          type: "ACCOUNT_FOLLOWUP_CLAIM",
          sentAt: { lt: threshold },
        },
      });
    });
  });

  describe("findFreshClaimForSeries", () => {
    it("should find claim rows newer than threshold", async () => {
      const { prisma } = await import("@/lib/prisma");
      const threshold = new Date("2026-04-06");
      const mockClaim = { id: "fu-claim", type: "ACCOUNT_FOLLOWUP_CLAIM" };
      (prisma.followUp.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockClaim,
      );
      const result = await followUpRepository.findFreshClaimForSeries(
        "series-1",
        threshold,
      );
      expect(result).toEqual(mockClaim);
      expect(prisma.followUp.findFirst).toHaveBeenCalledWith({
        where: {
          seriesId: "series-1",
          type: "ACCOUNT_FOLLOWUP_CLAIM",
          sentAt: { gte: threshold },
        },
      });
    });
  });

  describe("findAllActiveSeries", () => {
    it("should return distinct active series with invoice data", async () => {
      const { prisma } = await import("@/lib/prisma");
      const mockRows = [
        {
          id: "fu-1",
          seriesId: "s-1",
          seriesStatus: "ACTIVE",
          invoice: { id: "inv-1" },
        },
      ];
      (
        prisma.followUp.findMany as ReturnType<typeof vi.fn>
      ).mockResolvedValue(mockRows);
      const result = await followUpRepository.findAllActiveSeries();
      expect(result).toEqual(mockRows);
      expect(prisma.followUp.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            seriesStatus: "ACTIVE",
            invoice: { is: { archivedAt: null } },
          }),
          distinct: ["seriesId"],
          include: expect.objectContaining({
            invoice: expect.any(Object),
          }),
        }),
      );
    });
  });

  describe("getPendingAccountsCount", () => {
    it("should return count of distinct pending series", async () => {
      const { prisma } = await import("@/lib/prisma");
      (
        prisma.followUp.findMany as ReturnType<typeof vi.fn>
      ).mockResolvedValue([
        { seriesId: "s-1" },
        { seriesId: "s-2" },
        { seriesId: "s-3" },
      ]);
      const result = await followUpRepository.getPendingAccountsCount();
      expect(result).toBe(3);
    });
  });

  describe("getPendingAccountsSummary", () => {
    it("should return distinct pending series with invoice details", async () => {
      const { prisma } = await import("@/lib/prisma");
      const mockRows = [
        {
          seriesId: "s-1",
          seriesStatus: "ACTIVE",
          invoice: { id: "inv-1", creator: { name: "Test" } },
        },
      ];
      (
        prisma.followUp.findMany as ReturnType<typeof vi.fn>
      ).mockResolvedValue(mockRows);
      const result = await followUpRepository.getPendingAccountsSummary();
      expect(result).toEqual(mockRows);
      expect(prisma.followUp.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            seriesStatus: { in: ["ACTIVE", "EXHAUSTED"] },
            invoice: { is: { archivedAt: null } },
          }),
          distinct: ["seriesId"],
          include: expect.objectContaining({
            invoice: expect.any(Object),
          }),
        }),
      );
    });
  });
});
