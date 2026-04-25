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

export function openRegisterPrintWindow(doc: RegisterPrintData, targetWindow?: Window | null): void {
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

  if (targetWindow && !targetWindow.closed) {
    targetWindow.document.open();
    targetWindow.document.write(html);
    targetWindow.document.close();
    targetWindow.focus();
    return;
  }

  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "width=800,height=600,noopener,noreferrer");
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
