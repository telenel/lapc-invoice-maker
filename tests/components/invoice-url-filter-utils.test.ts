import { describe, expect, it } from "vitest";
import { getInvoiceExportFilters } from "@/components/invoices/url-filter-utils";

describe("getInvoiceExportFilters", () => {
  it("preserves the running filter for CSV export", () => {
    expect(
      getInvoiceExportFilters({
        search: "",
        status: "DRAFT",
        category: "",
        department: "",
        dateFrom: "",
        dateTo: "",
        amountMin: "",
        amountMax: "",
        isRunning: "true",
      }),
    ).toMatchObject({
      status: "DRAFT",
      isRunning: true,
    });
  });
});
