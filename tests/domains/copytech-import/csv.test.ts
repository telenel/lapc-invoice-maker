import { describe, expect, it } from "vitest";
import { normalizeCopyTechRows, parseCopyTechCsv } from "@/domains/copytech-import/csv";

describe("copytech import CSV parsing", () => {
  it("normalizes headers and parses charge rows", () => {
    const csv = [
      "Invoice Date,Department,Account Number,SKU,Quantity,Description Override",
      "2026-03-31,Library,12345,100234,2,A-frame sign",
    ].join("\n");

    const result = normalizeCopyTechRows(csv);

    expect(result.errors).toEqual([]);
    expect(result.rows).toEqual([
      expect.objectContaining({
        invoiceDate: "2026-03-31",
        department: "Library",
        accountNumber: "12345",
        sku: 100234,
        quantity: 2,
        descriptionOverride: "A-frame sign",
        chargeable: true,
      }),
    ]);
  });

  it("supports quoted commas", () => {
    const parsed = parseCopyTechCsv([
      "invoice_date,department,account_number,sku,quantity,notes",
      '2026-03-31,Library,12345,100234,1,"Poster, large format"',
    ].join("\n"));

    expect(parsed.records[0].values.notes).toBe("Poster, large format");
  });

  it("reports unterminated quoted fields without accepting the partial row", () => {
    const parsed = parseCopyTechCsv([
      "invoice_date,department,account_number,sku,quantity,notes",
      '2026-03-31,Library,12345,100234,1,"Poster notes',
    ].join("\n"));

    expect(parsed.records).toEqual([]);
    expect(parsed.errors).toEqual([
      expect.objectContaining({
        rowNumber: 2,
        field: "file",
        message: "CSV has an unterminated quoted field",
      }),
    ]);
  });

  it("keeps validation row numbers aligned with source lines after blanks and multiline fields", () => {
    const parsed = parseCopyTechCsv([
      "invoice_date,department,account_number,sku,quantity,notes",
      "",
      '2026-03-31,Library,12345,100234,1,"line one',
      'line two"',
      "2026-03-31,Library,12345,100235,1,extra,unexpected",
    ].join("\n"));

    expect(parsed.records[0].rowNumber).toBe(3);
    expect(parsed.errors).toEqual([
      expect.objectContaining({
        rowNumber: 5,
        field: "row",
      }),
    ]);
  });

  it("reports missing required headers and invalid rows", () => {
    const result = normalizeCopyTechRows("department,sku\nLibrary,nope");

    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ rowNumber: 1, field: "invoice_date" }),
        expect.objectContaining({ rowNumber: 1, field: "account_number" }),
        expect.objectContaining({ rowNumber: 1, field: "quantity" }),
        expect.objectContaining({ rowNumber: 2, field: "sku" }),
      ]),
    );
  });

  it("rejects duplicate job ids in the same file", () => {
    const csv = [
      "invoice_date,department,account_number,sku,quantity,job_id",
      "2026-03-31,Library,12345,100234,1,CT-1",
      "2026-03-31,Library,12345,100235,1,CT-1",
    ].join("\n");

    const result = normalizeCopyTechRows(csv);

    expect(result.errors).toEqual([
      expect.objectContaining({
        rowNumber: 3,
        field: "job_id",
        message: expect.stringContaining("Duplicate job_id"),
      }),
    ]);
  });

  it("allows non-chargeable rows to be skipped without invoice data", () => {
    const csv = [
      "invoice_date,department,account_number,sku,quantity,job_id,chargeable,charge_reason,raw_impressions",
      "not-a-date,,12345,,0,CT-1,FALSE,NOT_CHARGEABLE,80",
    ].join("\n");

    const result = normalizeCopyTechRows(csv);

    expect(result.errors).toEqual([]);
    expect(result.rows).toEqual([
      expect.objectContaining({
        rowNumber: 2,
        sku: 0,
        quantity: 0,
        chargeable: false,
        chargeReason: "NOT_CHARGEABLE",
        rawImpressions: 80,
      }),
    ]);
  });

  it("rejects invalid chargeable values", () => {
    const csv = [
      "invoice_date,department,account_number,sku,quantity,chargeable",
      "2026-03-31,Library,12345,100234,1,maybe",
    ].join("\n");

    const result = normalizeCopyTechRows(csv);

    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          rowNumber: 2,
          field: "chargeable",
        }),
      ]),
    );
  });
});
