export interface CoverSheetData {
  date: string;
  semesterYearDept: string;
  invoiceNumber: string;
  chargeAccountNumber: string;
  accountCode: string;
  totalAmount: string;
  signatures: { name: string; title?: string }[];
}

export function renderCoverSheet(data: CoverSheetData): string {
  const signatureLines = (data.signatures ?? [])
    .slice(0, 3)
    .map(
      (sig) => `
      <div style="display:flex; align-items:flex-end; margin-bottom:24px;">
        <div style="flex:1; border-bottom:1px solid #000; height:28px; margin-right:16px;"></div>
        <div style="width:200px; text-align:center;">
          <div style="font-size:11px;">${sig.name}</div>
          ${sig.title ? `<div style="font-size:10px; color:#555;">${sig.title}</div>` : ""}
        </div>
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
    margin: 0.75in;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: "Times New Roman", Times, serif;
    font-size: 12px;
    color: #000;
    line-height: 1.4;
  }
  .header {
    text-align: right;
    font-size: 14px;
    font-weight: bold;
    margin-bottom: 24px;
  }
  .field-row {
    display: flex;
    margin-bottom: 8px;
    font-size: 12px;
  }
  .field-label {
    font-weight: bold;
    width: 160px;
    flex-shrink: 0;
  }
  .field-value {
    flex: 1;
    border-bottom: 1px solid #000;
    padding-left: 4px;
    min-height: 18px;
  }
  .body-text {
    margin: 24px 0;
    font-size: 12px;
    line-height: 1.6;
  }
  .divider {
    border: none;
    border-top: 2px solid #000;
    margin: 24px 0;
  }
  .certification {
    font-size: 11px;
    margin-bottom: 16px;
    line-height: 1.5;
  }
  .approved {
    font-weight: bold;
    font-size: 13px;
    text-align: center;
    margin: 20px 0;
  }
  .signatures {
    margin-top: 32px;
  }
</style>
</head>
<body>

<div class="header">College Store</div>

<div class="field-row">
  <span class="field-label">TO:</span>
  <span class="field-value">ACCOUNTS PAYABLE</span>
</div>
<div class="field-row">
  <span class="field-label">FROM:</span>
  <span class="field-value">PIERCE COLLEGE</span>
</div>
<div class="field-row">
  <span class="field-label">DATE:</span>
  <span class="field-value">${data.date}</span>
</div>
<div class="field-row">
  <span class="field-label">SUBJECT:</span>
  <span class="field-value">REQUEST TO PAY BOOKSTORE</span>
</div>

<div class="body-text">
  Please pay the Pierce College Store for Supplies, Food Catering, and/or Books for:
  <strong>${data.semesterYearDept}</strong>
</div>

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

<hr class="divider" />

<div class="certification">
  I certify that the above items have been received and/or services have been rendered,
  and that the charges are correct and proper for payment from the funds indicated.
</div>

<div class="approved">APPROVED FOR PAYMENT</div>

<div class="signatures">
  ${signatureLines}
</div>

</body>
</html>`;
}
