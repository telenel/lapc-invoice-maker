import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { DensityToggle } from "./density-toggle";

describe("DensityToggle", () => {
  it("renders three radio buttons", () => {
    render(<DensityToggle value="standard" onChange={() => {}} />);
    const group = screen.getByRole("radiogroup");
    expect(group).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(3);
  });

  it("marks the selected value", () => {
    render(<DensityToggle value="comfortable" onChange={() => {}} />);
    expect(screen.getByRole("radio", { name: /comfortable/i })).toBeChecked();
  });

  it("calls onChange when a different option is clicked", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<DensityToggle value="standard" onChange={onChange} />);
    await user.click(screen.getByRole("radio", { name: /compact/i }));
    expect(onChange).toHaveBeenCalledWith("compact");
  });
});
