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
  const rows: IDPItem[] = [...data.items];
  while (rows.length < 4) {
    rows.push({ description: "", quantity: "", unitPrice: "", extendedPrice: "" });
  }

  const deptItemRows = rows
    .map(
      (item) => `
        <tr>
          <td class="c">${item.description}</td>
          <td class="c" style="text-align:center;">${item.quantity}</td>
          <td class="c" style="text-align:right;">${item.unitPrice}</td>
          <td class="c" style="text-align:right;">${item.extendedPrice}</td>
        </tr>`
    )
    .join("\n");

  const blankRows = rows
    .map(
      () => `
        <tr>
          <td class="c">&nbsp;</td>
          <td class="c">&nbsp;</td>
          <td class="c" style="text-align:right;">$&nbsp;-</td>
          <td class="c" style="text-align:right;">&nbsp;</td>
        </tr>`
    )
    .join("\n");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  @page { size: 11in 8.5in; margin: 0.35in 0.4in; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 9pt;
    color: #000;
    line-height: 1.15;
  }
  table { border-collapse:collapse; }
  /* generic bordered cell */
  .c {
    border: 1px solid #000;
    padding: 2px 4px;
    vertical-align: middle;
  }
  /* label cell (below value) */
  .lb {
    border: 1px solid #000;
    padding: 1px 4px;
    font-weight: bold;
    font-size: 7.5pt;
    vertical-align: top;
  }
  /* value cell (above label) */
  .v {
    border: 1px solid #000;
    padding: 2px 4px;
    font-size: 9pt;
    vertical-align: bottom;
    height: 20px;
  }
  /* sidebar */
  .sb {
    background: #CCFFCC;
    border: 1px solid #000;
    text-align: center;
    vertical-align: middle;
    width: 22px;
  }
  .sb div {
    writing-mode: vertical-rl;
    transform: rotate(180deg);
    font-weight: bold;
    font-size: 7pt;
    text-transform: uppercase;
    white-space: nowrap;
    letter-spacing: 0.3px;
  }
  /* dark header */
  .hd {
    background: #000;
    color: #fff;
    border: 1px solid #000;
    padding: 3px 4px;
    font-weight: bold;
    font-size: 8pt;
  }
</style>
</head>
<body>

<!-- Outer page table: fills the full printable area -->
<table style="width:100%; height:100%;">
  <colgroup>
    <col style="width:22px;">
    <col>
  </colgroup>

  <!-- ═══ TITLE ═══ -->
  <tr>
    <td colspan="2" style="border:1px solid #000; text-align:center; padding:4px 0; height:36px;">
      <div style="font-weight:bold; font-size:11pt; line-height:1.3;">Name of College</div>
      <div style="font-weight:bold; font-size:9pt;">INTER- DEPARTMENT BOOKSTORE PURCHASE REQUEST FORM</div>
    </td>
  </tr>

  <!-- ═══ SECTION 1: REQUESTING DEPARTMENT USE ═══ -->
  <tr>
    <td class="sb"><div>Requesting Department Use</div></td>
    <td style="border:1px solid #000; padding:0; vertical-align:top;">
      <table style="width:100%; table-layout:fixed;">
        <!-- Field Group 1: Value row -->
        <tr>
          <td class="v" style="width:18%;">${data.date}</td>
          <td class="v" style="width:50%;">${data.department}</td>
          <td class="v" style="width:32%;">${data.documentNumber}</td>
        </tr>
        <!-- Field Group 1: Label row -->
        <tr>
          <td class="lb">Date</td>
          <td class="lb">Department or Unit Requesting Services</td>
          <td class="lb">Document #</td>
        </tr>
        <!-- Field Group 2: Value row -->
        <tr>
          <td class="v">${data.requestingDept}</td>
          <td class="v">${data.sapAccount}</td>
          <td class="v">${data.estimatedCost}</td>
        </tr>
        <!-- Field Group 2: Label row -->
        <tr>
          <td class="lb">Requesting Department</td>
          <td class="lb">SAP Account</td>
          <td class="lb">Estimated Cost</td>
        </tr>
        <!-- Field Group 3: Value row -->
        <tr>
          <td class="v">${data.approverName}</td>
          <td class="v">${data.contactName}</td>
          <td class="v">${data.contactPhone}</td>
        </tr>
        <!-- Field Group 3: Label row -->
        <tr>
          <td class="lb">Name of Department Approver</td>
          <td class="lb">Department Contact</td>
          <td class="lb">Contact Phone</td>
        </tr>
        <!-- Comments -->
        <tr>
          <td colspan="3" style="border:1px solid #000; padding:2px 4px; height:18px; vertical-align:top;">
            <span style="font-weight:bold; font-size:7.5pt;">Comments:</span>
            <span style="font-size:9pt;">${data.comments ?? ""}</span>
          </td>
        </tr>
        <!-- Signature row -->
        <tr>
          <td colspan="2" style="border:1px solid #000; padding:4px; height:32px; vertical-align:bottom;">
            <div style="border-bottom:1px solid #000; height:16px; margin-bottom:2px;"></div>
            <span style="font-weight:bold; font-size:7.5pt;">Signature of Department Approver</span>
          </td>
          <td style="border:1px solid #000; padding:4px; vertical-align:bottom;">
            <div style="border-bottom:1px solid #000; height:16px; margin-bottom:2px;"></div>
            <span style="font-weight:bold; font-size:7.5pt;">Date</span>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- ═══ SECTION 2: DEPARTMENT USE ═══ -->
  <tr>
    <td class="sb" rowspan="1"><div>Department Use</div></td>
    <td style="border:1px solid #000; padding:0; vertical-align:top;">
      <table style="width:100%; table-layout:fixed;">
        <tr>
          <td class="hd" style="width:55%;">Description of Product, Goods or Services Requested:</td>
          <td class="hd" style="width:8%; text-align:center;">Qty.</td>
          <td class="hd" style="width:17%; text-align:center;">Rate/Unit Price</td>
          <td class="hd" style="width:20%; text-align:center;">Extended Price</td>
        </tr>
        ${deptItemRows}
        <tr>
          <td class="c" style="border-left:none; border-bottom:none;">&nbsp;</td>
          <td class="c" style="border-bottom:none;">&nbsp;</td>
          <td class="c" style="text-align:right; font-weight:bold;">Estimated Cost:</td>
          <td class="c" style="text-align:right; font-weight:bold; background:#f0f0f0;">${data.totalAmount}</td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- ═══ SECTION 3: BOOKSTORE USE ═══ -->
  <tr>
    <td class="sb" rowspan="1"><div>Bookstore Use</div></td>
    <td style="border:1px solid #000; padding:0; vertical-align:top;">
      <table style="width:100%; table-layout:fixed;">
        ${blankRows}
        <tr>
          <td class="c" style="width:55%; font-weight:bold; font-size:8pt; vertical-align:bottom;">Description of Product, Goods or Services Provided:</td>
          <td class="c" style="width:8%;">&nbsp;</td>
          <td class="c" style="width:17%; text-align:right; font-weight:bold;">Actual Cost:</td>
          <td class="c" style="width:20%; text-align:right; font-weight:bold; background:#f0f0f0;">${data.totalAmount}</td>
        </tr>
      </table>
    </td>
  </tr>

</table>

</body>
</html>`;
}
