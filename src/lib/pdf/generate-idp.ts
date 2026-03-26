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
const MARGIN = 24;
const CONTENT_W = PAGE_W - MARGIN * 2;
const CONTENT_H = PAGE_H - MARGIN * 2;

const SB_W = 22;
const INNER_L = MARGIN + SB_W;
const INNER_W = CONTENT_W - SB_W;

const BLACK = rgb(0, 0, 0);
const WHITE = rgb(1, 1, 1);
const GREEN = rgb(0.8, 1, 0.8);
const DARK_BG = rgb(0.1, 0.1, 0.1);
const LIGHT_FILL = rgb(0.96, 0.96, 0.86);

// ═══════════════════════════════════════════════════════════════
// Drawing helpers
// ═══════════════════════════════════════════════════════════════

function rect(
  page: PDFPage, x: number, y: number, w: number, h: number,
  opts?: { fill?: typeof BLACK; lineWidth?: number; noStroke?: boolean }
) {
  page.drawRectangle({
    x, y, width: w, height: h,
    borderWidth: opts?.noStroke ? 0 : (opts?.lineWidth ?? 0.75),
    borderColor: BLACK,
    ...(opts?.fill ? { color: opts.fill } : {}),
  });
}

function txt(
  page: PDFPage, f: PDFFont,
  x: number, y: number, s: string,
  opts?: { size?: number; maxWidth?: number; color?: typeof BLACK }
) {
  const size = opts?.size ?? 8;
  let str = s;
  if (opts?.maxWidth) {
    while (f.widthOfTextAtSize(str, size) > opts.maxWidth && str.length > 0) str = str.slice(0, -1);
  }
  page.drawText(str, { x, y, size, font: f, color: opts?.color ?? BLACK });
}

function txtR(page: PDFPage, f: PDFFont, xR: number, y: number, s: string, opts?: { size?: number; color?: typeof BLACK }) {
  const size = opts?.size ?? 8;
  page.drawText(s, { x: xR - f.widthOfTextAtSize(s, size), y, size, font: f, color: opts?.color ?? BLACK });
}

function txtC(page: PDFPage, f: PDFFont, xC: number, y: number, s: string, opts?: { size?: number; color?: typeof BLACK }) {
  const size = opts?.size ?? 8;
  page.drawText(s, { x: xC - f.widthOfTextAtSize(s, size) / 2, y, size, font: f, color: opts?.color ?? BLACK });
}

function line(page: PDFPage, x1: number, y1: number, x2: number, y2: number, w = 0.75) {
  page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: w, color: BLACK });
}

function drawSidebar(page: PDFPage, f: PDFFont, x: number, y: number, h: number, label: string) {
  rect(page, x, y, SB_W, h, { fill: GREEN });
  const size = 6.5;
  const tw = f.widthOfTextAtSize(label, size);
  page.drawText(label, {
    x: x + SB_W / 2 + size / 3,
    y: y + (h - tw) / 2,
    size, font: f, color: BLACK,
    rotate: degrees(90),
  });
}

// Draws a label with underline
function drawLabel(page: PDFPage, f: PDFFont, x: number, y: number, label: string, size = 8) {
  txt(page, f, x, y, label, { size });
  const w = f.widthOfTextAtSize(label, size);
  line(page, x, y - 1, x + w, y - 1, 0.5);
}

// ═══════════════════════════════════════════════════════════════
// Main generator
// ═══════════════════════════════════════════════════════════════

export async function generateIDPPage(data: IDPOverlayData): Promise<Buffer> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);

  const fontRegPath = path.join(process.cwd(), "public", "fonts", "Arial-Regular.ttf");
  const fontBoldPath = path.join(process.cwd(), "public", "fonts", "Arial-Bold.ttf");
  const [fontRegBytes, fontBoldBytes] = await Promise.all([readFile(fontRegPath), readFile(fontBoldPath)]);
  const font = await doc.embedFont(fontRegBytes);
  const bold = await doc.embedFont(fontBoldBytes);

  const page = doc.addPage([PAGE_W, PAGE_H]);

  // Parse date as M-DD-YYYY
  let dateStr = "";
  if (data.date) {
    const d = new Date(data.date);
    if (!isNaN(d.getTime())) {
      dateStr = `${d.getUTCMonth() + 1}-${d.getUTCDate()}-${d.getUTCFullYear()}`;
    }
  }

  // ─── Calculate heights to fill the page ───
  const TITLE_H = 36;
  const FIELD_PAIR_H = 32;  // value + label together
  const COMMENT_H = 22;
  const SIG_H = 36;
  const ITEM_HEADER_H = 16;
  const ITEM_TOTAL_H = 18;

  const sec1H = FIELD_PAIR_H * 3 + COMMENT_H + SIG_H;
  const sec1And2Fixed = TITLE_H + sec1H + ITEM_HEADER_H + ITEM_TOTAL_H * 2; // 2 totals (est + actual)

  // Remaining space split between Dept Use items (4) and Bookstore Use items (4)
  const remainH = CONTENT_H - sec1And2Fixed;
  const totalItemRows = 8; // 4 dept + 4 bookstore
  const ITEM_ROW_H = Math.floor(remainH / totalItemRows);

  const sec2H = ITEM_HEADER_H + ITEM_ROW_H * 4 + ITEM_TOTAL_H;
  const sec3H = ITEM_ROW_H * 4 + ITEM_TOTAL_H;

  // ─── Draw from top ───
  let curY = PAGE_H - MARGIN;

  // ═══ TITLE ═══
  const titleY = curY - TITLE_H;
  rect(page, MARGIN, titleY, CONTENT_W, TITLE_H);
  txtC(page, bold, MARGIN + CONTENT_W / 2, titleY + 20, "Los Angeles Pierce College", { size: 11 });
  txtC(page, bold, MARGIN + CONTENT_W / 2, titleY + 7, "INTER- DEPARTMENT BOOKSTORE PURCHASE REQUEST FORM", { size: 8.5 });
  curY = titleY;

  // ═══ SECTION 1: REQUESTING DEPARTMENT USE ═══
  const sec1Y = curY - sec1H;
  drawSidebar(page, bold, MARGIN, sec1Y, sec1H, "REQUESTING DEPARTMENT USE");

  // 3 columns
  const c1W = Math.round(INNER_W * 0.35);
  const c2W = Math.round(INNER_W * 0.38);
  const c3W = INNER_W - c1W - c2W;
  const c1X = INNER_L;
  const c2X = c1X + c1W;
  const c3X = c2X + c2W;

  let y = curY;

  // Helper: draw a field pair (value on top, bold underlined label on bottom)
  // The entire pair is one outlined box
  function fieldPair(
    x: number, yTop: number, w: number,
    value: string, label: string
  ) {
    rect(page, x, yTop - FIELD_PAIR_H, w, FIELD_PAIR_H);
    // Value in upper portion
    txt(page, font, x + 5, yTop - 14, value, { size: 9, maxWidth: w - 10 });
    // Bold underlined label in lower portion
    drawLabel(page, bold, x + 5, yTop - FIELD_PAIR_H + 5, label, 8);
  }

  // Row 1: Date | Dept or Unit Requesting Services | Document #
  fieldPair(c1X, y, c1W, dateStr, "Date");
  fieldPair(c2X, y, c2W, data.department, "Department or Unit Requesting Services");
  fieldPair(c3X, y, c3W, data.documentNumber, "Document #");
  y -= FIELD_PAIR_H;

  // Row 2: Requesting Dept | SAP Account | Estimated Cost
  fieldPair(c1X, y, c1W, data.requestingDept, "Requesting Department");
  fieldPair(c2X, y, c2W, data.sapAccount, "SAP Account");
  fieldPair(c3X, y, c3W, data.estimatedCost, "Estimated Cost");
  y -= FIELD_PAIR_H;

  // Row 3: Name of Dept Approver | Department Contact | Contact Phone
  fieldPair(c1X, y, c1W, data.approverName, "Name of Department Approver");
  fieldPair(c2X, y, c2W, data.contactName, "Department Contact");
  fieldPair(c3X, y, c3W, data.contactPhone, "Contact Phone");
  y -= FIELD_PAIR_H;

  // Comments row
  rect(page, c1X, y - COMMENT_H, INNER_W, COMMENT_H);
  txt(page, bold, c1X + 5, y - 14, "Comments:", { size: 8 });
  if (data.comments) {
    txt(page, font, c1X + 70, y - 14, data.comments, { size: 7.5, maxWidth: INNER_W - 80 });
  }
  y -= COMMENT_H;

  // Signature row
  const sigW1 = Math.round(INNER_W * 0.65);
  const sigW2 = INNER_W - sigW1;
  rect(page, c1X, y - SIG_H, sigW1, SIG_H);
  rect(page, c1X + sigW1, y - SIG_H, sigW2, SIG_H);
  line(page, c1X + 8, y - SIG_H + 16, c1X + sigW1 - 8, y - SIG_H + 16, 0.5);
  drawLabel(page, bold, c1X + 5, y - SIG_H + 5, "Signature of Department Approver", 8);
  line(page, c1X + sigW1 + 8, y - SIG_H + 16, c1X + INNER_W - 8, y - SIG_H + 16, 0.5);
  drawLabel(page, bold, c1X + sigW1 + 5, y - SIG_H + 5, "Date", 8);
  y -= SIG_H;

  curY = y;

  // ═══ SECTION 2: DEPARTMENT USE ═══
  const sec2Y = curY - sec2H;
  drawSidebar(page, bold, MARGIN, sec2Y, sec2H, "Department Use");

  // Item columns
  const dW = Math.round(INNER_W * 0.55);
  const qW = Math.round(INNER_W * 0.08);
  const pW = Math.round(INNER_W * 0.17);
  const eW = INNER_W - dW - qW - pW;
  const dX = INNER_L;
  const qX = dX + dW;
  const pX = qX + qW;
  const eX = pX + pW;

  y = curY;

  // Black header
  y -= ITEM_HEADER_H;
  rect(page, dX, y, INNER_W, ITEM_HEADER_H, { fill: DARK_BG });
  txt(page, bold, dX + 4, y + 4, "Description of Product, Goods or Services Requested:", { size: 7, color: WHITE });
  txtC(page, bold, qX + qW / 2, y + 4, "Qty.", { size: 7, color: WHITE });
  txtC(page, bold, pX + pW / 2, y + 4, "Rate/Unit Price", { size: 7, color: WHITE });
  txtR(page, bold, eX + eW - 4, y + 4, "Extended Price", { size: 7, color: WHITE });

  // Draw the outer box for all item rows + total (continuous border)
  const itemsBlockH = ITEM_ROW_H * 4 + ITEM_TOTAL_H;
  rect(page, dX, y - itemsBlockH, INNER_W, itemsBlockH);

  // Vertical column lines spanning the full items block
  line(page, qX, y, qX, y - itemsBlockH);
  line(page, pX, y, pX, y - itemsBlockH);
  line(page, eX, y, eX, y - itemsBlockH);

  // 4 item rows (horizontal lines between them)
  for (let i = 0; i < 4; i++) {
    const rowTop = y - i * ITEM_ROW_H;
    if (i > 0) {
      line(page, dX, rowTop, dX + INNER_W, rowTop);
    }

    const item = data.items[i];
    const textY = rowTop - ITEM_ROW_H + 5;
    if (item) {
      txt(page, font, dX + 4, textY, item.description, { maxWidth: dW - 8 });
      txtC(page, font, qX + qW / 2, textY, item.quantity);
      txtR(page, font, pX + pW - 4, textY, item.unitPrice);
      txtR(page, font, eX + eW - 4, textY, item.extendedPrice);
    } else {
      txtR(page, font, eX + eW - 4, textY, "$ -");
    }
  }

  // Estimated Cost total row
  const estY = y - ITEM_ROW_H * 4;
  line(page, dX, estY, dX + INNER_W, estY); // horizontal separator
  rect(page, eX, estY - ITEM_TOTAL_H, eW, ITEM_TOTAL_H, { fill: LIGHT_FILL, noStroke: true });
  txtR(page, bold, pX + pW - 4, estY - ITEM_TOTAL_H + 5, "Estimated Cost:", { size: 7.5 });
  txtR(page, bold, eX + eW - 4, estY - ITEM_TOTAL_H + 5, data.totalAmount);

  curY = y - itemsBlockH;

  // ═══ SECTION 3: BOOKSTORE USE ═══
  const sec3Y = curY - sec3H;
  drawSidebar(page, bold, MARGIN, sec3Y, sec3H, "Bookstore Use");

  const bDW = dW + qW;
  const bPW = pW;
  const bEW = eW;
  const bDX = INNER_L;
  const bPX = bDX + bDW;
  const bEX = bPX + bPW;

  y = curY;

  // Outer box for all bookstore rows
  rect(page, bDX, y - sec3H, INNER_W, sec3H);
  line(page, bPX, y, bPX, y - sec3H);
  line(page, bEX, y, bEX, y - sec3H);

  // 4 blank rows
  for (let i = 0; i < 4; i++) {
    const rowTop = y - i * ITEM_ROW_H;
    if (i > 0) {
      line(page, bDX, rowTop, bDX + INNER_W, rowTop);
    }
    txtR(page, font, bEX + bEW - 4, rowTop - ITEM_ROW_H + 5, "$ -");
  }

  // Actual Cost total row
  const actY = y - ITEM_ROW_H * 4;
  line(page, bDX, actY, bDX + INNER_W, actY);
  rect(page, bEX, actY - ITEM_TOTAL_H, bEW, ITEM_TOTAL_H, { fill: LIGHT_FILL, noStroke: true });
  txt(page, bold, bDX + 4, actY - ITEM_TOTAL_H + 5, "Description of Product, Goods or Services Provided:", { size: 7 });
  txtR(page, bold, bPX + bPW - 4, actY - ITEM_TOTAL_H + 5, "Actual Cost:", { size: 7.5 });
  txtR(page, bold, bEX + bEW - 4, actY - ITEM_TOTAL_H + 5, data.totalAmount);

  const pdfBytes = await doc.save();
  return Buffer.from(pdfBytes);
}
