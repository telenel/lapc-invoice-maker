import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { InvoiceActionButtons } from "./invoice-action-buttons";

describe("InvoiceActionButtons", () => {
  it("disables PDF generation while PrismCore is uploading", async () => {
    const user = userEvent.setup();
    const onGenerate = vi.fn();

    render(
      <InvoiceActionButtons
        isRunning={false}
        saving={false}
        prismcoreUploading
        isMac={false}
        onSaveAsTemplate={vi.fn()}
        onSaveDraft={vi.fn()}
        onGenerate={onGenerate}
      />,
    );

    const generateButton = screen.getByRole("button", { name: /generate pdf/i });

    expect(generateButton).toBeDisabled();

    await user.click(generateButton);

    expect(onGenerate).not.toHaveBeenCalled();
  });
});
