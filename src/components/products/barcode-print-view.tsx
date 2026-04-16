import type { SelectedProduct } from "@/domains/product/types";
import { renderBarcodeSvg, escapeHtml } from "@/lib/barcode";

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

  // Use a Blob URL so the popup has no window.opener reference
  // (window.open with noopener returns null, so document.write is not possible)
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "width=800,height=600,noopener,noreferrer");

  // Revoke after a short delay to allow the popup to load
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

