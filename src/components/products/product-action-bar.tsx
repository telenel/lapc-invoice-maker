"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  FileTextIcon,
  PrinterIcon,
  SparklesIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SelectedProduct } from "@/domains/product/types";
import { openBarcodePrintWindow } from "./barcode-print-view";
import { productApi } from "@/domains/product/api-client";
import { useVendorDirectory } from "@/domains/product/vendor-directory";

interface ProductActionBarProps {
  selected: Map<number, SelectedProduct>;
  selectedCount: number;
  visibleSelectedCount?: number;
  offPageSelectedCount?: number;
  editPricingItems?: Array<{ retailPrice: number | null; cost: number | null }>;
  onClear: () => void;
  onRemoveSelected?: (sku: number) => void;
  saveToSession: () => void;
  /** When true, the Discontinue action is shown. Only when Prism is reachable. */
  prismAvailable?: boolean;
  /** Called after a successful discontinue so the page can refetch. */
  onDiscontinued?: (skus: number[]) => void;
  onEditClick?: () => void;
  allowMissingEditPricing?: boolean;
  onHardDeleteClick?: () => void;
  onBulkEdit?: () => void;
  /** When true, the floating tray nudges left so it doesn't overlap the inspector pane. */
  inspectorOpen?: boolean;
}

export function ProductActionBar({
  selected,
  selectedCount,
  visibleSelectedCount = selectedCount,
  offPageSelectedCount = 0,
  editPricingItems,
  onClear,
  onRemoveSelected,
  saveToSession,
  prismAvailable = false,
  onDiscontinued,
  onEditClick,
  allowMissingEditPricing = false,
  onHardDeleteClick,
  onBulkEdit,
  inspectorOpen = false,
}: ProductActionBarProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const { byId: vendorNames } = useVendorDirectory();
  const [discontinuing, setDiscontinuing] = useState(false);
  const [selectionOpen, setSelectionOpen] = useState(false);
  const [destructiveOpen, setDestructiveOpen] = useState(false);
  const [deleteWarningOpen, setDeleteWarningOpen] = useState(false);
  const canSaveToQuickPicks = Boolean(session?.user);
  const selectedItems = Array.from(selected.values());
  const editPricingRows = editPricingItems ?? selectedItems;
  const missingRetailPriceCount = selectedItems.filter((item) => item.retailPrice == null).length;
  const missingEditPricingCount = editPricingRows.filter(
    (item) => item.retailPrice == null || item.cost == null,
  ).length;
  const hasMissingRetailPrice = missingRetailPriceCount > 0;
  const hasMissingEditPricing = missingEditPricingCount > 0;
  const editDisabled = !allowMissingEditPricing && hasMissingEditPricing;

  function handleCreateInvoice() {
    saveToSession();
    router.push("/invoices/new?from=catalog");
  }

  function handleCreateQuote() {
    saveToSession();
    router.push("/quotes/new?from=catalog");
  }

  function handleSaveToQuickPicks() {
    const skus = Array.from(selected.keys()).sort((left, right) => left - right);
    if (skus.length === 0) return;

    const query = new URLSearchParams({ skus: skus.join(",") });
    router.push(`/admin/quick-picks?${query.toString()}`);
  }

  function handlePrintBarcodes() {
    const items = Array.from(selected.values()).map((item) => ({
      ...item,
      vendorLabel: item.vendorId != null ? (vendorNames.get(item.vendorId) ?? null) : null,
    }));
    openBarcodePrintWindow(items);
  }

  async function handleDiscontinue() {
    const skus = Array.from(selected.keys());
    if (skus.length === 0) return;

    setDiscontinuing(true);
    try {
      const results = await Promise.allSettled(
        skus.map((sku) => productApi.discontinue(sku)),
      );
      const succeeded = results
        .map((r, i) => (r.status === "fulfilled" ? skus[i] : null))
        .filter((sku): sku is number => sku !== null);
      const failed = results.filter((r) => r.status === "rejected").length;

      if (failed > 0) {
        window.alert(
          `Discontinued ${succeeded.length} of ${skus.length}. ${failed} failed — check the console.`,
        );
        results.forEach((r, i) => {
          if (r.status === "rejected") {
            console.error(`Discontinue SKU ${skus[i]} failed:`, r.reason);
          }
        });
      }

      onDiscontinued?.(succeeded);
      setDestructiveOpen(false);
      setDeleteWarningOpen(false);
      onClear();
    } finally {
      setDiscontinuing(false);
    }
  }

  const formatMoney = (value: number | null | undefined) =>
    value == null || Number.isNaN(value) ? "—" : `$${Number(value).toFixed(2)}`;

  const formatStock = (value: number | null | undefined) =>
    value == null || Number.isNaN(value) ? "—" : value.toLocaleString();

  // Selection-health signals — surfaced as colored chips so the operator
  // sees data-quality / cross-location issues without expanding the panel.
  const totalRetail = selectedItems.reduce(
    (sum, item) => sum + (item.retailPrice ?? 0),
    0,
  );
  const discontinuedCount = selectedItems.filter((item) => item.fDiscontinue === 1).length;
  const missingBarcodeCount = selectedItems.filter(
    (item) => !item.barcode && !item.isbn,
  ).length;
  const locationsTouched = new Set(
    selectedItems.map((item) => item.pricingLocationId).filter((id) => id != null),
  );
  const mixedLocations = locationsTouched.size > 1;
  const previewItems = selectedItems.slice(0, 3);
  const overflowPreview = selectedItems.length - previewItems.length;

  const healthChips: Array<{ key: string; tone: "warn" | "danger" | "info"; label: string }> = [];
  if (hasMissingRetailPrice) {
    healthChips.push({
      key: "missing-price",
      tone: "warn",
      label: `${missingRetailPriceCount} missing price`,
    });
  }
  if (discontinuedCount > 0) {
    healthChips.push({
      key: "discontinued",
      tone: "danger",
      label: `${discontinuedCount} discontinued`,
    });
  }
  if (missingBarcodeCount > 0) {
    healthChips.push({
      key: "missing-barcode",
      tone: "warn",
      label: `${missingBarcodeCount} missing barcode`,
    });
  }
  if (mixedLocations) {
    healthChips.push({
      key: "mixed-locations",
      tone: "info",
      label: `Mixed locations · ${locationsTouched.size}`,
    });
  }
  const trayRight = inspectorOpen ? 16 + 320 + 16 : 16;

  return (
    <AnimatePresence>
      {selectedCount > 0 && (
        <motion.div
          data-testid="selection-tray"
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          style={{ left: 16, right: trayRight, bottom: 16 }}
          className="fixed z-50 overflow-hidden rounded-[10px] border border-border-strong bg-card shadow-[0_16px_40px_-12px_rgba(0,0,0,.22),0_4px_12px_rgba(0,0,0,.08)] supports-[backdrop-filter]:bg-card/95 supports-[backdrop-filter]:backdrop-blur"
        >
          <div className="flex flex-col gap-2 px-4 py-3">
            {/* Top row: count + preview chips + warnings + view items */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex min-w-[26px] items-center justify-center rounded-md bg-primary px-1.5 py-0.5 font-mono tnum text-[11.5px] font-semibold text-primary-foreground">
                  {selectedCount}
                </span>
                <div className="flex flex-col leading-tight">
                  <span className="text-[12.5px] font-semibold">
                    {selectedCount} item{selectedCount !== 1 ? "s" : ""} selected
                  </span>
                  <span className="text-[10.5px] text-muted-foreground">
                    {offPageSelectedCount > 0 ? (
                      <>
                        <span className="font-mono tnum">{visibleSelectedCount}</span> on this page ·{" "}
                        <span className="font-mono tnum font-semibold text-primary">{offPageSelectedCount}</span> on other pages
                        {" · "}
                      </>
                    ) : null}
                    Σ retail{" "}
                    <span className="font-mono tnum text-foreground">${totalRetail.toFixed(2)}</span>
                  </span>
                </div>

                {previewItems.length > 0 ? (
                  <div className="flex items-center gap-1.5">
                    {previewItems.map((item) => (
                      <span
                        key={item.sku}
                        className="inline-flex max-w-[220px] items-center gap-1.5 rounded border border-border bg-secondary px-1.5 py-0.5 text-[11px]"
                      >
                        <span className="font-mono tnum text-[10px] text-muted-foreground">{item.sku}</span>
                        <span className="truncate text-foreground">{item.description}</span>
                      </span>
                    ))}
                    {overflowPreview > 0 ? (
                      <span className="text-[11px] text-muted-foreground">
                        +<span className="font-mono tnum">{overflowPreview}</span> more
                      </span>
                    ) : null}
                  </div>
                ) : null}
                <button
                  type="button"
                  onClick={() => setSelectionOpen((open) => !open)}
                  aria-expanded={selectionOpen}
                  className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {selectionOpen ? (
                    <ChevronDownIcon className="size-3.5" aria-hidden="true" />
                  ) : (
                    <ChevronUpIcon className="size-3.5" aria-hidden="true" />
                  )}
                  View items
                </button>
                <button
                  onClick={onClear}
                  className="text-xs text-muted-foreground hover:text-foreground underline"
                >
                  Clear
                </button>
              </div>

              {/* Health chips */}
              <div className="flex flex-wrap items-center gap-1.5">
                {healthChips.length === 0 ? (
                  <span className="inline-flex items-center gap-1 rounded border border-emerald-500/30 bg-emerald-500/[0.08] px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                    Selection healthy
                  </span>
                ) : (
                  healthChips.map((chip) => {
                    const tone =
                      chip.tone === "danger"
                        ? "border-destructive/35 bg-destructive/[0.08] text-destructive"
                        : chip.tone === "info"
                          ? "border-sky-500/35 bg-sky-500/[0.08] text-sky-700"
                          : "border-amber-500/40 bg-amber-500/[0.10] text-amber-700";
                    return (
                      <span
                        key={chip.key}
                        className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] font-medium ${tone}`}
                      >
                        {chip.label}
                      </span>
                    );
                  })
                )}
              </div>
            </div>

            {/* Action row: grouped by purpose */}
            <div className="flex flex-wrap items-center gap-3">
              <ActionGroup label="CREATE">
                <Button
                  size="sm"
                  onClick={handleCreateInvoice}
                  disabled={hasMissingRetailPrice}
                >
                  <FileTextIcon className="mr-1.5 size-3.5" />
                  Create Invoice
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCreateQuote}
                  disabled={hasMissingRetailPrice}
                >
                  <FileTextIcon className="mr-1.5 size-3.5" />
                  Create Quote
                </Button>
              </ActionGroup>

              <ActionGroup label="OUTPUT">
                <Button size="sm" variant="outline" onClick={handlePrintBarcodes}>
                  <PrinterIcon className="mr-1.5 size-3.5" />
                  Print Barcodes
                </Button>
              </ActionGroup>

              {canSaveToQuickPicks ? (
                <ActionGroup label="ORGANIZE">
                  <Button size="sm" variant="outline" onClick={handleSaveToQuickPicks}>
                    <SparklesIcon className="mr-1.5 size-3.5" />
                    Save to Quick Picks
                  </Button>
                </ActionGroup>
              ) : null}

              <ActionGroup label="MODIFY">
                {prismAvailable && onEditClick ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={onEditClick}
                    disabled={editDisabled}
                  >
                    Edit
                  </Button>
                ) : null}
                {prismAvailable && onBulkEdit ? (
                  <Button size="sm" variant="outline" onClick={onBulkEdit}>
                    Bulk Edit
                  </Button>
                ) : null}
              </ActionGroup>

              {prismAvailable ? (
                <ActionGroup label="ADMIN" tone="danger">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setDestructiveOpen((open) => !open)}
                    disabled={discontinuing}
                    className="border-destructive/30 text-destructive hover:bg-destructive/10"
                  >
                    <Trash2Icon className="mr-1.5 size-3.5" />
                    {discontinuing ? "Discontinuing…" : "Discontinue…"}
                  </Button>
                </ActionGroup>
              ) : null}
            </div>
            {selectionOpen ? (
              <div className="overflow-hidden rounded-md border border-border bg-card">
                <div className="max-h-64 overflow-auto">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead className="sticky top-0 bg-card">
                      <tr className="border-b border-border text-[11px] text-muted-foreground">
                        <th className="px-2 py-1.5 font-medium">SKU</th>
                        <th className="px-2 py-1.5 font-medium">Item</th>
                        <th className="px-2 py-1.5 text-right font-medium">Retail</th>
                        <th className="px-2 py-1.5 text-right font-medium">Cost</th>
                        <th className="px-2 py-1.5 text-right font-medium">Stock</th>
                        <th className="px-2 py-1.5 font-medium">Status</th>
                        <th className="px-2 py-1.5 text-right font-medium">Remove</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedItems.map((item) => (
                        <tr key={item.sku} className="border-b border-border/60 last:border-0">
                          <td className="px-2 py-1.5 font-mono tnum text-[11px]">{item.sku}</td>
                          <td className="min-w-0 px-2 py-1.5">
                            <div className="max-w-[360px] truncate font-medium">{item.description}</div>
                            {item.pricingLocationId != null ? (
                              <div className="font-mono text-[10.5px] text-muted-foreground">
                                Location {item.pricingLocationId}
                              </div>
                            ) : null}
                          </td>
                          <td className="px-2 py-1.5 text-right font-mono tnum">{formatMoney(item.retailPrice)}</td>
                          <td className="px-2 py-1.5 text-right font-mono tnum">{formatMoney(item.cost)}</td>
                          <td className="px-2 py-1.5 text-right font-mono tnum">{formatStock(item.stockOnHand)}</td>
                          <td className="px-2 py-1.5">
                            <span className={`rounded-full border px-1.5 py-0.5 text-[10.5px] font-semibold ${
                              item.fDiscontinue
                                ? "border-amber-500/40 bg-amber-500/10 text-amber-700"
                                : "border-emerald-500/35 bg-emerald-500/10 text-emerald-700"
                            }`}>
                              {item.fDiscontinue ? "Disc" : "Live"}
                            </span>
                          </td>
                          <td className="px-2 py-1.5 text-right">
                            {onRemoveSelected ? (
                              <button
                                type="button"
                                onClick={() => onRemoveSelected(item.sku)}
                                aria-label={`Remove SKU ${item.sku} from selection`}
                                className="inline-flex rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              >
                                <XIcon className="size-3.5" aria-hidden="true" />
                              </button>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
            {destructiveOpen && prismAvailable ? (
              <div className="rounded-md border border-destructive/25 bg-destructive/[0.035] px-3 py-2 text-xs">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 max-w-3xl">
                    <div className="mb-1 flex items-center gap-1.5 font-semibold text-destructive">
                      <AlertTriangleIcon className="size-3.5" aria-hidden="true" />
                      Discontinue selected products
                    </div>
                    <p className="leading-5 text-muted-foreground">
                      This is the recommended action. It marks selected items discontinued in Prism so they are hidden from POS while preserving invoices, sales history, receiving records, and audit context.
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap justify-end gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setDestructiveOpen(false);
                        setDeleteWarningOpen(false);
                      }}
                      disabled={discontinuing}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleDiscontinue}
                      disabled={discontinuing}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {discontinuing ? "Discontinuing…" : `Discontinue ${selectedCount}`}
                    </Button>
                  </div>
                </div>
                {onHardDeleteClick ? (
                  <div className="mt-2 border-t border-destructive/15 pt-2">
                    <button
                      type="button"
                      onClick={() => setDeleteWarningOpen((open) => !open)}
                      aria-expanded={deleteWarningOpen}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground"
                    >
                      {deleteWarningOpen ? "Hide permanent delete option" : "Need permanent delete instead?"}
                    </button>
                    {deleteWarningOpen ? (
                      <div className="mt-2 flex flex-wrap items-start justify-between gap-3 rounded-md border border-destructive/30 bg-background px-3 py-2">
                        <p className="max-w-3xl leading-5 text-muted-foreground">
                          Permanent delete entirely removes the item from the PrismCore database and is not recommended. Deleting can break expectations around old invoices, sales history, receiving records, and other dependencies. Use it only for items that truly should never have existed.
                        </p>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={onHardDeleteClick}
                          className="shrink-0 border-destructive/40 text-destructive hover:bg-destructive/10"
                        >
                          Review permanent delete
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
            {hasMissingRetailPrice || hasMissingEditPricing ? (
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {hasMissingRetailPrice ? (
                  <span>
                    {missingRetailPriceCount} selected item{missingRetailPriceCount !== 1 ? "s are" : " is"} missing retail price, so invoice and quote creation are unavailable.
                  </span>
                ) : null}
                {prismAvailable && onEditClick && editDisabled ? (
                  <span>
                    {missingEditPricingCount} selected item{missingEditPricingCount !== 1 ? "s are" : " is"} missing retail or cost, so edit is unavailable.
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface ActionGroupProps {
  label: string;
  tone?: "default" | "danger";
  children: React.ReactNode;
}

function ActionGroup({ label, tone = "default", children }: ActionGroupProps) {
  // Hide the group entirely when no buttons render — keeps the action row
  // tight on permission-gated layouts (e.g. signed-out users without
  // Quick Picks, or read-only Prism without Edit/Bulk Edit).
  const childArray = Array.isArray(children) ? children : [children];
  const hasContent = childArray.some((c) => c !== null && c !== false && c !== undefined);
  if (!hasContent) return null;
  const labelTone = tone === "danger" ? "text-destructive" : "text-muted-foreground";
  return (
    <div className="flex items-center gap-1.5">
      <span className={`text-[9.5px] font-semibold tracking-[0.08em] ${labelTone}`}>{label}</span>
      {children}
    </div>
  );
}
