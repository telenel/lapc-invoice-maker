import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { PeopleSection } from "./people-section";
import { useInvoiceForm } from "@/components/invoice/invoice-form";
import { useQuoteForm } from "@/components/quote/quote-form";
import { renderHook } from "@testing-library/react";

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

vi.mock("@/components/invoice/staff-select", () => ({
  StaffSelect: ({ selectedId }: { selectedId?: string }) => (
    <div data-testid="staff-select">{selectedId ?? ""}</div>
  ),
}));
vi.mock("@/components/invoice/staff-summary-editor", () => ({
  StaffSummaryEditor: () => <div data-testid="staff-editor" />,
}));

describe("PeopleSection (invoice)", () => {
  it("renders staff select column + contact card column", () => {
    const { result } = renderHook(() => useInvoiceForm());
    render(
      <PeopleSection
        docType="invoice"
        composer={result.current}
        sectionStatus="default"
      />
    );
    expect(screen.getByText(/Who is the requestor/i)).toBeInTheDocument();
    expect(screen.getByTestId("staff-select")).toBeInTheDocument();
  });
});

describe("PeopleSection (quote)", () => {
  it("shows internal/external segmented control", () => {
    const { result } = renderHook(() => useQuoteForm());
    render(<PeopleSection docType="quote" composer={result.current} sectionStatus="default" />);
    expect(screen.getByRole("radio", { name: /Internal/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /External/i })).toBeInTheDocument();
  });

  it("hides recipient inputs in internal mode", () => {
    const { result } = renderHook(() => useQuoteForm({ staffId: "abc" }));
    render(<PeopleSection docType="quote" composer={result.current} sectionStatus="default" />);
    expect(screen.queryByPlaceholderText(/Recipient name/i)).toBeNull();
  });

  it("clears recipientOrg when switching to internal mode", async () => {
    const user = userEvent.setup();
    const { result } = renderHook(() => useQuoteForm({ recipientName: "Alice", recipientOrg: "ACME" }));
    render(<PeopleSection docType="quote" composer={result.current} sectionStatus="default" />);
    // Initially external mode (no staffId): recipientOrg input visible with "ACME"
    const orgInput = screen.getByPlaceholderText(/Organization \(optional\)/i) as HTMLInputElement;
    expect(orgInput.value).toBe("ACME");
    // Click "Internal dept." radio → recipientOrg should clear
    await user.click(screen.getByRole("radio", { name: /Internal/i }));
    expect(result.current.form.recipientOrg).toBe("");
  });
});
