import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/domains/analytics/repository", () => ({
  analyticsRepository: {
    findFinanceDocuments: vi.fn(),
    findUsersByIds: vi.fn(),
  },
}));

import { analyticsRepository } from "@/domains/analytics/repository";
import { analyticsService } from "@/domains/analytics/service";

const mockRepo = vi.mocked(analyticsRepository, true);

describe("analyticsService", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("getAnalytics", () => {
    it("loads finance documents once and resolves user names from creator IDs", async () => {
      const filters = { dateFrom: "2026-01-01", dateTo: "2026-03-31" };

      mockRepo.findFinanceDocuments.mockResolvedValue([] as never);
      mockRepo.findUsersByIds.mockResolvedValue([] as never);

      await analyticsService.getAnalytics(filters);

      expect(mockRepo.findFinanceDocuments).toHaveBeenCalledWith(filters);
      expect(mockRepo.findUsersByIds).toHaveBeenCalledWith([]);
    });

    it("splits finalized and expected totals across summary, months, departments, and users", async () => {
      mockRepo.findFinanceDocuments.mockResolvedValue([
        {
          type: "INVOICE",
          status: "FINAL",
          quoteStatus: null,
          convertedToInvoiceId: null,
          date: new Date("2026-01-10"),
          totalAmount: "500",
          category: "SUPPLIES",
          department: "English",
          createdBy: "u1",
        },
        {
          type: "INVOICE",
          status: "DRAFT",
          quoteStatus: null,
          convertedToInvoiceId: null,
          date: new Date("2026-01-12"),
          totalAmount: "200",
          category: "SUPPLIES",
          department: "English",
          createdBy: "u1",
        },
        {
          type: "INVOICE",
          status: "PENDING_CHARGE",
          quoteStatus: null,
          convertedToInvoiceId: null,
          date: new Date("2026-02-01"),
          totalAmount: "150",
          category: "CATERING",
          department: "Catering",
          createdBy: "u2",
        },
        {
          type: "QUOTE",
          status: "DRAFT",
          quoteStatus: "ACCEPTED",
          convertedToInvoiceId: null,
          date: new Date("2026-02-05"),
          totalAmount: "300",
          category: "CATERING",
          department: "Catering",
          createdBy: "u2",
        },
        {
          type: "QUOTE",
          status: "DRAFT",
          quoteStatus: "SENT",
          convertedToInvoiceId: null,
          date: new Date("2026-02-08"),
          totalAmount: "250",
          category: "COPY_TECH",
          department: "Library",
          createdBy: "u3",
        },
        {
          type: "QUOTE",
          status: "DRAFT",
          quoteStatus: "DECLINED",
          convertedToInvoiceId: null,
          date: new Date("2026-02-10"),
          totalAmount: "999",
          category: "COPY_TECH",
          department: "Library",
          createdBy: "u3",
        },
        {
          type: "QUOTE",
          status: "DRAFT",
          quoteStatus: "ACCEPTED",
          convertedToInvoiceId: "inv-1",
          date: new Date("2026-02-11"),
          totalAmount: "777",
          category: "COPY_TECH",
          department: "Library",
          createdBy: "u3",
        },
      ] as never);
      mockRepo.findUsersByIds.mockResolvedValue([
        { id: "u1", name: "Alice" },
        { id: "u2", name: "Bob" },
        { id: "u3", name: "Carol" },
      ] as never);

      const result = await analyticsService.getAnalytics({});

      expect(result.summary).toEqual({
        count: 5,
        total: 1400,
        finalizedCount: 1,
        finalizedTotal: 500,
        expectedCount: 4,
        expectedTotal: 900,
      });

      expect(result.byMonth).toEqual([
        {
          month: "2026-01",
          count: 2,
          total: 700,
          finalizedCount: 1,
          finalizedTotal: 500,
          expectedCount: 1,
          expectedTotal: 200,
        },
        {
          month: "2026-02",
          count: 3,
          total: 700,
          finalizedCount: 0,
          finalizedTotal: 0,
          expectedCount: 3,
          expectedTotal: 700,
        },
      ]);

      expect(result.byDepartment).toEqual([
        {
          department: "Catering",
          count: 2,
          total: 450,
          finalizedCount: 0,
          finalizedTotal: 0,
          expectedCount: 2,
          expectedTotal: 450,
        },
        {
          department: "English",
          count: 2,
          total: 700,
          finalizedCount: 1,
          finalizedTotal: 500,
          expectedCount: 1,
          expectedTotal: 200,
        },
        {
          department: "Library",
          count: 1,
          total: 250,
          finalizedCount: 0,
          finalizedTotal: 0,
          expectedCount: 1,
          expectedTotal: 250,
        },
      ]);

      expect(result.byUser).toEqual([
        {
          user: "Alice",
          count: 2,
          total: 700,
          finalizedCount: 1,
          finalizedTotal: 500,
          expectedCount: 1,
          expectedTotal: 200,
        },
        {
          user: "Bob",
          count: 2,
          total: 450,
          finalizedCount: 0,
          finalizedTotal: 0,
          expectedCount: 2,
          expectedTotal: 450,
        },
        {
          user: "Carol",
          count: 1,
          total: 250,
          finalizedCount: 0,
          finalizedTotal: 0,
          expectedCount: 1,
          expectedTotal: 250,
        },
      ]);

      expect(result.byCategory).toEqual([
        {
          category: "SUPPLIES",
          count: 2,
          total: 700,
          finalizedCount: 1,
          finalizedTotal: 500,
          expectedCount: 1,
          expectedTotal: 200,
        },
        {
          category: "CATERING",
          count: 2,
          total: 450,
          finalizedCount: 0,
          finalizedTotal: 0,
          expectedCount: 2,
          expectedTotal: 450,
        },
        {
          category: "COPY_TECH",
          count: 1,
          total: 250,
          finalizedCount: 0,
          finalizedTotal: 0,
          expectedCount: 1,
          expectedTotal: 250,
        },
      ]);

      expect(result.trend).toEqual([
        { month: "2026-01", count: 2, finalizedCount: 1, expectedCount: 1 },
        { month: "2026-02", count: 3, finalizedCount: 0, expectedCount: 3 },
      ]);
    });

    it("falls back to Unknown when a creator cannot be resolved", async () => {
      mockRepo.findFinanceDocuments.mockResolvedValue([
        {
          type: "QUOTE",
          status: "DRAFT",
          quoteStatus: "SENT",
          convertedToInvoiceId: null,
          date: new Date("2026-03-15"),
          totalAmount: "300",
          category: "COPY_TECH",
          department: "English",
          createdBy: "u-missing",
        },
      ] as never);
      mockRepo.findUsersByIds.mockResolvedValue([] as never);

      const result = await analyticsService.getAnalytics({});

      expect(result.byUser).toEqual([
        {
          user: "Unknown",
          count: 1,
          total: 300,
          finalizedCount: 0,
          finalizedTotal: 0,
          expectedCount: 1,
          expectedTotal: 300,
        },
      ]);
    });
  });
});
