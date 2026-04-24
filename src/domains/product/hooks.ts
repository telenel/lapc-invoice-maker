"use client";

import { useState, useEffect, useCallback, useDeferredValue, useRef } from "react";
import { toast } from "sonner";
import { searchProducts } from "./queries";
import { CATALOG_ITEMS_STORAGE_KEY } from "./constants";
import { browseRowToSelectedProduct } from "./selected-products";
import type {
  ProductBrowseRow,
  ProductBrowseSearchResult,
  ProductFilters,
  SelectedProduct,
} from "./types";

// ---------------------------------------------------------------------------
// useProductSearch — debounced search through the authenticated browse route
// ---------------------------------------------------------------------------

export function useProductSearch(filters: ProductFilters) {
  const [data, setData] = useState<ProductBrowseSearchResult | null>(null);
  const [loading, setLoading] = useState(true);
  const deferredSearch = useDeferredValue(filters.search);

  const effectiveFilters: ProductFilters = {
    ...filters,
    search: deferredSearch,
  };
  const effectiveFiltersKey = JSON.stringify(effectiveFilters);
  const requestSequenceRef = useRef(0);
  const manualRefetchControllerRef = useRef<AbortController | null>(null);

  const refetch = useCallback(async () => {
    manualRefetchControllerRef.current?.abort();
    const controller = new AbortController();
    manualRefetchControllerRef.current = controller;
    const requestId = requestSequenceRef.current + 1;
    requestSequenceRef.current = requestId;
    setLoading(true);
    try {
      const result = await searchProducts(effectiveFilters, { signal: controller.signal });
      if (controller.signal.aborted || requestSequenceRef.current !== requestId) {
        return false;
      }
      setData(result);
      return true;
    } catch (e) {
      if (controller.signal.aborted || requestSequenceRef.current !== requestId) {
        return false;
      }
      const message = e instanceof Error ? e.message : "Failed to search products";
      toast.error(message);
      return false;
    } finally {
      if (manualRefetchControllerRef.current === controller) {
        manualRefetchControllerRef.current = null;
      }
      if (!controller.signal.aborted && requestSequenceRef.current === requestId) {
        setLoading(false);
      }
    }
  }, [effectiveFiltersKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => manualRefetchControllerRef.current?.abort();
  }, []);

  useEffect(() => {
    manualRefetchControllerRef.current?.abort();
    const controller = new AbortController();
    const requestId = requestSequenceRef.current + 1;
    requestSequenceRef.current = requestId;

    async function runSearch() {
      setLoading(true);
      try {
        const result = await searchProducts(effectiveFilters, { signal: controller.signal });
        if (controller.signal.aborted || requestSequenceRef.current !== requestId) return;
        setData(result);
      } catch (e) {
        if (controller.signal.aborted || requestSequenceRef.current !== requestId) return;
        const message = e instanceof Error ? e.message : "Failed to search products";
        toast.error(message);
      } finally {
        if (!controller.signal.aborted && requestSequenceRef.current === requestId) {
          setLoading(false);
        }
      }
    }

    runSearch();
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveFiltersKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return { data, loading, refetch };
}

// ---------------------------------------------------------------------------
// useProductSelection — multi-select cart persisted across tabs/pages
// ---------------------------------------------------------------------------

export function useProductSelection() {
  const [selected, setSelected] = useState<Map<number, SelectedProduct>>(
    () => new Map()
  );

  const toggle = useCallback((product: ProductBrowseRow) => {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(product.sku)) {
        next.delete(product.sku);
      } else {
        next.set(product.sku, browseRowToSelectedProduct(product));
      }
      return next;
    });
  }, []);

  const toggleAll = useCallback((products: ProductBrowseRow[]) => {
    setSelected((prev) => {
      const next = new Map(prev);
      const allOnPage = products.every((p) => next.has(p.sku));
      if (allOnPage) {
        products.forEach((p) => next.delete(p.sku));
      } else {
        products.forEach((p) => next.set(p.sku, browseRowToSelectedProduct(p)));
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
