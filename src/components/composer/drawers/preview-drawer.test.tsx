import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { PreviewDrawer } from "./preview-drawer";
import type { ComposerTotals } from "../types";

const totals: ComposerTotals = {
  subtotal: 100,
  taxableSubtotal: 100,
  taxAmount: 9.75,
  marginAmount: 0,
  grandTotal: 109.75,
  itemCount: 1,
  taxableCount: 1,
};

const baseProps = {
  open: true,
  onOpenChange: () => {},
  date: "2026-04-26",
  department: "BKST",
  category: "Supplies",
  items: [
    { description: "WIDGET", sku: "12345", quantity: 1, unitPrice: 100, isTaxable: true },
  ],
  totals,
  taxRate: 0.0975,
  taxEnabled: true,
  signatures: [{ name: "Jane Doe", title: "Manager" }],
  notes: "public notes",
};

describe("PreviewDrawer", () => {
  it("renders preview header + items + signatures for invoice", () => {
    render(
      <PreviewDrawer
        {...baseProps}
        docType="invoice"
        onPrimaryAction={vi.fn()}
      />,
    );
    expect(screen.getByText(/Preview/)).toBeInTheDocument();
    expect(screen.getByText(/WIDGET/)).toBeInTheDocument();
    expect(screen.getByText(/Jane Doe/)).toBeInTheDocument();
    expect(screen.queryByText(/internal/i)).toBeNull();
  });

  it("hides signature block for quote docType", () => {
    render(
      <PreviewDrawer
        {...baseProps}
        docType="quote"
        onPrimaryAction={vi.fn()}
      />,
    );
    expect(screen.queryByText(/Jane Doe/)).toBeNull();
  });

  it("hides tax row when taxEnabled is false", () => {
    render(
      <PreviewDrawer
        {...baseProps}
        docType="invoice"
        taxEnabled={false}
        onPrimaryAction={vi.fn()}
      />,
    );
    expect(screen.queryByText(/Tax/)).toBeNull();
  });

  it("invokes onPrimaryAction when primary button clicked", async () => {
    const onPrimary = vi.fn();
    const user = userEvent.setup();
    render(
      <PreviewDrawer
        {...baseProps}
        docType="invoice"
        onPrimaryAction={onPrimary}
      />,
    );
    await user.click(screen.getByRole("button", { name: /Generate PDF/i }));
    expect(onPrimary).toHaveBeenCalledTimes(1);
  });
});
