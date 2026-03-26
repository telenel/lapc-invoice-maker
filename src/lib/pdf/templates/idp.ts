export interface IDPItem {
  description: string;
  quantity: string;
  unitPrice: string;
  extendedPrice: string;
}

export interface IDPData {
  date: string;
  department: string;
  documentNumber: string;
  requestingDept: string;
  sapAccount: string;
  estimatedCost: string;
  approverName: string;
  contactName: string;
  contactPhone: string;
  items: IDPItem[];
  totalAmount: string;
}

export function renderIDP(data: IDPData): string {
  // Pad items to at least 4 rows
  const rows: IDPItem[] = [...data.items];
  while (rows.length < 4) {
    rows.push({ description: "", quantity: "", unitPrice: "", extendedPrice: "" });
  }

  const itemRows = rows
    .map(
      (item) => `
      <tr>
        <td style="border:1px solid #000; padding:4px 6px; height:24px;">${item.description}</td>
        <td style="border:1px solid #000; padding:4px 6px; text-align:center;">${item.quantity}</td>
        <td style="border:1px solid #000; padding:4px 6px; text-align:right;">${item.unitPrice}</td>
        <td style="border:1px solid #000; padding:4px 6px; text-align:right;">${item.extendedPrice}</td>
      </tr>`
    )
    .join("\n");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  @page {
    size: letter;
    margin: 0.5in;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 11px;
    color: #000;
    line-height: 1.3;
  }
  .title {
    text-align: center;
    margin-bottom: 4px;
  }
  .title h1 {
    font-size: 14px;
    font-weight: bold;
    margin-bottom: 2px;
  }
  .title h2 {
    font-size: 12px;
    font-weight: bold;
    text-transform: uppercase;
  }
  .section-header {
    background: #e0e0e0;
    font-weight: bold;
    font-size: 11px;
    padding: 4px 8px;
    border: 1px solid #000;
    margin-top: 12px;
  }
  .info-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px 16px;
    padding: 8px;
    border: 1px solid #000;
    border-top: none;
  }
  .info-field {
    display: flex;
    align-items: baseline;
    font-size: 11px;
  }
  .info-label {
    font-weight: bold;
    white-space: nowrap;
    margin-right: 6px;
  }
  .info-value {
    flex: 1;
    border-bottom: 1px solid #000;
    min-height: 16px;
    padding-left: 4px;
  }
  .sig-area {
    padding: 12px 8px;
    border: 1px solid #000;
    border-top: none;
  }
  .sig-line {
    display: flex;
    align-items: flex-end;
    margin-top: 8px;
  }
  .sig-line-label {
    font-weight: bold;
    font-size: 10px;
    margin-right: 8px;
    white-space: nowrap;
  }
  .sig-line-field {
    flex: 1;
    border-bottom: 1px solid #000;
    height: 20px;
  }
  .items-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 0;
  }
  .items-table th {
    border: 1px solid #000;
    background: #f0f0f0;
    padding: 4px 6px;
    font-size: 10px;
    text-align: center;
    font-weight: bold;
  }
  .total-row td {
    border: 1px solid #000;
    padding: 4px 6px;
    font-weight: bold;
  }
</style>
</head>
<body>

<div class="title">
  <h1>Los Angeles Pierce College</h1>
  <h2>Inter-Department Bookstore Purchase Request Form</h2>
</div>

<div class="section-header">REQUESTING DEPARTMENT USE</div>
<div class="info-grid">
  <div class="info-field">
    <span class="info-label">Date:</span>
    <span class="info-value">${data.date}</span>
  </div>
  <div class="info-field">
    <span class="info-label">Department:</span>
    <span class="info-value">${data.department}</span>
  </div>
  <div class="info-field">
    <span class="info-label">Document #:</span>
    <span class="info-value">${data.documentNumber}</span>
  </div>
  <div class="info-field">
    <span class="info-label">Requesting Dept:</span>
    <span class="info-value">${data.requestingDept}</span>
  </div>
  <div class="info-field">
    <span class="info-label">SAP Account:</span>
    <span class="info-value">${data.sapAccount}</span>
  </div>
  <div class="info-field">
    <span class="info-label">Estimated Cost:</span>
    <span class="info-value">${data.estimatedCost}</span>
  </div>
  <div class="info-field">
    <span class="info-label">Approver:</span>
    <span class="info-value">${data.approverName}</span>
  </div>
  <div class="info-field">
    <span class="info-label">Contact:</span>
    <span class="info-value">${data.contactName}</span>
  </div>
  <div class="info-field">
    <span class="info-label">Phone:</span>
    <span class="info-value">${data.contactPhone}</span>
  </div>
</div>

<div class="sig-area">
  <div class="sig-line">
    <span class="sig-line-label">Department Approver Signature:</span>
    <span class="sig-line-field"></span>
  </div>
  <div class="sig-line">
    <span class="sig-line-label">Date:</span>
    <span class="sig-line-field"></span>
  </div>
</div>

<div class="section-header">BOOKSTORE USE</div>
<table class="items-table">
  <thead>
    <tr>
      <th style="width:50%;">Description</th>
      <th style="width:12%;">Qty</th>
      <th style="width:19%;">Rate/Unit Price</th>
      <th style="width:19%;">Extended Price</th>
    </tr>
  </thead>
  <tbody>
    ${itemRows}
    <tr class="total-row">
      <td colspan="3" style="text-align:right; border:1px solid #000;">TOTAL:</td>
      <td style="text-align:right; border:1px solid #000;">${data.totalAmount}</td>
    </tr>
  </tbody>
</table>

</body>
</html>`;
}
