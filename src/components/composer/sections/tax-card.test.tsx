import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { TaxCard } from "./tax-card";

describe("TaxCard", () => {
  it("shows rate input + resolved % + count when enabled", () => {
    render(<TaxCard enabled rate={0.0975} taxableCount={3} onEnabledChange={vi.fn()} onRateChange={vi.fn()} />);
    expect(screen.getByDisplayValue("0.0975")).toBeInTheDocument();
    expect(screen.getByText(/9\.75%/)).toBeInTheDocument();
    expect(screen.getByText(/3 taxable/)).toBeInTheDocument();
  });
});
