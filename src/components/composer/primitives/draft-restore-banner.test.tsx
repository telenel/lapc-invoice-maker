import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { DraftRestoreBanner } from "./draft-restore-banner";

describe("DraftRestoreBanner", () => {
  it("renders metadata and fires callbacks", async () => {
    const onResume = vi.fn();
    const onDiscard = vi.fn();
    const user = userEvent.setup();
    render(
      <DraftRestoreBanner
        savedAt={Date.now() - 90_000}
        itemCount={3}
        total={42.5}
        onResume={onResume}
        onDiscard={onDiscard}
      />
    );
    expect(screen.getByText(/3 line items/)).toBeInTheDocument();
    expect(screen.getByText(/\$42\.50/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Restore Draft/i }));
    expect(onResume).toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: /Discard/i }));
    expect(onDiscard).toHaveBeenCalled();
  });
});
