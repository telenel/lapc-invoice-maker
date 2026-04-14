import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Checkbox } from "./checkbox";

describe("Checkbox", () => {
  it("renders with an inline-flex square footprint so it does not collapse in tables", () => {
    render(<Checkbox aria-label="Select row" />);

    const checkbox = screen.getByRole("checkbox", { name: "Select row" });

    expect(checkbox).toHaveClass("inline-flex");
    expect(checkbox).toHaveClass("size-4");
  });
});
