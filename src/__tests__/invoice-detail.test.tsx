import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { InvoiceDetailView } from "@/components/invoices/invoice-detail";

const pushMock = vi.fn();

let sessionState: {
  data: { user: { id: string; role: string } } | null;
} = {
  data: { user: { id: "u1", role: "user" } },
};

const useInvoiceMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

vi.mock("next-auth/react", () => ({
  useSession: () => sessionState,
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("@/lib/use-sse", () => ({
  useSSE: vi.fn(),
}));

vi.mock("@/domains/invoice/hooks", () => ({
  useInvoice: (...args: unknown[]) => useInvoiceMock(...args),
}));

vi.mock("@/components/invoices/invoice-detail-info", () => ({
  InvoiceDetailInfo: () => <div data-testid="invoice-detail-info" />,
}));

vi.mock("@/components/invoices/invoice-detail-staff", () => ({
  InvoiceDetailStaff: () => <div data-testid="invoice-detail-staff" />,
}));

vi.mock("@/components/invoices/invoice-detail-items", () => ({
  InvoiceDetailItems: () => <div data-testid="invoice-detail-items" />,
}));

function makeInvoice(overrides: Record<string, unknown> = {}) {
  return {
    id: "inv1",
    invoiceNumber: "INV-1",
    date: "2026-04-13T00:00:00.000Z",
    status: "DRAFT",
    type: "INVOICE",
    department: "IT",
    category: "SUPPLIES",
    accountCode: "AC-1",
    accountNumber: "12345",
    approvalChain: [],
    notes: "",
    totalAmount: 100,
    isRecurring: false,
    recurringInterval: null,
    recurringEmail: null,
    isRunning: false,
    runningTitle: null,
    pdfPath: "/pdfs/inv-1.pdf",
    pdfMetadata: null,
    prismcorePath: null,
    marginEnabled: false,
    marginPercent: null,
    taxEnabled: false,
    taxRate: 0,
    isCateringEvent: false,
    cateringDetails: null,
    createdAt: "2026-04-13T00:00:00.000Z",
    archivedAt: null,
    archivedBy: null,
    staff: null,
    contact: null,
    creatorId: "u1",
    creatorName: "Owner User",
    items: [],
    ...overrides,
  };
}

describe("InvoiceDetailView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pushMock.mockReset();
    sessionState = {
      data: { user: { id: "u1", role: "user" } },
    };
    useInvoiceMock.mockReturnValue({
      data: makeInvoice(),
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
    vi.stubGlobal("confirm", vi.fn(() => false));
  });

  it("uses the confirmation dialog for draft invoice deletes instead of window.confirm", async () => {
    const user = userEvent.setup();

    render(<InvoiceDetailView id="inv1" />);

    await user.click(screen.getByRole("button", { name: /^Delete$/ }));

    expect(globalThis.confirm).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: /Delete Invoice/i })).toBeInTheDocument();
    expect(screen.getByText(/moved to the Deleted Archive/i)).toBeInTheDocument();
  });

  it("shows an archive banner and restore action for archived invoices", async () => {
    useInvoiceMock.mockReturnValue({
      data: makeInvoice({
        status: "FINAL",
        archivedAt: "2026-04-13T12:00:00.000Z",
        archivedBy: { id: "u1", name: "Admin User" },
      }),
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<InvoiceDetailView id="inv1" />);

    expect(screen.getByText(/This invoice is in the Deleted Archive/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Restore/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Delete$/ })).not.toBeInTheDocument();
  });
});
