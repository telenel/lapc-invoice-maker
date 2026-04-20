import "@testing-library/jest-dom/vitest";
import React, { useEffect, useMemo, useState } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  formatLocationVarianceBadge,
  formatVendorDisplay,
  getLocationValueRows,
  getProductAnalyticsDisplay,
  getProductDisplaySaleDate,
  hasProductAnalyticsReady,
} from "@/components/products/product-table";
import { ProductTable } from "@/components/products/product-table";
import type { ProductBrowseRow } from "@/domains/product/types";
import { useProductInlineEdit, type ProductInlineEditRowBaseline } from "@/components/products/use-product-inline-edit";

const { updateMock, toastErrorMock } = vi.hoisted(() => ({
  updateMock: vi.fn(),
  toastErrorMock: vi.fn(),
}));

vi.mock("@/domains/product/api-client", () => ({
  productApi: {
    update: updateMock,
  },
}));

vi.mock("sonner", () => ({
  toast: {
    error: toastErrorMock,
  },
}));

vi.mock("@/domains/product/vendor-directory", () => ({
  useVendorDirectory: () => ({
    byId: new Map<number, string>(),
  }),
  useProductRefDirectory: () => ({
    refs: {
      vendors: [],
      dccs: [],
      taxTypes: [{ taxTypeId: 4, description: "STATE" }],
      tagTypes: [],
      statusCodes: [],
      packageTypes: [],
      colors: [],
      bindings: [],
    },
    lookups: {
      taxTypeLabels: new Map([[4, "STATE"]]),
    },
    vendors: [],
    byId: new Map<number, string>(),
    loading: false,
    available: true,
  }),
}));

vi.mock("@/components/products/use-hidden-columns", () => ({
  useHiddenColumns: () => ({
    ref: { current: null },
    summary: { tiers: [] },
  }),
}));

beforeEach(() => {
  updateMock.mockReset();
  toastErrorMock.mockReset();
  updateMock.mockResolvedValue({ sku: 0, appliedFields: [] });
});

describe("product table helpers", () => {
  it("prefers the computed effective last-sale date when present", () => {
    expect(getProductDisplaySaleDate({
      effective_last_sale_date: "2026-04-10T00:00:00.000Z",
      last_sale_date_computed: "2026-04-09T00:00:00.000Z",
      last_sale_date: "2026-04-01T00:00:00.000Z",
    })).toBe("2026-04-10T00:00:00.000Z");
  });

  it("treats pending aggregates differently from real zero values", () => {
    expect(hasProductAnalyticsReady({
      aggregates_ready: undefined,
      sales_aggregates_computed_at: null,
    })).toBe(false);
    expect(getProductAnalyticsDisplay({
      aggregates_ready: undefined,
      sales_aggregates_computed_at: null,
    }, 0)).toBe("Pending");

    expect(getProductAnalyticsDisplay({
      aggregates_ready: true,
      sales_aggregates_computed_at: null,
    }, 0)).toBe("0");
  });

  it("uses a neutral vendor fallback when the label is missing", () => {
    expect(formatVendorDisplay(null)).toBe("Vendor unavailable");
  });

  it("formats the location-variance badge only when more than one selected location differs", () => {
    expect(formatLocationVarianceBadge(false, 3)).toBeNull();
    expect(formatLocationVarianceBadge(true, 1)).toBeNull();
    expect(formatLocationVarianceBadge(true, 3)).toBe("+2 varies");
  });

  it("formats selected-location rows for the popover", () => {
    const slices = [
      {
        locationId: 2,
        locationAbbrev: "PIER",
        retailPrice: 19.99,
        cost: 8.5,
        stockOnHand: 10,
        lastSaleDate: "2026-04-18T00:00:00.000Z",
      },
      {
        locationId: 3,
        locationAbbrev: "PCOP",
        retailPrice: 21.99,
        cost: 8.5,
        stockOnHand: 4,
        lastSaleDate: "2026-04-17T00:00:00.000Z",
      },
    ] as const;

    expect(getLocationValueRows(slices, "retailPrice")).toEqual([
      { label: "PIER", value: "$19.99" },
      { label: "PCOP", value: "$21.99" },
    ]);
    expect(getLocationValueRows(slices, "cost")).toEqual([
      { label: "PIER", value: "$8.50" },
      { label: "PCOP", value: "$8.50" },
    ]);
    expect(getLocationValueRows(slices, "stockOnHand")).toEqual([
      { label: "PIER", value: "10" },
      { label: "PCOP", value: "4" },
    ]);
  });
});

describe("product table variance trigger", () => {
  interface ProductUpdatePayload {
    patch?: {
      primaryInventory?: {
        retail?: number;
        cost?: number;
      };
      item?: {
        barcode?: string | null;
        itemTaxTypeId?: number | null;
        fDiscontinue?: 0 | 1;
      };
    };
  }

  function buildInlineEditRows(products: ProductBrowseRow[]): ProductInlineEditRowBaseline[] {
    return products.map((product) => {
      const selectedInventories = product.selected_inventories ?? [];
      const primaryInventory = selectedInventories.find((slice) => slice.locationId === 2);
      const allowItemLevelFallback = primaryInventory == null;

      return {
        sku: product.sku,
        barcode: product.barcode,
        itemTaxTypeId: product.itemTaxTypeId ?? null,
        retail: primaryInventory?.retailPrice ?? (allowItemLevelFallback ? product.retail_price ?? null : null),
        cost: primaryInventory?.cost ?? (allowItemLevelFallback ? product.cost ?? null : null),
        fDiscontinue: product.discontinued ? 1 : 0,
      };
    });
  }

  function applyProductPatch(product: ProductBrowseRow, payload: ProductUpdatePayload): ProductBrowseRow {
    const nextRetail = payload.patch?.primaryInventory?.retail;
    const nextCost = payload.patch?.primaryInventory?.cost;
    const nextBarcode = payload.patch?.item?.barcode;
    const nextTaxTypeId = payload.patch?.item?.itemTaxTypeId;
    const nextDiscontinue = payload.patch?.item?.fDiscontinue;

    return {
      ...product,
      retail_price: nextRetail ?? product.retail_price,
      cost: nextCost ?? product.cost,
      barcode: nextBarcode === undefined ? product.barcode : nextBarcode,
      itemTaxTypeId: nextTaxTypeId ?? product.itemTaxTypeId,
      discontinued: nextDiscontinue == null ? product.discontinued : nextDiscontinue === 1,
      selected_inventories: product.selected_inventories.map((slice) => (
        slice.locationId !== 2
          ? slice
          : {
              ...slice,
              retailPrice: nextRetail ?? slice.retailPrice,
              cost: nextCost ?? slice.cost,
            }
      )),
    } as ProductBrowseRow;
  }

  function makeTextbookProduct(overrides: Partial<ProductBrowseRow> = {}): ProductBrowseRow {
    const retailPrice = overrides.retail_price ?? 19.99;
    const cost = overrides.cost ?? 8.5;
    const stockOnHand = overrides.stock_on_hand ?? 10;

    return {
      sku: 101,
      barcode: null,
      item_type: "textbook",
      description: "Pierce hoodie",
      author: null,
      title: "Pierce hoodie",
      isbn: null,
      edition: null,
      retail_price: retailPrice,
      cost,
      stock_on_hand: stockOnHand,
      catalog_number: null,
      vendor_id: null,
      dcc_id: null,
      product_type: null,
      created_at: null,
      updated_at: "2026-04-20T00:00:00.000Z",
      last_sale_date: null,
      synced_at: "2026-04-20T00:00:00.000Z",
      dept_num: null,
      class_num: null,
      cat_num: null,
      dept_name: null,
      class_name: null,
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
      last_sale_date_computed: null,
      sales_aggregates_computed_at: null,
      effective_last_sale_date: null,
      aggregates_ready: true,
      edited_since_sync: false,
      margin_ratio: null,
      stock_coverage_days: null,
      trend_direction: null,
      discontinued: false,
      itemTaxTypeId: 4,
      primary_location_id: 2,
      primary_location_abbrev: "PIER",
      selected_inventories: overrides.selected_inventories ?? [
        {
          locationId: 2,
          locationAbbrev: "PIER",
          retailPrice,
          cost,
          stockOnHand,
          lastSaleDate: "2026-04-18T00:00:00.000Z",
        },
        {
          locationId: 3,
          locationAbbrev: "PCOP",
          retailPrice: 21.99,
          cost,
          stockOnHand,
          lastSaleDate: "2026-04-18T00:00:00.000Z",
        },
      ],
      location_variance: {
        retailPriceVaries: true,
        costVaries: false,
        stockVaries: false,
        lastSaleDateVaries: false,
      },
      ...overrides,
    } as ProductBrowseRow;
  }

  function makeMerchandiseProduct(overrides: Partial<ProductBrowseRow> = {}): ProductBrowseRow {
    const retailPrice = overrides.retail_price ?? 24.99;
    const cost = overrides.cost ?? 10.5;
    const stockOnHand = overrides.stock_on_hand ?? 7;

    return {
      ...makeTextbookProduct(),
      sku: 202,
      barcode: "BC-202",
      item_type: "merchandise",
      description: "Pierce hoodie merch",
      title: "Pierce hoodie merch",
      isbn: null,
      retail_price: retailPrice,
      cost,
      stock_on_hand: stockOnHand,
      selected_inventories: overrides.selected_inventories ?? [
        {
          locationId: 2,
          locationAbbrev: "PIER",
          retailPrice,
          cost,
          stockOnHand,
          lastSaleDate: "2026-04-18T00:00:00.000Z",
        },
      ],
      ...overrides,
    } as ProductBrowseRow;
  }

  function renderTable(onToggle: ReturnType<typeof vi.fn>) {
    render(React.createElement(ProductTable, {
      tab: "textbooks",
      products: [makeTextbookProduct()],
      total: 1,
      page: 1,
      loading: false,
      sortBy: "sku",
      sortDir: "asc",
      isSelected: () => false,
      onToggle,
      onToggleAll: () => {},
      onPageChange: () => {},
      onSort: () => {},
      visibleColumns: [],
    }));
  }

  function renderEditableTable(
    onToggle: ReturnType<typeof vi.fn>,
    {
      tab = "textbooks",
      products = [makeTextbookProduct()],
      deferRefresh = false,
      transformAfterSave,
    }: {
      tab?: "textbooks" | "merchandise";
      products?: ProductBrowseRow[];
      deferRefresh?: boolean;
      transformAfterSave?: (products: ProductBrowseRow[]) => ProductBrowseRow[];
    } = {},
  ) {
    function Harness() {
      const [tableProducts, setTableProducts] = useState(products);
      const inlineRows = useMemo(() => buildInlineEditRows(tableProducts), [tableProducts]);
      const inlineEdit = useProductInlineEdit({
        rows: inlineRows,
        primaryLocationId: 2,
      });

      useEffect(() => {
        updateMock.mockImplementation(async (sku: number, payload: ProductUpdatePayload) => {
          const applyUpdate = (current: ProductBrowseRow[]) => {
            const nextProducts = current.map((candidate) => (
              candidate.sku === sku ? applyProductPatch(candidate, payload) : candidate
            ));
            return transformAfterSave ? transformAfterSave(nextProducts) : nextProducts;
          };

          if (deferRefresh) {
            setTimeout(() => {
              setTableProducts((current) => applyUpdate(current));
            }, 0);
          } else {
            setTableProducts((current) => applyUpdate(current));
          }
          return { sku, appliedFields: [] };
        });
      }, []);

      return React.createElement(ProductTable, {
        tab,
        products: tableProducts,
        total: tableProducts.length,
        page: 1,
        loading: false,
        sortBy: "sku",
        sortDir: "asc",
        isSelected: () => false,
        onToggle,
        onToggleAll: () => {},
        onPageChange: () => {},
        onSort: () => {},
        visibleColumns: [],
        inlineEdit,
        primaryLocationId: 2,
      });
    }

  render(React.createElement(Harness));
}

  it("renders textbook ISBNs as static text without a barcode edit affordance", async () => {
    const onToggle = vi.fn();

    renderEditableTable(onToggle, {
      tab: "textbooks",
      products: [{
        ...makeTextbookProduct(),
        isbn: "9780131103627",
      } as ProductBrowseRow],
    });

    const tableWrap = document.querySelector(".product-table-wrap");
    expect(tableWrap).not.toBeNull();
    expect(within(tableWrap as HTMLElement).getByText("ISBN 9780131103627")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /edit barcode for sku 101/i })).toBeNull();
  });

  it("clicking the barcode inline-edit button for SKU 202 does not toggle selection and opens the editor", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();

    renderEditableTable(onToggle, {
      tab: "merchandise",
      products: [makeMerchandiseProduct()],
    });

    await user.click(screen.getByRole("button", { name: /edit barcode for sku 202/i }));

    expect(onToggle).not.toHaveBeenCalled();
    const editor = screen.getByRole("textbox", { name: /barcode editor for sku 202/i });
    expect(editor).toHaveValue("BC-202");
  });

  it("opens the retail popover from the varies badge without selecting the row", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();

    renderTable(onToggle);

    const tableWrap = document.querySelector(".product-table-wrap");
    expect(tableWrap).not.toBeNull();

    const trigger = within(tableWrap as HTMLElement).getByRole("button", {
      name: /retail values vary across locations/i,
    });
    expect(trigger.textContent).toContain("+1 varies");

    await user.click(trigger);

    expect(onToggle).not.toHaveBeenCalled();
    expect(await screen.findByText("PIER")).toBeTruthy();
    expect(await screen.findByText("PCOP")).toBeTruthy();
    expect(await screen.findByText("$21.99")).toBeTruthy();
  });

  it("opens the retail popover from the mobile card badge without selecting the row", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();

    renderTable(onToggle);

    const mobileWrap = document.querySelector(".md\\:hidden");
    expect(mobileWrap).not.toBeNull();

    const trigger = within(mobileWrap as HTMLElement).getByRole("button", {
      name: /retail values vary across locations/i,
    });

    await user.click(trigger);

    expect(onToggle).not.toHaveBeenCalled();
    expect(await screen.findByText("PIER")).toBeTruthy();
    expect(await screen.findByText("PCOP")).toBeTruthy();
  });

  it("clicking the retail inline-edit button for SKU 101 does not toggle selection and opens the editor", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();

    renderEditableTable(onToggle);

    await user.click(screen.getByRole("button", { name: /edit retail for sku 101/i }));

    expect(onToggle).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox", { name: /retail editor for sku 101/i })).toBeTruthy();
  });

  it("renders desktop tax type and discontinue headers", () => {
    const onToggle = vi.fn();

    renderEditableTable(onToggle);

    expect(screen.getByRole("columnheader", { name: /tax type/i })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: /disc/i })).toBeTruthy();
  });

  it("changing tax type does not toggle row selection", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();

    renderEditableTable(onToggle);

    await user.selectOptions(
      screen.getByRole("combobox", { name: /tax type for sku 101/i }),
      "4",
    );

    expect(onToggle).not.toHaveBeenCalled();
  });

  it("toggle discontinue updates the visible state immediately", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();

    renderEditableTable(onToggle);

    const toggle = screen.getByRole("button", { name: /toggle discontinue for sku 101/i });
    expect(toggle).toHaveTextContent("Live");

    await user.click(toggle);

    expect(onToggle).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /toggle discontinue for sku 101/i })).toHaveTextContent("Disc");
  });

  it("tabs from cost to retail on the same row through the real table controller", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();

    renderEditableTable(onToggle);

    await user.click(screen.getByRole("button", { name: /edit cost for sku 101/i }));

    const editor = screen.getByRole("textbox", { name: /cost editor for sku 101/i });
    await user.clear(editor);
    await user.type(editor, "10.25{tab}");

    expect(onToggle).not.toHaveBeenCalled();
    expect(
      await screen.findByRole("textbox", { name: /retail editor for sku 101/i }),
    ).toHaveFocus();
  });

  it("tabs to the next visible row after a save reorders textbook rows", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();

    renderEditableTable(onToggle, {
      products: [
        makeTextbookProduct({ sku: 101, retail_price: 20, cost: 8.5 }),
        makeTextbookProduct({ sku: 102, retail_price: 30, cost: 9.5, title: "Second row" }),
        makeTextbookProduct({ sku: 103, retail_price: 40, cost: 10.5, title: "Third row" }),
      ],
      transformAfterSave: (products) => [...products].sort((left, right) => {
        const leftRetail = left.selected_inventories.find((slice) => slice.locationId === 2)?.retailPrice ?? 0;
        const rightRetail = right.selected_inventories.find((slice) => slice.locationId === 2)?.retailPrice ?? 0;
        return leftRetail - rightRetail;
      }),
    });

    await user.click(screen.getByRole("button", { name: /edit retail for sku 101/i }));

    const editor = screen.getByRole("textbox", { name: /retail editor for sku 101/i });
    await user.clear(editor);
    await user.type(editor, "35{tab}");

    expect(onToggle).not.toHaveBeenCalled();
    expect(
      await screen.findByRole("textbox", { name: /cost editor for sku 103/i }),
    ).toHaveFocus();
    expect(screen.queryByRole("textbox", { name: /cost editor for sku 102/i })).toBeNull();
  });

  it("preserves row-boundary tab traversal when refreshed rows land after the save resolves", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();

    renderEditableTable(onToggle, {
      deferRefresh: true,
      products: [
        makeTextbookProduct({ sku: 101, retail_price: 20, cost: 8.5 }),
        makeTextbookProduct({ sku: 102, retail_price: 30, cost: 9.5, title: "Second row" }),
        makeTextbookProduct({ sku: 103, retail_price: 40, cost: 10.5, title: "Third row" }),
      ],
      transformAfterSave: (products) => [...products].sort((left, right) => {
        const leftRetail = left.selected_inventories.find((slice) => slice.locationId === 2)?.retailPrice ?? 0;
        const rightRetail = right.selected_inventories.find((slice) => slice.locationId === 2)?.retailPrice ?? 0;
        return leftRetail - rightRetail;
      }),
    });

    await user.click(screen.getByRole("button", { name: /edit retail for sku 101/i }));

    const editor = screen.getByRole("textbox", { name: /retail editor for sku 101/i });
    await user.clear(editor);
    await user.type(editor, "35{tab}");

    expect(onToggle).not.toHaveBeenCalled();
    expect(
      await screen.findByRole("textbox", { name: /cost editor for sku 103/i }),
    ).toHaveFocus();
  });

  it("shift-tabs from the first editable cell of a row to the previous row retail editor", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();

    renderEditableTable(onToggle, {
      products: [
        makeTextbookProduct({ sku: 101, retail_price: 20, cost: 8.5 }),
        makeTextbookProduct({ sku: 102, retail_price: 30, cost: 9.5, title: "Second row" }),
      ],
    });

    await user.click(screen.getByRole("button", { name: /edit cost for sku 102/i }));

    const editor = screen.getByRole("textbox", { name: /cost editor for sku 102/i });
    await user.clear(editor);
    await user.type(editor, "11.25");
    await user.keyboard("{Shift>}{Tab}{/Shift}");

    expect(onToggle).not.toHaveBeenCalled();
    expect(
      await screen.findByRole("textbox", { name: /retail editor for sku 101/i }),
    ).toHaveFocus();
  });

  it("clicking blank space in an inline-edit cell still selects the row", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();

    renderEditableTable(onToggle);

    const retailButton = screen.getByRole("button", { name: /edit retail for sku 101/i });
    const retailCell = retailButton.closest("td");
    expect(retailCell).not.toBeNull();

    await user.click(retailCell as HTMLTableCellElement);

    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith(expect.objectContaining({ sku: 101 }));
  });

  it("esc closes the retail editor without selecting the row", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();

    renderEditableTable(onToggle);

    await user.click(screen.getByRole("button", { name: /edit retail for sku 101/i }));
    const editor = screen.getByRole("textbox", { name: /retail editor for sku 101/i });
    await user.keyboard("{Escape}");

    expect(onToggle).not.toHaveBeenCalled();
    expect(editor).not.toBeInTheDocument();
  });
});
