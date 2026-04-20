"use client";

import { useState, useEffect, useCallback, useDeferredValue } from "react";
import { toast } from "sonner";
import { searchProducts } from "./queries";
import { CATALOG_ITEMS_STORAGE_KEY } from "./constants";
import type {
  Product,
  ProductFilters,
  ProductSearchResult,
  SelectedProduct,
} from "./types";

// ---------------------------------------------------------------------------
// useProductSearch — debounced search through the authenticated browse route
// ---------------------------------------------------------------------------

export function useProductSearch(filters: ProductFilters) {
  const [data, setData] = useState<ProductSearchResult | null>(null);
  const [loading, setLoading] = useState(true);
  const deferredSearch = useDeferredValue(filters.search);

  const effectiveFilters: ProductFilters = {
    ...filters,
    search: deferredSearch,
  };

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const result = await searchProducts(effectiveFilters);
      setData(result);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to search products";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(effectiveFilters)]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, refetch };
}

// ---------------------------------------------------------------------------
// useProductSelection — multi-select cart persisted across tabs/pages
// ---------------------------------------------------------------------------

function productToSelected(product: Product): SelectedProduct {
  return {
    sku: product.sku,
    description: (product.title ?? product.description ?? "").toUpperCase(),
    retailPrice: Number(product.retail_price),
    cost: Number(product.cost),
    barcode: product.barcode,
    author: product.author,
    title: product.title,
    isbn: product.isbn,
    edition: product.edition,
    catalogNumber: product.catalog_number,
    vendorId: product.vendor_id,
    itemType: product.item_type,
  };
}

export function useProductSelection() {
  const [selected, setSelected] = useState<Map<number, SelectedProduct>>(
    () => new Map()
  );

  const toggle = useCallback((product: Product) => {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(product.sku)) {
        next.delete(product.sku);
      } else {
        next.set(product.sku, productToSelected(product));
      }
      return next;
    });
  }, []);

  const toggleAll = useCallback((products: Product[]) => {
    setSelected((prev) => {
      const next = new Map(prev);
      const allOnPage = products.every((p) => next.has(p.sku));
      if (allOnPage) {
        products.forEach((p) => next.delete(p.sku));
      } else {
        products.forEach((p) => next.set(p.sku, productToSelected(p)));
      }
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setSelected(new Map());
  }, []);

  const isSelected = useCallback(
    (sku: number) => selected.has(sku),
    [selected]
  );

  const saveToSession = useCallback(() => {
    const items = Array.from(selected.values());
    sessionStorage.setItem(CATALOG_ITEMS_STORAGE_KEY, JSON.stringify(items));
  }, [selected]);

  return {
    selected,
    selectedCount: selected.size,
    toggle,
    toggleAll,
    clear,
    isSelected,
    saveToSession,
  };
}
