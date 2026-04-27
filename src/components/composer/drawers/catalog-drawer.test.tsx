import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { CatalogDrawer } from "./catalog-drawer";

vi.mock("@/components/shared/lazy-product-search-panel", () => ({
  LazyProductSearchPanel: ({ onAddProducts }: { onAddProducts: (p: unknown[]) => void }) => (
    <button onClick={() => onAddProducts([{ sku: 1, description: "A", retailPrice: 5 }])}>add</button>
  ),
}));

describe("CatalogDrawer", () => {
  it("renders header + body when open", () => {
    render(<CatalogDrawer open onOpenChange={() => {}} categoryFilter={undefined} onAddItems={vi.fn()} />);
    expect(screen.getByText(/Product Catalog/i)).toBeInTheDocument();
  });

  it("calls onAddItems when products are picked from the panel", async () => {
    const userEvent = (await import("@testing-library/user-event")).default;
    const onAddItems = vi.fn();
    render(<CatalogDrawer open onOpenChange={() => {}} onAddItems={onAddItems} />);
    await userEvent.setup().click(screen.getByText("add"));
    expect(onAddItems).toHaveBeenCalled();
  });
});
