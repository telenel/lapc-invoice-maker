"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDownIcon, SearchIcon, XIcon } from "lucide-react";
import { useVendorDirectory } from "@/domains/product/vendor-directory";
import type { ProductFilters } from "@/domains/product/types";

function hasFilterText(value: string | null | undefined): boolean {
  return (value ?? "").toString().trim() !== "";
}

function hasFilterBool(value: boolean | null | undefined): boolean {
  return !!value;
}

/**
 * Count active filters across the full ProductFilters shape. Used for badge totals
 * in pieces of UI (e.g. a compact filter toggle) that do not render the rail.
 */
export function getProductActiveFilterCount(filters: ProductFilters): number {
  let count = 0;

  if (hasFilterText(filters.minPrice)) count++;
  if (hasFilterText(filters.maxPrice)) count++;
  if (hasFilterText(filters.vendorId)) count++;
  if (hasFilterBool(filters.hasBarcode)) count++;
  if (hasFilterText(filters.lastSaleDateFrom)) count++;
  if (hasFilterText(filters.lastSaleDateTo)) count++;
  if (filters.tab === "textbooks") {
    if (hasFilterText(filters.author)) count++;
    if (hasFilterBool(filters.hasIsbn)) count++;
    if (hasFilterText(filters.edition)) count++;
  }
  if (filters.tab === "merchandise") {
    if (hasFilterText(filters.catalogNumber)) count++;
    if (hasFilterText(filters.productType)) count++;
  }
  if (hasFilterText(filters.minStock)) count++;
  if (hasFilterText(filters.maxStock)) count++;
  if (hasFilterText(filters.dccComposite)) {
    // Composite represents the whole dept/class/cat triple; count once and
    // suppress the segment counts so the badge doesn't double-bill one
    // logical filter.
    count++;
  } else {
    if (hasFilterText(filters.deptNum)) count++;
    if (hasFilterText(filters.classNum)) count++;
    if (hasFilterText(filters.catNum)) count++;
  }
  if (hasFilterBool(filters.missingBarcode)) count++;
  if (hasFilterBool(filters.missingIsbn)) count++;
  if (hasFilterBool(filters.missingTitle)) count++;
  if (hasFilterBool(filters.retailBelowCost)) count++;
  if (hasFilterBool(filters.zeroPrice)) count++;
  if (hasFilterText(filters.minMargin)) count++;
  if (hasFilterText(filters.maxMargin)) count++;
  if (filters.lastSaleWithin) count++;
  if (hasFilterBool(filters.lastSaleNever)) count++;
  if (filters.lastSaleOlderThan) count++;
  if (filters.editedWithin) count++;
  if (hasFilterBool(filters.editedSinceSync)) count++;
  if (filters.discontinued) count++;
  if (filters.itemType) count++;
  if (hasFilterText(filters.minUnitsSold)) count++;
  if (hasFilterText(filters.maxUnitsSold)) count++;
  if (filters.unitsSoldWindow) count++;
  if (hasFilterText(filters.minRevenue)) count++;
  if (hasFilterText(filters.maxRevenue)) count++;
  if (filters.revenueWindow) count++;
  if (hasFilterText(filters.minTxns)) count++;
  if (hasFilterText(filters.maxTxns)) count++;
  if (filters.txnsWindow) count++;
  if (hasFilterBool(filters.neverSoldLifetime)) count++;
  if (filters.firstSaleWithin) count++;
  if (filters.trendDirection) count++;
  if (hasFilterText(filters.maxStockCoverageDays)) count++;
  return count;
}

function getProductActiveFilterChips(filters: ProductFilters): Array<{
  key: string;
  label: string;
  clearPatch: Partial<ProductFilters>;
}> {
  const chips: Array<{
    key: string;
    label: string;
    clearPatch: Partial<ProductFilters>;
  }> = [];

  if (hasFilterText(filters.dccComposite)) {
    chips.push({
      key: "dccComposite",
      label: `DCC: ${filters.dccComposite}`,
      clearPatch: {
        dccComposite: "",
        deptNum: "",
        classNum: "",
        catNum: "",
      },
    });
  }

  return chips;
}

interface ProductFiltersBarProps {
  filters: ProductFilters;
  onChange: (filters: ProductFilters) => void;
  onClear: () => void;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="pt-3 pb-1 text-[11px] font-semibold tracking-[-0.005em] text-muted-foreground">
      {children}
    </div>
  );
}

function RailInput({
  value,
  onChange,
  placeholder,
  mono = false,
  icon,
  type = "text",
  inputMode,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
  icon?: React.ReactNode;
  type?: string;
  inputMode?: "numeric" | "decimal" | "text";
  ariaLabel: string;
}) {
  return (
    <div className="flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs focus-within:ring-2 focus-within:ring-ring focus-within:border-ring">
      {icon ? <span className="text-muted-foreground inline-flex shrink-0">{icon}</span> : null}
      <input
        aria-label={ariaLabel}
        type={type}
        inputMode={inputMode}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`flex-1 min-w-0 border-none outline-none bg-transparent text-foreground p-0 text-xs ${
          mono ? "font-mono" : ""
        }`}
      />
    </div>
  );
}

function ToggleRow({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-2 py-0.5 cursor-pointer text-xs text-foreground select-none">
      <span
        onClick={(e) => {
          e.preventDefault();
          onChange(!checked);
        }}
        className={`inline-flex items-center justify-center w-3.5 h-3.5 rounded-[3px] border transition-all ${
          checked
            ? "bg-primary border-primary text-primary-foreground"
            : "bg-card border-border hover:border-muted-foreground"
        }`}
      >
        {checked ? (
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m5 12 5 5 9-11" />
          </svg>
        ) : null}
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      <span className="flex-1">{label}</span>
    </label>
  );
}

function VendorSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const { vendors, byId, loading, available } = useVendorDirectory();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [triggerRect, setTriggerRect] = useState<DOMRect | null>(null);

  const recomputeRect = () => {
    if (triggerRef.current) setTriggerRect(triggerRef.current.getBoundingClientRect());
  };

  // Keep the portalled popover aligned with the trigger as the rail scrolls,
  // the window resizes, or any ancestor scrolls.
  useLayoutEffect(() => {
    if (!open) return;
    recomputeRect();
    const update = () => recomputeRect();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open]);

  // Close on outside click (checks both the trigger shell and the portalled
  // popover since they live in different DOM subtrees).
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t)) return;
      if (popoverRef.current?.contains(t)) return;
      setOpen(false);
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [open]);

  const selected = useMemo(() => {
    if (!value) return { label: "", knownName: false };
    const id = Number(value);
    if (!Number.isFinite(id)) return { label: value, knownName: false };
    const name = byId.get(id);
    return name
      ? { label: name, knownName: true }
      : { label: `#${id}`, knownName: false };
  }, [value, byId]);

  const filtered = useMemo(() => {
    if (!query.trim()) return vendors.slice(0, 60);
    const q = query.trim().toLowerCase();
    return vendors
      .filter((v) => v.name.toLowerCase().includes(q) || String(v.vendorId).includes(q))
      .slice(0, 60);
  }, [vendors, query]);

  // Only drop to the numeric fallback when we've CONFIRMED Prism is
  // unreachable — not while the first refs() request is still in flight.
  // Otherwise fresh mounts on a healthy Prism flash the degraded input.
  // Strip non-digits before persisting so the downstream Number() coercion
  // in searchProducts() can't produce NaN and crash the query.
  if (!loading && !available) {
    return (
      <RailInput
        ariaLabel="Vendor ID"
        value={value}
        onChange={(v) => onChange(v.replace(/\D+/g, ""))}
        placeholder="Vendor ID…"
        icon={<SearchIcon className="size-3" aria-hidden="true" />}
        mono
        inputMode="numeric"
        type="text"
      />
    );
  }

  return (
    <div ref={rootRef} className="relative">
      {/* Toggle button and clear button are siblings inside a shared shell so
          we don't nest interactive controls. The shell renders the border, and
          each button owns its own click target. */}
      <div
        ref={triggerRef}
        className="flex w-full items-center gap-1 rounded-md border border-border bg-card px-1.5 py-1 text-xs focus-within:ring-2 focus-within:ring-ring focus-within:border-ring"
      >
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="listbox"
          aria-expanded={open}
          className="flex flex-1 min-w-0 items-center gap-1.5 rounded-[3px] bg-transparent px-1 py-0.5 text-left focus:outline-none"
        >
          <SearchIcon
            className="size-3 text-muted-foreground shrink-0"
            aria-hidden="true"
          />
          <span className="flex-1 min-w-0 truncate text-foreground">
            {selected.label ? (
              <span className="inline-flex items-baseline gap-1">
                <span>{selected.label}</span>
                {selected.knownName && value ? (
                  <span className="font-mono tnum text-[10px] text-muted-foreground">
                    #{value}
                  </span>
                ) : null}
              </span>
            ) : (
              <span className="text-muted-foreground">Any vendor</span>
            )}
          </span>
          <ChevronDownIcon
            className={`size-3 text-muted-foreground transition-transform ${
              open ? "rotate-180" : ""
            }`}
            aria-hidden="true"
          />
        </button>
        {value ? (
          <button
            type="button"
            aria-label="Clear vendor"
            onClick={() => onChange("")}
            className="inline-flex items-center justify-center rounded-[3px] p-0.5 text-muted-foreground hover:text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <XIcon className="size-3" aria-hidden="true" />
          </button>
        ) : null}
      </div>

      {open && triggerRect && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={popoverRef}
              role="listbox"
              className="fixed z-[60] rounded-md border border-border bg-card shadow-[0_10px_30px_-8px_color-mix(in_oklch,var(--foreground)_25%,transparent)]"
              style={{
                top: triggerRect.bottom + 4,
                left: triggerRect.left,
                width: triggerRect.width,
              }}
            >
              <div className="p-1.5 border-b border-border">
                <div className="flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1">
                  <SearchIcon
                    className="size-3 text-muted-foreground shrink-0"
                    aria-hidden="true"
                  />
                  <input
                    autoFocus
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search vendors…"
                    className="flex-1 min-w-0 border-none outline-none bg-transparent text-foreground text-xs"
                  />
                </div>
              </div>
              <ul className="max-h-[240px] overflow-auto py-1">
                {filtered.length === 0 ? (
                  <li className="px-2.5 py-2 text-[11px] text-muted-foreground">
                    No vendors match &ldquo;{query}&rdquo;.
                  </li>
                ) : (
                  filtered.map((v) => {
                    const isSelected = String(v.vendorId) === value;
                    return (
                      <li key={v.vendorId}>
                        <button
                          type="button"
                          onClick={() => {
                            onChange(String(v.vendorId));
                            setOpen(false);
                            setQuery("");
                          }}
                          className={`flex w-full items-baseline justify-between gap-2 px-2.5 py-1 text-[11.5px] text-left hover:bg-accent ${
                            isSelected ? "bg-primary/10 text-primary" : "text-foreground"
                          }`}
                        >
                          <span className="truncate">{v.name}</span>
                          <span className="font-mono tnum text-[10px] text-muted-foreground shrink-0">
                            #{v.vendorId}
                          </span>
                        </button>
                      </li>
                    );
                  })
                )}
              </ul>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

export function ProductFiltersBar({
  filters,
  onChange,
  onClear,
}: ProductFiltersBarProps) {
  function set<K extends keyof ProductFilters>(key: K, value: ProductFilters[K]) {
    onChange({ ...filters, [key]: value, page: 1 });
  }

  function toggleRecent(next: boolean) {
    if (next) {
      // Use the relative window so saved views / bookmarks don't decay as
      // the calendar advances. Clear every conflicting sale-state filter
      // (date bounds, lastSaleNever, lastSaleOlderThan) so the shortcut
      // can't form an impossible conjunction that returns zero rows.
      onChange({
        ...filters,
        lastSaleWithin: "30d",
        lastSaleDateFrom: "",
        lastSaleDateTo: "",
        lastSaleNever: false,
        lastSaleOlderThan: "",
        page: 1,
      });
    } else {
      onChange({ ...filters, lastSaleWithin: "", page: 1 });
    }
  }

  const recentActive = filters.lastSaleWithin === "30d";
  const activeChips = getProductActiveFilterChips(filters);
  const dateRangeActive = hasFilterText(filters.lastSaleDateFrom) || hasFilterText(filters.lastSaleDateTo);

  return (
    <aside
      className="w-[232px] shrink-0 sticky top-3 self-start max-h-[calc(100vh-24px)] overflow-y-auto rounded-[10px] border border-border bg-card px-3.5 py-3 text-xs shadow-[0_1px_0_color-mix(in_oklch,var(--border)_55%,transparent),0_2px_8px_-2px_color-mix(in_oklch,var(--foreground)_6%,transparent)]"
      aria-label="Product filters"
    >
      <div className="flex items-center justify-between mb-1">
        <div className="text-xs font-semibold text-foreground">Filters</div>
        <button
          onClick={onClear}
          className="bg-transparent border-none text-muted-foreground text-[11px] cursor-pointer p-0 hover:text-foreground"
          type="button"
        >
          Clear
        </button>
      </div>

      {activeChips.length > 0 ? (
        <div aria-label="Active filters" className="mb-2 flex flex-wrap gap-1.5">
          {activeChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={() => onChange({ ...filters, ...chip.clearPatch, page: 1 })}
              aria-label={`Clear ${chip.label} filter`}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-2 py-1 text-[10.5px] font-medium text-foreground transition-colors hover:border-muted-foreground/60 hover:bg-accent"
            >
              <span>{chip.label}</span>
              <XIcon className="size-3 text-muted-foreground" aria-hidden="true" />
            </button>
          ))}
        </div>
      ) : null}

      <SectionTitle>Price range</SectionTitle>
      <div className="flex gap-1.5">
        <RailInput
          ariaLabel="Minimum price"
          value={filters.minPrice}
          onChange={(v) => set("minPrice", v)}
          placeholder="Min"
          mono
          type="number"
          inputMode="decimal"
        />
        <RailInput
          ariaLabel="Maximum price"
          value={filters.maxPrice}
          onChange={(v) => set("maxPrice", v)}
          placeholder="Max"
          mono
          type="number"
          inputMode="decimal"
        />
      </div>

      <SectionTitle>Data quality</SectionTitle>
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-1.5">
          <div className="flex-1">
            <ToggleRow
              label="Has stock on hand"
              checked={filters.minStock === "1"}
              onChange={(v) => set("minStock", v ? "1" : "")}
            />
          </div>
          {filters.minStock === "1" ? (
            <span
              className="shrink-0 text-[9.5px] font-semibold tracking-[0.02em] text-muted-foreground/70"
              title="Default filter applied on fresh page loads. Uncheck to see everything."
            >
              default
            </span>
          ) : null}
        </div>
        <ToggleRow
          label="Has barcode"
          checked={filters.hasBarcode}
          onChange={(v) => set("hasBarcode", v)}
        />
        {filters.tab === "textbooks" ? (
          <ToggleRow
            label="Has ISBN"
            checked={filters.hasIsbn}
            onChange={(v) => set("hasIsbn", v)}
          />
        ) : null}
        <ToggleRow
          label="Sold in last 30 days"
          checked={recentActive}
          onChange={toggleRecent}
        />
      </div>

      <SectionTitle>Vendor</SectionTitle>
      <VendorSelect
        value={filters.vendorId}
        onChange={(v) => set("vendorId", v)}
      />

      <SectionTitle>Last sale</SectionTitle>
      <div
        className={`flex flex-col gap-1.5 rounded-lg border px-2 py-2 transition-colors ${
          dateRangeActive
            ? "border-primary/35 bg-primary/[0.04]"
            : "border-border/70 bg-secondary/25"
        }`}
      >
        <p className="text-[10.5px] leading-4 text-muted-foreground">
          Type or pick exact dates to narrow the last-sale window.
        </p>
        <RailInput
          ariaLabel="Last sale from"
          value={filters.lastSaleDateFrom}
          onChange={(v) => set("lastSaleDateFrom", v)}
          placeholder="From"
          type="date"
        />
        <RailInput
          ariaLabel="Last sale to"
          value={filters.lastSaleDateTo}
          onChange={(v) => set("lastSaleDateTo", v)}
          placeholder="To"
          type="date"
        />
        {dateRangeActive ? (
          <p className="text-[10.5px] font-medium leading-4 text-primary">
            Date range active
          </p>
        ) : null}
      </div>

      {filters.tab === "textbooks" ? (
        <>
          <SectionTitle>Textbook</SectionTitle>
          <div className="flex flex-col gap-1.5">
            <RailInput
              ariaLabel="Author"
              value={filters.author}
              onChange={(v) => set("author", v)}
              placeholder="Author"
            />
            <RailInput
              ariaLabel="Edition"
              value={filters.edition}
              onChange={(v) => set("edition", v)}
              placeholder="Edition"
            />
          </div>
        </>
      ) : null}

      {filters.tab === "merchandise" ? (
        <>
          <SectionTitle>Merchandise</SectionTitle>
          <div className="flex flex-col gap-1.5">
            <RailInput
              ariaLabel="Catalog number"
              value={filters.catalogNumber}
              onChange={(v) => set("catalogNumber", v)}
              placeholder="Catalog #"
              mono
            />
            <RailInput
              ariaLabel="Product type"
              value={filters.productType}
              onChange={(v) => set("productType", v)}
              placeholder="Product type"
            />
          </div>
        </>
      ) : null}
    </aside>
  );
}
