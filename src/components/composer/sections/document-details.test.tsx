import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { DocumentDetailsSection } from "./document-details";
import { useInvoiceForm } from "@/components/invoice/invoice-form";
import { useQuoteForm } from "@/components/quote/quote-form";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/invoices/new",
}));

vi.mock("@/domains/category/api-client", () => ({
  categoryApi: { list: vi.fn().mockResolvedValue([]) },
}));

// Wrapper components call the hook inside the same render tree so state
// updates from user interactions cause the component to re-render.

function InvoiceWrapper() {
  const composer = useInvoiceForm();
  return (
    <DocumentDetailsSection
      docType="invoice"
      composer={composer}
      sectionStatus="default"
    />
  );
}

function QuoteWrapper() {
  const composer = useQuoteForm();
  return (
    <DocumentDetailsSection
      docType="quote"
      composer={composer}
      sectionStatus="default"
    />
  );
}

describe("DocumentDetailsSection invoice", () => {
  it("renders running toggle + reveals title input when on", async () => {
    const user = userEvent.setup();
    render(<InvoiceWrapper />);
    expect(screen.getByLabelText(/Running invoice/i)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/Running invoice title/i)).toBeNull();
    await user.click(screen.getByRole("switch", { name: /Running/i }));
    expect(
      screen.getByPlaceholderText(/Running invoice title/i)
    ).toBeInTheDocument();
  });
});

describe("DocumentDetailsSection quote", () => {
  it("renders catering toggle + reveals 4-col primary block", async () => {
    const user = userEvent.setup();
    render(<QuoteWrapper />);
    expect(
      screen.getByRole("switch", { name: /Catering/i })
    ).toBeInTheDocument();
    await user.click(screen.getByRole("switch", { name: /Catering/i }));
    expect(screen.getByLabelText(/Event name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Attendees/i)).toBeInTheDocument();
    expect(screen.getByText(/More catering details/i)).toBeInTheDocument();
  });
});
