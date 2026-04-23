import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProductFiltersExtended } from "@/components/products/product-filters-extended";
import { EMPTY_FILTERS } from "@/domains/product/constants";

vi.mock("@/components/products/dcc-picker", () => ({
  DccPicker: () => <div data-testid="dcc-picker" />,
}));

describe("ProductFiltersExtended", () => {
  it("renders an unset stock upper bound as blank guidance instead of a zero-looking default", () => {
    render(
      <ProductFiltersExtended
        filters={{ ...EMPTY_FILTERS, minStock: "1", maxStock: "" }}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Max stock")).toHaveValue(null);
    expect(screen.getByPlaceholderText("No upper bound")).toBeInTheDocument();
    expect(screen.getByText("Leave blank for no maximum.")).toBeInTheDocument();
  });
});
