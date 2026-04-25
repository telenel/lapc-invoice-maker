import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  ProductFilterSummary,
  ProductFiltersBar,
  getProductActiveFilterChips,
} from "@/components/products/product-filters";
import { EMPTY_FILTERS } from "@/domains/product/constants";
import { EMPTY_REFS, buildProductRefMaps } from "@/domains/product/ref-data";

vi.mock("@/domains/product/vendor-directory", () => ({
  useVendorDirectory: () => ({
    refs: null,
    lookups: buildProductRefMaps(EMPTY_REFS),
    vendors: [],
    byId: new Map<number, string>([[21, "PENS ETC (3001795)"]]),
    loading: false,
    available: true,
  }),
}));

describe("ProductFiltersBar", () => {
  it("summarizes all active product filters, not just DCC", () => {
    const labels = getProductActiveFilterChips({
      ...EMPTY_FILTERS,
      search: "scantron",
      minPrice: "1",
      maxPrice: "12",
      minStock: "1",
      unitsSoldWindow: "30d",
      minUnitsSold: "10",
      discontinued: "no",
    }).map((chip) => chip.label);

    expect(labels).toEqual(expect.arrayContaining([
      "Search: scantron",
      "Price: $1-$12",
      "Stock: >= 1",
      "Units sold 30d: >= 10",
      "Not discontinued",
    ]));
  });

  it("keeps the active preset and filters visible in the list summary", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onClearPreset = vi.fn();

    render(
      <ProductFilterSummary
        filters={{ ...EMPTY_FILTERS, minUnitsSold: "10", unitsSoldWindow: "30d", page: 2 }}
        activeViewName="Top sellers - 30d"
        onChange={onChange}
        onClear={vi.fn()}
        onClearPreset={onClearPreset}
      />,
    );

    expect(screen.getByText("Applied list state")).toBeInTheDocument();
    expect(screen.getByText("Top sellers - 30d")).toBeInTheDocument();
    expect(screen.getByText("Units sold 30d: >= 10")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Clear Units sold 30d: >= 10 filter" }));

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      minUnitsSold: "",
      maxUnitsSold: "",
      unitsSoldWindow: "",
      page: 1,
    }));

    await user.click(screen.getByRole("button", { name: "Clear preset Top sellers - 30d" }));

    expect(onClearPreset).toHaveBeenCalled();
  });

  it("renders and clears the composite DCC chip", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <ProductFiltersBar
        filters={{ ...EMPTY_FILTERS, dccComposite: "30-10-10" }}
        onChange={onChange}
        onClear={vi.fn()}
      />,
    );

    expect(screen.getByText("DCC: 30-10-10")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Clear DCC: 30-10-10 filter" }),
    );

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      dccComposite: "",
      deptNum: "",
      classNum: "",
      catNum: "",
      page: 1,
    }));
  });

  it("makes exact last-sale date filters discoverable and visibly active", () => {
    render(
      <ProductFiltersBar
        filters={{ ...EMPTY_FILTERS, lastSaleDateFrom: "2026-04-01" }}
        onChange={vi.fn()}
        onClear={vi.fn()}
      />,
    );

    expect(screen.getByText("Type or pick exact dates to narrow the last-sale window.")).toBeInTheDocument();
    expect(screen.getByText("Date range active")).toBeInTheDocument();
  });

  it("gives selected vendors room to read and a clear undo affordance", () => {
    render(
      <ProductFiltersBar
        filters={{ ...EMPTY_FILTERS, vendorId: "21" }}
        onChange={vi.fn()}
        onClear={vi.fn()}
      />,
    );

    expect(screen.getByText("PENS ETC (3001795)")).toBeInTheDocument();
    expect(screen.getByText("Vendor #21")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear vendor" })).toHaveTextContent("Clear");
  });
});
