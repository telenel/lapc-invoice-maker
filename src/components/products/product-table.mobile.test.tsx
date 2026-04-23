import "@testing-library/jest-dom/vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ProductBrowseRow } from "@/domains/product/types";

import { ProductTable } from "./product-table";

vi.mock("@/domains/product/vendor-directory", () => ({
  useVendorDirectory: () => ({
    byId: new Map<number, string>([[21, "Acme Supply"]]),
  }),
  useProductRefDirectory: () => ({
    lookups: {
      taxTypeLabels: new Map<number, string>([[6, "Taxable"]]),
    },
    refs: {
      taxTypes: [],
    },
  }),
}));

vi.mock("./use-hidden-columns", () => ({
  useHiddenColumns: () => ({
    ref: { current: null },
    summary: { tiers: [] },
  }),
}));

function makeProductRow(overrides: Partial<ProductBrowseRow> = {}): ProductBrowseRow {
  return {
    sku: 1001,
    barcode: "123456789012",
    item_type: "general_merchandise",
    description: "Pierce Hoodie",
    author: null,
    title: null,
    isbn: null,
    edition: null,
    retail_price: 39.99,
    cost: 18.25,
    stock_on_hand: 12,
    catalog_number: "HD-1001",
    vendor_id: 21,
    dcc_id: 1313290,
    product_type: "Apparel",
    color_id: null,
    created_at: "2026-04-20T00:00:00.000Z",
    updated_at: "2026-04-20T00:00:00.000Z",
    last_sale_date: "2026-03-10T00:00:00.000Z",
    synced_at: "2026-04-20T00:00:00.000Z",
    dept_num: 10,
    class_num: 2,
    cat_num: 5,
    dept_name: "Apparel",
    class_name: "Sweats",
    cat_name: "Hoodies",
    units_sold_30d: 3,
    units_sold_90d: 8,
    units_sold_1y: 24,
    units_sold_3y: 60,
    units_sold_lifetime: 100,
    revenue_30d: 119.97,
    revenue_90d: 319.92,
    revenue_1y: 959.76,
    revenue_3y: 2399.4,
    revenue_lifetime: 3999,
    txns_1y: 16,
    txns_lifetime: 75,
    first_sale_date_computed: null,
    last_sale_date_computed: null,
    sales_aggregates_computed_at: "2026-04-19T00:00:00.000Z",
    aggregates_ready: true,
    primary_location_id: 2,
    primary_location_abbrev: "PIER",
    selected_inventories: [
      {
        locationId: 2,
        locationAbbrev: "PIER",
        retailPrice: 39.99,
        cost: 18.25,
        stockOnHand: 12,
        lastSaleDate: "2026-03-10T00:00:00.000Z",
      },
    ],
    location_variance: {
      retailPriceVaries: false,
      costVaries: false,
      stockVaries: false,
      lastSaleDateVaries: false,
    },
    itemTaxTypeId: 6,
    discontinued: false,
    ...overrides,
  };
}

describe("ProductTable mobile cards", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the key operating details that mobile users need", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-23T12:00:00.000Z"));

    render(
      <ProductTable
        tab="merchandise"
        products={[makeProductRow()]}
        total={1}
        page={1}
        loading={false}
        sortBy="sku"
        sortDir="asc"
        isSelected={() => false}
        onToggle={vi.fn()}
        onToggleAll={vi.fn()}
        onPageChange={vi.fn()}
        onSort={vi.fn()}
        visibleColumns={["units_1y", "revenue_1y", "txns_1y", "days_since_sale", "updated", "dcc", "margin"]}
      />,
    );

    const mobileCard = screen.getByTestId("product-card-1001");
    const liveStatus = within(mobileCard).getByText("Live");

    expect(within(mobileCard).getByText("Pierce Hoodie")).toBeInTheDocument();
    expect(within(mobileCard).getByText("Acme Supply")).toBeInTheDocument();
    expect(within(mobileCard).getByText(/Last sale/i)).toBeInTheDocument();
    expect(within(mobileCard).getByText(/Mar 2026/i)).toBeInTheDocument();
    expect(within(mobileCard).getByText(/Tax type/i)).toBeInTheDocument();
    expect(within(mobileCard).getByText("Taxable")).toBeInTheDocument();
    expect(within(mobileCard).getByText(/Status/i)).toBeInTheDocument();
    expect(liveStatus).toHaveClass("text-emerald-700");
    expect(liveStatus).not.toHaveClass("text-foreground");
    expect(within(mobileCard).getByText(/Units 1y/i)).toBeInTheDocument();
    expect(within(mobileCard).getByText("24")).toBeInTheDocument();
    expect(within(mobileCard).getByText(/Revenue 1y/i)).toBeInTheDocument();
    expect(within(mobileCard).getByText("$959.76")).toBeInTheDocument();
    expect(within(mobileCard).getByText(/Receipts 1y/i)).toBeInTheDocument();
    expect(within(mobileCard).getByText("16")).toBeInTheDocument();
    expect(within(mobileCard).getByText(/Days since sale/i)).toBeInTheDocument();
    expect(within(mobileCard).getByText("44d")).toBeInTheDocument();
    expect(within(mobileCard).getByText(/Updated/i)).toBeInTheDocument();
    expect(within(mobileCard).getByText("3d ago")).toBeInTheDocument();
    expect(within(mobileCard).getByText(/DCC/i)).toBeInTheDocument();
    expect(within(mobileCard).getByText("10.2.5")).toBeInTheDocument();
    expect(within(mobileCard).getByText(/Margin/i)).toBeInTheDocument();
    expect(within(mobileCard).getAllByText("54.4%").length).toBeGreaterThan(0);
    expect(screen.getByTestId("product-card-margin-visual-1001")).toBeInTheDocument();
  });

  it("toggles a row when the mobile card selection control is pressed", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();

    render(
      <ProductTable
        tab="merchandise"
        products={[makeProductRow()]}
        total={1}
        page={1}
        loading={false}
        sortBy="sku"
        sortDir="asc"
        isSelected={() => false}
        onToggle={onToggle}
        onToggleAll={vi.fn()}
        onPageChange={vi.fn()}
        onSort={vi.fn()}
      />,
    );

    const mobileCard = screen.getByTestId("product-card-1001");

    await user.click(within(mobileCard).getByRole("button", { name: /select pierce hoodie, sku 1001/i }));

    expect(onToggle).toHaveBeenCalledWith(expect.objectContaining({ sku: 1001 }));
  });

  it("exposes a single accessible selection control for each mobile card", () => {
    render(
      <ProductTable
        tab="merchandise"
        products={[makeProductRow()]}
        total={1}
        page={1}
        loading={false}
        sortBy="sku"
        sortDir="asc"
        isSelected={() => false}
        onToggle={vi.fn()}
        onToggleAll={vi.fn()}
        onPageChange={vi.fn()}
        onSort={vi.fn()}
      />,
    );

    expect(screen.getAllByLabelText(/select pierce hoodie, sku 1001/i)).toHaveLength(1);
    expect(screen.queryByRole("checkbox", { name: /select pierce hoodie, sku 1001/i })).not.toBeInTheDocument();
  });

  it("supports keyboard selection through the mobile card button", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();

    render(
      <ProductTable
        tab="merchandise"
        products={[makeProductRow()]}
        total={1}
        page={1}
        loading={false}
        sortBy="sku"
        sortDir="asc"
        isSelected={() => false}
        onToggle={onToggle}
        onToggleAll={vi.fn()}
        onPageChange={vi.fn()}
        onSort={vi.fn()}
      />,
    );

    const mobileCard = screen.getByTestId("product-card-1001");
    const cardButton = within(mobileCard).getByRole("button", { name: /select pierce hoodie, sku 1001/i });
    expect(cardButton).toHaveAttribute("aria-pressed", "false");

    cardButton.focus();
    await user.keyboard("{Enter}");

    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith(expect.objectContaining({ sku: 1001 }));
  });

  it("supports Space key selection through the mobile card button", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();

    render(
      <ProductTable
        tab="merchandise"
        products={[makeProductRow()]}
        total={1}
        page={1}
        loading={false}
        sortBy="sku"
        sortDir="asc"
        isSelected={() => false}
        onToggle={onToggle}
        onToggleAll={vi.fn()}
        onPageChange={vi.fn()}
        onSort={vi.fn()}
      />,
    );

    const cardButton = screen.getByRole("button", { name: /select pierce hoodie, sku 1001/i });
    cardButton.focus();
    await user.keyboard(" ");

    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith(expect.objectContaining({ sku: 1001 }));
  });

  it("does not toggle the row when the cost variance popover trigger is pressed", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();

    render(
      <ProductTable
        tab="merchandise"
        products={[
          makeProductRow({
            selected_inventories: [
              {
                locationId: 2,
                locationAbbrev: "PIER",
                retailPrice: 39.99,
                cost: 18.25,
                stockOnHand: 12,
                lastSaleDate: "2026-03-10T00:00:00.000Z",
              },
              {
                locationId: 3,
                locationAbbrev: "PCOP",
                retailPrice: 39.99,
                cost: 20.5,
                stockOnHand: 12,
                lastSaleDate: "2026-03-10T00:00:00.000Z",
              },
            ],
            location_variance: {
              retailPriceVaries: false,
              costVaries: true,
              stockVaries: false,
              lastSaleDateVaries: false,
            },
          }),
        ]}
        total={1}
        page={1}
        loading={false}
        sortBy="sku"
        sortDir="asc"
        isSelected={() => false}
        onToggle={onToggle}
        onToggleAll={vi.fn()}
        onPageChange={vi.fn()}
        onSort={vi.fn()}
      />,
    );

    const mobileCard = screen.getByTestId("product-card-1001");

    await user.click(within(mobileCard).getByRole("button", { name: /cost values vary across locations/i }));

    expect(onToggle).not.toHaveBeenCalled();
  });

  it("falls back to row-level values when the primary location slice is missing", () => {
    render(
      <ProductTable
        tab="merchandise"
        products={[
          makeProductRow({
            primary_location_id: 99,
            retail_price: 39.99,
            cost: 18.25,
            stock_on_hand: 12,
            selected_inventories: [
              {
                locationId: 2,
                locationAbbrev: "PIER",
                retailPrice: 44.5,
                cost: 20.75,
                stockOnHand: 3,
                lastSaleDate: "2026-03-10T00:00:00.000Z",
              },
            ],
          }),
        ]}
        total={1}
        page={1}
        loading={false}
        sortBy="sku"
        sortDir="asc"
        isSelected={() => false}
        onToggle={vi.fn()}
        onToggleAll={vi.fn()}
        onPageChange={vi.fn()}
        onSort={vi.fn()}
      />,
    );

    const mobileCard = screen.getByTestId("product-card-1001");

    expect(within(mobileCard).getByText("$39.99")).toBeInTheDocument();
    expect(within(mobileCard).getByText("$18.25")).toBeInTheDocument();
    expect(within(mobileCard).getByText("12")).toBeInTheDocument();
  });

  it("clamps future sale dates and hides the margin bar when margin data is invalid", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-23T12:00:00.000Z"));

    render(
      <ProductTable
        tab="merchandise"
        products={[
          makeProductRow({
            effective_last_sale_date: "2026-04-25T00:00:00.000Z",
            retail_price: 0,
            selected_inventories: [
              {
                locationId: 2,
                locationAbbrev: "PIER",
                retailPrice: 0,
                cost: 18.25,
                stockOnHand: 12,
                lastSaleDate: "2026-04-25T00:00:00.000Z",
              },
            ],
          }),
        ]}
        total={1}
        page={1}
        loading={false}
        sortBy="sku"
        sortDir="asc"
        isSelected={() => false}
        onToggle={vi.fn()}
        onToggleAll={vi.fn()}
        onPageChange={vi.fn()}
        onSort={vi.fn()}
        visibleColumns={["days_since_sale", "margin"]}
      />,
    );

    const mobileCard = screen.getByTestId("product-card-1001");

    expect(within(mobileCard).getByText("0d")).toBeInTheDocument();
    expect(within(mobileCard).getByText("—")).toBeInTheDocument();
    expect(screen.queryByTestId("product-card-margin-visual-1001")).not.toBeInTheDocument();
  });

  it("does not toggle the row when a variance popover trigger is pressed", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();

    render(
      <ProductTable
        tab="merchandise"
        products={[
          makeProductRow({
            selected_inventories: [
              {
                locationId: 2,
                locationAbbrev: "PIER",
                retailPrice: 39.99,
                cost: 18.25,
                stockOnHand: 12,
                lastSaleDate: "2026-03-10T00:00:00.000Z",
              },
              {
                locationId: 3,
                locationAbbrev: "PCOP",
                retailPrice: 41.99,
                cost: 18.25,
                stockOnHand: 12,
                lastSaleDate: "2026-03-10T00:00:00.000Z",
              },
            ],
            location_variance: {
              retailPriceVaries: true,
              costVaries: false,
              stockVaries: false,
              lastSaleDateVaries: false,
            },
          }),
        ]}
        total={1}
        page={1}
        loading={false}
        sortBy="sku"
        sortDir="asc"
        isSelected={() => false}
        onToggle={onToggle}
        onToggleAll={vi.fn()}
        onPageChange={vi.fn()}
        onSort={vi.fn()}
      />,
    );

    const mobileCard = screen.getByTestId("product-card-1001");

    await user.click(within(mobileCard).getByRole("button", { name: /retail values vary across locations/i }));

    expect(onToggle).not.toHaveBeenCalled();
  });

  it("renders fallback mobile states for discontinued, pending analytics, sparse DCC, and never-sold rows", () => {
    render(
      <ProductTable
        tab="merchandise"
        products={[
          makeProductRow({
            discontinued: true,
            aggregates_ready: false,
            sales_aggregates_computed_at: null,
            stock_on_hand: null,
            last_sale_date: "1970-01-01T00:00:00.000Z",
            class_num: null,
            selected_inventories: [
              {
                locationId: 2,
                locationAbbrev: "PIER",
                retailPrice: 39.99,
                cost: 18.25,
                stockOnHand: null,
                lastSaleDate: null,
              },
            ],
          }),
        ]}
        total={1}
        page={1}
        loading={false}
        sortBy="sku"
        sortDir="asc"
        isSelected={() => false}
        onToggle={vi.fn()}
        onToggleAll={vi.fn()}
        onPageChange={vi.fn()}
        onSort={vi.fn()}
        visibleColumns={["revenue_1y", "days_since_sale", "dcc"]}
      />,
    );

    const mobileCard = screen.getByTestId("product-card-1001");

    expect(within(mobileCard).getByText("Discontinued")).toHaveClass("text-amber-700");
    expect(within(mobileCard).getByText("Pending")).toBeInTheDocument();
    expect(within(mobileCard).getByText("Never")).toBeInTheDocument();
    expect(within(mobileCard).getByText("10.·.5")).toBeInTheDocument();
    expect(within(mobileCard).getAllByText("—").length).toBeGreaterThan(0);
  });

  it("prefers primary location slice values in the mobile stats", () => {
    render(
      <ProductTable
        tab="merchandise"
        products={[
          makeProductRow({
            retail_price: 39.99,
            cost: 18.25,
            stock_on_hand: 12,
            selected_inventories: [
              {
                locationId: 2,
                locationAbbrev: "PIER",
                retailPrice: 44.5,
                cost: 20.75,
                stockOnHand: 3,
                lastSaleDate: "2026-03-10T00:00:00.000Z",
              },
            ],
          }),
        ]}
        total={1}
        page={1}
        loading={false}
        sortBy="sku"
        sortDir="asc"
        isSelected={() => false}
        onToggle={vi.fn()}
        onToggleAll={vi.fn()}
        onPageChange={vi.fn()}
        onSort={vi.fn()}
      />,
    );

    const mobileCard = screen.getByTestId("product-card-1001");

    expect(within(mobileCard).getByText("$44.50")).toBeInTheDocument();
    expect(within(mobileCard).getByText("$20.75")).toBeInTheDocument();
    expect(within(mobileCard).getByText("3")).toBeInTheDocument();
  });

  it("uses textbook title and description fallbacks plus ISBN details on mobile cards", () => {
    render(
      <ProductTable
        tab="textbooks"
        products={[
          makeProductRow({
            sku: 1001,
            item_type: "textbook",
            title: "Introduction to Economics",
            description: "Fallback description",
            isbn: "9780134093413",
            barcode: null,
          }),
          makeProductRow({
            sku: 1002,
            item_type: "textbook",
            title: null,
            description: "Uses description fallback",
            isbn: "9780131103627",
            barcode: null,
          }),
        ]}
        total={2}
        page={1}
        loading={false}
        sortBy="sku"
        sortDir="asc"
        isSelected={() => false}
        onToggle={vi.fn()}
        onToggleAll={vi.fn()}
        onPageChange={vi.fn()}
        onSort={vi.fn()}
      />,
    );

    const primaryCard = screen.getByTestId("product-card-1001");
    const fallbackCard = screen.getByTestId("product-card-1002");

    expect(within(primaryCard).getByText("Introduction to Economics")).toBeInTheDocument();
    expect(within(primaryCard).getByText(/ISBN 9780134093413/i)).toBeInTheDocument();
    expect(within(fallbackCard).getByText("Uses description fallback")).toBeInTheDocument();
    expect(within(fallbackCard).getByText(/ISBN 9780131103627/i)).toBeInTheDocument();
  });
});
