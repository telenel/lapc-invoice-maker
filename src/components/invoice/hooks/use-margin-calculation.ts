"use client";

import { useCallback } from "react";

interface MarginItem {
  unitPrice: number;
  costPrice?: number | null;
  marginOverride?: number | null;
}

interface MarginResult {
  costPrice: number;
  chargedPrice: number;
  marginPercent: number;
}

export function useMarginCalculation(globalMarginPercent: number) {
  const calculateMargin = useCallback(
    (item: MarginItem): MarginResult => {
      const effectiveMargin = item.marginOverride ?? globalMarginPercent;
      const cost = item.costPrice ?? item.unitPrice;
      const charged = Math.round(cost * (1 + effectiveMargin / 100) * 100) / 100;
      return {
        costPrice: cost,
        chargedPrice: charged,
        marginPercent: effectiveMargin,
      };
    },
    [globalMarginPercent]
  );

  return { calculateMargin };
}
