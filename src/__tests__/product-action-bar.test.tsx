import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProductActionBar } from "@/components/products/product-action-bar";
import type { SelectedProduct } from "@/domains/product/types";

const { discontinueMock } = vi.hoisted(() => ({
  discontinueMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

vi.mock("@/domains/product/api-client", () => ({
  productApi: {
    discontinue: discontinueMock,
  },
}));

vi.mock("@/components/products/barcode-print-view", () => ({
  openBarcodePrintWindow: vi.fn(),
}));

describe("ProductActionBar", () => {
  const selected = new Map<number, SelectedProduct>([
    [101, { sku: 101, description: "FIRST", retailPrice: 10, cost: 5, barcode: null, author: null, title: null, isbn: null, edition: null, catalogNumber: null, vendorId: 1, itemType: "general_merchandise" }],
    [202, { sku: 202, description: "SECOND", retailPrice: 11, cost: 6, barcode: null, author: null, title: null, isbn: null, edition: null, catalogNumber: null, vendorId: 1, itemType: "general_merchandise" }],
  ]);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("confirm", vi.fn(() => true));
    vi.stubGlobal("alert", vi.fn());
  });

  it("keeps failed SKUs selected after a partial discontinue", async () => {
    discontinueMock
      .mockResolvedValueOnce({ sku: 101, mode: "soft", affected: 1 })
      .mockRejectedValueOnce(new Error("Nope"));

    const clearMock = vi.fn();
    const removeManyMock = vi.fn();

    render(
      <ProductActionBar
        selected={selected}
        selectedCount={selected.size}
        onClear={clearMock}
        onRemoveSelected={removeManyMock}
        saveToSession={vi.fn()}
        prismAvailable
        onEditClick={vi.fn()}
        onHardDeleteClick={vi.fn()}
        onBulkEdit={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /Discontinue/i }));

    await waitFor(() => {
      expect(removeManyMock).toHaveBeenCalledWith([101]);
    });

    expect(clearMock).not.toHaveBeenCalled();
  });
});
