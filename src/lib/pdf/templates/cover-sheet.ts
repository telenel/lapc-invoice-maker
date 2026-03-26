export interface CoverSheetData {
  date: string;
  semesterYearDept: string;
  invoiceNumber: string;
  chargeAccountNumber: string;
  accountCode: string;
  totalAmount: string;
  signatures: { name: string; title?: string }[];
  logoDataUri?: string;
}

export function renderCoverSheet(data: CoverSheetData): string {
  // Pad to 3 signature lines
  const sigs = [...(data.signatures ?? [])];
  while (sigs.length < 3) sigs.push({ name: "" });

  const signatureLines = sigs
    .slice(0, 3)
    .map(
      (sig) => `
      <div class="sig-block">
        <div class="sig-line"></div>
        <div class="sig-name">${sig.name}${sig.title ? `, ${sig.title}` : ""}</div>
      </div>`
    )
    .join("\n");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  @page {
    size: letter;
    margin: 0.75in 1in;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 14px;
    color: #000;
    line-height: 1.5;
  }

  /* Header */
  .logo-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
    padding-bottom: 8px;
    border-bottom: 3px solid #c00;
  }
  .logo-row img {
    height: 60px;
  }
  .logo-row .store-label {
    font-size: 18px;
    font-weight: bold;
    color: #333;
  }

  /* Memo fields */
  .memo-section {
    margin: 20px 0;
  }
  .memo-row {
    display: flex;
    margin-bottom: 6px;
    font-size: 15px;
  }
  .memo-label {
    font-weight: bold;
    width: 100px;
    flex-shrink: 0;
    font-size: 16px;
  }
  .memo-value {
    flex: 1;
    font-size: 15px;
  }

  /* Body text */
  .body-text {
    margin: 24px 0;
    font-size: 15px;
    line-height: 1.8;
  }
  .body-text .highlight {
    font-weight: bold;
    font-size: 22px;
  }

  /* Invoice fields */
  .invoice-fields {
    margin: 20px 0;
  }
  .field-row {
    display: flex;
    margin-bottom: 10px;
    align-items: baseline;
  }
  .field-label {
    font-weight: bold;
    font-size: 15px;
    width: 280px;
    flex-shrink: 0;
  }
  .field-value {
    flex: 1;
    border-bottom: 1px solid #000;
    padding: 2px 8px;
    font-size: 16px;
    min-height: 20px;
  }

  /* Divider */
  .divider {
    border: none;
    border-top: 2px solid #000;
    margin: 30px 0 20px 0;
  }

  /* Certification */
  .certification {
    font-size: 14px;
    font-weight: bold;
    margin-bottom: 12px;
    line-height: 1.6;
  }
  .approved {
    font-weight: bold;
    font-size: 17px;
    text-align: center;
    margin: 24px 0;
    text-decoration: underline;
  }

  /* Signatures */
  .signatures {
    margin-top: 20px;
  }
  .sig-block {
    margin-bottom: 32px;
  }
  .sig-line {
    border-bottom: 1px solid #000;
    height: 30px;
    width: 100%;
  }
  .sig-name {
    font-size: 15px;
    margin-top: 4px;
    color: #333;
  }
</style>
</head>
<body>

<div class="logo-row">
  <img src="${data.logoDataUri}" alt="Los Angeles Pierce College" />
  <div class="store-label">College Store</div>
</div>

<div class="memo-section">
  <div class="memo-row">
    <span class="memo-label">TO:</span>
    <span class="memo-value">ACCOUNTS PAYABLE</span>
  </div>
  <div class="memo-row">
    <span class="memo-label">FROM:</span>
    <span class="memo-value">PIERCE COLLEGE</span>
  </div>
  <div class="memo-row">
    <span class="memo-label">DATE:</span>
    <span class="memo-value">${data.date}</span>
  </div>
  <div class="memo-row">
    <span class="memo-label">SUBJECT:</span>
    <span class="memo-value">REQUEST TO PAY BOOKSTORE</span>
  </div>
</div>

<div class="body-text">
  This memorandum authorizes payment to the Pierce College Store for goods and/or services provided to the following department:<br/>
  <span class="highlight">${data.semesterYearDept}</span>
</div>

<div class="invoice-fields">
  <div class="field-row">
    <span class="field-label">INVOICE NUMBER:</span>
    <span class="field-value">${data.invoiceNumber}</span>
  </div>
  <div class="field-row">
    <span class="field-label">CHARGE ACCOUNT NUMBER:</span>
    <span class="field-value">${data.chargeAccountNumber}</span>
  </div>
  <div class="field-row">
    <span class="field-label">ACCOUNT CODE:</span>
    <span class="field-value">${data.accountCode}</span>
  </div>
  <div class="field-row">
    <span class="field-label">TOTAL PAYMENT AUTHORIZED:</span>
    <span class="field-value">${data.totalAmount}</span>
  </div>
</div>

<hr class="divider" />

<div class="certification">
  I certify that this expenditure is budgeted and approved for payment, please sign below:
</div>

<div class="approved">APPROVED FOR PAYMENT:</div>

<div class="signatures">
  ${signatureLines}
</div>

</body>
</html>`;
}
