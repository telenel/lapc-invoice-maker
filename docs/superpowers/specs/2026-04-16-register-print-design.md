# Print for Register — Design Spec

Date: 2026-04-16

## Overview

A "Print for Register" button on invoice and quote detail pages that generates a compact, print-optimized barcode sheet. The sheet gives register operators everything they need to scan and charge items: a compact document header, one row per line item with a Code 128 barcode (for items with SKUs) or a prominent "NEEDS TO BE ADDED" flag (for items without SKUs), and a totals summary with print timestamp.

This supports the core bookstore workflow: create an invoice/quote with items from the product catalog → print the register sheet → walk to the register → scan barcodes → charge everything → finalize.

## What the Printed Page Looks Like

### Header (compact, 2-3 lines)

Invoice/quote number, status badge, date, staff/requestor name, and department. No logos, no excess padding. Example:

```
INV-2024-0042 | DRAFT                    Pierce College Bookstore
Apr 16, 2026 | Jane Smith | Administration
```

### Line item rows

One row per line item regardless of quantity. Each row contains:

- **Left side:** description (bold, uppercase), SKU number (if present), quantity (bold and prominent), unit price
- **Right side:** Code 128 barcode rendered from the SKU number

For items without a SKU:

- **Left side:** same info (description, quantity, price)
- **Right side:** bold "NEEDS TO BE ADDED" text on an amber/light-red background instead of a barcode

The amber background makes missing-SKU items visually jump out so the register operator can immediately see which items need to be created in the backend system before scanning.

Quantity is never represented by repeating barcodes. One row, one barcode (or one flag), with quantity clearly displayed.

### Footer

```
Subtotal: $1,245.00 | Tax: $121.39 | Total: $1,366.39
Printed: Apr 16, 2026 at 2:30 PM
```

Compact totals line for cross-referencing against the register total after scanning. Print timestamp so reprints (e.g., after adding items to a running invoice) can be distinguished.

## Technical Implementation

### Surface SKU in DTOs

The `InvoiceItem` Prisma model already has a `sku` field (`String?`), but it is currently stripped from the response DTO. Changes needed:

- Add `sku: string | null` to `InvoiceItemResponse` in `src/domains/invoice/types.ts`
- Update the service layer mapping in `src/domains/invoice/service.ts` to include `sku` from the database row
- The repository already selects all scalar fields — no repository change needed

This also makes the SKU visible on detail pages for future use (e.g., displaying SKU in the line items table).

### Extract shared barcode utility

`renderBarcodeSvg()` currently lives in `src/components/products/barcode-print-view.tsx` and is coupled to the `SelectedProduct` type. It needs to be shared:

- Create `src/lib/barcode.ts` with the extracted `renderBarcodeSvg(value: string): string` function
- Update `src/components/products/barcode-print-view.tsx` to import from `@/lib/barcode`
- The function signature changes from `(sku: number)` to `(value: string)` for flexibility — callers convert their SKU to string before passing

### New component

`src/components/shared/register-print-view.tsx` exports a single function:

```typescript
openRegisterPrintWindow(doc: RegisterPrintData): void
```

Where `RegisterPrintData` contains:

- `documentNumber`: invoice number or quote number
- `documentType`: "Invoice" or "Quote"
- `status`: the current status string
- `date`: formatted date string
- `staffName`: requestor/staff name
- `department`: department name
- `items`: array of `{ description, quantity, unitPrice, extendedPrice, sku: string | null }`
- `subtotal`, `taxAmount`, `total`: pre-calculated totals

The function:

1. Pre-renders Code 128 barcodes for all items with SKUs using `renderBarcodeSvg()` from `@/lib/barcode`
2. Builds HTML with the compact header, line item rows (barcode or amber "NEEDS TO BE ADDED"), totals, and timestamp
3. Opens a Blob URL in a new window with `noopener,noreferrer` and `<meta charset="utf-8">`

### Button placement

**Invoice detail page** (`src/components/invoices/invoice-detail-header.tsx`):
- "Print for Register" button with `PrinterIcon` added to the action button row
- Shown for all statuses — charging at the register can happen at any point in the lifecycle

**Quote detail page** (`src/components/quotes/quote-detail.tsx`):
- Same button added to the inline action area in the header section
- Same icon and label, same behavior

Both buttons call `openRegisterPrintWindow()` with the document's data.

## Files to create

| File | Purpose |
|---|---|
| `src/lib/barcode.ts` | Shared `renderBarcodeSvg(value: string)` extracted from product barcode view |
| `src/components/shared/register-print-view.tsx` | `openRegisterPrintWindow()` — generates the register print sheet |

## Files to modify

| File | Change |
|---|---|
| `src/domains/invoice/types.ts` | Add `sku: string \| null` to `InvoiceItemResponse` |
| `src/domains/invoice/service.ts` | Include `sku` in the `toInvoiceResponse()` mapping |
| `src/components/products/barcode-print-view.tsx` | Import `renderBarcodeSvg` from `@/lib/barcode` instead of defining it locally |
| `src/components/invoices/invoice-detail-header.tsx` | Add "Print for Register" button to the action row |
| `src/components/quotes/quote-detail.tsx` | Add "Print for Register" button to the action area |

## Dependencies

No new npm packages. Uses the existing `jsbarcode` install via the shared `@/lib/barcode` utility.

## Out of scope

- Generating the Prismcore invoice (POS receipt) — that's a separate finalization step
- Auto-creating missing SKUs in the products table from the register sheet
- Printing from the list page (bulk register sheets) — this is per-document only
- Modifying the line items table on detail pages to show SKU (could be a follow-up)
