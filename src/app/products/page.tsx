"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { useProductSearch, useProductSelection } from "@/domains/product/hooks";
import { useProductRollups, useProductSummary } from "@/domains/product/summary-hooks";
import { EMPTY_FILTERS, TABS, DEFAULT_COLUMN_SET, OPTIONAL_COLUMNS } from "@/domains/product/constants";
import type { OptionalColumnKey } from "@/domains/product/constants";
import type { ProductFilters, ProductTab, SavedView } from "@/domains/product/types";
import type { ProductRollupGroup } from "@/domains/product/summary-types";
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
import { HardDeleteDialog } from "@/components/products/hard-delete-dialog";
import { Button } from "@/components/ui/button";
import { SyncDatabaseButton } from "@/components/products/sync-database-button";
import type { SyncDatabaseHandle } from "@/components/products/sync-database-button";
import { SavedViewsBar } from "@/components/products/saved-views-bar";
import { SaveViewDialog } from "@/components/products/save-view-dialog";
import { DeleteViewDialog } from "@/components/products/delete-view-dialog";
import { ColumnVisibilityToggle, type ColumnVisibilityHandle } from "@/components/products/column-visibility-toggle";
import { PierceAssuranceBadge } from "@/components/products/pierce-assurance-badge";
import { ProductsRollupsPanel } from "@/components/products/products-rollups-panel";
import { ProductsSummaryStrip } from "@/components/products/products-summary-strip";
import { productApi } from "@/domains/product/api-client";
import { SYSTEM_PRESET_VIEWS } from "@/domains/product/presets";

export default function ProductsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const viewParam = searchParams.get("view");
  const [filters, setFilters] = useState<ProductFilters>(() => {
    // Convert Next.js useSearchParams() to URLSearchParams
    const params = new URLSearchParams();
    searchParams.forEach((value, key) => params.set(key, value));
    return parseFiltersFromSearchParams(params);
  });

  const { data, loading, refetch } = useProductSearch(filters);

  // Prism availability — controls whether write features (New Item, Delete) are shown.
  // True only on the campus dev machine where the SQL Server is reachable.
  const [prismAvailable, setPrismAvailable] = useState(false);
  useEffect(() => {
    let cancelled = false;
    productApi.health().then((h) => {
      if (!cancelled) setPrismAvailable(h.available);
    }).catch(() => {
      if (!cancelled) setPrismAvailable(false);
    });
    return () => { cancelled = true; };
  }, []);

  const [newItemOpen, setNewItemOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [hardDeleteOpen, setHardDeleteOpen] = useState(false);

  const [activeView, setActiveView] = useState<SavedView | null>(null);
  const [runtimeColumns, setRuntimeColumns] = useState<OptionalColumnKey[] | null>(null);
  const [baseColumns, setBaseColumns] = useState<OptionalColumnKey[]>(DEFAULT_COLUMN_SET);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SavedView | null>(null);
  const [rollupGroup, setRollupGroup] = useState<ProductRollupGroup>("dcc");
  const columnsRef = useRef<ColumnVisibilityHandle>(null);
  const syncButtonRef = useRef<SyncDatabaseHandle>(null);
  const restoredViewRef = useRef<string | null>(null);
  const [hiddenCount, setHiddenCount] = useState(0);
  const [resolvedViews, setResolvedViews] = useState<SavedView[]>(SYSTEM_PRESET_VIEWS);
  const { summary, loading: summaryLoading } = useProductSummary(filters, filters.analysisWindow);
  const { rollups, loading: rollupsLoading } = useProductRollups(filters, rollupGroup);

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
  const {
    selected,
    selectedCount,
    toggle,
    toggleAll,
    clear,
    isSelected,
    saveToSession,
  } = useProductSelection();

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
    if (presetColumns && presetColumns.length > 0) {
      setRuntimeColumns(Array.from(new Set([...baseColumns, ...presetColumns])));
    } else {
      setRuntimeColumns(null);
    }
  }, [viewParam, resolvedViews, baseColumns]);

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
    updateFilters({ ...EMPTY_FILTERS, tab: filters.tab });
  }

  function handleAnalysisWindowChange(analysisWindow: ProductFilters["analysisWindow"]) {
    updateFilters(
      { ...filters, analysisWindow },
      activeView ? { view: activeView.slug ?? activeView.id } : {},
    );
  }

  const handlePresetClick = useCallback((view: SavedView) => {
    const { filters: next, visibleColumns } = applyPreset(view, filters);
    const merged = visibleColumns
      ? Array.from(new Set([...baseColumns, ...visibleColumns]))
      : null;
    const withPage = { ...next, page: 1 } as ProductFilters;
    restoredViewRef.current = view.slug ?? view.id;
    setActiveView(view);
    setRuntimeColumns(merged);
    updateFilters(withPage, { view: view.slug ?? view.id });
  }, [filters, baseColumns, updateFilters]);

  function handleFilterChange(next: ProductFilters) {
    // Explicit filter edits drop the active view + runtime column override.
    setActiveView(null);
    setRuntimeColumns(null);
    updateFilters(next);
  }

  return (
    <div className="px-4 py-6">
      {/* Header */}
      <div className="page-enter page-enter-1 mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Product Catalog</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Los Angeles Pierce College Store INVENTORY
            {data ? ` · ${data.total.toLocaleString()} results` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PierceAssuranceBadge
            onClick={() => syncButtonRef.current?.openHistory()}
          />
          <SyncDatabaseButton ref={syncButtonRef} />
          {prismAvailable ? (
            <>
              <Button onClick={() => setNewItemOpen(true)}>
                New Item
              </Button>
              <Button variant="outline" render={<Link href="/products/batch-add" />}>
                Batch Add
              </Button>
              <Button variant="outline" render={<Link href="/products/bulk-edit" />}>
                Bulk Edit Workspace
              </Button>
            </>
          ) : null}
        </div>
      </div>

      <NewItemDialog
        open={newItemOpen}
        onOpenChange={setNewItemOpen}
        onCreated={() => {
          // Refresh the list so the new item shows immediately (mirror is upserted server-side)
          refetch();
        }}
      />

      <EditItemDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        items={Array.from(selected.values()).map((p) => ({
          sku: p.sku,
          barcode: p.barcode ?? null,
          retail: p.retailPrice ?? 0,
          cost: p.cost ?? 0,
          fDiscontinue: 0 as 0 | 1,
          description: p.description ?? "",
          vendorId: p.vendorId ?? undefined,
          dccId: undefined,
          isTextbook: p.itemType === "textbook",
        }))}
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
          isTextbook: p.itemType === "textbook",
        }))}
        onDeleted={() => {
          setHardDeleteOpen(false);
          refetch();
        }}
      />

      {/* Search + Filters */}
      <div className="page-enter page-enter-2 mb-4">
        <ProductFiltersBar
          filters={filters}
          onChange={handleFilterChange}
          onClear={handleClearFilters}
        />
      </div>

      <div className="page-enter page-enter-2 mb-4 flex items-center justify-between gap-3">
        <SavedViewsBar
          activeSlug={activeView?.slug ?? null}
          activeId={activeView?.id ?? null}
          onPresetClick={handlePresetClick}
          onSaveClick={() => setSaveDialogOpen(true)}
          onDeleteClick={(v) => setDeleteTarget(v)}
          onViewsResolved={setResolvedViews}
        />
        <div className="flex items-center gap-2">
          {hiddenCount > 0 && (
            <span className="text-xs text-muted-foreground rounded-full bg-muted px-2 py-1">
              {hiddenCount} hidden — narrow window
            </span>
          )}
          <ColumnVisibilityToggle
            ref={columnsRef}
            runtimeOverride={runtimeColumns}
            onUserChange={setBaseColumns}
            onRuntimeChange={setRuntimeColumns}
            onResetRuntime={() => setRuntimeColumns(null)}
          />
        </div>
      </div>

      <div className="page-enter page-enter-3 mb-4">
        {!summaryLoading && summary ? (
          <ProductsSummaryStrip
            summary={summary}
            analysisWindow={filters.analysisWindow}
            onAnalysisWindowChange={handleAnalysisWindowChange}
          />
        ) : null}
      </div>

      <div className="page-enter page-enter-4 mb-4">
        {!rollupsLoading && rollups ? (
          <ProductsRollupsPanel
            group={rollupGroup}
            rows={rollups.rows}
            onGroupChange={setRollupGroup}
          />
        ) : null}
      </div>

      {/* Tabs */}
      <div className="page-enter page-enter-5 mb-4 flex gap-0 border-b">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => handleTabChange(tab.value)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              filters.tab === tab.value
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
            {tabCounts[tab.value] != null ? (
              <Badge
                variant="secondary"
                className="ml-2 px-1.5 py-0 text-[10px] font-bold rounded-full"
              >
                {tabCounts[tab.value]!.toLocaleString()}
              </Badge>
            ) : tab.value === filters.tab && loading ? (
              <span className="ml-2 inline-block h-3 w-8 animate-pulse rounded bg-muted align-middle" />
            ) : null}
          </button>
        ))}
      </div>

      {data?.total === 0 && activeView && (
        <div className="page-enter page-enter-5 mb-4 rounded-md border border-dashed p-6 text-center">
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

      {/* Table */}
      <div className="page-enter page-enter-6">
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
          activeFilters={filters}
        />
      </div>

      {/* Action bar */}
      <ProductActionBar
        selected={selected}
        selectedCount={selectedCount}
        onClear={clear}
        saveToSession={saveToSession}
        prismAvailable={prismAvailable}
        onDiscontinued={() => refetch()}
        onEditClick={() => setEditOpen(true)}
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
        onSaved={(v) => setActiveView(v)}
      />

      <DeleteViewDialog
        view={deleteTarget}
        onOpenChange={(o) => {
          if (!o) setDeleteTarget(null);
        }}
        onDeleted={(v) => {
          if (activeView?.id === v.id) setActiveView(null);
          setDeleteTarget(null);
        }}
      />
    </div>
  );
}
