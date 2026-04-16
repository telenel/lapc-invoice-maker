# Product Search Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persistent product search panel to invoice/quote creation forms, with SKU column on line items and product-to-line-item auto-fill.

**Architecture:** Two-column layout (form left, product panel right) at `max-w-7xl`. The product panel reuses existing Supabase query infrastructure (`searchProducts`, `useProductSearch`, `useProductSelection`). Line items gain an editable SKU column. QuickPicks remain untouched (deferred removal).

**Tech Stack:** Next.js 14, React, Tailwind CSS, Supabase (PostgREST), Framer Motion, shadcn/ui

**Spec:** `docs/superpowers/specs/2026-04-16-product-search-integration-design.md`

---

## File Structure

### New Files
- `src/components/shared/product-search-panel.tsx` — Persistent product search panel (search, tabs, list, multi-select, add button)

### Modified Files
- `src/components/invoice/hooks/use-invoice-form-state.ts` — Add `sku` to `InvoiceItem`, add `addItems` batch method
- `src/components/quote/quote-form.ts` — Add `sku` to `QuoteItem`, add `addItems` batch method
- `src/components/invoice/line-items.tsx` — Add SKU column, replace `InlineCombobox` with plain `Input`
- `src/components/invoice/keyboard-mode.tsx` — Remove `max-w-2xl`, wire `addItems` for product panel
- `src/components/quote/quote-mode.tsx` — Remove equivalent constraint, wire `addItems` for product panel
- `src/app/invoices/new/page.tsx` — Widen to `max-w-7xl`, two-column grid, render `ProductSearchPanel`
- `src/app/quotes/new/page.tsx` — Same layout changes
- `src/components/invoice/hooks/use-invoice-save.ts` — Include `sku` in save payload
- `src/domains/invoice/types.ts` — Add `sku` to `CreateLineItemInput`
- `src/domains/quote/types.ts` — Add `sku` to `CreateLineItemInput`

---

### Task 1: Add SKU to Form State Interfaces

**Files:**
- Modify: `src/components/invoice/hooks/use-invoice-form-state.ts:11-25` (InvoiceItem interface)
- Modify: `src/components/invoice/hooks/use-invoice-form-state.ts:82-94` (emptyItem helper)
- Modify: `src/components/quote/quote-form.ts:15-26` (QuoteItem interface)
- Modify: `src/components/quote/quote-form.ts:75-87` (emptyItem helper)
- Modify: `src/domains/invoice/types.ts:78-86` (CreateLineItemInput)
- Modify: `src/domains/quote/types.ts:144-149` (CreateLineItemInput)

- [ ] **Step 1: Add `sku` to `InvoiceItem` interface**

In `src/components/invoice/hooks/use-invoice-form-state.ts`, add `sku` field to the `InvoiceItem` interface:

```typescript
export interface InvoiceItem {
  /** Stable client-side key for React reconciliation (not persisted) */
  _key: string;
  /** Product SKU from inventory database (null for manually-typed items) */
  sku: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  extendedPrice: number;
  sortOrder: number;
  /** Whether this item is subject to sales tax */
  isTaxable: boolean;
  /** Per-item margin override percentage */
  marginOverride: number | null;
  /** Original cost price before margin */
  costPrice: number | null;
}
```

- [ ] **Step 2: Update `emptyItem` helper for invoice**

In the same file, add `sku: null` to the `emptyItem` function:

```typescript
export function emptyItem(sortOrder = 0): InvoiceItem {
  return {
    _key: crypto.randomUUID(),
    sku: null,
    description: "",
    quantity: 1,
    unitPrice: 0,
    extendedPrice: 0,
    sortOrder,
    isTaxable: true,
    marginOverride: null,
    costPrice: null,
  };
}
```

- [ ] **Step 3: Add `sku` to `QuoteItem` interface**

In `src/components/quote/quote-form.ts`, add `sku` field to `QuoteItem`:

```typescript
export interface QuoteItem {
  /** Stable client-side key for React reconciliation (not persisted) */
  _key: string;
  /** Product SKU from inventory database (null for manually-typed items) */
  sku: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  extendedPrice: number;
  sortOrder: number;
  isTaxable: boolean;
  marginOverride: number | null;
  costPrice: number | null;
}
```

- [ ] **Step 4: Update `emptyItem` helper for quote**

In the same file, add `sku: null` to the quote's `emptyItem` function:

```typescript
function emptyItem(sortOrder = 0): QuoteItem {
  return {
    _key: crypto.randomUUID(),
    sku: null,
    description: "",
    quantity: 1,
    unitPrice: 0,
    extendedPrice: 0,
    sortOrder,
    isTaxable: true,
    marginOverride: null,
    costPrice: null,
  };
}
```

- [ ] **Step 5: Add `sku` to invoice `CreateLineItemInput`**

In `src/domains/invoice/types.ts`, add `sku` to `CreateLineItemInput`:

```typescript
export interface CreateLineItemInput {
  description: string;
  quantity: number;
  unitPrice: number;
  sortOrder?: number;
  isTaxable?: boolean;
  costPrice?: number;
  marginOverride?: number;
  sku?: string | null;
}
```

- [ ] **Step 6: Add `sku` to quote `CreateLineItemInput`**

In `src/domains/quote/types.ts`, add `sku` to `CreateLineItemInput`:

```typescript
export interface CreateLineItemInput {
  description: string;
  quantity: number;
  unitPrice: number;
  sortOrder?: number;
  sku?: string | null;
}
```

- [ ] **Step 7: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No new errors. Existing code that creates items without `sku` still works because it defaults to `null` in `emptyItem` and is optional in `CreateLineItemInput`.

- [ ] **Step 8: Commit**

```bash
git add src/components/invoice/hooks/use-invoice-form-state.ts src/components/quote/quote-form.ts src/domains/invoice/types.ts src/domains/quote/types.ts
git commit -m "feat: add sku field to invoice and quote line item interfaces"
```

---

### Task 2: Add `addItems` Batch Method to Form Hooks

**Files:**
- Modify: `src/components/invoice/hooks/use-invoice-form-state.ts:170-175` (near addItem)
- Modify: `src/components/invoice/hooks/use-invoice-form-state.ts:201` (return statement)
- Modify: `src/components/quote/quote-form.ts:182-187` (near addItem)
- Modify: `src/components/quote/quote-form.ts:484-497` (return statement)

- [ ] **Step 1: Add `addItems` to `useInvoiceFormState`**

In `src/components/invoice/hooks/use-invoice-form-state.ts`, add the batch method right after the existing `addItem` callback (after line 175):

```typescript
const addItems = useCallback(
  (newItems: Partial<InvoiceItem>[]) => {
    setForm((prev) => {
      const startSort = prev.items.length;
      const created = newItems.map((partial, i) => {
        const qty = partial.quantity ?? 1;
        const price = partial.unitPrice ?? 0;
        return {
          _key: crypto.randomUUID(),
          sku: partial.sku ?? null,
          description: partial.description ?? "",
          quantity: qty,
          unitPrice: price,
          extendedPrice: qty * price,
          sortOrder: startSort + i,
          isTaxable: partial.isTaxable ?? true,
          marginOverride: partial.marginOverride ?? null,
          costPrice: partial.costPrice ?? null,
        };
      });
      return { ...prev, items: [...prev.items, ...created] };
    });
  },
  []
);
```

- [ ] **Step 2: Expose `addItems` from hook return**

Update the return statement to include `addItems`:

```typescript
return { form, setForm, updateField, updateItem, addItem, addItems, removeItem, total, itemsWithMargin };
```

- [ ] **Step 3: Add `addItems` to `useQuoteForm`**

In `src/components/quote/quote-form.ts`, add the identical batch method after the existing `addItem` (after line 187):

```typescript
const addItems = useCallback(
  (newItems: Partial<QuoteItem>[]) => {
    setForm((prev) => {
      const startSort = prev.items.length;
      const created = newItems.map((partial, i) => {
        const qty = partial.quantity ?? 1;
        const price = partial.unitPrice ?? 0;
        return {
          _key: crypto.randomUUID(),
          sku: partial.sku ?? null,
          description: partial.description ?? "",
          quantity: qty,
          unitPrice: price,
          extendedPrice: qty * price,
          sortOrder: startSort + i,
          isTaxable: partial.isTaxable ?? true,
          marginOverride: partial.marginOverride ?? null,
          costPrice: partial.costPrice ?? null,
        };
      });
      return { ...prev, items: [...prev.items, ...created] };
    });
  },
  []
);
```

- [ ] **Step 4: Expose `addItems` from quote hook return**

Update the return object (around line 484) to include `addItems`:

```typescript
return {
  form,
  setForm,
  updateField,
  updateItem,
  addItem,
  addItems,
  removeItem,
  total,
  itemsWithMargin,
  handleStaffSelect,
  clearStaffSelection,
  handleStaffEdit,
  staffAccountNumbers,
  saveQuote,
  saving,
  existingId,
};
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors. `addItems` is newly exposed but not yet consumed.

- [ ] **Step 6: Commit**

```bash
git add src/components/invoice/hooks/use-invoice-form-state.ts src/components/quote/quote-form.ts
git commit -m "feat: add addItems batch method to invoice and quote form hooks"
```

---

### Task 3: Add SKU Column to LineItems Component

**Files:**
- Modify: `src/components/invoice/line-items.tsx:21-48` (props interface)
- Modify: `src/components/invoice/line-items.tsx:146-215` (line item row markup)

- [ ] **Step 1: Replace `InlineCombobox` with plain `Input` for description**

In `src/components/invoice/line-items.tsx`, remove the `InlineCombobox` import and the `ComboboxItem` type import (lines 11-12). The `suggestionItems` conversion (lines 73-78) can be removed too since it won't be used.

Replace the description field section (lines 147-177) with a plain `Input` that preserves the Enter-to-qty keyboard behavior:

```tsx
{/* Row 1: SKU + Description with actions */}
<div className="flex gap-2 items-start">
  <Input
    type="text"
    value={item.sku ?? ""}
    onChange={(e) => onUpdate(index, { sku: e.target.value || null })}
    placeholder="SKU"
    className="w-20 h-8 text-xs tabular-nums shrink-0"
    aria-label={`Line item ${index + 1} SKU`}
    tabIndex={-1}
  />
  <div className="flex-1 min-w-0">
    <Input
      type="text"
      value={item.description}
      onChange={(e) => onUpdate(index, { description: e.target.value.toUpperCase() })}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          requestAnimationFrame(() => qtyRefs.current[index]?.focus());
        }
      }}
      placeholder="Item description..."
      className="h-8 text-sm"
      aria-label={`Line item ${index + 1} description`}
    />
  </div>
  <div className="flex items-center gap-0.5 shrink-0">
    {item.description.trim() !== "" && (
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={() => onTogglePick?.(item.description, item.unitPrice, department)}
        className={cn(
          hasPickMatch(userPickDescriptions, item.description)
            ? "text-amber-500 hover:text-amber-600"
            : "text-muted-foreground hover:text-foreground"
        )}
        aria-label={
          hasPickMatch(userPickDescriptions, item.description)
            ? "Remove from quick picks"
            : "Save to quick picks"
        }
      >
        <Star
          className="h-3.5 w-3.5"
          fill={hasPickMatch(userPickDescriptions, item.description) ? "currentColor" : "none"}
          aria-hidden="true"
        />
      </Button>
    )}
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      onClick={() => onRemove(index)}
      disabled={items.length === 1}
      className="text-destructive hover:text-destructive"
      aria-label={`Remove line item ${index + 1}`}
    >
      x
    </Button>
  </div>
</div>
```

- [ ] **Step 2: Remove InlineCombobox import and suggestion conversion**

At the top of `line-items.tsx`, remove:
```typescript
import { InlineCombobox } from "@/components/ui/inline-combobox";
import type { ComboboxItem } from "@/components/ui/inline-combobox";
```

Remove the `suggestionItems` conversion block inside the component:
```typescript
// DELETE this block
const suggestionItems: ComboboxItem[] = suggestions.map((s) => ({
  id: s.description,
  label: s.description,
  sublabel: `$${Number(s.unitPrice).toFixed(2)}`,
  searchValue: s.description,
}));
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: May show warnings about unused `suggestions` prop — that's fine, it's still accepted for QuickPicks compatibility but no longer consumed by InlineCombobox.

- [ ] **Step 4: Commit**

```bash
git add src/components/invoice/line-items.tsx
git commit -m "feat: add SKU column and replace InlineCombobox with plain Input in line items"
```

---

### Task 4: Create ProductSearchPanel Component

**Files:**
- Create: `src/components/shared/product-search-panel.tsx`

- [ ] **Step 1: Create the product search panel**

Create `src/components/shared/product-search-panel.tsx`:

```tsx
"use client";

import { useState, useCallback, useEffect, useDeferredValue, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { searchProducts } from "@/domains/product/queries";
import { TABS, EMPTY_FILTERS, PAGE_SIZE } from "@/domains/product/constants";
import type { Product, ProductTab, ProductFilters, SelectedProduct } from "@/domains/product/types";
import { SearchIcon, PackageIcon, Loader2Icon } from "lucide-react";

function productToSelected(product: Product): SelectedProduct {
  return {
    sku: product.sku,
    description: (product.title ?? product.description ?? "").toUpperCase(),
    retailPrice: Number(product.retail_price),
    cost: Number(product.cost),
    barcode: product.barcode,
    author: product.author,
    title: product.title,
    isbn: product.isbn,
    edition: product.edition,
    catalogNumber: product.catalog_number,
    vendorId: product.vendor_id,
    itemType: product.item_type,
  };
}

interface ProductSearchPanelProps {
  onAddProducts: (products: SelectedProduct[]) => void;
}

export function ProductSearchPanel({ onAddProducts }: ProductSearchPanelProps) {
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [tab, setTab] = useState<ProductTab>("textbooks");
  const [selected, setSelected] = useState<Map<number, SelectedProduct>>(new Map());
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Fetch products — resets on search/tab change, appends on page change
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const filters: ProductFilters = {
      ...EMPTY_FILTERS,
      search: deferredSearch,
      tab,
      page,
    };

    searchProducts(filters)
      .then((result) => {
        if (cancelled) return;
        if (page === 1) {
          setProducts(result.products);
        } else {
          setProducts((prev) => [...prev, ...result.products]);
        }
        setTotal(result.total);
      })
      .catch(() => {
        if (cancelled) return;
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [deferredSearch, tab, page]);

  const hasMore = products.length < total;

  const toggleProduct = useCallback((product: Product) => {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(product.sku)) {
        next.delete(product.sku);
      } else {
        next.set(product.sku, productToSelected(product));
      }
      return next;
    });
  }, []);

  function handleAdd() {
    const items = Array.from(selected.values());
    if (items.length === 0) return;
    onAddProducts(items);
    setSelected(new Map());
  }

  function handleTabChange(newTab: ProductTab) {
    setTab(newTab);
    setPage(1);
    setProducts([]);
  }

  function handleSearchChange(value: string) {
    setSearch(value);
    setPage(1);
    setProducts([]);
  }

  function getDisplayName(product: Product): string {
    if (product.item_type === "textbook" && product.title) {
      return product.title.toUpperCase();
    }
    return (product.description ?? "").toUpperCase();
  }

  function getSubtitle(product: Product): string {
    if (product.item_type === "textbook") {
      const parts: string[] = [];
      if (product.author) parts.push(product.author);
      if (product.edition) parts.push(`${product.edition} ed.`);
      if (product.isbn) parts.push(`ISBN ${product.isbn}`);
      return parts.join(" · ");
    }
    const parts: string[] = [];
    if (product.catalog_number) parts.push(`Cat# ${product.catalog_number}`);
    if (product.product_type) parts.push(product.product_type);
    return parts.join(" · ");
  }

  return (
    <div className="flex flex-col rounded-xl border border-border bg-card">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-border/60">
        <div className="flex items-center gap-2 mb-3">
          <PackageIcon className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold tracking-tight">Product Catalog</h3>
          {selected.size > 0 && (
            <span className="ml-auto text-xs font-medium text-primary tabular-nums">
              {selected.size} selected
            </span>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search SKU, name, ISBN, barcode..."
            className="pl-8 h-8 text-sm"
            tabIndex={-1}
          />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-2">
          {TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => handleTabChange(t.value)}
              className={cn(
                "px-3 py-1 text-xs font-medium rounded-md transition-colors",
                tab === t.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              )}
              tabIndex={-1}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Product list */}
      <div className="flex-1 overflow-y-auto max-h-[500px] p-2 space-y-1">
        {loading && products.length === 0 && (
          <div className="flex items-center justify-center py-8">
            <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && products.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-8">
            {search ? "No products match your search" : "No products found"}
          </p>
        )}

        {products.map((product) => {
          const isChecked = selected.has(product.sku);
          return (
            <button
              key={product.sku}
              type="button"
              onClick={() => toggleProduct(product)}
              className={cn(
                "w-full text-left px-3 py-2 rounded-lg transition-colors flex items-start gap-2.5",
                isChecked
                  ? "bg-primary/10 border border-primary/30"
                  : "hover:bg-muted/50 border border-transparent"
              )}
              tabIndex={-1}
            >
              <Checkbox
                checked={isChecked}
                className="mt-0.5 pointer-events-none"
                tabIndex={-1}
              />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium truncate">
                  {getDisplayName(product)}
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-2">
                  <span className="tabular-nums">SKU {product.sku}</span>
                  <span className="tabular-nums font-medium">
                    ${Number(product.retail_price).toFixed(2)}
                  </span>
                </div>
                {getSubtitle(product) && (
                  <div className="text-[10px] text-muted-foreground/70 truncate mt-0.5">
                    {getSubtitle(product)}
                  </div>
                )}
              </div>
            </button>
          );
        })}

        {/* Load more */}
        {hasMore && !loading && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setPage((p) => p + 1)}
            className="w-full text-xs mt-2"
            tabIndex={-1}
          >
            Load more ({total - products.length} remaining)
          </Button>
        )}
        {loading && products.length > 0 && (
          <div className="flex items-center justify-center py-2">
            <Loader2Icon className="size-3.5 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Add button */}
      <div className="px-4 py-3 border-t border-border/60">
        <Button
          type="button"
          onClick={handleAdd}
          disabled={selected.size === 0}
          className="w-full"
          size="sm"
          tabIndex={-1}
        >
          {selected.size === 0
            ? "Select products to add"
            : `Add ${selected.size} Selected`}
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors. Component is created but not yet rendered anywhere.

- [ ] **Step 3: Commit**

```bash
git add src/components/shared/product-search-panel.tsx
git commit -m "feat: create ProductSearchPanel shared component"
```

---

### Task 5: Widen Layout and Wire Product Panel to Invoice Form

**Files:**
- Modify: `src/app/invoices/new/page.tsx:80-96`
- Modify: `src/components/invoice/keyboard-mode.tsx:381` (remove max-w-2xl)
- Modify: `src/components/invoice/keyboard-mode.tsx` (accept and use `addItems` prop)

- [ ] **Step 1: Update invoice `new/page.tsx` layout**

In `src/app/invoices/new/page.tsx`, update the return JSX to a two-column grid layout and import `ProductSearchPanel`. Also update `readCatalogItems` to include `sku` and `costPrice`:

The `readCatalogItems` function (lines 14-29) should map `sku` and `costPrice`:

```typescript
function readCatalogItems(): { sku: string; description: string; quantity: number; unitPrice: number; costPrice: number }[] | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = sessionStorage.getItem(CATALOG_ITEMS_STORAGE_KEY);
    if (!raw) return undefined;
    sessionStorage.removeItem(CATALOG_ITEMS_STORAGE_KEY);
    const items = JSON.parse(raw) as SelectedProduct[];
    return items.map((item) => ({
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
```

Update the `initial` useMemo to include `sku` and `costPrice` in each item:

```typescript
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
```

Update the register-print handler's items map to use `item.sku` instead of `null`:

```typescript
items: form.items.map((item) => ({
  description: item.description,
  quantity: item.quantity,
  unitPrice: item.unitPrice,
  extendedPrice: item.extendedPrice,
  sku: item.sku ?? null,
})),
```

Update the return JSX to use two-column grid with the product panel:

```tsx
return (
  <div className="mx-auto max-w-7xl px-0 py-4 sm:px-4 sm:py-8">
    <div className="page-enter page-enter-1 mb-5 sm:mb-7 flex items-start justify-between">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">New Invoice</h1>
        <p className="mt-1 text-sm text-muted-foreground">Fill in the details below to create an invoice</p>
      </div>
      {invoiceForm.form.items.length > 0 && (
        <Button variant="outline" size="sm" onClick={handlePrintForRegister}>
          <PrinterIcon className="size-3.5 mr-1.5" />
          Print for Register
        </Button>
      )}
    </div>
    <div className="page-enter page-enter-2 grid grid-cols-1 lg:grid-cols-[1fr,380px] gap-6 items-start">
      <KeyboardMode {...invoiceForm} />
      <div className="lg:sticky lg:top-8">
        <ProductSearchPanel onAddProducts={invoiceForm.addItems} />
      </div>
    </div>
  </div>
);
```

Add the import at the top:
```typescript
import { ProductSearchPanel } from "@/components/shared/product-search-panel";
```

- [ ] **Step 2: Remove `max-w-2xl` from KeyboardMode**

In `src/components/invoice/keyboard-mode.tsx`, line 381, change:

```typescript
className="keyboard-mode mx-auto max-w-2xl"
```

to:

```typescript
className="keyboard-mode"
```

- [ ] **Step 3: Wire `addItems` into KeyboardMode props**

The `KeyboardMode` component receives its props from the spread `{...invoiceForm}`. Since `addItems` is now returned from `useInvoiceFormState`, it will be available. The `ProductSearchPanel` callback converts `SelectedProduct[]` → calls `addItems` with the mapped items.

Update the `onAddProducts` callback passed to `ProductSearchPanel` in `new/page.tsx`. The `invoiceForm.addItems` expects `Partial<InvoiceItem>[]`, so we need a thin mapper. Add this to `new/page.tsx`:

```typescript
import type { SelectedProduct } from "@/domains/product/types";

function mapProductsToItems(products: SelectedProduct[]) {
  return products.map((p) => ({
    sku: String(p.sku),
    description: p.description.toUpperCase(),
    unitPrice: p.retailPrice,
    costPrice: p.cost,
    quantity: 1,
    isTaxable: true,
  }));
}
```

Then in the JSX:
```tsx
<ProductSearchPanel onAddProducts={(products) => invoiceForm.addItems(mapProductsToItems(products))} />
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/invoices/new/page.tsx src/components/invoice/keyboard-mode.tsx
git commit -m "feat: widen invoice layout and wire product search panel"
```

---

### Task 6: Widen Layout and Wire Product Panel to Quote Form

**Files:**
- Modify: `src/app/quotes/new/page.tsx:88-106`
- Modify: `src/components/quote/quote-mode.tsx` (remove width constraint if present)

- [ ] **Step 1: Update quote `new/page.tsx` layout**

Apply the same changes as Task 5 but for quotes. In `src/app/quotes/new/page.tsx`:

Update `readCatalogItems` to include `sku` and `costPrice` (same as invoice version).

Update the `initial` useMemo to include `sku` and `costPrice`.

Update the register-print handler to use `item.sku ?? null`.

Update the return JSX to two-column grid:

```tsx
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
    <div className="page-enter page-enter-2 grid grid-cols-1 lg:grid-cols-[1fr,380px] gap-6 items-start">
      <QuoteMode {...quoteForm} />
      <div className="lg:sticky lg:top-8">
        <ProductSearchPanel onAddProducts={(products) => quoteForm.addItems(mapProductsToItems(products))} />
      </div>
    </div>
  </div>
);
```

Add imports:
```typescript
import { ProductSearchPanel } from "@/components/shared/product-search-panel";
import type { SelectedProduct } from "@/domains/product/types";
```

Add the same `mapProductsToItems` helper function.

- [ ] **Step 2: Check QuoteMode for width constraints**

In `src/components/quote/quote-mode.tsx`, check if there's a `max-w-2xl` or similar constraint on the root element. If so, remove it (same as KeyboardMode). Search for `mx-auto max-w` in the file.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/quotes/new/page.tsx src/components/quote/quote-mode.tsx
git commit -m "feat: widen quote layout and wire product search panel"
```

---

### Task 7: Update Persistence Paths for SKU

**Files:**
- Modify: `src/components/invoice/hooks/use-invoice-save.ts:46-54` (item serialization)
- Modify: `src/components/quote/quote-form.ts:406-414` (item serialization)

- [ ] **Step 1: Add `sku` to invoice save serialization**

In `src/components/invoice/hooks/use-invoice-save.ts`, update the items mapping (around line 46) to include `sku`:

```typescript
return {
  description: item.description,
  quantity: item.quantity,
  unitPrice: charged,
  sortOrder: item.sortOrder ?? i,
  isTaxable: item.isTaxable,
  marginOverride: item.marginOverride ?? undefined,
  costPrice: form.marginEnabled ? cost : undefined,
  sku: item.sku ?? undefined,
};
```

- [ ] **Step 2: Add `sku` to quote save serialization**

In `src/components/quote/quote-form.ts`, update the items mapping in both `postQuote` and `putQuote` (around line 406) to include `sku`:

```typescript
return {
  description: item.description,
  quantity: item.quantity,
  unitPrice: charged,
  sortOrder: item.sortOrder ?? i,
  isTaxable: item.isTaxable,
  marginOverride: item.marginOverride ?? undefined,
  costPrice: currentForm.marginEnabled ? cost : undefined,
  sku: item.sku ?? undefined,
};
```

Find the `putQuote` function and apply the same change there — it has a similar items mapping.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/invoice/hooks/use-invoice-save.ts src/components/quote/quote-form.ts
git commit -m "feat: include sku in invoice and quote save payloads"
```

---

### Task 8: Update Template Loading to Include SKU

**Files:**
- Modify: `src/components/invoice/keyboard-mode.tsx:417-425` (template item mapping)

- [ ] **Step 1: Add `sku` to template item mapping in KeyboardMode**

In `src/components/invoice/keyboard-mode.tsx`, around line 417 where template items are mapped, add `sku: null` to each mapped item:

```typescript
const newItems = t.items.map((item, idx) => ({
  _key: crypto.randomUUID(),
  sku: null,
  description: item.description,
  quantity: item.quantity,
  unitPrice: item.unitPrice,
  isTaxable: item.isTaxable,
  extendedPrice: item.quantity * item.unitPrice,
  sortOrder: idx,
  marginOverride: item.marginOverride,
  costPrice: item.costPrice ?? null,
}));
```

- [ ] **Step 2: Check QuoteMode for similar template mapping**

Search `src/components/quote/quote-mode.tsx` for template item mapping and add `sku: null` there too if present.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/invoice/keyboard-mode.tsx src/components/quote/quote-mode.tsx
git commit -m "fix: include sku field in template item mapping"
```

---

### Task 9: Visual Verification

- [ ] **Step 1: Start dev server**

Run: `npm run dev`

- [ ] **Step 2: Test invoice creation form**

Navigate to `http://localhost:3000/invoices/new`. Verify:
- Page is wider (max-w-7xl)
- Product search panel is visible on the right
- Search bar works — type a product name, see results
- Textbook/Merchandise tabs switch correctly
- Multi-select checkboxes work
- "Add N Selected" button adds products as line items
- Each line item has an editable SKU column
- SKU is auto-filled from product selection
- Description is ALL CAPS
- Enter on description focuses quantity field
- Tab out of unit price on last row adds new row
- QuickPicks side panel still appears inside line items card

- [ ] **Step 3: Test quote creation form**

Navigate to `http://localhost:3000/quotes/new`. Verify same behavior as invoice form.

- [ ] **Step 4: Test catalog → invoice flow**

Navigate to products page, select some products, click "Create Invoice from Selected". Verify items appear with SKU and costPrice populated.

- [ ] **Step 5: Test saving**

Create an invoice with product-sourced items. Save it. Navigate to the detail page. Verify SKU is persisted and displayed.

- [ ] **Step 6: Commit any fixes**

```bash
git add -A
git commit -m "fix: visual verification fixes for product search integration"
```
