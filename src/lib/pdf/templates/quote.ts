import { escapeHtml } from "@/lib/html";

export interface CateringDetailsPDF {
  eventName?: string;
  eventDate: string;
  startTime: string;
  endTime: string;
  location: string;
  contactName: string;
  contactPhone: string;
  contactEmail?: string;
  headcount?: number;
  setupRequired: boolean;
  setupTime?: string;
  setupInstructions?: string;
  takedownRequired: boolean;
  takedownTime?: string;
  takedownInstructions?: string;
  specialInstructions?: string;
}

export interface QuotePDFItem {
  description: string;
  quantity: number;
  unitPrice: number;
  extendedPrice: number;
  isTaxable: boolean;
  costPrice: number | null;
}

export interface QuotePDFData {
  quoteNumber: string;
  date: string;
  expirationDate: string;
  recipientName: string;
  recipientEmail: string;
  recipientOrg: string;
  department: string;
  category: string;
  accountCode: string;
  notes: string;
  items: QuotePDFItem[];
  totalAmount: number;
  logoDataUri?: string;
  marginEnabled: boolean;
  taxEnabled: boolean;
  taxRate: number;
  isCateringEvent: boolean;
  cateringDetails: CateringDetailsPDF | null;
}

function formatCurrency(amount: number): string {
  return `$${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function renderCateringSection(details: CateringDetailsPDF): string {
  const rows: string[] = [];

  if (details.eventName) {
    rows.push(`<tr><td style="padding:4px 8px;font-weight:bold;width:160px;vertical-align:top;">Event Name</td><td style="padding:4px 8px;">${escapeHtml(details.eventName)}</td></tr>`);
  }
  rows.push(`<tr><td style="padding:4px 8px;font-weight:bold;vertical-align:top;">Date</td><td style="padding:4px 8px;">${escapeHtml(details.eventDate)}</td></tr>`);
  rows.push(`<tr><td style="padding:4px 8px;font-weight:bold;vertical-align:top;">Time</td><td style="padding:4px 8px;">${escapeHtml(details.startTime)} &ndash; ${escapeHtml(details.endTime)}</td></tr>`);
  rows.push(`<tr><td style="padding:4px 8px;font-weight:bold;vertical-align:top;">Location</td><td style="padding:4px 8px;">${escapeHtml(details.location)}</td></tr>`);
  rows.push(`<tr><td style="padding:4px 8px;font-weight:bold;vertical-align:top;">Contact</td><td style="padding:4px 8px;">${escapeHtml(details.contactName)} &bull; ${escapeHtml(details.contactPhone)}${details.contactEmail ? ` &bull; ${escapeHtml(details.contactEmail)}` : ""}</td></tr>`);

  if (details.headcount != null) {
    rows.push(`<tr><td style="padding:4px 8px;font-weight:bold;vertical-align:top;">Headcount</td><td style="padding:4px 8px;">${escapeHtml(details.headcount)}</td></tr>`);
  }

  if (details.setupRequired) {
    const setupParts: string[] = [];
    if (details.setupTime) setupParts.push(escapeHtml(details.setupTime));
    if (details.setupInstructions) setupParts.push(escapeHtml(details.setupInstructions));
    rows.push(`<tr><td style="padding:4px 8px;font-weight:bold;vertical-align:top;">Setup</td><td style="padding:4px 8px;">${setupParts.length > 0 ? setupParts.join(" &mdash; ") : "Yes"}</td></tr>`);
  }

  if (details.takedownRequired) {
    const takedownParts: string[] = [];
    if (details.takedownTime) takedownParts.push(escapeHtml(details.takedownTime));
    if (details.takedownInstructions) takedownParts.push(escapeHtml(details.takedownInstructions));
    rows.push(`<tr><td style="padding:4px 8px;font-weight:bold;vertical-align:top;">Takedown</td><td style="padding:4px 8px;">${takedownParts.length > 0 ? takedownParts.join(" &mdash; ") : "Yes"}</td></tr>`);
  }

  if (details.specialInstructions) {
    rows.push(`<tr><td style="padding:4px 8px;font-weight:bold;vertical-align:top;">Special Instructions</td><td style="padding:4px 8px;">${escapeHtml(details.specialInstructions)}</td></tr>`);
  }

  return `
<!-- Catering Details -->
<div style="margin-top:16px;margin-bottom:16px;">
  <div style="font-weight:bold;color:#1a3a5c;text-transform:uppercase;font-size:9px;letter-spacing:1px;margin-bottom:6px;border-bottom:2px solid #1a3a5c;padding-bottom:4px;">Catering Event Details</div>
  <table style="width:100%;border-collapse:collapse;font-size:11px;">
    ${rows.join("\n    ")}
  </table>
</div>`;
}

export function renderQuote(data: QuotePDFData): string {
  // When margin is enabled, the unitPrice/extendedPrice already reflect the
  // marked-up price. The customer just sees these as the price — no indication
  // of markup in the PDF.
  const itemRows = data.items
    .map(
      (item) => `
      <tr>
        <td style="padding:8px 10px;border-bottom:1px solid #e0e0e0;">${escapeHtml(item.description.toUpperCase())}</td>
        <td style="padding:8px 10px;text-align:center;border-bottom:1px solid #e0e0e0;">${escapeHtml(item.quantity)}</td>
        <td style="padding:8px 10px;text-align:right;border-bottom:1px solid #e0e0e0;">${escapeHtml(formatCurrency(item.unitPrice))}</td>
        <td style="padding:8px 10px;text-align:right;border-bottom:1px solid #e0e0e0;">${escapeHtml(formatCurrency(item.extendedPrice))}</td>
      </tr>`
    )
    .join("\n");

  const subtotal = data.items.reduce((sum, item) => sum + item.extendedPrice, 0);

  // Calculate tax: sum extended prices of taxable items * tax rate
  const taxableSubtotal = data.taxEnabled
    ? data.items
        .filter((item) => item.isTaxable)
        .reduce((sum, item) => sum + item.extendedPrice, 0)
    : 0;
  const taxAmount = data.taxEnabled ? Math.round(taxableSubtotal * data.taxRate * 100) / 100 : 0;
  const taxRatePercent = (data.taxRate * 100).toFixed(2).replace(/\.?0+$/, "");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  @page { size: letter; margin: 0.75in 1in; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #000; line-height: 1.5; }
</style>
</head>
<body>

<!-- Header -->
<div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #1a3a5c;padding-bottom:12px;margin-bottom:16px;">
  <div>
    ${data.logoDataUri ? `<img src="${data.logoDataUri}" style="height:60px;" />` : ""}
  </div>
  <div style="text-align:right;">
    <div style="font-size:20px;font-weight:bold;color:#1a3a5c;letter-spacing:1px;">QUOTE</div>
    <div style="color:#666;margin-top:4px;">Quote #: ${escapeHtml(data.quoteNumber)}</div>
    <div style="color:#666;">Date: ${escapeHtml(data.date)}</div>
    ${data.expirationDate ? `<div style="color:#c0392b;font-weight:bold;margin-top:4px;">Expires: ${escapeHtml(data.expirationDate)}</div>` : ""}
  </div>
</div>

<!-- From / To -->
<div style="display:flex;gap:40px;margin-bottom:20px;">
  <div style="flex:1;">
    <div style="font-weight:bold;color:#1a3a5c;text-transform:uppercase;font-size:9px;letter-spacing:1px;margin-bottom:4px;">From</div>
    <div style="font-weight:bold;">Los Angeles Pierce College</div>
    <div>College Store</div>
    <div>6201 Winnetka Ave</div>
    <div>Woodland Hills, CA 91371</div>
  </div>
  <div style="flex:1;">
    <div style="font-weight:bold;color:#1a3a5c;text-transform:uppercase;font-size:9px;letter-spacing:1px;margin-bottom:4px;">To</div>
    ${data.recipientOrg ? `<div style="font-weight:bold;">${escapeHtml(data.recipientOrg)}</div>` : ""}
    ${data.recipientName ? `<div>${data.recipientOrg ? "Attn: " : "<b>"}${escapeHtml(data.recipientName)}${data.recipientOrg ? "" : "</b>"}</div>` : ""}
    ${data.recipientEmail ? `<div>${escapeHtml(data.recipientEmail)}</div>` : ""}
  </div>
</div>

<!-- Meta row -->
<div style="display:flex;gap:20px;margin-bottom:16px;padding:8px 12px;background:#f4f6f8;border-radius:4px;font-size:10px;">
  <div><strong>Department:</strong> ${escapeHtml(data.department)}</div>
  <div><strong>Category:</strong> ${escapeHtml(data.category)}</div>
  ${data.accountCode ? `<div><strong>Account Code:</strong> ${escapeHtml(data.accountCode)}</div>` : ""}
</div>

<!-- Line items table -->
<table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
  <thead>
    <tr style="background:#1a3a5c;color:#fff;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;">
      <th style="padding:8px 10px;text-align:left;">Description</th>
      <th style="padding:8px 10px;text-align:center;width:70px;">Qty</th>
      <th style="padding:8px 10px;text-align:right;width:90px;">Unit Price</th>
      <th style="padding:8px 10px;text-align:right;width:100px;">Amount</th>
    </tr>
  </thead>
  <tbody>
    ${itemRows}
  </tbody>
</table>

<!-- Total -->
<div style="display:flex;justify-content:flex-end;margin-bottom:24px;">
  <div style="width:240px;">
    <table style="width:100%;border-collapse:collapse;">
      <tr>
        <td style="padding:4px 0;">Subtotal:</td>
        <td style="padding:4px 0;text-align:right;">${escapeHtml(formatCurrency(subtotal))}</td>
      </tr>
      ${data.taxEnabled ? `
      <tr>
        <td style="padding:4px 0;">CA Sales Tax (${escapeHtml(taxRatePercent)}%):</td>
        <td style="padding:4px 0;text-align:right;">${escapeHtml(formatCurrency(taxAmount))}</td>
      </tr>
      ` : ""}
      <tr style="font-weight:bold;font-size:13px;color:#1a3a5c;">
        <td style="padding:8px 0;border-top:1px solid #e0e0e0;">Total:</td>
        <td style="padding:8px 0;border-top:1px solid #e0e0e0;text-align:right;">${escapeHtml(formatCurrency(subtotal + taxAmount))}</td>
      </tr>
    </table>
  </div>
</div>

<!-- Notes -->
${data.notes ? `
<div style="padding:10px 12px;background:#f9f9f9;border-left:3px solid #1a3a5c;border-radius:2px;font-size:10px;color:#555;">
  <strong>Notes:</strong> ${escapeHtml(data.notes)}
</div>
` : ""}

${data.isCateringEvent && data.cateringDetails ? renderCateringSection(data.cateringDetails) : ""}

<!-- Footer -->
<div style="margin-top:20px;padding-top:12px;border-top:1px solid #ddd;text-align:center;color:#999;font-size:9px;">
  This quote is valid until the expiration date shown above. &bull; Los Angeles Pierce College
</div>

</body>
</html>`;
}
