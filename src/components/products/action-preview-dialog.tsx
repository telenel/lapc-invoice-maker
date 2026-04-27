"use client";

import {
  AlertTriangleIcon,
  FileTextIcon,
  PrinterIcon,
  ReceiptIcon,
  SparklesIcon,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { SelectedProduct } from "@/domains/product/types";

export type ActionPreviewKind = "invoice" | "quote" | "barcode" | "quickpick";

interface Props {
  open: boolean;
  kind: ActionPreviewKind;
  items: SelectedProduct[];
  locationLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}

interface ActionConfig {
  title: string;
  confirmLabel: string;
  description: (count: number, location: string) => string;
  icon: React.ReactNode;
  showRetailSum: boolean;
}

const PREVIEW_CAP = 8;

const ACTION_CONFIG: Record<ActionPreviewKind, ActionConfig> = {
  invoice: {
    title: "Create invoice",
    confirmLabel: "Create invoice",
    description: (count, loc) =>
      `Create invoice with ${count} item${count !== 1 ? "s" : ""} using ${loc} pricing.`,
    icon: <ReceiptIcon className="size-4" aria-hidden="true" />,
    showRetailSum: true,
  },
  quote: {
    title: "Create quote",
    confirmLabel: "Create quote",
    description: (count, loc) =>
      `Create quote with ${count} item${count !== 1 ? "s" : ""} using ${loc} pricing.`,
    icon: <FileTextIcon className="size-4" aria-hidden="true" />,
    showRetailSum: true,
  },
  barcode: {
    title: "Print barcodes",
    confirmLabel: "Print barcodes",
    description: (count) =>
      `Send ${count} barcode${count !== 1 ? "s" : ""} to the label printer.`,
    icon: <PrinterIcon className="size-4" aria-hidden="true" />,
    showRetailSum: false,
  },
  quickpick: {
    title: "Save to Quick Picks",
    confirmLabel: "Continue",
    description: (count) =>
      `Add ${count} item${count !== 1 ? "s" : ""} to a Quick Pick list.`,
    icon: <SparklesIcon className="size-4" aria-hidden="true" />,
    showRetailSum: false,
  },
};

function formatMoney(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `$${Number(value).toFixed(2)}`;
}

export function ActionPreviewDialog({
  open,
  kind,
  items,
  locationLabel,
  onCancel,
  onConfirm,
}: Props) {
  const cfg = ACTION_CONFIG[kind];
  const visible = items.slice(0, PREVIEW_CAP);
  const overflow = Math.max(0, items.length - visible.length);

  const missingPriceCount = items.filter((item) => item.retailPrice == null).length;
  const missingBarcodeCount = items.filter((item) => !item.barcode && !item.isbn).length;
  const totalRetail = items.reduce(
    (sum, item) => sum + (item.retailPrice ?? 0),
    0,
  );

  const warnings: Array<{ key: string; label: string }> = [];
  if ((kind === "invoice" || kind === "quote") && missingPriceCount > 0) {
    warnings.push({
      key: "missing-price",
      label: `${missingPriceCount} item${missingPriceCount !== 1 ? "s" : ""} missing price — they'll be skipped or need fixing.`,
    });
  }
  if (kind === "barcode" && missingBarcodeCount > 0) {
    warnings.push({
      key: "missing-barcode",
      label: `${missingBarcodeCount} item${missingBarcodeCount !== 1 ? "s" : ""} missing barcode — those rows will be skipped.`,
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="inline-flex items-center gap-2">
            {cfg.icon}
            {cfg.title}
          </DialogTitle>
          <DialogDescription>{cfg.description(items.length, locationLabel)}</DialogDescription>
        </DialogHeader>

        <div className="rounded-md border border-border bg-secondary/40 p-3">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            Preview
          </div>
          <div className="text-[12px] text-muted-foreground">
            <span className="font-mono tnum text-foreground">{items.length}</span> item
            {items.length !== 1 ? "s" : ""} · location{" "}
            <span className="font-semibold text-foreground">{locationLabel}</span>
            {cfg.showRetailSum ? (
              <>
                {" · Σ retail "}
                <span className="font-mono tnum text-foreground">
                  {formatMoney(totalRetail)}
                </span>
              </>
            ) : null}
          </div>

          {warnings.length > 0 ? (
            <ul className="mt-2 space-y-1">
              {warnings.map((w) => (
                <li
                  key={w.key}
                  className="flex items-start gap-1.5 rounded border border-amber-500/30 bg-amber-500/[0.08] px-2 py-1 text-[11px] text-amber-700"
                >
                  <AlertTriangleIcon className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
                  <span>{w.label}</span>
                </li>
              ))}
            </ul>
          ) : null}

          <ul className="mt-3 max-h-44 divide-y divide-border overflow-y-auto rounded border border-border bg-card text-[11.5px]">
            {visible.map((item) => (
              <li key={item.sku} className="flex items-center gap-2 px-2 py-1">
                <span className="font-mono tnum text-[10.5px] text-muted-foreground">
                  {item.sku}
                </span>
                <span className="min-w-0 flex-1 truncate text-foreground">
                  {item.description}
                </span>
                <span className="font-mono tnum text-[10.5px] text-muted-foreground">
                  {formatMoney(item.retailPrice)}
                </span>
              </li>
            ))}
            {overflow > 0 ? (
              <li className="px-2 py-1 text-[11px] text-muted-foreground">
                +<span className="font-mono tnum">{overflow}</span> more…
              </li>
            ) : null}
          </ul>
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button size="sm" onClick={onConfirm}>
            {cfg.confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
