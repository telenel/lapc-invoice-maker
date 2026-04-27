import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { DraftStateCard } from "./draft-state-card";

describe("DraftStateCard", () => {
  it("shows Saved with relative time", () => {
    render(<DraftStateCard isDirty={false} savingDraft={false} lastSavedAt={Date.now() - 120000} />);
    expect(screen.getByText(/Saved/)).toBeInTheDocument();
    expect(screen.getByText(/2m ago/)).toBeInTheDocument();
  });
  it("shows Saving…", () => {
    render(<DraftStateCard isDirty savingDraft lastSavedAt={null} />);
    expect(screen.getByText(/Saving/)).toBeInTheDocument();
  });
  it("shows Unsaved changes", () => {
    render(<DraftStateCard isDirty savingDraft={false} lastSavedAt={null} />);
    expect(screen.getByText(/Unsaved changes/)).toBeInTheDocument();
  });
});
