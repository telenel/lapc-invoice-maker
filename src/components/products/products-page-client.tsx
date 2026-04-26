"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ChevronDownIcon, SearchIcon, SlidersHorizontalIcon, XIcon } from "lucide-react";
import { useProductSearch, useProductSelection } from "@/domains/product/hooks";
import { searchProducts } from "@/domains/product/queries";
import { CATALOG_ITEMS_STORAGE_KEY, EMPTY_FILTERS, TABS, DEFAULT_COLUMN_SET, OPTIONAL_COLUMNS } from "@/domains/product/constants";
import type { OptionalColumnKey } from "@/domains/product/constants";
import type { ProductFilters, ProductTab, SavedView } from "@/domains/product/types";
import {
  parseFiltersFromSearchParams,
  serializeFiltersToSearchParams,
  applyPreset,
} from "@/domains/product/view-serializer";
import { ProductFilterSummary, ProductFiltersBar } from "@/components/products/product-filters";
import { ProductTable } from "@/components/products/product-table";
import { ProductActionBar } from "@/components/products/product-action-bar";
import { resolveEditDialogMode } from "@/components/products/edit-item-dialog-mode";
import { Button } from "@/components/ui/button";
import { SyncDatabaseButton } from "@/components/products/sync-database-button";
import type { SyncDatabaseHandle } from "@/components/products/sync-database-button";
import { SavedViewsBar } from "@/components/products/saved-views-bar";
import { ColumnVisibilityToggle, type ColumnVisibilityHandle } from "@/components/products/column-visibility-toggle";
import { PierceAssuranceBadge } from "@/components/products/pierce-assurance-badge";
import { LocationPicker } from "@/components/products/location-picker";
import { useProductInlineEdit, type ProductInlineEditRowBaseline } from "@/components/products/use-product-inline-edit";
import { productApi } from "@/domains/product/api-client";
import { SYSTEM_PRESET_VIEWS } from "@/domains/product/presets";
import { shouldApplyDefaultMinStock } from "@/domains/product/page-defaults";
import {
  browseRowToSelectedProduct,
  getSelectedProductCacheKey,
  selectedProductsEqual,
} from "@/domains/product/selected-products";
import {
  getPrimaryProductLocationId,
  serializeProductLocationIdsParam,
  type ProductLocationId,
} from "@/domains/product/location-filters";
import type { ProductBrowseRow, SelectedProduct } from "@/domains/product/types";

const NewItemDialog = dynamic(
  () => import("@/components/products/new-item-dialog").then((m) => m.NewItemDialog),
  { ssr: false },
);

const EditItemDialog = dynamic(
  () => import("@/components/products/edit-item-dialog").then((m) => m.EditItemDialog),
  { ssr: false },
);

const HardDeleteDialog = dynamic(
  () => import("@/components/products/hard-delete-dialog").then((m) => m.HardDeleteDialog),
  { ssr: false },
);

const ProductFiltersExtended = dynamic(
  () => import("@/components/products/product-filters-extended").then((m) => m.ProductFiltersExtended),
  { ssr: false },
);

const SaveViewDialog = dynamic(
  () => import("@/components/products/save-view-dialog").then((m) => m.SaveViewDialog),
  { ssr: false },
);

const DeleteViewDialog = dynamic(
  () => import("@/components/products/delete-view-dialog").then((m) => m.DeleteViewDialog),
  { ssr: false },
);

function getLocationLabel(locationId: ProductLocationId): "PIER" | "PCOP" | "PFS" {
  if (locationId === 3) return "PCOP";
  if (locationId === 4) return "PFS";
  return "PIER";
}

function isTextbookItemType(itemType: string): boolean {
  return itemType === "textbook" || itemType === "used_textbook";
}

function buildFiltersForBrowseTab(
  filters: ProductFilters,
  tab: ProductTab,
): ProductFilters {
  if (tab === "quickPicks") {
    const preserveSection = filters.tab === "quickPicks";
    const sectionSlug = preserveSection ? filters.sectionSlug : undefined;

    return {
      ...filters,
      tab,
      page: 1,
      sectionSlug,
      allSections: preserveSection ? (filters.allSections ?? !sectionSlug) : true,
    };
  }

  return {
    ...filters,
    tab,
    page: 1,
    sectionSlug: undefined,
    allSections: false,
  };
}

function getTabCountBaseFilters(filters: ProductFilters): ProductFilters {
  return {
    ...filters,
    tab: "textbooks",
    page: 1,
    sectionSlug: undefined,
    allSections: false,
  };
}

function getTabCountRefreshKey(filters: ProductFilters): string {
  return JSON.stringify(getTabCountBaseFilters(filters));
}

function actionBarItemToSelectedProduct(item: {
  sku: number;
  description: string;
  retail: number | null;
  cost: number | null;
  stockOnHand?: number | null;
  primaryLocationId: ProductLocationId;
  barcode: string | null;
  author?: string | null;
  title?: string | null;
  isbn?: string | null;
  edition?: string | null;
  catalogNumber?: string | null;
  vendorId?: number | null;
  itemType?: string;
  isTextbook?: boolean;
  fDiscontinue: 0 | 1;
}): SelectedProduct {
  return {
    sku: item.sku,
    description: item.description,
    retailPrice: item.retail,
    cost: item.cost,
    stockOnHand: item.stockOnHand ?? null,
    pricingLocationId: item.primaryLocationId,
    barcode: item.barcode,
    author: item.author ?? null,
    title: item.title ?? null,
    isbn: item.isbn ?? null,
    edition: item.edition ?? null,
    catalogNumber: item.catalogNumber ?? null,
    vendorId: item.vendorId ?? null,
    itemType: item.itemType ?? (item.isTextbook ? "textbook" : "general_merchandise"),
    fDiscontinue: item.fDiscontinue,
  };
}

function buildInlineEditRows(
  products: ProductBrowseRow[],
  primaryLocationId: ProductLocationId,
): ProductInlineEditRowBaseline[] {
  return products.map((product) => {
    const selectedInventories = product.selected_inventories ?? [];
    const primaryInventory = selectedInventories.find(
      (inventory) => inventory.locationId === primaryLocationId,
    );

    return {
      sku: product.sku,
      barcode: product.barcode,
      itemTaxTypeId: product.itemTaxTypeId,
      retail: primaryInventory?.retailPrice ?? null,
      cost: primaryInventory?.cost ?? null,
      fDiscontinue: product.discontinued ? 1 : 0,
    };
  });
}

type SavedScopedSelectionEntry = {
  product: SelectedProduct;
  retainUntilMatch: boolean;
  pendingRefetchToken: number | null;
  retainedLiveSignature: string | null;
};

function getSelectedProductCacheSku(cacheKey: string): number {
  return Number(cacheKey.split(":", 1)[0]);
}

function getSelectedProductSignature(product: SelectedProduct): string {
  return JSON.stringify([
    product.sku,
    product.description,
    product.retailPrice,
    product.cost,
    product.pricingLocationId,
    product.barcode,
    product.author,
    product.title,
    product.isbn,
    product.edition,
    product.catalogNumber,
    product.vendorId,
    product.itemType,
    product.fDiscontinue,
  ]);
}

function shouldUseSavedScopedSelection(
  entry: SavedScopedSelectionEntry | null,
  liveScopedSelection: SelectedProduct | null,
  primaryLocationId: ProductLocationId,
): boolean {
  if (entry == null) {
    return false;
  }
  if (liveScopedSelection == null) {
    return true;
  }
  if (liveScopedSelection.pricingLocationId !== primaryLocationId) {
    return entry.pendingRefetchToken != null && entry.retainedLiveSignature == null;
  }
  const liveSignature = getSelectedProductSignature(liveScopedSelection);
  if (selectedProductsEqual(entry.product, liveScopedSelection)) {
    return true;
  }
  if (entry.pendingRefetchToken == null && entry.retainUntilMatch && entry.retainedLiveSignature == null) {
    return false;
  }
  if (entry.pendingRefetchToken != null) {
    return entry.retainedLiveSignature == null || entry.retainedLiveSignature === liveSignature;
  }
  if (!entry.retainUntilMatch) {
    return false;
  }
  return entry.retainedLiveSignature == null || entry.retainedLiveSignature === liveSignature;
}

function shouldDropSavedScopedSelection(
  entry: SavedScopedSelectionEntry,
  liveScopedSelection: SelectedProduct | null,
  primaryLocationId: ProductLocationId,
): boolean {
  if (liveScopedSelection == null) {
    return false;
  }
  if (liveScopedSelection.pricingLocationId !== primaryLocationId) {
    return entry.pendingRefetchToken == null || entry.retainedLiveSignature != null;
  }
  if (selectedProductsEqual(entry.product, liveScopedSelection)) {
    return true;
  }
  const liveSignature = getSelectedProductSignature(liveScopedSelection);
  if (entry.pendingRefetchToken != null) {
    return entry.retainedLiveSignature != null && entry.retainedLiveSignature !== liveSignature;
  }
  if (entry.retainUntilMatch && entry.retainedLiveSignature == null) {
    return true;
  }
  if (!entry.retainUntilMatch) {
    return true;
  }
  return entry.retainedLiveSignature != null && entry.retainedLiveSignature !== liveSignature;
}

export default function ProductsPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const viewParam = searchParams.get("view");
  const editDialogOverride = searchParams.get("editDialog");
  const [filters, setFilters] = useState<ProductFilters>(() => {
    // Convert Next.js useSearchParams() to URLSearchParams
    const params = new URLSearchParams();
    searchParams.forEach((value, key) => params.set(key, value));
    const parsed = parseFiltersFromSearchParams(params);
    // The in-stock baseline is a catalog default, not a user-composed
    // filter. Apply it unless the URL explicitly carries a `minStock` param
    // — "no stock filter" is encoded by omitting the param or passing
    // `minStock=0`. This makes presets and custom saved views that simply
    // don't care about stock inherit the baseline (matching the normal
    // /products landing behavior), while still letting a user say "show
    // everything" with an explicit `minStock=0`.
    if (shouldApplyDefaultMinStock(params, !!viewParam, parsed.minStock)) {
      return { ...parsed, minStock: "1" };
    }
    return parsed;
  });

  const { data, loading, refetch } = useProductSearch(filters);

  // Prism availability — controls whether write features (New Item, Delete) are shown.
  // True only on the campus dev machine where the SQL Server is reachable. We
  // poll every 30s while unavailable so a transient health blip doesn't lock
  // write actions off for the rest of the SPA session.
  const [prismAvailable, setPrismAvailable] = useState(false);
  const [healthReady, setHealthReady] = useState(false);
  useEffect(() => {
    if (data && !healthReady) {
      setHealthReady(true);
    }
  }, [data, healthReady]);

  useEffect(() => {
    if (!healthReady) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const check = () => {
      productApi
        .health()
        .then((h) => {
          if (cancelled) return;
          setPrismAvailable(h.available);
          if (!h.available) {
            timer = setTimeout(check, 30_000);
          }
        })
        .catch(() => {
          if (cancelled) return;
          setPrismAvailable(false);
          timer = setTimeout(check, 30_000);
        });
    };

    check();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [healthReady]);

  const [newItemOpen, setNewItemOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [hardDeleteOpen, setHardDeleteOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const [activeView, setActiveView] = useState<SavedView | null>(null);
  const [runtimeColumns, setRuntimeColumns] = useState<OptionalColumnKey[] | null>(null);
  const [baseColumns, setBaseColumns] = useState<OptionalColumnKey[]>(DEFAULT_COLUMN_SET);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SavedView | null>(null);
  const columnsRef = useRef<ColumnVisibilityHandle>(null);
  const syncButtonRef = useRef<SyncDatabaseHandle>(null);
  const restoredViewRef = useRef<string | null>(null);
  const [hiddenCount, setHiddenCount] = useState(0);
  const [resolvedViews, setResolvedViews] = useState<SavedView[]>(SYSTEM_PRESET_VIEWS);
  // Bumped after saveView / deleteView succeeds so the SavedViewsBar refetches.
  const [savedViewsRefresh, setSavedViewsRefresh] = useState(0);

  // Track tab counts with a filter-scoped count request so inactive tabs never
  // inherit the active tab's total during page/sort/category transitions.
  const [tabCounts, setTabCounts] = useState<Record<ProductTab, number | null>>({
    textbooks: null,
    merchandise: null,
    quickPicks: null,
  });
  const tabCountRefreshKey = useMemo(() => getTabCountRefreshKey(filters), [filters]);
  const tabCountBaseFilters = useMemo(() => getTabCountBaseFilters(filters), [tabCountRefreshKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const [tabCountsReady, setTabCountsReady] = useState(false);
  const tabCountRequestRef = useRef(0);
  useEffect(() => {
    if (data) {
      setTabCounts((prev) => ({ ...prev, [filters.tab]: data.total }));
      if (!tabCountsReady) {
        setTabCountsReady(true);
      }
    }
  }, [data, filters.tab, tabCountsReady]);

  useEffect(() => {
    if (!tabCountsReady) return;
    const requestId = tabCountRequestRef.current + 1;
    tabCountRequestRef.current = requestId;
    const controller = new AbortController();

    const timer = setTimeout(() => {
      Promise.all(
        TABS.map(async (tab) => {
          const result = await searchProducts(
            buildFiltersForBrowseTab(tabCountBaseFilters, tab.value),
            { countOnly: true, signal: controller.signal },
          );
          return [tab.value, result.total] as const;
        }),
      )
        .then((results) => {
          if (controller.signal.aborted || tabCountRequestRef.current !== requestId) return;
          setTabCounts(Object.fromEntries(results) as Record<ProductTab, number>);
        })
        .catch(() => {
          // Silent — stale count stays visible rather than showing a spinner.
        });
    }, 750);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [tabCountsReady, tabCountBaseFilters]);
  const {
    selected,
    selectedCount,
    toggle,
    toggleAll,
    clear,
    remove,
    isSelected,
  } = useProductSelection();
  const primaryLocationId = getPrimaryProductLocationId(filters.locationIds);
  const [scopedSelectionCache, setScopedSelectionCache] = useState<Map<string, SelectedProduct>>(
    () => new Map(),
  );
  const [savedScopedSelectionCache, setSavedScopedSelectionCache] = useState<
    Map<string, SavedScopedSelectionEntry>
  >(() => new Map());
  const nextSavedScopedSelectionTokenRef = useRef(0);
  const pendingSaveTokenRef = useRef<number | null>(null);

  useEffect(() => {
    const selectedSkus = new Set(selected.keys());

    setScopedSelectionCache((current) => {
      let changed = false;
      const next = new Map(current);
      for (const cacheKey of Array.from(current.keys())) {
        if (selectedSkus.has(getSelectedProductCacheSku(cacheKey))) {
          continue;
        }
        next.delete(cacheKey);
        changed = true;
      }
      return changed ? next : current;
    });

    setSavedScopedSelectionCache((current) => {
      let changed = false;
      const next = new Map(current);
      for (const cacheKey of Array.from(current.keys())) {
        if (selectedSkus.has(getSelectedProductCacheSku(cacheKey))) {
          continue;
        }
        next.delete(cacheKey);
        changed = true;
      }
      return changed ? next : current;
    });
  }, [selected]);

  const scopedSelected = useMemo(() => {
    const scopedRowsBySku = new Map((data?.products ?? []).map((product) => [product.sku, product]));
    return new Map(
      Array.from(selected.entries()).map(([sku, product]) => {
        const scopedRow = scopedRowsBySku.get(sku);
        const liveScopedSelection = scopedRow ? browseRowToSelectedProduct(scopedRow) : null;
        const cacheKey = getSelectedProductCacheKey(sku, primaryLocationId);
        const savedScopedSelectionEntry =
          cacheKey != null ? (savedScopedSelectionCache.get(cacheKey) ?? null) : null;
        const savedScopedSelection =
          shouldUseSavedScopedSelection(
            savedScopedSelectionEntry,
            liveScopedSelection,
            primaryLocationId,
          )
            ? (savedScopedSelectionEntry?.product ?? null)
            : null;
        const canUseScopedSelectionCache =
          liveScopedSelection == null || liveScopedSelection.pricingLocationId === primaryLocationId;
        const cachedScopedSelection =
          savedScopedSelection ??
          (
            canUseScopedSelectionCache
              ? (cacheKey != null ? (scopedSelectionCache.get(cacheKey) ?? null) : null)
              : null
          );
        if (cachedScopedSelection) {
          return [sku, cachedScopedSelection];
        }
        return [sku, liveScopedSelection ?? product];
      }),
    );
  }, [data?.products, primaryLocationId, savedScopedSelectionCache, scopedSelectionCache, selected]);
  const selectedItems = Array.from(scopedSelected.values());
  const visibleSelectedCount = useMemo(
    () => (data?.products ?? []).filter((product) => selected.has(product.sku)).length,
    [data?.products, selected],
  );
  const offPageSelectedCount = Math.max(0, selectedCount - visibleSelectedCount);
  useEffect(() => {
    const visibleSelectedRows = (data?.products ?? []).filter((product) => selected.has(product.sku));
    if (visibleSelectedRows.length === 0) return;

    setScopedSelectionCache((current) => {
      let changed = false;
      const next = new Map(current);
      for (const product of visibleSelectedRows) {
        const scopedSelection = browseRowToSelectedProduct(product);
        const currentScopeCacheKey = getSelectedProductCacheKey(product.sku, primaryLocationId);
        if (scopedSelection.pricingLocationId !== primaryLocationId) {
          if (currentScopeCacheKey != null && next.delete(currentScopeCacheKey)) {
            changed = true;
          }
          continue;
        }
        const cacheKey = currentScopeCacheKey;
        if (cacheKey == null) {
          continue;
        }
        const cachedSelection = next.get(cacheKey);
        if (!cachedSelection || !selectedProductsEqual(cachedSelection, scopedSelection)) {
          next.set(cacheKey, scopedSelection);
          changed = true;
        }
      }
      return changed ? next : current;
    });
    setSavedScopedSelectionCache((current) => {
      let changed = false;
      const next = new Map(current);
      for (const product of visibleSelectedRows) {
        const scopedSelection = browseRowToSelectedProduct(product);
        const cacheKey = getSelectedProductCacheKey(product.sku, primaryLocationId);
        if (cacheKey == null) {
          continue;
        }
        const savedSelection = next.get(cacheKey);
        if (savedSelection) {
          if (scopedSelection.pricingLocationId !== primaryLocationId) {
            if (shouldDropSavedScopedSelection(savedSelection, scopedSelection, primaryLocationId)) {
              next.delete(cacheKey);
              changed = true;
            }
            continue;
          }
          if (shouldDropSavedScopedSelection(savedSelection, scopedSelection, primaryLocationId)) {
            next.delete(cacheKey);
            changed = true;
          }
        }
      }
      return changed ? next : current;
    });
  }, [data?.products, primaryLocationId, selected]);
  const editDialogMode = resolveEditDialogMode({
    featureFlagEnabled: process.env.NEXT_PUBLIC_PRODUCTS_EDIT_DIALOG_V2 === "true",
    override: editDialogOverride ?? null,
    hasTextbookSelection: selectedItems.some((product) => isTextbookItemType(product.itemType)),
    selectionCount: selectedItems.length,
  });
  // Separate edit baselines from catalog handoff. The server's concurrency
  // SELECT does `LEFT JOIN Inventory ON LocationID = @loc` and reads
  // `inv.Retail` / `inv.Cost`, which is NULL when no Inventory row exists at
  // that location, so edit baselines must stay strict to the current scope.
  // The browse route still exposes a fallback `retail_price` / `cost` even
  // when the current scope has no slice; invoice/quote/barcode handoff should
  // preserve that visible fallback for on-page selections, but never reuse an
  // off-page stale price unless it was captured or saved in the active scope.
  // Successful saves seed a per-scope cache so action-bar/session/edit payloads
  // keep the confirmed values even while the mirror catches up.
  const browseRowsBySku = new Map((data?.products ?? []).map((p) => [p.sku, p] as const));
  const selectionStates = selectedItems
    .map((product) => {
      const browseRow = browseRowsBySku.get(product.sku);
      const liveScopedSelection = browseRow != null ? browseRowToSelectedProduct(browseRow) : null;
      const browseRowHasCurrentScope = liveScopedSelection?.pricingLocationId === primaryLocationId;
      const primarySlice = browseRow?.selected_inventories?.find(
        (inv) => inv.locationId === primaryLocationId,
      );
      const cacheKey = getSelectedProductCacheKey(product.sku, primaryLocationId);
      const confirmedScopedSelection =
        cacheKey != null
          ? (
            (() => {
              const savedScopedSelectionEntry = savedScopedSelectionCache.get(cacheKey) ?? null;
              return shouldUseSavedScopedSelection(
                savedScopedSelectionEntry,
                liveScopedSelection,
                primaryLocationId,
              )
                ? (savedScopedSelectionEntry?.product ?? null)
                : null;
            })()
          )
          : null;
      const cachedScopedSelection =
        confirmedScopedSelection ??
        (
          cacheKey != null && (browseRow == null || browseRowHasCurrentScope)
            ? (scopedSelectionCache.get(cacheKey) ?? null)
            : null
        );
      const persistedScopedSelection =
        cachedScopedSelection ??
        (
          !browseRow &&
          product.pricingLocationId != null &&
          product.pricingLocationId === primaryLocationId
            ? product
            : null
        );
      const visibleScopedSelection = liveScopedSelection;
      const scopedDescriptor = cachedScopedSelection ?? visibleScopedSelection ?? persistedScopedSelection;
      const retail = cachedScopedSelection?.retailPrice ??
        (
          browseRow != null && visibleScopedSelection != null
            ? (primarySlice?.retailPrice ?? null)
            : (persistedScopedSelection?.retailPrice ?? null)
        );
      const cost = cachedScopedSelection?.cost ??
        (
          browseRow != null && visibleScopedSelection != null
            ? (primarySlice?.cost ?? null)
            : (persistedScopedSelection?.cost ?? null)
        );
      const actionBarRetail = cachedScopedSelection?.retailPrice ??
        (
          browseRow != null
            ? (browseRow.retail_price ?? null)
            : (persistedScopedSelection?.retailPrice ?? null)
        );
      const actionBarCost = cachedScopedSelection?.cost ??
        (
          browseRow != null
            ? (browseRow.cost ?? null)
            : (persistedScopedSelection?.cost ?? null)
        );
      const actionBarStockOnHand = cachedScopedSelection?.stockOnHand ??
        (
          browseRow != null
            ? (primarySlice?.stockOnHand ?? browseRow.stock_on_hand ?? null)
            : (persistedScopedSelection?.stockOnHand ?? null)
        );
      const sharedItem = {
        sku: product.sku,
        barcode: scopedDescriptor?.barcode ?? null,
        fDiscontinue: scopedDescriptor?.fDiscontinue ?? 0,
        description: scopedDescriptor?.description ?? product.description ?? "",
        author: scopedDescriptor?.author ?? product.author ?? null,
        title: scopedDescriptor?.title ?? product.title ?? null,
        isbn: scopedDescriptor?.isbn ?? product.isbn ?? null,
        edition: scopedDescriptor?.edition ?? product.edition ?? null,
        vendorId: scopedDescriptor?.vendorId ?? undefined,
        dccId: undefined,
        isTextbook: isTextbookItemType(scopedDescriptor?.itemType ?? product.itemType),
        itemType: scopedDescriptor?.itemType ?? product.itemType,
        primaryLocationId,
        catalogNumber: scopedDescriptor?.catalogNumber ?? undefined,
      };

      return {
        hasScopedBaseline:
          browseRow != null || cachedScopedSelection != null || persistedScopedSelection != null,
        editItem: {
          ...sharedItem,
          retail,
          cost,
        },
        actionBarItem: {
          ...sharedItem,
          retail: actionBarRetail,
          cost: actionBarCost,
          stockOnHand: actionBarStockOnHand,
        },
      };
    });
  const editableSelectedItems = selectionStates.map((entry) => entry.editItem);
  const actionBarSelected = useMemo(
    () =>
      new Map(
        selectionStates.map(({ actionBarItem }) => [
          actionBarItem.sku,
          actionBarItemToSelectedProduct(actionBarItem),
        ] as const),
      ),
    [selectionStates],
  );
  const actionBarSelectedItems = Array.from(actionBarSelected.values());
  const knownScopedItemsByKey = useMemo(() => {
    const next = new Map<string, SelectedProduct>();

    for (const product of Array.from(selected.values())) {
      const cacheKey = getSelectedProductCacheKey(product.sku, product.pricingLocationId);
      if (cacheKey != null) {
        next.set(cacheKey, product);
      }
    }
    for (const [cacheKey, product] of Array.from(scopedSelectionCache.entries())) {
      next.set(cacheKey, product);
    }
    for (const [cacheKey, entry] of Array.from(savedScopedSelectionCache.entries())) {
      next.set(cacheKey, entry.product);
    }

    return next;
  }, [savedScopedSelectionCache, scopedSelectionCache, selected]);
  const saveScopedSelectionToSession = useCallback(() => {
    sessionStorage.setItem(CATALOG_ITEMS_STORAGE_KEY, JSON.stringify(actionBarSelectedItems));
  }, [actionBarSelectedItems]);
  const allowMissingEditPricing =
    editDialogMode === "v2" &&
    selectionStates.length > 0 &&
    selectionStates.every((entry) => entry.hasScopedBaseline);
  const editPricingItems = selectionStates.map(({ editItem }) => ({
    retailPrice: editItem.retail,
    cost: editItem.cost,
  }));

  const updateFilters = useCallback(
    (next: ProductFilters, extras: { view?: string } = {}) => {
      setFilters(next);
      const params = serializeFiltersToSearchParams(next, extras);
      const qs = params.toString();
      router.replace(qs ? `/products?${qs}` : "/products", { scroll: false });
    },
    [router],
  );

  useEffect(() => {
    if (!viewParam) {
      restoredViewRef.current = null;
      setActiveView(null);
      setRuntimeColumns(null);
      return;
    }
    const matched = resolvedViews.find((view) => view.slug === viewParam || view.id === viewParam);
    if (!matched || restoredViewRef.current === viewParam) return;
    restoredViewRef.current = viewParam;
    setActiveView(matched);
    const presetColumns = matched.columnPreferences?.visible.filter(
      (key): key is OptionalColumnKey => (OPTIONAL_COLUMNS as readonly string[]).includes(key),
    );
    if (presetColumns != null) {
      // Preset column layouts are authoritative — they replace the user's
      // default set rather than augment it, so presets can legitimately
      // REMOVE columns (e.g. the "days_since_sale-only" built-in view).
      // An explicitly empty array means "hide every optional column", which
      // must be preserved rather than falling back to baseColumns.
      setRuntimeColumns(presetColumns);
    } else {
      setRuntimeColumns(null);
    }
  }, [viewParam, resolvedViews]);

  function handleTabChange(tab: ProductTab) {
    updateFilters(buildFiltersForBrowseTab(filters, tab));
  }

  function handleSort(field: string) {
    const newDir = filters.sortBy === field && filters.sortDir === "asc" ? "desc" : "asc";
    updateFilters({ ...filters, sortBy: field, sortDir: newDir, page: 1 });
  }

  function handlePageChange(page: number) {
    updateFilters({ ...filters, page });
  }

  function handleClearFilters() {
    // Clear preset state alongside the filters so the banner + column overrides
    // don't linger while the filter set goes empty. Restoration ref is reset
    // by the restoration effect once router.replace flushes `view=` out of
    // the URL — resetting it synchronously here can race and snap the view
    // back on before the URL update lands.
    setActiveView(null);
    setRuntimeColumns(null);
    updateFilters({ ...EMPTY_FILTERS, tab: filters.tab });
  }

  function handleClearPreset() {
    // Do NOT clear restoredViewRef here — the URL still carries the
    // old view= slug for a render cycle while router.replace flushes.
    // Letting the restoration effect's "!viewParam" branch own the
    // ref reset avoids a race where the effect sees the stale slug
    // with a cleared guard and re-applies the preset.
    setActiveView(null);
    setRuntimeColumns(null);
    updateFilters({ ...EMPTY_FILTERS, tab: filters.tab });
  }

  const handlePresetClick = useCallback((view: SavedView) => {
    const { filters: next, visibleColumns } = applyPreset(view, filters);
    // Use the preset's column list verbatim. Merging with baseColumns would
    // prevent presets from hiding columns the user happens to have enabled.
    // An explicit empty array from the preset still counts as a layout
    // ("hide every optional column"); only nullish means "use user's default".
    const runtime = visibleColumns ?? null;
    const withPage = { ...next, page: 1 } as ProductFilters;
    restoredViewRef.current = view.slug ?? view.id;
    setActiveView(view);
    setRuntimeColumns(runtime);
    updateFilters(withPage, { view: view.slug ?? view.id });
  }, [filters, updateFilters]);

  function handleFilterChange(next: ProductFilters) {
    // Explicit filter edits drop the active view + runtime column override.
    setActiveView(null);
    setRuntimeColumns(null);
    updateFilters(next);
  }

  function handleLocationChange(locationIds: ProductLocationId[]) {
    handleFilterChange({ ...filters, locationIds, page: 1 });
  }

  const inlineEditRows = useMemo(
    () => buildInlineEditRows(data?.products ?? [], primaryLocationId),
    [data?.products, primaryLocationId],
  );
  const inlineEdit = useProductInlineEdit({
    rows: inlineEditRows,
    primaryLocationId,
    onSaveSuccess: async () => {
      await refetch();
    },
  });

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-6 md:px-5">
      {/* Header */}
      <div className="page-enter page-enter-1 mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="mb-0.5 text-[11px] font-semibold tracking-[-0.005em] text-muted-foreground">
            Los Angeles Pierce College Store · Inventory
          </div>
          <h1 className="flex items-baseline gap-2.5 text-[30px] font-bold leading-[1.1] tracking-[-0.03em] text-foreground">
            <span className="text-balance">Product catalog</span>
            {data ? (
              <span className="font-mono tnum text-[13px] font-medium tracking-[-0.01em] text-muted-foreground/80">
                {data.total.toLocaleString()}
              </span>
            ) : loading ? (
              <span className="inline-block h-3 w-14 animate-pulse rounded bg-muted" />
            ) : null}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PierceAssuranceBadge
            onClick={() => syncButtonRef.current?.openHistory()}
          />
          <SyncDatabaseButton ref={syncButtonRef} />
          <Button
            size="sm"
            onClick={() => setNewItemOpen(true)}
            disabled={!prismAvailable}
            title={prismAvailable ? undefined : "Prism is unreachable — write actions disabled"}
          >
            New Item
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!prismAvailable}
            title={prismAvailable ? undefined : "Prism is unreachable — write actions disabled"}
            render={
              prismAvailable
                ? <Link href={`/products/batch-add?loc=${serializeProductLocationIdsParam(filters.locationIds)}`} />
                : undefined
            }
          >
            Batch Add
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!prismAvailable}
            title={prismAvailable ? undefined : "Prism is unreachable — write actions disabled"}
            render={
              prismAvailable
                ? <Link href={`/products/bulk-edit?loc=${serializeProductLocationIdsParam(filters.locationIds)}`} />
                : undefined
            }
          >
            Bulk Edit
          </Button>
        </div>
      </div>

      {newItemOpen ? (
        <NewItemDialog
          open={newItemOpen}
          onOpenChange={setNewItemOpen}
          locationIds={filters.locationIds}
          primaryLocationId={primaryLocationId}
          onCreated={() => {
            // Refresh the list so the new item shows immediately (mirror is upserted server-side)
            refetch();
          }}
        />
      ) : null}

      <div className="page-enter page-enter-2 mb-2 rounded-[10px] border border-border bg-card px-3 py-2 shadow-[0_1px_0_color-mix(in_oklch,var(--border)_55%,transparent),0_2px_8px_-2px_color-mix(in_oklch,var(--foreground)_6%,transparent)]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold tracking-[-0.005em] text-muted-foreground">
              Location scope
            </div>
            <div className="text-[11px] text-muted-foreground/80">
              Primary location follows canonical order; current primary is {getLocationLabel(filters.locationIds[0])}.
            </div>
          </div>
          <LocationPicker value={filters.locationIds} onChange={handleLocationChange} />
        </div>
      </div>

      {editOpen ? (
        <EditItemDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          editDialogOverride={editDialogOverride}
          items={editableSelectedItems}
          knownScopedItemsByKey={knownScopedItemsByKey}
          locationIds={filters.locationIds}
          primaryLocationId={primaryLocationId}
          onSavedScopedItems={(savedItems, options) => {
            const saveToken = nextSavedScopedSelectionTokenRef.current + 1;
            nextSavedScopedSelectionTokenRef.current = saveToken;
            pendingSaveTokenRef.current = saveToken;
            setSavedScopedSelectionCache((current) => {
              let changed = false;
              const next = new Map(current);
              const retainUntilMatch = options?.retainUntilMatch === true;
              for (const item of savedItems) {
                const cacheLocationId = item.pricingLocationId ?? primaryLocationId;
                const cacheKey = getSelectedProductCacheKey(
                  item.sku,
                  cacheLocationId,
                );
                if (cacheKey == null) {
                  continue;
                }
                const browseRow = browseRowsBySku.get(item.sku);
                const liveBrowseSelection =
                  browseRow != null
                    ? browseRowToSelectedProduct(browseRow)
                    : null;
                const retainedLiveSignature =
                  liveBrowseSelection?.pricingLocationId === cacheLocationId
                    ? getSelectedProductSignature(liveBrowseSelection)
                    : null;
                const cachedItem = next.get(cacheKey);
                if (
                  !cachedItem ||
                  cachedItem.pendingRefetchToken !== saveToken ||
                  cachedItem.retainUntilMatch !== retainUntilMatch ||
                  cachedItem.retainedLiveSignature !== retainedLiveSignature ||
                  !selectedProductsEqual(cachedItem.product, item)
                ) {
                  next.set(cacheKey, {
                    product: item,
                    pendingRefetchToken: saveToken,
                    retainUntilMatch,
                    retainedLiveSignature,
                  });
                  changed = true;
                }
              }
              return changed ? next : current;
            });
          }}
          onSaved={(skus) => {
            setEditOpen(false);
            const savedSkus = new Set(skus);
            const saveToken = pendingSaveTokenRef.current;
            pendingSaveTokenRef.current = null;
            void Promise.resolve(refetch())
              .then((didRefresh) => {
                if (!didRefresh || saveToken == null) {
                  return;
                }
                setSavedScopedSelectionCache((current) => {
                  let changed = false;
                  const next = new Map(current);
                  for (const [cacheKey, entry] of Array.from(current.entries())) {
                    if (
                      !savedSkus.has(getSelectedProductCacheSku(cacheKey)) ||
                      entry.pendingRefetchToken !== saveToken
                    ) {
                      continue;
                    }
                    next.set(cacheKey, {
                      ...entry,
                      pendingRefetchToken: null,
                    });
                    changed = true;
                  }
                  return changed ? next : current;
                });
              })
              .catch(() => undefined);
          }}
        />
      ) : null}

      {hardDeleteOpen ? (
        <HardDeleteDialog
          open={hardDeleteOpen}
          onOpenChange={setHardDeleteOpen}
          items={Array.from(selected.values()).map((p) => ({
            sku: p.sku,
            description: p.description ?? "",
            isTextbook: isTextbookItemType(p.itemType),
          }))}
          onDeleted={() => {
            setHardDeleteOpen(false);
            refetch();
          }}
        />
      ) : null}

      {/* Comprehensive search bar */}
      <div className="page-enter page-enter-2 mb-2.5">
        <div className="flex items-center gap-2 rounded-[10px] border border-border bg-card px-3 py-2 focus-within:ring-2 focus-within:ring-ring focus-within:border-ring">
          <SearchIcon
            className="size-4 text-muted-foreground shrink-0"
            aria-hidden="true"
          />
          <input
            aria-label="Search products"
            type="search"
            value={filters.search}
            onChange={(e) =>
              handleFilterChange({ ...filters, search: e.target.value, page: 1 })
            }
            placeholder={
              filters.tab === "textbooks"
                ? "Search by SKU, ISBN, title, author, barcode, catalog #…"
                : "Search by SKU, description, barcode, catalog #…"
            }
            className="flex-1 min-w-0 border-none outline-none bg-transparent text-foreground text-[14px] placeholder:text-muted-foreground/70"
          />
          {filters.search ? (
            <button
              type="button"
              onClick={() =>
                handleFilterChange({ ...filters, search: "", page: 1 })
              }
              aria-label="Clear search"
              className="inline-flex items-center justify-center rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-accent"
            >
              <XIcon className="size-3.5" aria-hidden="true" />
            </button>
          ) : null}
          <span className="font-mono tnum text-[11px] text-muted-foreground shrink-0 pl-1 border-l border-border">
            {data
              ? `${data.total.toLocaleString()} results`
              : loading
                ? "…"
                : "0 results"}
          </span>
        </div>
      </div>

      {/* Presets banner */}
      <div className="page-enter page-enter-2 mb-2">
        <SavedViewsBar
          activeSlug={activeView?.slug ?? null}
          activeId={activeView?.id ?? null}
          onPresetClick={handlePresetClick}
          onClearPreset={handleClearPreset}
          onDeleteClick={(v) => setDeleteTarget(v)}
          onViewsResolved={setResolvedViews}
          refreshToken={savedViewsRefresh}
        />
      </div>

      <ProductFilterSummary
        filters={filters}
        activeViewName={activeView?.name ?? null}
        onChange={handleFilterChange}
        onClear={handleClearFilters}
        onClearPreset={activeView ? handleClearPreset : undefined}
      />

      {/* Table toolbar: tabs left · save view + column toggle right */}
      <div className="page-enter page-enter-3 mb-2 flex flex-wrap items-center justify-between gap-2">
        <div
          className="inline-flex rounded-lg border border-border bg-secondary p-0.5"
          role="tablist"
          aria-label="Product category"
        >
          {TABS.map((tab) => {
            const active = filters.tab === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => handleTabChange(tab.value)}
                className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-[13px] font-medium transition-all duration-150 ease-out active:translate-y-px cursor-pointer ${
                  active
                    ? "bg-card text-foreground shadow-[0_1px_2px_rgba(0,0,0,.06)]"
                    : "bg-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
                {tabCounts[tab.value] != null ? (
                  <span
                    className={`ml-0.5 rounded px-1.5 py-[1px] font-mono tnum text-[10.5px] ${
                      active
                        ? "bg-secondary text-muted-foreground"
                        : "bg-transparent text-muted-foreground/70"
                    }`}
                  >
                    {tabCounts[tab.value]!.toLocaleString()}
                  </span>
                ) : active && loading ? (
                  <span className="ml-1 inline-block h-3 w-8 animate-pulse rounded bg-muted" />
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1.5">
          {hiddenCount > 0 && (
            <span className="text-[11px] text-muted-foreground rounded-full bg-muted px-2 py-1">
              {hiddenCount} hidden
            </span>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setAdvancedOpen((o) => !o)}
            aria-expanded={advancedOpen}
            className="gap-1"
          >
            <SlidersHorizontalIcon className="size-3.5" />
            Advanced
            <ChevronDownIcon
              className={`size-3 transition-transform ${advancedOpen ? "rotate-180" : ""}`}
            />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setSaveDialogOpen(true)}
            className="gap-1"
          >
            + Save View
          </Button>
          <ColumnVisibilityToggle
            ref={columnsRef}
            runtimeOverride={runtimeColumns}
            onUserChange={setBaseColumns}
            onRuntimeChange={setRuntimeColumns}
            onResetRuntime={() => setRuntimeColumns(null)}
          />
        </div>
      </div>

      {advancedOpen ? (
        <div className="page-enter page-enter-3 mb-2 rounded-xl border border-border bg-card px-4 pb-4 pt-2 shadow-[0_1px_0_color-mix(in_oklch,var(--border)_55%,transparent),0_2px_8px_-2px_color-mix(in_oklch,var(--foreground)_6%,transparent)]">
          <ProductFiltersExtended
            filters={filters}
            onChange={(patch) => handleFilterChange({ ...filters, ...patch, page: 1 })}
          />
        </div>
      ) : null}

      {data?.total === 0 && activeView && (
        <div className="page-enter page-enter-3 mb-4 rounded-md border border-dashed p-6 text-center">
          <p className="text-sm font-medium">
            No items match &ldquo;{activeView.name}&rdquo;.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Try clearing the preset or widening a filter.
          </p>
          <Button
            size="sm"
            variant="outline"
            className="mt-3"
            onClick={() => {
              setActiveView(null);
              setRuntimeColumns(null);
              updateFilters({ ...EMPTY_FILTERS, tab: filters.tab });
            }}
          >
            Clear Preset
          </Button>
        </div>
      )}

      {/* Rail + Table */}
      <div className="page-enter page-enter-4 flex items-start gap-3">
        <div className="hidden md:block">
          <ProductFiltersBar
            filters={filters}
            onChange={handleFilterChange}
            onClear={handleClearFilters}
          />
        </div>
        <div className="min-w-0 flex-1">
          {/* Mobile filters collapse above the table */}
          <div className="mb-3 md:hidden">
            <ProductFiltersBar
              filters={filters}
              onChange={handleFilterChange}
              onClear={handleClearFilters}
            />
          </div>
          <ProductTable
            tab={filters.tab}
            products={data?.products ?? []}
            total={data?.total ?? 0}
            page={filters.page}
            loading={loading}
            offPageSelectedCount={offPageSelectedCount}
            sortBy={filters.sortBy}
            sortDir={filters.sortDir}
            isSelected={isSelected}
            onToggle={toggle}
            onToggleAll={toggleAll}
            onPageChange={handlePageChange}
            onSort={handleSort}
            visibleColumns={runtimeColumns ?? baseColumns}
            onHideColumn={(key) => columnsRef.current?.hideColumn(key)}
            onHiddenChange={setHiddenCount}
            suppressEmptyState={data?.total === 0 && activeView != null}
            inlineEdit={inlineEdit}
            primaryLocationId={primaryLocationId}
          />
        </div>
      </div>

      {/* Action bar */}
      <ProductActionBar
        selected={actionBarSelected}
        selectedCount={selectedCount}
        visibleSelectedCount={visibleSelectedCount}
        offPageSelectedCount={offPageSelectedCount}
        editPricingItems={editPricingItems}
        onClear={clear}
        onRemoveSelected={remove}
        saveToSession={saveScopedSelectionToSession}
        prismAvailable={prismAvailable}
        onDiscontinued={() => refetch()}
        onEditClick={() => setEditOpen(true)}
        allowMissingEditPricing={allowMissingEditPricing}
        onHardDeleteClick={() => setHardDeleteOpen(true)}
        onBulkEdit={() => router.push('/products/bulk-edit?preloadSkus=' + Array.from(selected.keys()).join(','))}
      />

      {/* Spacer so content isn't hidden behind the sticky action bar */}
      {selectedCount > 0 && <div className="h-16" />}

      {saveDialogOpen ? (
        <SaveViewDialog
          open={saveDialogOpen}
          onOpenChange={setSaveDialogOpen}
          filters={filters}
          columnPreferences={{ visible: runtimeColumns ?? baseColumns }}
          onSaved={(v) => {
            setActiveView(v);
            setSavedViewsRefresh((n) => n + 1);
          }}
        />
      ) : null}

      {deleteTarget ? (
        <DeleteViewDialog
          view={deleteTarget}
          onOpenChange={(o) => {
            if (!o) setDeleteTarget(null);
          }}
          onDeleted={(v) => {
            if (activeView?.id === v.id) {
              // The currently-applied view was just removed — drop every
              // trailing piece of its state (URL param, runtime columns)
              // so the deleted preset stops driving the page on the next
              // render. restoredViewRef is cleared by the restoration
              // effect once router.replace flushes `view=` out of the URL.
              setActiveView(null);
              setRuntimeColumns(null);
              updateFilters({ ...EMPTY_FILTERS, tab: filters.tab });
            }
            setDeleteTarget(null);
            setSavedViewsRefresh((n) => n + 1);
          }}
        />
      ) : null}
    </div>
  );
}
