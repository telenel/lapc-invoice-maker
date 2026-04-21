import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  pushMock,
  searchParamsMock,
  invoiceListMock,
  creatorStatsMock,
  quoteListMock,
  badgeStatesMock,
  staffListPaginatedMock,
  quickPicksListMock,
  getDistinctYearsMock,
} = vi.hoisted(() => ({
  pushMock: vi.fn(),
  searchParamsMock: new URLSearchParams(),
  invoiceListMock: vi.fn(),
  creatorStatsMock: vi.fn(),
  quoteListMock: vi.fn(),
  badgeStatesMock: vi.fn(),
  staffListPaginatedMock: vi.fn(),
  quickPicksListMock: vi.fn(),
  getDistinctYearsMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  useSearchParams: () => searchParamsMock,
}));

vi.mock("next-auth/react", () => ({
  useSession: () => ({
    status: "authenticated",
    data: {
      user: {
        id: "admin-1",
        role: "admin",
      },
    },
  }),
}));

vi.mock("next/dynamic", () => ({
  default: () => () => <div data-testid="dynamic-chart" />,
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock("@/lib/use-sse", () => ({
  useSSE: vi.fn(),
}));

vi.mock("@/domains/invoice/api-client", () => ({
  invoiceApi: {
    list: invoiceListMock,
    getCreatorStats: creatorStatsMock,
  },
}));

vi.mock("@/domains/quote/api-client", () => ({
  quoteApi: {
    list: quoteListMock,
  },
}));

vi.mock("@/domains/follow-up/api-client", () => ({
  followUpApi: {
    getBadgeStatesForInvoices: badgeStatesMock,
  },
}));

vi.mock("@/domains/staff/api-client", () => ({
  staffApi: {
    listPaginated: staffListPaginatedMock,
    delete: vi.fn(),
  },
}));

vi.mock("@/domains/quick-picks/api-client", () => ({
  quickPicksApi: {
    list: quickPicksListMock,
    delete: vi.fn(),
  },
}));

vi.mock("@/domains/textbook-requisition/api-client", () => ({
  requisitionApi: {
    getDistinctYears: getDistinctYearsMock,
    exportCsv: vi.fn(),
  },
}));

vi.mock("@/components/invoices/invoice-filters", () => ({
  InvoiceFiltersBar: () => <div>invoice filters</div>,
}));

vi.mock("@/components/quotes/quote-filters", () => ({
  QuoteFiltersBar: () => <div>quote filters</div>,
}));

vi.mock("@/components/follow-up/follow-up-badge", () => ({
  FollowUpBadge: ({ state }: { state?: { currentAttempt: number; maxAttempts: number } | null }) =>
    state ? <span>{`Follow Up ${state.currentAttempt}/${state.maxAttempts}`}</span> : null,
}));

vi.mock("@/components/follow-up/bulk-request-dialog", () => ({
  BulkRequestDialog: () => null,
}));

vi.mock("@/components/staff/staff-form", () => ({
  StaffForm: ({ trigger }: { trigger: ReactNode }) => <>{trigger}</>,
}));

vi.mock("@/components/quick-picks/quick-pick-form", () => ({
  QuickPickForm: ({ trigger }: { trigger: ReactNode }) => <>{trigger}</>,
}));

import { InvoiceTable } from "@/components/invoices/invoice-table";
import { QuoteTable } from "@/components/quotes/quote-table";
import { StaffTable } from "@/components/staff/staff-table";
import { QuickPickTable } from "@/components/quick-picks/quick-pick-table";
import { AnalyticsDashboard } from "@/components/analytics/analytics-dashboard";
import { RequisitionFilters } from "@/components/textbook-requisitions/requisition-filters";
import type { OperationsAnalytics } from "@/domains/analytics/types";

const bootstrapOperationsData: OperationsAnalytics = {
  overview: {
    revenue: 9450,
    units: 312,
    receipts: 118,
    averageBasket: 80.08,
    deadStockCost: 1820,
    lowStockHighDemandCount: 2,
    reorderBreachCount: 5,
    lastSyncStartedAt: "2026-03-31T23:10:00.000Z",
    lastSyncStatus: "ok",
    txnsAdded: 128,
  },
  highlights: [
    {
      title: "Thursday carries the heaviest store traffic",
      detail: "Thursday produced the most receipts in this range.",
      tone: "warning",
    },
  ],
  salesPatterns: {
    monthly: [
      { month: "2026-01", revenue: 2800, units: 92, receipts: 33, discountRate: 0.03 },
    ],
    weekdays: [
      { day: "Thursday", revenue: 2600, receipts: 31 },
    ],
    hourly: [],
    hourlyAvailable: false,
    hourlyFallbackMessage: "Time-of-day traffic is unavailable because the mirrored sales timestamps only resolve to a single effective hour right now.",
  },
  productPerformance: {
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
    accelerating: [],
    decelerating: [],
    newItems: [],
    categoryMix: [
      { category: "Textbooks", revenue: 6120, units: 184 },
    ],
    revenueConcentration: {
      topProductShare: 0.17,
      skuCountFor80Percent: 14,
      totalSkuCount: 62,
      percentOfSkusFor80Percent: 22.6,
    },
  },
  inventoryHealth: {
    deadStockCost: 1820,
    lowStockHighDemandCount: 2,
    reorderBreachesByLocation: [
      { location: "PIER", count: 3 },
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
    deadInventory: [],
    slowMoving: [],
    lowStockHighDemand: [],
  },
  copyTech: {
    summary: {
      invoiceRevenue: 2400,
      quoteRevenue: 1800,
      invoiceCount: 6,
      quoteCount: 4,
    },
    monthly: [
      { month: "2026-01", invoiceRevenue: 800, quoteRevenue: 500, invoiceCount: 2, quoteCount: 1 },
    ],
    serviceMix: [
      { service: "COPY", revenue: 900, quantity: 450 },
    ],
    topRequesters: [
      { name: "Library", revenue: 1300, invoiceCount: 2, quoteCount: 1 },
    ],
    limitations: [
      "CopyTech POS sales are not yet mirrored into Supabase, so this section uses LAPortal invoices and print quotes instead.",
    ],
  },
  limitations: [
    "Store sales trends reflect the mirrored Pierce POS feed only.",
  ],
};

describe("Main Nav Page Bootstraps", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders invoice bootstrap data without refetching list or badges", () => {
    render(
      <InvoiceTable
        departments={["CopyTech"]}
        categories={[]}
        initialRequest={{ page: 1, pageSize: 20, sortBy: "date", sortOrder: "desc" }}
        initialData={{
          invoices: [
            {
              id: "inv-1",
              invoiceNumber: "INV-001",
              date: "2026-04-12T00:00:00.000Z",
              status: "DRAFT",
              type: "INVOICE",
              department: "CopyTech",
              category: "print",
              accountCode: "",
              accountNumber: "",
              approvalChain: [],
              notes: "",
              totalAmount: 125,
              isRecurring: false,
              recurringInterval: null,
              recurringEmail: null,
              isRunning: false,
              runningTitle: null,
              pdfPath: null,
              pdfMetadata: null,
              prismcorePath: null,
              marginEnabled: false,
              marginPercent: null,
              taxEnabled: false,
              taxRate: 0,
              isCateringEvent: false,
              cateringDetails: null,
              createdAt: "2026-04-12T00:00:00.000Z",
              staff: {
                id: "staff-1",
                name: "Jane Doe",
                title: "Manager",
                department: "CopyTech",
                extension: null,
                email: null,
              },
              contact: null,
              creatorId: "user-1",
              creatorName: "Mia",
              items: [],
            },
          ],
          total: 1,
          page: 1,
          pageSize: 20,
        }}
        initialBadgeStates={{}}
      />,
    );

    expect(screen.getAllByText(/INV-001/i)).toHaveLength(2);
    expect(invoiceListMock).not.toHaveBeenCalled();
    expect(badgeStatesMock).not.toHaveBeenCalled();
  });

  it("renders quote bootstrap data without refetching", () => {
    render(
      <QuoteTable
        departments={["CopyTech"]}
        categories={[]}
        initialRequest={{ page: 1, pageSize: 20, sortBy: "createdAt", sortOrder: "desc" }}
        initialData={{
          quotes: [
            {
              id: "quote-1",
              quoteNumber: "Q-001",
              quoteStatus: "ACCEPTED",
              date: "2026-04-12T00:00:00.000Z",
              expirationDate: "2026-04-30T00:00:00.000Z",
              type: "QUOTE",
              department: "CopyTech",
              category: "print",
              accountCode: "",
              accountNumber: "",
              approvalChain: [],
              notes: "",
              totalAmount: 240,
              recipientName: "Alex Client",
              recipientEmail: "alex@example.com",
              recipientOrg: "Pierce",
              pdfPath: null,
              shareToken: null,
              createdAt: "2026-04-12T00:00:00.000Z",
              staff: null,
              contact: null,
              creatorId: "user-1",
              creatorName: "Mia",
              items: [],
              isCateringEvent: false,
              cateringDetails: null,
              marginEnabled: false,
              marginPercent: null,
              taxEnabled: false,
              taxRate: 0,
              paymentMethod: null,
              paymentAccountNumber: null,
              paymentDetailsResolved: false,
              paymentFollowUpBadge: {
                seriesStatus: "ACTIVE",
                currentAttempt: 1,
                maxAttempts: 5,
              },
              convertedToInvoice: null,
              revisedFromQuote: null,
              revisedToQuote: null,
            },
          ],
          total: 1,
          page: 1,
          pageSize: 20,
        }}
        initialBadgeStates={{}}
      />,
    );

    expect(screen.getAllByText(/Q-001/i)).toHaveLength(2);
    expect(screen.getAllByText("Accepted")).toHaveLength(2);
    expect(screen.getAllByText("Follow Up 1/5")).toHaveLength(2);
    expect(quoteListMock).not.toHaveBeenCalled();
  });

  it("renders staff bootstrap data without refetching the first page", () => {
    render(
      <StaffTable
        initialData={{
          data: [
            {
              id: "staff-1",
              name: "Jane Doe",
              title: "Coordinator",
              department: "Bookstore",
              accountCode: "A-1",
              extension: "1234",
              email: "jane@example.com",
              phone: "",
              birthMonth: null,
              birthDay: null,
              approvalChain: [],
              active: true,
            },
          ],
          total: 1,
          page: 1,
          pageSize: 20,
        }}
      />,
    );

    expect(screen.getAllByText(/Jane Doe/i)).toHaveLength(2);
    expect(staffListPaginatedMock).not.toHaveBeenCalled();
  });

  it("renders quick picks from bootstrap data without refetching", () => {
    render(
      <QuickPickTable
        initialItems={[
          {
            id: "qp-1",
            description: "Coffee Service",
            department: "__ALL__",
            defaultPrice: 55,
            usageCount: 7,
          },
        ]}
      />,
    );

    expect(screen.getAllByText(/Coffee Service/i)).toHaveLength(2);
    expect(quickPicksListMock).not.toHaveBeenCalled();
  });

  it("renders analytics bootstrap data without fetching on mount", () => {
    render(
      <AnalyticsDashboard
        initialDateFrom="2025-04-12"
        initialDateTo="2026-04-12"
        initialData={{
          summary: {
            count: 3,
            total: 180,
            finalizedCount: 1,
            finalizedTotal: 60,
            expectedCount: 2,
            expectedTotal: 120,
          },
          byCategory: [{
            category: "Print",
            count: 3,
            total: 180,
            finalizedCount: 1,
            finalizedTotal: 60,
            expectedCount: 2,
            expectedTotal: 120,
          }],
          byMonth: [{
            month: "2026-04",
            count: 3,
            total: 180,
            finalizedCount: 1,
            finalizedTotal: 60,
            expectedCount: 2,
            expectedTotal: 120,
          }],
          byDepartment: [{
            department: "Bookstore",
            count: 3,
            total: 180,
            finalizedCount: 1,
            finalizedTotal: 60,
            expectedCount: 2,
            expectedTotal: 120,
          }],
          trend: [{ month: "2026-04", count: 3, finalizedCount: 1, expectedCount: 2 }],
          byUser: [{
            user: "Mia",
            count: 3,
            total: 180,
            finalizedCount: 1,
            finalizedTotal: 60,
            expectedCount: 2,
            expectedTotal: 120,
          }],
          operations: bootstrapOperationsData,
        }}
      />,
    );

    expect(screen.getByRole("heading", { name: /Analytics/i })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("renders an operations tab from bootstrap data without fetching on mount", () => {
    render(
      <AnalyticsDashboard
        initialDateFrom="2025-04-12"
        initialDateTo="2026-04-12"
        initialData={{
          summary: {
            count: 3,
            total: 180,
            finalizedCount: 1,
            finalizedTotal: 60,
            expectedCount: 2,
            expectedTotal: 120,
          },
          byCategory: [{
            category: "Print",
            count: 3,
            total: 180,
            finalizedCount: 1,
            finalizedTotal: 60,
            expectedCount: 2,
            expectedTotal: 120,
          }],
          byMonth: [{
            month: "2026-04",
            count: 3,
            total: 180,
            finalizedCount: 1,
            finalizedTotal: 60,
            expectedCount: 2,
            expectedTotal: 120,
          }],
          byDepartment: [{
            department: "Bookstore",
            count: 3,
            total: 180,
            finalizedCount: 1,
            finalizedTotal: 60,
            expectedCount: 2,
            expectedTotal: 120,
          }],
          trend: [{ month: "2026-04", count: 3, finalizedCount: 1, expectedCount: 2 }],
          byUser: [{
            user: "Mia",
            count: 3,
            total: 180,
            finalizedCount: 1,
            finalizedTotal: 60,
            expectedCount: 2,
            expectedTotal: 120,
          }],
          operations: bootstrapOperationsData,
        }}
      />,
    );

    expect(screen.getByRole("tab", { name: /Operations/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Monthly CopyTech trend/i })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reuses bootstrap years for requisition filters", () => {
    render(
      <RequisitionFilters
        filters={{ page: 1, pageSize: 20 }}
        onFilterChange={vi.fn()}
        initialYears={[2026, 2025]}
      />,
    );

    expect(screen.getByRole("option", { name: "2026" })).toBeInTheDocument();
    expect(getDistinctYearsMock).not.toHaveBeenCalled();
  });
});
