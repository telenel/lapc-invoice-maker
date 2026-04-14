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
        }}
      />,
    );

    expect(screen.getByRole("heading", { name: /Analytics/i })).toBeInTheDocument();
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
