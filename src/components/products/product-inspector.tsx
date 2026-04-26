"use client";

import {
  EditIcon,
  FileTextIcon,
  LockIcon,
  MapPinIcon,
  PrinterIcon,
  ReceiptIcon,
  SparklesIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type {
  ProductBrowseRow,
  ProductLocationId,
  ProductLocationSlice,
} from "@/domains/product/types";

export type InspectorActionKind =
  | "invoice"
  | "quote"
  | "barcode"
  | "quickpick"
  | "edit"
  | "discontinue";

interface Props {
  product: ProductBrowseRow | null;
  primaryLocationId: ProductLocationId | null;
  prismAvailable: boolean;
  onClose: () => void;
  onAction: (kind: InspectorActionKind, product: ProductBrowseRow) => void;
}

function formatMoney(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `$${Number(value).toFixed(2)}`;
}

function formatStock(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return value.toLocaleString("en-US");
}

function formatRelative(date: string | null | undefined): string {
  if (!date) return "never";
  const d = new Date(date);
  if (Number.isNaN(d.getTime()) || d.getFullYear() < 1990) return "never";
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(days / 365);
  return `${years}y ago`;
}

function getStatusLabel(product: ProductBrowseRow, stock: number): {
  label: string;
  toneClass: string;
} {
  if (product.discontinued) {
    return {
      label: "Disc.",
      toneClass: "border-destructive/35 bg-destructive/[0.08] text-destructive",
    };
  }
  if (stock === 0) {
    return {
      label: "Out",
      toneClass: "border-border bg-secondary text-muted-foreground",
    };
  }
  if (stock < 15) {
    return {
      label: "Low",
      toneClass: "border-amber-500/40 bg-amber-500/[0.10] text-amber-700",
    };
  }
  return {
    label: "Active",
    toneClass: "border-emerald-500/35 bg-emerald-500/[0.10] text-emerald-700",
  };
}

function formatDcc(product: Pick<ProductBrowseRow, "dept_num" | "class_num" | "cat_num" | "dept_name" | "class_name" | "cat_name">): string {
  const segs = [product.dept_num, product.class_num, product.cat_num];
  if (!segs.some((n) => n != null)) return "—";
  const num = segs.map((n) => (n != null ? String(n) : "·")).join(".");
  const names = [product.dept_name, product.class_name, product.cat_name]
    .filter((n): n is string => typeof n === "string" && n.length > 0)
    .join(" · ");
  return names ? `${num} · ${names}` : num;
}

function getPrimarySlice(
  product: ProductBrowseRow,
  primaryLocationId: ProductLocationId | null,
): ProductLocationSlice | null {
  if (primaryLocationId == null) return null;
  return (
    product.selected_inventories.find((slice) => slice.locationId === primaryLocationId) ?? null
  );
}

function computeMarginPct(cost: number | null, retail: number | null): string {
  if (cost == null || retail == null || Number.isNaN(cost) || Number.isNaN(retail) || retail <= 0) {
    return "—";
  }
  return `${(((retail - cost) / retail) * 100).toFixed(1)}%`;
}

export function ProductInspector({
  product,
  primaryLocationId,
  prismAvailable,
  onClose,
  onAction,
}: Props) {
  if (!product) {
    return (
      <aside
        aria-label="Product inspector"
        className="hidden w-[320px] shrink-0 sticky top-3 self-start max-h-[calc(100vh-24px)] flex-col rounded-[10px] border border-border bg-card shadow-[0_1px_0_color-mix(in_oklch,var(--border)_55%,transparent),0_2px_8px_-2px_color-mix(in_oklch,var(--foreground)_6%,transparent)] lg:flex"
      >
        <div className="flex h-full flex-col items-center justify-center gap-3 p-5 text-center">
          <span className="inline-flex size-9 items-center justify-center rounded-md bg-accent text-muted-foreground">
            <SparklesIcon className="size-4" aria-hidden="true" />
          </span>
          <div className="text-[12.5px] font-medium">No item focused</div>
          <p className="max-w-[210px] text-[11px] leading-snug text-muted-foreground">
            Click a row to see pricing, stock by location, vendor metadata, and contextual actions.
          </p>
        </div>
      </aside>
    );
  }

  const primarySlice = getPrimarySlice(product, primaryLocationId);
  const cost = primarySlice?.cost ?? product.cost;
  const retail = primarySlice?.retailPrice ?? product.retail_price;
  const stock = primarySlice?.stockOnHand ?? product.stock_on_hand ?? 0;
  const baseRetail = product.retail_price;
  const status = getStatusLabel(product, stock);
  const marginPct = computeMarginPct(cost, retail);
  const lastSaleSource = product.effective_last_sale_date ?? product.last_sale_date_computed ?? product.last_sale_date;

  return (
    <aside
      aria-label="Product inspector"
      className="hidden w-[320px] shrink-0 sticky top-3 self-start max-h-[calc(100vh-24px)] flex-col rounded-[10px] border border-border bg-card shadow-[0_1px_0_color-mix(in_oklch,var(--border)_55%,transparent),0_2px_8px_-2px_color-mix(in_oklch,var(--foreground)_6%,transparent)] lg:flex"
    >
      <div className="flex items-start justify-between gap-2 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-1.5">
            <span className="font-mono tnum text-[11px] text-muted-foreground">{product.sku}</span>
            <span
              className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10.5px] font-medium ${status.toneClass}`}
            >
              <span
                aria-hidden="true"
                className={`size-1.5 rounded-full ${
                  status.label === "Active"
                    ? "bg-emerald-500"
                    : status.label === "Low"
                      ? "bg-amber-500"
                      : status.label === "Out"
                        ? "bg-muted-foreground"
                        : "bg-destructive"
                }`}
              />
              {status.label}
            </span>
          </div>
          <h2 className="text-[14px] font-semibold leading-tight tracking-[-0.01em]">
            {product.description ?? product.title ?? "Untitled item"}
          </h2>
          {product.author || product.edition || product.catalog_number ? (
            <div className="mt-1 text-[11px] text-muted-foreground">
              {[product.author, product.edition, product.catalog_number]
                .filter((part): part is string => typeof part === "string" && part.length > 0)
                .join(" · ")}
            </div>
          ) : null}
        </div>
        <button
          type="button"
          aria-label="Close inspector"
          onClick={onClose}
          className="inline-flex size-7 items-center justify-center rounded-md border border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <XIcon className="size-3.5" aria-hidden="true" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        <SectionLabel>Pricing &amp; margin</SectionLabel>
        <div className="mb-4 grid grid-cols-3 gap-1.5">
          <Stat label="Cost" value={formatMoney(cost)} />
          <Stat label="Retail" value={formatMoney(retail)} emph />
          <Stat label="Margin" value={marginPct} />
        </div>

        <SectionLabel>Stock by location</SectionLabel>
        <div className="mb-4 overflow-hidden rounded-md border border-border bg-secondary/40">
          {product.selected_inventories.map((slice, index) => {
            const isPrimary = slice.locationId === primaryLocationId;
            const variance = baseRetail != null && slice.retailPrice != null && slice.retailPrice !== baseRetail;
            return (
              <div
                key={slice.locationId}
                className={`grid grid-cols-[1fr_auto_auto] items-center gap-2 px-2.5 py-1.5 ${
                  isPrimary
                    ? "border-l-[2px] border-primary bg-primary/[0.04]"
                    : "border-l-[2px] border-transparent"
                } ${index > 0 ? "border-t border-border/70" : ""}`}
              >
                <div className="flex min-w-0 items-center gap-1.5">
                  <MapPinIcon
                    className={`size-3 ${isPrimary ? "text-primary" : "text-muted-foreground"}`}
                    aria-hidden="true"
                  />
                  <span className={`text-[11.5px] ${isPrimary ? "font-semibold" : "font-medium"}`}>
                    {slice.locationAbbrev}
                  </span>
                </div>
                <span
                  className={`font-mono tnum text-[11.5px] ${
                    variance ? "text-amber-600" : "text-muted-foreground"
                  }`}
                  aria-label={variance ? "Price variance" : undefined}
                  title={variance ? `Differs from base ${formatMoney(baseRetail)}` : undefined}
                >
                  {formatMoney(slice.retailPrice)}
                  {variance ? <span aria-hidden="true"> Δ</span> : null}
                </span>
                <span
                  className={`min-w-[42px] text-right font-mono tnum text-[12px] font-semibold ${
                    (slice.stockOnHand ?? 0) === 0 ? "text-muted-foreground" : "text-foreground"
                  }`}
                >
                  {formatStock(slice.stockOnHand)}
                </span>
              </div>
            );
          })}
        </div>

        <SectionLabel>Identifiers &amp; metadata</SectionLabel>
        <dl className="mb-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11.5px]">
          <Meta k="ISBN" v={product.isbn ?? "— missing"} mono warn={!product.isbn && product.item_type === "textbook"} />
          <Meta
            k="Barcode"
            v={product.barcode ?? (product.isbn ? product.isbn : "— missing")}
            mono
            warn={!product.barcode && !product.isbn}
          />
          <Meta k="Vendor" v={product.vendor_id != null ? `#${product.vendor_id}` : "—"} mono />
          <Meta k="DCC" v={formatDcc(product)} mono />
          <Meta k="Tax type" v={product.itemTaxTypeId != null ? String(product.itemTaxTypeId) : "—"} mono />
          <Meta k="Type" v={prettyType(product.item_type)} />
        </dl>

        <SectionLabel>Sales recency &amp; data</SectionLabel>
        <div className="mb-4 grid grid-cols-2 gap-1.5">
          <Stat label="Last sale" value={formatRelative(lastSaleSource)} warn={isStale(lastSaleSource)} />
          <Stat label="Synced" value={formatRelative(product.synced_at)} ok={isFresh(product.synced_at)} />
        </div>

        <SectionLabel>Actions</SectionLabel>
        <div className="flex flex-col gap-1.5">
          <Button
            size="sm"
            variant="outline"
            className="justify-start"
            onClick={() => onAction("invoice", product)}
          >
            <ReceiptIcon className="mr-1.5 size-3.5" aria-hidden="true" />
            Create invoice with this item
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="justify-start"
            onClick={() => onAction("quote", product)}
          >
            <FileTextIcon className="mr-1.5 size-3.5" aria-hidden="true" />
            Create quote with this item
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="justify-start"
            onClick={() => onAction("barcode", product)}
          >
            <PrinterIcon className="mr-1.5 size-3.5" aria-hidden="true" />
            Print barcode
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="justify-start"
            onClick={() => onAction("quickpick", product)}
          >
            <SparklesIcon className="mr-1.5 size-3.5" aria-hidden="true" />
            Save to Quick Picks
          </Button>
          <div className="flex gap-1.5">
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              disabled={!prismAvailable}
              onClick={() => onAction("edit", product)}
            >
              <EditIcon className="mr-1.5 size-3.5" aria-hidden="true" />
              Edit
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1 border-destructive/35 text-destructive hover:bg-destructive/10"
              disabled={!prismAvailable}
              onClick={() => onAction("discontinue", product)}
            >
              <Trash2Icon className="mr-1.5 size-3.5" aria-hidden="true" />
              Discontinue
            </Button>
          </div>
        </div>

        {!prismAvailable ? (
          <div className="mt-3 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/[0.05] px-2.5 py-2 text-[11px] text-destructive">
            <LockIcon className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
            <span>
              <strong>Prism unreachable.</strong> Edit and Discontinue are disabled until Prism is reachable.
            </span>
          </div>
        ) : null}
      </div>
    </aside>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
      {children}
    </div>
  );
}

function Stat({ label, value, emph, warn, ok }: { label: string; value: string; emph?: boolean; warn?: boolean; ok?: boolean }) {
  return (
    <div className="rounded-md border border-border bg-secondary/40 px-2 py-1.5">
      <div className="text-[9.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </div>
      <div
        className={`mt-0.5 font-mono tnum text-[13px] font-semibold tracking-[-0.01em] ${
          warn ? "text-amber-600" : ok ? "text-emerald-600" : emph ? "text-primary" : "text-foreground"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function Meta({ k, v, mono, warn }: { k: string; v: string; mono?: boolean; warn?: boolean }) {
  return (
    <>
      <dt className="text-[11px] text-muted-foreground">{k}</dt>
      <dd
        className={`min-w-0 truncate text-right ${warn ? "text-amber-600" : "text-foreground"} ${mono ? "font-mono tnum text-[11px]" : "text-[11.5px]"}`}
      >
        {v}
      </dd>
    </>
  );
}

function prettyType(itemType: string): string {
  switch (itemType) {
    case "textbook":
      return "Textbook";
    case "used_textbook":
      return "Used textbook";
    case "general_merchandise":
      return "General merchandise";
    case "supplies":
      return "Supplies";
    case "other":
      return "Other";
    default:
      return itemType;
  }
}

function isStale(date: string | null | undefined): boolean {
  if (!date) return true;
  const d = new Date(date);
  if (Number.isNaN(d.getTime()) || d.getFullYear() < 1990) return true;
  return Date.now() - d.getTime() > 90 * 24 * 60 * 60 * 1000;
}

function isFresh(date: string | null | undefined): boolean {
  if (!date) return false;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return false;
  return Date.now() - d.getTime() < 60 * 60 * 1000;
}
