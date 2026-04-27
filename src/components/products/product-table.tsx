"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ArrowDownIcon, ArrowUpIcon, ArrowUpDownIcon, PencilIcon, SearchIcon } from "lucide-react";
import { useEffect, useMemo, type ReactNode } from "react";
import type {
  ProductBrowseRow,
  ProductLocationId,
  ProductLocationSlice,
  ProductTab,
} from "@/domains/product/types";
import { DEFAULT_TABLE_DENSITY, PAGE_SIZE, TABLE_DENSITIES, type OptionalColumnKey, type TableDensity } from "@/domains/product/constants";
import { MarginBar } from "./margin-bar";
import { useProductRefDirectory, useVendorDirectory } from "@/domains/product/vendor-directory";
import { useHiddenColumns } from "./use-hidden-columns";
import { COLUMN_PRIORITY } from "@/domains/product/constants";
import { formatLookupLabel } from "@/domains/product/ref-data";
import type { ProductInlineEditController, ProductInlineEditableField } from "./use-product-inline-edit";
import "./product-table.css";

/**
 * Prefer the computed effective sale date when present, then the periodic
 * computed date, finally the raw last-sale date. Used for display and for
 * days-since-sale math.
 */
export function getProductDisplaySaleDate(
  product: Pick<ProductBrowseRow, "effective_last_sale_date" | "last_sale_date_computed" | "last_sale_date">,
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
  product: Pick<ProductBrowseRow, "aggregates_ready" | "sales_aggregates_computed_at">,
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
  product: Pick<ProductBrowseRow, "aggregates_ready" | "sales_aggregates_computed_at">,
  value: number | null | undefined,
): string {
  if (!hasProductAnalyticsReady(product)) return "Pending";
  if (value == null || Number.isNaN(value)) return "—";
  return value.toLocaleString("en-US");
}

interface ProductTableProps {
  tab: ProductTab;
  products: ProductBrowseRow[];
  total: number;
  page: number;
  loading: boolean;
  offPageSelectedCount?: number;
  sortBy: string;
  sortDir: "asc" | "desc";
  isSelected: (sku: number) => boolean;
  onToggle: (product: ProductBrowseRow) => void;
  onToggleAll: (products: ProductBrowseRow[]) => void;
  onRowClick?: (product: ProductBrowseRow) => void;
  focusedSku?: number | null;
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
  inlineEdit?: ProductInlineEditController;
  primaryLocationId?: ProductLocationId | null;
  /** Row density. Drives row height + cell padding. */
  density?: TableDensity;
}

function formatCurrency(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `$${Number(value).toFixed(2)}`;
}

function getProductAnalyticsCurrencyDisplay(
  product: Pick<ProductBrowseRow, "aggregates_ready" | "sales_aggregates_computed_at">,
  value: number | null | undefined,
): string {
  if (!hasProductAnalyticsReady(product)) return "Pending";
  return formatCurrency(value);
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

function formatMarginDisplay(cost: number | null | undefined, retail: number | null | undefined): string {
  if (cost == null || retail == null || Number.isNaN(cost) || Number.isNaN(retail) || retail <= 0) {
    return "—";
  }
  return `${(((retail - cost) / retail) * 100).toFixed(1)}%`;
}

function formatDccNumber(product: Pick<ProductBrowseRow, "dept_num" | "class_num" | "cat_num">): string {
  const segs = [product.dept_num, product.class_num, product.cat_num];
  if (!segs.some((n) => n != null)) return "—";
  return segs.map((n) => (n != null ? String(n) : "·")).join(".");
}

function formatDccDescription(product: Pick<ProductBrowseRow, "dept_name" | "class_name" | "cat_name">): string {
  const names = [product.dept_name, product.class_name, product.cat_name].filter(
    (n): n is string => typeof n === "string" && n.length > 0,
  );
  return names.length > 0 ? names.join(" · ") : "—";
}

function getPrimaryLocationSlice(
  product: ProductBrowseRow,
  primaryLocationId: ProductLocationId | null | undefined,
) {
  if (primaryLocationId == null) return null;
  return product.selected_inventories.find((slice) => slice.locationId === primaryLocationId) ?? null;
}

function getInlineEditValue(
  product: ProductBrowseRow,
  inlineEdit: ProductInlineEditController | undefined,
  primaryLocationId: ProductLocationId | null | undefined,
  field: ProductInlineEditableField,
): string {
  const inlineRow = inlineEdit?.rowsBySku.get(product.sku);
  const primarySlice = getPrimaryLocationSlice(product, primaryLocationId);
  switch (field) {
    case "cost":
      return String(inlineRow?.cost ?? primarySlice?.cost ?? product.cost ?? "");
    case "retail":
      return String(inlineRow?.retail ?? primarySlice?.retailPrice ?? product.retail_price ?? "");
    case "barcode":
      return inlineRow?.barcode ?? product.barcode ?? "";
    case "discontinue":
      return inlineRow?.fDiscontinue ? "1" : "0";
  }
}

function getInlineEditDisplayValue(
  product: ProductBrowseRow,
  inlineEdit: ProductInlineEditController | undefined,
  primaryLocationId: ProductLocationId | null | undefined,
  field: ProductInlineEditableField,
): string {
  const inlineRow = inlineEdit?.rowsBySku.get(product.sku);
  const primarySlice = getPrimaryLocationSlice(product, primaryLocationId);
  switch (field) {
    case "cost":
      return formatCurrency(inlineRow?.cost ?? primarySlice?.cost ?? product.cost);
    case "retail":
      return formatCurrency(inlineRow?.retail ?? primarySlice?.retailPrice ?? product.retail_price);
    case "barcode":
      return inlineRow?.barcode ?? product.barcode ?? product.isbn ?? "—";
    case "discontinue":
      return inlineRow?.fDiscontinue ? "Yes" : "No";
  }
}

function getTaxTypeDisplayLabel(
  product: Pick<ProductBrowseRow, "itemTaxTypeId" | "sku">,
  inlineEdit: ProductInlineEditController | undefined,
  taxTypeLabels: Map<number, string>,
): string {
  const inlineRow = inlineEdit?.rowsBySku.get(product.sku);
  const activeTaxTypeId = inlineRow?.itemTaxTypeId ?? product.itemTaxTypeId;
  const currentLabel =
    activeTaxTypeId != null ? taxTypeLabels.get(activeTaxTypeId) ?? null : null;
  return formatLookupLabel(
    currentLabel,
    activeTaxTypeId == null ? "Unassigned" : "Tax unavailable",
  );
}

function InlineEditableCell({
  product,
  field,
  label,
  displayValue,
  currentValue,
  fieldOrder,
  badge,
  inlineEdit,
  editable = true,
  align = "left",
  className,
  inputClassName,
}: {
  product: ProductBrowseRow;
  field: "retail" | "cost" | "barcode";
  label: string;
  displayValue: string;
  currentValue: string;
  fieldOrder: readonly ProductInlineEditableField[];
  badge?: ReactNode;
  inlineEdit?: ProductInlineEditController;
  editable?: boolean;
  align?: "left" | "right";
  className?: string;
  inputClassName?: string;
}) {
  const isEditing =
    inlineEdit?.editingCell?.sku === product.sku && inlineEdit?.editingCell?.field === field;

  const valueNode = isEditing && inlineEdit ? (
    <input
      autoFocus
      aria-label={`${label} editor for SKU ${product.sku}`}
      value={inlineEdit.draftValue}
      onChange={(e) => inlineEdit.setDraftValue(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.stopPropagation();
          void inlineEdit.commitEdit();
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          inlineEdit.cancelEdit();
          return;
        }
        if (e.key === "Tab") {
          e.preventDefault();
          e.stopPropagation();
          void inlineEdit.moveToNextEditableCell(e.shiftKey ? "previous" : "next");
        }
      }}
      className={`h-8 min-w-[104px] rounded-md border border-ring bg-background px-2.5 py-0 text-[12px] font-mono tnum text-foreground outline-none transition-colors focus:ring-2 focus:ring-ring/30 ${
        inputClassName ?? ""
      } ${align === "right" ? "text-right" : "text-left"}`}
    />
  ) : inlineEdit && editable ? (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        inlineEdit.startEdit(product.sku, field, currentValue, fieldOrder);
      }}
      aria-label={`Edit ${label.toLowerCase()} for SKU ${product.sku}`}
      title={`Edit ${label.toLowerCase()}`}
      className={`group/inline-edit inline-flex min-w-[74px] items-center gap-1 rounded-[7px] border border-transparent px-1.5 py-1 text-[12px] font-mono tnum transition-colors hover:border-border hover:bg-accent/70 hover:text-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        align === "right" ? "justify-end" : "justify-start"
      }`}
    >
      <span className="leading-none">{displayValue}</span>
      {field === "cost" || field === "retail" ? (
        <PencilIcon
          className="size-3 shrink-0 text-muted-foreground opacity-55 transition-opacity group-hover/inline-edit:opacity-100"
          aria-hidden="true"
        />
      ) : null}
    </button>
  ) : (
    <span className="font-mono tnum text-[11.5px] leading-none">{displayValue}</span>
  );

  return (
    <td className={className}>
      <div className={`flex items-center gap-1.5 ${align === "right" ? "justify-end" : "justify-start"}`}>
        {valueNode}
        {badge ?? null}
      </div>
    </td>
  );
}

function TaxTypeCell({
  product,
  inlineEdit,
  taxTypeLabels,
}: {
  product: ProductBrowseRow;
  inlineEdit?: ProductInlineEditController;
  taxTypeLabels: Map<number, string>;
}) {
  const currentLabel = getTaxTypeDisplayLabel(product, inlineEdit, taxTypeLabels);

  return (
    <td className="px-2.5 py-1.5">
      <span className="text-[11.5px] text-foreground">{currentLabel}</span>
    </td>
  );
}

function DiscontinueCell({
  product,
  inlineEdit,
}: {
  product: ProductBrowseRow;
  inlineEdit?: ProductInlineEditController;
}) {
  const inlineRow = inlineEdit?.rowsBySku.get(product.sku);
  const isDiscontinued = inlineRow ? inlineRow.fDiscontinue === 1 : product.discontinued === true;

  return (
    <td className="px-2.5 py-1.5 text-center">
      {inlineEdit ? (
        <button
          type="button"
          aria-label={`Toggle discontinue for SKU ${product.sku}`}
          aria-pressed={isDiscontinued}
          disabled={inlineEdit.pendingSave}
          onClick={(event) => {
            event.stopPropagation();
            void inlineEdit.saveField(product.sku, "discontinue", isDiscontinued ? "0" : "1");
          }}
          className={`inline-flex min-w-[52px] items-center justify-center rounded-full border px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.03em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            isDiscontinued
              ? "border-amber-500/40 bg-amber-500/10 text-amber-700"
              : "border-emerald-500/35 bg-emerald-500/10 text-emerald-700"
          }`}
        >
          {isDiscontinued ? "Disc" : "Live"}
        </button>
      ) : (
        <span className="text-[11.5px] text-foreground">{isDiscontinued ? "Disc" : "Live"}</span>
      )}
    </td>
  );
}

export function formatLocationVarianceBadge(varies: boolean, selectedCount: number): string | null {
  if (!varies || selectedCount <= 1) return null;
  return `+${selectedCount - 1} varies`;
}

type LocationValueField = "retailPrice" | "cost" | "stockOnHand";

interface LocationValueRow {
  label: string;
  value: string;
}

function formatLocationValue(slice: ProductLocationSlice, field: LocationValueField): string {
  if (field === "stockOnHand") {
    return slice.stockOnHand == null ? "—" : slice.stockOnHand.toLocaleString();
  }
  const value = slice[field];
  return value == null ? "—" : formatCurrency(value);
}

export function getLocationValueRows(
  slices: readonly ProductLocationSlice[],
  field: LocationValueField,
): LocationValueRow[] {
  return slices.map((slice) => ({
    label: slice.locationAbbrev,
    value: formatLocationValue(slice, field),
  }));
}

function LocationVariancePopover({
  badge,
  field,
  label,
  slices,
}: {
  badge: string;
  field: LocationValueField;
  label: string;
  slices: readonly ProductLocationSlice[];
}) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            onClick={(event) => event.stopPropagation()}
            aria-label={`${label} values vary across locations`}
            className="inline-flex shrink-0 items-center rounded-full border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            {badge}
          </button>
        }
      />
      <PopoverContent align="end" className="w-44 p-2">
        <div className="space-y-1.5">
          {getLocationValueRows(slices, field).map((row) => (
            <div
              key={row.label}
              className="flex items-center justify-between gap-3 text-[11px] leading-4"
            >
              <span className="text-muted-foreground">{row.label}</span>
              <span className="font-mono tnum text-foreground">{row.value}</span>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
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
  offPageSelectedCount = 0,
  sortBy,
  sortDir,
  isSelected,
  onToggle,
  onToggleAll,
  onRowClick,
  focusedSku = null,
  onPageChange,
  onSort,
  visibleColumns,
  onHideColumn,
  onHiddenChange,
  suppressEmptyState = false,
  inlineEdit,
  primaryLocationId,
  density = DEFAULT_TABLE_DENSITY,
}: ProductTableProps) {
  const densityCfg = TABLE_DENSITIES.find((d) => d.value === density) ?? TABLE_DENSITIES[1];
  const rowStripe = "stripe" in densityCfg && densityCfg.stripe === true;
  void onHideColumn;
  const { byId: vendorsById } = useVendorDirectory();
  const { lookups } = useProductRefDirectory();
  // Observe the wrapper width so the hidden-count badge reflects what the
  // @container queries actually suppress.
  const { ref: wrapperRef, summary: hiddenSummary } = useHiddenColumns();
  const inlineFieldOrder: readonly ProductInlineEditableField[] =
    tab === "textbooks" ? ["cost", "retail"] : ["cost", "retail", "barcode"];
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
  const showSkeletonRows = loading && products.length === 0;
  const isUpdatingRows = loading && products.length > 0;
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
  // Tax Type + Disc + LastSale + [optional columns].
  const baseCols = 11 + (showMargin ? 1 : 0);
  const optionalCols =
    (showUnits ? 1 : 0) +
    (showRevenue ? 1 : 0) +
    (showTxns ? 1 : 0) +
    (showDaysSinceSale ? 1 : 0) +
    (showUpdated ? 1 : 0) +
    (showDcc ? 1 : 0);
  const skeletonCols = baseCols + optionalCols;

  return (
    <div
      className="rounded-[10px] border border-border bg-card overflow-hidden shadow-[0_1px_0_color-mix(in_oklch,var(--border)_55%,transparent),0_2px_8px_-2px_color-mix(in_oklch,var(--foreground)_6%,transparent)]"
      aria-busy={loading}
    >
      {offPageSelectedCount > 0 ? (
        <div className="border-b border-border bg-secondary/55 px-3 py-2 text-[11.5px] text-muted-foreground">
          <span className="font-medium text-foreground">
            {offPageSelectedCount} selected on another page.
          </span>{" "}
          Bulk actions include hidden selections until you clear them.
        </div>
      ) : null}
      {isUpdatingRows ? (
        <div className="border-b border-border bg-card px-3 py-1.5 text-[11px] text-muted-foreground">
          Updating results while keeping the current rows visible.
        </div>
      ) : null}
      {/* Desktop table — wrapper owns the container-query context that drives
          optional-column hiding via `data-priority` at narrow widths. */}
      <div ref={wrapperRef} className="product-table-wrap hidden md:block">
        <div className="max-h-[62vh] overflow-auto">
          <table className="product-table w-full border-collapse text-[13px]">
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
                  width={150}
                />
                <SortHeader
                  field="cost"
                  label="Cost"
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onSort={onSort}
                  align="right"
                  mono
                  width={96}
                />
                <SortHeader
                  field="retail_price"
                  label="Retail"
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onSort={onSort}
                  align="right"
                  mono
                  width={104}
                />
                <SortHeader
                  field="stock_on_hand"
                  label="Stock"
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onSort={onSort}
                  align="right"
                  mono
                  width={86}
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
                <th className="bg-card border-b border-border sticky top-0 z-[1] px-2.5 py-2 text-left text-[11px] font-semibold tracking-[-0.005em] text-muted-foreground">
                  Tax Type
                </th>
                <th className="bg-card border-b border-border sticky top-0 z-[1] px-2.5 py-2 text-center text-[11px] font-semibold tracking-[-0.005em] text-muted-foreground">
                  Disc
                </th>
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
              {showSkeletonRows
                ? Array.from({ length: 10 }).map((_, i) => (
                    <tr key={`skeleton-${i}`} style={{ height: densityCfg.rowH }}>
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
                    const selectedInventories = product.selected_inventories ?? [];
                    const selectedLocationCount = selectedInventories.length;
                    const retailBadge = formatLocationVarianceBadge(
                      product.location_variance?.retailPriceVaries ?? false,
                      selectedLocationCount,
                    );
                    const costBadge = formatLocationVarianceBadge(
                      product.location_variance?.costVaries ?? false,
                      selectedLocationCount,
                    );
                    const stockBadge = formatLocationVarianceBadge(
                      product.location_variance?.stockVaries ?? false,
                      selectedLocationCount,
                    );
                    const primaryText =
                      tab === "textbooks"
                        ? product.title ?? product.description ?? "—"
                        : product.description ?? "—";
                    const resolvedPrimaryLocationId =
                      primaryLocationId ?? product.primary_location_id ?? null;
                    const primarySlice = getPrimaryLocationSlice(
                      product,
                      resolvedPrimaryLocationId,
                    );
                    const canInlineEditScopedPricing = primarySlice != null;
                    const costValue = primarySlice?.cost ?? product.cost;
                    const retailValue = primarySlice?.retailPrice ?? product.retail_price;
                    const metaParts: string[] = [];
                    if (product.author) metaParts.push(product.author);
                    if (product.edition) metaParts.push(product.edition);
                    if (product.catalog_number) metaParts.push(product.catalog_number);
                    if (product.product_type && tab === "merchandise")
                      metaParts.push(product.product_type);
                    return (
                      <tr
                        key={product.sku}
                        data-density={density}
                        onClick={() => {
                          if (onRowClick) onRowClick(product);
                          else onToggle(product);
                        }}
                        style={{ height: densityCfg.rowH, fontSize: densityCfg.fontPx }}
                        className={`cursor-pointer transition-colors border-b border-border/50 ${
                          isUpdatingRows ? "opacity-70" : ""
                        } ${
                          sel
                            ? "bg-primary/[0.06]"
                            : focusedSku === product.sku
                              ? "bg-accent/60"
                              : rowStripe && zebra
                                ? "bg-secondary/60 hover:bg-accent/70"
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
                        <td className="px-3 py-2 max-w-[420px]">
                          <div className="flex flex-col gap-px">
                            <span className="overflow-hidden text-ellipsis whitespace-nowrap text-foreground font-medium">
                              {primaryText}
                            </span>
                            {metaParts.length > 0 ? (
                              <span className="product-table-row-meta text-[10.5px] text-muted-foreground overflow-hidden text-ellipsis whitespace-nowrap">
                                {metaParts.join(" · ")}
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {(() => {
                            const name = formatVendorDisplay(
                              product.vendor_id != null ? vendorsById.get(product.vendor_id) : null,
                            );
                            return (
                              <span
                                className="block max-w-[150px] truncate text-[12px] text-foreground"
                                title={name}
                              >
                                {name}
                              </span>
                            );
                          })()}
                        </td>
                        <InlineEditableCell
                          product={product}
                          field="cost"
                          label="Cost"
                          displayValue={formatCurrency(costValue)}
                          currentValue={getInlineEditValue(product, inlineEdit, resolvedPrimaryLocationId, "cost")}
                          fieldOrder={inlineFieldOrder}
                          badge={
                            costBadge ? (
                              <LocationVariancePopover
                                badge={costBadge}
                                field="cost"
                                label="Cost"
                                slices={selectedInventories}
                              />
                            ) : null
                          }
                          inlineEdit={inlineEdit}
                          editable={canInlineEditScopedPricing}
                          align="right"
                          className="px-3 py-2 text-right"
                          inputClassName="min-w-[104px]"
                        />
                        <InlineEditableCell
                          product={product}
                          field="retail"
                          label="Retail"
                          displayValue={formatCurrency(retailValue)}
                          currentValue={getInlineEditValue(product, inlineEdit, resolvedPrimaryLocationId, "retail")}
                          fieldOrder={inlineFieldOrder}
                          badge={
                            retailBadge ? (
                              <LocationVariancePopover
                                badge={retailBadge}
                                field="retailPrice"
                                label="Retail"
                                slices={selectedInventories}
                              />
                            ) : null
                          }
                          inlineEdit={inlineEdit}
                          editable={canInlineEditScopedPricing}
                          align="right"
                          className="px-3 py-2 text-right"
                          inputClassName="min-w-[104px]"
                        />
                        <td className="px-3 py-2 text-right">
                          {(() => {
                            const stock = product.stock_on_hand;
                            const stockValue = stock == null ? "—" : stock.toLocaleString();
                            const isOut = stock != null && stock <= 0;
                            const isLow = stock != null && stock > 0 && stock < 15;
                            return (
                              <span className="inline-flex items-center justify-end gap-1.5">
                                <span
                                  className={`font-mono tnum text-[11.5px] ${
                                    stock == null
                                      ? "text-muted-foreground/70"
                                      : isOut
                                      ? "text-muted-foreground"
                                      : isLow
                                        ? "text-[color:var(--chart-4)] font-medium"
                                        : "text-foreground"
                                  }`}
                                >
                                  {stockValue}
                                </span>
                                {stockBadge ? (
                                  <LocationVariancePopover
                                    badge={stockBadge}
                                    field="stockOnHand"
                                    label="Stock"
                                    slices={selectedInventories}
                                  />
                                ) : null}
                              </span>
                            );
                          })()}
                        </td>
                        {showMargin ? (
                          <td data-priority="medium" className="px-3 py-2 text-right">
                            {costValue != null && retailValue != null ? (
                              <MarginBar
                                cost={costValue}
                                retail={retailValue}
                              />
                            ) : (
                              <span className="font-mono tnum text-[11.5px] text-muted-foreground">
                                —
                              </span>
                            )}
                          </td>
                        ) : null}
                        {tab === "textbooks" ? (
                          <td className="px-2.5 py-1.5">
                            <span className="font-mono tnum text-[11.5px] leading-none text-foreground">
                              {product.isbn ? `ISBN ${product.isbn}` : "—"}
                            </span>
                          </td>
                        ) : (
                          <InlineEditableCell
                            product={product}
                            field="barcode"
                            label="Barcode"
                            displayValue={getInlineEditDisplayValue(product, inlineEdit, resolvedPrimaryLocationId, "barcode")}
                            currentValue={getInlineEditValue(product, inlineEdit, resolvedPrimaryLocationId, "barcode")}
                            fieldOrder={inlineFieldOrder}
                            inlineEdit={inlineEdit}
                            className="px-2.5 py-1.5"
                          />
                        )}
                        <TaxTypeCell
                          product={product}
                          inlineEdit={inlineEdit}
                          taxTypeLabels={lookups.taxTypeLabels}
                        />
                        <DiscontinueCell product={product} inlineEdit={inlineEdit} />
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
      <div className="space-y-2 p-2 md:hidden">
        {showSkeletonRows
          ? Array.from({ length: 5 }).map((_, i) => (
              <div key={`mobile-skeleton-${i}`} className="rounded-xl border p-3">
                <div className="mb-2 h-4 w-3/4 animate-pulse rounded bg-muted" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
              </div>
            ))
          : products.map((product) => {
              const sel = isSelected(product.sku);
              const selectedInventories = product.selected_inventories ?? [];
              const selectedLocationCount = selectedInventories.length;
              const retailBadge = formatLocationVarianceBadge(
                product.location_variance?.retailPriceVaries ?? false,
                selectedLocationCount,
              );
              const costBadge = formatLocationVarianceBadge(
                product.location_variance?.costVaries ?? false,
                selectedLocationCount,
              );
              const stockBadge = formatLocationVarianceBadge(
                product.location_variance?.stockVaries ?? false,
                selectedLocationCount,
              );
              const primaryText =
                tab === "textbooks"
                  ? product.title ?? product.description ?? "—"
                  : product.description ?? "—";
              const resolvedPrimaryLocationId = primaryLocationId ?? product.primary_location_id ?? null;
              const primarySlice = getPrimaryLocationSlice(product, resolvedPrimaryLocationId);
              const costValue = primarySlice?.cost ?? product.cost;
              const retailValue = primarySlice?.retailPrice ?? product.retail_price;
              const stockValue = primarySlice?.stockOnHand ?? product.stock_on_hand;
              const vendorName = formatVendorDisplay(
                product.vendor_id != null ? vendorsById.get(product.vendor_id) : null,
              );
              const taxTypeLabel = getTaxTypeDisplayLabel(product, inlineEdit, lookups.taxTypeLabels);
              const statusLabel = product.discontinued ? "Discontinued" : "Live";
              const dccNumber = formatDccNumber(product);
              const dccDescription = formatDccDescription(product);
              const metaParts: string[] = [];
              if (product.author) metaParts.push(product.author);
              if (product.edition) metaParts.push(product.edition);
              if (product.catalog_number) metaParts.push(product.catalog_number);
              if (product.product_type && tab === "merchandise") metaParts.push(product.product_type);

              const detailItems: Array<{
                label: string;
                value: string;
                valueClassName?: string;
                subvalue?: string;
                detail?: ReactNode;
                detailTestId?: string;
              }> = [
                {
                  label: "Last sale",
                  value: formatSaleDate(getProductDisplaySaleDate(product) ?? null),
                },
                {
                  label: "Tax type",
                  value: taxTypeLabel,
                },
                {
                  label: "Status",
                  value: statusLabel,
                  valueClassName:
                    product.discontinued
                      ? "text-amber-700 dark:text-amber-400"
                      : "text-emerald-700 dark:text-emerald-400",
                },
              ];

              if (showUnits) {
                detailItems.push({
                  label: "Units 1y",
                  value: getProductAnalyticsDisplay(product, product.units_sold_1y),
                });
              }
              if (showRevenue) {
                detailItems.push({
                  label: "Revenue 1y",
                  value: getProductAnalyticsCurrencyDisplay(product, product.revenue_1y),
                });
              }
              if (showTxns) {
                detailItems.push({
                  label: "Receipts 1y",
                  value: getProductAnalyticsDisplay(product, product.txns_1y),
                });
              }
              if (showDaysSinceSale) {
                const ref =
                  product.effective_last_sale_date ??
                  product.last_sale_date_computed ??
                  product.last_sale_date;
                const parsed = ref ? new Date(ref) : null;
                const daysSinceSale =
                  !ref || !parsed || Number.isNaN(parsed.getTime()) || parsed.getFullYear() < 1990
                    ? "Never"
                    : `${Math.max(0, Math.floor((Date.now() - parsed.getTime()) / 86_400_000))}d`;
                detailItems.push({
                  label: "Days since sale",
                  value: daysSinceSale,
                });
              }
              if (showUpdated) {
                detailItems.push({
                  label: "Updated",
                  value: formatRelativeUpdated(product.updated_at),
                });
              }
              if (showDcc) {
                detailItems.push({
                  label: "DCC",
                  value: dccNumber,
                  subvalue: dccDescription !== "—" ? dccDescription : undefined,
                });
              }
              if (showMargin) {
                const hasMarginMetric =
                  costValue != null &&
                  retailValue != null &&
                  !Number.isNaN(costValue) &&
                  !Number.isNaN(retailValue) &&
                  retailValue > 0;
                detailItems.push({
                  label: "Margin",
                  value: formatMarginDisplay(costValue, retailValue),
                  detail: hasMarginMetric ? <MarginBar cost={costValue} retail={retailValue} showText={false} /> : null,
                  detailTestId: hasMarginMetric ? `product-card-margin-visual-${product.sku}` : undefined,
                });
              }

              return (
                <div
                  key={product.sku}
                  data-testid={`product-card-${product.sku}`}
                  className={`relative rounded-xl border border-border/70 bg-card p-3 shadow-sm transition-colors ${
                    isUpdatingRows ? "opacity-70" : ""
                  } ${
                    sel ? "border-primary bg-primary/[0.05]" : ""
                  }`}
                >
                  <button
                    type="button"
                    aria-pressed={sel}
                    aria-label={`Select ${primaryText}, SKU ${product.sku}`}
                    className="absolute inset-0 z-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={(event) => {
                      event.stopPropagation();
                      onToggle(product);
                    }}
                  />
                  <div className="pointer-events-none relative z-10 flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center rounded-full border border-border bg-background px-2 py-0.5 font-mono text-[10.5px] font-medium tracking-[0.02em] text-muted-foreground">
                          SKU {product.sku}
                        </span>
                        <span className="text-[11px] font-medium text-muted-foreground">
                          {vendorName}
                        </span>
                      </div>
                      <p className="line-clamp-2 text-[14px] font-semibold leading-5 text-foreground">
                        {primaryText}
                      </p>
                      {metaParts.length > 0 ? (
                        <p className="text-[11px] leading-4 text-muted-foreground">{metaParts.join(" · ")}</p>
                      ) : null}
                    </div>
                    <div className="shrink-0 pt-0.5">
                      <Checkbox
                        checked={sel}
                        className="pointer-events-none mt-0.5"
                        aria-hidden="true"
                        tabIndex={-1}
                      />
                    </div>
                  </div>

                  <div className="pointer-events-none relative z-10 mt-3 grid grid-cols-3 gap-2">
                    <div className="min-w-0 rounded-lg bg-secondary/45 px-2.5 py-2">
                      <div className="text-[10px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
                        Retail
                      </div>
                      <div className="mt-1 flex min-w-0 items-center gap-1 text-[13px] font-semibold text-foreground">
                        <span className="truncate font-mono tnum">{formatCurrency(retailValue)}</span>
                        {retailBadge ? (
                          <span
                            className="pointer-events-auto"
                            onClick={(event) => event.stopPropagation()}
                            onPointerDown={(event) => event.stopPropagation()}
                          >
                            <LocationVariancePopover
                              badge={retailBadge}
                              field="retailPrice"
                              label="Retail"
                              slices={selectedInventories}
                            />
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="min-w-0 rounded-lg bg-secondary/45 px-2.5 py-2">
                      <div className="text-[10px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
                        Cost
                      </div>
                      <div className="mt-1 flex min-w-0 items-center gap-1 text-[13px] text-foreground">
                        <span className="truncate font-mono tnum">{formatCurrency(costValue)}</span>
                        {costBadge ? (
                          <span
                            className="pointer-events-auto"
                            onClick={(event) => event.stopPropagation()}
                            onPointerDown={(event) => event.stopPropagation()}
                          >
                            <LocationVariancePopover
                              badge={costBadge}
                              field="cost"
                              label="Cost"
                              slices={selectedInventories}
                            />
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="min-w-0 rounded-lg bg-secondary/45 px-2.5 py-2">
                      <div className="text-[10px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
                        Stock
                      </div>
                      <div
                        className={`mt-1 flex min-w-0 items-center gap-1 text-[13px] ${
                          stockValue == null
                            ? "text-muted-foreground/70"
                            : stockValue <= 0
                              ? "text-muted-foreground"
                              : stockValue < 15
                                ? "font-medium text-[color:var(--chart-4)]"
                                : "text-foreground"
                        }`}
                      >
                        <span className="truncate font-mono tnum">
                          {stockValue == null ? "—" : stockValue.toLocaleString()}
                        </span>
                        {stockBadge ? (
                          <span
                            className="pointer-events-auto"
                            onClick={(event) => event.stopPropagation()}
                            onPointerDown={(event) => event.stopPropagation()}
                          >
                            <LocationVariancePopover
                              badge={stockBadge}
                              field="stockOnHand"
                              label="Stock"
                              slices={selectedInventories}
                            />
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="pointer-events-none relative z-10 mt-3 grid grid-cols-2 gap-x-3 gap-y-2 rounded-lg border border-border/60 bg-background/70 p-2.5">
                    {detailItems.map((item) => (
                      <div key={item.label} className="min-w-0">
                        <div className="text-[10px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
                          {item.label}
                        </div>
                        <div
                          className={`mt-1 truncate text-[12px] font-medium ${item.valueClassName ?? "text-foreground"}`}
                        >
                          {item.value}
                        </div>
                        {item.detail ? (
                          <div
                            data-testid={item.detailTestId}
                            className="mt-1 flex min-w-0 items-center"
                          >
                            {item.detail}
                          </div>
                        ) : null}
                        {item.subvalue ? (
                          <div className="truncate text-[10.5px] text-muted-foreground">{item.subvalue}</div>
                        ) : null}
                      </div>
                    ))}
                  </div>

                  {tab === "textbooks" ? (
                    product.isbn ? (
                      <p className="pointer-events-none relative z-10 mt-2 font-mono tnum text-[10.5px] text-muted-foreground">
                        ISBN {product.isbn}
                      </p>
                    ) : null
                  ) : product.barcode ? (
                    <p className="pointer-events-none relative z-10 mt-2 font-mono tnum text-[10.5px] text-muted-foreground">
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
