import "@testing-library/jest-dom/vitest";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useInvoiceSave } from "./use-invoice-save";
import type { InvoiceFormData } from "./use-invoice-form-state";

const pushMock = vi.fn();
const finalizeMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/domains/invoice/api-client", () => ({
  invoiceApi: {
    finalize: (...args: unknown[]) => finalizeMock(...args),
  },
}));

const baseForm: InvoiceFormData = {
  invoiceNumber: "AG-001",
  date: "2026-04-07",
  staffId: "staff-1",
  department: "IT",
  category: "SUPPLIES",
  accountCode: "AC-1",
  accountNumber: "12345",
  approvalChain: [],
  contactName: "Alice",
  contactExtension: "x100",
  contactEmail: "alice@example.com",
  contactPhone: "",
  semesterYearDept: "SP26-IT",
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
  items: [{
    _key: "item-1",
    description: "Laptop",
    quantity: 1,
    unitPrice: 150,
    extendedPrice: 150,
    sortOrder: 0,
    isTaxable: true,
    marginOverride: null,
    costPrice: null,
  }],
  prismcorePath: "/uploads/prismcore.pdf",
  signatures: { line1: "Alice, Director", line2: "", line3: "" },
  signatureStaffIds: { line1: "staff-1", line2: "", line3: "" },
};

describe("useInvoiceSave", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("updates and finalizes the existing invoice instead of creating a duplicate", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        if (String(input) === "/api/invoices/existing-invoice" && init?.method === "PUT") {
          return {
            ok: true,
            json: async () => ({ id: "existing-invoice" }),
          } satisfies Partial<Response>;
        }

        throw new Error(`Unexpected fetch: ${String(input)}`);
      }),
    );
    finalizeMock.mockResolvedValue({ success: true });

    const { result } = renderHook(() => useInvoiceSave(baseForm, "existing-invoice"));

    await act(async () => {
      await result.current.saveAndFinalize();
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      "/api/invoices/existing-invoice",
      expect.objectContaining({ method: "PUT" }),
    );
    expect(finalizeMock).toHaveBeenCalledWith(
      "existing-invoice",
      expect.objectContaining({
        prismcorePath: "/uploads/prismcore.pdf",
        semesterYearDept: "SP26-IT",
      }),
    );
    expect(pushMock).toHaveBeenCalledWith("/invoices/existing-invoice");
  });
});
