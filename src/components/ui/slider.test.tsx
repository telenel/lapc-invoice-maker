import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Slider } from "./slider";

describe("Slider", () => {
  it("renders a slider with min/max/value", () => {
    render(<Slider min={0} max={60} value={[20]} aria-label="margin" />);
    const slider = screen.getByRole("slider");
    expect(slider).toHaveAttribute("min", "0");
    expect(slider).toHaveAttribute("max", "60");
    expect(slider).toHaveAttribute("aria-valuenow", "20");
  });
});
