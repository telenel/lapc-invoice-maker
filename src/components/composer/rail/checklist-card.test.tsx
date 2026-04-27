import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { ChecklistCard } from "./checklist-card";

const items = [
  { id: "a", label: "Requestor", anchor: "section-people" as const, complete: true,  blocker: false },
  { id: "b", label: "Items",     anchor: "section-items"  as const, complete: false, blocker: true  },
  { id: "c", label: "Notes",     anchor: "section-notes"  as const, complete: false, blocker: false },
];

describe("ChecklistCard", () => {
  it("renders count + items", () => {
    render(<ChecklistCard checklist={items} onJump={vi.fn()} />);
    expect(screen.getByText(/Checklist · 1\/3/i)).toBeInTheDocument();
  });
  it("calls onJump with anchor on click", async () => {
    const onJump = vi.fn();
    const user = userEvent.setup();
    render(<ChecklistCard checklist={items} onJump={onJump} />);
    await user.click(screen.getByText("Items"));
    expect(onJump).toHaveBeenCalledWith("section-items");
  });
});
