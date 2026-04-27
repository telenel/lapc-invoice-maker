"use client";

import { ChevronDownIcon, ChevronUpIcon, RefreshCwIcon, SlidersHorizontalIcon, XIcon } from "lucide-react";
import { getProductActiveFilterChips } from "@/components/products/product-filters";
import type { ProductFilters } from "@/domains/product/types";

interface Props {
  filters: ProductFilters;
  onChange: (next: ProductFilters) => void;
  onClear: () => void;
  activeViewName?: string | null;
  onClearPreset?: () => void;
  advancedOpen?: boolean;
  onAdvancedToggle?: () => void;
}

const TOGGLE_CHIP_KEYS = new Set([
  "stock",
  "hasBarcode",
  "missingBarcode",
  "lastSaleWithin",
  "editedSinceSync",
  "discontinued",
]);

interface ToggleChipDef {
  id: string;
  label: string;
  tone: "primary" | "warn" | "info" | "danger";
  isActive: (filters: ProductFilters) => boolean;
  apply: (filters: ProductFilters, on: boolean) => Partial<ProductFilters>;
}

const TOGGLE_CHIPS: ToggleChipDef[] = [
  {
    id: "in-stock",
    label: "In stock",
    tone: "primary",
    isActive: (f) => f.minStock === "1" && f.maxStock === "",
    apply: (_, on) =>
      on
        ? { minStock: "1", maxStock: "" }
        : { minStock: "" },
  },
  {
    id: "low-stock",
    label: "Low stock",
    tone: "warn",
    // Low stock: 1..15 on hand. Mutually exclusive with In stock / Out
    // of stock; activating low clears the others.
    isActive: (f) => f.minStock === "1" && f.maxStock === "15",
    apply: (_, on) =>
      on ? { minStock: "1", maxStock: "15" } : { minStock: "1", maxStock: "" },
  },
  {
    id: "out-of-stock",
    label: "Out of stock",
    tone: "danger",
    isActive: (f) => f.maxStock === "0",
    apply: (_, on) =>
      on ? { minStock: "", maxStock: "0" } : { maxStock: "" },
  },
  {
    id: "has-barcode",
    label: "Has barcode",
    tone: "primary",
    isActive: (f) => f.hasBarcode === true,
    apply: (_, on) => ({ hasBarcode: on, ...(on ? { missingBarcode: false } : {}) }),
  },
  {
    id: "missing-barcode",
    label: "Missing barcode",
    tone: "warn",
    isActive: (f) => f.missingBarcode === true,
    apply: (_, on) => ({ missingBarcode: on, ...(on ? { hasBarcode: false } : {}) }),
  },
  {
    id: "sold-30d",
    label: "Sold last 30d",
    tone: "info",
    isActive: (f) => f.lastSaleWithin === "30d",
    apply: (_, on) =>
      on
        ? {
            lastSaleWithin: "30d",
            lastSaleDateFrom: "",
            lastSaleDateTo: "",
            lastSaleNever: false,
            lastSaleOlderThan: "",
          }
        : { lastSaleWithin: "" },
  },
  {
    id: "edited-since-sync",
    label: "Edited since sync",
    tone: "info",
    isActive: (f) => f.editedSinceSync === true,
    apply: (_, on) => ({ editedSinceSync: on }),
  },
  {
    id: "discontinued",
    label: "Discontinued",
    tone: "danger",
    isActive: (f) => f.discontinued === "yes",
    apply: (_, on) => ({ discontinued: on ? "yes" : "" }),
  },
];

function isBaseline(filters: ProductFilters): boolean {
  if (filters.minStock !== "1") return false;
  // Any maxStock departs from baseline (low/out-of-stock chips set it).
  if (filters.maxStock !== "") return false;
  const otherChips = getProductActiveFilterChips(filters).filter((chip) => {
    if (chip.key === "stock") return false;
    if (chip.key === "search") return true;
    return true;
  });
  return otherChips.length === 0;
}

function chipClasses(active: boolean, tone: ToggleChipDef["tone"]): string {
  if (!active) {
    return "border-border bg-card text-foreground hover:bg-accent";
  }
  switch (tone) {
    case "primary":
      return "border-primary/35 bg-primary/[0.08] text-primary hover:bg-primary/[0.12]";
    case "warn":
      return "border-amber-500/40 bg-amber-500/[0.10] text-amber-700 hover:bg-amber-500/[0.15]";
    case "info":
      return "border-sky-500/40 bg-sky-500/[0.08] text-sky-700 hover:bg-sky-500/[0.12]";
    case "danger":
      return "border-destructive/40 bg-destructive/[0.06] text-destructive hover:bg-destructive/[0.10]";
  }
}

export function ProductFilterChipBar({
  filters,
  onChange,
  onClear,
  activeViewName,
  onClearPreset,
  advancedOpen,
  onAdvancedToggle,
}: Props) {
  const valueChips = getProductActiveFilterChips(filters).filter(
    (chip) => !TOGGLE_CHIP_KEYS.has(chip.key) && chip.key !== "search",
  );
  const dirty = !isBaseline(filters);

  return (
    <section
      aria-label="Product filter chips"
      className="page-enter page-enter-3 mb-2 flex flex-wrap items-center gap-1.5"
    >
      <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        Filters
      </span>
      <div className="flex flex-1 flex-wrap items-center gap-1.5">

        {TOGGLE_CHIPS.map((def) => {
          const active = def.isActive(filters);
          return (
            <button
              key={def.id}
              type="button"
              aria-pressed={active}
              onClick={() => onChange({ ...filters, ...def.apply(filters, !active), page: 1 })}
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${chipClasses(active, def.tone)}`}
            >
              {def.label}
            </button>
          );
        })}

        {valueChips.length > 0 ? (
          <span className="mx-1 h-4 w-px bg-border" aria-hidden="true" />
        ) : null}

        {valueChips.map((chip) => (
          <button
            key={chip.key}
            type="button"
            onClick={() => onChange({ ...filters, ...chip.clearPatch, page: 1 })}
            aria-label={`Clear ${chip.label} filter`}
            className="inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-secondary px-2.5 py-1 text-[11px] font-medium text-foreground transition-colors hover:border-muted-foreground/60 hover:bg-accent"
          >
            <span className="truncate">{chip.label}</span>
            <XIcon className="size-3 shrink-0 text-muted-foreground" aria-hidden="true" />
          </button>
        ))}

        {activeViewName ? (
          <span className="ml-1 inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/[0.06] px-2.5 py-1 text-[11px] font-medium text-foreground">
            <span className="text-muted-foreground">Preset</span>
            <span className="truncate">{activeViewName}</span>
            {onClearPreset ? (
              <button
                type="button"
                onClick={onClearPreset}
                aria-label={`Clear preset ${activeViewName}`}
                className="-mr-1 inline-flex rounded-sm p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <XIcon className="size-3" aria-hidden="true" />
              </button>
            ) : null}
          </span>
        ) : null}

        <span className="flex-1" />

        {onAdvancedToggle ? (
          <button
            type="button"
            onClick={onAdvancedToggle}
            aria-expanded={advancedOpen}
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
              advancedOpen
                ? "border-border bg-accent text-foreground"
                : "border-border bg-card text-foreground hover:bg-accent"
            }`}
          >
            <SlidersHorizontalIcon className="size-3" aria-hidden="true" />
            Advanced
            {advancedOpen ? (
              <ChevronUpIcon className="size-3" aria-hidden="true" />
            ) : (
              <ChevronDownIcon className="size-3" aria-hidden="true" />
            )}
          </button>
        ) : null}

        {dirty ? (
          <button
            type="button"
            onClick={onClear}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-muted-foreground/60 hover:bg-accent hover:text-foreground"
          >
            <RefreshCwIcon className="size-3" aria-hidden="true" />
            Reset to baseline
          </button>
        ) : null}
      </div>
    </section>
  );
}
