import type { InvoiceFilters } from "@/domains/invoice/types";

export interface InvoiceUrlFilters {
  search: string;
  status: string;
  category: string;
  department: string;
  dateFrom: string;
  dateTo: string;
  amountMin: string;
  amountMax: string;
  isRunning: string;
  page: string;
  sortBy: string;
  sortOrder: string;
}

export function getInvoiceExportFilters(
  filters: Pick<
    InvoiceUrlFilters,
    | "search"
    | "status"
    | "category"
    | "department"
    | "dateFrom"
    | "dateTo"
    | "amountMin"
    | "amountMax"
    | "isRunning"
  >,
): InvoiceFilters {
  return {
    search: filters.search || undefined,
    status:
      filters.status && filters.status !== "all"
        ? (filters.status as InvoiceFilters["status"])
        : undefined,
    category:
      filters.category && filters.category !== "all"
        ? filters.category
        : undefined,
    department:
      filters.department && filters.department !== "all"
        ? filters.department
        : undefined,
    dateFrom: filters.dateFrom || undefined,
    dateTo: filters.dateTo || undefined,
    amountMin: filters.amountMin ? Number(filters.amountMin) : undefined,
    amountMax: filters.amountMax ? Number(filters.amountMax) : undefined,
    isRunning: filters.isRunning === "true" ? true : undefined,
  };
}
