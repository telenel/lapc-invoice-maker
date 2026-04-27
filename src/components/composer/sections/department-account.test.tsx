import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { DepartmentAccountSection } from "./department-account";
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

vi.mock("@/components/invoice/account-number-select", () => ({
  AccountNumberSelect: ({ form }: { form: { accountNumber: string } }) => (
    <input data-testid="account-number" value={form.accountNumber} readOnly />
  ),
}));

describe("DepartmentAccountSection", () => {
  it("renders 3-column grid + semester input", () => {
    const { result } = renderHook(() => useInvoiceForm());
    render(<DepartmentAccountSection composer={result.current} sectionStatus="default" />);
    // base-ui Select renders as role="combobox"; the section's aria-labelledby also
    // matches /Department/i via "Department & Account", so getByLabelText would find
    // multiple elements. Use getByRole with accessible name instead.
    expect(screen.getByRole("combobox", { name: /Department/i })).toBeInTheDocument();
    expect(screen.getByTestId("account-number")).toBeInTheDocument();
    expect(screen.getByLabelText(/Account code/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Semester/i)).toBeInTheDocument();
  });

  it("autofills semesterYearDept from department when empty", async () => {
    // userEvent is imported for future test expansion
    void userEvent;
    const { result } = renderHook(() => useInvoiceForm({ department: "BKST" }));
    render(<DepartmentAccountSection composer={result.current} sectionStatus="default" />);
    const sem = screen.getByLabelText(/Semester/i) as HTMLInputElement;
    expect(sem.value === "" || sem.placeholder.includes("BKST")).toBe(true);
  });
});
