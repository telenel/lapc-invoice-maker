"use client";

import { useDeferredValue, useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { FileTextIcon, RefreshCwIcon } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  InvoiceFiltersBar,
  type InvoiceFilters as FilterBarFilters,
} from "./invoice-filters";
import { formatAmount, formatDate, getInitials } from "@/lib/formatters";
import { invoiceApi } from "@/domains/invoice/api-client";
import type { InvoiceResponse } from "@/domains/invoice/types";
import { useSSE } from "@/lib/use-sse";
import { useUrlFilters } from "@/lib/use-url-filters";
import { cn } from "@/lib/utils";

const URL_FILTER_DEFAULTS: Record<string, string> = {
  search: "",
  status: "",
  category: "",
  department: "",
  dateFrom: "",
  dateTo: "",
  amountMin: "",
  amountMax: "",
  isRunning: "",
  page: "1",
  sortBy: "date",
  sortOrder: "desc",
};

const SAVED_VIEWS = [
  { label: "My Drafts", params: { status: "DRAFT" } },
  { label: "Running", params: { status: "DRAFT", isRunning: "true" } },
  { label: "Pending Charges", params: { status: "PENDING_CHARGE" } },
] as const;

type SortField = "invoiceNumber" | "date" | "totalAmount";

const PAGE_SIZE = 20;

interface InvoiceTableProps {
  departments: string[];
  categories: { name: string; label: string }[];
}

export function InvoiceTable({ departments, categories }: InvoiceTableProps) {
  const router = useRouter();
  const { filters, setFilter, setFilters, resetFilters } = useUrlFilters(
    URL_FILTER_DEFAULTS,
  );

  const [invoices, setInvoices] = useState<InvoiceResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const page = Number(filters.page) || 1;
  const sortBy = (filters.sortBy || "date") as SortField;
  const sortDir = (filters.sortOrder || "desc") as "asc" | "desc";
  const deferredSearch = useDeferredValue(filters.search);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  /* Bridge: build FilterBarFilters object from URL filters */
  const filterBarFilters: FilterBarFilters = useMemo(
    () => ({
      search: filters.search,
      status: filters.status,
      category: filters.category,
      department: filters.department,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      amountMin: filters.amountMin,
      amountMax: filters.amountMax,
    }),
    [filters],
  );

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const data = await invoiceApi.list({
        search: deferredSearch || undefined,
        status: (filters.status && filters.status !== "all"
          ? filters.status
          : undefined) as
          | import("@/domains/invoice/types").InvoiceFilters["status"]
          | undefined,
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
        page,
        pageSize: PAGE_SIZE,
        sortBy,
        sortOrder: sortDir,
      });
      setInvoices(data.invoices);
      setTotal(data.total);
    } catch {
      toast.error("Failed to load invoices");
    }
    setLoading(false);
  }, [
    deferredSearch,
    filters.status,
    filters.category,
    filters.department,
    filters.dateFrom,
    filters.dateTo,
    filters.amountMin,
    filters.amountMax,
    filters.isRunning,
    page,
    sortBy,
    sortDir,
  ]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  useSSE("invoice-changed", fetchInvoices);

  function handleFiltersChange(next: FilterBarFilters) {
    setFilters({ ...next });
  }

  function handleClear() {
    resetFilters();
  }

  function handleSort(field: SortField) {
    if (sortBy === field) {
      setFilter("sortOrder", sortDir === "asc" ? "desc" : "asc");
    } else {
      setFilters({ sortBy: field, sortOrder: "asc" });
    }
  }

  function sortIndicator(field: SortField) {
    if (sortBy !== field) return null;
    return sortDir === "asc" ? " \u2191" : " \u2193";
  }

  function statusLabel(status: InvoiceResponse["status"]) {
    return status === "FINAL"
      ? "Final"
      : status === "PENDING_CHARGE"
        ? "Pending Charge"
        : "Draft";
  }

  function statusVariant(
    status: InvoiceResponse["status"],
  ): "success" | "info" | "warning" {
    return status === "FINAL"
      ? "success"
      : status === "PENDING_CHARGE"
        ? "info"
        : "warning";
  }

  function handleExportCsv() {
    invoiceApi
      .exportCsv({
        search: filters.search || undefined,
        status: (filters.status && filters.status !== "all"
          ? filters.status
          : undefined) as
          | import("@/domains/invoice/types").InvoiceFilters["status"]
          | undefined,
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
      })
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        window.open(url, "_blank");
        setTimeout(() => URL.revokeObjectURL(url), 10000);
      })
      .catch(() => toast.error("Failed to export CSV"));
  }

  /** Build a URL string for a saved view */
  function savedViewHref(params: Record<string, string>) {
    const sp = new URLSearchParams(params);
    return `/invoices?${sp.toString()}`;
  }

  /** Check if a saved view is currently active */
  function isSavedViewActive(params: Record<string, string>) {
    return Object.entries(params).every(
      ([k, v]) => filters[k as keyof typeof filters] === v,
    );
  }

  return (
    <div className="space-y-4">
      {/* Saved view preset chips */}
      <div className="flex flex-wrap gap-2">
        {SAVED_VIEWS.map((view) => {
          const active = isSavedViewActive(view.params);
          return (
            <Link
              key={view.label}
              href={savedViewHref(view.params)}
              className={cn(
                "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                active
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground hover:bg-muted/50",
              )}
            >
              {view.label}
            </Link>
          );
        })}
      </div>

      <InvoiceFiltersBar
        filters={filterBarFilters}
        departments={departments}
        categories={categories}
        onChange={handleFiltersChange}
        onClear={handleClear}
        onExportCsv={handleExportCsv}
      />

      {loading ? (
        <p className="text-muted-foreground text-sm">Loading...</p>
      ) : invoices.length === 0 ? (
        <EmptyState
          icon={<FileTextIcon className="size-7" />}
          title="No invoices found"
          description={
            Object.values(filterBarFilters).some((v) => v !== "")
              ? "Try adjusting your filters to find what you're looking for."
              : "Create your first invoice to get started."
          }
          action={
            Object.values(filterBarFilters).some((v) => v !== "")
              ? {
                  label: "Clear Filters",
                  onClick: handleClear,
                  variant: "outline" as const,
                }
              : undefined
          }
        />
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {invoices.map((invoice) => (
              <button
                key={invoice.id}
                type="button"
                className="w-full rounded-xl border border-border/60 bg-card p-4 text-left shadow-sm transition-colors hover:bg-muted/20"
                onClick={() => router.push(`/invoices/${invoice.id}`)}
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg bg-muted text-[11px] font-bold text-muted-foreground">
                    {getInitials(
                      invoice.staff?.name ?? invoice.contact?.name ?? "?",
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="min-w-0 flex-1 text-sm font-semibold leading-tight">
                        {invoice.isRunning && invoice.runningTitle
                          ? invoice.runningTitle
                          : (invoice.invoiceNumber ?? "\u2014")}
                      </p>
                      {invoice.isRunning && (
                        <Badge variant="info" className="text-[9px]">
                          Running
                        </Badge>
                      )}
                      <Badge variant={statusVariant(invoice.status)}>
                        {statusLabel(invoice.status)}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {invoice.staff?.name ??
                        invoice.contact?.name ??
                        "Unknown"}{" "}
                      · {formatDate(invoice.date)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {invoice.department}
                      {invoice.category && (
                        <>
                          {" "}
                          ·{" "}
                          {invoice.category
                            .replace(/_/g, " ")
                            .replace(/\b\w/g, (c: string) => c.toUpperCase())}
                        </>
                      )}
                      {" "}· by {invoice.creatorName}
                    </p>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <p className="text-sm font-bold tabular-nums">
                        {formatAmount(invoice.totalAmount)}
                      </p>
                      {invoice.isRecurring && (
                        <RefreshCwIcon
                          className="size-3.5 text-muted-foreground"
                          aria-hidden="true"
                        />
                      )}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>

          <Table className="hidden md:table">
            <TableHeader>
              <TableRow>
                <TableHead>
                  <div className="flex gap-4">
                    <button
                      className="cursor-pointer select-none text-xs font-medium hover:text-foreground transition-colors"
                      onClick={() => handleSort("invoiceNumber")}
                    >
                      Invoice #{sortIndicator("invoiceNumber")}
                    </button>
                    <button
                      className="cursor-pointer select-none text-xs font-medium hover:text-foreground transition-colors"
                      onClick={() => handleSort("date")}
                    >
                      Date{sortIndicator("date")}
                    </button>
                  </div>
                </TableHead>
                <TableHead className="text-right">
                  <button
                    className="cursor-pointer select-none text-xs font-medium hover:text-foreground transition-colors"
                    onClick={() => handleSort("totalAmount")}
                  >
                    Amount{sortIndicator("totalAmount")}
                  </button>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((invoice) => (
                <TableRow
                  key={invoice.id}
                  className="cursor-pointer group"
                  onClick={() => router.push(`/invoices/${invoice.id}`)}
                  role="link"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter")
                      router.push(`/invoices/${invoice.id}`);
                  }}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-[34px] h-[34px] rounded-lg bg-muted text-[11px] font-bold text-muted-foreground shrink-0">
                        {getInitials(
                          invoice.staff?.name ??
                            invoice.contact?.name ??
                            "?",
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold truncate">
                          <span className="inline-flex items-center gap-1">
                            {invoice.isRunning && invoice.runningTitle
                              ? invoice.runningTitle
                              : (invoice.invoiceNumber ?? "\u2014")}{" "}
                            ·{" "}
                            {invoice.staff?.name ??
                              invoice.contact?.name ??
                              "Unknown"}
                            {invoice.isRecurring && (
                              <span title="Recurring invoice">
                                <RefreshCwIcon
                                  className="size-3 text-muted-foreground shrink-0"
                                  aria-hidden="true"
                                />
                              </span>
                            )}
                          </span>
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {invoice.department} · {formatDate(invoice.date)}
                          {invoice.category && (
                            <>
                              {" "}
                              ·{" "}
                              {invoice.category
                                .replace(/_/g, " ")
                                .replace(/\b\w/g, (c: string) =>
                                  c.toUpperCase(),
                                )}
                            </>
                          )}
                          {" "}· by {invoice.creatorName}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <p className="text-[13px] font-bold tabular-nums">
                      {formatAmount(invoice.totalAmount)}
                    </p>
                    <div className="flex items-center gap-1 justify-end mt-0.5">
                      {invoice.isRunning && (
                        <Badge variant="info" className="text-[9px]">
                          Running
                        </Badge>
                      )}
                      <Badge variant={statusVariant(invoice.status)}>
                        {statusLabel(invoice.status)}
                      </Badge>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Pagination */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Page {page} of {totalPages} ({total} invoice
              {total !== 1 ? "s" : ""})
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() =>
                  setFilter("page", String(Math.max(1, page - 1)))
                }
                className="flex-1 sm:flex-none"
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() =>
                  setFilter("page", String(Math.min(totalPages, page + 1)))
                }
                className="flex-1 sm:flex-none"
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
