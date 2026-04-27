import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { DocTypeBadge } from "./doc-type-badge";

describe("DocTypeBadge", () => {
  it("renders INVOICE in red-soft tone", () => {
    const { container } = render(<DocTypeBadge docType="invoice" />);
    expect(screen.getByText("INVOICE")).toBeInTheDocument();
    expect(container.firstChild).toHaveClass("bg-primary/10");
  });

  it("renders QUOTE in teal-soft tone", () => {
    const { container } = render(<DocTypeBadge docType="quote" />);
    expect(screen.getByText("QUOTE")).toBeInTheDocument();
    expect(container.firstChild).toHaveClass("bg-teal-bg");
  });
});
