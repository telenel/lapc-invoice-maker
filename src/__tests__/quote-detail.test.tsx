import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QuoteDetailView } from "@/components/quotes/quote-detail";
import { toast } from "sonner";

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

    await screen.findByRole("heading", { level: 1, name: "Q-1" });
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

    await screen.findByRole("heading", { level: 1, name: "Q-1" });
    expect(screen.getByRole("button", { name: "Approve Manually" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Convert to Invoice" })).not.toBeInTheDocument();
  });

  it("offers a payment-resolution action for accepted quotes that still need payment details", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input) === "/api/quotes/q1") {
          return {
            ok: true,
            json: async () =>
              makeQuote({
                quoteStatus: "ACCEPTED",
                convertedToInvoice: null,
                paymentDetailsResolved: false,
              }),
          } satisfies Partial<Response>;
        }

        throw new Error(`Unexpected fetch: ${String(input)}`);
      }),
    );

    render(<QuoteDetailView id="q1" />);

    await screen.findByRole("heading", { level: 1, name: "Q-1" });
    expect(screen.getByRole("button", { name: "Resolve Payment Details" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Convert to Invoice" })).not.toBeInTheDocument();
  });

  it("still offers payment resolution after a quote has already been converted", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input) === "/api/quotes/q1") {
          return {
            ok: true,
            json: async () =>
              makeQuote({
                quoteStatus: "ACCEPTED",
                convertedToInvoice: {
                  id: "inv1",
                  invoiceNumber: "INV-1",
                },
                paymentDetailsResolved: false,
              }),
          } satisfies Partial<Response>;
        }

        throw new Error(`Unexpected fetch: ${String(input)}`);
      }),
    );

    render(<QuoteDetailView id="q1" />);

    await screen.findByText("Q-1");
    expect(screen.getByRole("button", { name: "Resolve Payment Details" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /View Invoice INV-1/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Convert to Invoice" })).not.toBeInTheDocument();
  });

  it("keeps the payment dialog open when saving payment details fails", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        if (String(input) === "/api/quotes/q1" && !init) {
          return {
            ok: true,
            json: async () =>
              makeQuote({
                quoteStatus: "ACCEPTED",
                convertedToInvoice: null,
                paymentDetailsResolved: false,
              }),
          } satisfies Partial<Response>;
        }

        if (String(input) === "/api/quotes/q1" && init?.method === "PUT") {
          return {
            ok: false,
            json: async () => ({ error: "Failed to save payment details" }),
          } satisfies Partial<Response>;
        }

        throw new Error(`Unexpected fetch: ${String(input)}`);
      }),
    );

    render(<QuoteDetailView id="q1" />);

    await screen.findByText("Q-1");
    await user.click(screen.getByRole("button", { name: "Resolve Payment Details" }));
    await user.click(screen.getByRole("button", { name: "CHECK" }));
    await user.click(screen.getByRole("button", { name: "Save Payment Details" }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to save payment details");
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Save Payment Details" })).toBeInTheDocument();
    });
  });

  it("does not enter a saving state when validation fails before submit", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input) === "/api/quotes/q1") {
          return {
            ok: true,
            json: async () =>
              makeQuote({
                quoteStatus: "ACCEPTED",
                convertedToInvoice: null,
                paymentDetailsResolved: false,
              }),
          } satisfies Partial<Response>;
        }

        throw new Error(`Unexpected fetch: ${String(input)}`);
      }),
    );

    render(<QuoteDetailView id="q1" />);

    await screen.findByText("Q-1");
    await user.click(screen.getByRole("button", { name: "Resolve Payment Details" }));
    await user.click(screen.getByRole("button", { name: "Save Payment Details" }));

    expect(screen.getByRole("button", { name: "Save Payment Details" })).toBeEnabled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("renders catering guide times in AM/PM format", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input) === "/api/quotes/q1") {
          return {
            ok: true,
            json: async () =>
              makeQuote({
                isCateringEvent: true,
                cateringDetails: {
                  eventDate: "2026-04-15",
                  startTime: "13:30",
                  endTime: "15:00",
                  location: "Student Center",
                  contactName: "Jane Doe",
                  contactPhone: "555-1111",
                  headcount: 40,
                  setupRequired: true,
                  setupTime: "12:45",
                  setupInstructions: "Front entrance",
                  takedownRequired: true,
                  takedownTime: "15:15",
                  takedownInstructions: "Cleanup after service",
                  specialInstructions: "Vegetarian options",
                },
                items: [
                  {
                    id: "item-1",
                    description: "Lunch Buffet",
                    quantity: 1,
                    unitPrice: 100,
                    extendedPrice: 100,
                    isTaxable: true,
                    sortOrder: 0,
                    costPrice: null,
                    marginOverride: null,
                  },
                ],
              }),
          } satisfies Partial<Response>;
        }

        throw new Error(`Unexpected fetch: ${String(input)}`);
      }),
    );

    render(<QuoteDetailView id="q1" />);

    await screen.findByRole("heading", { level: 1, name: "Q-1" });
    expect(screen.getByText(/Apr 15, 2026, 1:30 PM – 3:00 PM/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Time:/i)).toHaveLength(2);
    expect(screen.getByText(/12:45 PM/i)).toBeInTheDocument();
    expect(screen.getByText(/3:15 PM/i)).toBeInTheDocument();
    expect(screen.queryByText("13:30")).not.toBeInTheDocument();
    expect(screen.queryByText("15:15")).not.toBeInTheDocument();
  });
});
