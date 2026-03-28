"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RefreshCwIcon } from "lucide-react";
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

const EMPTY_FILTERS: FilterBarFilters = {
  search: "",
  status: "",
  category: "",
  department: "",
  dateFrom: "",
  dateTo: "",
  amountMin: "",
  amountMax: "",
};

type SortField = "invoiceNumber" | "date" | "totalAmount";
type SortDir = "asc" | "desc";

const PAGE_SIZE = 20;

interface InvoiceTableProps {
  departments: string[];
  categories: { name: string; label: string }[];
}

export function InvoiceTable({ departments, categories }: InvoiceTableProps) {
  const router = useRouter();

  const [filters, setFilters] = useState<FilterBarFilters>(EMPTY_FILTERS);
  const [invoices, setInvoices] = useState<InvoiceResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const data = await invoiceApi.list({
        search: filters.search || undefined,
        status: (filters.status && filters.status !== "all" ? filters.status : undefined) as import("@/domains/invoice/types").InvoiceFilters["status"],
        category: filters.category && filters.category !== "all" ? filters.category : undefined,
        department: filters.department && filters.department !== "all" ? filters.department : undefined,
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined,
        amountMin: filters.amountMin ? Number(filters.amountMin) : undefined,
        amountMax: filters.amountMax ? Number(filters.amountMax) : undefined,
        page,
        pageSize: PAGE_SIZE,
        sortBy,
        sortOrder: sortDir,
      });
      setInvoices(data.data);
      setTotal(data.total);
    } catch {
      toast.error("Failed to load invoices");
    }
    setLoading(false);
  }, [filters, page, sortBy, sortDir]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  // Reset to page 1 when filters or sort changes
  function handleFiltersChange(next: FilterBarFilters) {
    setFilters(next);
    setPage(1);
  }

  function handleClear() {
    setFilters(EMPTY_FILTERS);
    setPage(1);
  }

  function handleSort(field: SortField) {
    if (sortBy === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortDir("asc");
    }
    setPage(1);
  }

  function sortIndicator(field: SortField) {
    if (sortBy !== field) return null;
    return sortDir === "asc" ? " ↑" : " ↓";
  }

  function handleExportCsv() {
    invoiceApi.exportCsv({
      search: filters.search || undefined,
      status: (filters.status && filters.status !== "all" ? filters.status : undefined) as import("@/domains/invoice/types").InvoiceFilters["status"],
      category: filters.category && filters.category !== "all" ? filters.category : undefined,
      department: filters.department && filters.department !== "all" ? filters.department : undefined,
      dateFrom: filters.dateFrom || undefined,
      dateTo: filters.dateTo || undefined,
      amountMin: filters.amountMin ? Number(filters.amountMin) : undefined,
      amountMax: filters.amountMax ? Number(filters.amountMax) : undefined,
    }).then((blob) => {
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    }).catch(() => toast.error("Failed to export CSV"));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div className="flex-1">
          <InvoiceFiltersBar
            filters={filters}
            departments={departments}
            categories={categories}
            onChange={handleFiltersChange}
            onClear={handleClear}
          />
        </div>
        <Button variant="outline" size="sm" onClick={handleExportCsv}>
          Export CSV
        </Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : invoices.length === 0 ? (
        <p className="text-muted-foreground text-sm">No invoices found.</p>
      ) : (
        <>
          <Table>
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
                  onKeyDown={(e) => { if (e.key === "Enter") router.push(`/invoices/${invoice.id}`); }}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-[34px] h-[34px] rounded-lg bg-muted text-[11px] font-bold text-muted-foreground shrink-0">
                        {getInitials(invoice.staff.name)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold truncate">
                          <span className="inline-flex items-center gap-1">
                            {invoice.isRunning && invoice.runningTitle
                              ? invoice.runningTitle
                              : (invoice.invoiceNumber ?? "—")} · {invoice.staff.name}
                            {invoice.isRecurring && (
                              <span title="Recurring invoice">
                                <RefreshCwIcon className="size-3 text-muted-foreground shrink-0" aria-hidden="true" />
                              </span>
                            )}
                          </span>
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {invoice.department} · {formatDate(invoice.date)}
                          {invoice.category && (
                            <> · {invoice.category.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}</>
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
                        <Badge variant="info" className="text-[9px]">Running</Badge>
                      )}
                      <Badge
                        variant={
                          invoice.status === "FINAL"
                            ? "success"
                            : invoice.status === "PENDING_CHARGE"
                              ? "info"
                              : "warning"
                        }
                      >
                        {invoice.status === "FINAL"
                          ? "Final"
                          : invoice.status === "PENDING_CHARGE"
                            ? "Pending Charge"
                            : "Draft"}
                      </Badge>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Page {page} of {totalPages} ({total} invoice
              {total !== 1 ? "s" : ""})
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
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
