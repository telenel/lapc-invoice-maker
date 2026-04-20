import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProductActionBar } from "./product-action-bar";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  },
}));

vi.mock("@/domains/product/vendor-directory", () => ({
  useVendorDirectory: () => ({
    byId: new Map<number, string>(),
  }),
}));

vi.mock("./barcode-print-view", () => ({
  openBarcodePrintWindow: vi.fn(),
}));

describe("ProductActionBar", () => {
  it("shows a visible explanation when selected rows are missing pricing required for downstream actions", () => {
    render(
      <ProductActionBar
        selected={
          new Map([
            [101, {
              sku: 101,
              description: "Missing price item",
              retailPrice: null,
              cost: 12,
              barcode: null,
              author: null,
              title: null,
              isbn: null,
              edition: null,
              catalogNumber: null,
              vendorId: null,
              itemType: "general_merchandise",
            }],
            [102, {
              sku: 102,
              description: "Missing cost item",
              retailPrice: 24,
              cost: null,
              barcode: null,
              author: null,
              title: null,
              isbn: null,
              edition: null,
              catalogNumber: null,
              vendorId: null,
              itemType: "general_merchandise",
            }],
          ])
        }
        selectedCount={2}
        onClear={vi.fn()}
        saveToSession={vi.fn()}
        prismAvailable
        onEditClick={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: /Create Invoice/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Create Quote/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /^Edit$/i })).toBeDisabled();
    expect(
      screen.getByText(/1 selected item is missing retail price, so invoice and quote creation are unavailable/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/2 selected items are missing retail or cost, so edit is unavailable/i),
    ).toBeInTheDocument();
  });
});
