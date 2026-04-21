import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockFindOperationsSnapshot } = vi.hoisted(() => ({
  mockFindOperationsSnapshot: vi.fn(),
}));

vi.mock("@/domains/analytics/repository", () => ({
  analyticsRepository: {
    findFinanceDocuments: vi.fn(),
    findUsersByIds: vi.fn(),
    findOperationsSnapshot: mockFindOperationsSnapshot,
  },
}));

import { analyticsRepository } from "@/domains/analytics/repository";
import { analyticsService } from "@/domains/analytics/service";

const mockRepo = vi.mocked(analyticsRepository, true);

describe("analyticsService", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockFindOperationsSnapshot.mockReset();
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

    it("builds store operations insights from mirrored sales, inventory, and CopyTech data", async () => {
      const filters = { dateFrom: "2026-01-01", dateTo: "2026-03-31" };

      mockRepo.findFinanceDocuments.mockResolvedValue([] as never);
      mockRepo.findUsersByIds.mockResolvedValue([] as never);
      mockFindOperationsSnapshot.mockResolvedValue({
        salesSummary: {
          revenue: 9450,
          units: 312,
          receipts: 118,
          discountAmount: 210,
        },
        monthlySales: [
          { month: "2026-01", revenue: 2800, units: 92, receipts: 33, discountRate: 0.03 },
          { month: "2026-02", revenue: 3150, units: 101, receipts: 39, discountRate: 0.04 },
          { month: "2026-03", revenue: 3500, units: 119, receipts: 46, discountRate: 0.02 },
        ],
        weekdaySales: [
          { dayOfWeek: 1, revenue: 2200, receipts: 27 },
          { dayOfWeek: 2, revenue: 1800, receipts: 23 },
          { dayOfWeek: 3, revenue: 1450, receipts: 18 },
          { dayOfWeek: 4, revenue: 2600, receipts: 31 },
          { dayOfWeek: 5, revenue: 1400, receipts: 19 },
        ],
        hourlySales: [
          { hour: 12, revenue: 9450, receipts: 118 },
        ],
        topSelling: [
          {
            sku: 101,
            description: "College Algebra",
            department: "Textbooks",
            units: 40,
            revenue: 1280,
            lastSaleDate: "2026-03-28T00:00:00.000Z",
            trendDirection: "accelerating",
          },
        ],
        topRevenue: [
          {
            sku: 404,
            description: "Campus Hoodie",
            department: "Merchandise",
            units: 18,
            revenue: 1620,
            lastSaleDate: "2026-03-25T00:00:00.000Z",
            trendDirection: "steady",
          },
        ],
        acceleratingItems: [
          {
            sku: 101,
            description: "College Algebra",
            department: "Textbooks",
            unitsSold30d: 24,
            unitsSold1y: 120,
            revenue30d: 768,
            firstSaleDate: "2024-08-01T00:00:00.000Z",
            lastSaleDate: "2026-03-28T00:00:00.000Z",
            trendDirection: "accelerating",
          },
        ],
        deceleratingItems: [
          {
            sku: 505,
            description: "Statistics Workbook",
            department: "Textbooks",
            unitsSold30d: 2,
            unitsSold1y: 96,
            revenue30d: 48,
            firstSaleDate: "2024-02-01T00:00:00.000Z",
            lastSaleDate: "2026-02-14T00:00:00.000Z",
            trendDirection: "decelerating",
          },
        ],
        newItems: [
          {
            sku: 909,
            description: "Spring Lab Kit",
            department: "Supplies",
            unitsSold30d: 12,
            unitsSold1y: 12,
            revenue30d: 360,
            firstSaleDate: "2026-03-02T00:00:00.000Z",
            lastSaleDate: "2026-03-27T00:00:00.000Z",
            trendDirection: "accelerating",
          },
        ],
        categoryMix: [
          { category: "Textbooks", revenue: 6120, units: 184 },
          { category: "Merchandise", revenue: 3330, units: 128 },
        ],
        revenueConcentration: {
          topProductShare: 0.17,
          skuCountFor80Percent: 14,
          totalSkuCount: 62,
        },
        inventorySummary: {
          deadStockCost: 1820,
          lowStockHighDemandCount: 2,
          reorderBreachCount: 5,
        },
        reorderBreachesByLocation: [
          { location: "PIER", count: 3 },
          { location: "PCOP", count: 1 },
          { location: "PFS", count: 1 },
        ],
        staleInventoryByLocation: [
          {
            location: "PIER",
            fresh30d: 36,
            stale31To90d: 12,
            stale91To365d: 8,
            staleOver365d: 4,
            neverSold: 2,
          },
        ],
        deadInventory: [
          {
            sku: 808,
            description: "Legacy Lab Manual",
            location: "PIER",
            stockOnHand: 14,
            minStock: 0,
            unitsSold30d: 0,
            stockValue: 700,
            lastSaleDate: "2024-02-15T00:00:00.000Z",
            daysSinceLastSale: 410,
          },
        ],
        slowMovingInventory: [
          {
            sku: 606,
            description: "Biology Apron",
            location: "PCOP",
            stockOnHand: 9,
            minStock: 2,
            unitsSold30d: 0,
            stockValue: 405,
            lastSaleDate: "2025-08-01T00:00:00.000Z",
            daysSinceLastSale: 220,
          },
        ],
        lowStockHighDemand: [
          {
            sku: 101,
            description: "College Algebra",
            location: "PIER",
            stockOnHand: 2,
            minStock: 6,
            unitsSold30d: 24,
            lastSaleDate: "2026-03-28T00:00:00.000Z",
          },
        ],
        copyTechSummary: {
          invoiceRevenue: 2400,
          invoiceCount: 6,
          quoteRevenue: 1800,
          quoteCount: 4,
        },
        copyTechMonthly: [
          { month: "2026-01", invoiceRevenue: 800, quoteRevenue: 500, invoiceCount: 2, quoteCount: 1 },
          { month: "2026-02", invoiceRevenue: 700, quoteRevenue: 650, invoiceCount: 2, quoteCount: 2 },
          { month: "2026-03", invoiceRevenue: 900, quoteRevenue: 650, invoiceCount: 2, quoteCount: 1 },
        ],
        copyTechServiceMix: [
          { service: "COPY", revenue: 900, quantity: 450 },
          { service: "POSTER", revenue: 600, quantity: 22 },
        ],
        copyTechTopRequesters: [
          { name: "Library", revenue: 1300, invoiceCount: 2, quoteCount: 1 },
        ],
        latestSyncRun: {
          startedAt: "2026-03-31T23:10:00.000Z",
          status: "ok",
          txnsAdded: 128,
        },
      } as never);

      const result = await analyticsService.getAnalytics(filters);
      const operations = (result as any).operations;

      expect(mockFindOperationsSnapshot).toHaveBeenCalledWith(filters);
      expect(operations.overview).toMatchObject({
        revenue: 9450,
        units: 312,
        receipts: 118,
        averageBasket: 80.08,
        deadStockCost: 1820,
        lowStockHighDemandCount: 2,
        reorderBreachCount: 5,
        lastSyncStatus: "ok",
      });
      expect(operations.salesPatterns.weekdays[0]).toMatchObject({
        day: "Monday",
        revenue: 2200,
        receipts: 27,
      });
      expect(operations.salesPatterns.hourlyAvailable).toBe(false);
      expect(operations.productPerformance.revenueConcentration).toMatchObject({
        topProductShare: 0.17,
        skuCountFor80Percent: 14,
        totalSkuCount: 62,
        percentOfSkusFor80Percent: 22.6,
      });
      expect(operations.inventoryHealth.lowStockHighDemand[0]).toMatchObject({
        sku: 101,
        location: "PIER",
        stockOnHand: 2,
        minStock: 6,
        unitsSold30d: 24,
      });
      expect(operations.copyTech.monthly[0]).toMatchObject({
        month: "2026-01",
        invoiceRevenue: 800,
        quoteRevenue: 500,
        invoiceCount: 2,
        quoteCount: 1,
      });
      expect(operations.copyTech.limitations).toContain(
        "CopyTech POS sales are not yet mirrored into Supabase, so this section uses LAPortal invoices and print quotes instead.",
      );
      expect(operations.limitations).toContain(
        "Time-of-day traffic is unavailable because the mirrored sales timestamps only resolve to a single effective hour right now.",
      );
    });

    it("keeps operations highlights neutral when the selected range has no mirrored store sales", async () => {
      mockRepo.findFinanceDocuments.mockResolvedValue([] as never);
      mockRepo.findUsersByIds.mockResolvedValue([] as never);
      mockFindOperationsSnapshot.mockResolvedValue(undefined as never);

      const result = await analyticsService.getAnalytics({
        dateFrom: "2026-01-01",
        dateTo: "2026-01-31",
      });
      const operations = (result as any).operations;

      expect(operations.highlights[0]).toMatchObject({
        title: "No mirrored store sales landed in this range",
        tone: "neutral",
      });
      expect(operations.highlights[1]).toMatchObject({
        title: "Revenue concentration needs mirrored sales activity",
        tone: "neutral",
      });
    });
  });
});
