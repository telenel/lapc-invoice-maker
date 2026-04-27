"use client";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { LazyProductSearchPanel } from "@/components/shared/lazy-product-search-panel";
import type { SelectedProduct } from "@/domains/product/types";

function hasRetailPrice(p: SelectedProduct): p is SelectedProduct & { retailPrice: number } {
  return p.retailPrice != null;
}

function mapProductsToItems(products: SelectedProduct[]) {
  return products.filter(hasRetailPrice).map((p) => ({
    sku: String(p.sku),
    description: p.description.toUpperCase(),
    unitPrice: p.retailPrice,
    costPrice: p.cost,
    quantity: 1,
    isTaxable: true,
  }));
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoryFilter?: string;
  onAddItems: (items: ReturnType<typeof mapProductsToItems>) => void;
}

export function CatalogDrawer({ open, onOpenChange, categoryFilter, onAddItems }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Product Catalog{categoryFilter ? ` · ${categoryFilter}` : ""}</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto p-4">
          <LazyProductSearchPanel
            onAddProducts={(products) => {
              onAddItems(mapProductsToItems(products));
              onOpenChange(false);
            }}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
