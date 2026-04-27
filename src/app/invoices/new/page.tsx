"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useInvoiceForm } from "@/components/invoice/invoice-form";
import { DocumentComposer } from "@/components/composer/document-composer";
import { CATALOG_ITEMS_STORAGE_KEY } from "@/domains/product/constants";
import type { SelectedProduct } from "@/domains/product/types";

function hasRetailPrice(product: SelectedProduct): product is SelectedProduct & { retailPrice: number } {
  return product.retailPrice != null;
}

// Catalog redirect: when users arrive from /products with selected items,
// they're stashed in sessionStorage so we can pre-fill the new invoice's
// items. This is only consumed on the initial mount; subsequent navigation
// resets it. Preserved verbatim from the legacy /invoices/new page.
function readCatalogItems() {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = sessionStorage.getItem(CATALOG_ITEMS_STORAGE_KEY);
    if (!raw) return undefined;
    sessionStorage.removeItem(CATALOG_ITEMS_STORAGE_KEY);
    const items = JSON.parse(raw) as SelectedProduct[];
    return items.filter(hasRetailPrice).map((item) => ({
      sku: String(item.sku),
      description: item.description.toUpperCase(),
      quantity: 1,
      unitPrice: item.retailPrice,
      costPrice: item.cost,
    }));
  } catch {
    return undefined;
  }
}

export default function NewInvoicePage() {
  const searchParams = useSearchParams();
  const fromCatalog = searchParams.get("from") === "catalog";

  const initial = useMemo(() => {
    if (!fromCatalog) return undefined;
    const catalogItems = readCatalogItems();
    if (!catalogItems || catalogItems.length === 0) return undefined;
    return {
      items: catalogItems.map((item, i) => ({
        _key: `catalog-${i}`,
        sku: item.sku,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        extendedPrice: item.quantity * item.unitPrice,
        sortOrder: i,
        isTaxable: true,
        marginOverride: null,
        costPrice: item.costPrice,
      })),
    };
  }, [fromCatalog]);

  const invoiceForm = useInvoiceForm(initial);

  return (
    <DocumentComposer
      composer={{ docType: "invoice", form: invoiceForm }}
      mode="create"
      status="DRAFT"
      canManageActions
    />
  );
}
