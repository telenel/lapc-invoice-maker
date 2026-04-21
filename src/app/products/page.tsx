"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
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
import { ProductFiltersBar } from "@/components/products/product-filters";
import { ProductTable } from "@/components/products/product-table";
import { ProductActionBar } from "@/components/products/product-action-bar";
import { NewItemDialog } from "@/components/products/new-item-dialog";
import { EditItemDialog } from "@/components/products/edit-item-dialog";
import { resolveEditDialogMode } from "@/components/products/edit-item-dialog-mode";
import { HardDeleteDialog } from "@/components/products/hard-delete-dialog";
import { Button } from "@/components/ui/button";
import { SyncDatabaseButton } from "@/components/products/sync-database-button";
import type { SyncDatabaseHandle } from "@/components/products/sync-database-button";
import { ProductFiltersExtended } from "@/components/products/product-filters-extended";
import { SavedViewsBar } from "@/components/products/saved-views-bar";
import { SaveViewDialog } from "@/components/products/save-view-dialog";
import { DeleteViewDialog } from "@/components/products/delete-view-dialog";
import { ColumnVisibilityToggle, type ColumnVisibilityHandle } from "@/components/products/column-visibility-toggle";
import { PierceAssuranceBadge } from "@/components/products/pierce-assurance-badge";
import { LocationPicker } from "@/components/products/location-picker";
import { useProductInlineEdit, type ProductInlineEditRowBaseline } from "@/components/products/use-product-inline-edit";
import { productApi } from "@/domains/product/api-client";
import { SYSTEM_PRESET_VIEWS } from "@/domains/product/presets";
import { shouldApplyDefaultMinStock } from "@/domains/product/page-defaults";
import {
  getPrimaryProductLocationId,
  serializeProductLocationIdsParam,
  type ProductLocationId,
} from "@/domains/product/location-filters";
import type { ProductBrowseRow, SelectedProduct } from "@/domains/product/types";

function getLocationLabel(locationId: ProductLocationId): "PIER" | "PCOP" | "PFS" {
  if (locationId === 3) return "PCOP";
  if (locationId === 4) return "PFS";
  return "PIER";
}

function isTextbookItemType(itemType: string): boolean {
  return itemType === "textbook" || itemType === "used_textbook";
}

function productToScopedSelected(product: ProductBrowseRow): SelectedProduct {
  return {
    sku: product.sku,
    description: (product.title ?? product.description ?? "").toUpperCase(),
    retailPrice: product.retail_price,
    cost: product.cost,
    pricingLocationId: product.primary_location_id ?? 2,
    barcode: product.barcode,
    author: product.author,
    title: product.title,
    isbn: product.isbn,
    edition: product.edition,
    catalogNumber: product.catalog_number,
    vendorId: product.vendor_id,
    itemType: product.item_type,
    fDiscontinue: product.discontinued ? 1 : 0,
  };
}

function selectedProductsEqual(left: SelectedProduct, right: SelectedProduct): boolean {
  return (
    left.sku === right.sku &&
    left.description === right.description &&
    left.retailPrice === right.retailPrice &&
    left.cost === right.cost &&
    left.pricingLocationId === right.pricingLocationId &&
    left.barcode === right.barcode &&
    left.author === right.author &&
    left.title === right.title &&
    left.isbn === right.isbn &&
    left.edition === right.edition &&
    left.catalogNumber === right.catalogNumber &&
    left.vendorId === right.vendorId &&
    left.itemType === right.itemType &&
    left.fDiscontinue === right.fDiscontinue
  );
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
    const allowItemLevelFallback = primaryInventory == null;

    return {
      sku: product.sku,
      barcode: product.barcode,
      itemTaxTypeId: product.itemTaxTypeId,
      retail: primaryInventory?.retailPrice ?? (allowItemLevelFallback ? product.retail_price ?? null : null),
      cost: primaryInventory?.cost ?? (allowItemLevelFallback ? product.cost ?? null : null),
      fDiscontinue: product.discontinued ? 1 : 0,
    };
  });
}

export default function ProductsPage() {
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
  useEffect(() => {
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
  }, []);

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

  // Track tab counts so both tabs always show their last-known count
  const [tabCounts, setTabCounts] = useState<Record<ProductTab, number | null>>({
    textbooks: null,
    merchandise: null,
  });
  useEffect(() => {
    if (data) {
      setTabCounts((prev) => ({ ...prev, [filters.tab]: data.total }));
    }
  }, [data, filters.tab]);

  // Inactive-tab count — fired whenever the active data resolves so the user
  // always sees both totals under the current filter set.
  useEffect(() => {
    if (!data) return;
    const otherTab: ProductTab = filters.tab === "textbooks" ? "merchandise" : "textbooks";
    let cancelled = false;
    searchProducts({ ...filters, tab: otherTab, page: 1 }, { countOnly: true })
      .then((r) => {
        if (!cancelled) {
          setTabCounts((prev) => ({ ...prev, [otherTab]: r.total }));
        }
      })
      .catch(() => {
        // Silent — stale count stays visible rather than showing a spinner.
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);
  const {
    selected,
    selectedCount,
    toggle,
    toggleAll,
    clear,
    isSelected,
  } = useProductSelection();
  const primaryLocationId = getPrimaryProductLocationId(filters.locationIds);
  const [scopedSelectionCache, setScopedSelectionCache] = useState<Map<string, SelectedProduct>>(
    () => new Map(),
  );
  const scopedSelected = useMemo(() => {
    const scopedRowsBySku = new Map((data?.products ?? []).map((product) => [product.sku, product]));
    return new Map(
      Array.from(selected.entries()).map(([sku, product]) => {
        const cachedScopedSelection = scopedSelectionCache.get(`${sku}:${primaryLocationId}`);
        if (cachedScopedSelection) {
          return [sku, cachedScopedSelection];
        }
        const scopedRow = scopedRowsBySku.get(sku);
        return [sku, scopedRow ? productToScopedSelected(scopedRow) : product];
      }),
    );
  }, [data?.products, primaryLocationId, scopedSelectionCache, selected]);
  const selectedItems = Array.from(scopedSelected.values());
  useEffect(() => {
    const visibleSelectedRows = (data?.products ?? []).filter((product) => selected.has(product.sku));
    if (visibleSelectedRows.length === 0) return;

    setScopedSelectionCache((current) => {
      let changed = false;
      const next = new Map(current);
      for (const product of visibleSelectedRows) {
        const scopedSelection = productToScopedSelected(product);
        const cacheKey = `${product.sku}:${scopedSelection.pricingLocationId ?? primaryLocationId}`;
        const cachedSelection = next.get(cacheKey);
        if (!cachedSelection || !selectedProductsEqual(cachedSelection, scopedSelection)) {
          next.set(cacheKey, scopedSelection);
          changed = true;
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
  const saveScopedSelectionToSession = useCallback(() => {
    sessionStorage.setItem(CATALOG_ITEMS_STORAGE_KEY, JSON.stringify(selectedItems));
  }, [selectedItems]);
  // Keep the action bar/session handoff and the edit dialog on the same
  // current-scope source of truth. The server's concurrency SELECT does
  // `LEFT JOIN Inventory ON LocationID = @loc` and reads `inv.Retail` /
  // `inv.Cost`, which is NULL when no Inventory row exists at that location.
  // If we reused an off-page selection's stale persisted price for edit
  // baselines, the client could send 39.99 while the server reads NULL and
  // trigger a false 409. So edits only reuse persisted pricing when the stored
  // selection was captured from the same location scope, and successful saves
  // write that scoped snapshot back into the cache so invoice/quote/barcode
  // handoff sees the same values immediately.
  const browseRowsBySku = new Map((data?.products ?? []).map((p) => [p.sku, p] as const));
  const editableSelectionStates = selectedItems
    .map((product) => {
      const browseRow = browseRowsBySku.get(product.sku);
      const primarySlice = browseRow?.selected_inventories?.find(
        (inv) => inv.locationId === primaryLocationId,
      );
      const cachedScopedSelection = scopedSelectionCache.get(`${product.sku}:${primaryLocationId}`);
      const persistedScopedSelection =
        cachedScopedSelection ??
        (
          !browseRow &&
          product.pricingLocationId != null &&
          product.pricingLocationId === primaryLocationId
            ? product
            : null
        );
      const scopedDescriptor = browseRow ? productToScopedSelected(browseRow) : persistedScopedSelection;
      const retail = browseRow
        ? (primarySlice?.retailPrice ?? null)
        : (persistedScopedSelection?.retailPrice ?? null);
      const cost = browseRow
        ? (primarySlice?.cost ?? null)
        : (persistedScopedSelection?.cost ?? null);

      return {
        hasScopedBaseline: browseRow ? primarySlice != null : persistedScopedSelection != null,
        item: {
          sku: product.sku,
          barcode: scopedDescriptor?.barcode ?? null,
          retail,
          cost,
          fDiscontinue: browseRow
            ? (browseRow.discontinued ? 1 : 0)
            : (persistedScopedSelection?.fDiscontinue ?? 0),
          description: scopedDescriptor?.description ?? product.description ?? "",
          vendorId: scopedDescriptor?.vendorId ?? undefined,
          dccId: undefined,
          isTextbook: isTextbookItemType(scopedDescriptor?.itemType ?? product.itemType),
          primaryLocationId,
          catalogNumber: scopedDescriptor?.catalogNumber ?? undefined,
        },
      };
    });
  const editableSelectedItems = editableSelectionStates.map((entry) => entry.item);
  const allowMissingEditPricing =
    editDialogMode === "v2" &&
    editableSelectionStates.length === 1 &&
    editableSelectionStates[0]?.hasScopedBaseline === true;
  const editPricingItems = editableSelectionStates.map(({ item }) => ({
    retailPrice: item.retail,
    cost: item.cost,
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
    updateFilters({ ...filters, tab, page: 1 });
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
    onSaveSuccess: refetch,
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

      <EditItemDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        editDialogOverride={editDialogOverride}
        items={editableSelectedItems}
        locationIds={filters.locationIds}
        primaryLocationId={primaryLocationId}
        onSavedScopedItems={(savedItems) => {
          setScopedSelectionCache((current) => {
            let changed = false;
            const next = new Map(current);
            for (const item of savedItems) {
              const cacheKey = `${item.sku}:${item.pricingLocationId ?? primaryLocationId}`;
              const cachedItem = next.get(cacheKey);
              if (!cachedItem || !selectedProductsEqual(cachedItem, item)) {
                next.set(cacheKey, item);
                changed = true;
              }
            }
            return changed ? next : current;
          });
        }}
        onSaved={() => {
          setEditOpen(false);
          refetch();
        }}
      />

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
          onClearPreset={() => {
            // Do NOT clear restoredViewRef here — the URL still carries the
            // old view= slug for a render cycle while router.replace flushes.
            // Letting the restoration effect's "!viewParam" branch own the
            // ref reset avoids a race where the effect sees the stale slug
            // with a cleared guard and re-applies the preset.
            setActiveView(null);
            setRuntimeColumns(null);
            updateFilters({ ...EMPTY_FILTERS, tab: filters.tab });
          }}
          onDeleteClick={(v) => setDeleteTarget(v)}
          onViewsResolved={setResolvedViews}
          refreshToken={savedViewsRefresh}
        />
      </div>

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
        selected={scopedSelected}
        selectedCount={selectedCount}
        editPricingItems={editPricingItems}
        onClear={clear}
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
    </div>
  );
}
