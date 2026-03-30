import { escapeHtml } from "@/lib/html";

export interface PrintQuotePdfItem {
  description: string;
  details: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface PrintQuotePdfData {
  shopTitle: string;
  quoteNumber: string;
  createdAt: string;
  requesterName: string;
  requesterEmail: string;
  requesterOrganization: string;
  subtotal: number;
  tax: number;
  total: number;
  taxEnabled: boolean;
  taxRateLabel: string;
  disclaimer: string;
  items: PrintQuotePdfItem[];
}

function formatCurrency(value: number): string {
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function renderPrintQuote(data: PrintQuotePdfData): string {
  const itemRows = data.items
    .map(
      (item) => `
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #d9dee5;">
            <div style="font-weight:700;color:#10243e;">${escapeHtml(item.description)}</div>
            <div style="font-size:11px;color:#5a687c;margin-top:4px;">${escapeHtml(item.details)}</div>
          </td>
          <td style="padding:10px 12px;border-bottom:1px solid #d9dee5;text-align:center;">${escapeHtml(item.quantity)}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #d9dee5;text-align:right;">${escapeHtml(formatCurrency(item.unitPrice))}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #d9dee5;text-align:right;">${escapeHtml(formatCurrency(item.lineTotal))}</td>
        </tr>
      `
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <style>
      @page { size: letter; margin: 0.7in 0.8in; }
      * { box-sizing: border-box; }
      body {
        font-family: Arial, Helvetica, sans-serif;
        color: #10243e;
        font-size: 12px;
        line-height: 1.45;
      }
    </style>
  </head>
  <body>
    <header style="display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:16px;border-bottom:2px solid #10243e;">
      <div>
        <div style="font-size:24px;font-weight:700;letter-spacing:0.02em;">${escapeHtml(data.shopTitle)}</div>
        <div style="font-size:13px;color:#5a687c;margin-top:4px;">Price estimate and quote</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:22px;font-weight:700;">QUOTE</div>
        <div style="margin-top:4px;color:#5a687c;">Quote #: ${escapeHtml(data.quoteNumber)}</div>
        <div style="color:#5a687c;">Created: ${escapeHtml(data.createdAt)}</div>
      </div>
    </header>

    <section style="display:flex;gap:24px;margin-top:20px;margin-bottom:18px;">
      <div style="flex:1;padding:14px;border:1px solid #d9dee5;border-radius:10px;background:#f8fafc;">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#5a687c;">Estimate For</div>
        <div style="margin-top:8px;font-weight:700;">${escapeHtml(data.requesterOrganization || "Walk-in / Customer Request")}</div>
        ${data.requesterName ? `<div style="margin-top:2px;">${escapeHtml(data.requesterName)}</div>` : ""}
        ${data.requesterEmail ? `<div style="margin-top:2px;">${escapeHtml(data.requesterEmail)}</div>` : ""}
      </div>
      <div style="flex:1;padding:14px;border:1px solid #d9dee5;border-radius:10px;background:#f8fafc;">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#5a687c;">Notes</div>
        <div style="margin-top:8px;color:#334155;">
          Pricing reflects the current published print shop rates for standard services. Final production details will be confirmed during review.
        </div>
      </div>
    </section>

    <table style="width:100%;border-collapse:collapse;border:1px solid #d9dee5;border-radius:12px;overflow:hidden;">
      <thead>
        <tr style="background:#10243e;color:#ffffff;">
          <th style="padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;">Service</th>
          <th style="padding:10px 12px;text-align:center;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;width:70px;">Qty</th>
          <th style="padding:10px 12px;text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;width:100px;">Unit</th>
          <th style="padding:10px 12px;text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;width:110px;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows}
      </tbody>
    </table>

    <section style="display:flex;justify-content:flex-end;margin-top:20px;">
      <div style="width:260px;">
        <div style="display:flex;justify-content:space-between;padding:4px 0;color:#334155;">
          <span>Subtotal</span>
          <strong>${escapeHtml(formatCurrency(data.subtotal))}</strong>
        </div>
        ${
          data.taxEnabled
            ? `<div style="display:flex;justify-content:space-between;padding:4px 0;color:#334155;">
                 <span>Sales tax (${escapeHtml(data.taxRateLabel)})</span>
                 <strong>${escapeHtml(formatCurrency(data.tax))}</strong>
               </div>`
            : ""
        }
        <div style="display:flex;justify-content:space-between;padding:10px 0 0;margin-top:10px;border-top:1px solid #d9dee5;font-size:15px;">
          <span style="font-weight:700;">Grand total</span>
          <strong>${escapeHtml(formatCurrency(data.total))}</strong>
        </div>
      </div>
    </section>

    <footer style="margin-top:28px;padding:14px 16px;border-radius:12px;background:#fef3c7;color:#7c2d12;font-size:11px;">
      ${escapeHtml(data.disclaimer)}
    </footer>
  </body>
</html>`;
}
