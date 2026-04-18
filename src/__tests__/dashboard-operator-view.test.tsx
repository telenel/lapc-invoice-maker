import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DashboardBootstrapProvider } from "@/components/dashboard/dashboard-bootstrap-provider";
import type { DashboardBootstrapData } from "@/domains/dashboard/types";
import { DashboardOperatorView } from "@/components/dashboard/dashboard-operator-view";

const { listInvoices } = vi.hoisted(() => ({
  listInvoices: vi.fn(),
}));

const { listQuotes } = vi.hoisted(() => ({
  listQuotes: vi.fn(),
}));

vi.mock("@/domains/invoice/api-client", () => ({
  invoiceApi: {
    list: listInvoices,
  },
}));

vi.mock("@/domains/quote/api-client", () => ({
  quoteApi: {
    list: listQuotes,
  },
}));

vi.mock("@/components/dashboard/use-deferred-dashboard-realtime", () => ({
  useDeferredDashboardRealtime: vi.fn(),
}));

function buildBootstrapData(): DashboardBootstrapData {
  return {
    todaysEvents: [
      {
        id: "evt-1",
        title: "Dean's Welcome",
        start: "2026-04-17T17:00:00.000Z",
        end: "2026-04-17T18:00:00.000Z",
        allDay: false,
        color: "#fff7ed",
        borderColor: "#f97316",
        source: "catering",
        extendedProps: {
          location: "Great Hall",
        },
      },
    ],
    yourFocus: {
      myDrafts: 2,
      myRunning: 1,
      myFinalThisMonth: 4,
      myTotalThisMonth: 4200,
      myFinalLastMonth: 2,
      myQuotesAwaitingResponse: 1,
    },
    stats: {
      summary: {
        invoicesThisMonth: 9,
        totalThisMonth: 128940.12,
        invoicesLastMonth: 7,
        totalLastMonth: 110250.5,
        expectedCount: 3,
        expectedTotal: 68321.2,
        pipeline: [8, 10, 9, 12, 11, 15, 14, 18, 17, 22, 21, 25],
      },
      teamUsers: [
        { id: "user-1", name: "Mary Alvarez", invoiceCount: 17, totalAmount: 41280.55 },
        { id: "user-2", name: "Derek Ng", invoiceCount: 14, totalAmount: 38120.9 },
      ],
    },
    pendingAccounts: [
      {
        invoiceId: "pending-1",
        invoiceNumber: "INV-2101",
        quoteNumber: null,
        type: "INVOICE",
        staffName: "Pat Kim",
        creatorName: "Mary Alvarez",
        creatorId: "user-1",
        currentAttempt: 2,
        maxAttempts: 5,
        seriesStatus: "ACTIVE",
      },
    ],
    runningInvoices: [
      {
        id: "run-1",
        creatorId: "user-1",
        creatorName: "Mary Alvarez",
        requestorName: "Athletics Department",
        department: "Athletics",
        detail: "Athletics Equipment",
        totalAmount: 4812,
        runningTitle: "Athletics Equipment",
        itemCount: 7,
      },
    ],
    recentActivity: {
      items: [
        {
          type: "invoice",
          id: "activity-1",
          number: "INV-2431",
          name: "Dr. Eleanor Kim",
          department: "Biology",
          date: "2026-04-16T00:00:00.000Z",
          amount: 2184.5,
          status: "FINAL",
          creatorId: "user-1",
          creatorName: "Mary Alvarez",
          createdAt: "2026-04-16T12:00:00.000Z",
        },
      ],
      badgeStates: {},
    },
  };
}

function renderOperatorView() {
  listInvoices.mockImplementation(async (filters: { status?: string; isRunning?: boolean }) => {
    if (filters.status === "FINAL") {
      return {
        invoices: [
          {
            id: "final-1",
            invoiceNumber: "INV-2500",
            status: "FINAL",
            date: "2026-04-09",
            department: "Print Shop",
            totalAmount: 1880,
            creatorId: "user-1",
            creatorName: "Mary Alvarez",
            items: [],
            approvalChain: [],
            notes: "",
            type: "INVOICE",
            category: "Printing",
            accountCode: "",
            accountNumber: "",
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
            createdAt: "2026-04-09T12:00:00.000Z",
            staffId: null,
            staff: { id: "staff-1", name: "Copy Center", title: "", department: "", accountNumbers: [] },
            contact: null,
          },
        ],
        total: 1,
        page: 1,
        pageSize: 5,
      };
    }

    if (filters.isRunning) {
      return {
        invoices: [
          {
            id: "run-1",
            invoiceNumber: "INV-2414",
            status: "DRAFT",
            date: "2026-04-14",
            department: "Athletics",
            totalAmount: 4812,
            creatorId: "user-1",
            creatorName: "Mary Alvarez",
            items: [{ id: "item-1", description: "Athletics Equipment", quantity: 1, unitPrice: 4812, extendedPrice: 4812, sortOrder: 0, isTaxable: false, costPrice: null, marginOverride: null, sku: null }],
            approvalChain: [],
            notes: "",
            type: "INVOICE",
            category: "Printing",
            accountCode: "",
            accountNumber: "",
            isRecurring: false,
            recurringInterval: null,
            recurringEmail: null,
            isRunning: true,
            runningTitle: "Athletics Equipment",
            pdfPath: null,
            pdfMetadata: null,
            prismcorePath: null,
            marginEnabled: false,
            marginPercent: null,
            taxEnabled: false,
            taxRate: 0,
            isCateringEvent: false,
            cateringDetails: null,
            createdAt: "2026-04-14T12:00:00.000Z",
            staffId: null,
            staff: { id: "staff-1", name: "Athletics Department", title: "", department: "", accountNumbers: [] },
            contact: null,
          },
        ],
        total: 1,
        page: 1,
        pageSize: 5,
      };
    }

    return {
      invoices: [
        {
          id: "draft-1",
          invoiceNumber: "INV-2431",
          status: "DRAFT",
          date: "2026-04-16",
          department: "Biology",
          totalAmount: 2184.5,
          creatorId: "user-1",
          creatorName: "Mary Alvarez",
          items: [{ id: "item-1", description: "Biology 101 packets", quantity: 1, unitPrice: 2184.5, extendedPrice: 2184.5, sortOrder: 0, isTaxable: false, costPrice: null, marginOverride: null, sku: null }],
          approvalChain: [],
          notes: "",
          type: "INVOICE",
          category: "Printing",
          accountCode: "",
          accountNumber: "",
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
          createdAt: "2026-04-16T12:00:00.000Z",
          staffId: null,
          staff: { id: "staff-1", name: "Dr. Eleanor Kim", title: "", department: "", accountNumbers: [] },
          contact: null,
        },
      ],
      total: 1,
      page: 1,
      pageSize: 5,
    };
  });

  listQuotes.mockResolvedValue({
    quotes: [
      {
        id: "quote-1",
        quoteNumber: "QT-1188",
        quoteStatus: "SENT",
        date: "2026-04-15",
        staffId: null,
        expirationDate: null,
        type: "QUOTE",
        department: "Recipient Services",
        category: "Printing",
        accountCode: "",
        accountNumber: "",
        approvalChain: [],
        notes: "",
        totalAmount: 960,
        recipientName: "Recipient Services",
        recipientEmail: "recipient@example.com",
        recipientOrg: "LAPC",
        pdfPath: null,
        shareToken: "share-1",
        createdAt: "2026-04-15T12:00:00.000Z",
        staff: null,
        contact: null,
        creatorId: "user-1",
        creatorName: "Mary Alvarez",
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
      },
    ],
    total: 1,
    page: 1,
    pageSize: 5,
  });

  return render(
    <DashboardBootstrapProvider value={buildBootstrapData()}>
      <DashboardOperatorView currentUserId="user-1" currentUserName="Mary Alvarez" />
    </DashboardBootstrapProvider>,
  );
}

describe("DashboardOperatorView", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders the split operator view with the queue and team panes", async () => {
    renderOperatorView();

    expect(screen.getByText("Your queue")).toBeInTheDocument();
    expect(screen.getByText("Team · April")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /\+\s*New Invoice/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Drafts · 2/i })).toBeInTheDocument();
    expect(screen.getByText("Top contributors")).toBeInTheDocument();
    expect(await screen.findByText("Dr. Eleanor Kim")).toBeInTheDocument();
    expect(screen.getAllByText("Athletics Equipment").length).toBeGreaterThan(0);
  });

  it("switches the queue list when the awaiting tab is selected", async () => {
    const user = userEvent.setup();

    renderOperatorView();

    await screen.findByText("Dr. Eleanor Kim");
    await user.click(screen.getByRole("button", { name: /Awaiting · 1/i }));

    await waitFor(() => {
      expect(listQuotes).toHaveBeenCalledWith(
        expect.objectContaining({
          creatorId: "user-1",
          quoteStatus: "SENT",
          pageSize: 5,
        }),
      );
    });

    expect(await screen.findByText("Recipient Services")).toBeInTheDocument();
    expect(screen.getByText("QT-1188")).toBeInTheDocument();
  });
});
