import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { BlockerSummary } from "./blocker-summary";

const blockers = [
  { field: "department", label: "Department required", anchor: "section-department" as const },
  { field: "items", label: "Add items", anchor: "section-items" as const },
];

describe("BlockerSummary", () => {
  it("renders count + items + close", async () => {
    const onClose = vi.fn();
    const onJump = vi.fn();
    const user = userEvent.setup();
    render(<BlockerSummary blockers={blockers} onClose={onClose} onJump={onJump} />);
    expect(screen.getByText(/2 issue\(s\) to resolve/i)).toBeInTheDocument();
    await user.click(screen.getByText("Department required"));
    expect(onJump).toHaveBeenCalledWith("section-department");
    await user.click(screen.getByLabelText(/Close/i));
    expect(onClose).toHaveBeenCalled();
  });
});
