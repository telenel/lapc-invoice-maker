import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { StatusPill } from "./status-pill";

describe("StatusPill", () => {
  it.each([
    ["DRAFT", /draft/i],
    ["FINALIZED", /finalized/i],
    ["SENT", /sent/i],
    ["PAID", /paid/i],
    ["EXPIRED", /expired/i],
  ] as const)("renders %s tone", (status, label) => {
    render(<StatusPill status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("falls back to muted tone for unknown status", () => {
    render(<StatusPill status="WEIRD" />);
    expect(screen.getByText("WEIRD")).toBeInTheDocument();
  });
});
