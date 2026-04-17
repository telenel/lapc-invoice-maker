"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { useProductSearch, useProductSelection } from "@/domains/product/hooks";
import { EMPTY_FILTERS, TABS } from "@/domains/product/constants";
import type { ProductFilters, ProductTab } from "@/domains/product/types";
import { ProductFiltersBar } from "@/components/products/product-filters";
import { ProductTable } from "@/components/products/product-table";
import { ProductActionBar } from "@/components/products/product-action-bar";
import { NewItemDialog } from "@/components/products/new-item-dialog";
import { EditItemDialog } from "@/components/products/edit-item-dialog";
import { HardDeleteDialog } from "@/components/products/hard-delete-dialog";
import { Button } from "@/components/ui/button";
import { productApi } from "@/domains/product/api-client";

function parseFiltersFromParams(
  searchParams: ReturnType<typeof useSearchParams>
): ProductFilters {
  const rawTab = searchParams.get("tab");
  const tab: ProductTab = rawTab === "textbooks" || rawTab === "merchandise" ? rawTab : "textbooks";
  const rawPage = Number(searchParams.get("page") ?? "1");
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;

  return {
    ...EMPTY_FILTERS,
    tab,
    search: searchParams.get("q") ?? "",
    minPrice: searchParams.get("minPrice") ?? "",
    maxPrice: searchParams.get("maxPrice") ?? "",
    vendorId: searchParams.get("vendorId") ?? "",
    hasBarcode: searchParams.get("hasBarcode") === "true",
    lastSaleDateFrom: searchParams.get("lastSaleDateFrom") ?? "",
    lastSaleDateTo: searchParams.get("lastSaleDateTo") ?? "",
    author: searchParams.get("author") ?? "",
    hasIsbn: searchParams.get("hasIsbn") === "true",
    edition: searchParams.get("edition") ?? "",
    catalogNumber: searchParams.get("catalogNumber") ?? "",
    productType: searchParams.get("productType") ?? "",
    sortBy: searchParams.get("sortBy") ?? "sku",
    sortDir: searchParams.get("sortDir") === "desc" ? "desc" : "asc",
    page,
  };
}

function filtersToParams(filters: ProductFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.tab !== "textbooks") params.set("tab", filters.tab);
  if (filters.search) params.set("q", filters.search);
  if (filters.minPrice) params.set("minPrice", filters.minPrice);
  if (filters.maxPrice) params.set("maxPrice", filters.maxPrice);
  if (filters.vendorId) params.set("vendorId", filters.vendorId);
  if (filters.hasBarcode) params.set("hasBarcode", "true");
  if (filters.lastSaleDateFrom) params.set("lastSaleDateFrom", filters.lastSaleDateFrom);
  if (filters.lastSaleDateTo) params.set("lastSaleDateTo", filters.lastSaleDateTo);
  if (filters.author) params.set("author", filters.author);
  if (filters.hasIsbn) params.set("hasIsbn", "true");
  if (filters.edition) params.set("edition", filters.edition);
  if (filters.catalogNumber) params.set("catalogNumber", filters.catalogNumber);
  if (filters.productType) params.set("productType", filters.productType);
  if (filters.sortBy !== "sku") params.set("sortBy", filters.sortBy);
  if (filters.sortDir !== "asc") params.set("sortDir", filters.sortDir);
  if (filters.page > 1) params.set("page", String(filters.page));
  return params;
}

export default function ProductsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<ProductFilters>(() =>
    parseFiltersFromParams(searchParams)
  );

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
    (next: ProductFilters) => {
      setFilters(next);
      const params = filtersToParams(next);
      const qs = params.toString();
      router.replace(qs ? `/products?${qs}` : "/products", { scroll: false });
    },
    [router]
  );

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

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      {/* Header */}
      <div className="page-enter page-enter-1 mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Product Catalog</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Los Angeles Pierce College Store INVENTORY
            {data ? ` · ${data.total.toLocaleString()} results` : ""}
          </p>
        </div>
        {prismAvailable ? (
          <Button onClick={() => setNewItemOpen(true)}>
            New Item
          </Button>
        ) : null}
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
          onChange={updateFilters}
          onClear={handleClearFilters}
        />
      </div>

      {/* Tabs */}
      <div className="page-enter page-enter-3 mb-4 flex gap-0 border-b">
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

      {/* Table */}
      <div className="page-enter page-enter-4">
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
      />

      {/* Spacer so content isn't hidden behind the sticky action bar */}
      {selectedCount > 0 && <div className="h-16" />}
    </div>
  );
}
