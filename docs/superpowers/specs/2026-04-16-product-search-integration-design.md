# Product Search Integration into Invoice/Quote Creation Forms

**Date:** 2026-04-16
**Status:** Design approved, pending implementation

## Summary

Integrate the Supabase product/inventory database directly into the invoice and quote creation forms via a persistent side panel. Users can search, browse, and multi-select products which auto-populate as line items with SKU, description, price, and cost data.

## Goals

- Enable product search and selection from within the creation forms without navigating away
- Utilize the significant unused screen space alongside the narrow form
- Display financial information clearly — favor readability over compactness
- Make SKU a visible, editable field on line items

## Non-Goals

- Inline autocomplete on the description field (panel-only search)
- Quantity selection in the product panel (always adds at qty 1)
- Modifying the products page itself
- Removing QuickPicks (deferred to a separate effort)

---

## 1. Page Layout

### Current State

- Page container: `max-w-5xl` (1024px) centered
- Form: `max-w-2xl` (672px) centered within that via `mx-auto`
- Result: ~350px of dead space, line item descriptions truncated

### New Layout

Widen the page container from `max-w-5xl` to `max-w-7xl` (1280px). Two-column layout:

| Column | Width | Content |
|--------|-------|---------|
| Left | ~60% | Invoice/quote form (remove `max-w-2xl` constraint) |
| Right | ~40% | Product search panel |

The form column gets more breathing room for long descriptions, SKU column, and price fields. The product panel fills the previously dead space.

### Responsive Behavior

- **Desktop (lg+):** Two columns side by side. Product panel uses `sticky top-8` so it stays visible in the viewport as the user scrolls the form.
- **Tablet/mobile (below lg):** Single column. Product panel stacks above the form as a full-width section. Not collapsible — it remains visible, just reflows vertically. The primary use case is desktop.

### Files Changed

- `src/app/invoices/new/page.tsx` — Widen container, add two-column grid wrapper
- `src/app/quotes/new/page.tsx` — Same changes
- `src/components/invoice/keyboard-mode.tsx` — Remove `mx-auto max-w-2xl`
- `src/components/quote/quote-mode.tsx` — Same changes

---

## 2. Product Search Panel

A persistent, always-visible panel that is a mini version of the products page. Not collapsible, not a drawer — it is always present as a core part of the form experience.

### Panel Features

1. **Search bar** — Full-text search on `description` field via Postgres `fts`, plus prefix/ilike matching on: `sku`, `barcode`, `isbn`, `catalog_number`, `title`, `author`. Numeric input auto-detects and searches identifier fields. Reuses `searchProducts()` from `src/domains/product/queries.ts`.

2. **Textbook / Merchandise tabs** — Same two-tab filtering as the products page:
   - Textbooks: `item_type = "textbook"`, shows title, author, ISBN, edition
   - Merchandise: `item_type IN ("general_merchandise", "supplies", "other")`, shows description, catalog number, product type

3. **Scrollable product list** — Each product row displays:
   - Description (or title for textbooks)
   - SKU
   - Retail price
   - Checkbox for multi-select

4. **"Add to Line Items" button** — Adds all checked products as new line items. Button shows count: "Add 3 Selected". Disabled when nothing is selected. Clears selection after adding.

5. **Pagination** — Same page-size (50) as the products page. Uses "Load more" button at the bottom of the scrollable list (simpler than page controls for a side panel).

### Component Design

```
src/components/shared/product-search-panel.tsx
```

Single shared component used by both `KeyboardMode` (invoices) and `QuoteMode` (quotes).

**Props:**
```typescript
interface ProductSearchPanelProps {
  onAddProducts: (products: SelectedProduct[]) => void;
}
```

The parent form handles converting `SelectedProduct[]` into line items via its own batch-insert logic (see Section 4).

### Supabase Query Reuse

The panel calls the same `searchProducts()` function from `src/domains/product/queries.ts` that the products page uses. No query duplication. The panel manages its own local state for: search term, active tab, selected items, pagination offset.

---

## 3. Line Item Changes

### New SKU Column

Add a visible SKU column to the `LineItems` component. The column appears for all line items regardless of source.

| SKU | Description | Qty | Unit Price | Ext. Price |
|-----|-------------|-----|------------|------------|
| 12345 | INTRO TO PSYCHOLOGY | 1 | $89.99 | $89.99 |
| 67890 | PIERCE COLLEGE HOODIE - BLACK | 3 | $29.99 | $89.97 |
| *(empty)* | CUSTOM HAND-TYPED ITEM | 2 | $15.00 | $30.00 |

- SKU field is a text input, **editable** at all times
- Auto-filled when item comes from product selection
- Empty (null) for manually-typed items — this is expected and normal
- Existing taxable checkbox and margin display behavior unchanged
- QuickPicks star button remains for now (QuickPicks removal is deferred)

### Description Field

The description field changes from `InlineCombobox` (autocomplete) to a plain text `Input`. Product search happens via the side panel, not inline.

**Keyboard behavior must be preserved:**
- **Enter on description** → focus moves to quantity field (same row)
- **Tab out of unit price on last row** → auto-adds a new empty row
- These interactions are critical for keyboard-first users and must not regress

QuickPicks suggestions that currently feed into `InlineCombobox` will still be available via the existing QuickPicks side panel until that system is removed in a future effort.

All descriptions continue to be **ALL CAPS** (existing behavior, enforced on input).

### Data Mapping: Product → Line Item

When products are added from the panel, each creates a new line item:

| Product Field | Line Item Field | Notes |
|---|---|---|
| `sku` (as string) | `sku` | Matches existing Prisma `String?` type |
| `description` (uppercased) or `title` (uppercased, for textbooks) | `description` | Textbooks use title; merchandise uses description |
| `retail_price` | `unitPrice` | Editable after population |
| `cost` | `costPrice` | Used for margin calculations |
| `1` (hardcoded) | `quantity` | User adjusts in line item row |
| `true` | `isTaxable` | Default taxable |
| `null` | `marginOverride` | Uses form-level margin if enabled |
| auto-increment | `sortOrder` | Appended after existing items |

All fields remain editable after auto-fill.

### Files Changed

- `src/components/invoice/line-items.tsx` — Add SKU column, replace `InlineCombobox` with plain `Input` (preserving keyboard nav), add SKU to the row layout
- `src/components/invoice/hooks/use-invoice-form-state.ts` — Add `sku` to `InvoiceItem` interface, add `addItems` batch method
- `src/components/quote/quote-form.ts` — Add `sku` to `QuoteItem` interface, add `addItems` batch method

---

## 4. Form State Changes

### Interface Updates

Both `InvoiceItem` and `QuoteItem` gain a `sku` field:

```typescript
interface InvoiceItem {
  _key: string;
  sku: string | null;            // NEW — matches Prisma String?, null for manual items
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

`QuoteItem` is structurally identical (same change).

### Batch Insert Method

The current form hooks only expose `addItem()` (appends one blank row) and `updateItem()` (patches one existing row). The product panel needs to add multiple prefilled items at once.

Add an `addItems(items: Partial<InvoiceItem>[])` method to both `useInvoiceFormState` and `useQuoteForm` that:

1. Accepts an array of partial item data (sku, description, unitPrice, costPrice)
2. Generates `_key` for each item
3. Calculates `extendedPrice` (quantity × unitPrice, accounting for margin if enabled)
4. Assigns sequential `sortOrder` values starting after the last existing item
5. Appends all items to the form's items array in a single state update

This avoids N separate `addItem` + `updateItem` calls which would cause N re-renders.

### Persistence / Serialization

SKU must flow through every path where line items are saved or displayed:

- **`CreateLineItemInput`** (both `src/domains/invoice/types.ts` and `src/domains/quote/types.ts`) — Add `sku: string | null` field
- **Invoice/quote save API calls** — Include `sku` in the payload sent to the server
- **Register print handlers** (`src/app/invoices/new/page.tsx` line 66, `src/app/quotes/new/page.tsx` line 74) — Map `sku` from item instead of hardcoding `null`
- **Quote template save** (`src/components/quote/quote-form.ts` ~line 283) — Preserve `sku` when mapping items for template storage

### Persistence (Database)

The Prisma `InvoiceItem` model already has `sku` as `String?`. No migration needed for invoices. Verify the quote line item model has the same field; add a migration if not.

### New Item Default

When a user manually adds a new empty row, `sku` defaults to `null`.

---

## 5. QuickPicks Coexistence

QuickPicks removal is **deferred to a separate effort**. For this implementation:

- The existing `QuickPicksSidePanel` (invoice) and `QuickPickPanel` (quote) remain in place
- They continue to render inside the line items card as they do today
- The `InlineCombobox` is replaced with a plain `Input`, but QuickPicks star button stays on line item rows
- QuickPicks suggestions no longer feed into the description field autocomplete (since `InlineCombobox` is removed), but the side panel itself still works for clicking to add items
- No QuickPicks code, API routes, admin UI, or database models are modified or deleted

This means the line items area will temporarily have both the old QuickPicks mini-panel and the new product search panel. The QuickPicks panel is small (160px) and lives inside the line items card, while the product panel is a full-width column. They don't conflict spatially.

---

## 6. SessionStorage Flow Update

The existing sessionStorage-based flow (select products on catalog page → navigate to create form → items auto-populate) should continue to work. The `readCatalogItems()` function in both `new/page.tsx` files maps `SelectedProduct[]` into initial line items.

Update this mapping to also populate the new `sku` and `costPrice` fields:

```typescript
// Before
{ description: item.description.toUpperCase(), quantity: 1, unitPrice: item.retailPrice }

// After
{
  sku: String(item.sku),
  description: item.description.toUpperCase(),
  quantity: 1,
  unitPrice: item.retailPrice,
  costPrice: item.cost,
}
```

---

## 7. Component Hierarchy (After)

```
NewInvoicePage
├── Page header + "Print for Register" button
└── Two-column grid (max-w-7xl)
    ├── KeyboardMode (left column)
    │   ├── Template selector
    │   ├── Invoice metadata (staff, department, dates, etc.)
    │   ├── Line items card
    │   │   ├── LineItems (with SKU column, plain text description input)
    │   │   └── QuickPicksSidePanel (unchanged, still inside line items card)
    │   ├── Notes
    │   ├── Signatures
    │   └── Action buttons
    └── ProductSearchPanel (right column, sticky)
        ├── Search bar
        ├── Textbook / Merchandise tabs
        ├── Scrollable product list with checkboxes
        └── "Add N Selected" button
```

Quote form follows the same structure with `QuoteMode` on the left.

---

## 8. Implementation Order

1. **Add SKU to form state interfaces** — Update `InvoiceItem`, `QuoteItem`, `CreateLineItemInput` types to include `sku: string | null`
2. **Add `addItems` batch method** — New method on both `useInvoiceFormState` and `useQuoteForm` for inserting multiple prefilled items
3. **Add SKU column to line items** — Update `LineItems` component with visible, editable SKU field
4. **Replace description autocomplete** — Swap `InlineCombobox` for plain `Input`, preserving Enter-to-qty and Tab-to-add-row keyboard behavior
5. **Create `ProductSearchPanel` component** — New shared component with search, tabs, product list, multi-select, add button
6. **Widen page layout** — Update both `new/page.tsx` files to max-w-7xl two-column grid, render `ProductSearchPanel` in right column
7. **Wire product panel to forms** — Connect `onAddProducts` → `addItems` in both `KeyboardMode` and `QuoteMode`
8. **Update persistence paths** — Ensure `sku` flows through save APIs, register-print handlers, and template save
9. **Update sessionStorage flow** — Map `sku` and `costPrice` from catalog selection
10. **Verify margin/tax calculations** — Ensure `costPrice` from product data flows correctly through existing margin pipeline

---

## 9. Future Work (Out of Scope)

- **QuickPicks removal** — Full teardown of QuickPicks infrastructure (components, hooks, API routes, admin UI, database models). Separate PR/effort.
- **QuickPicks replacement** — New system to be designed and built after removal.
- **Inline product autocomplete** — Could add product DB search to the description field in the future if the panel-only approach proves insufficient.
