"use client";

import { useState } from "react";
import { ChevronDownIcon, FilterIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import type { ProductFilters, ProductTab } from "@/domains/product/types";

interface ProductFiltersBarProps {
  filters: ProductFilters;
  onChange: (filters: ProductFilters) => void;
  onClear: () => void;
}

export function ProductFiltersBar({
  filters,
  onChange,
  onClear,
}: ProductFiltersBarProps) {
  const [open, setOpen] = useState(false);

  function set(key: keyof ProductFilters, value: string | boolean) {
    onChange({ ...filters, [key]: value, page: 1 });
  }

  const activeCount = [
    filters.minPrice,
    filters.maxPrice,
    filters.vendorId,
    filters.hasBarcode,
    filters.lastSaleDateFrom,
    filters.lastSaleDateTo,
    filters.tab === "textbooks" && filters.author,
    filters.tab === "textbooks" && filters.hasIsbn,
    filters.tab === "textbooks" && filters.edition,
    filters.tab === "merchandise" && filters.catalogNumber,
    filters.tab === "merchandise" && filters.productType,
  ].filter(Boolean).length;

  return (
    <div className="space-y-3">
      {/* Search row — always visible */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="grid gap-1.5 flex-1">
          <Label htmlFor="product-search" className="sr-only">Search</Label>
          <Input
            id="product-search"
            name="search"
            placeholder={
              filters.tab === "textbooks"
                ? "Search textbooks by title, author, ISBN, SKU..."
                : "Search merchandise by description, barcode, catalog #, SKU..."
            }
            value={filters.search}
            onChange={(e) => set("search", e.target.value)}
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setOpen((o) => !o)}
          className="w-full shrink-0 gap-1.5 sm:w-auto"
        >
          <FilterIcon className="size-3.5" />
          Filters
          {activeCount > 0 && (
            <Badge
              variant="secondary"
              className="ml-0.5 px-1.5 py-0 text-[10px] font-bold rounded-full"
            >
              {activeCount}
            </Badge>
          )}
          <ChevronDownIcon
            className={`size-3.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          />
        </Button>
      </div>

      {/* Collapsible filter panel */}
      {open && (
        <div className="space-y-3 rounded-xl border border-border/50 bg-card p-4 shadow-sm animate-in fade-in-0 slide-in-from-top-1 duration-200">
          {/* Shared filters */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="grid gap-1.5">
              <Label htmlFor="pf-min-price">Min Price</Label>
              <Input
                id="pf-min-price"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={filters.minPrice}
                onChange={(e) => set("minPrice", e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="pf-max-price">Max Price</Label>
              <Input
                id="pf-max-price"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={filters.maxPrice}
                onChange={(e) => set("maxPrice", e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="pf-vendor">Vendor ID</Label>
              <Input
                id="pf-vendor"
                type="number"
                placeholder="e.g. 21"
                value={filters.vendorId}
                onChange={(e) => set("vendorId", e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>&nbsp;</Label>
              <Button
                variant={filters.hasBarcode ? "default" : "outline"}
                size="sm"
                className="h-9 w-full"
                onClick={() => set("hasBarcode", !filters.hasBarcode)}
              >
                Has Barcode
              </Button>
            </div>
          </div>

          {/* Date range */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="grid gap-1.5">
              <Label htmlFor="pf-sale-from">Last Sale From</Label>
              <Input
                id="pf-sale-from"
                type="date"
                value={filters.lastSaleDateFrom}
                onChange={(e) => set("lastSaleDateFrom", e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="pf-sale-to">Last Sale To</Label>
              <Input
                id="pf-sale-to"
                type="date"
                value={filters.lastSaleDateTo}
                onChange={(e) => set("lastSaleDateTo", e.target.value)}
              />
            </div>

            {/* Textbook-only filters */}
            {filters.tab === "textbooks" && (
              <>
                <div className="grid gap-1.5">
                  <Label htmlFor="pf-author">Author</Label>
                  <Input
                    id="pf-author"
                    placeholder="e.g. HUXLEY"
                    value={filters.author}
                    onChange={(e) => set("author", e.target.value)}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="pf-edition">Edition</Label>
                  <Input
                    id="pf-edition"
                    placeholder="e.g. 7"
                    value={filters.edition}
                    onChange={(e) => set("edition", e.target.value)}
                  />
                </div>
              </>
            )}

            {/* Merchandise-only filters */}
            {filters.tab === "merchandise" && (
              <>
                <div className="grid gap-1.5">
                  <Label htmlFor="pf-catalog">Catalog #</Label>
                  <Input
                    id="pf-catalog"
                    placeholder="e.g. 37655"
                    value={filters.catalogNumber}
                    onChange={(e) => set("catalogNumber", e.target.value)}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="pf-type">Product Type</Label>
                  <Input
                    id="pf-type"
                    placeholder="e.g. CAPPED"
                    value={filters.productType}
                    onChange={(e) => set("productType", e.target.value)}
                  />
                </div>
              </>
            )}

            {/* Has ISBN toggle — textbook only */}
            {filters.tab === "textbooks" && (
              <div className="grid gap-1.5">
                <Label>&nbsp;</Label>
                <Button
                  variant={filters.hasIsbn ? "default" : "outline"}
                  size="sm"
                  className="h-9 w-full"
                  onClick={() => set("hasIsbn", !filters.hasIsbn)}
                >
                  Has ISBN
                </Button>
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={onClear}>
              Clear Filters
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
