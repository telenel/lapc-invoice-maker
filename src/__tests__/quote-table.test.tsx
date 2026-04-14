import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  pushMock,
  searchParamsMock,
  quoteListMock,
  badgeStatesMock,
} = vi.hoisted(() => ({
  pushMock: vi.fn(),
  searchParamsMock: new URLSearchParams(),
  quoteListMock: vi.fn(),
  badgeStatesMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  useSearchParams: () => searchParamsMock,
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
  },
}));

vi.mock("@/lib/use-sse", () => ({
  useSSE: vi.fn(),
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

vi.mock("@/components/quotes/quote-filters", () => ({
  QuoteFiltersBar: () => <div>quote filters</div>,
}));

vi.mock("@/components/follow-up/follow-up-badge", () => ({
  FollowUpBadge: () => null,
}));

vi.mock("@/components/follow-up/bulk-request-dialog", () => ({
  BulkRequestDialog: () => null,
}));

import { QuoteTable } from "@/components/quotes/quote-table";

function renderQuoteTable() {
  return render(
    <QuoteTable
      departments={["CopyTech"]}
      categories={[]}
      initialRequest={{ page: 1, pageSize: 20, sortBy: "createdAt", sortOrder: "desc" }}
      initialData={{
        quotes: [
          {
            id: "quote-1",
            quoteNumber: "Q-001",
            quoteStatus: "SENT",
            date: "2026-04-12T00:00:00.000Z",
            staffId: null,
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
            paymentFollowUpBadge: null,
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
}

describe("QuoteTable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchParamsMock.forEach((_, key) => searchParamsMock.delete(key));
  });

  afterEach(() => {
    cleanup();
  });

  it("does not navigate when clicking the selection cell", async () => {
    const user = userEvent.setup();
    renderQuoteTable();

    const checkbox = screen.getByRole("checkbox", { name: "Select Q-001" });
    const selectionCell = checkbox.closest("td");

    expect(selectionCell).not.toBeNull();

    await user.click(selectionCell!);

    expect(pushMock).not.toHaveBeenCalled();
  });

  it("selects a quote without navigating away", async () => {
    const user = userEvent.setup();
    renderQuoteTable();

    const checkbox = screen.getByRole("checkbox", { name: "Select Q-001" });

    await user.click(checkbox);

    expect(pushMock).not.toHaveBeenCalled();
    expect(screen.getByText("1 selected")).toBeInTheDocument();
  });
});
