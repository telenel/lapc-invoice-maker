import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProductFilterChipBar } from "@/components/products/product-filter-chip-bar";
import { EMPTY_FILTERS } from "@/domains/product/constants";
import type { ProductFilters } from "@/domains/product/types";

afterEach(() => {
  cleanup();
});

const baseFilters: ProductFilters = { ...EMPTY_FILTERS, minStock: "1" };

describe("ProductFilterChipBar", () => {
  it("renders the In-stock toggle chip in active state when minStock is set", () => {
    const onChange = vi.fn();
    render(
      <ProductFilterChipBar
        filters={baseFilters}
        onChange={onChange}
        onClear={vi.fn()}
      />,
    );

    const inStockChip = screen.getByRole("button", { name: /In stock/i });
    expect(inStockChip).toHaveAttribute("aria-pressed", "true");
  });

  it("toggles minStock when In stock is clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <ProductFilterChipBar
        filters={baseFilters}
        onChange={onChange}
        onClear={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: /In stock/i }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0][0] as ProductFilters;
    expect(next.minStock).toBe("");
  });

  it("activates Sold-30d shortcut by setting lastSaleWithin", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <ProductFilterChipBar
        filters={baseFilters}
        onChange={onChange}
        onClear={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Sold last 30d/i }));

    const next = onChange.mock.calls[0][0] as ProductFilters;
    expect(next.lastSaleWithin).toBe("30d");
  });

  it("renders active-value chip with clear button for vendor", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <ProductFilterChipBar
        filters={{ ...baseFilters, vendorId: "42" }}
        onChange={onChange}
        onClear={vi.fn()}
      />,
    );

    const clearVendor = screen.getByRole("button", { name: /Clear .*Vendor/i });
    await user.click(clearVendor);

    const next = onChange.mock.calls[0][0] as ProductFilters;
    expect(next.vendorId).toBe("");
  });

  it("shows Reset to baseline when filters depart from baseline", () => {
    const onClear = vi.fn();
    render(
      <ProductFilterChipBar
        filters={{ ...baseFilters, vendorId: "42" }}
        onChange={vi.fn()}
        onClear={onClear}
      />,
    );

    const reset = screen.getByRole("button", { name: /Reset to baseline/i });
    expect(reset).toBeInTheDocument();
  });

  it("hides Reset to baseline when only the baseline minStock=1 is set", () => {
    render(
      <ProductFilterChipBar
        filters={baseFilters}
        onChange={vi.fn()}
        onClear={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: /Reset to baseline/i })).toBeNull();
  });

  it("invokes onAdvancedToggle when the Advanced button is clicked", async () => {
    const user = userEvent.setup();
    const onAdvanced = vi.fn();
    render(
      <ProductFilterChipBar
        filters={baseFilters}
        onChange={vi.fn()}
        onClear={vi.fn()}
        advancedOpen={false}
        onAdvancedToggle={onAdvanced}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Advanced/i }));
    expect(onAdvanced).toHaveBeenCalledTimes(1);
  });

  it("renders the active preset chip with a clear control", async () => {
    const user = userEvent.setup();
    const onClearPreset = vi.fn();
    render(
      <ProductFilterChipBar
        filters={baseFilters}
        onChange={vi.fn()}
        onClear={vi.fn()}
        activeViewName="Stockout risk"
        onClearPreset={onClearPreset}
      />,
    );

    expect(screen.getByText("Stockout risk")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Clear preset/i }));
    expect(onClearPreset).toHaveBeenCalledTimes(1);
  });
});
