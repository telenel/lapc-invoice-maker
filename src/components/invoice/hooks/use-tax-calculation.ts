"use client";

import { useMemo, useEffect, useRef } from "react";
import { TAX_RATE } from "@/domains/invoice/constants";
import type { InvoiceItem, InvoiceFormData } from "./use-invoice-form-state";

/**
 * Computes the running total from all line items (sum of extendedPrice).
 * Also auto-updates any "Tax" line items to reflect 9.5% of the non-tax subtotal.
 */
export function useTaxCalculation(
  items: InvoiceItem[],
  setForm: React.Dispatch<React.SetStateAction<InvoiceFormData>>
) {
  const total = useMemo(
    () => items.reduce((sum, item) => sum + Number(item.extendedPrice), 0),
    [items]
  );

  // Prevent re-entrancy when we update the tax items ourselves
  const taxUpdateRef = useRef(false);

  useEffect(() => {
    if (taxUpdateRef.current) {
      taxUpdateRef.current = false;
      return;
    }

    const hasTaxItem = items.some((item) => item.description.includes("Tax"));
    if (!hasTaxItem) return;

    const nonTaxSubtotal = items
      .filter((item) => !item.description.includes("Tax"))
      .reduce((sum, item) => sum + Number(item.extendedPrice), 0);

    const correctTax = Math.round(nonTaxSubtotal * TAX_RATE * 100) / 100;

    let needsUpdate = false;
    const updatedItems = items.map((item) => {
      if (!item.description.includes("Tax")) return item;
      const currentTax = Math.round(Number(item.unitPrice) * 100) / 100;
      if (currentTax === correctTax) return item;
      needsUpdate = true;
      return {
        ...item,
        unitPrice: correctTax,
        extendedPrice: correctTax * item.quantity,
      };
    });

    if (needsUpdate) {
      taxUpdateRef.current = true;
      setForm((prev) => ({ ...prev, items: updatedItems }));
    }
  }, [items, setForm]);

  return { total };
}
