import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PrismWriteConfirmationDialog } from "@/components/products/prism-write-confirmation-dialog";

describe("PrismWriteConfirmationDialog", () => {
  it("requires the acknowledgment checkbox and typed confirmation phrase before enabling the write", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();

    render(
      <PrismWriteConfirmationDialog
        open
        onOpenChange={vi.fn()}
        title="Write to Prism?"
        description="Test dialog"
        warnings={["This is a live write."]}
        confirmPhrase="WRITE TO PRISM"
        confirmLabel="Save"
        onConfirm={onConfirm}
      />,
    );

    const confirmButton = screen.getByRole("button", { name: "Save" });
    expect(confirmButton).toBeDisabled();

    await user.click(screen.getByRole("checkbox"));
    expect(confirmButton).toBeDisabled();

    await user.type(screen.getByLabelText(/type write to prism to continue/i), "WRONG PHRASE");
    expect(confirmButton).toBeDisabled();

    await user.clear(screen.getByLabelText(/type write to prism to continue/i));
    await user.type(screen.getByLabelText(/type write to prism to continue/i), "WRITE TO PRISM");
    expect(confirmButton).toBeEnabled();

    await user.click(confirmButton);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
