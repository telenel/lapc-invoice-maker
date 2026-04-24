import {
  COPYTECH_IMPORT_OPTIONAL_HEADERS,
  COPYTECH_IMPORT_REQUIRED_HEADERS,
  type CopyTechImportCsvFormat,
  type CopyTechImportError,
  type CopyTechImportRowInput,
} from "./types";

const MAX_ROWS = 1_000;

export const copyTechImportCsvFormat: CopyTechImportCsvFormat = {
  requiredHeaders: COPYTECH_IMPORT_REQUIRED_HEADERS,
  optionalHeaders: COPYTECH_IMPORT_OPTIONAL_HEADERS,
  exampleCsv: [
    "invoice_date,department,account_number,sku,quantity,requester_name,account_code,job_id,job_date,description_override,unit_price_override,notes,chargeable,charge_reason,raw_impressions",
    "2026-03-31,Library,12345,100234,120,Jane Smith,,CT-1001,2026-03-08,,,Color flyer run,TRUE,COLOR,120",
    "2026-03-31,Library,12345,100450,2,Jane Smith,,CT-1002,2026-03-12,A-frame sign,,Student event signage,TRUE,A_FRAME,2",
    "2026-03-31,Library,12345,,0,Jane Smith,,CT-1003,2026-03-12,,,Under threshold B&W run,FALSE,NOT_CHARGEABLE,80",
  ].join("\n"),
  notes: [
    "chargeable is optional; blank or missing values default to TRUE for older CSV exports.",
    "Rows with chargeable set to FALSE are counted as skipped and do not become invoice line items.",
    "Use charge_reason for audit context such as COLOR, A_FRAME, POSTER, BW_OVER_500, or NOT_CHARGEABLE.",
    "raw_impressions is optional and can keep the original job impressions when quantity is only the billable amount.",
    "Headers are matched case-insensitively after spaces and hyphens are converted to underscores.",
    "invoice_date and job_date must use YYYY-MM-DD.",
    "For chargeable rows, sku must match an existing product SKU in the LAPortal product mirror and quantity must be positive.",
    "unit_price_override is optional; when omitted, the product retail price is used.",
    "description_override is optional; when omitted, the product description is used.",
    "Rows with the same invoice_date, department, account_number, account_code, and requester_name are grouped into one draft invoice.",
  ],
};

interface ParsedCsv {
  headers: string[];
  records: Array<{
    rowNumber: number;
    values: Record<string, string>;
  }>;
  errors: CopyTechImportError[];
}

interface ParsedCsvRow {
  cells: string[];
  sourceLine: number;
}

interface ParsedCsvText {
  rows: ParsedCsvRow[];
  unterminatedQuoteLine: number | null;
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function parseCsvText(text: string): ParsedCsvText {
  const rows: ParsedCsvRow[] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let currentLine = 1;
  let rowStartLine = 1;

  function pushRow() {
    rows.push({ cells: row, sourceLine: rowStartLine });
    row = [];
    rowStartLine = currentLine;
  }

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        if (char === "\n") currentLine += 1;
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      currentLine += 1;
      pushRow();
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }

  if (inQuotes) {
    return {
      rows: rows.filter((parsedRow) => parsedRow.cells.some((cell) => cell.trim().length > 0)),
      unterminatedQuoteLine: rowStartLine,
    };
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    pushRow();
  }

  return {
    rows: rows.filter((parsedRow) => parsedRow.cells.some((cell) => cell.trim().length > 0)),
    unterminatedQuoteLine: null,
  };
}

export function parseCopyTechCsv(text: string): ParsedCsv {
  const parsedText = parseCsvText(text);
  const { rows } = parsedText;
  const errors: CopyTechImportError[] = [];

  if (parsedText.unterminatedQuoteLine !== null) {
    errors.push({
      rowNumber: parsedText.unterminatedQuoteLine,
      field: "file",
      message: "CSV has an unterminated quoted field",
    });
  }

  if (rows.length === 0) {
    return {
      headers: [],
      records: [],
      errors: errors.length > 0 ? errors : [{ rowNumber: 1, field: "file", message: "CSV file is empty" }],
    };
  }

  const headers = rows[0].cells.map(normalizeHeader);
  const headerSet = new Set(headers);

  for (const required of COPYTECH_IMPORT_REQUIRED_HEADERS) {
    if (!headerSet.has(required)) {
      errors.push({
        rowNumber: 1,
        field: required,
        message: `Missing required header "${required}"`,
      });
    }
  }

  const dataRows = rows.slice(1);
  if (dataRows.length > MAX_ROWS) {
    errors.push({
      rowNumber: dataRows[MAX_ROWS]?.sourceLine ?? MAX_ROWS + 2,
      field: "file",
      message: `CSV imports are limited to ${MAX_ROWS} rows at a time`,
    });
  }

  const records = dataRows.slice(0, MAX_ROWS).map((parsedRow) => {
    const record: Record<string, string> = {};
    headers.forEach((header, columnIndex) => {
      record[header] = parsedRow.cells[columnIndex]?.trim() ?? "";
    });

    if (parsedRow.cells.length > headers.length) {
      errors.push({
        rowNumber: parsedRow.sourceLine,
        field: "row",
        message: "Row has more cells than the header row",
      });
    }

    return { rowNumber: parsedRow.sourceLine, values: record };
  });

  return { headers, records, errors };
}

function parsePositiveNumber(raw: string): number | null {
  if (!raw.trim()) return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}

function parseNonNegativeNumber(raw: string): number | null {
  if (!raw.trim()) return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) return null;
  return value;
}

function parseMoney(raw: string): number | null {
  if (!raw.trim()) return null;
  const value = Number(raw.replace(/[$,]/g, ""));
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100) / 100;
}

function parseChargeable(raw: string): boolean | null {
  const normalized = raw.trim().toLowerCase();
  if (!normalized) return true;
  if (["true", "yes", "y", "1"].includes(normalized)) return true;
  if (["false", "no", "n", "0"].includes(normalized)) return false;
  return null;
}

function isDateKey(raw: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return false;
  const date = new Date(`${raw}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === raw;
}

export function normalizeCopyTechRows(text: string): {
  rows: CopyTechImportRowInput[];
  errors: CopyTechImportError[];
  rowCount: number;
} {
  const parsed = parseCopyTechCsv(text);
  const errors = [...parsed.errors];
  const normalized: CopyTechImportRowInput[] = [];
  const seenJobIds = new Map<string, number>();

  parsed.records.forEach(({ rowNumber, values: record }) => {
    const invoiceDate = record.invoice_date ?? "";
    const department = record.department ?? "";
    const accountNumber = record.account_number ?? "";
    const accountCode = record.account_code ?? "";
    const requesterName = record.requester_name ?? "";
    const jobId = record.job_id ?? "";
    const jobDate = record.job_date ?? "";
    const descriptionOverride = record.description_override ?? "";
    const unitPriceOverrideRaw = record.unit_price_override ?? "";
    const notes = record.notes ?? "";
    const skuRaw = record.sku ?? "";
    const quantityRaw = record.quantity ?? "";
    const chargeableRaw = record.chargeable ?? "";
    const chargeReason = record.charge_reason ?? "";
    const rawImpressionsRaw = record.raw_impressions ?? "";
    const chargeable = parseChargeable(chargeableRaw);
    const isChargeable = chargeable ?? true;

    if (isChargeable && (!invoiceDate || !isDateKey(invoiceDate))) {
      errors.push({ rowNumber, field: "invoice_date", message: "invoice_date is required and must be YYYY-MM-DD" });
    }
    if (isChargeable && !department) {
      errors.push({ rowNumber, field: "department", message: "department is required" });
    }
    if (isChargeable && !accountNumber) {
      errors.push({ rowNumber, field: "account_number", message: "account_number is required" });
    }
    if (isChargeable && jobDate && !isDateKey(jobDate)) {
      errors.push({ rowNumber, field: "job_date", message: "job_date must be YYYY-MM-DD when provided" });
    }
    if (chargeable === null) {
      errors.push({
        rowNumber,
        field: "chargeable",
        message: "chargeable must be TRUE/FALSE, yes/no, y/n, or 1/0 when provided",
      });
    }

    const sku = Number(skuRaw);
    if (isChargeable && (!Number.isInteger(sku) || sku <= 0)) {
      errors.push({ rowNumber, field: "sku", message: "sku must be a positive whole number" });
    }

    const quantity = parsePositiveNumber(quantityRaw);
    if (isChargeable && quantity === null) {
      errors.push({ rowNumber, field: "quantity", message: "quantity must be a positive number" });
    }

    const unitPriceOverride = parseMoney(unitPriceOverrideRaw);
    if (isChargeable && unitPriceOverrideRaw && unitPriceOverride === null) {
      errors.push({ rowNumber, field: "unit_price_override", message: "unit_price_override must be a valid non-negative dollar amount" });
    }

    const rawImpressions = parseNonNegativeNumber(rawImpressionsRaw);
    if (isChargeable && rawImpressionsRaw && rawImpressions === null) {
      errors.push({ rowNumber, field: "raw_impressions", message: "raw_impressions must be a valid non-negative number" });
    }

    if (isChargeable && jobId) {
      const firstSeen = seenJobIds.get(jobId);
      if (firstSeen) {
        errors.push({
          rowNumber,
          field: "job_id",
          message: `Duplicate job_id "${jobId}" also appears on row ${firstSeen}`,
        });
      } else {
        seenJobIds.set(jobId, rowNumber);
      }
    }

    normalized.push({
      rowNumber,
      invoiceDate,
      department,
      accountNumber,
      accountCode,
      requesterName,
      jobId,
      jobDate,
      sku: Number.isInteger(sku) ? sku : 0,
      quantity: quantity ?? 0,
      descriptionOverride,
      unitPriceOverride,
      notes,
      chargeable: isChargeable,
      chargeReason,
      rawImpressions,
    });
  });

  return {
    rows: normalized,
    errors,
    rowCount: parsed.records.length,
  };
}
