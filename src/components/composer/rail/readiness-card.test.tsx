import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ReadinessCard } from "./readiness-card";
import type { ComposerTotals } from "../types";

const totals: ComposerTotals = {
  subtotal: 1247.18, taxableSubtotal: 882, taxAmount: 86.07, marginAmount: 184.32,
  grandTotal: 1333.25, itemCount: 5, taxableCount: 4,
};

describe("ReadinessCard", () => {
  it("shows 'Ready' when 100% and 0 blockers", () => {
    render(<ReadinessCard
      readiness={1} blockerCount={0} docType="invoice" totals={totals} marginEnabled
      taxEnabled taxRate={0.0975} accountNumber="10-4500-301" department="BKST" saving={false}
      primaryDisabled={false} canSaveDraft onPrimaryAction={vi.fn()} onSaveDraft={vi.fn()} onPrintRegister={vi.fn()}
      onJumpToBlockers={vi.fn()} onJumpToAccount={vi.fn()}
    />);
    expect(screen.getByText(/Ready/i)).toBeInTheDocument();
    expect(screen.getByText(/INVOICE TOTAL/)).toBeInTheDocument();
    expect(screen.getByText(/1,333\.25/)).toBeInTheDocument();
  });
  it("shows blocker count when > 0", () => {
    render(<ReadinessCard
      readiness={0.6} blockerCount={2} docType="invoice" totals={totals} marginEnabled={false}
      taxEnabled={false} taxRate={0} accountNumber="" department="" saving={false}
      primaryDisabled canSaveDraft={false} onPrimaryAction={vi.fn()} onSaveDraft={vi.fn()} onPrintRegister={vi.fn()}
      onJumpToBlockers={vi.fn()} onJumpToAccount={vi.fn()}
    />);
    expect(screen.getAllByText(/2 blocker/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /Generate PDF/i })).toBeDisabled();
  });
});
