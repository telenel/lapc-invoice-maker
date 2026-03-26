import { PDFDocument, rgb, degrees, PDFFont, PDFPage } from "pdf-lib";
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

// ═══════════════════════════════════════════════════════════════
// Layout Constants — Landscape Letter (792 x 612)
// ═══════════════════════════════════════════════════════════════

const PAGE_W = 792;
const PAGE_H = 612;
const MARGIN_L = 28;
const MARGIN_R = 28;
const MARGIN_T = 24;
const CONTENT_W = PAGE_W - MARGIN_L - MARGIN_R;

// Sidebar width
const SB_W = 22;

// Content area starts after sidebar
const INNER_L = MARGIN_L + SB_W;
const INNER_W = CONTENT_W - SB_W;

// Colors
const BLACK = rgb(0, 0, 0);
const WHITE = rgb(1, 1, 1);
const GREEN = rgb(0.8, 1, 0.8); // #CCFFCC
const DARK_BG = rgb(0.1, 0.1, 0.1); // near-black header
const LIGHT_FILL = rgb(0.96, 0.96, 0.86); // light yellow for totals

// Font sizes
const TITLE_SIZE = 11;
const SUBTITLE_SIZE = 8.5;
const LABEL_SIZE = 7;
const VALUE_SIZE = 8;
const HEADER_SIZE = 7;

// Row heights
const TITLE_H = 36;
const VALUE_ROW_H = 20;
const LABEL_ROW_H = 14;
const COMMENT_H = 18;
const SIG_H = 32;
const ITEM_HEADER_H = 16;
const ITEM_ROW_H = 17;
const ITEM_TOTAL_H = 17;

// ═══════════════════════════════════════════════════════════════
// Drawing helpers
// ═══════════════════════════════════════════════════════════════

function drawRect(
  page: PDFPage,
  x: number, y: number, w: number, h: number,
  opts?: { fill?: typeof BLACK; stroke?: boolean; lineWidth?: number }
) {
  const options: Parameters<typeof page.drawRectangle>[0] = {
    x, y, width: w, height: h,
    borderWidth: opts?.stroke !== false ? (opts?.lineWidth ?? 0.75) : 0,
    borderColor: BLACK,
  };
  if (opts?.fill) options.color = opts.fill;
  page.drawRectangle(options);
}

function drawText(
  page: PDFPage, font: PDFFont,
  x: number, y: number, str: string,
  opts?: { size?: number; bold?: boolean; boldFont?: PDFFont; maxWidth?: number; color?: typeof BLACK }
) {
  const size = opts?.size ?? VALUE_SIZE;
  const f = opts?.bold && opts.boldFont ? opts.boldFont : font;
  const color = opts?.color ?? BLACK;
  let s = str;
  if (opts?.maxWidth) {
    while (f.widthOfTextAtSize(s, size) > opts.maxWidth && s.length > 0) {
      s = s.slice(0, -1);
    }
  }
  page.drawText(s, { x, y, size, font: f, color });
}

function drawTextRight(
  page: PDFPage, font: PDFFont,
  xRight: number, y: number, str: string,
  opts?: { size?: number; bold?: boolean; boldFont?: PDFFont; color?: typeof BLACK }
) {
  const size = opts?.size ?? VALUE_SIZE;
  const f = opts?.bold && opts.boldFont ? opts.boldFont : font;
  const w = f.widthOfTextAtSize(str, size);
  page.drawText(str, { x: xRight - w, y, size, font: f, color: opts?.color ?? BLACK });
}

function drawTextCenter(
  page: PDFPage, font: PDFFont,
  xCenter: number, y: number, str: string,
  opts?: { size?: number; bold?: boolean; boldFont?: PDFFont; color?: typeof BLACK }
) {
  const size = opts?.size ?? VALUE_SIZE;
  const f = opts?.bold && opts.boldFont ? opts.boldFont : font;
  const w = f.widthOfTextAtSize(str, size);
  page.drawText(str, { x: xCenter - w / 2, y, size, font: f, color: opts?.color ?? BLACK });
}

function drawSidebar(
  page: PDFPage, font: PDFFont,
  x: number, y: number, h: number, label: string
) {
  // Green background
  drawRect(page, x, y, SB_W, h, { fill: GREEN });

  // Rotated text (vertical, bottom-to-top)
  const size = 6.5;
  const textW = font.widthOfTextAtSize(label, size);
  const textX = x + SB_W / 2 + size / 3;
  const textY = y + (h - textW) / 2;

  page.drawText(label, {
    x: textX,
    y: textY,
    size,
    font,
    color: BLACK,
    rotate: degrees(90),
  });
}

// ═══════════════════════════════════════════════════════════════
// Main generator
// ═══════════════════════════════════════════════════════════════

export async function generateIDPPage(data: IDPOverlayData): Promise<Buffer> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);

  // Embed fonts
  const fontRegPath = path.join(process.cwd(), "public", "fonts", "Arial-Regular.ttf");
  const fontBoldPath = path.join(process.cwd(), "public", "fonts", "Arial-Bold.ttf");
  const [fontRegBytes, fontBoldBytes] = await Promise.all([
    readFile(fontRegPath),
    readFile(fontBoldPath),
  ]);
  const font = await doc.embedFont(fontRegBytes);
  const fontBold = await doc.embedFont(fontBoldBytes);

  const page = doc.addPage([PAGE_W, PAGE_H]);

  // Parse date
  let dateMM = "", dateDD = "", dateYYYY = "";
  if (data.date) {
    const d = new Date(data.date);
    if (!isNaN(d.getTime())) {
      dateMM = String(d.getUTCMonth() + 1).padStart(2, "0");
      dateDD = String(d.getUTCDate()).padStart(2, "0");
      dateYYYY = String(d.getUTCFullYear());
    }
  }

  // ─── Drawing starts from the top ───
  // PDF y=0 is bottom, so we track cursor from top going down
  let curY = PAGE_H - MARGIN_T;

  // ═══════════════════════════════════════════════════════════════
  // TITLE ROW
  // ═══════════════════════════════════════════════════════════════
  const titleY = curY - TITLE_H;
  drawRect(page, MARGIN_L, titleY, CONTENT_W, TITLE_H);
  drawTextCenter(page, fontBold, MARGIN_L + CONTENT_W / 2, titleY + 20, "Los Angeles Pierce College", { size: TITLE_SIZE, bold: true, boldFont: fontBold });
  drawTextCenter(page, fontBold, MARGIN_L + CONTENT_W / 2, titleY + 7, "INTER- DEPARTMENT BOOKSTORE PURCHASE REQUEST FORM", { size: SUBTITLE_SIZE, bold: true, boldFont: fontBold });
  curY = titleY;

  // ═══════════════════════════════════════════════════════════════
  // SECTION 1: REQUESTING DEPARTMENT USE
  // ═══════════════════════════════════════════════════════════════
  const sec1Rows = VALUE_ROW_H * 3 + LABEL_ROW_H * 3 + COMMENT_H + SIG_H;
  const sec1Y = curY - sec1Rows;

  // Sidebar
  drawSidebar(page, fontBold, MARGIN_L, sec1Y, sec1Rows, "REQUESTING DEPARTMENT USE");

  // Column positions (3 columns)
  const col1W = Math.round(INNER_W * 0.35);
  const col2W = Math.round(INNER_W * 0.38);
  const col3W = INNER_W - col1W - col2W;
  const col1X = INNER_L;
  const col2X = col1X + col1W;
  const col3X = col2X + col2W;

  let rowY = curY;

  // --- Row 1: Value cells ---
  rowY -= VALUE_ROW_H;
  drawRect(page, col1X, rowY, col1W, VALUE_ROW_H);
  drawRect(page, col2X, rowY, col2W, VALUE_ROW_H);
  drawRect(page, col3X, rowY, col3W, VALUE_ROW_H);

  // Date boxes inside col1
  const boxW = 28;
  const boxH = 14;
  const boxY = rowY + 3;
  drawRect(page, col1X + 4, boxY, boxW, boxH);
  drawRect(page, col1X + 4 + boxW + 4, boxY, boxW, boxH);
  drawRect(page, col1X + 4 + (boxW + 4) * 2, boxY, boxW + 12, boxH);
  drawText(page, font, col1X + 8, boxY + 3, dateMM);
  drawText(page, font, col1X + 8 + boxW + 4, boxY + 3, dateDD);
  drawText(page, font, col1X + 8 + (boxW + 4) * 2, boxY + 3, dateYYYY);

  drawText(page, font, col2X + 4, rowY + 6, data.department, { maxWidth: col2W - 8 });
  drawText(page, font, col3X + 4, rowY + 6, data.documentNumber, { maxWidth: col3W - 8 });

  // --- Row 1: Label cells ---
  rowY -= LABEL_ROW_H;
  drawRect(page, col1X, rowY, col1W, LABEL_ROW_H);
  drawRect(page, col2X, rowY, col2W, LABEL_ROW_H);
  drawRect(page, col3X, rowY, col3W, LABEL_ROW_H);
  drawText(page, fontBold, col1X + 4, rowY + 3, "Date", { size: LABEL_SIZE, bold: true, boldFont: fontBold });
  drawText(page, fontBold, col2X + 4, rowY + 3, "Department or Unit Requesting Services", { size: LABEL_SIZE, bold: true, boldFont: fontBold });
  drawText(page, fontBold, col3X + 4, rowY + 3, "Document #", { size: LABEL_SIZE, bold: true, boldFont: fontBold });

  // --- Row 2: Value cells ---
  rowY -= VALUE_ROW_H;
  drawRect(page, col1X, rowY, col1W, VALUE_ROW_H);
  drawRect(page, col2X, rowY, col2W, VALUE_ROW_H);
  drawRect(page, col3X, rowY, col3W, VALUE_ROW_H);
  drawText(page, font, col1X + 4, rowY + 6, data.requestingDept, { maxWidth: col1W - 8 });
  drawText(page, font, col2X + 4, rowY + 6, data.sapAccount, { maxWidth: col2W - 8 });
  drawText(page, font, col3X + 4, rowY + 6, data.estimatedCost, { maxWidth: col3W - 8 });

  // --- Row 2: Label cells ---
  rowY -= LABEL_ROW_H;
  drawRect(page, col1X, rowY, col1W, LABEL_ROW_H);
  drawRect(page, col2X, rowY, col2W, LABEL_ROW_H);
  drawRect(page, col3X, rowY, col3W, LABEL_ROW_H);
  drawText(page, fontBold, col1X + 4, rowY + 3, "Requesting Department", { size: LABEL_SIZE, bold: true, boldFont: fontBold });
  drawText(page, fontBold, col2X + 4, rowY + 3, "SAP Account", { size: LABEL_SIZE, bold: true, boldFont: fontBold });
  drawText(page, fontBold, col3X + 4, rowY + 3, "Estimated Cost", { size: LABEL_SIZE, bold: true, boldFont: fontBold });

  // --- Row 3: Value cells ---
  rowY -= VALUE_ROW_H;
  drawRect(page, col1X, rowY, col1W, VALUE_ROW_H);
  drawRect(page, col2X, rowY, col2W, VALUE_ROW_H);
  drawRect(page, col3X, rowY, col3W, VALUE_ROW_H);
  drawText(page, font, col1X + 4, rowY + 6, data.approverName, { maxWidth: col1W - 8 });
  drawText(page, font, col2X + 4, rowY + 6, data.contactName, { maxWidth: col2W - 8 });
  drawText(page, font, col3X + 4, rowY + 6, data.contactPhone, { maxWidth: col3W - 8 });

  // --- Row 3: Label cells ---
  rowY -= LABEL_ROW_H;
  drawRect(page, col1X, rowY, col1W, LABEL_ROW_H);
  drawRect(page, col2X, rowY, col2W, LABEL_ROW_H);
  drawRect(page, col3X, rowY, col3W, LABEL_ROW_H);
  drawText(page, fontBold, col1X + 4, rowY + 3, "Name of Department Approver", { size: LABEL_SIZE, bold: true, boldFont: fontBold });
  drawText(page, fontBold, col2X + 4, rowY + 3, "Department Contact", { size: LABEL_SIZE, bold: true, boldFont: fontBold });
  drawText(page, fontBold, col3X + 4, rowY + 3, "Contact Phone", { size: LABEL_SIZE, bold: true, boldFont: fontBold });

  // --- Comments row ---
  rowY -= COMMENT_H;
  drawRect(page, col1X, rowY, INNER_W, COMMENT_H);
  drawText(page, fontBold, col1X + 4, rowY + 6, "Comments:", { size: LABEL_SIZE, bold: true, boldFont: fontBold });
  if (data.comments) {
    drawText(page, font, col1X + 60, rowY + 6, data.comments, { size: 7, maxWidth: INNER_W - 68 });
  }

  // --- Signature row ---
  rowY -= SIG_H;
  const sigCol1W = Math.round(INNER_W * 0.65);
  const sigCol2W = INNER_W - sigCol1W;
  drawRect(page, col1X, rowY, sigCol1W, SIG_H);
  drawRect(page, col1X + sigCol1W, rowY, sigCol2W, SIG_H);

  // Signature line
  page.drawLine({ start: { x: col1X + 8, y: rowY + 14 }, end: { x: col1X + sigCol1W - 8, y: rowY + 14 }, thickness: 0.5, color: BLACK });
  drawText(page, fontBold, col1X + 4, rowY + 3, "Signature of Department Approver", { size: LABEL_SIZE, bold: true, boldFont: fontBold });

  // Date line in signature
  page.drawLine({ start: { x: col1X + sigCol1W + 8, y: rowY + 14 }, end: { x: col1X + INNER_W - 8, y: rowY + 14 }, thickness: 0.5, color: BLACK });
  drawText(page, fontBold, col1X + sigCol1W + 4, rowY + 3, "Date", { size: LABEL_SIZE, bold: true, boldFont: fontBold });

  curY = rowY;

  // ═══════════════════════════════════════════════════════════════
  // SECTION 2: DEPARTMENT USE
  // ═══════════════════════════════════════════════════════════════
  const sec2Rows = ITEM_HEADER_H + ITEM_ROW_H * 4 + ITEM_TOTAL_H;
  const sec2Y = curY - sec2Rows;

  drawSidebar(page, fontBold, MARGIN_L, sec2Y, sec2Rows, "Department Use");

  // Column positions for items
  const descW = Math.round(INNER_W * 0.55);
  const qtyW = Math.round(INNER_W * 0.08);
  const priceW = Math.round(INNER_W * 0.17);
  const extW = INNER_W - descW - qtyW - priceW;
  const descX = INNER_L;
  const qtyX = descX + descW;
  const priceX = qtyX + qtyW;
  const extX = priceX + priceW;

  rowY = curY;

  // --- Black header row ---
  rowY -= ITEM_HEADER_H;
  drawRect(page, descX, rowY, descW, ITEM_HEADER_H, { fill: DARK_BG });
  drawRect(page, qtyX, rowY, qtyW, ITEM_HEADER_H, { fill: DARK_BG });
  drawRect(page, priceX, rowY, priceW, ITEM_HEADER_H, { fill: DARK_BG });
  drawRect(page, extX, rowY, extW, ITEM_HEADER_H, { fill: DARK_BG });
  drawText(page, fontBold, descX + 4, rowY + 4, "Description of Product, Goods or Services Requested:", { size: HEADER_SIZE, bold: true, boldFont: fontBold, color: WHITE });
  drawTextCenter(page, fontBold, qtyX + qtyW / 2, rowY + 4, "Qty.", { size: HEADER_SIZE, bold: true, boldFont: fontBold, color: WHITE });
  drawTextCenter(page, fontBold, priceX + priceW / 2, rowY + 4, "Rate/Unit Price", { size: HEADER_SIZE, bold: true, boldFont: fontBold, color: WHITE });
  drawTextRight(page, fontBold, extX + extW - 4, rowY + 4, "Extended Price", { size: HEADER_SIZE, bold: true, boldFont: fontBold, color: WHITE });

  // --- 4 item rows ---
  for (let i = 0; i < 4; i++) {
    rowY -= ITEM_ROW_H;
    drawRect(page, descX, rowY, descW, ITEM_ROW_H);
    drawRect(page, qtyX, rowY, qtyW, ITEM_ROW_H);
    drawRect(page, priceX, rowY, priceW, ITEM_ROW_H);
    drawRect(page, extX, rowY, extW, ITEM_ROW_H);

    const item = data.items[i];
    if (item) {
      drawText(page, font, descX + 4, rowY + 5, item.description, { maxWidth: descW - 8 });
      drawTextCenter(page, font, qtyX + qtyW / 2, rowY + 5, item.quantity);
      drawTextRight(page, font, priceX + priceW - 4, rowY + 5, item.unitPrice);
      drawTextRight(page, font, extX + extW - 4, rowY + 5, item.extendedPrice);
    } else {
      // Empty row placeholder
      drawTextRight(page, font, extX + extW - 4, rowY + 5, "$ -");
    }
  }

  // --- Estimated Cost total row ---
  rowY -= ITEM_TOTAL_H;
  drawRect(page, descX, rowY, descW, ITEM_TOTAL_H);
  drawRect(page, qtyX, rowY, qtyW, ITEM_TOTAL_H);
  drawRect(page, priceX, rowY, priceW, ITEM_TOTAL_H);
  drawRect(page, extX, rowY, extW, ITEM_TOTAL_H, { fill: LIGHT_FILL });
  drawTextRight(page, fontBold, priceX + priceW - 4, rowY + 5, "Estimated Cost:", { size: HEADER_SIZE, bold: true, boldFont: fontBold });
  drawTextRight(page, fontBold, extX + extW - 4, rowY + 5, data.totalAmount, { bold: true, boldFont: fontBold });

  curY = rowY;

  // ═══════════════════════════════════════════════════════════════
  // SECTION 3: BOOKSTORE USE
  // ═══════════════════════════════════════════════════════════════
  const sec3Rows = ITEM_ROW_H * 4 + ITEM_TOTAL_H;
  const sec3Y = curY - sec3Rows;

  drawSidebar(page, fontBold, MARGIN_L, sec3Y, sec3Rows, "Bookstore Use");

  // Bookstore uses 3 columns: description (wide), cost label area, amount
  const bkDescW = descW + qtyW; // description spans wider
  const bkPriceW = priceW;
  const bkExtW = extW;
  const bkDescX = INNER_L;
  const bkPriceX = bkDescX + bkDescW;
  const bkExtX = bkPriceX + bkPriceW;

  rowY = curY;

  // --- 4 blank rows ---
  for (let i = 0; i < 4; i++) {
    rowY -= ITEM_ROW_H;
    drawRect(page, bkDescX, rowY, bkDescW, ITEM_ROW_H);
    drawRect(page, bkPriceX, rowY, bkPriceW, ITEM_ROW_H);
    drawRect(page, bkExtX, rowY, bkExtW, ITEM_ROW_H);
    drawTextRight(page, font, bkExtX + bkExtW - 4, rowY + 5, "$ -");
  }

  // --- Actual Cost total row ---
  rowY -= ITEM_TOTAL_H;
  drawRect(page, bkDescX, rowY, bkDescW, ITEM_TOTAL_H);
  drawRect(page, bkPriceX, rowY, bkPriceW, ITEM_TOTAL_H);
  drawRect(page, bkExtX, rowY, bkExtW, ITEM_TOTAL_H, { fill: LIGHT_FILL });
  drawText(page, fontBold, bkDescX + 4, rowY + 4, "Description of Product, Goods or Services Provided:", { size: HEADER_SIZE, bold: true, boldFont: fontBold });
  drawTextRight(page, fontBold, bkPriceX + bkPriceW - 4, rowY + 5, "Actual Cost:", { size: HEADER_SIZE, bold: true, boldFont: fontBold });
  drawTextRight(page, fontBold, bkExtX + bkExtW - 4, rowY + 5, data.totalAmount, { bold: true, boldFont: fontBold });

  // Save
  const pdfBytes = await doc.save();
  return Buffer.from(pdfBytes);
}
