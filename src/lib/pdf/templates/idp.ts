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
  comments?: string;
  items: IDPItem[];
  totalAmount: string;
}

export function renderIDP(data: IDPData): string {
  // Pad items to at least 4 rows for both requesting dept and bookstore sections
  const rows: IDPItem[] = [...data.items];
  while (rows.length < 4) {
    rows.push({ description: "", quantity: "", unitPrice: "", extendedPrice: "" });
  }

  function itemRow(item: IDPItem): string {
    return `
      <tr>
        <td class="item-cell item-desc">${item.description}</td>
        <td class="item-cell item-qty">${item.quantity}</td>
        <td class="item-cell item-price">${item.unitPrice}</td>
        <td class="item-cell item-ext">${item.extendedPrice}</td>
      </tr>
      <tr class="sep-row">
        <td class="sep-cell" colspan="4"></td>
      </tr>`;
  }

  const requestingItemRows = rows.map((item) => itemRow(item)).join("\n");
  const bookstoreItemRows = rows
    .map(
      () => `
      <tr>
        <td class="item-cell item-desc"></td>
        <td class="item-cell item-qty"></td>
        <td class="item-cell item-price"></td>
        <td class="item-cell item-ext"></td>
      </tr>
      <tr class="sep-row">
        <td class="sep-cell" colspan="4"></td>
      </tr>`
    )
    .join("\n");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  @page {
    size: 11in 8.5in;
    margin: 0.5in;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 10pt;
    color: #000;
    line-height: 1.2;
    width: 10in;
  }

  /* ── Title rows ── */
  .title-college {
    text-align: center;
    font-size: 12pt;
    font-weight: bold;
    padding: 4px 0;
  }
  .title-form {
    text-align: center;
    font-size: 10pt;
    font-weight: bold;
    padding: 2px 0 4px 0;
  }
  .separator {
    border-top: 1px solid #000;
    margin: 2px 0 4px 0;
  }

  /* ── Section wrapper: sidebar + content ── */
  .section {
    display: flex;
    flex-direction: row;
    border: 1px solid #000;
    margin-top: -1px; /* collapse borders between sections */
  }
  .section:first-of-type {
    margin-top: 0;
  }

  /* ── Green sidebar with rotated text ── */
  .sidebar {
    width: 28px;
    min-width: 28px;
    background: #CCFFCC;
    border-right: 1px solid #000;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
  }
  .sidebar-text {
    writing-mode: vertical-rl;
    transform: rotate(180deg);
    font-weight: bold;
    font-size: 9pt;
    white-space: nowrap;
    letter-spacing: 0.5px;
    text-transform: uppercase;
  }

  /* ── Content area ── */
  .content {
    flex: 1;
    padding: 0;
  }

  /* ── Requesting department fields ── */
  .fields {
    padding: 6px 8px 4px 8px;
  }
  .field-row {
    display: flex;
    flex-direction: row;
    align-items: baseline;
    margin-bottom: 6px;
  }
  .field-group {
    display: flex;
    align-items: baseline;
    flex: 1;
    margin-right: 12px;
  }
  .field-group:last-child {
    margin-right: 0;
  }
  .field-label {
    font-weight: bold;
    font-size: 9pt;
    white-space: nowrap;
    margin-right: 4px;
  }
  .field-value {
    flex: 1;
    border-bottom: 1px solid #000;
    min-height: 14px;
    padding: 0 2px;
    font-size: 10pt;
  }
  .field-value-fixed {
    width: 140px;
    flex: none;
  }

  /* ── Comments row ── */
  .comments-row {
    display: flex;
    align-items: baseline;
    margin-bottom: 6px;
  }
  .comments-value {
    flex: 1;
    border-bottom: 1px solid #000;
    min-height: 14px;
    padding: 0 2px;
    font-size: 10pt;
  }

  /* ── Signature row ── */
  .sig-row {
    display: flex;
    align-items: flex-end;
    padding: 8px 8px 6px 8px;
    border-top: 1px solid #ccc;
  }
  .sig-label {
    font-weight: bold;
    font-size: 9pt;
    white-space: nowrap;
    margin-right: 4px;
  }
  .sig-line {
    flex: 1;
    border-bottom: 1px solid #000;
    height: 18px;
    margin-right: 16px;
  }
  .sig-date-label {
    font-weight: bold;
    font-size: 9pt;
    margin-right: 4px;
  }
  .sig-date-line {
    width: 120px;
    border-bottom: 1px solid #000;
    height: 18px;
  }

  /* ── Items table ── */
  .items-table {
    width: 100%;
    border-collapse: collapse;
  }
  .items-table th {
    background: #f0f0f0;
    border: 1px solid #000;
    padding: 3px 6px;
    font-size: 9pt;
    font-weight: bold;
    text-align: center;
  }
  .item-cell {
    border-left: 1px solid #000;
    border-right: 1px solid #000;
    padding: 3px 10px;
    font-size: 10pt;
    height: 20px;
  }
  .item-desc {
    width: 55%;
  }
  .item-qty {
    width: 10%;
    text-align: center;
  }
  .item-price {
    width: 17%;
    text-align: right;
  }
  .item-ext {
    width: 18%;
    text-align: right;
  }
  .sep-row {
    height: 1px;
  }
  .sep-cell {
    border-left: 1px solid #000;
    border-right: 1px solid #000;
    border-bottom: 1px solid #ccc;
    height: 1px;
    padding: 0;
  }

  /* ── Total row ── */
  .total-row td {
    border: 1px solid #000;
    padding: 3px 6px;
    font-weight: bold;
    font-size: 10pt;
  }
</style>
</head>
<body>

<!-- Row 1: College Name -->
<div class="title-college">Los Angeles Pierce College</div>

<!-- Row 2: Form Title -->
<div class="title-form">INTER-DEPARTMENT BOOKSTORE PURCHASE REQUEST FORM</div>

<!-- Row 3: Separator -->
<div class="separator"></div>

<!-- ═══════════════════════════════════════════════ -->
<!-- SECTION 1: Requesting Department Use           -->
<!-- ═══════════════════════════════════════════════ -->
<div class="section">
  <div class="sidebar">
    <span class="sidebar-text">Requesting Department Use</span>
  </div>
  <div class="content">
    <div class="fields">
      <!-- Row: Date / Department / Document # -->
      <div class="field-row">
        <div class="field-group">
          <span class="field-label">Date:</span>
          <span class="field-value">${data.date}</span>
        </div>
        <div class="field-group" style="flex:2;">
          <span class="field-label">Department or Unit Requesting Services:</span>
          <span class="field-value">${data.department}</span>
        </div>
        <div class="field-group" style="flex:0.8;">
          <span class="field-label">Document #:</span>
          <span class="field-value">${data.documentNumber}</span>
        </div>
      </div>

      <!-- Row: Requesting Dept / SAP Account / Estimated Cost -->
      <div class="field-row">
        <div class="field-group">
          <span class="field-label">Requesting Department:</span>
          <span class="field-value">${data.requestingDept}</span>
        </div>
        <div class="field-group">
          <span class="field-label">SAP Account:</span>
          <span class="field-value">${data.sapAccount}</span>
        </div>
        <div class="field-group" style="flex:0.8;">
          <span class="field-label">Estimated Cost:</span>
          <span class="field-value">${data.estimatedCost}</span>
        </div>
      </div>

      <!-- Row: Approver / Contact / Phone -->
      <div class="field-row">
        <div class="field-group">
          <span class="field-label">Name of Department Approver:</span>
          <span class="field-value">${data.approverName}</span>
        </div>
        <div class="field-group">
          <span class="field-label">Department Contact:</span>
          <span class="field-value">${data.contactName}</span>
        </div>
        <div class="field-group" style="flex:0.8;">
          <span class="field-label">Contact Phone:</span>
          <span class="field-value">${data.contactPhone}</span>
        </div>
      </div>

      <!-- Row: Comments -->
      <div class="comments-row">
        <span class="field-label">Comments:</span>
        <span class="comments-value">${data.comments ?? ""}</span>
      </div>
    </div>

    <!-- Signature row -->
    <div class="sig-row">
      <span class="sig-label">Signature of Department Approver:</span>
      <span class="sig-line"></span>
      <span class="sig-date-label">Date:</span>
      <span class="sig-date-line"></span>
    </div>
  </div>
</div>

<!-- ═══════════════════════════════════════════════ -->
<!-- SECTION 2: Department Use (Items)              -->
<!-- ═══════════════════════════════════════════════ -->
<div class="section">
  <div class="sidebar">
    <span class="sidebar-text">Department Use</span>
  </div>
  <div class="content">
    <table class="items-table">
      <thead>
        <tr>
          <th style="width:55%;">Description of Product, Goods or Services Requested</th>
          <th style="width:10%;">Qty.</th>
          <th style="width:17%;">Rate/Unit Price</th>
          <th style="width:18%;">Extended Price</th>
        </tr>
      </thead>
      <tbody>
        ${requestingItemRows}
        <tr class="total-row">
          <td colspan="3" style="text-align:right;">Estimated Cost:</td>
          <td style="text-align:right;">${data.totalAmount}</td>
        </tr>
      </tbody>
    </table>
  </div>
</div>

<!-- ═══════════════════════════════════════════════ -->
<!-- SECTION 3: Bookstore Use                       -->
<!-- ═══════════════════════════════════════════════ -->
<div class="section">
  <div class="sidebar">
    <span class="sidebar-text">Bookstore Use</span>
  </div>
  <div class="content">
    <table class="items-table">
      <thead>
        <tr>
          <th style="width:55%;">Description of Product, Goods or Services Provided</th>
          <th style="width:10%;">Qty.</th>
          <th style="width:17%;">Rate/Unit Price</th>
          <th style="width:18%;">Extended Price</th>
        </tr>
      </thead>
      <tbody>
        ${bookstoreItemRows}
        <tr class="total-row">
          <td colspan="3" style="text-align:right;">Actual Cost:</td>
          <td style="text-align:right;"></td>
        </tr>
      </tbody>
    </table>
  </div>
</div>

</body>
</html>`;
}
