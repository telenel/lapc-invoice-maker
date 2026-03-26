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
  items: { description: string; quantity: number; unitPrice: number; extendedPrice: number }[];
  totalAmount: number;
  logoDataUri?: string;
}

function formatCurrency(amount: number): string {
  return `$${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function renderQuote(data: QuotePDFData): string {
  const itemRows = data.items
    .map(
      (item) => `
      <tr>
        <td style="padding:8px 10px;border-bottom:1px solid #e0e0e0;">${item.description}</td>
        <td style="padding:8px 10px;text-align:center;border-bottom:1px solid #e0e0e0;">${item.quantity}</td>
        <td style="padding:8px 10px;text-align:right;border-bottom:1px solid #e0e0e0;">${formatCurrency(item.unitPrice)}</td>
        <td style="padding:8px 10px;text-align:right;border-bottom:1px solid #e0e0e0;">${formatCurrency(item.extendedPrice)}</td>
      </tr>`
    )
    .join("\n");

  const subtotal = data.items.reduce((sum, item) => sum + item.extendedPrice, 0);

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
    <div style="color:#666;margin-top:4px;">Quote #: ${data.quoteNumber}</div>
    <div style="color:#666;">Date: ${data.date}</div>
    ${data.expirationDate ? `<div style="color:#c0392b;font-weight:bold;margin-top:4px;">Expires: ${data.expirationDate}</div>` : ""}
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
    ${data.recipientOrg ? `<div style="font-weight:bold;">${data.recipientOrg}</div>` : ""}
    ${data.recipientName ? `<div>${data.recipientOrg ? "Attn: " : "<b>"}${data.recipientName}${data.recipientOrg ? "" : "</b>"}</div>` : ""}
    ${data.recipientEmail ? `<div>${data.recipientEmail}</div>` : ""}
  </div>
</div>

<!-- Meta row -->
<div style="display:flex;gap:20px;margin-bottom:16px;padding:8px 12px;background:#f4f6f8;border-radius:4px;font-size:10px;">
  <div><strong>Department:</strong> ${data.department}</div>
  <div><strong>Category:</strong> ${data.category}</div>
  ${data.accountCode ? `<div><strong>Account Code:</strong> ${data.accountCode}</div>` : ""}
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
  <div style="width:220px;">
    <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #e0e0e0;">
      <span>Subtotal</span><span>${formatCurrency(subtotal)}</span>
    </div>
    <div style="display:flex;justify-content:space-between;padding:8px 0;font-weight:bold;font-size:13px;color:#1a3a5c;">
      <span>Total</span><span>${formatCurrency(data.totalAmount)}</span>
    </div>
  </div>
</div>

<!-- Notes -->
${data.notes ? `
<div style="padding:10px 12px;background:#f9f9f9;border-left:3px solid #1a3a5c;border-radius:2px;font-size:10px;color:#555;">
  <strong>Notes:</strong> ${data.notes}
</div>
` : ""}

<!-- Footer -->
<div style="margin-top:20px;padding-top:12px;border-top:1px solid #ddd;text-align:center;color:#999;font-size:9px;">
  This quote is valid until the expiration date shown above. &bull; Los Angeles Pierce College
</div>

</body>
</html>`;
}
