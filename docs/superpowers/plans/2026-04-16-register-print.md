# Print for Register Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Print for Register" button to invoice and quote detail pages that generates a compact, print-optimized barcode sheet for charging items at the register.

**Architecture:** Extract the shared `renderBarcodeSvg()` into `src/lib/barcode.ts`, surface the existing `sku` field through the invoice and quote DTOs, build a new `register-print-view.tsx` component that generates Blob URL print windows, and add the button to both detail page headers.

**Tech Stack:** JsBarcode (existing install), Code 128 barcodes, Blob URL popups

**Spec:** `docs/superpowers/specs/2026-04-16-register-print-design.md`

---

## File Map

### New files

| File | Responsibility |
|---|---|
| `src/lib/barcode.ts` | Shared `renderBarcodeSvg(value: string)` + `escapeHtml()` extracted from product barcode view |
| `src/components/shared/register-print-view.tsx` | `RegisterPrintData` type + `openRegisterPrintWindow()` function |

### Modified files

| File | Change |
|---|---|
| `src/domains/invoice/types.ts` | Add `sku: string \| null` to `InvoiceItemResponse` |
| `src/domains/invoice/service.ts` | Include `sku` in the item mapping inside `toInvoiceResponse()` |
| `src/domains/quote/types.ts` | Add `sku: string \| null` to `QuoteItemResponse` |
| `src/domains/quote/service.ts` | Include `sku` in the item mapping inside `toQuoteResponse()` |
| `src/components/products/barcode-print-view.tsx` | Import `renderBarcodeSvg` and `escapeHtml` from `@/lib/barcode`, delete local copies |
| `src/components/invoices/invoice-detail-header.tsx` | Add "Print for Register" button + import |
| `src/components/quotes/quote-detail.tsx` | Add `sku` to local `QuoteItem` interface, add "Print for Register" button |

---

## Task 1: Extract shared barcode utility

**Files:**
- Create: `src/lib/barcode.ts`
- Modify: `src/components/products/barcode-print-view.tsx`

- [ ] **Step 1: Create `src/lib/barcode.ts`**

```typescript
import JsBarcode from "jsbarcode";

/**
 * Render a Code 128 barcode as an SVG markup string.
 * Uses an off-screen SVG element so JsBarcode can render to it,
 * then extracts the outerHTML. The element is never added to the DOM.
 */
export function renderBarcodeSvg(value: string): string {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  try {
    JsBarcode(svg, value, {
      format: "CODE128",
      width: 1.5,
      height: 50,
      displayValue: true,
      fontSize: 12,
      margin: 5,
    });
    return svg.outerHTML;
  } catch {
    return `<span style="color:red;font-size:11px;">Barcode error for ${escapeHtml(value)}</span>`;
  }
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
```

- [ ] **Step 2: Update `src/components/products/barcode-print-view.tsx` to use the shared utility**

Replace the local `renderBarcodeSvg` and `escapeHtml` functions with imports. The file should become:

```typescript
import { renderBarcodeSvg, escapeHtml } from "@/lib/barcode";
import type { SelectedProduct } from "@/domains/product/types";

/**
 * Opens a new browser window with a print-optimized barcode sheet.
 * Each selected item displays full product info + a pre-rendered Code 128 barcode.
 * No external scripts are loaded — all barcodes are rendered locally before the
 * popup opens, and the window is opened with noopener,noreferrer.
 */
export function openBarcodePrintWindow(items: SelectedProduct[]): void {
  // Pre-render all barcodes from the locally installed JsBarcode package
  const barcodes = new Map<number, string>();
  for (const item of items) {
    barcodes.set(item.sku, renderBarcodeSvg(String(item.sku)));
  }

  const rows = items
    .map(
      (item) => `
    <div class="row">
      <div class="info">
        <div class="desc">${escapeHtml(item.description)}</div>
        <div class="details">
          <span>SKU: ${item.sku}</span>
          ${item.barcode ? `<span>Barcode: ${escapeHtml(item.barcode)}</span>` : ""}
          ${item.catalogNumber ? `<span>Catalog: ${escapeHtml(item.catalogNumber)}</span>` : ""}
          <span>Vendor: #${item.vendorId}</span>
          ${item.author ? `<span>Author: ${escapeHtml(item.author)}</span>` : ""}
          ${item.edition ? `<span>Edition: ${escapeHtml(item.edition)}</span>` : ""}
          <span>Retail: $${item.retailPrice.toFixed(2)}</span>
          <span>Cost: $${item.cost.toFixed(2)}</span>
        </div>
      </div>
      <div class="barcode-cell">
        ${barcodes.get(item.sku) ?? ""}
      </div>
    </div>
  `
    )
    .join("");

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Product Barcodes</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; padding: 20px; }
    h1 { font-size: 18px; margin-bottom: 16px; }
    .row {
      display: flex;
      align-items: center;
      gap: 20px;
      padding: 12px 0;
      border-bottom: 1px solid #ddd;
    }
    .info { flex: 1; }
    .desc { font-weight: 700; font-size: 14px; margin-bottom: 4px; }
    .details {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 2px;
      font-size: 11px;
      color: #555;
    }
    .barcode-cell { flex-shrink: 0; text-align: center; }
    @media print {
      body { padding: 10px; }
      .row { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <h1>Product Barcodes — ${items.length} item${items.length !== 1 ? "s" : ""}</h1>
  ${rows}
</body>
</html>`;

  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "width=800,height=600,noopener,noreferrer");
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
```

- [ ] **Step 3: Verify the product catalog barcode printing still works**

Navigate to `http://localhost:3000/products`, select items, click Print Barcodes. The popup should open with barcodes rendered correctly.

- [ ] **Step 4: Commit**

```bash
git add src/lib/barcode.ts src/components/products/barcode-print-view.tsx
git commit -m "refactor: extract renderBarcodeSvg into shared lib/barcode"
```

---

## Task 2: Surface SKU in invoice and quote DTOs

**Files:**
- Modify: `src/domains/invoice/types.ts`
- Modify: `src/domains/invoice/service.ts`
- Modify: `src/domains/quote/types.ts`
- Modify: `src/domains/quote/service.ts`
- Modify: `src/components/quotes/quote-detail.tsx`

- [ ] **Step 1: Add `sku` to `InvoiceItemResponse` in `src/domains/invoice/types.ts`**

Find the `InvoiceItemResponse` interface and add `sku` after `marginOverride`:

```typescript
export interface InvoiceItemResponse {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  extendedPrice: number;
  sortOrder: number;
  isTaxable: boolean;
  costPrice: number | null;
  marginOverride: number | null;
  sku: string | null;
}
```

- [ ] **Step 2: Include `sku` in the invoice service item mapping**

In `src/domains/invoice/service.ts`, find the `toInvoiceResponse` function's item mapping (around line 89–99). It currently ends with `marginOverride`. Add `sku`:

```typescript
  const items: InvoiceItemResponse[] = invoice.items.map((item) => ({
    id: item.id,
    description: item.description,
    quantity: Number(item.quantity),
    unitPrice: Number(item.unitPrice),
    extendedPrice: Number(item.extendedPrice),
    sortOrder: item.sortOrder,
    isTaxable: item.isTaxable,
    costPrice: item.costPrice != null ? Number(item.costPrice) : null,
    marginOverride: item.marginOverride != null ? Number(item.marginOverride) : null,
    sku: item.sku ?? null,
  }));
```

- [ ] **Step 3: Add `sku` to `QuoteItemResponse` in `src/domains/quote/types.ts`**

Find the `QuoteItemResponse` interface and add `sku` after `costPrice`:

```typescript
export interface QuoteItemResponse {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  extendedPrice: number;
  sortOrder: number;
  isTaxable: boolean;
  marginOverride: number | null;
  costPrice: number | null;
  sku: string | null;
}
```

- [ ] **Step 4: Include `sku` in the quote service item mapping**

In `src/domains/quote/service.ts`, find the `toQuoteResponse` function's item mapping (around line 146–151). Add `sku`:

```typescript
  const items: QuoteItemResponse[] = quote.items.map((item) => ({
    id: item.id,
    description: item.description,
    quantity: Number(item.quantity),
    unitPrice: Number(item.unitPrice),
    extendedPrice: Number(item.extendedPrice),
    sortOrder: item.sortOrder,
    isTaxable: item.isTaxable,
    marginOverride: item.marginOverride != null ? Number(item.marginOverride) : null,
    costPrice: item.costPrice != null ? Number(item.costPrice) : null,
    sku: item.sku ?? null,
  }));
```

- [ ] **Step 5: Add `sku` to the local `QuoteItem` interface in `src/components/quotes/quote-detail.tsx`**

Find the `QuoteItem` interface (around line 63–73) and add `sku`:

```typescript
interface QuoteItem {
  id: string;
  description: string;
  quantity: string | number;
  unitPrice: string | number;
  extendedPrice: string | number;
  isTaxable: boolean;
  sortOrder: number;
  costPrice: string | number | null;
  marginOverride: number | null;
  sku: string | null;
}
```

- [ ] **Step 6: Run existing tests to verify nothing broke**

```bash
npx vitest run --dir tests/domains/invoice
npx vitest run --dir tests/domains/quote
```

Expected: all existing tests pass (the SKU field is nullable so existing test fixtures don't need changes).

- [ ] **Step 7: Commit**

```bash
git add src/domains/invoice/types.ts src/domains/invoice/service.ts src/domains/quote/types.ts src/domains/quote/service.ts src/components/quotes/quote-detail.tsx
git commit -m "feat: surface sku field in invoice and quote item DTOs"
```

---

## Task 3: Register print view component

**Files:**
- Create: `src/components/shared/register-print-view.tsx`

- [ ] **Step 1: Create `src/components/shared/register-print-view.tsx`**

```typescript
import { renderBarcodeSvg, escapeHtml } from "@/lib/barcode";

export interface RegisterPrintItem {
  description: string;
  quantity: number;
  unitPrice: number;
  extendedPrice: number;
  sku: string | null;
}

export interface RegisterPrintData {
  documentNumber: string;
  documentType: "Invoice" | "Quote";
  status: string;
  date: string;
  staffName: string;
  department: string;
  items: RegisterPrintItem[];
  subtotal: number;
  taxAmount: number;
  total: number;
}

function formatCurrency(value: number): string {
  return `$${value.toFixed(2)}`;
}

export function openRegisterPrintWindow(doc: RegisterPrintData): void {
  // Pre-render barcodes for items that have SKUs
  const barcodes = new Map<string, string>();
  for (const item of doc.items) {
    if (item.sku) {
      barcodes.set(item.sku, renderBarcodeSvg(item.sku));
    }
  }

  const rows = doc.items
    .map((item) => {
      const hasSku = Boolean(item.sku);
      const rightSide = hasSku
        ? `<div class="barcode-cell">${barcodes.get(item.sku!) ?? ""}</div>`
        : `<div class="needs-add">NEEDS TO BE ADDED</div>`;

      return `
    <div class="row${hasSku ? "" : " row-missing"}">
      <div class="info">
        <div class="desc">${escapeHtml(item.description)}</div>
        <div class="meta">
          ${hasSku ? `<span>SKU: ${escapeHtml(item.sku!)}</span>` : ""}
          <span class="qty">Qty: <strong>${Number(item.quantity)}</strong></span>
          <span>${formatCurrency(Number(item.unitPrice))} each</span>
          <span>Ext: ${formatCurrency(Number(item.extendedPrice))}</span>
        </div>
      </div>
      ${rightSide}
    </div>`;
    })
    .join("");

  const now = new Date();
  const timestamp = now.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }) + " at " + now.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${doc.documentType} ${escapeHtml(doc.documentNumber)} — Register Sheet</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; padding: 16px 20px; font-size: 12px; }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      border-bottom: 2px solid #000;
      padding-bottom: 6px;
      margin-bottom: 8px;
    }
    .header-left { font-size: 13px; }
    .header-left strong { font-size: 15px; }
    .header-right { text-align: right; font-size: 11px; color: #555; }
    .row {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 8px 0;
      border-bottom: 1px solid #ddd;
    }
    .row-missing {
      background: #fff8e1;
    }
    .info { flex: 1; }
    .desc { font-weight: 700; font-size: 13px; text-transform: uppercase; margin-bottom: 2px; }
    .meta {
      display: flex;
      gap: 12px;
      font-size: 11px;
      color: #555;
    }
    .qty { color: #000; font-size: 12px; }
    .barcode-cell { flex-shrink: 0; text-align: center; }
    .needs-add {
      flex-shrink: 0;
      font-weight: 700;
      font-size: 11px;
      color: #b45309;
      background: #fef3c7;
      border: 1px solid #f59e0b;
      border-radius: 4px;
      padding: 8px 12px;
      text-align: center;
      min-width: 140px;
    }
    .footer {
      margin-top: 12px;
      padding-top: 8px;
      border-top: 2px solid #000;
      display: flex;
      justify-content: space-between;
      font-size: 12px;
    }
    .totals { font-weight: 600; }
    .timestamp { color: #888; font-size: 10px; }
    @media print {
      body { padding: 8px 12px; }
      .row { break-inside: avoid; }
      .row-missing { background: #fff8e1 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .needs-add { background: #fef3c7 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <strong>${escapeHtml(doc.documentNumber)}</strong> | ${escapeHtml(doc.status)}
      <br>
      ${escapeHtml(doc.date)} | ${escapeHtml(doc.staffName)} | ${escapeHtml(doc.department)}
    </div>
    <div class="header-right">Pierce College Bookstore</div>
  </div>
  ${rows}
  <div class="footer">
    <div class="totals">
      Subtotal: ${formatCurrency(doc.subtotal)}
      ${doc.taxAmount > 0 ? ` | Tax: ${formatCurrency(doc.taxAmount)}` : ""}
      | Total: ${formatCurrency(doc.total)}
    </div>
    <div class="timestamp">Printed: ${timestamp}</div>
  </div>
</body>
</html>`;

  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "width=800,height=600,noopener,noreferrer");
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/shared/register-print-view.tsx
git commit -m "feat: add register print view component"
```

---

## Task 4: Add button to invoice detail header

**Files:**
- Modify: `src/components/invoices/invoice-detail-header.tsx`

- [ ] **Step 1: Add the Print for Register button**

In `src/components/invoices/invoice-detail-header.tsx`:

1. Add import at the top:

```typescript
import { CopyIcon, MailIcon, PrinterIcon } from "lucide-react";
```

(Replace the existing `import { CopyIcon, MailIcon } from "lucide-react";` line.)

2. Add the `onPrintForRegister` prop to the interface:

```typescript
interface InvoiceDetailHeaderProps {
  invoice: InvoiceResponse;
  canManageActions: boolean;
  regenerating: boolean;
  deleting: boolean;
  duplicating: boolean;
  deleteDialogOpen: boolean;
  onDeleteDialogOpenChange: (open: boolean) => void;
  onDownloadPdf: () => void;
  onRegeneratePdf: () => void;
  onEmail: () => void;
  onDeleteClick: () => void;
  onDeleteConfirm: () => void;
  onDuplicate: () => void;
  onPrintForRegister: () => void;
}
```

3. Destructure `onPrintForRegister` in the function params.

4. Add the button in the action row, after the Download PDF button and before the Duplicate button (around line 106):

```typescript
        <Button
          variant="outline"
          size="sm"
          onClick={onPrintForRegister}
        >
          <PrinterIcon className="size-3.5 mr-1.5" />
          Print for Register
        </Button>
```

- [ ] **Step 2: Wire up the button in the parent component**

In `src/components/invoices/invoice-detail.tsx`, find where `InvoiceDetailHeader` is rendered and add the `onPrintForRegister` prop.

1. Add import at the top:

```typescript
import { openRegisterPrintWindow } from "@/components/shared/register-print-view";
import type { RegisterPrintData } from "@/components/shared/register-print-view";
```

2. Add import for `formatDateLong` if not already imported (it should be already).

3. Create the handler function inside the component, after the other handlers:

```typescript
  function handlePrintForRegister() {
    if (!invoice) return;
    const taxRate = invoice.taxEnabled ? Number(invoice.taxRate) : 0;
    const subtotal = invoice.items.reduce((sum, item) => sum + Number(item.extendedPrice), 0);
    const taxableTotal = invoice.items
      .filter((item) => item.isTaxable)
      .reduce((sum, item) => sum + Number(item.extendedPrice), 0);
    const taxAmount = taxableTotal * taxRate;

    openRegisterPrintWindow({
      documentNumber: invoice.invoiceNumber || invoice.runningTitle || "Draft Invoice",
      documentType: "Invoice",
      status: invoice.status,
      date: formatDate(invoice.date),
      staffName: invoice.staff?.name ?? invoice.creatorName,
      department: invoice.department,
      items: invoice.items.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        extendedPrice: item.extendedPrice,
        sku: item.sku,
      })),
      subtotal,
      taxAmount,
      total: subtotal + taxAmount,
    });
  }
```

4. Pass the handler to `InvoiceDetailHeader`:

```typescript
  <InvoiceDetailHeader
    ...existing props...
    onPrintForRegister={handlePrintForRegister}
  />
```

- [ ] **Step 3: Verify on localhost**

Navigate to an invoice detail page (`http://localhost:3000/invoices/<id>`). Confirm the "Print for Register" button appears. Click it and verify the popup opens with the correct layout.

- [ ] **Step 4: Commit**

```bash
git add src/components/invoices/invoice-detail-header.tsx src/components/invoices/invoice-detail.tsx
git commit -m "feat: add Print for Register button to invoice detail"
```

---

## Task 5: Add button to quote detail page

**Files:**
- Modify: `src/components/quotes/quote-detail.tsx`

- [ ] **Step 1: Add import for the register print view**

At the top of `src/components/quotes/quote-detail.tsx`, add:

```typescript
import { openRegisterPrintWindow } from "@/components/shared/register-print-view";
```

- [ ] **Step 2: Add the handler function**

Inside the `QuoteDetailView` component (after the other handlers, around the `handleOpenPdf` area), add:

```typescript
  function handlePrintForRegister() {
    if (!quote) return;
    const taxRate = quote.taxEnabled ? Number(quote.taxRate) : 0;
    const subtotal = quote.items.reduce(
      (sum, item) => sum + Number(item.extendedPrice),
      0
    );
    const taxableTotal = quote.items
      .filter((item) => item.isTaxable)
      .reduce((sum, item) => sum + Number(item.extendedPrice), 0);
    const taxAmount = taxableTotal * taxRate;

    openRegisterPrintWindow({
      documentNumber: quote.quoteNumber || "Draft Quote",
      documentType: "Quote",
      status: quote.quoteStatus,
      date: formatDate(quote.date),
      staffName: quote.staff?.name ?? quote.creatorName,
      department: quote.department,
      items: quote.items.map((item) => ({
        description: item.description,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        extendedPrice: Number(item.extendedPrice),
        sku: item.sku,
      })),
      subtotal,
      taxAmount,
      total: subtotal + taxAmount,
    });
  }
```

- [ ] **Step 3: Add the button to the action area**

Find the action button area (around line 1328, the `flex flex-wrap items-center gap-2` div with `data-print-hide`). Add the button after the existing "Download / Regenerate PDF" button (around line 1337):

```typescript
          <Button variant="outline" size="sm" onClick={handlePrintForRegister}>
            <PrinterIcon className="size-3.5 mr-1.5" />
            Print for Register
          </Button>
```

`PrinterIcon` is already imported in this file.

- [ ] **Step 4: Verify on localhost**

Navigate to a quote detail page (`http://localhost:3000/quotes/<id>`). Confirm the "Print for Register" button appears. Click it and verify the popup opens with the correct layout, including items with and without SKUs.

- [ ] **Step 5: Commit**

```bash
git add src/components/quotes/quote-detail.tsx
git commit -m "feat: add Print for Register button to quote detail"
```

---

## Task 6: Verification

- [ ] **Step 1: Type check**

```bash
npx tsc --noEmit 2>&1 | grep -E "barcode|register|product|invoice/types|quote/types|invoice-detail|quote-detail"
```

Expected: no errors from any of the modified files.

- [ ] **Step 2: Run existing tests**

```bash
npx vitest run --dir tests/domains/invoice && npx vitest run --dir tests/domains/quote
```

Expected: all existing tests pass.

- [ ] **Step 3: Manual verification checklist**

On localhost:

1. `/products` → select items → Print Barcodes → popup opens with barcodes (extraction didn't break product catalog)
2. `/invoices/<id>` → "Print for Register" button visible → click → popup shows compact header, line items with barcodes for SKU items, amber "NEEDS TO BE ADDED" for non-SKU items, totals + timestamp
3. `/quotes/<id>` → same button and behavior
4. Both popups: Cmd+P/Ctrl+P opens native print dialog with correct layout

- [ ] **Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address issues found during register print verification"
```

---

## Summary

| Task | What it delivers |
|---|---|
| 1 | Shared `renderBarcodeSvg()` in `src/lib/barcode.ts`, product catalog updated to use it |
| 2 | SKU field surfaced in invoice and quote item DTOs (4 files) |
| 3 | `openRegisterPrintWindow()` component with compact header, barcode rows, amber flags, totals, timestamp |
| 4 | "Print for Register" button on invoice detail page |
| 5 | "Print for Register" button on quote detail page |
| 6 | Type check + test + manual verification |
