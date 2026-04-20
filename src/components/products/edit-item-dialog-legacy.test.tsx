import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EditItemDialogLegacy } from "./edit-item-dialog-legacy";

vi.mock("@/domains/product/vendor-directory", () => ({
  useProductRefDirectory: () => ({
    refs: null,
    loading: false,
    available: false,
  }),
}));

describe("EditItemDialogLegacy", () => {
  it("renders blank retail and cost inputs for nullable single-item snapshots", () => {
    render(
      <EditItemDialogLegacy
        open
        onOpenChange={vi.fn()}
        items={[
          {
            sku: 2001,
            barcode: null,
            retail: null,
            cost: null,
            fDiscontinue: 0,
            description: "Used chemistry",
            isTextbook: true,
          },
        ]}
      />,
    );

    expect(screen.getByLabelText("Retail")).toHaveValue(null);
    expect(screen.getByLabelText("Cost")).toHaveValue(null);
  });
});
