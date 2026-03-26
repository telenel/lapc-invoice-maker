import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { readFile } from "fs/promises";
import path from "path";

export interface IDPOverlayData {
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
  items: {
    description: string;
    quantity: string;
    unitPrice: string;
    extendedPrice: string;
  }[];
  totalAmount: string;
}

/**
 * Generates the IDP page by overlaying data onto the template PDF.
 * Returns a Buffer of the single-page PDF.
 */
export async function generateIDPPage(data: IDPOverlayData): Promise<Buffer> {
  const templatePath = path.join(process.cwd(), "public", "idp-template.pdf");
  const templateBytes = await readFile(templatePath);
  const doc = await PDFDocument.load(templateBytes);
  doc.registerFontkit(fontkit);
  const page = doc.getPage(0);

  // Embed Arial (full Unicode Latin coverage) for all text
  const fontRegPath = path.join(process.cwd(), "public", "fonts", "Arial-Regular.ttf");
  const fontBoldPath = path.join(process.cwd(), "public", "fonts", "Arial-Bold.ttf");
  const [fontRegBytes, fontBoldBytes] = await Promise.all([
    readFile(fontRegPath),
    readFile(fontBoldPath),
  ]);
  const font = await doc.embedFont(fontRegBytes);
  const fontBold = await doc.embedFont(fontBoldBytes);
  const black = rgb(0, 0, 0);
  const white = rgb(1, 1, 1);

  // Helper: draw a white rectangle to cover template placeholder text
  function clearArea(x: number, y: number, w: number, h: number) {
    page.drawRectangle({ x, y, width: w, height: h, color: white });
  }

  function text(
    x: number,
    y: number,
    str: string,
    opts?: { size?: number; bold?: boolean; maxWidth?: number }
  ) {
    const size = opts?.size ?? 8;
    const f = opts?.bold ? fontBold : font;
    let s = str;
    if (opts?.maxWidth) {
      while (f.widthOfTextAtSize(s, size) > opts.maxWidth && s.length > 0) {
        s = s.slice(0, -1);
      }
    }
    page.drawText(s, { x, y, size, font: f, color: black });
  }

  function textRight(
    xRight: number,
    y: number,
    str: string,
    opts?: { size?: number; bold?: boolean }
  ) {
    const size = opts?.size ?? 8;
    const f = opts?.bold ? fontBold : font;
    const w = f.widthOfTextAtSize(str, size);
    page.drawText(str, { x: xRight - w, y, size, font: f, color: black });
  }

  function textCenter(
    xCenter: number,
    y: number,
    str: string,
    opts?: { size?: number }
  ) {
    const size = opts?.size ?? 8;
    const w = font.widthOfTextAtSize(str, size);
    page.drawText(str, { x: xCenter - w / 2, y, size, font, color: black });
  }

  // Parse date
  let dateMM = "";
  let dateDD = "";
  let dateYYYY = "";
  if (data.date) {
    const d = new Date(data.date);
    if (!isNaN(d.getTime())) {
      dateMM = String(d.getUTCMonth() + 1).padStart(2, "0");
      dateDD = String(d.getUTCDate()).padStart(2, "0");
      dateYYYY = String(d.getUTCFullYear());
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // SECTION 1: REQUESTING DEPARTMENT USE
  // Each row pair: value cell (top) then label cell (bottom).
  // We write into the value cells, a few px above the label.
  // ═══════════════════════════════════════════════════════════════

  // Row 1: Date | Department or Unit Requesting Services | Document #
  text(80, 553, dateMM, { size: 8 });
  text(118, 553, dateDD, { size: 8 });
  text(153, 553, dateYYYY, { size: 8 });
  text(255, 553, data.department, { size: 8, maxWidth: 340 });
  text(645, 553, data.documentNumber, { size: 8, maxWidth: 110 });

  // Row 2: Requesting Department | SAP Account | Estimated Cost
  text(78, 514, data.requestingDept, { size: 8, maxWidth: 270 });
  text(415, 514, data.sapAccount, { size: 8, maxWidth: 185 });
  text(645, 514, data.estimatedCost, { size: 8, maxWidth: 110 });

  // Row 3: Name of Department Approver | Department Contact | Contact Phone
  // Clear template's "Carmell Stoianov" sample data in Department Contact cell
  clearArea(408, 472, 200, 18);
  text(78, 478, data.approverName, { size: 8, maxWidth: 270 });
  text(415, 478, data.contactName, { size: 8, maxWidth: 185 });
  text(645, 478, data.contactPhone, { size: 8, maxWidth: 110 });

  // Comments (after "Comments:" label at ~y448)
  if (data.comments) {
    text(470, 448, data.comments, { size: 7, maxWidth: 285 });
  }

  // ═══════════════════════════════════════════════════════════════
  // SECTION 2: DEPARTMENT USE (line items)
  // Black header row is around y ~375-365
  // First data row: y ~352
  // Row height: ~18px
  // Columns from grid:
  //   Description: x:78
  //   Qty (centered): ~x:590
  //   Rate/Unit Price (right-aligned): right edge ~x:700
  //   Extended Price (right-aligned): right edge ~x:755
  // ═══════════════════════════════════════════════════════════════

  // Line items: 4 rows between black header and Estimated Cost row
  const itemStartY = 358;
  const itemRowHeight = 17;

  // Clear template's "$ -" placeholders in all 4 Extended Price cells + Estimated Cost
  // Clear "$ -" placeholders in Extended Price column only (x:700 to x:758)
  // Don't go too far left or we'll cover the "Estimated Cost:" label
  for (let i = 0; i < 4; i++) {
    const clearY = itemStartY - i * itemRowHeight - 5;
    clearArea(700, clearY, 58, 17);
  }
  // Clear Estimated Cost total cell — only the value area, not the label
  clearArea(700, itemStartY - 4 * itemRowHeight - 5, 58, 17);

  for (let i = 0; i < 4; i++) {
    const item = data.items[i];
    if (!item) break;
    const y = itemStartY - i * itemRowHeight;

    if (item.description) {
      text(78, y, item.description, { size: 7.5, maxWidth: 470 });
    }
    if (item.quantity) {
      textCenter(590, y, item.quantity, { size: 7.5 });
    }
    if (item.unitPrice) {
      textRight(695, y, item.unitPrice, { size: 7.5 });
    }
    if (item.extendedPrice) {
      textRight(738, y, item.extendedPrice, { size: 7.5 });
    }
  }

  // Estimated Cost total
  const estCostY = itemStartY - 4 * itemRowHeight;
  textRight(738, estCostY, data.totalAmount, { size: 7.5, bold: true });

  // ═══════════════════════════════════════════════════════════════
  // SECTION 3: BOOKSTORE USE
  // Actual Cost total — from grid around y:190
  // ═══════════════════════════════════════════════════════════════
  // Clear template's "$ -" placeholders in Bookstore Use section
  // 4 blank rows + Actual Cost total — only the value column
  for (let i = 0; i < 5; i++) {
    clearArea(700, 253 - i * 17 - 5, 58, 17);
  }
  // Actual Cost total
  textRight(738, 196, data.totalAmount, { size: 7.5, bold: true });

  const pdfBytes = await doc.save();
  return Buffer.from(pdfBytes);
}
