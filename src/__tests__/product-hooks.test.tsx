import "@testing-library/jest-dom/vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useProductSearch } from "@/domains/product/hooks";
import type { ProductFilters } from "@/domains/product/types";

const { toastErrorMock } = vi.hoisted(() => ({
  toastErrorMock: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    error: toastErrorMock,
  },
}));

vi.mock("@/domains/product/queries", () => ({
  searchProducts: vi.fn(),
}));

import { searchProducts } from "@/domains/product/queries";

const baseFilters: ProductFilters = {
  search: "",
  tab: "textbooks",
  minPrice: "",
  maxPrice: "",
  vendorId: "",
  hasBarcode: false,
  lastSaleDateFrom: "",
  lastSaleDateTo: "",
  author: "",
  hasIsbn: false,
  edition: "",
  catalogNumber: "",
  productType: "",
  sortBy: "sku",
  sortDir: "asc",
  page: 1,
  includeAnalytics: false,
  viewMode: "all",
  viewPreset: null,
};

describe("useProductSearch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("clears stale results when a later search fails", async () => {
    vi.mocked(searchProducts)
      .mockResolvedValueOnce({
        products: [
          {
            sku: 101,
            barcode: null,
            item_type: "textbook",
            description: "Old result",
            author: null,
            title: null,
            isbn: null,
            edition: null,
            retail_price: 10,
            cost: 5,
            catalog_number: null,
            vendor_id: 1,
            dcc_id: 1,
            product_type: null,
            color_id: 0,
            created_at: null,
            last_sale_date: null,
            synced_at: "2026-04-19T00:00:00.000Z",
          },
        ],
        total: 1,
        page: 1,
        pageSize: 50,
      })
      .mockRejectedValueOnce(new Error("Search failed"));

    const { result, rerender } = renderHook(
      ({ filters }) => useProductSearch(filters),
      {
        initialProps: {
          filters: {
            ...baseFilters,
            search: "alpha",
          },
        },
      },
    );

    await waitFor(() => {
      expect(result.current.data?.products).toHaveLength(1);
    });

    rerender({
      filters: {
        ...baseFilters,
        search: "beta",
      },
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toBeNull();
    expect(result.current.error).toBe("Search failed");
    expect(toastErrorMock).toHaveBeenCalledWith("Search failed");
  });
});
