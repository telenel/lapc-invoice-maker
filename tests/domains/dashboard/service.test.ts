import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}), { virtual: true });

vi.mock("@/lib/prisma", () => ({
  prisma: {
    invoice: {
      count: vi.fn(),
      aggregate: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/domains/calendar/service", () => ({
  listCalendarEventsForRange: vi.fn(),
}));

vi.mock("@/domains/follow-up/repository", () => ({
  followUpRepository: {
    getPendingAccountsSummary: vi.fn(),
  },
}));

vi.mock("@/domains/follow-up/service", () => ({
  followUpService: {
    getBadgeStatesForInvoices: vi.fn(),
  },
}));

vi.mock("@/domains/invoice/service", () => ({
  invoiceService: {
    getStats: vi.fn(),
    getCreatorStats: vi.fn(),
  },
}));

vi.mock("@/domains/quote/repository", () => ({
  countPaymentReminderAttemptsByInvoiceIds: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { listCalendarEventsForRange } from "@/domains/calendar/service";
import { followUpRepository } from "@/domains/follow-up/repository";
import { followUpService } from "@/domains/follow-up/service";
import { invoiceService } from "@/domains/invoice/service";
import { countPaymentReminderAttemptsByInvoiceIds } from "@/domains/quote/repository";
import { getDashboardBootstrapData } from "@/domains/dashboard/service";

const mockPrisma = vi.mocked(prisma, true);
const mockListCalendarEventsForRange = vi.mocked(listCalendarEventsForRange);
const mockFollowUpRepository = vi.mocked(followUpRepository, true);
const mockFollowUpService = vi.mocked(followUpService, true);
const mockInvoiceService = vi.mocked(invoiceService, true);
const mockCountPaymentReminderAttemptsByInvoiceIds = vi.mocked(countPaymentReminderAttemptsByInvoiceIds);

describe("dashboard service", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockListCalendarEventsForRange.mockResolvedValue([] as never);
    mockFollowUpRepository.getPendingAccountsSummary.mockResolvedValue([] as never);
    mockFollowUpService.getBadgeStatesForInvoices.mockResolvedValue({} as never);
    mockCountPaymentReminderAttemptsByInvoiceIds.mockResolvedValue({} as never);

    mockInvoiceService.getStats
      .mockResolvedValueOnce({ total: 3, sumTotalAmount: 1000 } as never)
      .mockResolvedValueOnce({ total: 2, sumTotalAmount: 800 } as never);
    mockInvoiceService.getCreatorStats.mockResolvedValue({ users: [] } as never);

    mockPrisma.invoice.count
      .mockResolvedValueOnce(0 as never)
      .mockResolvedValueOnce(0 as never)
      .mockResolvedValueOnce(0 as never);

    mockPrisma.invoice.aggregate
      .mockResolvedValueOnce({
        _sum: { totalAmount: "0" },
        _count: { _all: 0 },
      } as never)
      .mockResolvedValueOnce({
        _sum: { totalAmount: "0" },
        _count: { _all: 0 },
      } as never)
      .mockResolvedValueOnce({
        _sum: { totalAmount: "650" },
        _count: { _all: 2 },
      } as never);

    mockPrisma.invoice.findMany
      .mockResolvedValueOnce([
        {
          id: "inv-1",
          createdBy: "user-1",
          department: "Catering",
          totalAmount: "240",
          runningTitle: "Denise Robb lunch",
          status: "DRAFT",
          creator: { name: "Marcos" },
          staff: { name: "Denise Robb" },
          contact: null,
          items: [{ description: "Lunch service" }],
          _count: { items: 1 },
        },
      ] as never)
      .mockResolvedValueOnce([] as never);
  });

  it("excludes archived records from focus data counts", async () => {
    await getDashboardBootstrapData("user-1");

    // count is called 3 times: myDrafts, myRunning, myQuotesAwaitingResponse
    for (const call of mockPrisma.invoice.count.mock.calls) {
      expect(call[0]).toMatchObject({
        where: expect.objectContaining({ archivedAt: null }),
      });
    }
  });

  it("excludes archived records from focus data aggregates", async () => {
    await getDashboardBootstrapData("user-1");

    // aggregate calls [0] and [1] are thisMonthFinal and lastMonthFinal from focus data
    for (const i of [0, 1]) {
      expect(mockPrisma.invoice.aggregate.mock.calls[i]?.[0]).toMatchObject({
        where: expect.objectContaining({ archivedAt: null }),
      });
    }
  });

  it("excludes archived records from expected pipeline totals", async () => {
    await getDashboardBootstrapData("user-1");

    // aggregate call [2] is expectedOpen from getDashboardStatsData (uses buildExpectedFinanceWhere)
    expect(mockPrisma.invoice.aggregate.mock.calls[2]?.[0]).toMatchObject({
      where: expect.objectContaining({ archivedAt: null }),
    });
  });

  it("excludes archived records from running invoices", async () => {
    await getDashboardBootstrapData("user-1");

    // findMany[0] is the running invoices query
    expect(mockPrisma.invoice.findMany.mock.calls[0]?.[0]).toMatchObject({
      where: expect.objectContaining({ archivedAt: null }),
    });
  });

  it("excludes archived records from recent activity", async () => {
    await getDashboardBootstrapData("user-1");

    // findMany is called twice: first for running invoices, second for recent activity
    const recentActivityCall = mockPrisma.invoice.findMany.mock.calls[1]?.[0];
    expect(recentActivityCall).toMatchObject({
      where: expect.objectContaining({
        archivedAt: null,
      }),
    });
  });

  it("includes expected pipeline totals and scopes running invoices to the current user", async () => {
    const result = await getDashboardBootstrapData("user-1");

    expect(result.stats.summary).toMatchObject({
      invoicesThisMonth: 3,
      totalThisMonth: 1000,
      invoicesLastMonth: 2,
      totalLastMonth: 800,
      expectedCount: 2,
      expectedTotal: 650,
    });

    expect(mockPrisma.invoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          type: "INVOICE",
          createdBy: "user-1",
        }),
      }),
    );

    expect(result.runningInvoices).toEqual([
      expect.objectContaining({
        id: "inv-1",
        requestorName: "Denise Robb",
        detail: "Denise Robb lunch",
      }),
    ]);
  });
});
