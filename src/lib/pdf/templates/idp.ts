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
  // Pad items to at least 6 rows for both requesting dept and bookstore sections
  const rows: IDPItem[] = [...data.items];
  while (rows.length < 6) {
    rows.push({ description: "", quantity: "", unitPrice: "", extendedPrice: "" });
  }

  function itemRow(item: IDPItem): string {
    return `
      <tr style="height:28px;">
        <td style="border-left:1px solid #000; border-right:1px solid #000; border-bottom:1px solid #ccc; padding:2px 6px; font-size:11pt;">${item.description}</td>
        <td style="border-right:1px solid #000; border-bottom:1px solid #ccc; padding:2px 6px; font-size:11pt; text-align:center;">${item.quantity}</td>
        <td style="border-right:1px solid #000; border-bottom:1px solid #ccc; padding:2px 6px; font-size:11pt; text-align:right;">${item.unitPrice}</td>
        <td style="border-right:1px solid #000; border-bottom:1px solid #ccc; padding:2px 6px; font-size:11pt; text-align:right;">${item.extendedPrice}</td>
      </tr>`;
  }

  function blankRow(): string {
    return `
      <tr style="height:28px;">
        <td style="border-left:1px solid #000; border-right:1px solid #000; border-bottom:1px solid #ccc; padding:2px 6px; font-size:11pt;">&nbsp;</td>
        <td style="border-right:1px solid #000; border-bottom:1px solid #ccc; padding:2px 6px; font-size:11pt;">&nbsp;</td>
        <td style="border-right:1px solid #000; border-bottom:1px solid #ccc; padding:2px 6px; font-size:11pt;">&nbsp;</td>
        <td style="border-right:1px solid #000; border-bottom:1px solid #ccc; padding:2px 6px; font-size:11pt;">&nbsp;</td>
      </tr>`;
  }

  const requestingItemRows = rows.map((item) => itemRow(item)).join("\n");
  const bookstoreBlankRows = Array.from({ length: rows.length }, () => blankRow()).join("\n");

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
    font-size: 11pt;
    color: #000;
    line-height: 1.3;
    width: 10in;
    height: 7.5in;
    margin: 0;
    padding: 0;
    overflow: hidden;
  }
</style>
</head>
<body>

<table style="width:10in; height:7.5in; border-collapse:collapse; table-layout:fixed;">
  <!-- ── Title Row ── -->
  <tr>
    <td colspan="2" style="border:none; padding:0 0 4px 0; vertical-align:top;">
      <div style="text-align:center; font-size:14pt; font-weight:bold; padding:4px 0 2px 0;">Los Angeles Pierce College</div>
      <div style="text-align:center; font-size:12pt; font-weight:bold; padding:2px 0 4px 0;">INTER-DEPARTMENT BOOKSTORE PURCHASE REQUEST FORM</div>
      <div style="border-top:1px solid #000; margin:0;"></div>
    </td>
  </tr>

  <!-- ══════════════════════════════════════════════ -->
  <!-- SECTION 1: Requesting Department Use (28%)    -->
  <!-- ══════════════════════════════════════════════ -->
  <tr style="height:28%;">
    <!-- Sidebar -->
    <td style="width:32px; background:#CCFFCC; border:1px solid #000; text-align:center; vertical-align:middle;">
      <div style="writing-mode:vertical-rl; transform:rotate(180deg); font-weight:bold; font-size:10pt; text-transform:uppercase; white-space:nowrap; letter-spacing:0.5px;">Requesting Department Use</div>
    </td>
    <!-- Content -->
    <td style="border:1px solid #000; vertical-align:top; padding:0;">
      <div style="padding:8px;">
        <!-- Row 1: Date / Department / Document # -->
        <table style="width:100%; border-collapse:collapse; margin-bottom:8px;">
          <tr>
            <td style="width:20%; padding:0; vertical-align:baseline;">
              <span style="font-weight:bold; font-size:10pt; white-space:nowrap;">Date:&nbsp;</span>
              <span style="font-size:11pt; border-bottom:1px solid #000; display:inline-block; min-width:80px; min-height:18px; padding:0 2px;">${data.date}</span>
            </td>
            <td style="width:55%; padding:0 8px; vertical-align:baseline;">
              <span style="font-weight:bold; font-size:10pt; white-space:nowrap;">Department or Unit Requesting Services:&nbsp;</span>
              <span style="font-size:11pt; border-bottom:1px solid #000; display:inline-block; min-width:120px; min-height:18px; padding:0 2px;">${data.department}</span>
            </td>
            <td style="width:25%; padding:0; vertical-align:baseline;">
              <span style="font-weight:bold; font-size:10pt; white-space:nowrap;">Document #:&nbsp;</span>
              <span style="font-size:11pt; border-bottom:1px solid #000; display:inline-block; min-width:80px; min-height:18px; padding:0 2px;">${data.documentNumber}</span>
            </td>
          </tr>
        </table>

        <!-- Row 2: Requesting Department / SAP Account / Estimated Cost -->
        <table style="width:100%; border-collapse:collapse; margin-bottom:8px;">
          <tr>
            <td style="width:40%; padding:0; vertical-align:baseline;">
              <span style="font-weight:bold; font-size:10pt; white-space:nowrap;">Requesting Department:&nbsp;</span>
              <span style="font-size:11pt; border-bottom:1px solid #000; display:inline-block; min-width:100px; min-height:18px; padding:0 2px;">${data.requestingDept}</span>
            </td>
            <td style="width:35%; padding:0 8px; vertical-align:baseline;">
              <span style="font-weight:bold; font-size:10pt; white-space:nowrap;">SAP Account:&nbsp;</span>
              <span style="font-size:11pt; border-bottom:1px solid #000; display:inline-block; min-width:100px; min-height:18px; padding:0 2px;">${data.sapAccount}</span>
            </td>
            <td style="width:25%; padding:0; vertical-align:baseline;">
              <span style="font-weight:bold; font-size:10pt; white-space:nowrap;">Estimated Cost:&nbsp;</span>
              <span style="font-size:11pt; border-bottom:1px solid #000; display:inline-block; min-width:80px; min-height:18px; padding:0 2px;">${data.estimatedCost}</span>
            </td>
          </tr>
        </table>

        <!-- Row 3: Approver / Contact / Phone -->
        <table style="width:100%; border-collapse:collapse; margin-bottom:8px;">
          <tr>
            <td style="width:40%; padding:0; vertical-align:baseline;">
              <span style="font-weight:bold; font-size:10pt; white-space:nowrap;">Name of Department Approver:&nbsp;</span>
              <span style="font-size:11pt; border-bottom:1px solid #000; display:inline-block; min-width:80px; min-height:18px; padding:0 2px;">${data.approverName}</span>
            </td>
            <td style="width:35%; padding:0 8px; vertical-align:baseline;">
              <span style="font-weight:bold; font-size:10pt; white-space:nowrap;">Department Contact:&nbsp;</span>
              <span style="font-size:11pt; border-bottom:1px solid #000; display:inline-block; min-width:80px; min-height:18px; padding:0 2px;">${data.contactName}</span>
            </td>
            <td style="width:25%; padding:0; vertical-align:baseline;">
              <span style="font-weight:bold; font-size:10pt; white-space:nowrap;">Contact Phone:&nbsp;</span>
              <span style="font-size:11pt; border-bottom:1px solid #000; display:inline-block; min-width:80px; min-height:18px; padding:0 2px;">${data.contactPhone}</span>
            </td>
          </tr>
        </table>

        <!-- Row 4: Comments -->
        <table style="width:100%; border-collapse:collapse; margin-bottom:8px;">
          <tr>
            <td style="padding:0; vertical-align:baseline;">
              <span style="font-weight:bold; font-size:10pt; white-space:nowrap;">Comments:&nbsp;</span>
              <span style="font-size:11pt; border-bottom:1px solid #000; display:inline-block; width:calc(100% - 90px); min-height:18px; padding:0 2px;">${data.comments ?? ""}</span>
            </td>
          </tr>
        </table>
      </div>

      <!-- Row 5: Signature -->
      <div style="padding:4px 8px 8px 8px; border-top:1px solid #ccc; display:flex; align-items:flex-end;">
        <span style="font-weight:bold; font-size:10pt; white-space:nowrap; margin-right:4px;">Signature of Department Approver:</span>
        <span style="flex:1; border-bottom:1px solid #000; height:18px; margin-right:16px;"></span>
        <span style="font-weight:bold; font-size:10pt; white-space:nowrap; margin-right:4px;">Date:</span>
        <span style="width:120px; border-bottom:1px solid #000; height:18px;"></span>
      </div>
    </td>
  </tr>

  <!-- ══════════════════════════════════════════════ -->
  <!-- SECTION 2: Department Use (40%)               -->
  <!-- ══════════════════════════════════════════════ -->
  <tr style="height:40%;">
    <!-- Sidebar -->
    <td style="width:32px; background:#CCFFCC; border:1px solid #000; text-align:center; vertical-align:middle;">
      <div style="writing-mode:vertical-rl; transform:rotate(180deg); font-weight:bold; font-size:10pt; text-transform:uppercase; white-space:nowrap; letter-spacing:0.5px;">Department Use</div>
    </td>
    <!-- Content -->
    <td style="border:1px solid #000; vertical-align:top; padding:0;">
      <table style="width:100%; height:100%; border-collapse:collapse;">
        <thead>
          <tr>
            <th style="width:55%; background:#f0f0f0; border-bottom:1px solid #000; padding:4px 6px; font-size:10pt; font-weight:bold; text-align:center;">Description of Product, Goods or Services Requested</th>
            <th style="width:10%; background:#f0f0f0; border-bottom:1px solid #000; border-left:1px solid #000; padding:4px 6px; font-size:10pt; font-weight:bold; text-align:center;">Qty.</th>
            <th style="width:17%; background:#f0f0f0; border-bottom:1px solid #000; border-left:1px solid #000; padding:4px 6px; font-size:10pt; font-weight:bold; text-align:center;">Rate/Unit Price</th>
            <th style="width:18%; background:#f0f0f0; border-bottom:1px solid #000; border-left:1px solid #000; padding:4px 6px; font-size:10pt; font-weight:bold; text-align:center;">Extended Price</th>
          </tr>
        </thead>
        <tbody>
          ${requestingItemRows}
          <tr>
            <td colspan="3" style="border-top:1px solid #000; padding:4px 6px; font-size:11pt; font-weight:bold; text-align:right;">Estimated Cost:</td>
            <td style="border-top:1px solid #000; border-left:1px solid #000; padding:4px 6px; font-size:11pt; font-weight:bold; text-align:right;">${data.totalAmount}</td>
          </tr>
        </tbody>
      </table>
    </td>
  </tr>

  <!-- ══════════════════════════════════════════════ -->
  <!-- SECTION 3: Bookstore Use (28%)                -->
  <!-- ══════════════════════════════════════════════ -->
  <tr style="height:28%;">
    <!-- Sidebar -->
    <td style="width:32px; background:#CCFFCC; border:1px solid #000; text-align:center; vertical-align:middle;">
      <div style="writing-mode:vertical-rl; transform:rotate(180deg); font-weight:bold; font-size:10pt; text-transform:uppercase; white-space:nowrap; letter-spacing:0.5px;">Bookstore Use</div>
    </td>
    <!-- Content -->
    <td style="border:1px solid #000; vertical-align:top; padding:0;">
      <table style="width:100%; height:100%; border-collapse:collapse;">
        <tbody>
          ${bookstoreBlankRows}
          <tr>
            <td colspan="2" style="width:65%; border-top:1px solid #000; padding:4px 6px; font-size:11pt; font-weight:bold; text-align:left;">Description of Product, Goods or Services Provided:</td>
            <td style="width:17%; border-top:1px solid #000; border-left:1px solid #000; padding:4px 6px; font-size:11pt; font-weight:bold; text-align:right;">Actual Cost:</td>
            <td style="width:18%; border-top:1px solid #000; border-left:1px solid #000; padding:4px 6px; font-size:11pt; font-weight:bold; text-align:right;">${data.totalAmount}</td>
          </tr>
        </tbody>
      </table>
    </td>
  </tr>
</table>

</body>
</html>`;
}
