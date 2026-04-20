"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { FileTextIcon, PrinterIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SelectedProduct } from "@/domains/product/types";
import { openBarcodePrintWindow } from "./barcode-print-view";
import { productApi } from "@/domains/product/api-client";
import { PrismWriteConfirmationDialog } from "@/components/products/prism-write-confirmation-dialog";

interface ProductActionBarProps {
  selected: Map<number, SelectedProduct>;
  selectedCount: number;
  onClear: () => void;
  saveToSession: () => void;
  /** When true, the Discontinue action is shown. Only when Prism is reachable. */
  prismAvailable?: boolean;
  /** Called after a successful discontinue so the page can refetch. */
  onDiscontinued?: (skus: number[]) => void;
  onEditClick?: () => void;
  onHardDeleteClick?: () => void;
  onBulkEdit?: () => void;
}

export function ProductActionBar({
  selected,
  selectedCount,
  onClear,
  saveToSession,
  prismAvailable = false,
  onDiscontinued,
  onEditClick,
  onHardDeleteClick,
  onBulkEdit,
}: ProductActionBarProps) {
  const router = useRouter();
  const [discontinuing, setDiscontinuing] = useState(false);
  const [confirmDiscontinueOpen, setConfirmDiscontinueOpen] = useState(false);

  function handleCreateInvoice() {
    saveToSession();
    router.push("/invoices/new?from=catalog");
  }

  function handleCreateQuote() {
    saveToSession();
    router.push("/quotes/new?from=catalog");
  }

  function handlePrintBarcodes() {
    const items = Array.from(selected.values());
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
      onClear();
    } finally {
      setDiscontinuing(false);
    }
  }

  return (
    <AnimatePresence>
      {selectedCount > 0 && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
        >
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">
                {selectedCount} item{selectedCount !== 1 ? "s" : ""} selected
              </span>
              <button
                onClick={onClear}
                className="text-xs text-muted-foreground hover:text-foreground underline"
              >
                Clear
              </button>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={handlePrintBarcodes}>
                <PrinterIcon className="mr-1.5 size-3.5" />
                Print Barcodes
              </Button>
              {prismAvailable ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setConfirmDiscontinueOpen(true)}
                  disabled={discontinuing}
                  className="border-destructive/30 text-destructive hover:bg-destructive/10"
                >
                  <Trash2Icon className="mr-1.5 size-3.5" />
                  {discontinuing ? "Discontinuing…" : "Discontinue"}
                </Button>
              ) : null}
              {prismAvailable && onEditClick ? (
                <Button size="sm" variant="outline" onClick={onEditClick}>
                  Edit
                </Button>
              ) : null}
              {prismAvailable && onBulkEdit ? (
                <Button size="sm" variant="outline" onClick={onBulkEdit}>
                  Bulk Edit
                </Button>
              ) : null}
              {prismAvailable && onHardDeleteClick ? (
                <Button size="sm" variant="outline" onClick={onHardDeleteClick} className="border-destructive/30 text-destructive hover:bg-destructive/10">
                  Delete
                </Button>
              ) : null}
              <Button size="sm" variant="outline" onClick={handleCreateQuote}>
                <FileTextIcon className="mr-1.5 size-3.5" />
                Create Quote
              </Button>
              <Button size="sm" onClick={handleCreateInvoice}>
                <FileTextIcon className="mr-1.5 size-3.5" />
                Create Invoice
              </Button>
            </div>
          </div>
          <PrismWriteConfirmationDialog
            open={confirmDiscontinueOpen}
            onOpenChange={setConfirmDiscontinueOpen}
            title={`Discontinue ${selectedCount} item${selectedCount !== 1 ? "s" : ""}?`}
            description="This changes live Prism/POS inventory state."
            warnings={[
              "This sets fDiscontinue=1 in Prism and hides the item from the POS flow.",
              "This is a live write and cannot be undone from this UI.",
              "Historical invoices and activity are preserved.",
            ]}
            confirmPhrase="DISCONTINUE IN PRISM"
            confirmLabel={discontinuing ? "Discontinuing..." : "Discontinue"}
            confirming={discontinuing}
            onConfirm={handleDiscontinue}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
