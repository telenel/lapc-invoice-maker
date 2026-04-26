import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProductActionBar } from "./product-action-bar";
import type { SelectedProduct } from "@/domains/product/types";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: { user: { role: "admin" } } }),
}));

vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div {...props}>{children}</div>
    ),
  },
}));

vi.mock("@/domains/product/vendor-directory", () => ({
  useVendorDirectory: () => ({ byId: new Map<number, string>() }),
}));

vi.mock("@/domains/product/api-client", () => ({
  productApi: { discontinue: vi.fn() },
}));

vi.mock("./barcode-print-view", () => ({
  openBarcodePrintWindow: vi.fn(),
}));

beforeEach(() => {
  pushMock.mockReset();
});

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

describe("ProductActionBar — refreshed selection tray", () => {
  it("renders preview chips for the first three selected items", () => {
    const items = [
      makeProduct({ sku: 101, description: "Brahmas Hoodie L" }),
      makeProduct({ sku: 102, description: "Brahmas Hoodie M" }),
      makeProduct({ sku: 103, description: "Brahmas Tee" }),
      makeProduct({ sku: 104, description: "Pencil 12pk" }),
    ];
    render(
      <ProductActionBar
        selected={new Map(items.map((p) => [p.sku, p] as const))}
        selectedCount={items.length}
        onClear={vi.fn()}
        saveToSession={vi.fn()}
      />,
    );

    expect(screen.getByText(/Brahmas Hoodie L/i)).toBeInTheDocument();
    expect(screen.getByText(/Brahmas Hoodie M/i)).toBeInTheDocument();
    expect(screen.getByText(/Brahmas Tee/i)).toBeInTheDocument();
    expect(screen.queryByText(/Pencil 12pk/i)).not.toBeInTheDocument();
    expect(
      screen.getByText((_content, element) => {
        const t = element?.textContent?.replace(/\s+/g, " ").trim() ?? "";
        return /^\+\s*1\s*more$/.test(t);
      }),
    ).toBeInTheDocument();
  });

  it("surfaces a discontinued health chip when any selected item is discontinued", () => {
    render(
      <ProductActionBar
        selected={
          new Map([
            [201, makeProduct({ sku: 201, description: "Live", fDiscontinue: 0 })],
            [202, makeProduct({ sku: 202, description: "Disc'd", fDiscontinue: 1 })],
          ])
        }
        selectedCount={2}
        onClear={vi.fn()}
        saveToSession={vi.fn()}
      />,
    );

    expect(screen.getByText(/1 discontinued/i)).toBeInTheDocument();
  });

  it("surfaces a missing-barcode health chip", () => {
    render(
      <ProductActionBar
        selected={
          new Map([
            [301, makeProduct({ sku: 301, barcode: null })],
            [302, makeProduct({ sku: 302, barcode: "0987" })],
          ])
        }
        selectedCount={2}
        onClear={vi.fn()}
        saveToSession={vi.fn()}
      />,
    );

    expect(screen.getByText(/1 missing barcode/i)).toBeInTheDocument();
  });

  it("flags mixed locations when selections span more than one pricing location", () => {
    render(
      <ProductActionBar
        selected={
          new Map([
            [401, makeProduct({ sku: 401, pricingLocationId: 2 })],
            [402, makeProduct({ sku: 402, pricingLocationId: 3 })],
          ])
        }
        selectedCount={2}
        onClear={vi.fn()}
        saveToSession={vi.fn()}
      />,
    );

    expect(screen.getByText(/Mixed locations/i)).toBeInTheDocument();
  });

  it("renders grouped action labels for Create / Output / Modify", () => {
    render(
      <ProductActionBar
        selected={new Map([[501, makeProduct({ sku: 501 })]])}
        selectedCount={1}
        onClear={vi.fn()}
        saveToSession={vi.fn()}
        prismAvailable
        onEditClick={vi.fn()}
        onBulkEdit={vi.fn()}
      />,
    );

    expect(screen.getByText("CREATE")).toBeInTheDocument();
    expect(screen.getByText("OUTPUT")).toBeInTheDocument();
    expect(screen.getByText("MODIFY")).toBeInTheDocument();
  });

  it("offsets the floating tray to the left when the inspector is open", () => {
    const { rerender } = render(
      <ProductActionBar
        selected={new Map([[601, makeProduct({ sku: 601 })]])}
        selectedCount={1}
        onClear={vi.fn()}
        saveToSession={vi.fn()}
      />,
    );

    // Closed: full-width offset (right defaults to a small viewport gap)
    const closedTray = screen.getByTestId("selection-tray");
    const closedRight = closedTray.style.right;

    rerender(
      <ProductActionBar
        selected={new Map([[601, makeProduct({ sku: 601 })]])}
        selectedCount={1}
        onClear={vi.fn()}
        saveToSession={vi.fn()}
        inspectorOpen
      />,
    );

    const openTray = screen.getByTestId("selection-tray");
    expect(openTray.style.right).not.toBe(closedRight);
    // Right offset should be at least the inspector width (320px) + margin.
    const px = parseInt(openTray.style.right.replace("px", ""), 10);
    expect(px).toBeGreaterThan(320);
  });

  it("shows a 'Selection healthy' chip when no warnings apply", () => {
    render(
      <ProductActionBar
        selected={new Map([[701, makeProduct({ sku: 701 })]])}
        selectedCount={1}
        onClear={vi.fn()}
        saveToSession={vi.fn()}
      />,
    );

    expect(screen.getByText(/Selection healthy/i)).toBeInTheDocument();
  });
});
