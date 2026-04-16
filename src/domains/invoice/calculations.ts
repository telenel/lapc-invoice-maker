// src/domains/invoice/calculations.ts
import type { CreateLineItemInput } from "./types";

export interface CalculatedLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  extendedPrice: number;
  sortOrder: number;
  isTaxable?: boolean;
  costPrice?: number;
  marginOverride?: number;
  sku?: string | null;
}

export function calculateLineItems(
  items: (CreateLineItemInput & { sortOrder?: number })[]
): CalculatedLineItem[] {
  return items.map((item, index) => {
    const qty = Number(item.quantity);
    const price = Number(item.unitPrice);
    return {
      description: item.description,
      quantity: qty,
      unitPrice: price,
      extendedPrice: qty * price,
      sortOrder: item.sortOrder ?? index,
      isTaxable: item.isTaxable,
      costPrice: item.costPrice,
      marginOverride: item.marginOverride,
      sku: item.sku ?? null,
    };
  });
}

export function calculateTotal(
  items: { extendedPrice: number | unknown; isTaxable?: boolean; marginOverride?: number | null }[],
  marginEnabled?: boolean,
  marginPercent?: number,
  taxEnabled?: boolean,
  taxRate?: number
): number {
  // Compute per-item charged amounts using item-level marginOverride or global marginPercent
  let subtotal = items.reduce((sum, item) => {
    const ext = Number(item.extendedPrice);
    if (!marginEnabled) return sum + ext;
    const effectiveMargin = item.marginOverride != null ? Number(item.marginOverride) : (marginPercent ?? 0);
    return sum + ext * (1 + effectiveMargin / 100);
  }, 0);

  if (taxEnabled) {
    const rate = taxRate ?? 0.0975;
    const taxableTotal = items.reduce((sum, item) => {
      if (item.isTaxable === false) return sum;
      const ext = Number(item.extendedPrice);
      if (!marginEnabled) return sum + ext;
      const effectiveMargin = item.marginOverride != null ? Number(item.marginOverride) : (marginPercent ?? 0);
      return sum + ext * (1 + effectiveMargin / 100);
    }, 0);
    subtotal += taxableTotal * rate;
  }

  return Math.round(subtotal * 100) / 100;
}
