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

  // Format extended price: show "$ -" for empty/zero, otherwise "$ 123.45"
  function fmtPrice(val: string): string {
    if (!val || val === "$0.00" || val === "0.00" || val === "0") return "$ &nbsp;&nbsp;&nbsp;-";
    if (val.startsWith("$")) return val;
    return `$ ${val}`;
  }

  const deptItemRows = rows
    .map(
      (item) => `
        <tr>
          <td class="c" style="height:19px;">${item.description}</td>
          <td class="c" style="text-align:center;">${item.quantity}</td>
          <td class="c" style="text-align:right;">${item.unitPrice ? fmtPrice(item.unitPrice) : ""}</td>
          <td class="c" style="text-align:right;">${fmtPrice(item.extendedPrice)}</td>
        </tr>`
    )
    .join("\n");

  // Bookstore Use: always 4 blank rows + summary
  const bookstoreBlankRows = Array.from({ length: 4 })
    .map(
      () => `
        <tr>
          <td class="c" style="height:19px;">&nbsp;</td>
          <td class="c">&nbsp;</td>
          <td class="c" style="text-align:right;">$ &nbsp;&nbsp;&nbsp;-</td>
        </tr>`
    )
    .join("\n");

  // Split date into parts for the 3-box display (MM / DD / YYYY)
  // Input format: "March 26, 2026" or "2026-03-26" or similar
  let datePart1 = "";
  let datePart2 = "";
  let datePart3 = "";
  if (data.date) {
    // Try to parse and format
    const d = new Date(data.date);
    if (!isNaN(d.getTime())) {
      datePart1 = String(d.getUTCMonth() + 1).padStart(2, "0");
      datePart2 = String(d.getUTCDate()).padStart(2, "0");
      datePart3 = String(d.getUTCFullYear());
    } else {
      // Fallback: put the whole string in the first box
      datePart1 = data.date;
    }
  }

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  @page { size: 11in 8.5in; margin: 0.3in 0.35in; }
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body {
    height: 100%;
    width: 100%;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 9pt;
    color: #000;
    line-height: 1.15;
  }
  table { border-collapse:collapse; }

  /* Generic bordered cell */
  .c {
    border: 1px solid #000;
    padding: 2px 4px;
    vertical-align: middle;
    font-size: 9pt;
  }

  /* Label cell — bold small text below a value cell */
  .lb {
    border: 1px solid #000;
    padding: 1px 4px;
    font-weight: bold;
    font-size: 7.5pt;
    vertical-align: top;
    height: 16px;
  }

  /* Value cell — data above its label */
  .v {
    border: 1px solid #000;
    padding: 2px 4px;
    font-size: 9pt;
    vertical-align: bottom;
    height: 22px;
  }

  /* Green sidebar cell with rotated text */
  .sb {
    background: #CCFFCC;
    border: 1px solid #000;
    text-align: center;
    vertical-align: middle;
    width: 24px;
    min-width: 24px;
    max-width: 24px;
  }
  .sb div {
    writing-mode: vertical-rl;
    transform: rotate(180deg);
    font-weight: bold;
    font-size: 7pt;
    text-transform: uppercase;
    white-space: nowrap;
    letter-spacing: 0.5px;
  }

  /* Black header row for line items */
  .hd {
    background: #000;
    color: #fff;
    border: 1px solid #000;
    padding: 3px 4px;
    font-weight: bold;
    font-size: 7.5pt;
  }

  /* Date sub-boxes */
  .date-box {
    border: 1px solid #000;
    display: inline-block;
    width: 32px;
    height: 18px;
    text-align: center;
    vertical-align: middle;
    font-size: 9pt;
    line-height: 18px;
    margin-right: -1px;
  }
</style>
</head>
<body>

<!-- Outer page table -->
<table style="width:100%; height:100%;">
  <colgroup>
    <col style="width:24px;">
    <col>
  </colgroup>

  <!-- ═══ TITLE ═══ -->
  <tr>
    <td colspan="2" style="border:1px solid #000; text-align:center; padding:6px 0; height:38px;">
      <div style="font-weight:bold; font-size:11pt; line-height:1.3;">Los Angeles Pierce College</div>
      <div style="font-weight:bold; font-size:9pt;">INTER- DEPARTMENT BOOKSTORE PURCHASE REQUEST FORM</div>
    </td>
  </tr>

  <!-- ═══ SECTION 1: REQUESTING DEPARTMENT USE ═══ -->
  <tr>
    <td class="sb"><div>Requesting Department Use</div></td>
    <td style="border:1px solid #000; padding:0; vertical-align:top;">
      <table style="width:100%; table-layout:fixed;">

        <!-- Row 1: Date boxes | Dept or Unit Requesting Services | Document # -->
        <tr>
          <td class="v" style="width:16%; padding:3px 4px;">
            <span class="date-box">${datePart1}</span><span class="date-box">${datePart2}</span><span class="date-box" style="width:44px;">${datePart3}</span>
          </td>
          <td class="v" style="width:54%;">${data.department}</td>
          <td class="v" style="width:30%;">${data.documentNumber}</td>
        </tr>
        <tr>
          <td class="lb" style="width:16%;">Date</td>
          <td class="lb" style="width:54%;">Department or Unit Requesting Services</td>
          <td class="lb" style="width:30%;">Document #</td>
        </tr>

        <!-- Row 2: Requesting Department | SAP Account | Estimated Cost -->
        <tr>
          <td class="v" colspan="1">${data.requestingDept}</td>
          <td class="v" colspan="1">${data.sapAccount}</td>
          <td class="v" colspan="1">${data.estimatedCost}</td>
        </tr>
        <tr>
          <td class="lb">Requesting Department</td>
          <td class="lb">SAP Account</td>
          <td class="lb">Estimated Cost</td>
        </tr>

        <!-- Row 3: Name of Dept Approver | Department Contact | Contact Phone -->
        <tr>
          <td class="v">${data.approverName}</td>
          <td class="v">${data.contactName}</td>
          <td class="v">${data.contactPhone}</td>
        </tr>
        <tr>
          <td class="lb">Name of Department Approver</td>
          <td class="lb">Department Contact</td>
          <td class="lb">Contact Phone</td>
        </tr>

        <!-- Comments row -->
        <tr>
          <td colspan="3" style="border:1px solid #000; padding:2px 4px; height:20px; vertical-align:top;">
            <span style="font-weight:bold; font-size:7.5pt;">Comments:</span>
            <span style="font-size:9pt; margin-left:4px;">${data.comments ?? ""}</span>
          </td>
        </tr>

        <!-- Signature row -->
        <tr>
          <td colspan="2" style="border:1px solid #000; padding:4px; height:36px; vertical-align:bottom;">
            <div style="border-bottom:1px solid #000; height:18px; margin-bottom:2px;"></div>
            <span style="font-weight:bold; font-size:7.5pt;">Signature of Department Approver</span>
          </td>
          <td style="border:1px solid #000; padding:4px; vertical-align:bottom;">
            <div style="border-bottom:1px solid #000; height:18px; margin-bottom:2px;"></div>
            <span style="font-weight:bold; font-size:7.5pt;">Date</span>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- ═══ SECTION 2: DEPARTMENT USE ═══ -->
  <tr>
    <td class="sb"><div>Department Use</div></td>
    <td style="border:1px solid #000; padding:0; vertical-align:top;">
      <table style="width:100%; table-layout:fixed;">
        <!-- Black header -->
        <tr>
          <td class="hd" style="width:53%;">Description of Product, Goods or Services Requested:</td>
          <td class="hd" style="width:9%; text-align:center;">Qty.</td>
          <td class="hd" style="width:17%; text-align:center;">Rate/Unit Price</td>
          <td class="hd" style="width:21%; text-align:right; padding-right:8px;">Extended Price</td>
        </tr>
        ${deptItemRows}
        <!-- Estimated Cost total row -->
        <tr>
          <td class="c" style="border-left:none; border-bottom:none;">&nbsp;</td>
          <td class="c" style="border-bottom:none;">&nbsp;</td>
          <td class="c" style="text-align:right; font-weight:bold; font-size:8pt;">Estimated Cost:</td>
          <td class="c" style="text-align:right; font-weight:bold; background:#f5f5dc;">${fmtPrice(data.totalAmount)}</td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- ═══ SECTION 3: BOOKSTORE USE ═══ -->
  <tr>
    <td class="sb"><div>Bookstore Use</div></td>
    <td style="border:1px solid #000; padding:0; vertical-align:top;">
      <table style="width:100%; table-layout:fixed;">
        <colgroup>
          <col style="width:62%;">
          <col style="width:17%;">
          <col style="width:21%;">
        </colgroup>
        ${bookstoreBlankRows}
        <!-- Description / Actual Cost summary row -->
        <tr>
          <td class="c" style="font-weight:bold; font-size:7.5pt; vertical-align:bottom; height:19px;">Description of Product, Goods or Services Provided:</td>
          <td class="c" style="text-align:right; font-weight:bold; font-size:8pt;">Actual Cost:</td>
          <td class="c" style="text-align:right; font-weight:bold; background:#f5f5dc;">${fmtPrice(data.totalAmount)}</td>
        </tr>
      </table>
    </td>
  </tr>

</table>

</body>
</html>`;
}
