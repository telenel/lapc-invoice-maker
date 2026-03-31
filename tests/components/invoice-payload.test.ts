import { describe, expect, it } from "vitest";
import { buildInvoicePayload } from "@/components/invoice/payload";
import type { InvoiceFormData } from "@/components/invoice/invoice-form";

function createForm(overrides: Partial<InvoiceFormData> = {}): InvoiceFormData {
  return {
    invoiceNumber: "AG-123456",
    date: "2026-03-31",
    staffId: "staff-1",
    department: "Operations",
    category: "SUPPLIES",
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
    isRunning: false,
    runningTitle: "",
    marginEnabled: false,
    marginPercent: 0,
    taxEnabled: false,
    taxRate: 0.0975,
    items: [
      {
        _key: "item-1",
        description: "LUNCH",
        quantity: 1,
        unitPrice: 10,
        extendedPrice: 10,
        sortOrder: 0,
        isTaxable: true,
        marginOverride: null,
        costPrice: null,
      },
      {
        _key: "item-2",
        description: "",
        quantity: 1,
        unitPrice: 0,
        extendedPrice: 0,
        sortOrder: 1,
        isTaxable: true,
        marginOverride: null,
        costPrice: null,
      },
    ],
    prismcorePath: null,
    signatures: { line1: "", line2: "", line3: "" },
    signatureStaffIds: { line1: "", line2: "", line3: "" },
    ...overrides,
  };
}

describe("buildInvoicePayload", () => {
  it("drops blank trailing items before hitting route validation", () => {
    const payload = buildInvoicePayload(createForm());

    expect(payload.items).toHaveLength(1);
    expect(payload.items[0].description).toBe("LUNCH");
  });
});
