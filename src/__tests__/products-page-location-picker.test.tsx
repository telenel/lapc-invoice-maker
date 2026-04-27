import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { forwardRef, useEffect, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SYSTEM_PRESET_VIEWS } from "@/domains/product/presets";

const { replaceMock, healthMock, searchProductsMock, useProductSearchMock, useProductSelectionMock } = vi.hoisted(() => ({
  replaceMock: vi.fn(),
  healthMock: vi.fn(),
  searchProductsMock: vi.fn(),
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
    return <button type="button" {...props}>{children}</button>;
  },
}));

vi.mock("@/components/products/product-filters", () => ({
  ProductFilterSummary: () => <div data-testid="filter-summary" />,
  ProductFiltersBar: ({ filters }: { filters: { tab: string } }) => (
    <div data-testid="filters-bar">filters:{filters.tab}</div>
  ),
}));

vi.mock("@/components/products/product-filters-extended", () => ({
  ProductFiltersExtended: () => <div data-testid="filters-extended" />,
}));

vi.mock("@/components/products/product-table", () => ({
  ProductTable: ({
    page,
    visibleColumns,
  }: {
    page: number;
    visibleColumns: string[];
  }) => (
    <div data-testid="product-table-state">
      {`page:${page}|visible:${visibleColumns.join(",")}`}
    </div>
  ),
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

vi.mock("@/components/products/sync-prism-status-pill", () => ({
  SyncPrismStatusPill: forwardRef<HTMLDivElement>(function SyncPrismStatusPillStub(_, ref) {
    void ref;
    return <div data-testid="sync-prism-pill" />;
  }),
}));

vi.mock("@/components/products/product-filter-chip-bar", () => ({
  ProductFilterChipBar: () => <div data-testid="filter-chip-bar" />,
}));

vi.mock("@/components/products/location-chip-popover", () => ({
  // Mirror the legacy LocationPicker interface this test exercises: three
  // simple buttons named PIER / PCOP / PFS that swap the location filter
  // single-select. Phase 6.1 swapped the in-page picker for a chip+popover
  // but the location-change semantics are identical.
  LocationChipPopover: ({
    onChange,
  }: {
    onChange?: (value: number[]) => void;
  }) => (
    <div data-testid="location-chip">
      <button type="button" onClick={() => onChange?.([2])}>
        PIER
      </button>
      <button type="button" onClick={() => onChange?.([3])}>
        PCOP
      </button>
      <button type="button" onClick={() => onChange?.([4])}>
        PFS
      </button>
    </div>
  ),
}));

vi.mock("@/components/products/product-inspector", () => ({
  ProductInspector: () => <div data-testid="product-inspector" />,
}));

vi.mock("@/components/products/saved-views-bar", () => ({
  SavedViewsBar: ({
    activeSlug,
    activeId,
    onViewsResolved,
  }: {
    activeSlug: string | null;
    activeId: string | null;
    onViewsResolved?: (views: typeof SYSTEM_PRESET_VIEWS) => void;
  }) => {
    useEffect(() => {
      onViewsResolved?.(SYSTEM_PRESET_VIEWS);
    }, [onViewsResolved]);

    return (
      <div data-testid="saved-view-state">
        {`active-slug:${activeSlug ?? "none"}|active-id:${activeId ?? "none"}`}
      </div>
    );
  },
}));

vi.mock("@/components/products/column-visibility-toggle", () => ({
  ColumnVisibilityToggle: forwardRef<HTMLDivElement, { runtimeOverride: string[] | null }>(
    function ColumnVisibilityToggleStub({ runtimeOverride }, ref) {
      void ref;
      return (
        <div data-testid="column-state">
          {`runtime:${runtimeOverride?.join(",") ?? "none"}`}
        </div>
      );
    },
  ),
}));

import ProductsPage from "@/app/products/page";

describe("ProductsPage location picker integration", () => {
  beforeEach(() => {
    replaceMock.mockClear();
    healthMock.mockResolvedValue({ available: true });
    searchProductsMock.mockResolvedValue({ products: [], total: 0, page: 1, pageSize: 50 });
    useProductSearchMock.mockReturnValue({
      data: { products: [], total: 42, page: 1, pageSize: 50 },
      loading: false,
      refetch: vi.fn(),
    });
    useProductSelectionMock.mockReturnValue({
      selected: new Map(),
      selectedCount: 0,
      toggle: vi.fn(),
      toggleAll: vi.fn(),
      refreshVisibleSelections: vi.fn(),
      clear: vi.fn(),
      isSelected: vi.fn(),
      saveToSession: vi.fn(),
    });
    searchParamsState = new URLSearchParams("view=price-thin-margin-popular&page=4&tab=merchandise");
  });

  afterEach(() => {
    cleanup();
  });

  it("clears the active view and resets pagination when the location filter changes", async () => {
    const user = userEvent.setup();

    render(<ProductsPage />);

    await screen.findByText("active-slug:price-thin-margin-popular|active-id:price-thin-margin-popular");
    await screen.findByText(/runtime:/);
    expect(screen.getByTestId("product-table-state")).toHaveTextContent("page:4");

    await user.click(screen.getByRole("button", { name: "PFS" }));

    await waitFor(() => {
      expect(screen.getByTestId("saved-view-state")).toHaveTextContent("active-slug:none|active-id:none");
      expect(screen.getByTestId("column-state")).toHaveTextContent("runtime:none");
      expect(screen.getByTestId("product-table-state")).toHaveTextContent("page:1");
    });

    const [url, options] = replaceMock.mock.calls.at(-1)!;
    expect(options).toEqual({ scroll: false });

    const params = new URLSearchParams(String(url).split("?")[1] ?? "");
    expect(params.get("view")).toBeNull();
    expect(params.get("page")).toBeNull();
    expect(params.get("tab")).toBe("merchandise");
  });
});
