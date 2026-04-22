import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ProductFiltersBar } from "@/components/products/product-filters";
import { EMPTY_FILTERS } from "@/domains/product/constants";

vi.mock("@/domains/product/vendor-directory", () => ({
  useVendorDirectory: () => ({
    vendors: [],
    byId: new Map<number, string>(),
    loading: false,
    available: true,
  }),
}));

describe("ProductFiltersBar", () => {
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
});
