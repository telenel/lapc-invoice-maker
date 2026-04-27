"use client";

import { GripVerticalIcon, PackageIcon, Trash2Icon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Density } from "../types";
import type { InvoiceItem } from "@/components/invoice/hooks/use-invoice-form-state";
import type { QuoteItem } from "@/components/quote/quote-form";

type AnyItem = InvoiceItem | QuoteItem;

interface Props {
  items: AnyItem[];
  marginEnabled: boolean;
  taxEnabled: boolean;
  marginPercent: number;
  density: Density;
  onUpdate: (index: number, patch: Partial<AnyItem>) => void;
  onRemove: (index: number) => void;
}

const DENSITY_CLASS: Record<Density, string> = {
  compact: "composer-density-compact",
  standard: "composer-density-standard",
  comfortable: "composer-density-comfortable",
};

function chargedFor(item: AnyItem, marginEnabled: boolean, marginPercent: number): number {
  if (!marginEnabled || marginPercent <= 0) return Number(item.unitPrice);
  const cost = item.costPrice ?? item.unitPrice;
  const m = item.marginOverride ?? marginPercent;
  return Math.round(Number(cost) * (1 + Number(m) / 100) * 100) / 100;
}

export function LineItemsTable({ items, marginEnabled, taxEnabled, marginPercent, density, onUpdate, onRemove }: Props) {
  return (
    <div className="rounded-lg border border-border-strong overflow-hidden bg-background">
      <table className={cn("w-full text-[13px]", DENSITY_CLASS[density])}>
        <thead className="bg-muted text-muted-foreground">
          <tr className="text-left text-[10.5px] font-mono uppercase tracking-wider">
            <th className="w-9 px-2 py-2">#</th>
            <th className="w-[110px] px-2 py-2">SKU</th>
            <th className="px-2 py-2">Description</th>
            <th className="w-[64px] px-2 py-2 text-right">Qty</th>
            <th className="w-[84px] px-2 py-2 text-right">Cost</th>
            <th className="w-[84px] px-2 py-2 text-right">Charged</th>
            {marginEnabled && <th className="w-[70px] px-2 py-2 text-right">Margin</th>}
            {taxEnabled && <th className="w-[50px] px-2 py-2 text-center">Tax</th>}
            <th className="w-[96px] px-2 py-2 text-right">Extended</th>
            <th className="w-8 px-2 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, idx) => {
            const rowNum = String(idx + 1).padStart(2, "0");
            const fromCatalog = it.sku != null;
            const charged = chargedFor(it, marginEnabled, marginPercent);
            const ext = charged * Number(it.quantity);
            const descEmpty = !it.description.trim();
            const qtyInvalid = Number(it.quantity) <= 0;
            return (
              <tr key={it._key} className={cn("border-t border-border", (descEmpty || qtyInvalid) && "bg-destructive/[0.04]")}>
                <td className="px-2 align-middle">
                  <div className="flex items-center gap-1 text-muted-foreground/50">
                    <GripVerticalIcon className="size-3.5 opacity-40" />
                    <span className="font-mono text-[11px] tabular-nums">{rowNum}</span>
                  </div>
                </td>
                <td className="px-2">
                  <div className="flex items-center gap-1">
                    {fromCatalog && <PackageIcon className="size-3.5 text-teal" />}
                    <input aria-label={`SKU row ${idx + 1}`} value={it.sku ?? ""} onChange={(e) => onUpdate(idx, { sku: e.target.value || null })} className="w-full bg-transparent font-mono text-[12.5px] tabular-nums focus:outline-none" />
                  </div>
                </td>
                <td className="px-2">
                  <input aria-label={`Description row ${idx + 1}`} value={it.description} onChange={(e) => onUpdate(idx, { description: e.target.value.toUpperCase() })} className={cn("w-full bg-transparent uppercase focus:outline-none", descEmpty && "bg-destructive/[0.05]")} />
                </td>
                <td className="px-2 text-right">
                  <input aria-label={`Qty row ${idx + 1}`} type="number" min={0} value={it.quantity} onChange={(e) => onUpdate(idx, { quantity: Number(e.target.value) })} className={cn("w-full bg-transparent text-right tabular-nums focus:outline-none", qtyInvalid && "bg-destructive/[0.05]")} />
                </td>
                <td className="px-2 text-right">
                  <input aria-label={`Cost row ${idx + 1}`} type="number" step="0.01" min={0} value={it.costPrice ?? it.unitPrice} onChange={(e) => { const v = Number(e.target.value); if (marginEnabled) onUpdate(idx, { costPrice: v }); else onUpdate(idx, { unitPrice: v, costPrice: null }); }} className="w-full bg-transparent text-right tabular-nums text-muted-foreground focus:outline-none" />
                </td>
                <td className="px-2 text-right">
                  {marginEnabled ? (
                    <span className="tabular-nums text-[12.5px]">{charged.toFixed(2)}</span>
                  ) : (
                    <input aria-label={`Charged row ${idx + 1}`} type="number" step="0.01" min={0} value={it.unitPrice} onChange={(e) => onUpdate(idx, { unitPrice: Number(e.target.value) })} className="w-full bg-transparent text-right tabular-nums focus:outline-none" />
                  )}
                </td>
                {marginEnabled && (
                  <td className="px-2 text-right">
                    <span className={cn("tabular-nums text-[12.5px]", it.marginOverride != null && "text-info")}>
                      {((it.marginOverride ?? marginPercent)).toFixed(1)}%{it.marginOverride != null && " •"}
                    </span>
                  </td>
                )}
                {taxEnabled && (
                  <td className="px-2 text-center">
                    <button type="button" aria-label={`Toggle tax row ${idx + 1}`} onClick={() => onUpdate(idx, { isTaxable: !it.isTaxable })} className={cn("rounded px-1.5 py-0.5 text-[10px] font-mono uppercase", it.isTaxable ? "bg-positive-bg text-positive" : "text-muted-foreground")}>
                      {it.isTaxable ? "TAX" : "—"}
                    </button>
                  </td>
                )}
                <td className="px-2 text-right font-bold tabular-nums">{ext.toFixed(2)}</td>
                <td className="px-2 text-right">
                  <button type="button" aria-label={`Remove row ${idx + 1}`} onClick={() => onRemove(idx)} className="text-muted-foreground hover:text-destructive">
                    <Trash2Icon className="size-4" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
