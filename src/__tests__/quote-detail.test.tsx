import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QuoteDetailView } from "@/components/quotes/quote-detail";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
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

vi.mock("@/components/quotes/share-link-dialog", () => ({
  ShareLinkDialog: () => null,
}));

vi.mock("@/components/quotes/quote-activity", () => ({
  QuoteActivity: () => <div data-testid="quote-activity" />,
}));

function makeQuote(overrides: Record<string, unknown> = {}) {
  return {
    id: "q1",
    quoteNumber: "Q-1",
    quoteStatus: "SENT",
    category: "SUPPLIES",
    date: "2026-03-31T00:00:00.000Z",
    createdAt: "2026-03-31T00:00:00.000Z",
    department: "IT",
    accountCode: "AC-1",
    accountNumber: "12345",
    totalAmount: 100,
    notes: "",
    expirationDate: null,
    recipientName: "Jane",
    recipientEmail: "jane@example.com",
    recipientOrg: "Org",
    shareToken: "share-token",
    staff: null,
    contact: null,
    creatorName: "Owner",
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
    viewerAccess: {
      canViewQuote: true,
      canManageActions: true,
      canViewActivity: true,
      canViewSensitiveFields: true,
    },
    convertedToInvoice: {
      id: "inv1",
      invoiceNumber: "INV-1",
    },
    revisedFromQuote: null,
    revisedToQuote: null,
    ...overrides,
  };
}

describe("QuoteDetailView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pushMock.mockReset();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input) === "/api/quotes/q1") {
          return {
            ok: true,
            json: async () => makeQuote(),
          } satisfies Partial<Response>;
        }

        throw new Error(`Unexpected fetch: ${String(input)}`);
      }),
    );
  });

  it("suppresses stale quote actions once a sent quote has been converted", async () => {
    const user = userEvent.setup();
    render(<QuoteDetailView id="q1" />);

    await screen.findByText("Q-1");
    await waitFor(() => {
      expect(screen.getByRole("link", { name: /View Invoice INV-1/i })).toBeInTheDocument();
    });

    expect(screen.queryByRole("button", { name: "Approve Manually" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Convert to Invoice" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Share Link" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /More/i }));
    expect(screen.queryByRole("menuitem", { name: "Edit" })).not.toBeInTheDocument();
  });

  it("does not offer invoice conversion while a quote is still awaiting approval/payment", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input) === "/api/quotes/q1") {
          return {
            ok: true,
            json: async () => makeQuote({ convertedToInvoice: null }),
          } satisfies Partial<Response>;
        }

        throw new Error(`Unexpected fetch: ${String(input)}`);
      }),
    );

    render(<QuoteDetailView id="q1" />);

    await screen.findByText("Q-1");
    expect(screen.getByRole("button", { name: "Approve Manually" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Convert to Invoice" })).not.toBeInTheDocument();
  });
});
