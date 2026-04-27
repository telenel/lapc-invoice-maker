import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { PeopleSection } from "./people-section";
import { useInvoiceForm } from "@/components/invoice/invoice-form";
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
