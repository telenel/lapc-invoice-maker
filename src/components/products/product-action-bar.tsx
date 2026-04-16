"use client";

import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { FileTextIcon, PrinterIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SelectedProduct } from "@/domains/product/types";
import { CATALOG_ITEMS_STORAGE_KEY } from "@/domains/product/constants";
import { openBarcodePrintWindow } from "./barcode-print-view";

interface ProductActionBarProps {
  selected: Map<number, SelectedProduct>;
  selectedCount: number;
  onClear: () => void;
  saveToSession: () => void;
}

export function ProductActionBar({
  selected,
  selectedCount,
  onClear,
  saveToSession,
}: ProductActionBarProps) {
  const router = useRouter();

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
        </motion.div>
      )}
    </AnimatePresence>
  );
}
