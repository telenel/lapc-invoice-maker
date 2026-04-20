import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarginBar } from "@/components/products/margin-bar";

describe("MarginBar", () => {
  it("renders margin percentage computed from cost and retail", () => {
    render(<MarginBar cost={60} retail={100} />);
    expect(screen.getByText("40.0%")).toBeInTheDocument();
  });

  it("renders em dash when retail is zero", () => {
    render(<MarginBar cost={10} retail={0} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("clamps negative margins to zero", () => {
    render(<MarginBar cost={120} retail={100} />);
    expect(screen.getByText("0.0%")).toBeInTheDocument();
  });
});
