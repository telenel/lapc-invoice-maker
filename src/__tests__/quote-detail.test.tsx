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
    paymentFollowUpBadge: null,
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

  it("labels the draft primary action as send quote", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input) === "/api/quotes/q1") {
          return {
            ok: true,
            json: async () =>
              makeQuote({
                quoteStatus: "DRAFT",
                convertedToInvoice: null,
              }),
          } satisfies Partial<Response>;
        }

        throw new Error(`Unexpected fetch: ${String(input)}`);
      }),
    );

    render(<QuoteDetailView id="q1" />);

    await screen.findByRole("heading", { level: 1, name: "Q-1" });
    expect(screen.getByRole("button", { name: "Send Quote" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mark as Sent" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /More/i }));
    expect(screen.queryByRole("menuitem", { name: "Download PDF" })).not.toBeInTheDocument();
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

  it("shows draft-specific actions for editable drafts", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input) === "/api/quotes/q1") {
          return {
            ok: true,
            json: async () =>
              makeQuote({
                quoteStatus: "DRAFT",
                convertedToInvoice: null,
                shareToken: null,
              }),
          } satisfies Partial<Response>;
        }

        throw new Error(`Unexpected fetch: ${String(input)}`);
      }),
    );

    render(<QuoteDetailView id="q1" />);

    await screen.findByText("Q-1");
    expect(screen.getByRole("button", { name: "Mark as Sent" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Edit" })).toHaveAttribute("href", "/quotes/q1/edit");
    expect(screen.getByRole("button", { name: "Download / Regenerate PDF" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve Manually" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Revise & Resubmit" })).not.toBeInTheDocument();
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

  it("shows accepted quotes with an active payment follow-up badge", async () => {
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
                paymentFollowUpBadge: {
                  seriesStatus: "ACTIVE",
                  currentAttempt: 1,
                  maxAttempts: 5,
                },
              }),
          } satisfies Partial<Response>;
        }

        throw new Error(`Unexpected fetch: ${String(input)}`);
      }),
    );

    render(<QuoteDetailView id="q1" />);

    await screen.findByRole("heading", { level: 1, name: "Q-1" });
    expect(screen.getByText("Accepted")).toBeInTheDocument();
    expect(screen.getAllByText("Follow Up 1/5").length).toBeGreaterThan(0);
    expect(screen.getByText(/Automatic payment follow-up is active/i)).toBeInTheDocument();
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

  it("shows edit and conversion actions for accepted quotes with resolved payment details", async () => {
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
                paymentDetailsResolved: true,
                paymentMethod: "CHECK",
              }),
          } satisfies Partial<Response>;
        }

        throw new Error(`Unexpected fetch: ${String(input)}`);
      }),
    );

    render(<QuoteDetailView id="q1" />);

    await screen.findByText("Q-1");
    expect(screen.getByRole("link", { name: "Edit" })).toHaveAttribute("href", "/quotes/q1/edit");
    expect(screen.getByRole("button", { name: "Convert to Invoice" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /More/i }));
    expect(screen.queryByRole("menuitem", { name: "Edit" })).not.toBeInTheDocument();
  });

  it("offers revise and resubmit for declined quotes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input) === "/api/quotes/q1") {
          return {
            ok: true,
            json: async () =>
              makeQuote({
                quoteStatus: "DECLINED",
                convertedToInvoice: null,
              }),
          } satisfies Partial<Response>;
        }

        throw new Error(`Unexpected fetch: ${String(input)}`);
      }),
    );

    render(<QuoteDetailView id="q1" />);

    await screen.findByText("Q-1");
    expect(screen.getByRole("button", { name: "Revise & Resubmit" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve Manually" })).not.toBeInTheDocument();
  });

  it("offers delete for accepted quotes that the owner can still manage", async () => {
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
                paymentDetailsResolved: true,
                paymentMethod: "CHECK",
              }),
          } satisfies Partial<Response>;
        }

        throw new Error(`Unexpected fetch: ${String(input)}`);
      }),
    );

    render(<QuoteDetailView id="q1" />);

    await screen.findByText("Q-1");
    expect(screen.getByRole("button", { name: /^Delete$/ })).toBeInTheDocument();
  });

  it("shows an archive banner and restore action for archived quotes", async () => {
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
                archivedAt: "2026-04-13T12:00:00.000Z",
                archivedBy: { id: "u1", name: "Admin User" },
                paymentDetailsResolved: true,
                paymentMethod: "CHECK",
              }),
          } satisfies Partial<Response>;
        }

        throw new Error(`Unexpected fetch: ${String(input)}`);
      }),
    );

    render(<QuoteDetailView id="q1" />);

    await screen.findByText("Q-1");
    expect(screen.getByText(/This quote is in the Deleted Archive/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Restore/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Convert to Invoice" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve Manually" })).not.toBeInTheDocument();
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

        if (String(input) === "/api/quotes/q1/payment-details" && init?.method === "POST") {
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
                notes: "Bring campus signage",
                isCateringEvent: true,
                cateringDetails: {
                  eventName: "Board Luncheon",
                  eventDate: "2026-04-15",
                  startTime: "13:30",
                  endTime: "15:00",
                  location: "Student Center",
                  contactName: "Jane Doe",
                  contactPhone: "555-1111",
                  contactEmail: "jane@example.com",
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
    expect(screen.getAllByText("Quote Information").length).toBeGreaterThan(0);
    expect(screen.getByText("Customer Contact")).toBeInTheDocument();
    expect(screen.getByText("Operations Notes")).toBeInTheDocument();
    expect(screen.getByText("Ordered Items")).toBeInTheDocument();
    expect(screen.getByText(/Apr 15, 2026, 1:30 PM – 3:00 PM/i)).toBeInTheDocument();
    expect(screen.getByText(/12:45 PM/i)).toBeInTheDocument();
    expect(screen.getByText(/3:15 PM/i)).toBeInTheDocument();
    expect(screen.getAllByText("Bring campus signage").length).toBeGreaterThan(0);
    expect(screen.getAllByText("jane@example.com").length).toBeGreaterThan(0);
    expect(screen.queryByText("13:30")).not.toBeInTheDocument();
    expect(screen.queryByText("15:15")).not.toBeInTheDocument();
  });

  it("prints a dedicated catering guide document from live quote data", async () => {
    const user = userEvent.setup();
    const documentOpen = vi.fn();
    const documentWrite = vi.fn();
    const documentClose = vi.fn();
    const openSpy = vi.spyOn(window, "open").mockReturnValue({
      document: {
        open: documentOpen,
        write: documentWrite,
        close: documentClose,
      },
    } as unknown as Window);

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input) === "/api/quotes/q1") {
          return {
            ok: true,
            json: async () =>
              makeQuote({
                notes: "Customer requested compostable serviceware",
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
                  takedownRequired: false,
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

    try {
      render(<QuoteDetailView id="q1" />);

      await screen.findByRole("heading", { level: 1, name: "Q-1" });
      await user.click(screen.getByRole("button", { name: "Print Catering Guide" }));

      expect(openSpy).toHaveBeenCalledWith("about:blank", "_blank");
      expect(documentOpen).toHaveBeenCalled();
      expect(documentWrite).toHaveBeenCalledWith(expect.stringContaining("Generated from live LAPortal quote data"));
      expect(documentWrite).toHaveBeenCalledWith(expect.stringContaining("Day-of Catering Guide"));
      expect(documentWrite).toHaveBeenCalledWith(expect.stringContaining("Service Window"));
      expect(documentWrite).toHaveBeenCalledWith(expect.stringContaining("Quote Information"));
      expect(documentWrite).toHaveBeenCalledWith(expect.stringContaining("Customer requested compostable serviceware"));
      expect(documentWrite).toHaveBeenCalledWith(expect.stringContaining("Ordered Items"));
      expect(documentWrite).toHaveBeenCalledWith(expect.stringContaining("table-header-group"));
    } finally {
      openSpy.mockRestore();
    }
  });

  it("prints draft catering guides even when customer timing details are still blank", async () => {
    const user = userEvent.setup();
    const documentOpen = vi.fn();
    const documentWrite = vi.fn();
    const documentClose = vi.fn();
    const openSpy = vi.spyOn(window, "open").mockReturnValue({
      document: {
        open: documentOpen,
        write: documentWrite,
        close: documentClose,
      },
    } as unknown as Window);

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input) === "/api/quotes/q1") {
          return {
            ok: true,
            json: async () =>
              makeQuote({
                quoteStatus: "DRAFT",
                notes: "Additional Notes Test",
                isCateringEvent: true,
                cateringDetails: {
                  eventDate: "2026-04-12",
                  startTime: "",
                  endTime: "",
                  location: "",
                  eventName: "",
                  contactName: "Marcos A Montalvo",
                  contactPhone: "(818) 710-4236",
                  contactEmail: "montalma2@piercecollege.edu",
                  setupRequired: false,
                  setupTime: "",
                  setupInstructions: "",
                  takedownRequired: false,
                  takedownTime: "",
                  takedownInstructions: "",
                  specialInstructions: "",
                },
                recipientName: "Marcos A Montalvo",
                recipientEmail: "montalma2@piercecollege.edu",
                recipientOrg: "",
                taxEnabled: true,
                taxRate: 0.0975,
                items: [
                  {
                    id: "item-1",
                    description: "SUBWAY",
                    quantity: 20,
                    unitPrice: 16.2,
                    extendedPrice: 324,
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

    try {
      render(<QuoteDetailView id="q1" />);

      await screen.findByRole("heading", { level: 1, name: "Q-1" });
      await user.click(screen.getByRole("button", { name: "Print Catering Guide" }));

      expect(openSpy).toHaveBeenCalledWith("about:blank", "_blank");
      expect(documentOpen).toHaveBeenCalled();
      expect(documentWrite).toHaveBeenCalledWith(expect.stringContaining("Pending Confirmation"));
      expect(documentWrite).toHaveBeenCalledWith(expect.stringContaining("Marcos A Montalvo"));
      expect(documentWrite).toHaveBeenCalledWith(expect.stringContaining("montalma2@piercecollege.edu"));
      expect(documentWrite).toHaveBeenCalledWith(expect.stringContaining("SUBWAY"));
      expect(documentWrite).toHaveBeenCalledWith(expect.stringContaining("324.00"));
    } finally {
      openSpy.mockRestore();
    }
  });
});
