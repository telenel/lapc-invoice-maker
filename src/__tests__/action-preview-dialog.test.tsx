import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ActionPreviewDialog } from "@/components/products/action-preview-dialog";
import type { SelectedProduct } from "@/domains/product/types";

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: ReactNode }) =>
    open ? <div data-testid="action-preview">{children}</div> : null,
  DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    disabled,
    ...rest
  }: {
    children?: ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    [key: string]: unknown;
  }) => (
    <button type="button" onClick={onClick} disabled={disabled} {...rest}>
      {children}
    </button>
  ),
}));

afterEach(() => {
  cleanup();
});

function makeProduct(overrides: Partial<SelectedProduct> = {}): SelectedProduct {
  return {
    sku: 1,
    description: "Item",
    retailPrice: 10,
    cost: 5,
    stockOnHand: 8,
    pricingLocationId: 2,
    barcode: "1234",
    author: null,
    title: null,
    isbn: null,
    edition: null,
    catalogNumber: null,
    vendorId: null,
    itemType: "general_merchandise",
    fDiscontinue: 0,
    ...overrides,
  };
}

describe("ActionPreviewDialog", () => {
  it("does not render when open is false", () => {
    render(
      <ActionPreviewDialog
        open={false}
        kind="invoice"
        items={[makeProduct()]}
        locationLabel="PIER"
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    expect(screen.queryByTestId("action-preview")).not.toBeInTheDocument();
  });

  it("renders the invoice title and per-action copy", () => {
    render(
      <ActionPreviewDialog
        open
        kind="invoice"
        items={[makeProduct({ sku: 101, description: "Sample", retailPrice: 12 })]}
        locationLabel="PIER"
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    expect(screen.getByRole("heading", { name: /Create invoice/i })).toBeInTheDocument();
    expect(screen.getAllByText(/PIER/).length).toBeGreaterThan(0);
  });

  it("renders the quote title for quote actions", () => {
    render(
      <ActionPreviewDialog
        open
        kind="quote"
        items={[makeProduct()]}
        locationLabel="PIER"
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    expect(screen.getByRole("heading", { name: /Create quote/i })).toBeInTheDocument();
  });

  it("renders the barcode title for barcode actions", () => {
    render(
      <ActionPreviewDialog
        open
        kind="barcode"
        items={[makeProduct(), makeProduct({ sku: 2, barcode: null, isbn: null })]}
        locationLabel="PIER"
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    expect(screen.getByRole("heading", { name: /Print barcodes/i })).toBeInTheDocument();
    // 1 item missing barcode → warning surfaces
    expect(screen.getByText(/1.*missing barcode/i)).toBeInTheDocument();
  });

  it("renders the quick-picks title for quickpick actions", () => {
    render(
      <ActionPreviewDialog
        open
        kind="quickpick"
        items={[makeProduct()]}
        locationLabel="PIER"
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    expect(screen.getByRole("heading", { name: /Save to Quick Picks/i })).toBeInTheDocument();
  });

  it("lists the first 8 items and overflows the rest", () => {
    const items = Array.from({ length: 12 }, (_, i) =>
      makeProduct({ sku: 100 + i, description: `Item ${i}` }),
    );
    render(
      <ActionPreviewDialog
        open
        kind="invoice"
        items={items}
        locationLabel="PIER"
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    expect(screen.getByText("Item 0")).toBeInTheDocument();
    expect(screen.getByText("Item 7")).toBeInTheDocument();
    expect(screen.queryByText("Item 8")).not.toBeInTheDocument();
    expect(
      screen.getByText((_content, element) => {
        const t = element?.textContent?.replace(/\s+/g, " ").trim() ?? "";
        return /^\+\s*4\s*more…$/.test(t);
      }),
    ).toBeInTheDocument();
  });

  it("warns when invoice items are missing a retail price", () => {
    render(
      <ActionPreviewDialog
        open
        kind="invoice"
        items={[
          makeProduct({ sku: 1, retailPrice: 10 }),
          makeProduct({ sku: 2, retailPrice: null }),
        ]}
        locationLabel="PIER"
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    expect(screen.getByText(/1.*missing price/i)).toBeInTheDocument();
  });

  it("invokes onConfirm when the action button is clicked", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <ActionPreviewDialog
        open
        kind="invoice"
        items={[makeProduct()]}
        locationLabel="PIER"
        onCancel={vi.fn()}
        onConfirm={onConfirm}
      />,
    );
    await user.click(screen.getByRole("button", { name: /Create invoice/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("invokes onCancel when Cancel is clicked", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(
      <ActionPreviewDialog
        open
        kind="invoice"
        items={[makeProduct()]}
        locationLabel="PIER"
        onCancel={onCancel}
        onConfirm={vi.fn()}
      />,
    );
    await user.click(screen.getByRole("button", { name: /Cancel/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("computes a Σ retail line for invoice/quote actions", () => {
    render(
      <ActionPreviewDialog
        open
        kind="invoice"
        items={[
          makeProduct({ sku: 1, retailPrice: 12.5 }),
          makeProduct({ sku: 2, retailPrice: 7.5 }),
        ]}
        locationLabel="PIER"
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    expect(screen.getByText(/\$20\.00/)).toBeInTheDocument();
  });
});
