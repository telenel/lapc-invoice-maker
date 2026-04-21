"use client";

import { useState, useEffect, useDeferredValue, useCallback } from "react";
import { toast } from "sonner";
import { SearchIcon, PackageIcon, PlusIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { searchProducts } from "@/domains/product/queries";
import { TABS, EMPTY_FILTERS } from "@/domains/product/constants";
import type {
  ProductBrowseRow,
  ProductTab,
  SelectedProduct,
} from "@/domains/product/types";

// ---------------------------------------------------------------------------
// Helper: convert raw product row to SelectedProduct shape
// ---------------------------------------------------------------------------

function productToSelected(product: ProductBrowseRow): SelectedProduct {
  return {
    sku: product.sku,
    description: (product.title ?? product.description ?? "").toUpperCase(),
    retailPrice: product.retail_price,
    cost: product.cost,
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

// ---------------------------------------------------------------------------
// Helper: derive display name and subtitle for a product row
// ---------------------------------------------------------------------------

function getDisplayName(product: ProductBrowseRow): string {
  const raw = product.item_type === "textbook"
    ? (product.title ?? product.description ?? "")
    : (product.description ?? product.title ?? "");
  return raw.toUpperCase();
}

function getSubtitle(product: ProductBrowseRow): string {
  if (product.item_type === "textbook") {
    const parts: string[] = [];
    if (product.author) parts.push(product.author);
    if (product.edition) parts.push(product.edition);
    if (product.isbn) parts.push(`ISBN ${product.isbn}`);
    return parts.join(" · ");
  }
  const parts: string[] = [];
  if (product.catalog_number) parts.push(`Cat# ${product.catalog_number}`);
  if (product.product_type) parts.push(product.product_type);
  return parts.join(" · ");
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ProductSearchPanelProps {
  onAddProducts: (products: SelectedProduct[]) => void;
}

function canAddBrowseRowToLineItems(product: ProductBrowseRow): boolean {
  return product.retail_price != null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProductSearchPanel({ onAddProducts }: ProductSearchPanelProps) {
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [tab, setTab] = useState<ProductTab>("textbooks");
  const [selected, setSelected] = useState<Map<number, SelectedProduct>>(
    () => new Map()
  );
  const [products, setProducts] = useState<ProductBrowseRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  // Fetch — replaces products on page 1, appends on subsequent pages
  useEffect(() => {
    let cancelled = false;

    const filters = {
      ...EMPTY_FILTERS,
      search: deferredSearch,
      tab,
      page,
    };

    setLoading(true);

    searchProducts(filters)
      .then((result) => {
        if (cancelled) return;
        setTotal(result.total);
        setProducts((prev) =>
          page === 1 ? result.products : [...prev, ...result.products]
        );
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : "Failed to search products";
        toast.error(message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [deferredSearch, tab, page]);

  // Reset to page 1 whenever search or tab changes
  const handleSearchChange = useCallback(
    (value: string) => {
      setSearch(value);
      setPage(1);
      setProducts([]);
    },
    []
  );

  const handleTabChange = useCallback((value: ProductTab) => {
    setTab(value);
    setPage(1);
    setProducts([]);
  }, []);

  // Selection helpers
  const toggleProduct = useCallback((product: ProductBrowseRow) => {
    if (!canAddBrowseRowToLineItems(product)) return;

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

  const handleAdd = useCallback(() => {
    const items = Array.from(selected.values());
    if (items.length === 0) return;
    onAddProducts(items);
    setSelected(new Map());
  }, [selected, onAddProducts]);

  const hasMore = products.length < total;
  const selectedCount = selected.size;

  return (
    <div className="flex flex-col rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <PackageIcon className="size-4 text-muted-foreground" />
          <span className="font-semibold text-sm">Product Catalog</span>
        </div>
        {selectedCount > 0 && (
          <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
            {selectedCount} selected
          </span>
        )}
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b">
        <div className="relative">
          <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
          <Input
            tabIndex={-1}
            placeholder="Search products..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b">
        {TABS.map((t) => (
          <button
            key={t.value}
            tabIndex={-1}
            onClick={() => handleTabChange(t.value)}
            className={[
              "flex-1 px-3 py-2 text-xs font-medium transition-colors",
              tab === t.value
                ? "border-b-2 border-primary text-primary bg-primary/5"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
            ].join(" ")}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Product list */}
      <div className="max-h-[500px] overflow-y-auto scroll-pb-16">
        {loading && products.length === 0 ? (
          <div className="space-y-1 p-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={`sk-${i}`}
                className="h-12 animate-pulse rounded bg-muted"
              />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground text-sm gap-2">
            <SearchIcon className="size-7" />
            <span>No products found</span>
          </div>
        ) : (
          <ul className="divide-y pb-16">
            {products.map((product) => {
              const isChecked = selected.has(product.sku);
              const selectable = canAddBrowseRowToLineItems(product);
              return (
                <li
                  key={product.sku}
                  className={[
                    "flex items-center gap-3 px-3 py-2.5 transition-colors",
                    selectable ? "cursor-pointer hover:bg-muted/40" : "cursor-not-allowed opacity-70",
                    isChecked ? "bg-primary/5" : "",
                  ].join(" ")}
                  onClick={() => toggleProduct(product)}
                  data-disabled={!selectable ? "" : undefined}
                >
                  <Checkbox
                    tabIndex={-1}
                    checked={isChecked}
                    disabled={!selectable}
                    onCheckedChange={() => toggleProduct(product)}
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`Select SKU ${product.sku}`}
                    className="shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate leading-tight">
                      {getDisplayName(product)}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate leading-tight mt-0.5">
                      SKU {product.sku}
                      {getSubtitle(product) ? ` · ${getSubtitle(product)}` : ""}
                      {!selectable ? " · Price unavailable" : ""}
                    </p>
                  </div>
                  <span className="text-xs font-medium text-right shrink-0">
                    {selectable ? `$${Number(product.retail_price).toFixed(2)}` : "Price unavailable"}
                  </span>
                </li>
              );
            })}

            {/* Load more row */}
            {hasMore && (
              <li className="px-3 py-2">
                <Button
                  tabIndex={-1}
                  variant="ghost"
                  size="sm"
                  className="w-full text-xs"
                  disabled={loading}
                  onClick={(e) => {
                    e.stopPropagation();
                    setPage((p) => p + 1);
                  }}
                >
                  {loading ? "Loading…" : `Load more (${total - products.length} remaining)`}
                </Button>
              </li>
            )}
          </ul>
        )}
      </div>

      {/* Sticky footer — Add button */}
      <div className="sticky bottom-0 z-10 border-t px-3 py-2.5 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/90">
        <Button
          tabIndex={-1}
          className="w-full h-8 text-sm gap-1.5"
          disabled={selectedCount === 0}
          onClick={handleAdd}
        >
          <PlusIcon className="size-3.5" />
          {selectedCount > 0
            ? `Add ${selectedCount} Selected`
            : "Add to Line Items"}
        </Button>
      </div>
    </div>
  );
}
