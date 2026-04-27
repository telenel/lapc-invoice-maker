import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Switch } from "./switch";

describe("Switch", () => {
  it("toggles checked state on click", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Switch checked={false} onCheckedChange={onChange} aria-label="t" />);
    await user.click(screen.getByRole("switch"));
    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.calls[0][0]).toBe(true);
  });
});
