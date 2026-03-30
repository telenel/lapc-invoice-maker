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
    };
  });
}

export function calculateTotal(
  items: { extendedPrice: number | unknown; isTaxable?: boolean }[],
  marginEnabled?: boolean,
  marginPercent?: number,
  taxEnabled?: boolean,
  taxRate?: number
): number {
  let subtotal = items.reduce((sum, item) => sum + Number(item.extendedPrice), 0);

  if (marginEnabled && marginPercent) {
    subtotal = subtotal * (1 + marginPercent / 100);
  }

  if (taxEnabled) {
    const rate = taxRate ?? 0.0975;
    const taxableTotal = items.reduce((sum, item) => {
      const ext = Number(item.extendedPrice);
      const withMargin = marginEnabled && marginPercent ? ext * (1 + marginPercent / 100) : ext;
      return item.isTaxable !== false ? sum + withMargin : sum;
    }, 0);
    subtotal += taxableTotal * rate;
  }

  return Math.round(subtotal * 100) / 100;
}
