import "@testing-library/jest-dom/vitest";
import { StrictMode } from "react";
import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import NewInvoicePage from "@/app/invoices/new/page";

const {
  useInvoiceFormMock,
  searchParamsState,
} = vi.hoisted(() => ({
  useInvoiceFormMock: vi.fn(() => ({
    form: { items: [] },
    subtotal: 0,
    taxAmount: 0,
    grandTotal: 0,
  })),
  searchParamsState: {
    current: new URLSearchParams("from=catalog"),
  },
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => searchParamsState.current,
}));

vi.mock("@/components/invoice/invoice-form", () => ({
  useInvoiceForm: useInvoiceFormMock,
}));

vi.mock("@/components/invoice/keyboard-mode", () => ({
  KeyboardMode: () => null,
}));

vi.mock("@/components/shared/product-search-panel", () => ({
  ProductSearchPanel: () => null,
}));

vi.mock("@/components/shared/register-print-view", () => ({
  openRegisterPrintWindow: vi.fn(),
}));

describe("NewInvoicePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    searchParamsState.current = new URLSearchParams("from=catalog");
  });

  it("preserves catalog transfer data through Strict Mode initialization", async () => {
    sessionStorage.setItem(
      "catalog-selected-items",
      JSON.stringify([
        {
          sku: 123,
          description: "Pierce mug",
          retailPrice: 19.95,
          cost: 9.5,
        },
      ]),
    );

    render(
      <StrictMode>
        <NewInvoicePage />
      </StrictMode>,
    );

    await waitFor(() => {
      expect(useInvoiceFormMock).toHaveBeenCalledWith(
        expect.objectContaining({
          items: [
            expect.objectContaining({
              sku: "123",
              description: "PIERCE MUG",
              unitPrice: 19.95,
              costPrice: 9.5,
            }),
          ],
        }),
      );
    });
  });
});
