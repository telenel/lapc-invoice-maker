"use client";

import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ArrowDownIcon, ArrowUpIcon, ArrowUpDownIcon, SearchIcon } from "lucide-react";
import type { Product, ProductTab } from "@/domains/product/types";
import { PAGE_SIZE } from "@/domains/product/constants";

interface ProductTableProps {
  tab: ProductTab;
  products: Product[];
  total: number;
  page: number;
  loading: boolean;
  sortBy: string;
  sortDir: "asc" | "desc";
  isSelected: (sku: number) => boolean;
  onToggle: (product: Product) => void;
  onToggleAll: (products: Product[]) => void;
  onPageChange: (page: number) => void;
  onSort: (field: string) => void;
}

function formatCurrency(value: number): string {
  return `$${Number(value).toFixed(2)}`;
}

function formatSaleDate(date: string | null): string {
  if (!date) return "—";
  const d = new Date(date);
  // Prism stores "never sold" as epoch zero; in Pacific TZ that underflows to Dec 1969.
  if (d.getUTCFullYear() < 2000) return "—";
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function SortHeader({ field, label, sortBy, sortDir, onSort, className }: {
  field: string;
  label: string;
  sortBy: string;
  sortDir: "asc" | "desc";
  onSort: (field: string) => void;
  className?: string;
}) {
  const isActive = sortBy === field;
  return (
    <TableHead className={className}>
      <button
        className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
        onClick={() => onSort(field)}
      >
        {label}
        {isActive ? (
          sortDir === "asc" ? (
            <ArrowUpIcon className="size-3" />
          ) : (
            <ArrowDownIcon className="size-3" />
          )
        ) : (
          <ArrowUpDownIcon className="size-3 opacity-30" />
        )}
      </button>
    </TableHead>
  );
}

export function ProductTable({
  tab,
  products,
  total,
  page,
  loading,
  sortBy,
  sortDir,
  isSelected,
  onToggle,
  onToggleAll,
  onPageChange,
  onSort,
}: ProductTableProps) {
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);
  const allOnPageSelected = products.length > 0 && products.every((p) => isSelected(p.sku));

  if (!loading && products.length === 0) {
    return (
      <EmptyState
        icon={<SearchIcon className="size-10 text-muted-foreground" />}
        title="No products found"
        description="Try adjusting your search or filters"
      />
    );
  }

  return (
    <div>
      {/* Desktop table */}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={allOnPageSelected}
                  onCheckedChange={() => onToggleAll(products)}
                  aria-label="Select all on page"
                />
              </TableHead>
              <SortHeader field="sku" label="SKU" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
              {tab === "textbooks" ? (
                <>
                  <SortHeader field="title" label="Title" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
                  <SortHeader field="author" label="Author" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
                  <SortHeader field="isbn" label="ISBN" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
                  <SortHeader field="edition" label="Edition" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
                  <TableHead>Barcode</TableHead>
                </>
              ) : (
                <>
                  <SortHeader field="description" label="Description" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
                  <TableHead>Barcode</TableHead>
                  <SortHeader field="catalog_number" label="Catalog #" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
                  <SortHeader field="product_type" label="Type" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
                  <SortHeader field="vendor_id" label="Vendor" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
                </>
              )}
              <SortHeader field="retail_price" label="Retail" sortBy={sortBy} sortDir={sortDir} onSort={onSort} className="text-right" />
              <SortHeader field="cost" label="Cost" sortBy={sortBy} sortDir={sortDir} onSort={onSort} className="text-right" />
              <SortHeader field="last_sale_date" label="Last Sale" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading
              ? Array.from({ length: 10 }).map((_, i) => (
                  <TableRow key={`skeleton-${i}`}>
                    {Array.from({ length: tab === "textbooks" ? 10 : 10 }).map((_, j) => (
                      <TableCell key={j}>
                        <div className="h-4 w-full animate-pulse rounded bg-muted" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              : products.map((product) => (
                  <TableRow
                    key={product.sku}
                    className={isSelected(product.sku) ? "bg-primary/5" : ""}
                  >
                    <TableCell>
                      <Checkbox
                        checked={isSelected(product.sku)}
                        onCheckedChange={() => onToggle(product)}
                        aria-label={`Select SKU ${product.sku}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium text-primary">
                      {product.sku}
                    </TableCell>
                    {tab === "textbooks" ? (
                      <>
                        <TableCell className="font-medium max-w-[300px] truncate">
                          {product.title ?? product.description ?? "—"}
                        </TableCell>
                        <TableCell>{product.author ?? "—"}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {product.isbn ?? "—"}
                        </TableCell>
                        <TableCell>{product.edition ?? "—"}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {product.barcode ?? "—"}
                        </TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell className="font-medium max-w-[300px] truncate">
                          {product.description ?? "—"}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {product.barcode ?? "—"}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {product.catalog_number ?? "—"}
                        </TableCell>
                        <TableCell className="text-xs">
                          {product.product_type ?? "—"}
                        </TableCell>
                        <TableCell className="text-xs">
                          Vendor #{product.vendor_id}
                        </TableCell>
                      </>
                    )}
                    <TableCell className="text-right font-medium">
                      {formatCurrency(product.retail_price)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatCurrency(product.cost)}
                    </TableCell>
                    <TableCell className="text-xs">
                      {formatSaleDate(product.last_sale_date)}
                    </TableCell>
                  </TableRow>
                ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile cards */}
      <div className="space-y-2 md:hidden">
        {loading
          ? Array.from({ length: 5 }).map((_, i) => (
              <div key={`mobile-skeleton-${i}`} className="rounded-lg border p-3">
                <div className="h-4 w-3/4 animate-pulse rounded bg-muted mb-2" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
              </div>
            ))
          : products.map((product) => (
              <div
                key={product.sku}
                className={`rounded-lg border p-3 ${isSelected(product.sku) ? "border-primary bg-primary/5" : ""}`}
                onClick={() => onToggle(product)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {product.title ?? product.description ?? "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      SKU: {product.sku}
                      {product.author && ` · ${product.author}`}
                    </p>
                  </div>
                  <div onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={isSelected(product.sku)}
                      onCheckedChange={() => onToggle(product)}
                      className="ml-2 mt-0.5"
                      aria-label={`Select SKU ${product.sku}`}
                    />
                  </div>
                </div>
                <div className="mt-1.5 flex gap-3 text-xs">
                  <span className="font-medium">{formatCurrency(product.retail_price)}</span>
                  <span className="text-muted-foreground">{formatCurrency(product.cost)}</span>
                  {product.barcode && (
                    <span className="font-mono text-muted-foreground">{product.barcode}</span>
                  )}
                </div>
              </div>
            ))}
      </div>

      {/* Pagination */}
      {total > 0 && (
        <div className="flex items-center justify-between border-t pt-4 mt-4">
          <p className="text-sm text-muted-foreground">
            Showing {from}–{to} of {total.toLocaleString()}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
