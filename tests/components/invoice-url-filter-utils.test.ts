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
        creatorId: "user-123",
        dateFrom: "",
        dateTo: "",
        amountMin: "",
        amountMax: "",
        isRunning: "true",
      }),
    ).toMatchObject({
      status: "DRAFT",
      creatorId: "user-123",
      isRunning: true,
    });
  });
});

describe("getNextInvoiceFilterState", () => {
  it("preserves running scope while the user stays in DRAFT filters", () => {
    expect(
      getNextInvoiceFilterState(
        {
          creatorId: "user-123",
          isRunning: "true",
          sortBy: "date",
          sortOrder: "desc",
        },
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
      creatorId: "user-123",
      isRunning: "true",
      sortBy: "date",
      sortOrder: "desc",
    });
  });

  it("clears running scope once the user leaves the running view", () => {
    expect(
      getNextInvoiceFilterState(
        {
          creatorId: "user-123",
          isRunning: "true",
          sortBy: "date",
          sortOrder: "desc",
        },
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
      creatorId: "user-123",
      isRunning: "",
    });
  });
});
