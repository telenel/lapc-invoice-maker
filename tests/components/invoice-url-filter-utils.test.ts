import { describe, expect, it } from "vitest";
import {
  getInvoiceExportFilters,
  getNextInvoiceFilterState,
} from "@/components/invoices/url-filter-utils";

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

describe("getNextInvoiceFilterState", () => {
  it("preserves running scope while the user stays in DRAFT filters", () => {
    expect(
      getNextInvoiceFilterState(
        { isRunning: "true", sortBy: "date", sortOrder: "desc" },
        {
          search: "music",
          status: "DRAFT",
          category: "",
          department: "",
          dateFrom: "",
          dateTo: "",
          amountMin: "",
          amountMax: "",
        },
      ),
    ).toMatchObject({
      search: "music",
      status: "DRAFT",
      isRunning: "true",
      sortBy: "date",
      sortOrder: "desc",
    });
  });

  it("clears running scope once the user leaves the running view", () => {
    expect(
      getNextInvoiceFilterState(
        { isRunning: "true", sortBy: "date", sortOrder: "desc" },
        {
          search: "",
          status: "FINAL",
          category: "",
          department: "",
          dateFrom: "",
          dateTo: "",
          amountMin: "",
          amountMax: "",
        },
      ),
    ).toMatchObject({
      status: "FINAL",
      isRunning: "",
    });
  });
});
