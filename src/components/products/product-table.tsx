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
import { ArrowDownIcon, ArrowUpIcon, ArrowUpDownIcon, SearchIcon, XIcon } from "lucide-react";
import type { Product, ProductTab } from "@/domains/product/types";
import { PAGE_SIZE } from "@/domains/product/constants";
import type { OptionalColumnKey } from "@/domains/product/constants";
import "./product-table.css";

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
  visibleColumns?: OptionalColumnKey[];
  onHideColumn?: (key: OptionalColumnKey) => void;
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
        type="button"
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

function OptionalSortHeader(props: {
  field: string;
  label: string;
  columnKey: OptionalColumnKey;
  priority: "high" | "medium" | "low";
  sortBy: string;
  sortDir: "asc" | "desc";
  onSort: (field: string) => void;
  onHide?: (key: OptionalColumnKey) => void;
  className?: string;
}) {
  const { field, label, columnKey, priority, sortBy, sortDir, onSort, onHide, className } = props;
  const isActive = sortBy === field;
  return (
    <TableHead className={className} data-priority={priority}>
      <div className="group inline-flex items-center gap-1">
        <button
          type="button"
          className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
          onClick={() => onSort(field)}
        >
          {label}
          {isActive ? (
            sortDir === "asc" ? <ArrowUpIcon className="size-3" /> : <ArrowDownIcon className="size-3" />
          ) : (
            <ArrowUpDownIcon className="size-3 opacity-30" />
          )}
        </button>
        {onHide && (
          <button
            type="button"
            aria-label={`Hide ${label}`}
            className="ml-1 opacity-0 group-hover:opacity-60 hover:opacity-100 focus-visible:opacity-100 transition-opacity"
            onClick={(e) => { e.stopPropagation(); onHide(columnKey); }}
          >
            <XIcon className="size-3" />
          </button>
        )}
      </div>
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
  visibleColumns = [],
  onHideColumn,
}: ProductTableProps) {
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const extraCols = visibleColumns?.length ?? 0;
  const from = (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);
  const allOnPageSelected = products.length > 0 && products.every((p) => isSelected(p.sku));

  // "days_since_sale" is a UI alias: queries.ts maps it to last_sale_date
  // with inverted sort direction, so the arrow must also invert to match
  // the data the user sees.
  const daysSinceSaleDisplayDir: "asc" | "desc" =
    sortBy === "days_since_sale"
      ? sortDir === "asc" ? "desc" : "asc"
      : sortDir;

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
      <div className="hidden md:block product-table-wrap">
        <Table className="product-table">
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
                  <SortHeader field="barcode" label="Barcode" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
                </>
              ) : (
                <>
                  <SortHeader field="description" label="Description" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
                  <SortHeader field="barcode" label="Barcode" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
                  <SortHeader field="catalog_number" label="Catalog #" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
                  <SortHeader field="product_type" label="Type" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
                  <SortHeader field="vendor_id" label="Vendor" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
                </>
              )}
              <SortHeader field="retail_price" label="Retail" sortBy={sortBy} sortDir={sortDir} onSort={onSort} className="text-right" />
              <SortHeader field="cost" label="Cost" sortBy={sortBy} sortDir={sortDir} onSort={onSort} className="text-right" />
              <SortHeader field="last_sale_date" label="Last Sale" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
              <SortHeader
                field="stock_on_hand"
                label="Stock"
                sortBy={sortBy}
                sortDir={sortDir}
                onSort={onSort}
                className="text-right"
              />
              {visibleColumns?.includes("dcc") && (
                <OptionalSortHeader field="dept_num" columnKey="dcc" priority="medium" label="DCC" sortBy={sortBy} sortDir={sortDir} onSort={onSort} onHide={onHideColumn} />
              )}
              {visibleColumns?.includes("units_1y") && (
                <OptionalSortHeader field="units_sold_1y" columnKey="units_1y" priority="high" label="Units 1y" sortBy={sortBy} sortDir={sortDir} onSort={onSort} onHide={onHideColumn} className="text-right" />
              )}
              {visibleColumns?.includes("revenue_1y") && (
                <OptionalSortHeader field="revenue_1y" columnKey="revenue_1y" priority="high" label="Revenue 1y" sortBy={sortBy} sortDir={sortDir} onSort={onSort} onHide={onHideColumn} className="text-right" />
              )}
              {visibleColumns?.includes("txns_1y") && (
                <OptionalSortHeader field="txns_1y" columnKey="txns_1y" priority="medium" label="Receipts 1y" sortBy={sortBy} sortDir={sortDir} onSort={onSort} onHide={onHideColumn} className="text-right" />
              )}
              {visibleColumns?.includes("margin") && (
                <OptionalSortHeader field="margin" columnKey="margin" priority="medium" label={sortBy === "margin" ? "Margin % (page)" : "Margin %"} sortBy={sortBy} sortDir={sortDir} onSort={onSort} onHide={onHideColumn} className="text-right" />
              )}
              {visibleColumns?.includes("days_since_sale") && (
                <OptionalSortHeader field="days_since_sale" columnKey="days_since_sale" priority="low" label="Days since sale" sortBy={sortBy} sortDir={daysSinceSaleDisplayDir} onSort={onSort} onHide={onHideColumn} className="text-right" />
              )}
              {visibleColumns?.includes("updated") && (
                <OptionalSortHeader field="updated_at" columnKey="updated" priority="low" label="Updated" sortBy={sortBy} sortDir={sortDir} onSort={onSort} onHide={onHideColumn} />
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading
              ? Array.from({ length: 10 }).map((_, i) => (
                  <TableRow key={`skeleton-${i}`}>
                    {Array.from({ length: 11 + extraCols }).map((_, j) => (
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
                    <TableCell className="text-right tabular-nums">
                      {product.stock_on_hand ?? "—"}
                    </TableCell>
                    {visibleColumns?.includes("dcc") && (
                      <TableCell className="min-w-0 max-w-[16ch]" data-priority="medium">
                        {product.dept_num != null ? (
                          <>
                            <div className="font-mono text-xs tabular-nums" translate="no">
                              {product.dept_num}.{product.class_num ?? ""}.{product.cat_num ?? ""}
                            </div>
                            <div
                              className="truncate text-xs text-muted-foreground"
                              title={[product.dept_name, product.class_name, product.cat_name].filter(Boolean).join(" › ")}
                            >
                              {[product.dept_name, product.class_name, product.cat_name].filter(Boolean).join(" › ") || "—"}
                            </div>
                          </>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    )}
                    {visibleColumns?.includes("units_1y") && (
                      <TableCell className="text-right tabular-nums" data-priority="high">
                        {product.units_sold_1y > 0 ? product.units_sold_1y.toLocaleString() : "—"}
                      </TableCell>
                    )}
                    {visibleColumns?.includes("revenue_1y") && (
                      <TableCell className="text-right tabular-nums" data-priority="high">
                        {product.revenue_1y > 0
                          ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(product.revenue_1y)
                          : "—"}
                      </TableCell>
                    )}
                    {visibleColumns?.includes("txns_1y") && (
                      <TableCell className="text-right tabular-nums" data-priority="medium">
                        {product.txns_1y > 0 ? product.txns_1y.toLocaleString() : "—"}
                      </TableCell>
                    )}
                    {visibleColumns?.includes("margin") && (
                      <TableCell
                        className={`text-right tabular-nums ${
                          product.retail_price > 0 && (product.retail_price - product.cost) / product.retail_price < 0.1
                            ? "text-destructive"
                            : ""
                        }`}
                        data-priority="medium"
                      >
                        {product.retail_price > 0
                          ? new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 0 }).format(
                              (product.retail_price - product.cost) / product.retail_price,
                            )
                          : "—"}
                      </TableCell>
                    )}
                    {visibleColumns?.includes("days_since_sale") && (
                      <TableCell className="text-right tabular-nums" data-priority="low">
                        {product.last_sale_date
                          ? Math.floor((Date.now() - new Date(product.last_sale_date).getTime()) / 86_400_000)
                          : "Never"}
                      </TableCell>
                    )}
                    {visibleColumns?.includes("updated") && (
                      <TableCell className="tabular-nums" data-priority="low" title={new Date(product.updated_at).toLocaleString()}>
                        {(() => {
                          const diffMs = Date.now() - new Date(product.updated_at).getTime();
                          const days = Math.round(diffMs / 86_400_000);
                          const fmt = new Intl.RelativeTimeFormat("en-US", { numeric: "auto" });
                          if (Math.abs(days) < 1) return fmt.format(-Math.round(diffMs / 3_600_000), "hour");
                          return fmt.format(-days, "day");
                        })()}
                      </TableCell>
                    )}
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
