import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/domains/copytech-import/repository", () => ({
  findProductsBySku: vi.fn(),
}));

vi.mock("@/domains/invoice/service", () => ({
  invoiceService: {
    create: vi.fn(),
  },
}));

import { copyTechImportService } from "@/domains/copytech-import/service";
import { findProductsBySku } from "@/domains/copytech-import/repository";
import { invoiceService } from "@/domains/invoice/service";

const mockFindProductsBySku = vi.mocked(findProductsBySku);
const mockInvoiceService = vi.mocked(invoiceService, true);

function csv(rows: string[]): string {
  return [
    "invoice_date,department,account_number,sku,quantity,requester_name,job_id,description_override,unit_price_override,notes,chargeable,charge_reason,raw_impressions",
    ...rows,
  ].join("\n");
}

describe("copyTechImportService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("previews rows by resolving SKUs into invoice line items", async () => {
    mockFindProductsBySku.mockResolvedValue(new Map([
      [100234, {
        sku: 100234,
        description: "Color copies",
        retailPrice: 0.43,
        costPrice: 0.1,
        itemTaxTypeId: null,
        discontinued: false,
      }],
      [100450, {
        sku: 100450,
        description: "Poster",
        retailPrice: 22,
        costPrice: 8,
        itemTaxTypeId: null,
        discontinued: false,
      }],
    ]));

    const preview = await copyTechImportService.preview(csv([
      "2026-03-31,Library,12345,100234,120,Jane Smith,CT-1,,,",
      "2026-03-31,Library,12345,100450,2,Jane Smith,CT-2,A-frame sign,,",
    ]));

    expect(preview.errors).toEqual([]);
    expect(preview.skippedRowCount).toBe(0);
    expect(preview.invoiceCount).toBe(1);
    expect(preview.totalAmount).toBe(95.6);
    expect(preview.invoices[0]).toEqual(
      expect.objectContaining({
        invoiceDate: "2026-03-31",
        department: "Library",
        accountNumber: "12345",
        requesterName: "Jane Smith",
        totalAmount: 95.6,
      }),
    );
    expect(preview.invoices[0].lineItems).toEqual([
      expect.objectContaining({ sku: 100234, description: "Color copies", unitPrice: 0.43, extendedPrice: 51.6 }),
      expect.objectContaining({ sku: 100450, description: "A-frame sign", unitPrice: 22, extendedPrice: 44 }),
    ]);
  });

  it("skips non-chargeable rows before SKU lookup and invoice grouping", async () => {
    mockFindProductsBySku.mockResolvedValue(new Map([
      [100234, {
        sku: 100234,
        description: "B&W copies",
        retailPrice: 0.12,
        costPrice: 0.03,
        itemTaxTypeId: null,
        discontinued: false,
      }],
    ]));

    const preview = await copyTechImportService.preview(csv([
      "2026-03-31,Library,12345,100234,25,Jane Smith,CT-1,,,,TRUE,BW_OVER_500,525",
      "not-a-date,Library,12345,,0,Jane Smith,CT-2,,,,FALSE,NOT_CHARGEABLE,80",
    ]));

    expect(mockFindProductsBySku).toHaveBeenCalledWith([100234]);
    expect(preview.errors).toEqual([]);
    expect(preview.skippedRowCount).toBe(1);
    expect(preview.validRowCount).toBe(1);
    expect(preview.invoiceCount).toBe(1);
    expect(preview.invoices[0].lineItems).toEqual([
      expect.objectContaining({
        sku: 100234,
        quantity: 25,
        chargeReason: "BW_OVER_500",
        rawImpressions: 525,
      }),
    ]);
    expect(preview.invoices[0].notes).toContain("Charge reasons: BW_OVER_500.");
    expect(preview.invoices[0].notes).toContain("raw impressions: 525");
  });

  it("reports unknown SKUs as validation errors", async () => {
    mockFindProductsBySku.mockResolvedValue(new Map());

    const preview = await copyTechImportService.preview(csv([
      "2026-03-31,Library,12345,999999,1,Jane Smith,CT-1,,,",
    ]));

    expect(preview.errors).toEqual([
      expect.objectContaining({
        rowNumber: 2,
        field: "sku",
        message: "SKU 999999 was not found in the product catalog",
      }),
    ]);
    expect(preview.invoiceCount).toBe(0);
  });

  it("commits valid previews through invoiceService.create", async () => {
    mockFindProductsBySku.mockResolvedValue(new Map([
      [100234, {
        sku: 100234,
        description: "Color copies",
        retailPrice: 0.43,
        costPrice: 0.1,
        itemTaxTypeId: null,
        discontinued: false,
      }],
    ]));
    mockInvoiceService.create.mockResolvedValue({ id: "inv1" } as never);

    const result = await copyTechImportService.commit(csv([
      "2026-03-31,Library,12345,100234,120,Jane Smith,CT-1,,,",
    ]), "user-1");

    expect(mockInvoiceService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        date: "2026-03-31",
        department: "Library",
        category: "COPY_TECH",
        accountNumber: "12345",
        status: "DRAFT",
        items: [
          expect.objectContaining({
            description: "Color copies",
            quantity: 120,
            unitPrice: 0.43,
            sku: "100234",
            costPrice: 0.1,
          }),
        ],
      }),
      "user-1",
    );
    expect(result.createdInvoices).toEqual([{ id: "inv1" }]);
  });

  it("does not commit when preview has validation errors", async () => {
    mockFindProductsBySku.mockResolvedValue(new Map());

    await expect(copyTechImportService.commit(csv([
      "2026-03-31,Library,12345,999999,1,Jane Smith,CT-1,,,",
    ]), "user-1")).rejects.toMatchObject({ code: "VALIDATION" });

    expect(mockInvoiceService.create).not.toHaveBeenCalled();
  });
});
