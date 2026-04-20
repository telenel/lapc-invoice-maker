"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { PrinterIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuoteForm } from "@/components/quote/quote-form";
import { QuoteMode } from "@/components/quote/quote-mode";
import { ProductSearchPanel } from "@/components/shared/product-search-panel";
import { openRegisterPrintWindow } from "@/components/shared/register-print-view";
import { CATALOG_ITEMS_STORAGE_KEY } from "@/domains/product/constants";
import type { SelectedProduct } from "@/domains/product/types";
import { formatDateLong as formatDate } from "@/lib/formatters";

function hasRetailPrice(product: SelectedProduct): product is SelectedProduct & { retailPrice: number } {
  return product.retailPrice != null;
}

function readCatalogItems(): { sku: string; description: string; quantity: number; unitPrice: number; costPrice: number | null }[] | undefined {
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

function mapProductsToItems(products: SelectedProduct[]) {
  return products
    .filter(hasRetailPrice)
    .map((p) => ({
    sku: String(p.sku),
    description: p.description.toUpperCase(),
    unitPrice: p.retailPrice,
    costPrice: p.cost,
    quantity: 1,
    isTaxable: true,
    }));
}

export default function NewQuotePage() {
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

  const quoteForm = useQuoteForm(initial);

  function handlePrintForRegister() {
    const { form, itemsWithMargin } = quoteForm;
    if (form.items.length === 0) return;
    const displayItems = form.marginEnabled ? itemsWithMargin : form.items;
    const subtotal = displayItems.reduce((sum, item) => sum + Number(item.extendedPrice), 0);
    const taxRate = form.taxEnabled ? Number(form.taxRate) : 0;
    const taxableTotal = displayItems
      .filter((item) => item.isTaxable)
      .reduce((sum, item) => sum + Number(item.extendedPrice), 0);
    const taxAmount = taxableTotal * taxRate;

    openRegisterPrintWindow({
      documentNumber: "Draft Quote",
      documentType: "Quote",
      status: "DRAFT",
      date: form.date ? formatDate(form.date) : "—",
      staffName: form.contactName || "—",
      department: form.department || "—",
      items: form.items.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        extendedPrice: item.extendedPrice,
        sku: item.sku ?? null,
      })),
      subtotal,
      taxAmount,
      total: subtotal + taxAmount,
    });
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="page-enter page-enter-1 mb-7 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">New Quote</h1>
          <p className="mt-1 text-sm text-muted-foreground">Prepare a quote for your recipient</p>
        </div>
        {quoteForm.form.items.length > 0 && (
          <Button variant="outline" size="sm" onClick={handlePrintForRegister}>
            <PrinterIcon className="size-3.5 mr-1.5" />
            Print for Register
          </Button>
        )}
      </div>
      <div className="page-enter page-enter-2 grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 items-start">
        <div className="order-2 lg:order-1">
          <QuoteMode {...quoteForm} />
        </div>
        <div className="order-1 lg:order-2 lg:sticky lg:top-8">
          <ProductSearchPanel onAddProducts={(products) => quoteForm.addItems(mapProductsToItems(products))} />
        </div>
      </div>
    </div>
  );
}
