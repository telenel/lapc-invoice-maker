// src/domains/invoice/calculations.ts
import type { CreateLineItemInput } from "./types";

export interface CalculatedLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  extendedPrice: number;
  sortOrder: number;
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
    };
  });
}

export function calculateTotal(items: { extendedPrice: number | unknown }[]): number {
  return items.reduce((sum, item) => sum + Number(item.extendedPrice), 0);
}
