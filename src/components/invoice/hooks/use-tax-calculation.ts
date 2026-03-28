"use client";

import { useMemo } from "react";

interface TaxableItem {
  extendedPrice: number;
  isTaxable: boolean;
}

interface TaxResult {
  subtotal: number;
  taxableAmount: number;
  taxAmount: number;
  total: number;
}

export function useTaxCalculation(
  items: TaxableItem[],
  taxEnabled: boolean,
  taxRate: number
): TaxResult {
  return useMemo(() => {
    const subtotal = items.reduce(
      (sum, item) => sum + Number(item.extendedPrice),
      0
    );

    if (!taxEnabled) {
      return { subtotal, taxableAmount: 0, taxAmount: 0, total: subtotal };
    }

    const taxableAmount = items
      .filter((item) => item.isTaxable)
      .reduce((sum, item) => sum + Number(item.extendedPrice), 0);

    const taxAmount = Math.round(taxableAmount * taxRate * 100) / 100;

    return {
      subtotal,
      taxableAmount,
      taxAmount,
      total: Math.round((subtotal + taxAmount) * 100) / 100,
    };
  }, [items, taxEnabled, taxRate]);
}
