import "@testing-library/jest-dom/vitest";
import { renderHook } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { useComposerValidation } from "./use-composer-validation";
import type { InvoiceFormData } from "@/components/invoice/hooks/use-invoice-form-state";
import type { QuoteFormData } from "@/components/quote/quote-form";

function invoiceForm(overrides: Partial<InvoiceFormData> = {}): InvoiceFormData {
  return {
    invoiceNumber: "",
    date: "2026-04-26",
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
    isRunning: false,
    runningTitle: "",
    marginEnabled: false,
    marginPercent: 0,
    taxEnabled: false,
    taxRate: 0.0975,
    items: [],
    prismcorePath: null,
    signatures: { line1: "", line2: "", line3: "" },
    signatureStaffIds: { line1: "", line2: "", line3: "" },
    ...overrides,
  };
}

function quoteForm(overrides: Partial<QuoteFormData> = {}): QuoteFormData {
  return {
    date: "2026-04-26",
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
    notes: "",
    items: [],
    expirationDate: "2026-05-26",
    recipientName: "",
    recipientEmail: "",
    recipientOrg: "",
    marginEnabled: false,
    marginPercent: 0,
    taxEnabled: false,
    taxRate: 0.0975,
    isCateringEvent: false,
    cateringDetails: {
      eventDate: "",
      startTime: "",
      endTime: "",
      location: "",
      contactName: "",
      contactPhone: "",
      contactEmail: "",
      headcount: undefined,
      eventName: "",
      setupRequired: false,
      setupTime: "",
      setupInstructions: "",
      takedownRequired: false,
      takedownTime: "",
      takedownInstructions: "",
      specialInstructions: "",
    },
    ...overrides,
  };
}

describe("useComposerValidation totals", () => {
  it("computes subtotal from items", () => {
    const form = invoiceForm({
      items: [
        { _key: "a", sku: null, description: "x", quantity: 2, unitPrice: 10, extendedPrice: 20, sortOrder: 0, isTaxable: true, marginOverride: null, costPrice: null },
        { _key: "b", sku: null, description: "y", quantity: 1, unitPrice: 5, extendedPrice: 5, sortOrder: 1, isTaxable: false, marginOverride: null, costPrice: null },
      ],
    });
    const { result } = renderHook(() => useComposerValidation(form, "invoice"));
    expect(result.current.totals.subtotal).toBe(25);
    expect(result.current.totals.itemCount).toBe(2);
  });

  it("computes taxable subtotal and tax amount", () => {
    const form = invoiceForm({
      taxEnabled: true,
      taxRate: 0.1,
      items: [
        { _key: "a", sku: null, description: "x", quantity: 1, unitPrice: 100, extendedPrice: 100, sortOrder: 0, isTaxable: true, marginOverride: null, costPrice: null },
        { _key: "b", sku: null, description: "y", quantity: 1, unitPrice: 50, extendedPrice: 50, sortOrder: 1, isTaxable: false, marginOverride: null, costPrice: null },
      ],
    });
    const { result } = renderHook(() => useComposerValidation(form, "invoice"));
    expect(result.current.totals.taxableSubtotal).toBe(100);
    expect(result.current.totals.taxAmount).toBeCloseTo(10, 5);
    expect(result.current.totals.taxableCount).toBe(1);
    expect(result.current.totals.grandTotal).toBeCloseTo(160, 5);
  });

  it("applies margin to extended prices when enabled", () => {
    const form = invoiceForm({
      marginEnabled: true,
      marginPercent: 50,
      items: [
        { _key: "a", sku: null, description: "x", quantity: 2, unitPrice: 10, extendedPrice: 20, sortOrder: 0, isTaxable: true, marginOverride: null, costPrice: 10 },
      ],
    });
    const { result } = renderHook(() => useComposerValidation(form, "invoice"));
    expect(result.current.totals.subtotal).toBe(30);
    expect(result.current.totals.marginAmount).toBeCloseTo(10, 5);
  });
});

describe("useComposerValidation invoice blockers", () => {
  it("flags missing requestor", () => {
    const form = invoiceForm({ staffId: "" });
    const { result } = renderHook(() => useComposerValidation(form, "invoice"));
    expect(result.current.blockers.find((b) => b.field === "requestor")).toBeTruthy();
  });

  it("flags missing department", () => {
    const form = invoiceForm({ staffId: "x", department: "" });
    const { result } = renderHook(() => useComposerValidation(form, "invoice"));
    expect(result.current.blockers.find((b) => b.field === "department")).toBeTruthy();
  });

  it("flags missing accountNumber", () => {
    const form = invoiceForm({ staffId: "x", department: "BKST", accountNumber: "" });
    const { result } = renderHook(() => useComposerValidation(form, "invoice"));
    expect(result.current.blockers.find((b) => b.field === "accountNumber")).toBeTruthy();
  });

  it("flags missing category", () => {
    const form = invoiceForm({ staffId: "x", department: "BKST", accountNumber: "1", category: "" });
    const { result } = renderHook(() => useComposerValidation(form, "invoice"));
    expect(result.current.blockers.find((b) => b.field === "category")).toBeTruthy();
  });

  it("flags items.length === 0", () => {
    const form = invoiceForm({ staffId: "x", department: "BKST", accountNumber: "1", category: "x", items: [] });
    const { result } = renderHook(() => useComposerValidation(form, "invoice"));
    expect(result.current.blockers.find((b) => b.field === "items")).toBeTruthy();
  });

  it("flags invalid items", () => {
    const form = invoiceForm({
      staffId: "x", department: "BKST", accountNumber: "1", category: "x",
      items: [{ _key: "a", sku: null, description: "", quantity: 1, unitPrice: 0, extendedPrice: 0, sortOrder: 0, isTaxable: true, marginOverride: null, costPrice: null }],
    });
    const { result } = renderHook(() => useComposerValidation(form, "invoice"));
    expect(result.current.blockers.find((b) => b.field === "itemsValid")).toBeTruthy();
  });

  it("flags missing approvers when fewer than 2 filled", () => {
    const form = invoiceForm({
      staffId: "x", department: "BKST", accountNumber: "1", category: "x",
      items: [{ _key: "a", sku: null, description: "y", quantity: 1, unitPrice: 5, extendedPrice: 5, sortOrder: 0, isTaxable: true, marginOverride: null, costPrice: null }],
      signatureStaffIds: { line1: "abc", line2: "", line3: "" },
    });
    const { result } = renderHook(() => useComposerValidation(form, "invoice"));
    expect(result.current.blockers.find((b) => b.field === "approvers")).toBeTruthy();
  });

  it("zero blockers when all 7 invoice rules satisfied", () => {
    const form = invoiceForm({
      staffId: "x", department: "BKST", accountNumber: "1", category: "x",
      items: [{ _key: "a", sku: null, description: "y", quantity: 1, unitPrice: 5, extendedPrice: 5, sortOrder: 0, isTaxable: true, marginOverride: null, costPrice: null }],
      signatureStaffIds: { line1: "a", line2: "b", line3: "" },
    });
    const { result } = renderHook(() => useComposerValidation(form, "invoice"));
    expect(result.current.blockers).toHaveLength(0);
    expect(result.current.readiness).toBe(1);
  });
});

describe("useComposerValidation quote blockers", () => {
  it("requires recipientName when external (no staffId)", () => {
    const form = quoteForm({ staffId: "", recipientName: "" });
    const { result } = renderHook(() => useComposerValidation(form, "quote"));
    expect(result.current.blockers.find((b) => b.field === "recipient")).toBeTruthy();
  });

  it("recipient satisfied when staffId set (internal)", () => {
    const form = quoteForm({
      staffId: "x", recipientName: "", department: "BKST", accountNumber: "1", category: "x",
      items: [{ _key: "a", sku: null, description: "y", quantity: 1, unitPrice: 5, extendedPrice: 5, sortOrder: 0, isTaxable: true, marginOverride: null, costPrice: null }],
    });
    const { result } = renderHook(() => useComposerValidation(form, "quote"));
    expect(result.current.blockers.find((b) => b.field === "recipient")).toBeFalsy();
  });

  it("does not require approvers for quotes", () => {
    const form = quoteForm({
      staffId: "x", department: "BKST", accountNumber: "1", category: "x",
      items: [{ _key: "a", sku: null, description: "y", quantity: 1, unitPrice: 5, extendedPrice: 5, sortOrder: 0, isTaxable: true, marginOverride: null, costPrice: null }],
    });
    const { result } = renderHook(() => useComposerValidation(form, "quote"));
    expect(result.current.blockers).toHaveLength(0);
  });

  it("does not flag requestor blocker for external quotes (no staffId, recipientName set)", () => {
    const form = quoteForm({
      staffId: "",
      recipientName: "Acme Corp",
      department: "BKST",
      accountNumber: "1",
      category: "external",
      items: [{ _key: "a", sku: null, description: "y", quantity: 1, unitPrice: 5, extendedPrice: 5, sortOrder: 0, isTaxable: true, marginOverride: null, costPrice: null }],
    });
    const { result } = renderHook(() => useComposerValidation(form, "quote"));
    expect(result.current.blockers.find((b) => b.field === "requestor")).toBeFalsy();
    expect(result.current.blockers.find((b) => b.field === "recipient")).toBeFalsy();
    expect(result.current.blockers).toHaveLength(0);
  });

  it("checklist requestor item is non-blocker for external quotes", () => {
    const form = quoteForm({ staffId: "", recipientName: "Acme Corp" });
    const { result } = renderHook(() => useComposerValidation(form, "quote"));
    const requestorItem = result.current.checklist.find((c) => c.id === "requestor");
    expect(requestorItem?.blocker).toBe(false);
    expect(requestorItem?.complete).toBe(false);
  });
});

describe("useComposerValidation canSaveDraft", () => {
  it("invoice: true with department + date + staffId + 1 valid item", () => {
    const form = invoiceForm({
      staffId: "x", department: "BKST",
      items: [{ _key: "a", sku: null, description: "y", quantity: 1, unitPrice: 5, extendedPrice: 5, sortOrder: 0, isTaxable: true, marginOverride: null, costPrice: null }],
    });
    const { result } = renderHook(() => useComposerValidation(form, "invoice"));
    expect(result.current.canSaveDraft).toBe(true);
  });

  it("invoice: false when no items", () => {
    const form = invoiceForm({ staffId: "x", department: "BKST", items: [] });
    const { result } = renderHook(() => useComposerValidation(form, "invoice"));
    expect(result.current.canSaveDraft).toBe(false);
  });

  it("quote external: true with recipientName + department + date + valid item, no staffId", () => {
    const form = quoteForm({
      staffId: "",
      recipientName: "Acme Corp",
      department: "BKST",
      items: [{ _key: "a", sku: null, description: "y", quantity: 1, unitPrice: 5, extendedPrice: 5, sortOrder: 0, isTaxable: true, marginOverride: null, costPrice: null }],
    });
    const { result } = renderHook(() => useComposerValidation(form, "quote"));
    expect(result.current.canSaveDraft).toBe(true);
  });

  it("quote internal: true with staffId + department + date + valid item, no recipientName yet", () => {
    const form = quoteForm({
      staffId: "x",
      recipientName: "",
      department: "BKST",
      items: [{ _key: "a", sku: null, description: "y", quantity: 1, unitPrice: 5, extendedPrice: 5, sortOrder: 0, isTaxable: true, marginOverride: null, costPrice: null }],
    });
    const { result } = renderHook(() => useComposerValidation(form, "quote"));
    expect(result.current.canSaveDraft).toBe(true);
  });

  it("quote: false with neither staffId nor recipientName", () => {
    const form = quoteForm({
      staffId: "",
      recipientName: "",
      department: "BKST",
      items: [{ _key: "a", sku: null, description: "y", quantity: 1, unitPrice: 5, extendedPrice: 5, sortOrder: 0, isTaxable: true, marginOverride: null, costPrice: null }],
    });
    const { result } = renderHook(() => useComposerValidation(form, "quote"));
    expect(result.current.canSaveDraft).toBe(false);
  });
});
