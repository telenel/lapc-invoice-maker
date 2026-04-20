"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ArrowDownIcon, ArrowUpIcon, ArrowUpDownIcon, SearchIcon } from "lucide-react";
import { useEffect, useMemo } from "react";
import type { Product, ProductTab } from "@/domains/product/types";
import { PAGE_SIZE, type OptionalColumnKey } from "@/domains/product/constants";
import { MarginBar } from "./margin-bar";
import { useVendorDirectory } from "@/domains/product/vendor-directory";
import { useHiddenColumns } from "./use-hidden-columns";
import { COLUMN_PRIORITY } from "@/domains/product/constants";
import { formatLookupLabel } from "@/domains/product/ref-data";
import "./product-table.css";

/**
 * Prefer the computed effective sale date when present, then the periodic
 * computed date, finally the raw last-sale date. Used for display and for
 * days-since-sale math.
 */
export function getProductDisplaySaleDate(
  product: Pick<Product, "effective_last_sale_date" | "last_sale_date_computed" | "last_sale_date">,
): string | null | undefined {
  return (
    product.effective_last_sale_date ??
    product.last_sale_date_computed ??
    product.last_sale_date
  );
}

/**
 * True when the aggregates pipeline has produced a real snapshot for this row.
 * If `aggregates_ready` is explicitly true we trust it; otherwise we fall back
 * to the presence of a `sales_aggregates_computed_at` timestamp.
 */
export function hasProductAnalyticsReady(
  product: Pick<Product, "aggregates_ready" | "sales_aggregates_computed_at">,
): boolean {
  if (product.aggregates_ready === true) return true;
  if (product.aggregates_ready === false) return false;
  return !!product.sales_aggregates_computed_at;
}

/**
 * Format a numeric analytics value, returning "Pending" while the aggregates
 * pipeline has not yet produced a real snapshot for this row. Prevents real
 * zeros from being confused with an unready state.
 */
export function getProductAnalyticsDisplay(
  product: Pick<Product, "aggregates_ready" | "sales_aggregates_computed_at">,
  value: number | null | undefined,
): string {
  if (!hasProductAnalyticsReady(product)) return "Pending";
  if (value == null || Number.isNaN(value)) return "—";
  return value.toLocaleString("en-US");
}

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
  /** Optional column keys that should render in addition to the base set. */
  visibleColumns?: OptionalColumnKey[];
  /** Reserved for future column-level hide actions; currently unused. */
  onHideColumn?: (key: OptionalColumnKey) => void;
  /** Reports how many optional columns were hidden by this render (always 0 here). */
  onHiddenChange?: (count: number) => void;
  /**
   * When true, the table returns null for an empty result set so the page
   * can own the empty-state message (e.g. preset-specific "no matches"
   * treatment) without stacking two empty states on top of each other.
   */
  suppressEmptyState?: boolean;
}

function formatCurrency(value: number): string {
  return `$${Number(value).toFixed(2)}`;
}

function formatSaleDate(date: string | null): string {
  if (!date) return "—";
  const d = new Date(date);
  // Prism exports a 1899-12-30 / 1970-01-01 sentinel for never-sold rows. Treat
  // anything before 1990 as "never sold" so the column doesn't invent history.
  if (Number.isNaN(d.getTime()) || d.getFullYear() < 1990) return "—";
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

/**
 * Relative time for the Updated column — preserves the recency signal an
 * operator list needs at every scale (minutes → years), not just under 30d.
 */
function formatRelativeUpdated(date: string | null | undefined): string {
  if (!date) return "—";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "—";
  const diffMs = Date.now() - d.getTime();
  if (diffMs < 60_000) return "just now";
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(days / 365);
  return `${years}y ago`;
}

export function formatVendorDisplay(vendorLabel: string | null | undefined): string {
  return formatLookupLabel(vendorLabel ?? null, "Vendor unavailable");
}

function SortHeader({
  field,
  label,
  sortBy,
  sortDir,
  onSort,
  align = "left",
  mono = false,
  width,
  priority,
}: {
  field: string;
  label: string;
  sortBy: string;
  sortDir: "asc" | "desc";
  onSort: (field: string) => void;
  align?: "left" | "right";
  mono?: boolean;
  width?: number;
  priority?: "high" | "medium" | "low";
}) {
  const isActive = sortBy === field;
  const ariaSort: "ascending" | "descending" | "none" = isActive
    ? sortDir === "asc"
      ? "ascending"
      : "descending"
    : "none";
  return (
    <th
      style={{ width }}
      data-priority={priority}
      aria-sort={ariaSort}
      scope="col"
      className={`bg-card border-b border-border sticky top-0 z-[1] ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      <button
        type="button"
        onClick={() => onSort(field)}
        aria-label={`Sort by ${label}${
          isActive
            ? sortDir === "asc"
              ? " (currently ascending)"
              : " (currently descending)"
            : ""
        }`}
        className={`flex w-full items-center gap-1 px-2.5 py-2 text-[11px] font-semibold tracking-[-0.005em] select-none whitespace-nowrap bg-transparent border-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
          isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
        } ${mono ? "font-mono" : ""} ${align === "right" ? "justify-end" : "justify-start"}`}
      >
        {label}
        {isActive ? (
          sortDir === "asc" ? (
            <ArrowUpIcon className="size-2.5" aria-hidden="true" />
          ) : (
            <ArrowDownIcon className="size-2.5" aria-hidden="true" />
          )
        ) : (
          <ArrowUpDownIcon className="size-2.5 opacity-30" aria-hidden="true" />
        )}
      </button>
    </th>
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
  visibleColumns,
  onHideColumn,
  onHiddenChange,
  suppressEmptyState = false,
}: ProductTableProps) {
  void onHideColumn;
  const { byId: vendorsById } = useVendorDirectory();
  // Observe the wrapper width so the hidden-count badge reflects what the
  // @container queries actually suppress.
  const { ref: wrapperRef, summary: hiddenSummary } = useHiddenColumns();
  const activeOptionalColumns = useMemo(() => visibleColumns ?? [], [visibleColumns]);
  useEffect(() => {
    if (!onHiddenChange) return;
    const hiddenTierSet = new Set(hiddenSummary.tiers);
    const hiddenCount = activeOptionalColumns.filter((key) => {
      const priority = COLUMN_PRIORITY[key];
      return (
        (priority === "medium" || priority === "low") &&
        hiddenTierSet.has(priority)
      );
    }).length;
    onHiddenChange(hiddenCount);
  }, [onHiddenChange, hiddenSummary.tiers, activeOptionalColumns]);
  const showUnits = visibleColumns?.includes("units_1y") ?? false;
  const showRevenue = visibleColumns?.includes("revenue_1y") ?? false;
  const showTxns = visibleColumns?.includes("txns_1y") ?? false;
  const showDaysSinceSale = visibleColumns?.includes("days_since_sale") ?? false;
  const showUpdated = visibleColumns?.includes("updated") ?? false;
  const showDcc = visibleColumns?.includes("dcc") ?? false;
  // `margin` is listed as an optional column in OPTIONAL_COLUMNS; respect the
  // toggle so saved views / the Add Column popover can hide it.
  const showMargin = visibleColumns?.includes("margin") ?? true;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);
  const allOnPageSelected = products.length > 0 && products.every((p) => isSelected(p.sku));
  const someOnPageSelected =
    products.length > 0 && products.some((p) => isSelected(p.sku)) && !allOnPageSelected;

  if (!loading && products.length === 0) {
    if (suppressEmptyState) return null;
    return (
      <EmptyState
        icon={<SearchIcon className="size-10 text-muted-foreground" />}
        title="No products found"
        description="Try adjusting your search or filters"
      />
    );
  }

  // Keep the loading row in lockstep with the header set: checkbox + SKU +
  // Description + Vendor + Cost + Retail + Stock + [Margin?] + ISBN/Barcode +
  // LastSale + [optional columns].
  const baseCols = 9 + (showMargin ? 1 : 0);
  const optionalCols =
    (showUnits ? 1 : 0) +
    (showRevenue ? 1 : 0) +
    (showTxns ? 1 : 0) +
    (showDaysSinceSale ? 1 : 0) +
    (showUpdated ? 1 : 0) +
    (showDcc ? 1 : 0);
  const skeletonCols = baseCols + optionalCols;

  return (
    <div className="rounded-[10px] border border-border bg-card overflow-hidden shadow-[0_1px_0_color-mix(in_oklch,var(--border)_55%,transparent),0_2px_8px_-2px_color-mix(in_oklch,var(--foreground)_6%,transparent)]">
      {/* Desktop table — wrapper owns the container-query context that drives
          optional-column hiding via `data-priority` at narrow widths. */}
      <div ref={wrapperRef} className="product-table-wrap hidden md:block">
        <div className="max-h-[62vh] overflow-auto">
          <table className="product-table w-full border-collapse text-[12.5px]">
            <thead>
              <tr>
                <th className="w-8 px-0 pl-3 py-2 bg-card border-b border-border sticky top-0 z-[1]">
                  <Checkbox
                    checked={allOnPageSelected}
                    indeterminate={someOnPageSelected}
                    onCheckedChange={() => onToggleAll(products)}
                    aria-label="Select all on page"
                  />
                </th>
                <SortHeader
                  field="sku"
                  label="SKU"
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onSort={onSort}
                  mono
                  width={96}
                />
                <SortHeader
                  field={tab === "textbooks" ? "title" : "description"}
                  label="Description"
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onSort={onSort}
                />
                <SortHeader
                  field="vendor_id"
                  label="Vendor"
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onSort={onSort}
                  width={110}
                />
                <SortHeader
                  field="cost"
                  label="Cost"
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onSort={onSort}
                  align="right"
                  mono
                  width={76}
                />
                <SortHeader
                  field="retail_price"
                  label="Retail"
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onSort={onSort}
                  align="right"
                  mono
                  width={86}
                />
                <SortHeader
                  field="stock_on_hand"
                  label="Stock"
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onSort={onSort}
                  align="right"
                  mono
                  width={72}
                />
                {showMargin ? (
                  <SortHeader
                    field="margin"
                    label="Margin"
                    sortBy={sortBy}
                    sortDir={sortDir}
                    onSort={onSort}
                    align="right"
                    width={112}
                    priority="medium"
                  />
                ) : null}
                {tab === "textbooks" ? (
                  <SortHeader
                    field="isbn"
                    label="ISBN"
                    sortBy={sortBy}
                    sortDir={sortDir}
                    onSort={onSort}
                    mono
                    width={128}
                  />
                ) : (
                  <SortHeader
                    field="barcode"
                    label="Barcode"
                    sortBy={sortBy}
                    sortDir={sortDir}
                    onSort={onSort}
                    mono
                    width={128}
                  />
                )}
                <SortHeader
                  field="last_sale_date"
                  label="Last Sale"
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onSort={onSort}
                  width={96}
                />
                {showUnits ? (
                  <SortHeader
                    field="units_sold_1y"
                    label="Units 1y"
                    sortBy={sortBy}
                    sortDir={sortDir}
                    onSort={onSort}
                    align="right"
                    mono
                    width={80}
                    priority="high"
                  />
                ) : null}
                {showRevenue ? (
                  <SortHeader
                    field="revenue_1y"
                    label="Revenue 1y"
                    sortBy={sortBy}
                    sortDir={sortDir}
                    onSort={onSort}
                    align="right"
                    mono
                    width={96}
                    priority="high"
                  />
                ) : null}
                {showTxns ? (
                  <SortHeader
                    field="txns_1y"
                    label="Receipts 1y"
                    sortBy={sortBy}
                    sortDir={sortDir}
                    onSort={onSort}
                    align="right"
                    mono
                    width={96}
                    priority="medium"
                  />
                ) : null}
                {showDaysSinceSale ? (
                  <SortHeader
                    field="days_since_sale"
                    label="Days since sale"
                    sortBy={sortBy}
                    sortDir={sortDir}
                    onSort={onSort}
                    align="right"
                    mono
                    width={110}
                    priority="low"
                  />
                ) : null}
                {showUpdated ? (
                  <SortHeader
                    field="updated_at"
                    label="Updated"
                    sortBy={sortBy}
                    sortDir={sortDir}
                    onSort={onSort}
                    width={96}
                    priority="low"
                  />
                ) : null}
                {showDcc ? (
                  <SortHeader
                    field="dept_num"
                    label="DCC"
                    sortBy={sortBy}
                    sortDir={sortDir}
                    onSort={onSort}
                    width={110}
                    priority="medium"
                  />
                ) : null}
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 10 }).map((_, i) => (
                    <tr key={`skeleton-${i}`} className="h-[34px]">
                      {Array.from({ length: skeletonCols }).map((_, j) => (
                        <td key={j} className="px-2.5 py-1.5">
                          <div className="h-3 w-full animate-pulse rounded bg-muted" />
                        </td>
                      ))}
                    </tr>
                  ))
                : products.map((product, idx) => {
                    const sel = isSelected(product.sku);
                    const zebra = idx % 2 === 1;
                    const primaryText =
                      tab === "textbooks"
                        ? product.title ?? product.description ?? "—"
                        : product.description ?? "—";
                    const metaParts: string[] = [];
                    if (product.author) metaParts.push(product.author);
                    if (product.edition) metaParts.push(product.edition);
                    if (product.catalog_number) metaParts.push(product.catalog_number);
                    if (product.product_type && tab === "merchandise")
                      metaParts.push(product.product_type);
                    return (
                      <tr
                        key={product.sku}
                        onClick={() => onToggle(product)}
                        className={`h-[34px] cursor-pointer transition-colors border-b border-border/50 ${
                          sel
                            ? "bg-primary/[0.06]"
                            : zebra
                              ? "bg-secondary/40 hover:bg-accent/70"
                              : "hover:bg-accent/70"
                        }`}
                      >
                        <td
                          className="relative w-8 pl-3"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {sel ? (
                            <span
                              className="absolute left-0 top-0 bottom-0 w-[2px] bg-primary"
                              aria-hidden="true"
                            />
                          ) : null}
                          <Checkbox
                            checked={sel}
                            onCheckedChange={() => onToggle(product)}
                            aria-label={`Select SKU ${product.sku}`}
                          />
                        </td>
                        <td className="px-2.5 py-1.5">
                          <span className="font-mono tnum text-[11.5px] text-foreground">
                            {product.sku}
                          </span>
                        </td>
                        <td className="px-2.5 py-1.5 max-w-[360px]">
                          <div className="flex flex-col gap-px">
                            <span className="overflow-hidden text-ellipsis whitespace-nowrap text-foreground font-medium">
                              {primaryText}
                            </span>
                            {metaParts.length > 0 ? (
                              <span className="text-[10.5px] text-muted-foreground overflow-hidden text-ellipsis whitespace-nowrap">
                                {metaParts.join(" · ")}
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-2.5 py-1.5 whitespace-nowrap">
                          {(() => {
                            const name = formatVendorDisplay(vendorsById.get(product.vendor_id));
                            return (
                              <span
                                className="text-[11.5px] text-foreground"
                                title={name}
                              >
                                {name}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="px-2.5 py-1.5 text-right">
                          <span className="font-mono tnum text-[11.5px] text-muted-foreground">
                            {formatCurrency(product.cost)}
                          </span>
                        </td>
                        <td className="px-2.5 py-1.5 text-right">
                          <span className="font-mono tnum text-[11.5px] text-foreground font-medium">
                            {formatCurrency(product.retail_price)}
                          </span>
                        </td>
                        <td className="px-2.5 py-1.5 text-right">
                          {(() => {
                            const stock = product.stock_on_hand;
                            if (stock == null) {
                              return (
                                <span className="font-mono tnum text-[11.5px] text-muted-foreground/70">
                                  —
                                </span>
                              );
                            }
                            const isOut = stock <= 0;
                            const isLow = stock > 0 && stock < 15;
                            return (
                              <span
                                className={`font-mono tnum text-[11.5px] ${
                                  isOut
                                    ? "text-muted-foreground"
                                    : isLow
                                      ? "text-[color:var(--chart-4)] font-medium"
                                      : "text-foreground"
                                }`}
                              >
                                {stock.toLocaleString()}
                              </span>
                            );
                          })()}
                        </td>
                        {showMargin ? (
                          <td data-priority="medium" className="px-2.5 py-1.5 text-right">
                            <MarginBar
                              cost={Number(product.cost)}
                              retail={Number(product.retail_price)}
                            />
                          </td>
                        ) : null}
                        <td className="px-2.5 py-1.5">
                          <span className="font-mono tnum text-[11px] text-muted-foreground">
                            {tab === "textbooks"
                              ? (product.isbn ?? "—")
                              : (product.barcode ?? "—")}
                          </span>
                        </td>
                        <td className="px-2.5 py-1.5 text-[11.5px] text-muted-foreground whitespace-nowrap">
                          {formatSaleDate(getProductDisplaySaleDate(product) ?? null)}
                        </td>
                        {showUnits ? (
                          <td data-priority="high" className="px-2.5 py-1.5 text-right">
                            {(() => {
                              const ready = hasProductAnalyticsReady(product);
                              return (
                                <span
                                  className={`font-mono tnum text-[11.5px] ${
                                    ready ? "text-foreground" : "text-muted-foreground italic"
                                  }`}
                                >
                                  {ready
                                    ? (product.units_sold_1y ?? 0).toLocaleString()
                                    : "Pending"}
                                </span>
                              );
                            })()}
                          </td>
                        ) : null}
                        {showRevenue ? (
                          <td data-priority="high" className="px-2.5 py-1.5 text-right">
                            {(() => {
                              const ready = hasProductAnalyticsReady(product);
                              return (
                                <span
                                  className={`font-mono tnum text-[11.5px] ${
                                    ready ? "text-foreground" : "text-muted-foreground italic"
                                  }`}
                                >
                                  {ready
                                    ? formatCurrency(product.revenue_1y ?? 0)
                                    : "Pending"}
                                </span>
                              );
                            })()}
                          </td>
                        ) : null}
                        {showTxns ? (
                          <td data-priority="medium" className="px-2.5 py-1.5 text-right">
                            {(() => {
                              const ready = hasProductAnalyticsReady(product);
                              return (
                                <span
                                  className={`font-mono tnum text-[11.5px] ${
                                    ready ? "text-muted-foreground" : "text-muted-foreground/70 italic"
                                  }`}
                                >
                                  {ready
                                    ? (product.txns_1y ?? 0).toLocaleString()
                                    : "Pending"}
                                </span>
                              );
                            })()}
                          </td>
                        ) : null}
                        {showDaysSinceSale ? (
                          <td data-priority="low" className="px-2.5 py-1.5 text-right">
                            <span className="font-mono tnum text-[11.5px] text-muted-foreground">
                              {(() => {
                                const ref =
                                  product.effective_last_sale_date ??
                                  product.last_sale_date_computed ??
                                  product.last_sale_date;
                                // No sale-date in any form → never sold. The
                                // never-sold presets rely on this label
                                // reading as "Never", not as missing data.
                                if (!ref) return "Never";
                                const parsed = new Date(ref);
                                // Prism's 1899 / 1970 placeholder collapses
                                // the same way — "Never", not 40,000 days.
                                if (
                                  Number.isNaN(parsed.getTime()) ||
                                  parsed.getFullYear() < 1990
                                ) {
                                  return "Never";
                                }
                                const days = Math.floor(
                                  (Date.now() - parsed.getTime()) / 86_400_000,
                                );
                                return days >= 0 ? `${days}d` : "—";
                              })()}
                            </span>
                          </td>
                        ) : null}
                        {showUpdated ? (
                          <td
                            data-priority="low"
                            className="px-2.5 py-1.5 text-[11.5px] text-muted-foreground whitespace-nowrap"
                          >
                            {formatRelativeUpdated(product.updated_at)}
                          </td>
                        ) : null}
                        {showDcc ? (
                          <td data-priority="medium" className="px-2.5 py-1.5 whitespace-nowrap">
                            {(() => {
                              const segs = [
                                product.dept_num,
                                product.class_num,
                                product.cat_num,
                              ];
                              const anyDccPart = segs.some((n) => n != null);
                              // Preserve positions — a missing class between dept and cat
                              // must render as `10.—.5`, not collapse to `10.5`.
                              // When everything is null, show "—" rather than
                              // leaking the internal dcc_id surrogate key.
                              const numLabel = anyDccPart
                                ? segs
                                    .map((n) => (n != null ? String(n) : "—"))
                                    .join(".")
                                : "—";
                              const names = [
                                product.dept_name,
                                product.class_name,
                                product.cat_name,
                              ].filter(
                                (n): n is string => typeof n === "string" && n.length > 0,
                              );
                              const descLabel = names.length > 0 ? names.join(" · ") : "—";
                              return (
                                <span className="inline-flex items-baseline gap-1.5">
                                  <span
                                    className="font-mono tnum text-[10px] text-muted-foreground shrink-0"
                                    aria-label="DCC number"
                                  >
                                    {numLabel}
                                  </span>
                                  <span className="text-[11.5px] text-foreground">
                                    {descLabel}
                                  </span>
                                </span>
                              );
                            })()}
                          </td>
                        ) : null}
                      </tr>
                    );
                  })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {total > 0 ? (
          <div className="flex items-center justify-between px-3 py-2 border-t border-border bg-card text-[11.5px] text-muted-foreground">
            <span>
              Showing{" "}
              <span className="font-mono tnum text-foreground">
                {from.toLocaleString()}–{to.toLocaleString()}
              </span>{" "}
              of{" "}
              <span className="font-mono tnum text-foreground">{total.toLocaleString()}</span>
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => onPageChange(page - 1)}
              >
                Prev
              </Button>
              <span className="px-2 font-mono tnum">
                {page} / {totalPages}
              </span>
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
        ) : null}
      </div>

      {/* Mobile cards */}
      <div className="space-y-2 md:hidden p-2">
        {loading
          ? Array.from({ length: 5 }).map((_, i) => (
              <div key={`mobile-skeleton-${i}`} className="rounded-lg border p-3">
                <div className="h-4 w-3/4 animate-pulse rounded bg-muted mb-2" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
              </div>
            ))
          : products.map((product) => {
              const sel = isSelected(product.sku);
              const primaryText =
                tab === "textbooks"
                  ? product.title ?? product.description ?? "—"
                  : product.description ?? "—";
              const metaParts: string[] = [];
              if (product.author) metaParts.push(product.author);
              if (product.edition) metaParts.push(product.edition);
              if (product.catalog_number) metaParts.push(product.catalog_number);
              return (
                <div
                  key={product.sku}
                  className={`rounded-lg border p-3 ${
                    sel ? "border-primary bg-primary/5" : ""
                  }`}
                  onClick={() => onToggle(product)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{primaryText}</p>
                      <p className="text-xs text-muted-foreground">
                        <span className="font-mono tnum">SKU {product.sku}</span>
                        {metaParts.length > 0 ? ` · ${metaParts.join(" · ")}` : ""}
                      </p>
                    </div>
                    <div onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={sel}
                        onCheckedChange={() => onToggle(product)}
                        className="mt-0.5"
                        aria-label={`Select SKU ${product.sku}`}
                      />
                    </div>
                  </div>
                  <div className="mt-1.5 flex items-center gap-3 text-xs">
                    <span className="font-mono tnum font-medium">
                      {formatCurrency(product.retail_price)}
                    </span>
                    <span className="font-mono tnum text-muted-foreground">
                      {formatCurrency(product.cost)}
                    </span>
                    {product.stock_on_hand != null ? (
                      <span
                        className={`font-mono tnum ${
                          product.stock_on_hand <= 0
                            ? "text-muted-foreground"
                            : product.stock_on_hand < 15
                              ? "text-[color:var(--chart-4)] font-medium"
                              : "text-foreground"
                        }`}
                      >
                        {product.stock_on_hand.toLocaleString()} in stock
                      </span>
                    ) : null}
                    {showMargin ? (
                      <MarginBar
                        cost={Number(product.cost)}
                        retail={Number(product.retail_price)}
                      />
                    ) : null}
                  </div>
                  {tab === "textbooks" ? (
                    product.isbn ? (
                      <p className="mt-1 font-mono tnum text-[10.5px] text-muted-foreground">
                        ISBN {product.isbn}
                      </p>
                    ) : null
                  ) : product.barcode ? (
                    <p className="mt-1 font-mono tnum text-[10.5px] text-muted-foreground">
                      {product.barcode}
                    </p>
                  ) : null}
                </div>
              );
            })}

        {total > 0 ? (
          <div className="flex items-center justify-between px-1 py-2 text-[11.5px] text-muted-foreground">
            <span>
              <span className="font-mono tnum text-foreground">
                {from.toLocaleString()}–{to.toLocaleString()}
              </span>{" "}
              of <span className="font-mono tnum text-foreground">{total.toLocaleString()}</span>
            </span>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => onPageChange(page - 1)}
              >
                Prev
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
        ) : null}
      </div>
    </div>
  );
}
