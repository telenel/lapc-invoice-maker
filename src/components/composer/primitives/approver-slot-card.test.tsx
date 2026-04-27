import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ApproverSlotCard } from "./approver-slot-card";

describe("ApproverSlotCard", () => {
  it("shows required pill when slot is required and empty", () => {
    render(
      <ApproverSlotCard
        slotIndex={0}
        required
        staffId=""
        display=""
        disabled={false}
        attemptedSubmit={false}
      >
        <select aria-label="approver">
          <option>—</option>
        </select>
      </ApproverSlotCard>,
    );
    expect(screen.getByText(/Signature 1/i)).toBeInTheDocument();
    expect(screen.getByText(/Required/i)).toBeInTheDocument();
  });

  it("shows positive tone when filled-and-required", () => {
    const { container } = render(
      <ApproverSlotCard
        slotIndex={1}
        required
        staffId="abc"
        display="Jane Doe — Manager"
        disabled={false}
        attemptedSubmit={false}
      >
        <select aria-label="approver">
          <option>Jane</option>
        </select>
      </ApproverSlotCard>,
    );
    expect(container.querySelector(".text-positive")).not.toBeNull();
  });

  it("shows destructive border when required-and-empty-and-attempted-submit", () => {
    const { container } = render(
      <ApproverSlotCard
        slotIndex={0}
        required
        staffId=""
        display=""
        disabled={false}
        attemptedSubmit
      >
        <select aria-label="approver">
          <option>—</option>
        </select>
      </ApproverSlotCard>,
    );
    expect(container.firstChild).toHaveClass("border-destructive");
  });

  it("renders Optional badge for slot 3 when not required", () => {
    render(
      <ApproverSlotCard
        slotIndex={2}
        required={false}
        staffId=""
        display=""
        disabled={false}
        attemptedSubmit={false}
      >
        <select aria-label="approver">
          <option>—</option>
        </select>
      </ApproverSlotCard>,
    );
    expect(screen.getByText(/Optional/i)).toBeInTheDocument();
  });

  it("renders italic display preview when filled", () => {
    render(
      <ApproverSlotCard
        slotIndex={1}
        required
        staffId="abc"
        display="Jane Doe — Manager"
        disabled={false}
        attemptedSubmit={false}
      >
        <select aria-label="approver">
          <option>Jane</option>
        </select>
      </ApproverSlotCard>,
    );
    expect(screen.getByText("Jane Doe — Manager")).toBeInTheDocument();
  });
});
