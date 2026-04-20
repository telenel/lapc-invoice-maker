import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  detailMock,
  healthMock,
  legacyDialogMock,
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
    onEditClick,
    selected,
  }: {
    onEditClick?: () => void;
    selected?: Map<number, { retailPrice: number | null; cost: number | null }>;
  }) => {
    const firstSelected = selected ? Array.from(selected.values())[0] : null;

    return (
      <div>
        <button type="button" onClick={onEditClick}>
          Open edit dialog
        </button>
        <span>{`selected-retail:${firstSelected?.retailPrice ?? "null"}`}</span>
        <span>{`selected-cost:${firstSelected?.cost ?? "null"}`}</span>
      </div>
    );
  },
}));

vi.mock("@/components/products/new-item-dialog", () => ({
  NewItemDialog: () => null,
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
  LocationPicker: () => <div data-testid="location-picker" />,
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
      detail,
      detailLoading,
      locationIds,
      primaryLocationId,
      onSaved,
    }: {
      open: boolean;
      detail?: { sku: number } | null;
      detailLoading?: boolean;
      locationIds?: number[];
      primaryLocationId?: number;
      onSaved?: (skus: number[]) => void;
    }) =>
      open ? (
        <div data-testid="v2-dialog">
          <span>dialog:v2</span>
          <span>{`detail-loading:${detailLoading === true ? "yes" : "no"}`}</span>
          <span>{`detail-sku:${detail?.sku ?? "none"}`}</span>
          <span>{`location-ids:${locationIds?.join(",") ?? "none"}`}</span>
          <span>{`primary-location:${primaryLocationId ?? "none"}`}</span>
          <button type="button" onClick={() => onSaved?.([1001])}>
            Save v2 dialog
          </button>
        </div>
      ) : null,
  ),
}));

import ProductsPage from "@/app/products/page";
import type { ProductEditDetails, SelectedProduct } from "@/domains/product/types";

function makeSelectedProduct(overrides: Partial<SelectedProduct> = {}): SelectedProduct {
  return {
    sku: 1001,
    description: "Pierce Hoodie",
    retailPrice: 39.99,
    cost: 19.5,
    barcode: "123456789012",
    author: null,
    title: null,
    isbn: null,
    edition: null,
    catalogNumber: "HD-1001",
    vendorId: 21,
    itemType: "general_merchandise",
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
    detailMock.mockReset();
    healthMock.mockReset();
    legacyDialogMock.mockClear();
    refetchMock.mockReset();
    replaceMock.mockReset();
    searchProductsMock.mockReset();
    useProductSearchMock.mockReset();
    useProductSelectionMock.mockReset();
    v2DialogMock.mockClear();

    healthMock.mockResolvedValue({ available: true });
    detailMock.mockResolvedValue(makeDetail());
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
      clear: vi.fn(),
      isSelected: vi.fn(),
      saveToSession: vi.fn(),
    });
    searchParamsState = new URLSearchParams("tab=merchandise");
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_PRODUCTS_EDIT_DIALOG_V2 = originalFlag;
    cleanup();
  });

  it("routes flagged GM edits through v2, hydrates detail, and refetches after save", async () => {
    const user = userEvent.setup();

    render(<ProductsPage />);

    await user.click(screen.getByRole("button", { name: "Open edit dialog" }));

    await waitFor(() => {
      expect(screen.getByText("dialog:v2")).toBeInTheDocument();
    });

    expect(detailMock).toHaveBeenCalledWith(1001);
    expect(screen.getByText("detail-sku:1001")).toBeInTheDocument();
    expect(screen.getByText("location-ids:2,3,4")).toBeInTheDocument();
    expect(screen.getByText("primary-location:2")).toBeInTheDocument();
    expect(screen.queryByText("dialog:legacy")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save v2 dialog" }));

    await waitFor(() => {
      expect(refetchMock).toHaveBeenCalledTimes(1);
    });
  });

  it("passes canonical location scope into v2 and still refetches after save", async () => {
    const user = userEvent.setup();

    searchParamsState = new URLSearchParams("tab=merchandise&loc=3,4");

    render(<ProductsPage />);

    await user.click(screen.getByRole("button", { name: "Open edit dialog" }));

    await waitFor(() => {
      expect(screen.getByText("dialog:v2")).toBeInTheDocument();
    });

    expect(screen.getByText("location-ids:3,4")).toBeInTheDocument();
    expect(screen.getByText("primary-location:3")).toBeInTheDocument();

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
          }),
        ],
      ]),
      selectedCount: 1,
      toggle: vi.fn(),
      toggleAll: vi.fn(),
      clear: vi.fn(),
      isSelected: vi.fn(),
      saveToSession: vi.fn(),
    });

    render(<ProductsPage />);

    await user.click(screen.getByRole("button", { name: "Open edit dialog" }));

    await waitFor(() => {
      expect(screen.getByText("dialog:v2")).toBeInTheDocument();
    });

    expect(detailMock).toHaveBeenCalledWith(1001);
    expect(screen.getByText("location-ids:4")).toBeInTheDocument();
    expect(screen.getByText("primary-location:4")).toBeInTheDocument();
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
      clear: vi.fn(),
      isSelected: vi.fn(),
      saveToSession: vi.fn(),
    });

    render(<ProductsPage />);

    expect(screen.getByText("selected-retail:null")).toBeInTheDocument();
    expect(screen.getByText("selected-cost:null")).toBeInTheDocument();
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

  it("keeps mixed or bulk textbook selections on the legacy path", async () => {
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
      clear: vi.fn(),
      isSelected: vi.fn(),
      saveToSession: vi.fn(),
    });

    render(<ProductsPage />);

    await user.click(screen.getByRole("button", { name: "Open edit dialog" }));

    await waitFor(() => {
      expect(screen.getByText("dialog:legacy")).toBeInTheDocument();
    });

    expect(screen.queryByText("dialog:v2")).not.toBeInTheDocument();
    expect(detailMock).not.toHaveBeenCalled();
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
