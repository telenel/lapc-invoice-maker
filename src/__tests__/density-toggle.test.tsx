import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DensityToggle } from "@/components/products/density-toggle";

afterEach(() => {
  cleanup();
});

describe("DensityToggle", () => {
  it("renders all four density options", () => {
    render(<DensityToggle value="comfy" onChange={vi.fn()} />);

    expect(screen.getByRole("button", { name: /Compact/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Comfy/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Roomy/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Audit/i })).toBeInTheDocument();
  });

  it("marks the active option with aria-pressed=true", () => {
    render(<DensityToggle value="audit" onChange={vi.fn()} />);

    expect(screen.getByRole("button", { name: /Audit/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Comfy/i })).toHaveAttribute("aria-pressed", "false");
  });

  it("calls onChange with the selected density", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DensityToggle value="comfy" onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: /Roomy/i }));
    expect(onChange).toHaveBeenCalledWith("roomy");

    await user.click(screen.getByRole("button", { name: /Audit/i }));
    expect(onChange).toHaveBeenCalledWith("audit");
  });

  it("does not invoke onChange when clicking the already-active option", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DensityToggle value="comfy" onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: /Comfy/i }));
    expect(onChange).not.toHaveBeenCalled();
  });
});
