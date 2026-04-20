import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { forwardRef, useEffect, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProductBrowseRow } from "@/domains/product/types";

const {
  healthMock,
  replaceMock,
  refetchMock,
  searchProductsMock,
  updateMock,
  useProductSearchMock,
  useProductSelectionMock,
} = vi.hoisted(() => ({
  healthMock: vi.fn(),
  replaceMock: vi.fn(),
  refetchMock: vi.fn(),
  searchProductsMock: vi.fn(),
  updateMock: vi.fn(),
  useProductSearchMock: vi.fn(),
  useProductSelectionMock: vi.fn(),
}));

let searchParamsState = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock, push: vi.fn() }),
  useSearchParams: () => searchParamsState,
}));

vi.mock("@/domains/product/api-client", () => ({
  productApi: {
    health: healthMock,
    update: updateMock,
  },
}));

vi.mock("@/domains/product/queries", () => ({
  searchProducts: searchProductsMock,
}));

vi.mock("@/domains/product/hooks", () => ({
  useProductSearch: useProductSearchMock,
  useProductSelection: useProductSelectionMock,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, render, ...props }: { children?: ReactNode; render?: ReactNode }) => {
    if (render) return <>{render}</>;
    return (
      <button type="button" {...props}>
        {children}
      </button>
    );
  },
}));

vi.mock("@/components/products/product-filters", () => ({
  ProductFiltersBar: () => <div data-testid="filters-bar" />,
}));

vi.mock("@/components/products/product-filters-extended", () => ({
  ProductFiltersExtended: () => <div data-testid="filters-extended" />,
}));

vi.mock("@/components/products/product-action-bar", () => ({
  ProductActionBar: () => <div data-testid="action-bar" />,
}));

vi.mock("@/components/products/new-item-dialog", () => ({
  NewItemDialog: () => null,
}));

vi.mock("@/components/products/edit-item-dialog", () => ({
  EditItemDialog: () => null,
}));

vi.mock("@/components/products/hard-delete-dialog", () => ({
  HardDeleteDialog: () => null,
}));

vi.mock("@/components/products/save-view-dialog", () => ({
  SaveViewDialog: () => null,
}));

vi.mock("@/components/products/delete-view-dialog", () => ({
  DeleteViewDialog: () => null,
}));

vi.mock("@/components/products/pierce-assurance-badge", () => ({
  PierceAssuranceBadge: () => <div data-testid="assurance-badge" />,
}));

vi.mock("@/components/products/sync-database-button", () => ({
  SyncDatabaseButton: forwardRef<HTMLButtonElement>(function SyncDatabaseButtonStub(_, ref) {
    void ref;
    return <div data-testid="sync-button" />;
  }),
}));

vi.mock("@/components/products/saved-views-bar", () => ({
  SavedViewsBar: ({
    onViewsResolved,
  }: {
    onViewsResolved?: (views: unknown[]) => void;
  }) => {
    useEffect(() => {
      onViewsResolved?.([]);
    }, [onViewsResolved]);

    return <div data-testid="saved-views" />;
  },
}));

vi.mock("@/components/products/column-visibility-toggle", () => ({
  ColumnVisibilityToggle: forwardRef<HTMLDivElement>(function ColumnVisibilityToggleStub(_, ref) {
    void ref;
    return <div data-testid="column-toggle" />;
  }),
}));

vi.mock("@/components/products/location-picker", () => ({
  LocationPicker: () => <div data-testid="location-picker" />,
}));

vi.mock("@/components/products/product-table", () => ({
  ProductTable: ({
    inlineEdit,
    primaryLocationId,
    products,
    tab,
  }: {
    inlineEdit?: {
      editingCell: { sku: number; field: string } | null;
      draftValue: string;
      pendingSave: boolean;
      startEdit: (
        sku: number,
        field: string,
        currentValue: string,
        fieldOrder?: string[],
      ) => void;
      setDraftValue: (value: string) => void;
      commitEdit: () => Promise<void>;
      cancelEdit: () => void;
      moveToNextEditableCell: (direction: "next" | "previous") => Promise<void>;
    };
    primaryLocationId?: number;
    tab: "textbooks" | "merchandise";
    products: Array<{ sku: number; retail_price: number; cost: number; barcode: string | null }>;
  }) => {
    const fieldConfig = [
      {
        field: "cost",
        label: "Cost",
        currentValue: (product: { sku: number; cost: number }) => String(product.cost),
      },
      {
        field: "retail",
        label: "Retail",
        currentValue: (product: { sku: number; retail_price: number }) => String(product.retail_price),
      },
      ...(tab === "merchandise"
        ? [
            {
              field: "barcode",
              label: "Barcode",
              currentValue: (product: { sku: number; barcode: string | null }) => product.barcode ?? "",
            },
          ]
        : []),
    ] as const;
    const fieldOrder = fieldConfig.map(({ field }) => field);

    return (
      <div data-testid="product-table">
        <span data-testid="primary-location">{String(primaryLocationId ?? "none")}</span>
        {inlineEdit ? (
          <table>
            <tbody>
              {products.map((product) => (
                <tr key={product.sku}>
                  <th scope="row">{`SKU ${product.sku}`}</th>
                  {fieldConfig.map(({ field, label, currentValue }) => {
                    const isEditing =
                      inlineEdit.editingCell?.sku === product.sku &&
                      inlineEdit.editingCell.field === field;

                    return (
                      <td key={field}>
                        {isEditing ? (
                          <input
                            aria-label={`${label} editor for SKU ${product.sku}`}
                            value={inlineEdit.draftValue}
                            onChange={(e) => inlineEdit.setDraftValue(e.target.value)}
                            onKeyDown={async (e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                await inlineEdit.commitEdit();
                              }
                              if (e.key === "Escape") {
                                inlineEdit.cancelEdit();
                              }
                              if (e.key === "Tab") {
                                e.preventDefault();
                                await inlineEdit.moveToNextEditableCell(e.shiftKey ? "previous" : "next");
                              }
                            }}
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              inlineEdit.startEdit(
                                product.sku,
                                field,
                                currentValue(product),
                                fieldOrder,
                              )
                            }
                          >
                            {`Edit ${label.toLowerCase()} for SKU ${product.sku}`}
                          </button>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div data-testid="inline-edit-missing">inline-edit seam missing</div>
        )}
      </div>
    );
  },
}));

import ProductsPage from "@/app/products/page";

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
    primary_location_id: 2,
    primary_location_abbrev: "PIER",
    selected_inventories: [
      {
        locationId: 2,
        locationAbbrev: "PIER",
        retailPrice: 39.99,
        cost: 18.25,
        stockOnHand: 12,
        lastSaleDate: null,
      },
    ],
    location_variance: {
      retailPriceVaries: false,
      costVaries: false,
      stockVaries: false,
      lastSaleDateVaries: false,
    },
    discontinued: false,
    ...overrides,
  };
}

describe("ProductsPage inline edit controller wiring", () => {
  beforeEach(() => {
    healthMock.mockResolvedValue({ available: true, configured: true, reason: null });
    replaceMock.mockClear();
    refetchMock.mockClear();
    updateMock.mockReset();
    updateMock.mockResolvedValue({ sku: 1001, appliedFields: ["primaryInventory.retail"] });
    searchProductsMock.mockResolvedValue({ products: [], total: 0, page: 1, pageSize: 50 });
    useProductSearchMock.mockReturnValue({
      data: {
        products: [makeProductRow()],
        total: 1,
        page: 1,
        pageSize: 50,
      },
      loading: false,
      refetch: refetchMock,
    });
    useProductSelectionMock.mockReturnValue({
      selected: new Map(),
      selectedCount: 0,
      toggle: vi.fn(),
      toggleAll: vi.fn(),
      clear: vi.fn(),
      isSelected: vi.fn(),
      saveToSession: vi.fn(),
    });
    searchParamsState = new URLSearchParams();
  });

  afterEach(() => {
    cleanup();
  });

  it("saves retail edits through the v2 update payload and refetches after save", async () => {
    const user = userEvent.setup();

    render(<ProductsPage />);

    await screen.findByTestId("product-table");
    expect(screen.getByTestId("primary-location")).toHaveTextContent("2");

    await user.click(screen.getByRole("button", { name: /edit retail for sku 1001/i }));

    const editor = screen.getByRole("textbox", { name: /retail editor for sku 1001/i });
    await user.clear(editor);
    await user.type(editor, "44.99{enter}");

    await waitFor(() => {
      expect(updateMock).toHaveBeenCalledWith(1001, {
        mode: "v2",
        patch: {
          primaryInventory: {
            retail: 44.99,
          },
        },
        baseline: expect.objectContaining({
          sku: 1001,
          barcode: "123456789012",
          retail: 39.99,
          cost: 18.25,
          fDiscontinue: 0,
        }),
      });
      expect(refetchMock).toHaveBeenCalled();
    });
  });

  it("commits barcode edits with the v2 item patch and tabs to the next visible row field", async () => {
    const user = userEvent.setup();
    searchParamsState = new URLSearchParams("tab=merchandise");

    useProductSearchMock.mockReturnValue({
      data: {
        products: [
          makeProductRow({
            sku: 1001,
            barcode: "123456789012",
            retail_price: 39.99,
            cost: 18.25,
            selected_inventories: [
              {
                locationId: 2,
                locationAbbrev: "PIER",
                retailPrice: 39.99,
                cost: 18.25,
                stockOnHand: 12,
                lastSaleDate: null,
              },
            ],
          }),
          makeProductRow({
            sku: 1002,
            barcode: "987654321098",
            retail_price: 24.5,
            cost: 11.75,
            selected_inventories: [
              {
                locationId: 2,
                locationAbbrev: "PIER",
                retailPrice: 24.5,
                cost: 11.75,
                stockOnHand: 8,
                lastSaleDate: null,
              },
            ],
          }),
        ],
        total: 2,
        page: 1,
        pageSize: 50,
      },
      loading: false,
      refetch: refetchMock,
    });
    updateMock.mockResolvedValue({ sku: 1001, appliedFields: ["item.barcode"] });

    render(<ProductsPage />);

    await screen.findByTestId("product-table");

    await user.click(screen.getByRole("button", { name: /edit barcode for sku 1001/i }));

    const editor = screen.getByRole("textbox", { name: /barcode editor for sku 1001/i });
    await user.clear(editor);
    await user.type(editor, "111222333444{tab}");

    await waitFor(() => {
      expect(updateMock).toHaveBeenCalledWith(1001, {
        mode: "v2",
        patch: {
          item: {
            barcode: "111222333444",
          },
        },
        baseline: expect.objectContaining({
          sku: 1001,
          barcode: "123456789012",
          retail: 39.99,
          cost: 18.25,
          fDiscontinue: 0,
        }),
      });
    });

    expect(
      await screen.findByRole("textbox", { name: /cost editor for sku 1002/i }),
    ).toHaveValue("11.75");
  });

  it("tabs from textbook retail to the next row cost without landing in a hidden barcode field", async () => {
    const user = userEvent.setup();

    useProductSearchMock.mockReturnValue({
      data: {
        products: [
          makeProductRow({
            sku: 1001,
            item_type: "textbook",
            title: "Physics I",
            isbn: "9780131103627",
            barcode: null,
            retail_price: 39.99,
            cost: 18.25,
            selected_inventories: [
              {
                locationId: 2,
                locationAbbrev: "PIER",
                retailPrice: 39.99,
                cost: 18.25,
                stockOnHand: 12,
                lastSaleDate: null,
              },
            ],
          }),
          makeProductRow({
            sku: 1002,
            item_type: "textbook",
            title: "Physics II",
            isbn: "9780131101630",
            barcode: null,
            retail_price: 41.5,
            cost: 19.75,
            selected_inventories: [
              {
                locationId: 2,
                locationAbbrev: "PIER",
                retailPrice: 41.5,
                cost: 19.75,
                stockOnHand: 12,
                lastSaleDate: null,
              },
            ],
          }),
        ],
        total: 2,
        page: 1,
        pageSize: 50,
      },
      loading: false,
      refetch: refetchMock,
    });
    updateMock.mockResolvedValue({ sku: 1001, appliedFields: ["primaryInventory.retail"] });

    render(<ProductsPage />);

    await screen.findByTestId("product-table");

    await user.click(screen.getByRole("button", { name: /edit retail for sku 1001/i }));

    const editor = screen.getByRole("textbox", { name: /retail editor for sku 1001/i });
    await user.clear(editor);
    await user.type(editor, "44.99{tab}");

    await waitFor(() => {
      expect(updateMock).toHaveBeenCalledWith(1001, {
        mode: "v2",
        patch: {
          primaryInventory: {
            retail: 44.99,
          },
        },
        baseline: expect.objectContaining({
          sku: 1001,
          barcode: null,
          retail: 39.99,
          cost: 18.25,
          fDiscontinue: 0,
        }),
      });
    });

    expect(
      await screen.findByRole("textbox", { name: /cost editor for sku 1002/i }),
    ).toHaveValue("19.75");
    expect(screen.queryByRole("textbox", { name: /barcode editor for sku 1001/i })).toBeNull();
    expect(screen.queryByRole("textbox", { name: /barcode editor for sku 1002/i })).toBeNull();
  });
});
