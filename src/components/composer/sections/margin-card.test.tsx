import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MarginCard } from "./margin-card";

describe("MarginCard", () => {
  it("shows toggle when disabled", () => {
    render(<MarginCard enabled={false} percent={0} onEnabledChange={vi.fn()} onPercentChange={vi.fn()} />);
    expect(screen.getByRole("switch", { name: /Margin/i })).toBeInTheDocument();
  });
  it("shows slider + value + warn when enabled and 0%", () => {
    render(<MarginCard enabled percent={0} onEnabledChange={vi.fn()} onPercentChange={vi.fn()} />);
    expect(screen.getByRole("slider")).toBeInTheDocument();
    expect(screen.getByText(/above 0%/i)).toBeInTheDocument();
  });
});
