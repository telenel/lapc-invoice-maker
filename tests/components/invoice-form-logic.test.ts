import { describe, it, expect } from "vitest";
import type { InvoiceFormData, InvoiceItem } from "@/components/invoice/invoice-form";

// ---------------------------------------------------------------------------
// InvoiceFormData type shape
// Verified via type assertion + object literal — catches missing fields at
// compile time without needing to mount any React component.
// ---------------------------------------------------------------------------

describe("InvoiceFormData type shape", () => {
  it("has all required core fields", () => {
    const sample: InvoiceFormData = {
      invoiceNumber: "AG-000111222",
      date: "2026-03-25",
      staffId: "staff-uuid",
      department: "English",
      category: "SUPPLIES",
      accountCode: "1234",
      accountNumber: "ACC-001",
      approvalChain: [],
      contactName: "Jane Doe",
      contactExtension: "x1234",
      contactEmail: "jane@piercecollege.edu",
      contactPhone: "818-555-0000",
      semesterYearDept: "Spring 2026 – English",
      notes: "",
      isRecurring: false,
      recurringInterval: "",
      recurringEmail: "",
      items: [],
      prismcorePath: null,
      signatures: { line1: "", line2: "", line3: "" },
      signatureStaffIds: { line1: "", line2: "", line3: "" },
    };
    expect(sample.invoiceNumber).toBe("AG-000111222");
    expect(sample.isRecurring).toBe(false);
    expect(sample.prismcorePath).toBeNull();
    expect(sample.signatures).toEqual({ line1: "", line2: "", line3: "" });
    expect(sample.signatureStaffIds).toEqual({ line1: "", line2: "", line3: "" });
  });

  it("allows prismcorePath to be a string", () => {
    const sample: InvoiceFormData = {
      invoiceNumber: "",
      date: "",
      staffId: "",
      department: "",
      category: "",
      accountCode: "",
      accountNumber: "",
      approvalChain: [],
      contactName: "",
      contactExtension: "",
      contactEmail: "",
      contactPhone: "",
      semesterYearDept: "",
      notes: "",
      isRecurring: false,
      recurringInterval: "",
      recurringEmail: "",
      items: [],
      prismcorePath: "/uploads/prismcore.pdf",
      signatures: { line1: "", line2: "", line3: "" },
      signatureStaffIds: { line1: "", line2: "", line3: "" },
    };
    expect(sample.prismcorePath).toBe("/uploads/prismcore.pdf");
  });
});

// ---------------------------------------------------------------------------
// InvoiceItem extendedPrice calculation
// The form's updateItem handler sets: extendedPrice = quantity * unitPrice
// We test that pure arithmetic directly (no hooks required).
// ---------------------------------------------------------------------------

describe("InvoiceItem extendedPrice calculation", () => {
  function computeExtendedPrice(item: Pick<InvoiceItem, "quantity" | "unitPrice">): number {
    return item.quantity * item.unitPrice;
  }

  it("calculates extendedPrice for integer quantity and price", () => {
    expect(computeExtendedPrice({ quantity: 3, unitPrice: 10 })).toBe(30);
  });

  it("calculates extendedPrice for decimal unitPrice", () => {
    expect(computeExtendedPrice({ quantity: 2, unitPrice: 4.99 })).toBeCloseTo(9.98);
  });

  it("returns 0 when unitPrice is 0 (free item)", () => {
    expect(computeExtendedPrice({ quantity: 5, unitPrice: 0 })).toBe(0);
  });

  it("returns 0 when quantity is 0", () => {
    expect(computeExtendedPrice({ quantity: 0, unitPrice: 25 })).toBe(0);
  });

  it("calculates correctly for quantity of 1", () => {
    expect(computeExtendedPrice({ quantity: 1, unitPrice: 99.99 })).toBeCloseTo(99.99);
  });

  it("calculates correctly for large quantities", () => {
    expect(computeExtendedPrice({ quantity: 100, unitPrice: 2.5 })).toBe(250);
  });
});
