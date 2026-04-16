import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProductSearchPanel } from "./product-search-panel";

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
  },
}));

vi.mock("@/domains/product/queries", () => ({
  searchProducts: vi.fn().mockResolvedValue({
    total: 2,
    products: [
      {
        sku: 10000014,
        title: "Brave New World",
        description: null,
        retail_price: 135.55,
        cost: 90,
        barcode: null,
        author: "Huxley",
        isbn: "9780060850524",
        edition: "10",
        catalog_number: null,
        vendor_id: null,
        item_type: "textbook",
        product_type: null,
      },
      {
        sku: 10000021,
        title: null,
        description: "SKU-only product",
        retail_price: 101.7,
        cost: 65,
        barcode: null,
        author: null,
        isbn: null,
        edition: null,
        catalog_number: null,
        vendor_id: null,
        item_type: "general_merchandise",
        product_type: null,
      },
    ],
  }),
}));

describe("ProductSearchPanel", () => {
  it("reserves scroll clearance so the add button does not cover product rows", async () => {
    const { container } = render(<ProductSearchPanel onAddProducts={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("BRAVE NEW WORLD")).toBeInTheDocument();
    });

    const scrollRegion = container.querySelector("div.max-h-\\[500px\\].overflow-y-auto");
    const list = container.querySelector("ul.divide-y");
    const addButton = screen.getByRole("button", { name: /Add to Line Items/i });

    expect(scrollRegion).toHaveClass("scroll-pb-16");
    expect(list).toHaveClass("pb-16");
    expect(addButton.parentElement).toHaveClass("sticky", "bottom-0", "z-10");
  });
});
