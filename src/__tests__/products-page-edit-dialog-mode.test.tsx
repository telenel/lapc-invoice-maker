import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  detailMock,
  healthMock,
  legacyDialogMock,
  newItemDialogMock,
  refetchMock,
  replaceMock,
  searchProductsMock,
  useProductSearchMock,
  useProductSelectionMock,
  v2DialogMock,
} = vi.hoisted(() => ({
  detailMock: vi.fn(),
  healthMock: vi.fn(),
  legacyDialogMock: vi.fn(),
  newItemDialogMock: vi.fn(),
  refetchMock: vi.fn(),
  replaceMock: vi.fn(),
  searchProductsMock: vi.fn(),
  useProductSearchMock: vi.fn(),
  useProductSelectionMock: vi.fn(),
  v2DialogMock: vi.fn(),
}));

let searchParamsState = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock, push: vi.fn() }),
  useSearchParams: () => searchParamsState,
}));

vi.mock("@/domains/product/api-client", () => ({
  productApi: {
    detail: detailMock,
    health: healthMock,
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

vi.mock("@/components/products/product-table", () => ({
  ProductTable: () => <div data-testid="product-table" />,
}));

vi.mock("@/components/products/product-action-bar", () => ({
  ProductActionBar: ({
    allowMissingEditPricing,
    editPricingItems,
    onEditClick,
    saveToSession,
    selected,
  }: {
    allowMissingEditPricing?: boolean;
    editPricingItems?: Array<{ retailPrice: number | null; cost: number | null }>;
    onEditClick?: () => void;
    saveToSession?: () => void;
    selected?: Map<number, { retailPrice: number | null; cost: number | null }>;
  }) => {
    const firstSelected = selected ? Array.from(selected.values())[0] : null;
    const firstEditPricing = editPricingItems?.[0] ?? null;
    const editDisabled =
      !allowMissingEditPricing &&
      (editPricingItems ?? []).some((item) => item.retailPrice == null || item.cost == null);
    const salesDisabled = (selected ? Array.from(selected.values()) : []).some(
      (item) => item.retailPrice == null,
    );

    return (
      <div>
        <button type="button" onClick={onEditClick} disabled={editDisabled}>
          Open edit dialog
        </button>
        <button type="button" disabled={salesDisabled}>
          Create Quote
        </button>
        <button type="button" disabled={salesDisabled}>
          Create Invoice
        </button>
        <button type="button" onClick={saveToSession}>
          Save selection snapshot
        </button>
        <span>{`selected-retail:${firstSelected?.retailPrice ?? "null"}`}</span>
        <span>{`selected-cost:${firstSelected?.cost ?? "null"}`}</span>
        <span>{`edit-retail:${firstEditPricing?.retailPrice ?? "null"}`}</span>
        <span>{`edit-cost:${firstEditPricing?.cost ?? "null"}`}</span>
      </div>
    );
  },
}));

vi.mock("@/components/products/new-item-dialog", () => ({
  NewItemDialog: newItemDialogMock.mockImplementation(
    ({
      locationIds,
      primaryLocationId,
    }: {
      locationIds?: number[];
      primaryLocationId?: ProductLocationId;
    }) => (
      <div data-testid="new-item-dialog-props">
        <span>{`new-item-location-ids:${locationIds?.join(",") ?? "none"}`}</span>
        <span>{`new-item-primary-location:${primaryLocationId ?? "none"}`}</span>
      </div>
    ),
  ),
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
  SyncDatabaseButton: () => <div data-testid="sync-button" />,
}));

vi.mock("@/components/products/saved-views-bar", () => ({
  SavedViewsBar: () => <div data-testid="saved-views" />,
}));

vi.mock("@/components/products/column-visibility-toggle", () => ({
  ColumnVisibilityToggle: () => <div data-testid="column-toggle" />,
}));

vi.mock("@/components/products/location-picker", () => ({
  LocationPicker: ({
    onChange,
  }: {
    onChange?: (value: ProductLocationId[]) => void;
  }) => (
    <div data-testid="location-picker">
      <button type="button" onClick={() => onChange?.([2])}>
        scope:PIER
      </button>
      <button type="button" onClick={() => onChange?.([3])}>
        scope:PCOP
      </button>
      <button type="button" onClick={() => onChange?.([4])}>
        scope:PFS
      </button>
    </div>
  ),
}));

vi.mock("@/components/products/edit-item-dialog-legacy", () => ({
  buildPatch: vi.fn(),
  EditItemDialogLegacy: legacyDialogMock.mockImplementation(
    ({ open, onSaved }: { open: boolean; onSaved?: (skus: number[]) => void }) =>
      open ? (
        <div data-testid="legacy-dialog">
          <span>dialog:legacy</span>
          <button type="button" onClick={() => onSaved?.([1001])}>
            Save legacy dialog
          </button>
        </div>
      ) : null,
  ),
}));

vi.mock("@/components/products/edit-item-dialog-v2", () => ({
  EditItemDialogV2: v2DialogMock.mockImplementation(
    ({
      open,
      items,
      detail,
      detailLoading,
      locationIds,
      primaryLocationId,
      onSaved,
      onSavedScopedItems,
    }: {
      open: boolean;
      items?: Array<{
        sku?: number;
        retail?: number | null;
        cost?: number | null;
        barcode?: string | null;
        fDiscontinue?: 0 | 1;
      }>;
      detail?: { sku: number } | null;
      detailLoading?: boolean;
      locationIds?: number[];
      primaryLocationId?: ProductLocationId;
      onSaved?: (skus: number[]) => void;
      onSavedScopedItems?: (
        items: SelectedProduct[],
        options?: { retainUntilMatch?: boolean },
      ) => void;
    }) =>
      open ? (
        <div data-testid="v2-dialog">
          <span>dialog:v2</span>
          <span>{`detail-loading:${detailLoading === true ? "yes" : "no"}`}</span>
          <span>{`detail-sku:${detail?.sku ?? "none"}`}</span>
          <span>{`item-retail:${items?.[0]?.retail ?? "null"}`}</span>
          <span>{`item-cost:${items?.[0]?.cost ?? "null"}`}</span>
          <span>{`item-barcode:${items?.[0]?.barcode ?? "null"}`}</span>
          <span>{`item-fDiscontinue:${items?.[0]?.fDiscontinue ?? "null"}`}</span>
          <span>{`location-ids:${locationIds?.join(",") ?? "none"}`}</span>
          <span>{`primary-location:${primaryLocationId ?? "none"}`}</span>
          <button type="button" onClick={() => onSaved?.([1001])}>
            Save v2 dialog
          </button>
          <button
            type="button"
            onClick={() => {
              onSavedScopedItems?.([
                makeSelectedProduct({
                  sku: items?.[0]?.sku ?? 1001,
                  retailPrice: 44.99,
                  cost: 22.25,
                  pricingLocationId: primaryLocationId ?? 2,
                  barcode: "999888777000",
                  fDiscontinue: 1,
                }),
              ], { retainUntilMatch: false });
              onSaved?.([items?.[0]?.sku ?? 1001]);
            }}
          >
            Save scoped v2 dialog
          </button>
          <button
            type="button"
            onClick={() => {
              onSavedScopedItems?.([
                makeSelectedProduct({
                  sku: items?.[0]?.sku ?? 1001,
                  retailPrice: 44.99,
                  cost: 22.25,
                  pricingLocationId: primaryLocationId ?? 2,
                  barcode: "999888777000",
                  fDiscontinue: 1,
                }),
              ], { retainUntilMatch: true });
              onSaved?.([items?.[0]?.sku ?? 1001]);
            }}
          >
            Save scoped v2 dialog with mirror warning
          </button>
          <button
            type="button"
            onClick={() => {
              onSavedScopedItems?.([
                makeSelectedProduct({
                  sku: items?.[0]?.sku ?? 1001,
                  retailPrice: 55.55,
                  cost: 27.75,
                  pricingLocationId: 3,
                  barcode: "333222111000",
                  fDiscontinue: 1,
                }),
              ], { retainUntilMatch: false });
              onSaved?.([items?.[0]?.sku ?? 1001]);
            }}
          >
            Save secondary scoped v2 dialog
          </button>
        </div>
      ) : null,
  ),
}));

import ProductsPage from "@/app/products/page";
import { CATALOG_ITEMS_STORAGE_KEY } from "@/domains/product/constants";
import type { ProductEditDetails, ProductLocationId, SelectedProduct } from "@/domains/product/types";

function makeSelectedProduct(overrides: Partial<SelectedProduct> = {}): SelectedProduct {
  return {
    sku: 1001,
    description: "Pierce Hoodie",
    retailPrice: 39.99,
    cost: 19.5,
    pricingLocationId: 2,
    barcode: "123456789012",
    author: null,
    title: null,
    isbn: null,
    edition: null,
    catalogNumber: "HD-1001",
    vendorId: 21,
    itemType: "general_merchandise",
    fDiscontinue: 0,
    ...overrides,
  };
}

function makeDetail(overrides: Partial<ProductEditDetails> = {}): ProductEditDetails {
  return {
    sku: 1001,
    itemType: "general_merchandise",
    description: "Pierce Hoodie",
    barcode: "123456789012",
    vendorId: 21,
    dccId: 1313290,
    itemTaxTypeId: 4,
    catalogNumber: "HD-1001",
    comment: "Front window",
    retail: 39.99,
    cost: 19.5,
    fDiscontinue: 0,
    altVendorId: null,
    mfgId: null,
    weight: null,
    packageType: "EA",
    unitsPerPack: 1,
    orderIncrement: null,
    imageUrl: null,
    size: null,
    sizeId: null,
    colorId: null,
    styleId: null,
    itemSeasonCodeId: null,
    fListPriceFlag: false,
    fPerishable: false,
    fIdRequired: false,
    minOrderQtyItem: null,
    usedDccId: null,
    inventoryByLocation: [
      {
        locationId: 2,
        locationAbbrev: "PIER",
        retail: 39.99,
        cost: 19.5,
        expectedCost: null,
        stockOnHand: 12,
        lastSaleDate: null,
        tagTypeId: null,
        statusCodeId: null,
        estSales: null,
        estSalesLocked: false,
        fInvListPriceFlag: false,
        fTxWantListFlag: false,
        fTxBuybackListFlag: false,
        fNoReturns: false,
      },
      {
        locationId: 3,
        locationAbbrev: "PCOP",
        retail: null,
        cost: null,
        expectedCost: null,
        stockOnHand: null,
        lastSaleDate: null,
        tagTypeId: null,
        statusCodeId: null,
        estSales: null,
        estSalesLocked: false,
        fInvListPriceFlag: false,
        fTxWantListFlag: false,
        fTxBuybackListFlag: false,
        fNoReturns: false,
      },
      {
        locationId: 4,
        locationAbbrev: "PFS",
        retail: null,
        cost: null,
        expectedCost: null,
        stockOnHand: null,
        lastSaleDate: null,
        tagTypeId: null,
        statusCodeId: null,
        estSales: null,
        estSalesLocked: false,
        fInvListPriceFlag: false,
        fTxWantListFlag: false,
        fTxBuybackListFlag: false,
        fNoReturns: false,
      },
    ],
    ...overrides,
  };
}

describe("ProductsPage edit dialog mode integration", () => {
  const originalFlag = process.env.NEXT_PUBLIC_PRODUCTS_EDIT_DIALOG_V2;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_PRODUCTS_EDIT_DIALOG_V2 = "true";
    sessionStorage.clear();
    detailMock.mockReset();
    healthMock.mockReset();
    legacyDialogMock.mockClear();
    newItemDialogMock.mockClear();
    refetchMock.mockReset();
    replaceMock.mockReset();
    searchProductsMock.mockReset();
    useProductSearchMock.mockReset();
    useProductSelectionMock.mockReset();
    v2DialogMock.mockClear();

    healthMock.mockResolvedValue({ available: true });
    detailMock.mockResolvedValue(makeDetail());
    refetchMock.mockResolvedValue(true);
    searchProductsMock.mockResolvedValue({ products: [], total: 0, page: 1, pageSize: 50 });
    useProductSearchMock.mockReturnValue({
      data: { products: [], total: 42, page: 1, pageSize: 50 },
      loading: false,
      refetch: refetchMock,
    });
    useProductSelectionMock.mockReturnValue({
      selected: new Map([[1001, makeSelectedProduct()]]),
      selectedCount: 1,
      toggle: vi.fn(),
      toggleAll: vi.fn(),
      refreshVisibleSelections: vi.fn(),
      clear: vi.fn(),
      isSelected: vi.fn(),
      saveToSession: vi.fn(),
    });
    searchParamsState = new URLSearchParams("tab=merchandise");
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_PRODUCTS_EDIT_DIALOG_V2 = originalFlag;
    sessionStorage.clear();
    cleanup();
  });

  it("routes flagged GM edits through v2, hydrates detail, and refetches after save", async () => {
    const user = userEvent.setup();

    render(<ProductsPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "New Item" })).toBeEnabled();
    });
    await user.click(screen.getByRole("button", { name: "New Item" }));

    await user.click(screen.getByRole("button", { name: "Open edit dialog" }));

    await waitFor(() => {
      expect(screen.getByText("dialog:v2")).toBeInTheDocument();
    });

    expect(detailMock).toHaveBeenCalledWith(1001);
    expect(screen.getByText("detail-sku:1001")).toBeInTheDocument();
    expect(screen.getByText("location-ids:2,3,4")).toBeInTheDocument();
    expect(screen.getByText("primary-location:2")).toBeInTheDocument();
    expect(screen.getByText("new-item-location-ids:2,3,4")).toBeInTheDocument();
    expect(screen.getByText("new-item-primary-location:2")).toBeInTheDocument();
    expect(screen.queryByText("dialog:legacy")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save v2 dialog" }));

    await waitFor(() => {
      expect(refetchMock).toHaveBeenCalledTimes(1);
    });
  });

  it("passes canonical location scope into v2 and still refetches after save", async () => {
    const user = userEvent.setup();

    searchParamsState = new URLSearchParams("tab=merchandise&loc=3,4");
    useProductSelectionMock.mockReturnValue({
      selected: new Map([[1001, makeSelectedProduct({ pricingLocationId: 3 })]]),
      selectedCount: 1,
      toggle: vi.fn(),
      toggleAll: vi.fn(),
      refreshVisibleSelections: vi.fn(),
      clear: vi.fn(),
      isSelected: vi.fn(),
      saveToSession: vi.fn(),
    });

    render(<ProductsPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "New Item" })).toBeEnabled();
    });
    await user.click(screen.getByRole("button", { name: "New Item" }));

    await user.click(screen.getByRole("button", { name: "Open edit dialog" }));

    await waitFor(() => {
      expect(screen.getByText("dialog:v2")).toBeInTheDocument();
    });

    expect(screen.getByText("location-ids:3,4")).toBeInTheDocument();
    expect(screen.getByText("primary-location:3")).toBeInTheDocument();
    expect(screen.getByText("new-item-location-ids:3,4")).toBeInTheDocument();
    expect(screen.getByText("new-item-primary-location:3")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save v2 dialog" }));

    await waitFor(() => {
      expect(refetchMock).toHaveBeenCalledTimes(1);
    });
  });

  it("still opens the v2 dialog for a single scoped row with blank retail and cost", async () => {
    const user = userEvent.setup();

    searchParamsState = new URLSearchParams("tab=merchandise&loc=4");
    detailMock.mockResolvedValue(
      makeDetail({
        inventoryByLocation: [
          {
            ...makeDetail().inventoryByLocation[0],
            retail: 39.99,
            cost: 19.5,
          },
          makeDetail().inventoryByLocation[1],
          {
            ...makeDetail().inventoryByLocation[2],
            retail: null,
            cost: null,
          },
        ],
      }),
    );
    useProductSelectionMock.mockReturnValue({
      selected: new Map([
        [
          1001,
          makeSelectedProduct({
            retailPrice: null,
            cost: null,
            pricingLocationId: 4,
          }),
        ],
      ]),
      selectedCount: 1,
      toggle: vi.fn(),
      toggleAll: vi.fn(),
      refreshVisibleSelections: vi.fn(),
      clear: vi.fn(),
      isSelected: vi.fn(),
      saveToSession: vi.fn(),
    });

    render(<ProductsPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "New Item" })).toBeEnabled();
    });
    await user.click(screen.getByRole("button", { name: "New Item" }));

    await user.click(screen.getByRole("button", { name: "Open edit dialog" }));

    await waitFor(() => {
      expect(screen.getByText("dialog:v2")).toBeInTheDocument();
    });

    expect(detailMock).toHaveBeenCalledWith(1001);
    expect(screen.getByText("location-ids:4")).toBeInTheDocument();
    expect(screen.getByText("primary-location:4")).toBeInTheDocument();
    expect(screen.getByText("new-item-location-ids:4")).toBeInTheDocument();
    expect(screen.getByText("new-item-primary-location:4")).toBeInTheDocument();
    expect(screen.getByText("edit-retail:null")).toBeInTheDocument();
    expect(screen.getByText("edit-cost:null")).toBeInTheDocument();
  });

  it("re-derives selected pricing from the current scoped browse row", () => {
    searchParamsState = new URLSearchParams("tab=merchandise&loc=4");
    useProductSearchMock.mockReturnValue({
      data: {
        products: [
          {
            sku: 1001,
            description: "Pierce Hoodie",
            title: null,
            retail_price: null,
            cost: null,
            barcode: "123456789012",
            author: null,
            isbn: null,
            edition: null,
            catalog_number: "HD-1001",
            vendor_id: 21,
            item_type: "general_merchandise",
          } as never,
        ],
        total: 1,
        page: 1,
        pageSize: 50,
      },
      loading: false,
      refetch: refetchMock,
    });
    useProductSelectionMock.mockReturnValue({
      selected: new Map([
        [
          1001,
          makeSelectedProduct({
            retailPrice: 39.99,
            cost: 19.5,
          }),
        ],
      ]),
      selectedCount: 1,
      toggle: vi.fn(),
      toggleAll: vi.fn(),
      refreshVisibleSelections: vi.fn(),
      clear: vi.fn(),
      isSelected: vi.fn(),
      saveToSession: vi.fn(),
    });

    render(<ProductsPage />);

    expect(screen.getByText("selected-retail:null")).toBeInTheDocument();
    expect(screen.getByText("selected-cost:null")).toBeInTheDocument();
  });

  it("preserves persisted selection pricing when the selected SKU is off the current browse page", () => {
    searchParamsState = new URLSearchParams("tab=merchandise&loc=4&page=2");
    useProductSearchMock.mockReturnValue({
      data: {
        products: [],
        total: 0,
        page: 2,
        pageSize: 50,
      },
      loading: false,
      refetch: refetchMock,
    });
    useProductSelectionMock.mockReturnValue({
      selected: new Map([
        [
          1001,
          makeSelectedProduct({
            retailPrice: 39.99,
            cost: 19.5,
            pricingLocationId: 4,
          }),
        ],
      ]),
      selectedCount: 1,
      toggle: vi.fn(),
      toggleAll: vi.fn(),
      refreshVisibleSelections: vi.fn(),
      clear: vi.fn(),
      isSelected: vi.fn(),
      saveToSession: vi.fn(),
    });

    render(<ProductsPage />);

    expect(screen.getByText("selected-retail:39.99")).toBeInTheDocument();
    expect(screen.getByText("selected-cost:19.5")).toBeInTheDocument();
  });

  it("keeps edit disabled when an off-page selection has no current-scope baseline", async () => {
    const user = userEvent.setup();
    searchParamsState = new URLSearchParams("tab=merchandise&loc=4&page=2");
    useProductSearchMock.mockReturnValue({
      data: {
        products: [],
        total: 0,
        page: 2,
        pageSize: 50,
      },
      loading: false,
      refetch: refetchMock,
    });
    useProductSelectionMock.mockReturnValue({
      selected: new Map([
        [
          1001,
          makeSelectedProduct({
            retailPrice: 39.99,
            cost: 19.5,
            pricingLocationId: 2,
          }),
        ],
      ]),
      selectedCount: 1,
      toggle: vi.fn(),
      toggleAll: vi.fn(),
      refreshVisibleSelections: vi.fn(),
      clear: vi.fn(),
      isSelected: vi.fn(),
      saveToSession: vi.fn(),
    });

    render(<ProductsPage />);

    expect(screen.getByText("selected-retail:null")).toBeInTheDocument();
    expect(screen.getByText("selected-cost:null")).toBeInTheDocument();
    expect(screen.getByText("edit-retail:null")).toBeInTheDocument();
    expect(screen.getByText("edit-cost:null")).toBeInTheDocument();

    const editButton = screen.getByRole("button", { name: "Open edit dialog" });
    expect(editButton).toBeDisabled();
    await user.click(editButton);

    expect(screen.queryByText("dialog:v2")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save selection snapshot" }));
    expect(JSON.parse(sessionStorage.getItem(CATALOG_ITEMS_STORAGE_KEY) ?? "[]")).toMatchObject([
      {
        sku: 1001,
        retailPrice: null,
        cost: null,
      },
    ]);
  });

  it("keeps current-scope rows editable when the scope has no inventory slice yet", async () => {
    const user = userEvent.setup();
    searchParamsState = new URLSearchParams("tab=merchandise&loc=4");
    useProductSearchMock.mockReturnValue({
      data: {
        products: [
          {
            sku: 1001,
            description: "Pierce Hoodie",
            title: null,
            retail_price: 39.99,
            cost: 19.5,
            primary_location_id: null,
            selected_inventories: [],
            barcode: "123456789012",
            author: null,
            isbn: null,
            edition: null,
            catalog_number: "HD-1001",
            vendor_id: 21,
            item_type: "general_merchandise",
            discontinued: false,
          } as never,
        ],
        total: 1,
        page: 1,
        pageSize: 50,
      },
      loading: false,
      refetch: refetchMock,
    });
    useProductSelectionMock.mockReturnValue({
      selected: new Map([
        [
          1001,
          makeSelectedProduct({
            retailPrice: 39.99,
            cost: 19.5,
            pricingLocationId: 2,
          }),
        ],
      ]),
      selectedCount: 1,
      toggle: vi.fn(),
      toggleAll: vi.fn(),
      refreshVisibleSelections: vi.fn(),
      clear: vi.fn(),
      isSelected: vi.fn(),
      saveToSession: vi.fn(),
    });

    render(<ProductsPage />);

    expect(screen.getByText("selected-retail:39.99")).toBeInTheDocument();
    expect(screen.getByText("selected-cost:19.5")).toBeInTheDocument();
    expect(screen.getByText("edit-retail:null")).toBeInTheDocument();
    expect(screen.getByText("edit-cost:null")).toBeInTheDocument();

    const editButton = screen.getByRole("button", { name: "Open edit dialog" });
    expect(editButton).toBeEnabled();

    await user.click(editButton);

    await waitFor(() => {
      expect(screen.getByText("dialog:v2")).toBeInTheDocument();
    });

    expect(screen.getByText("item-retail:null")).toBeInTheDocument();
    expect(screen.getByText("item-cost:null")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save selection snapshot" }));
    expect(JSON.parse(sessionStorage.getItem(CATALOG_ITEMS_STORAGE_KEY) ?? "[]")).toMatchObject([
      {
        sku: 1001,
        retailPrice: 39.99,
        cost: 19.5,
      },
    ]);
  });

  it("reuses the current scope cache for off-page action-bar state and edit baselines", async () => {
    const user = userEvent.setup();
    searchParamsState = new URLSearchParams("tab=merchandise&loc=4");
    useProductSearchMock.mockReturnValue({
      data: {
        products: [
          {
            sku: 1001,
            description: "Pierce Hoodie",
            title: null,
            retail_price: 41.99,
            cost: 21.5,
            primary_location_id: 4,
            selected_inventories: [
              {
                locationId: 4,
                retailPrice: 41.99,
                cost: 21.5,
              },
            ],
            barcode: "123456789012",
            author: null,
            isbn: null,
            edition: null,
            catalog_number: "HD-1001",
            vendor_id: 21,
            item_type: "general_merchandise",
          } as never,
        ],
        total: 1,
        page: 1,
        pageSize: 50,
      },
      loading: false,
      refetch: refetchMock,
    });
    useProductSelectionMock.mockReturnValue({
      selected: new Map([
        [
          1001,
          makeSelectedProduct({
            retailPrice: 39.99,
            cost: 19.5,
            pricingLocationId: 2,
          }),
        ],
      ]),
      selectedCount: 1,
      toggle: vi.fn(),
      toggleAll: vi.fn(),
      refreshVisibleSelections: vi.fn(),
      clear: vi.fn(),
      isSelected: vi.fn(),
      saveToSession: vi.fn(),
    });

    const view = render(<ProductsPage />);

    await waitFor(() => {
      expect(screen.getByText("selected-retail:41.99")).toBeInTheDocument();
    });
    expect(screen.getByText("selected-cost:21.5")).toBeInTheDocument();

    searchParamsState = new URLSearchParams("tab=merchandise&loc=4&page=2");
    useProductSearchMock.mockReturnValue({
      data: {
        products: [],
        total: 0,
        page: 2,
        pageSize: 50,
      },
      loading: false,
      refetch: refetchMock,
    });
    view.rerender(<ProductsPage />);

    await waitFor(() => {
      expect(screen.getByText("selected-retail:41.99")).toBeInTheDocument();
    });
    expect(screen.getByText("selected-cost:21.5")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save selection snapshot" }));
    expect(JSON.parse(sessionStorage.getItem(CATALOG_ITEMS_STORAGE_KEY) ?? "[]")).toMatchObject([
      {
        sku: 1001,
        retailPrice: 41.99,
        cost: 21.5,
      },
    ]);

    await user.click(screen.getByRole("button", { name: "Open edit dialog" }));

    await waitFor(() => {
      expect(screen.getByText("dialog:v2")).toBeInTheDocument();
    });

    // Off-page edit baselines still reuse the current-scope values we already saw.
    expect(screen.getByText("item-retail:41.99")).toBeInTheDocument();
    expect(screen.getByText("item-cost:21.5")).toBeInTheDocument();
  });

  it("reuses scoped barcode and discontinue updates for off-page reopen baselines after a save", async () => {
    const user = userEvent.setup();

    searchParamsState = new URLSearchParams("tab=merchandise&loc=4");
    useProductSearchMock.mockReturnValue({
      data: {
        products: [
          {
            sku: 1001,
            description: "Pierce Hoodie",
            title: null,
            retail_price: 41.99,
            cost: 21.5,
            primary_location_id: 4,
            selected_inventories: [
              {
                locationId: 4,
                retailPrice: 41.99,
                cost: 21.5,
              },
            ],
            barcode: "123456789012",
            author: null,
            isbn: null,
            edition: null,
            catalog_number: "HD-1001",
            vendor_id: 21,
            item_type: "general_merchandise",
            discontinued: false,
          } as never,
        ],
        total: 1,
        page: 1,
        pageSize: 50,
      },
      loading: false,
      refetch: refetchMock,
    });
    useProductSelectionMock.mockReturnValue({
      selected: new Map([
        [
          1001,
          makeSelectedProduct({
            retailPrice: 39.99,
            cost: 19.5,
            pricingLocationId: 2,
            barcode: "123456789012",
            fDiscontinue: 0,
          }),
        ],
      ]),
      selectedCount: 1,
      toggle: vi.fn(),
      toggleAll: vi.fn(),
      refreshVisibleSelections: vi.fn(),
      clear: vi.fn(),
      isSelected: vi.fn(),
      saveToSession: vi.fn(),
    });

    const view = render(<ProductsPage />);

    searchParamsState = new URLSearchParams("tab=merchandise&loc=4&page=2");
    useProductSearchMock.mockReturnValue({
      data: {
        products: [],
        total: 0,
        page: 2,
        pageSize: 50,
      },
      loading: false,
      refetch: refetchMock,
    });
    view.rerender(<ProductsPage />);

    await user.click(screen.getByRole("button", { name: "Open edit dialog" }));

    await waitFor(() => {
      expect(screen.getByText("dialog:v2")).toBeInTheDocument();
    });

    expect(screen.getByText("item-barcode:123456789012")).toBeInTheDocument();
    expect(screen.getByText("item-fDiscontinue:0")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save scoped v2 dialog" }));

    await waitFor(() => {
      expect(screen.queryByText("dialog:v2")).not.toBeInTheDocument();
    });

    expect(screen.getByText("selected-retail:44.99")).toBeInTheDocument();
    expect(screen.getByText("selected-cost:22.25")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save selection snapshot" }));
    expect(JSON.parse(sessionStorage.getItem(CATALOG_ITEMS_STORAGE_KEY) ?? "[]")).toMatchObject([
      {
        sku: 1001,
        retailPrice: 44.99,
        cost: 22.25,
        barcode: "999888777000",
        fDiscontinue: 1,
      },
    ]);

    await user.click(screen.getByRole("button", { name: "Open edit dialog" }));

    await waitFor(() => {
      expect(screen.getByText("dialog:v2")).toBeInTheDocument();
    });

    expect(screen.getByText("item-barcode:999888777000")).toBeInTheDocument();
    expect(screen.getByText("item-fDiscontinue:1")).toBeInTheDocument();
  });

  it("drops non-sticky saved scoped values after a divergent visible refetch", async () => {
    const user = userEvent.setup();
    let resolveRefetch: ((value: boolean) => void) | null = null;
    const refetchPromise = new Promise<boolean>((resolve) => {
      resolveRefetch = resolve;
    });
    refetchMock.mockReturnValue(refetchPromise);
    searchParamsState = new URLSearchParams("tab=merchandise&loc=4");
    const staleVisibleRow = {
      sku: 1001,
      description: "Pierce Hoodie",
      title: null,
      retail_price: 41.99,
      cost: 21.5,
      primary_location_id: 4,
      selected_inventories: [
        {
          locationId: 4,
          retailPrice: 41.99,
          cost: 21.5,
        },
      ],
      barcode: "123456789012",
      author: null,
      isbn: null,
      edition: null,
      catalog_number: "HD-1001",
      vendor_id: 21,
      item_type: "general_merchandise",
      discontinued: false,
    } as never;
    useProductSearchMock.mockReturnValue({
      data: {
        products: [staleVisibleRow],
        total: 1,
        page: 1,
        pageSize: 50,
      },
      loading: false,
      refetch: refetchMock,
    });
    useProductSelectionMock.mockReturnValue({
      selected: new Map([
        [
          1001,
          makeSelectedProduct({
            retailPrice: 39.99,
            cost: 19.5,
            pricingLocationId: 2,
            barcode: "123456789012",
            fDiscontinue: 0,
          }),
        ],
      ]),
      selectedCount: 1,
      toggle: vi.fn(),
      toggleAll: vi.fn(),
      refreshVisibleSelections: vi.fn(),
      clear: vi.fn(),
      isSelected: vi.fn(),
      saveToSession: vi.fn(),
    });

    const view = render(<ProductsPage />);

    await user.click(screen.getByRole("button", { name: "Open edit dialog" }));

    await waitFor(() => {
      expect(screen.getByText("dialog:v2")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Save scoped v2 dialog" }));

    await waitFor(() => {
      expect(screen.queryByText("dialog:v2")).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Save selection snapshot" }));
    expect(JSON.parse(sessionStorage.getItem(CATALOG_ITEMS_STORAGE_KEY) ?? "[]")).toMatchObject([
      {
        sku: 1001,
        retailPrice: 44.99,
        cost: 22.25,
        barcode: "999888777000",
        fDiscontinue: 1,
      },
    ]);

    resolveRefetch?.(true);
    await refetchPromise;

    useProductSearchMock.mockReturnValue({
      data: {
        products: [staleVisibleRow],
        total: 1,
        page: 1,
        pageSize: 50,
      },
      loading: false,
      refetch: refetchMock,
    });
    view.rerender(<ProductsPage />);

    await waitFor(() => {
      expect(screen.getByText("selected-retail:41.99")).toBeInTheDocument();
    });
    expect(screen.getByText("selected-cost:21.5")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save selection snapshot" }));
    expect(JSON.parse(sessionStorage.getItem(CATALOG_ITEMS_STORAGE_KEY) ?? "[]")).toMatchObject([
      {
        sku: 1001,
        retailPrice: 41.99,
        cost: 21.5,
        barcode: "123456789012",
        fDiscontinue: 0,
      },
    ]);

    await user.click(screen.getByRole("button", { name: "Open edit dialog" }));

    await waitFor(() => {
      expect(screen.getByText("dialog:v2")).toBeInTheDocument();
    });

    expect(screen.getByText("item-retail:41.99")).toBeInTheDocument();
    expect(screen.getByText("item-cost:21.5")).toBeInTheDocument();
    expect(screen.getByText("item-barcode:123456789012")).toBeInTheDocument();
    expect(screen.getByText("item-fDiscontinue:0")).toBeInTheDocument();
  });

  it("keeps saved scoped values through a stale visible refetch when mirror lag is reported", async () => {
    const user = userEvent.setup();
    searchParamsState = new URLSearchParams("tab=merchandise&loc=4");
    const staleVisibleRow = {
      sku: 1001,
      description: "Pierce Hoodie",
      title: null,
      retail_price: 41.99,
      cost: 21.5,
      primary_location_id: 4,
      selected_inventories: [
        {
          locationId: 4,
          retailPrice: 41.99,
          cost: 21.5,
        },
      ],
      barcode: "123456789012",
      author: null,
      isbn: null,
      edition: null,
      catalog_number: "HD-1001",
      vendor_id: 21,
      item_type: "general_merchandise",
      discontinued: false,
    } as never;
    useProductSearchMock.mockReturnValue({
      data: {
        products: [staleVisibleRow],
        total: 1,
        page: 1,
        pageSize: 50,
      },
      loading: false,
      refetch: refetchMock,
    });
    useProductSelectionMock.mockReturnValue({
      selected: new Map([
        [
          1001,
          makeSelectedProduct({
            retailPrice: 39.99,
            cost: 19.5,
            pricingLocationId: 2,
            barcode: "123456789012",
            fDiscontinue: 0,
          }),
        ],
      ]),
      selectedCount: 1,
      toggle: vi.fn(),
      toggleAll: vi.fn(),
      refreshVisibleSelections: vi.fn(),
      clear: vi.fn(),
      isSelected: vi.fn(),
      saveToSession: vi.fn(),
    });

    const view = render(<ProductsPage />);

    await user.click(screen.getByRole("button", { name: "Open edit dialog" }));

    await waitFor(() => {
      expect(screen.getByText("dialog:v2")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Save scoped v2 dialog with mirror warning" }));

    await waitFor(() => {
      expect(screen.queryByText("dialog:v2")).not.toBeInTheDocument();
    });

    useProductSearchMock.mockReturnValue({
      data: {
        products: [staleVisibleRow],
        total: 1,
        page: 1,
        pageSize: 50,
      },
      loading: false,
      refetch: refetchMock,
    });
    view.rerender(<ProductsPage />);

    expect(screen.getByText("selected-retail:44.99")).toBeInTheDocument();
    expect(screen.getByText("selected-cost:22.25")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save selection snapshot" }));
    expect(JSON.parse(sessionStorage.getItem(CATALOG_ITEMS_STORAGE_KEY) ?? "[]")).toMatchObject([
      {
        sku: 1001,
        retailPrice: 44.99,
        cost: 22.25,
        barcode: "999888777000",
        fDiscontinue: 1,
      },
    ]);

    await user.click(screen.getByRole("button", { name: "Open edit dialog" }));

    await waitFor(() => {
      expect(screen.getByText("dialog:v2")).toBeInTheDocument();
    });

    expect(screen.getByText("item-retail:44.99")).toBeInTheDocument();
    expect(screen.getByText("item-cost:22.25")).toBeInTheDocument();
    expect(screen.getByText("item-barcode:999888777000")).toBeInTheDocument();
    expect(screen.getByText("item-fDiscontinue:1")).toBeInTheDocument();
  });

  it("keeps confirmed saved scoped values when the post-save refetch fails", async () => {
    const user = userEvent.setup();
    refetchMock.mockResolvedValue(false);
    searchParamsState = new URLSearchParams("tab=merchandise&loc=4");
    const staleVisibleRow = {
      sku: 1001,
      description: "Pierce Hoodie",
      title: null,
      retail_price: 41.99,
      cost: 21.5,
      primary_location_id: 4,
      selected_inventories: [
        {
          locationId: 4,
          retailPrice: 41.99,
          cost: 21.5,
        },
      ],
      barcode: "123456789012",
      author: null,
      isbn: null,
      edition: null,
      catalog_number: "HD-1001",
      vendor_id: 21,
      item_type: "general_merchandise",
      discontinued: false,
    } as never;
    useProductSearchMock.mockReturnValue({
      data: {
        products: [staleVisibleRow],
        total: 1,
        page: 1,
        pageSize: 50,
      },
      loading: false,
      refetch: refetchMock,
    });
    useProductSelectionMock.mockReturnValue({
      selected: new Map([
        [
          1001,
          makeSelectedProduct({
            retailPrice: 39.99,
            cost: 19.5,
            pricingLocationId: 2,
            barcode: "123456789012",
            fDiscontinue: 0,
          }),
        ],
      ]),
      selectedCount: 1,
      toggle: vi.fn(),
      toggleAll: vi.fn(),
      refreshVisibleSelections: vi.fn(),
      clear: vi.fn(),
      isSelected: vi.fn(),
      saveToSession: vi.fn(),
    });

    const view = render(<ProductsPage />);

    await user.click(screen.getByRole("button", { name: "Open edit dialog" }));

    await waitFor(() => {
      expect(screen.getByText("dialog:v2")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Save scoped v2 dialog" }));

    await waitFor(() => {
      expect(screen.queryByText("dialog:v2")).not.toBeInTheDocument();
    });

    useProductSearchMock.mockReturnValue({
      data: {
        products: [staleVisibleRow],
        total: 1,
        page: 1,
        pageSize: 50,
      },
      loading: false,
      refetch: refetchMock,
    });
    view.rerender(<ProductsPage />);

    await waitFor(() => {
      expect(screen.getByText("selected-retail:44.99")).toBeInTheDocument();
    });
    expect(screen.getByText("selected-cost:22.25")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save selection snapshot" }));
    expect(JSON.parse(sessionStorage.getItem(CATALOG_ITEMS_STORAGE_KEY) ?? "[]")).toMatchObject([
      {
        sku: 1001,
        retailPrice: 44.99,
        cost: 22.25,
        barcode: "999888777000",
        fDiscontinue: 1,
      },
    ]);

    await user.click(screen.getByRole("button", { name: "Open edit dialog" }));

    await waitFor(() => {
      expect(screen.getByText("dialog:v2")).toBeInTheDocument();
    });

    expect(screen.getByText("item-retail:44.99")).toBeInTheDocument();
    expect(screen.getByText("item-cost:22.25")).toBeInTheDocument();
    expect(screen.getByText("item-barcode:999888777000")).toBeInTheDocument();
    expect(screen.getByText("item-fDiscontinue:1")).toBeInTheDocument();
  });

  it("yields to later same-scope live data after a failed post-save refetch", async () => {
    const user = userEvent.setup();
    refetchMock.mockResolvedValue(false);
    searchParamsState = new URLSearchParams("tab=merchandise&loc=4");
    const staleVisibleRow = {
      sku: 1001,
      description: "Pierce Hoodie",
      title: null,
      retail_price: 41.99,
      cost: 21.5,
      primary_location_id: 4,
      selected_inventories: [
        {
          locationId: 4,
          retailPrice: 41.99,
          cost: 21.5,
        },
      ],
      barcode: "123456789012",
      author: null,
      isbn: null,
      edition: null,
      catalog_number: "HD-1001",
      vendor_id: 21,
      item_type: "general_merchandise",
      discontinued: false,
    } as never;
    const refreshedVisibleRow = {
      ...staleVisibleRow,
      retail_price: 47.99,
      cost: 23.5,
      selected_inventories: [
        {
          locationId: 4,
          retailPrice: 47.99,
          cost: 23.5,
        },
      ],
      barcode: "111222333444",
      catalog_number: "HD-1001-LIVE",
      discontinued: true,
    } as never;
    useProductSearchMock.mockReturnValue({
      data: {
        products: [staleVisibleRow],
        total: 1,
        page: 1,
        pageSize: 50,
      },
      loading: false,
      refetch: refetchMock,
    });
    useProductSelectionMock.mockReturnValue({
      selected: new Map([
        [
          1001,
          makeSelectedProduct({
            retailPrice: 39.99,
            cost: 19.5,
            pricingLocationId: 2,
            barcode: "123456789012",
            fDiscontinue: 0,
          }),
        ],
      ]),
      selectedCount: 1,
      toggle: vi.fn(),
      toggleAll: vi.fn(),
      refreshVisibleSelections: vi.fn(),
      clear: vi.fn(),
      isSelected: vi.fn(),
      saveToSession: vi.fn(),
    });

    const view = render(<ProductsPage />);

    await user.click(screen.getByRole("button", { name: "Open edit dialog" }));

    await waitFor(() => {
      expect(screen.getByText("dialog:v2")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Save scoped v2 dialog" }));

    await waitFor(() => {
      expect(screen.queryByText("dialog:v2")).not.toBeInTheDocument();
    });

    useProductSearchMock.mockReturnValue({
      data: {
        products: [staleVisibleRow],
        total: 1,
        page: 1,
        pageSize: 50,
      },
      loading: false,
      refetch: refetchMock,
    });
    view.rerender(<ProductsPage />);

    await waitFor(() => {
      expect(screen.getByText("selected-retail:44.99")).toBeInTheDocument();
    });
    expect(screen.getByText("selected-cost:22.25")).toBeInTheDocument();

    useProductSearchMock.mockReturnValue({
      data: {
        products: [refreshedVisibleRow],
        total: 1,
        page: 1,
        pageSize: 50,
      },
      loading: false,
      refetch: refetchMock,
    });
    view.rerender(<ProductsPage />);

    await waitFor(() => {
      expect(screen.getByText("selected-retail:47.99")).toBeInTheDocument();
    });
    expect(screen.getByText("selected-cost:23.5")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save selection snapshot" }));
    expect(JSON.parse(sessionStorage.getItem(CATALOG_ITEMS_STORAGE_KEY) ?? "[]")).toMatchObject([
      {
        sku: 1001,
        retailPrice: 47.99,
        cost: 23.5,
        barcode: "111222333444",
        fDiscontinue: 1,
      },
    ]);

    await user.click(screen.getByRole("button", { name: "Open edit dialog" }));

    await waitFor(() => {
      expect(screen.getByText("dialog:v2")).toBeInTheDocument();
    });

    expect(screen.getByText("item-retail:47.99")).toBeInTheDocument();
    expect(screen.getByText("item-cost:23.5")).toBeInTheDocument();
    expect(screen.getByText("item-barcode:111222333444")).toBeInTheDocument();
    expect(screen.getByText("item-fDiscontinue:1")).toBeInTheDocument();
  });

  it("drops retained mirror-warning values after a later same-scope fetch returns different live data", async () => {
    const user = userEvent.setup();
    searchParamsState = new URLSearchParams("tab=merchandise&loc=4");
    const staleVisibleRow = {
      sku: 1001,
      description: "Pierce Hoodie",
      title: null,
      retail_price: 41.99,
      cost: 21.5,
      primary_location_id: 4,
      selected_inventories: [
        {
          locationId: 4,
          retailPrice: 41.99,
          cost: 21.5,
        },
      ],
      barcode: "123456789012",
      author: null,
      isbn: null,
      edition: null,
      catalog_number: "HD-1001",
      vendor_id: 21,
      item_type: "general_merchandise",
      discontinued: false,
    } as never;
    const refreshedVisibleRow = {
      ...staleVisibleRow,
      retail_price: 47.99,
      cost: 23.5,
      selected_inventories: [
        {
          locationId: 4,
          retailPrice: 47.99,
          cost: 23.5,
        },
      ],
      barcode: "111222333444",
      catalog_number: "HD-1001-LIVE",
      discontinued: true,
    } as never;
    useProductSearchMock.mockReturnValue({
      data: {
        products: [staleVisibleRow],
        total: 1,
        page: 1,
        pageSize: 50,
      },
      loading: false,
      refetch: refetchMock,
    });
    useProductSelectionMock.mockReturnValue({
      selected: new Map([
        [
          1001,
          makeSelectedProduct({
            retailPrice: 39.99,
            cost: 19.5,
            pricingLocationId: 2,
            barcode: "123456789012",
            fDiscontinue: 0,
          }),
        ],
      ]),
      selectedCount: 1,
      toggle: vi.fn(),
      toggleAll: vi.fn(),
      refreshVisibleSelections: vi.fn(),
      clear: vi.fn(),
      isSelected: vi.fn(),
      saveToSession: vi.fn(),
    });

    const view = render(<ProductsPage />);

    await user.click(screen.getByRole("button", { name: "Open edit dialog" }));

    await waitFor(() => {
      expect(screen.getByText("dialog:v2")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Save scoped v2 dialog with mirror warning" }));

    await waitFor(() => {
      expect(screen.queryByText("dialog:v2")).not.toBeInTheDocument();
    });

    useProductSearchMock.mockReturnValue({
      data: {
        products: [staleVisibleRow],
        total: 1,
        page: 1,
        pageSize: 50,
      },
      loading: false,
      refetch: refetchMock,
    });
    view.rerender(<ProductsPage />);

    await waitFor(() => {
      expect(screen.getByText("selected-retail:44.99")).toBeInTheDocument();
    });
    expect(screen.getByText("selected-cost:22.25")).toBeInTheDocument();

    useProductSearchMock.mockReturnValue({
      data: {
        products: [refreshedVisibleRow],
        total: 1,
        page: 1,
        pageSize: 50,
      },
      loading: false,
      refetch: refetchMock,
    });
    view.rerender(<ProductsPage />);

    await waitFor(() => {
      expect(screen.getByText("selected-retail:47.99")).toBeInTheDocument();
    });
    expect(screen.getByText("selected-cost:23.5")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save selection snapshot" }));
    expect(JSON.parse(sessionStorage.getItem(CATALOG_ITEMS_STORAGE_KEY) ?? "[]")).toMatchObject([
      {
        sku: 1001,
        retailPrice: 47.99,
        cost: 23.5,
        barcode: "111222333444",
        fDiscontinue: 1,
      },
    ]);

    await user.click(screen.getByRole("button", { name: "Open edit dialog" }));

    await waitFor(() => {
      expect(screen.getByText("dialog:v2")).toBeInTheDocument();
    });

    expect(screen.getByText("item-retail:47.99")).toBeInTheDocument();
    expect(screen.getByText("item-cost:23.5")).toBeInTheDocument();
    expect(screen.getByText("item-barcode:111222333444")).toBeInTheDocument();
    expect(screen.getByText("item-fDiscontinue:1")).toBeInTheDocument();
  });

  it("drops off-page mirror-warning overrides once a live current-scope row becomes visible again", async () => {
    const user = userEvent.setup();
    searchParamsState = new URLSearchParams("tab=merchandise&loc=4");
    const initialVisibleRow = {
      sku: 1001,
      description: "Pierce Hoodie",
      title: null,
      retail_price: 41.99,
      cost: 21.5,
      primary_location_id: 4,
      selected_inventories: [
        {
          locationId: 4,
          retailPrice: 41.99,
          cost: 21.5,
        },
      ],
      barcode: "123456789012",
      author: null,
      isbn: null,
      edition: null,
      catalog_number: "HD-1001",
      vendor_id: 21,
      item_type: "general_merchandise",
      discontinued: false,
    } as never;
    const refreshedVisibleRow = {
      ...initialVisibleRow,
      retail_price: 47.99,
      cost: 23.5,
      selected_inventories: [
        {
          locationId: 4,
          retailPrice: 47.99,
          cost: 23.5,
        },
      ],
      barcode: "111222333444",
      catalog_number: "HD-1001-LIVE",
      discontinued: true,
    } as never;
    useProductSearchMock.mockReturnValue({
      data: {
        products: [initialVisibleRow],
        total: 1,
        page: 1,
        pageSize: 50,
      },
      loading: false,
      refetch: refetchMock,
    });
    useProductSelectionMock.mockReturnValue({
      selected: new Map([
        [
          1001,
          makeSelectedProduct({
            retailPrice: 39.99,
            cost: 19.5,
            pricingLocationId: 2,
            barcode: "123456789012",
            fDiscontinue: 0,
          }),
        ],
      ]),
      selectedCount: 1,
      toggle: vi.fn(),
      toggleAll: vi.fn(),
      refreshVisibleSelections: vi.fn(),
      clear: vi.fn(),
      isSelected: vi.fn(),
      saveToSession: vi.fn(),
    });

    const view = render(<ProductsPage />);

    await waitFor(() => {
      expect(screen.getByText("selected-retail:41.99")).toBeInTheDocument();
    });
    expect(screen.getByText("selected-cost:21.5")).toBeInTheDocument();

    searchParamsState = new URLSearchParams("tab=merchandise&loc=4&page=2");
    useProductSearchMock.mockReturnValue({
      data: {
        products: [],
        total: 0,
        page: 2,
        pageSize: 50,
      },
      loading: false,
      refetch: refetchMock,
    });
    view.rerender(<ProductsPage />);

    await user.click(screen.getByRole("button", { name: "Open edit dialog" }));

    await waitFor(() => {
      expect(screen.getByText("dialog:v2")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Save scoped v2 dialog with mirror warning" }));

    await waitFor(() => {
      expect(screen.queryByText("dialog:v2")).not.toBeInTheDocument();
    });

    expect(screen.getByText("selected-retail:44.99")).toBeInTheDocument();
    expect(screen.getByText("selected-cost:22.25")).toBeInTheDocument();

    searchParamsState = new URLSearchParams("tab=merchandise&loc=4");
    useProductSearchMock.mockReturnValue({
      data: {
        products: [refreshedVisibleRow],
        total: 1,
        page: 1,
        pageSize: 50,
      },
      loading: false,
      refetch: refetchMock,
    });
    view.rerender(<ProductsPage />);

    await waitFor(() => {
      expect(screen.getByText("selected-retail:47.99")).toBeInTheDocument();
    });
    expect(screen.getByText("selected-cost:23.5")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save selection snapshot" }));
    expect(JSON.parse(sessionStorage.getItem(CATALOG_ITEMS_STORAGE_KEY) ?? "[]")).toMatchObject([
      {
        sku: 1001,
        retailPrice: 47.99,
        cost: 23.5,
        barcode: "111222333444",
        fDiscontinue: 1,
      },
    ]);

    await user.click(screen.getByRole("button", { name: "Open edit dialog" }));

    await waitFor(() => {
      expect(screen.getByText("dialog:v2")).toBeInTheDocument();
    });

    expect(screen.getByText("item-retail:47.99")).toBeInTheDocument();
    expect(screen.getByText("item-cost:23.5")).toBeInTheDocument();
    expect(screen.getByText("item-barcode:111222333444")).toBeInTheDocument();
    expect(screen.getByText("item-fDiscontinue:1")).toBeInTheDocument();
  });

  it("drops saved current-scope values when a later successful fetch loses that scope", async () => {
    const user = userEvent.setup();
    searchParamsState = new URLSearchParams("tab=merchandise&loc=4");
    const liveScopedRow = {
      sku: 1001,
      description: "Pierce Hoodie",
      title: null,
      retail_price: 41.99,
      cost: 21.5,
      primary_location_id: 4,
      selected_inventories: [
        {
          locationId: 4,
          retailPrice: 41.99,
          cost: 21.5,
        },
      ],
      barcode: "123456789012",
      author: null,
      isbn: null,
      edition: null,
      catalog_number: "HD-1001",
      vendor_id: 21,
      item_type: "general_merchandise",
      discontinued: false,
    } as never;
    const lostScopeRow = {
      ...liveScopedRow,
      retail_price: null,
      cost: null,
      primary_location_id: null,
      selected_inventories: [],
    } as never;
    useProductSearchMock.mockReturnValue({
      data: {
        products: [liveScopedRow],
        total: 1,
        page: 1,
        pageSize: 50,
      },
      loading: false,
      refetch: refetchMock,
    });
    useProductSelectionMock.mockReturnValue({
      selected: new Map([
        [
          1001,
          makeSelectedProduct({
            retailPrice: 39.99,
            cost: 19.5,
            pricingLocationId: 2,
            barcode: "123456789012",
            fDiscontinue: 0,
          }),
        ],
      ]),
      selectedCount: 1,
      toggle: vi.fn(),
      toggleAll: vi.fn(),
      refreshVisibleSelections: vi.fn(),
      clear: vi.fn(),
      isSelected: vi.fn(),
      saveToSession: vi.fn(),
    });

    const view = render(<ProductsPage />);

    await user.click(screen.getByRole("button", { name: "Open edit dialog" }));

    await waitFor(() => {
      expect(screen.getByText("dialog:v2")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Save scoped v2 dialog" }));

    await waitFor(() => {
      expect(screen.queryByText("dialog:v2")).not.toBeInTheDocument();
    });

    useProductSearchMock.mockReturnValue({
      data: {
        products: [lostScopeRow],
        total: 1,
        page: 1,
        pageSize: 50,
      },
      loading: false,
      refetch: refetchMock,
    });
    view.rerender(<ProductsPage />);

    await waitFor(() => {
      expect(screen.getByText("selected-retail:null")).toBeInTheDocument();
    });
    expect(screen.getByText("selected-cost:null")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create Quote" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Create Invoice" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Save selection snapshot" }));
    expect(JSON.parse(sessionStorage.getItem(CATALOG_ITEMS_STORAGE_KEY) ?? "[]")).toMatchObject([
      {
        sku: 1001,
        retailPrice: null,
        cost: null,
      },
    ]);
  });

  it("drops browse-derived current-scope cache when the live row loses that scope", () => {
    searchParamsState = new URLSearchParams("tab=merchandise&loc=4");
    const liveScopedRow = {
      sku: 1001,
      description: "Pierce Hoodie",
      title: null,
      retail_price: 41.99,
      cost: 21.5,
      primary_location_id: 4,
      selected_inventories: [
        {
          locationId: 4,
          retailPrice: 41.99,
          cost: 21.5,
        },
      ],
      barcode: "123456789012",
      author: null,
      isbn: null,
      edition: null,
      catalog_number: "HD-1001",
      vendor_id: 21,
      item_type: "general_merchandise",
      discontinued: false,
    } as never;
    const lostScopeRow = {
      ...liveScopedRow,
      retail_price: null,
      cost: null,
      primary_location_id: null,
      selected_inventories: [],
    } as never;
    useProductSearchMock.mockReturnValue({
      data: {
        products: [liveScopedRow],
        total: 1,
        page: 1,
        pageSize: 50,
      },
      loading: false,
      refetch: refetchMock,
    });
    useProductSelectionMock.mockReturnValue({
      selected: new Map([
        [
          1001,
          makeSelectedProduct({
            retailPrice: 39.99,
            cost: 19.5,
            pricingLocationId: 2,
            barcode: "123456789012",
            fDiscontinue: 0,
          }),
        ],
      ]),
      selectedCount: 1,
      toggle: vi.fn(),
      toggleAll: vi.fn(),
      refreshVisibleSelections: vi.fn(),
      clear: vi.fn(),
      isSelected: vi.fn(),
      saveToSession: vi.fn(),
    });

    const view = render(<ProductsPage />);

    expect(screen.getByText("selected-retail:41.99")).toBeInTheDocument();
    expect(screen.getByText("selected-cost:21.5")).toBeInTheDocument();

    useProductSearchMock.mockReturnValue({
      data: {
        products: [lostScopeRow],
        total: 1,
        page: 1,
        pageSize: 50,
      },
      loading: false,
      refetch: refetchMock,
    });
    view.rerender(<ProductsPage />);

    expect(screen.getByText("selected-retail:null")).toBeInTheDocument();
    expect(screen.getByText("selected-cost:null")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create Quote" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Create Invoice" })).toBeDisabled();
  });

  it("reuses saved non-primary location snapshots after switching scope off-page", async () => {
    const user = userEvent.setup();
    searchParamsState = new URLSearchParams("tab=merchandise&loc=2");
    useProductSearchMock.mockReturnValue({
      data: {
        products: [
          {
            sku: 1001,
            description: "Pierce Hoodie",
            title: null,
            retail_price: 39.99,
            cost: 19.5,
            primary_location_id: 2,
            selected_inventories: [
              {
                locationId: 2,
                retailPrice: 39.99,
                cost: 19.5,
              },
            ],
            barcode: "123456789012",
            author: null,
            isbn: null,
            edition: null,
            catalog_number: "HD-1001",
            vendor_id: 21,
            item_type: "general_merchandise",
            discontinued: false,
          } as never,
        ],
        total: 1,
        page: 1,
        pageSize: 50,
      },
      loading: false,
      refetch: refetchMock,
    });
    useProductSelectionMock.mockReturnValue({
      selected: new Map([
        [
          1001,
          makeSelectedProduct({
            retailPrice: 39.99,
            cost: 19.5,
            pricingLocationId: 2,
            barcode: "123456789012",
            fDiscontinue: 0,
          }),
        ],
      ]),
      selectedCount: 1,
      toggle: vi.fn(),
      toggleAll: vi.fn(),
      refreshVisibleSelections: vi.fn(),
      clear: vi.fn(),
      isSelected: vi.fn(),
      saveToSession: vi.fn(),
    });

    render(<ProductsPage />);

    await user.click(screen.getByRole("button", { name: "Open edit dialog" }));

    await waitFor(() => {
      expect(screen.getByText("dialog:v2")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Save secondary scoped v2 dialog" }));

    await waitFor(() => {
      expect(screen.queryByText("dialog:v2")).not.toBeInTheDocument();
    });

    useProductSearchMock.mockReturnValue({
      data: {
        products: [],
        total: 0,
        page: 2,
        pageSize: 50,
      },
      loading: false,
      refetch: refetchMock,
    });
    await user.click(screen.getByRole("button", { name: "scope:PCOP" }));

    expect(screen.getByText("selected-retail:55.55")).toBeInTheDocument();
    expect(screen.getByText("selected-cost:27.75")).toBeInTheDocument();
    expect(screen.getByText("edit-retail:55.55")).toBeInTheDocument();
    expect(screen.getByText("edit-cost:27.75")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save selection snapshot" }));
    expect(JSON.parse(sessionStorage.getItem(CATALOG_ITEMS_STORAGE_KEY) ?? "[]")).toMatchObject([
      {
        sku: 1001,
        retailPrice: 55.55,
        cost: 27.75,
        barcode: "333222111000",
        fDiscontinue: 1,
      },
    ]);

    await user.click(screen.getByRole("button", { name: "Open edit dialog" }));

    await waitFor(() => {
      expect(screen.getByText("dialog:v2")).toBeInTheDocument();
    });

    expect(screen.getByText("item-retail:55.55")).toBeInTheDocument();
    expect(screen.getByText("item-cost:27.75")).toBeInTheDocument();
    expect(screen.getByText("item-barcode:333222111000")).toBeInTheDocument();
    expect(screen.getByText("item-fDiscontinue:1")).toBeInTheDocument();
  });

  it("routes single textbook selections to v2 when the flag is on", async () => {
    const user = userEvent.setup();

    useProductSelectionMock.mockReturnValue({
      selected: new Map([
        [
          2001,
          makeSelectedProduct({
            sku: 2001,
            description: "Chemistry 101",
            itemType: "textbook",
          }),
        ],
      ]),
      selectedCount: 1,
      toggle: vi.fn(),
      toggleAll: vi.fn(),
      refreshVisibleSelections: vi.fn(),
      clear: vi.fn(),
      isSelected: vi.fn(),
      saveToSession: vi.fn(),
    });

    render(<ProductsPage />);

    await user.click(screen.getByRole("button", { name: "Open edit dialog" }));

    await waitFor(() => {
      expect(screen.getByText("dialog:v2")).toBeInTheDocument();
    });

    expect(screen.queryByText("dialog:legacy")).not.toBeInTheDocument();
    expect(detailMock).toHaveBeenCalledWith(2001);
  });

  it("routes single used textbook selections to v2 when the flag is on", async () => {
    const user = userEvent.setup();

    useProductSelectionMock.mockReturnValue({
      selected: new Map([
        [
          2001,
          makeSelectedProduct({
            sku: 2001,
            description: "Used Chemistry 101",
            itemType: "used_textbook",
          }),
        ],
      ]),
      selectedCount: 1,
      toggle: vi.fn(),
      toggleAll: vi.fn(),
      refreshVisibleSelections: vi.fn(),
      clear: vi.fn(),
      isSelected: vi.fn(),
      saveToSession: vi.fn(),
    });

    render(<ProductsPage />);

    await user.click(screen.getByRole("button", { name: "Open edit dialog" }));

    await waitFor(() => {
      expect(screen.getByText("dialog:v2")).toBeInTheDocument();
    });

    expect(screen.queryByText("dialog:legacy")).not.toBeInTheDocument();
    expect(detailMock).toHaveBeenCalledWith(2001);
  });

  it("routes mixed or bulk textbook selections through v2 so shared fields stay on the parity path", async () => {
    const user = userEvent.setup();

    useProductSelectionMock.mockReturnValue({
      selected: new Map([
        [
          1001,
          makeSelectedProduct({
            sku: 1001,
            description: "Pierce Hoodie",
            itemType: "general_merchandise",
          }),
        ],
        [
          2001,
          makeSelectedProduct({
            sku: 2001,
            description: "Chemistry 101",
            itemType: "textbook",
          }),
        ],
      ]),
      selectedCount: 2,
      toggle: vi.fn(),
      toggleAll: vi.fn(),
      refreshVisibleSelections: vi.fn(),
      clear: vi.fn(),
      isSelected: vi.fn(),
      saveToSession: vi.fn(),
    });

    render(<ProductsPage />);

    await user.click(screen.getByRole("button", { name: "Open edit dialog" }));

    await waitFor(() => {
      expect(screen.getByText("dialog:v2")).toBeInTheDocument();
    });

    expect(screen.queryByText("dialog:legacy")).not.toBeInTheDocument();
  });

  it("keeps merchandise selections on v2 even when the old feature flag is off", async () => {
    const user = userEvent.setup();

    process.env.NEXT_PUBLIC_PRODUCTS_EDIT_DIALOG_V2 = "false";

    render(<ProductsPage />);

    await user.click(screen.getByRole("button", { name: "Open edit dialog" }));

    await waitFor(() => {
      expect(screen.getByText("dialog:v2")).toBeInTheDocument();
    });

    expect(screen.queryByText("dialog:legacy")).not.toBeInTheDocument();
  });

  it("honors the legacy override even when the v2 flag is enabled", async () => {
    const user = userEvent.setup();

    searchParamsState = new URLSearchParams("tab=merchandise&editDialog=legacy");

    render(<ProductsPage />);

    await user.click(screen.getByRole("button", { name: "Open edit dialog" }));

    await waitFor(() => {
      expect(screen.getByText("dialog:legacy")).toBeInTheDocument();
    });

    expect(screen.queryByText("dialog:v2")).not.toBeInTheDocument();
    expect(detailMock).not.toHaveBeenCalled();
  });
});
