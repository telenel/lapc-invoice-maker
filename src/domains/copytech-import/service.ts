import { invoiceService } from "@/domains/invoice/service";
import type { CreateInvoiceInput } from "@/domains/invoice/types";
import { findProductsBySku } from "./repository";
import { copyTechImportCsvFormat, normalizeCopyTechRows } from "./csv";
import type {
  CopyTechImportCommitResult,
  CopyTechImportError,
  CopyTechImportPreview,
  CopyTechImportRowInput,
  CopyTechImportWarning,
  CopyTechInvoiceDraftPreview,
  CopyTechProductSnapshot,
  CopyTechResolvedLineItem,
} from "./types";

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function buildGroupKey(row: CopyTechImportRowInput): string {
  return [
    row.invoiceDate,
    row.department.toLowerCase(),
    row.accountNumber.toLowerCase(),
    row.accountCode.toLowerCase(),
    row.requesterName.toLowerCase(),
  ].join("|");
}

function buildInvoiceNotes(group: CopyTechInvoiceDraftPreview): string {
  const jobIds = group.lineItems.map((item) => item.jobId).filter(Boolean);
  const chargeReasons = Array.from(new Set(group.lineItems.map((item) => item.chargeReason).filter(Boolean)));
  const rowNotes = group.lineItems
    .filter((item) => item.notes || item.rawImpressions !== null)
    .map((item) => {
      const details = [
        item.rawImpressions !== null ? `raw impressions: ${item.rawImpressions}` : "",
        item.notes,
      ].filter(Boolean).join("; ");
      return `Row ${item.rowNumber}${item.jobId ? ` (${item.jobId})` : ""}: ${details}`;
    });
  const parts = [
    "Imported from CopyTech charge CSV.",
    group.requesterName ? `Requester: ${group.requesterName}.` : "",
    jobIds.length > 0 ? `Job IDs: ${jobIds.join(", ")}.` : "",
    chargeReasons.length > 0 ? `Charge reasons: ${chargeReasons.join(", ")}.` : "",
    ...rowNotes,
  ].filter(Boolean);

  return parts.join("\n");
}

function toLineItem(
  row: CopyTechImportRowInput,
  product: CopyTechProductSnapshot,
  errors: CopyTechImportError[],
  warnings: CopyTechImportWarning[],
): CopyTechResolvedLineItem | null {
  const productDescription = product.description?.trim() || null;
  const description = row.descriptionOverride || productDescription || `SKU ${row.sku}`;
  const productUnitPrice = product.retailPrice;
  const unitPrice = row.unitPriceOverride ?? productUnitPrice;

  if (productUnitPrice === null && row.unitPriceOverride === null) {
    errors.push({
      rowNumber: row.rowNumber,
      field: "unit_price_override",
      message: `SKU ${row.sku} does not have a product retail price; provide unit_price_override`,
    });
    return null;
  }

  if (product.discontinued) {
    warnings.push({
      rowNumber: row.rowNumber,
      field: "sku",
      message: `SKU ${row.sku} is marked discontinued`,
    });
  }

  if (row.unitPriceOverride !== null && productUnitPrice !== null && row.unitPriceOverride !== productUnitPrice) {
    warnings.push({
      rowNumber: row.rowNumber,
      field: "unit_price_override",
      message: `unit_price_override differs from product retail price $${productUnitPrice.toFixed(2)}`,
    });
  }

  return {
    rowNumber: row.rowNumber,
    jobId: row.jobId,
    jobDate: row.jobDate,
    sku: row.sku,
    quantity: row.quantity,
    description,
    unitPrice: unitPrice ?? 0,
    extendedPrice: roundMoney(row.quantity * (unitPrice ?? 0)),
    costPrice: product.costPrice,
    productDescription,
    productUnitPrice,
    usedDescriptionOverride: Boolean(row.descriptionOverride),
    usedUnitPriceOverride: row.unitPriceOverride !== null,
    notes: row.notes,
    chargeReason: row.chargeReason,
    rawImpressions: row.rawImpressions,
  };
}

function sortInvoices(invoices: CopyTechInvoiceDraftPreview[]): CopyTechInvoiceDraftPreview[] {
  return invoices.sort((a, b) => {
    const dateCompare = a.invoiceDate.localeCompare(b.invoiceDate);
    if (dateCompare !== 0) return dateCompare;
    const deptCompare = a.department.localeCompare(b.department);
    if (deptCompare !== 0) return deptCompare;
    return a.accountNumber.localeCompare(b.accountNumber);
  });
}

export const copyTechImportService = {
  getCsvFormat() {
    return copyTechImportCsvFormat;
  },

  async preview(csvText: string): Promise<CopyTechImportPreview> {
    const normalized = normalizeCopyTechRows(csvText);
    const errors = [...normalized.errors];
    const warnings: CopyTechImportWarning[] = [];
    const skippedRowCount = normalized.rows.filter((row) => !row.chargeable).length;
    const skus = normalized.rows
      .filter((row) => row.chargeable)
      .map((row) => row.sku)
      .filter((sku) => sku > 0);
    const productsBySku = await findProductsBySku(skus);
    const groups = new Map<string, CopyTechInvoiceDraftPreview>();
    let validRowCount = 0;

    for (const row of normalized.rows) {
      if (!row.chargeable) {
        continue;
      }

      if (errors.some((error) => error.rowNumber === row.rowNumber)) {
        continue;
      }

      const product = productsBySku.get(row.sku);
      if (!product) {
        errors.push({
          rowNumber: row.rowNumber,
          field: "sku",
          message: `SKU ${row.sku} was not found in the product catalog`,
        });
        continue;
      }

      const lineItem = toLineItem(row, product, errors, warnings);
      if (!lineItem) continue;

      const groupKey = buildGroupKey(row);
      const group = groups.get(groupKey) ?? {
        groupKey,
        invoiceDate: row.invoiceDate,
        department: row.department,
        accountNumber: row.accountNumber,
        accountCode: row.accountCode,
        requesterName: row.requesterName,
        lineItems: [],
        totalAmount: 0,
        notes: "",
      };

      group.lineItems.push(lineItem);
      group.totalAmount = roundMoney(group.totalAmount + lineItem.extendedPrice);
      groups.set(groupKey, group);
      validRowCount += 1;
    }

    const invoices = sortInvoices(Array.from(groups.values())).map((group) => ({
      ...group,
      notes: buildInvoiceNotes(group),
    }));

    return {
      format: copyTechImportCsvFormat,
      rowCount: normalized.rowCount,
      skippedRowCount,
      validRowCount,
      invoiceCount: invoices.length,
      totalAmount: roundMoney(invoices.reduce((sum, invoice) => sum + invoice.totalAmount, 0)),
      errors,
      warnings,
      invoices,
    };
  },

  async commit(csvText: string, creatorId: string): Promise<CopyTechImportCommitResult> {
    const preview = await this.preview(csvText);
    if (preview.errors.length > 0) {
      throw Object.assign(new Error("CSV has validation errors"), {
        code: "VALIDATION",
        preview,
      });
    }

    const createdInvoices = [];
    for (const invoice of preview.invoices) {
      const input: CreateInvoiceInput = {
        date: invoice.invoiceDate,
        department: invoice.department,
        category: "COPY_TECH",
        accountCode: invoice.accountCode,
        accountNumber: invoice.accountNumber,
        notes: invoice.notes,
        status: "DRAFT",
        items: invoice.lineItems.map((item, index) => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          sortOrder: index,
          sku: String(item.sku),
          costPrice: item.costPrice ?? undefined,
          isTaxable: true,
        })),
      };

      createdInvoices.push(await invoiceService.create(input, creatorId));
    }

    return { preview, createdInvoices };
  },
};
