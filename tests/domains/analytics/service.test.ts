// tests/domains/analytics/service.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/domains/analytics/repository", () => ({
  analyticsRepository: {
    groupByCategory: vi.fn(),
    groupByDepartment: vi.fn(),
    findInvoicesForMonthly: vi.fn(),
    groupByUser: vi.fn(),
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
    it("calls all repository methods with the provided filters", async () => {
      const filters = { dateFrom: "2026-01-01", dateTo: "2026-03-31" };

      mockRepo.groupByCategory.mockResolvedValue([] as never);
      mockRepo.groupByDepartment.mockResolvedValue([] as never);
      mockRepo.findInvoicesForMonthly.mockResolvedValue([] as never);
      mockRepo.groupByUser.mockResolvedValue([] as never);
      mockRepo.findUsersByIds.mockResolvedValue([] as never);

      await analyticsService.getAnalytics(filters);

      expect(mockRepo.groupByCategory).toHaveBeenCalledWith(filters);
      expect(mockRepo.groupByDepartment).toHaveBeenCalledWith(filters);
      expect(mockRepo.findInvoicesForMonthly).toHaveBeenCalledWith(filters);
      expect(mockRepo.groupByUser).toHaveBeenCalledWith(filters);
    });

    it("aggregates invoices into byMonth and trend grouped by YYYY-MM", async () => {
      mockRepo.groupByCategory.mockResolvedValue([] as never);
      mockRepo.groupByDepartment.mockResolvedValue([] as never);
      mockRepo.findInvoicesForMonthly.mockResolvedValue([
        { date: new Date("2026-01-10"), totalAmount: "500" },
        { date: new Date("2026-01-25"), totalAmount: "300" },
        { date: new Date("2026-02-05"), totalAmount: "200" },
      ] as never);
      mockRepo.groupByUser.mockResolvedValue([] as never);
      mockRepo.findUsersByIds.mockResolvedValue([] as never);

      const result = await analyticsService.getAnalytics({});

      expect(result.byMonth).toHaveLength(2);
      expect(result.byMonth[0]).toEqual({ month: "2026-01", count: 2, total: 800 });
      expect(result.byMonth[1]).toEqual({ month: "2026-02", count: 1, total: 200 });

      expect(result.trend).toHaveLength(2);
      expect(result.trend[0]).toEqual({ month: "2026-01", count: 2 });
      expect(result.trend[1]).toEqual({ month: "2026-02", count: 1 });
    });

    it("maps user IDs to names in byUser, falling back to Unknown", async () => {
      mockRepo.groupByCategory.mockResolvedValue([] as never);
      mockRepo.groupByDepartment.mockResolvedValue([] as never);
      mockRepo.findInvoicesForMonthly.mockResolvedValue([] as never);
      mockRepo.groupByUser.mockResolvedValue([
        { createdBy: "u1", _count: 3, _sum: { totalAmount: "900" } },
        { createdBy: "u2", _count: 1, _sum: { totalAmount: "100" } },
        { createdBy: "u-ghost", _count: 2, _sum: { totalAmount: "400" } },
      ] as never);
      mockRepo.findUsersByIds.mockResolvedValue([
        { id: "u1", name: "Alice" },
        { id: "u2", name: "Bob" },
      ] as never);

      const result = await analyticsService.getAnalytics({});

      // byUser is sorted by total descending
      expect(result.byUser).toEqual([
        { user: "Alice", count: 3, total: 900 },
        { user: "Unknown", count: 2, total: 400 },
        { user: "Bob", count: 1, total: 100 },
      ]);

      expect(mockRepo.findUsersByIds).toHaveBeenCalledWith(["u1", "u2", "u-ghost"]);
    });

    it("returns a response with all expected fields populated", async () => {
      mockRepo.groupByCategory.mockResolvedValue([
        { category: "AV", _count: 5, _sum: { totalAmount: "1500" } },
      ] as never);
      mockRepo.groupByDepartment.mockResolvedValue([
        { department: "English", _count: 2, _sum: { totalAmount: "600" } },
      ] as never);
      mockRepo.findInvoicesForMonthly.mockResolvedValue([
        { date: new Date("2026-03-15"), totalAmount: "300" },
      ] as never);
      mockRepo.groupByUser.mockResolvedValue([
        { createdBy: "u1", _count: 1, _sum: { totalAmount: "300" } },
      ] as never);
      mockRepo.findUsersByIds.mockResolvedValue([
        { id: "u1", name: "Carol" },
      ] as never);

      const result = await analyticsService.getAnalytics({});

      expect(result).toMatchObject({
        byCategory: [{ category: "AV", count: 5, total: 1500 }],
        byDepartment: [{ department: "English", count: 2, total: 600 }],
        byMonth: [{ month: "2026-03", count: 1, total: 300 }],
        trend: [{ month: "2026-03", count: 1 }],
        byUser: [{ user: "Carol", count: 1, total: 300 }],
      });
    });
  });
});
