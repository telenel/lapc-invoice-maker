# Product Search Integration into Invoice/Quote Creation Forms

**Date:** 2026-04-16
**Status:** Design approved, pending implementation

## Summary

Integrate the Supabase product/inventory database directly into the invoice and quote creation forms via a persistent side panel. Users can search, browse, and multi-select products which auto-populate as line items with SKU, description, price, and cost data. Simultaneously remove the QuickPicks system, which is superseded by the product database.

## Goals

- Enable product search and selection from within the creation forms without navigating away
- Utilize the significant unused screen space alongside the narrow form
- Display financial information clearly — favor readability over compactness
- Make SKU a visible, editable field on line items
- Remove QuickPicks infrastructure entirely (to be rebuilt differently later)

## Non-Goals

- Inline autocomplete on the description field (panel-only search)
- Quantity selection in the product panel (always adds at qty 1)
- Modifying the products page itself
- Rebuilding QuickPicks as something new (deferred)

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
- **Tablet/mobile (below lg):** Single column. Product panel stacks below the form header area, or becomes a collapsible section at the top. Exact mobile treatment is secondary — the primary use case is desktop.

### Files Changed

- `src/app/invoices/new/page.tsx` — Widen container, add two-column grid wrapper
- `src/app/quotes/new/page.tsx` — Same changes
- `src/components/invoice/keyboard-mode.tsx` — Remove `mx-auto max-w-2xl`, accept panel slot or render panel
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

The parent form handles converting `SelectedProduct[]` into line items via its own `addItem` logic.

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

- SKU field is a text/number input, **editable** at all times
- Auto-filled when item comes from product selection
- Empty (null) for manually-typed items — this is expected and normal
- Existing taxable checkbox, margin display, and star button behavior unchanged (star button removed — see QuickPicks removal below)

### Description Field

The description field changes from `InlineCombobox` (autocomplete) to a plain text `Input`. With QuickPicks removed and no inline product search, there are no suggestions to show. Users type freely or get auto-filled descriptions from the product panel.

All descriptions continue to be **ALL CAPS** (existing behavior, enforced on input).

### Data Mapping: Product → Line Item

When products are added from the panel, each creates a new line item:

| Product Field | Line Item Field | Notes |
|---|---|---|
| `sku` | `sku` | New field |
| `description` (uppercased) or `title` (uppercased, for textbooks) | `description` | Textbooks use title; merchandise uses description |
| `retail_price` | `unitPrice` | Editable after population |
| `cost` | `costPrice` | Used for margin calculations |
| `1` (hardcoded) | `quantity` | User adjusts in line item row |
| `true` | `isTaxable` | Default taxable |
| `null` | `marginOverride` | Uses form-level margin if enabled |
| auto-increment | `sortOrder` | Appended after existing items |

All fields remain editable after auto-fill.

### Files Changed

- `src/components/invoice/line-items.tsx` — Add SKU column, replace `InlineCombobox` with plain `Input`, remove star/pick toggle button
- `src/components/invoice/hooks/use-invoice-form-state.ts` — Add `sku` to `InvoiceItem` interface, update `addItem`/`updateItem` logic
- `src/components/quote/quote-form.ts` — Add `sku` to `QuoteItem` interface

---

## 4. Form State Changes

### Interface Updates

Both `InvoiceItem` and `QuoteItem` gain a `sku` field:

```typescript
interface InvoiceItem {
  _key: string;
  sku: number | null;          // NEW — null for manually-typed items
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

### Persistence

The Prisma `InvoiceItem` model already has a `sku` field (integer, nullable). No database migration required for invoices. Verify the quote item model has the same field; add migration if not.

### New Item Default

When a user manually adds a new empty row, `sku` defaults to `null`.

---

## 5. QuickPicks Removal

Full removal of the QuickPicks system. This is a separate, cleanly-scoped piece of work.

### Components to Remove

- `src/components/invoice/quick-picks-side-panel.tsx` — Side panel in invoice form
- `src/components/invoice/quick-pick-panel.tsx` — Panel used in quote form

### Hooks/Utilities to Remove

- `src/components/invoice/hooks/quick-pick-resource-cache.ts` — Resource fetching cache
- All star/toggle-pick handlers in `KeyboardMode` and `QuoteMode`
- `InlineCombobox` suggestion-building logic that sources from quick picks

### Domain/API to Remove

- `src/domains/user-quick-picks/` — Entire domain directory (API client, types, routes)
- Any `SavedLineItem` API routes and domain logic
- Any `QuickPickItem` API routes and domain logic

### Database Models to Remove

- `UserQuickPick` model from Prisma schema (and migration to drop table)
- `SavedLineItem` model from Prisma schema (and migration to drop table)
- `QuickPickItem` model from Prisma schema if it exists (and migration to drop table)

### Admin UI to Remove

- Any quick pick management pages/components in the admin section

### Line Items Cleanup

- Remove star button from line item rows
- Remove `onTogglePick` prop from `LineItems` component
- Remove `userPickDescriptions` prop from `LineItems` component
- Remove `suggestions` prop from `LineItems` component

---

## 6. SessionStorage Flow Update

The existing sessionStorage-based flow (select products on catalog page → navigate to create form → items auto-populate) should continue to work. The `readCatalogItems()` function in both `new/page.tsx` files maps `SelectedProduct[]` into initial line items.

Update this mapping to also populate the new `sku` field:

```typescript
// Before
{ description: item.description.toUpperCase(), quantity: 1, unitPrice: item.retailPrice }

// After
{ sku: item.sku, description: item.description.toUpperCase(), quantity: 1, unitPrice: item.retailPrice, costPrice: item.cost }
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
    │   │   └── LineItems (with SKU column, plain text description input)
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

1. **Create `ProductSearchPanel` component** — New shared component with search, tabs, product list, multi-select, add button
2. **Widen page layout** — Update both `new/page.tsx` files to max-w-7xl two-column grid
3. **Add SKU to line items** — Update interfaces, add SKU column to `LineItems` component
4. **Wire product panel to forms** — Connect `onAddProducts` callback in both `KeyboardMode` and `QuoteMode`
5. **Replace description autocomplete** — Swap `InlineCombobox` for plain `Input`
6. **Update sessionStorage flow** — Map `sku` and `costPrice` from catalog selection
7. **Remove QuickPicks** — Delete components, hooks, domains, API routes, admin UI, database models
8. **Verify margin/tax calculations** — Ensure `costPrice` from product data flows correctly through existing margin pipeline
