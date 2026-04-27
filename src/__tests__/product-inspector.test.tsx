import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProductInspector } from "@/components/products/product-inspector";
import type { ProductBrowseRow } from "@/domains/product/types";

afterEach(() => {
  cleanup();
});

function makeRow(overrides: Partial<ProductBrowseRow> = {}): ProductBrowseRow {
  return {
    sku: 10003855,
    barcode: "123456789012",
    itemTaxTypeId: 1,
    item_type: "textbook",
    description: "TORTILLA CURTAIN",
    author: "BOYLE",
    title: "TORTILLA CURTAIN",
    isbn: "9780140238280",
    edition: "1e",
    retail_price: 18.99,
    cost: 9.18,
    stock_on_hand: 12,
    catalog_number: "ENG 101",
    vendor_id: 42,
    dcc_id: 10,
    product_type: null,
    color_id: null,
    created_at: null,
    updated_at: "2026-04-25T10:00:00Z",
    last_sale_date: "2026-04-20T00:00:00Z",
    synced_at: "2026-04-26T08:00:00Z",
    dept_num: 10,
    class_num: 1,
    cat_num: 0,
    dept_name: "Textbooks",
    class_name: "New",
    cat_name: null,
    units_sold_30d: 0,
    units_sold_90d: 0,
    units_sold_1y: 0,
    units_sold_3y: 0,
    units_sold_lifetime: 0,
    revenue_30d: 0,
    revenue_90d: 0,
    revenue_1y: 0,
    revenue_3y: 0,
    revenue_lifetime: 0,
    txns_1y: 0,
    txns_lifetime: 0,
    first_sale_date_computed: null,
    last_sale_date_computed: "2026-04-20T00:00:00Z",
    sales_aggregates_computed_at: "2026-04-26T08:00:00Z",
    discontinued: false,
    primary_location_id: 2,
    primary_location_abbrev: "PIER",
    selected_inventories: [
      {
        locationId: 2,
        locationAbbrev: "PIER",
        retailPrice: 18.99,
        cost: 9.18,
        stockOnHand: 12,
        lastSaleDate: "2026-04-20T00:00:00Z",
      },
      {
        locationId: 3,
        locationAbbrev: "PCOP",
        retailPrice: 19.49,
        cost: 9.18,
        stockOnHand: 4,
        lastSaleDate: null,
      },
    ],
    location_variance: {
      retailPriceVaries: true,
      costVaries: false,
      stockVaries: true,
      lastSaleDateVaries: true,
    },
    ...overrides,
  };
}

describe("ProductInspector", () => {
  it("shows an empty-state when no product is focused", () => {
    render(
      <ProductInspector
        product={null}
        primaryLocationId={2}
        prismAvailable={true}
        onClose={vi.fn()}
        onAction={vi.fn()}
      />,
    );

    expect(screen.getByText(/No item focused/i)).toBeInTheDocument();
  });

  it("renders header, pricing grid, and stock-by-location for the focused product", () => {
    render(
      <ProductInspector
        product={makeRow()}
        primaryLocationId={2}
        prismAvailable={true}
        onClose={vi.fn()}
        onAction={vi.fn()}
      />,
    );

    expect(screen.getByText("TORTILLA CURTAIN")).toBeInTheDocument();
    expect(screen.getByText(/10003855/)).toBeInTheDocument();
    expect(screen.getByText(/\$9\.18/)).toBeInTheDocument();
    expect(screen.getAllByText(/\$18\.99/).length).toBeGreaterThan(0);
    expect(screen.getByText("PIER")).toBeInTheDocument();
    expect(screen.getByText("PCOP")).toBeInTheDocument();
  });

  it("flags a price variance with a Δ indicator on locations whose retail differs from base", () => {
    render(
      <ProductInspector
        product={makeRow()}
        primaryLocationId={2}
        prismAvailable={true}
        onClose={vi.fn()}
        onAction={vi.fn()}
      />,
    );

    expect(screen.getByText(/\$19\.49/)).toBeInTheDocument();
    expect(screen.getAllByLabelText(/Price variance/i).length).toBeGreaterThan(0);
  });

  it("invokes onClose when the close button is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <ProductInspector
        product={makeRow()}
        primaryLocationId={2}
        prismAvailable={true}
        onClose={onClose}
        onAction={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Close inspector/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("disables Edit and Discontinue when Prism is unreachable", () => {
    render(
      <ProductInspector
        product={makeRow()}
        primaryLocationId={2}
        prismAvailable={false}
        onClose={vi.fn()}
        onAction={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: /^Edit$/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Discontinue/i })).toBeDisabled();
    expect(screen.getByText(/Prism unreachable/i)).toBeInTheDocument();
  });

  it("disables Create invoice + Create quote when the scoped retail price is missing", () => {
    // Drop retail at the primary location so the focused product has no
    // scoped retail. Without this guard the inspector confirms the action
    // and the destination page silently filters out the only item, leaving
    // the operator with an empty invoice/quote draft.
    const product = makeRow({
      retail_price: null,
      selected_inventories: [
        {
          locationId: 2,
          locationAbbrev: "PIER",
          retailPrice: null,
          cost: 9.18,
          stockOnHand: 12,
          lastSaleDate: "2026-04-20T00:00:00Z",
        },
      ],
    });
    render(
      <ProductInspector
        product={product}
        primaryLocationId={2}
        prismAvailable={true}
        onClose={vi.fn()}
        onAction={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: /Create invoice with this item/i }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /Create quote with this item/i }),
    ).toBeDisabled();
  });

  it("still disables Create invoice + Create quote when the scoped slice is null but the base retail is set", () => {
    // The scoped slice has no retail at the current location, even though
    // product.retail_price is non-null (a stale base value from another
    // location's data). Falling back to the base would hand off the wrong
    // price; the strict guard must still block the action.
    const product = makeRow({
      retail_price: 24.99,
      selected_inventories: [
        {
          locationId: 2,
          locationAbbrev: "PIER",
          retailPrice: null,
          cost: 9.18,
          stockOnHand: 12,
          lastSaleDate: "2026-04-20T00:00:00Z",
        },
      ],
    });
    render(
      <ProductInspector
        product={product}
        primaryLocationId={2}
        prismAvailable={true}
        onClose={vi.fn()}
        onAction={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: /Create invoice with this item/i }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /Create quote with this item/i }),
    ).toBeDisabled();
  });

  it("dispatches action handlers with kind + product", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    const product = makeRow();
    render(
      <ProductInspector
        product={product}
        primaryLocationId={2}
        prismAvailable={true}
        onClose={vi.fn()}
        onAction={onAction}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Create invoice/i }));
    expect(onAction).toHaveBeenLastCalledWith("invoice", product);

    await user.click(screen.getByRole("button", { name: /Print barcode/i }));
    expect(onAction).toHaveBeenLastCalledWith("barcode", product);
  });
});
