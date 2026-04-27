"use client";

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import type { ComposerTotals, DocType } from "../types";

interface PreviewItem {
  description: string;
  sku?: string | null;
  quantity: number;
  unitPrice: number;
  isTaxable: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  docType: DocType;
  date: string;
  department: string;
  category: string;
  items: PreviewItem[];
  totals: ComposerTotals;
  taxEnabled: boolean;
  taxRate: number;
  signatures: { name: string; title?: string }[];
  notes: string;
  onPrimaryAction: () => void;
}

const fmt = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

export function PreviewDrawer({
  open,
  onOpenChange,
  docType,
  date,
  department,
  category,
  items,
  totals,
  taxEnabled,
  taxRate,
  signatures,
  notes,
  onPrimaryAction,
}: Props) {
  const showSignatures = docType === "invoice" && signatures.some((s) => s.name);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl flex flex-col">
        <SheetHeader>
          <SheetTitle>Preview</SheetTitle>
          <p className="text-[12px] text-muted-foreground">
            Visual preview only. Final PDF is generated on save.
          </p>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto bg-canvas p-6">
          <div className="mx-auto bg-card shadow-rail rounded p-6 max-w-[640px]">
            <div className="border-b-4 border-primary pb-2 mb-4 flex items-baseline justify-between">
              <h2 className="text-primary font-bold tracking-tight">LAPORTAL</h2>
              <span className="text-[12px] text-muted-foreground uppercase">
                {docType === "invoice" ? "Invoice" : "Quote"}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-4 mb-4 text-[12.5px]">
              <div>
                <p className="text-muted-foreground uppercase tracking-wider text-[10px]">Bill to</p>
                <p className="font-semibold">{department}</p>
              </div>
              <div>
                <p className="text-muted-foreground uppercase tracking-wider text-[10px]">Category</p>
                <p>{category}</p>
              </div>
              <div>
                <p className="text-muted-foreground uppercase tracking-wider text-[10px]">Date</p>
                <p>{date}</p>
              </div>
            </div>
            <table className="w-full text-[12.5px] border-t border-border">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="py-1.5">SKU</th>
                  <th className="py-1.5">Description</th>
                  <th className="py-1.5 text-right">Qty</th>
                  <th className="py-1.5 text-right">Price</th>
                  <th className="py-1.5 text-right">Extended</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="py-1.5 font-mono">{it.sku ?? "—"}</td>
                    <td className="py-1.5 uppercase">{it.description}</td>
                    <td className="py-1.5 text-right tabular-nums">{it.quantity}</td>
                    <td className="py-1.5 text-right tabular-nums">{fmt(it.unitPrice)}</td>
                    <td className="py-1.5 text-right tabular-nums">{fmt(it.unitPrice * it.quantity)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-4 ml-auto max-w-[260px] space-y-1 text-[12.5px]">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="tabular-nums">{fmt(totals.subtotal)}</span>
              </div>
              {taxEnabled && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax {(taxRate * 100).toFixed(2)}%</span>
                  <span className="tabular-nums">{fmt(totals.taxAmount)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold border-t border-border pt-1.5">
                <span>Total</span>
                <span className="tabular-nums text-base">{fmt(totals.grandTotal)}</span>
              </div>
            </div>
            {notes && (
              <div className="mt-6 border-t border-border pt-3 text-[12px]">
                <p className="text-muted-foreground uppercase tracking-wider text-[10px] mb-1">Notes</p>
                <p>{notes}</p>
              </div>
            )}
            {showSignatures && (
              <div className="mt-8 grid grid-cols-3 gap-4">
                {signatures.map((s, i) => (
                  <div key={i}>
                    <div className="border-b border-foreground/40 h-8" />
                    <p className="text-[11px] italic mt-1">
                      {s.name}
                      {s.title ? ` — ${s.title}` : ""}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button onClick={onPrimaryAction}>
            {docType === "invoice" ? "Generate PDF" : "Save Quote & Generate PDF"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
