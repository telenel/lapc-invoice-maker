import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { forwardRef, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
  ProductFiltersBar: () => <div data-testid="filters-bar" />,
}));

vi.mock("@/components/products/product-filters-extended", () => ({
  ProductFiltersExtended: () => <div data-testid="filters-extended" />,
}));

vi.mock("@/components/products/product-table", () => ({
  ProductTable: ({ tab }: { tab: string }) => <div data-testid="product-table">{`tab:${tab}`}</div>,
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
  SavedViewsBar: () => <div data-testid="saved-views" />,
}));

vi.mock("@/components/products/column-visibility-toggle", () => ({
  ColumnVisibilityToggle: forwardRef<HTMLDivElement>(function ColumnVisibilityToggleStub(_, ref) {
    void ref;
    return <div data-testid="column-toggle" />;
  }),
}));

import ProductsPage from "@/app/products/page";

describe("ProductsPage quick-picks tab counts", () => {
  beforeEach(() => {
    replaceMock.mockClear();
    healthMock.mockResolvedValue({ available: true });
    searchProductsMock.mockImplementation(async (filters: { tab: string }) => ({
      products: [],
      total: filters.tab === "textbooks" ? 7 : filters.tab === "merchandise" ? 9 : 0,
      page: 1,
      pageSize: 50,
    }));
    useProductSearchMock.mockReturnValue({
      data: { products: [], total: 12, page: 1, pageSize: 50 },
      loading: false,
      refetch: vi.fn(),
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
    searchParamsState = new URLSearchParams("tab=quickPicks");
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the quick-picks tab and refreshes textbook and merchandise counts while it is active", async () => {
    render(<ProductsPage />);

    expect(screen.getByRole("tab", { name: /Quick Picks/i })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("product-table")).toHaveTextContent("tab:quickPicks");

    await waitFor(() => {
      expect(searchProductsMock).toHaveBeenCalledWith(
        expect.objectContaining({ tab: "textbooks" }),
        { countOnly: true },
      );
      expect(searchProductsMock).toHaveBeenCalledWith(
        expect.objectContaining({ tab: "merchandise" }),
        { countOnly: true },
      );
    });

    expect(screen.getByRole("tab", { name: /Textbooks/i })).toHaveTextContent("7");
    expect(screen.getByRole("tab", { name: /General Merchandise/i })).toHaveTextContent("9");
    expect(screen.getByRole("tab", { name: /Quick Picks/i })).toHaveTextContent("12");
  });
});
