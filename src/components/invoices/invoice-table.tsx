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
  type InvoiceFilters,
} from "./invoice-filters";

interface StaffMember {
  id: string;
  name: string;
  department: string;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  date: string;
  department: string;
  category: string;
  totalAmount: string | number;
  status: "DRAFT" | "FINAL" | "PENDING_CHARGE";
  isRecurring: boolean;
  staff: { id: string; name: string; title: string; department: string };
  creator: { id: string; name: string; username: string };
}

interface InvoicesResponse {
  invoices: Invoice[];
  total: number;
  page: number;
  pageSize: number;
}

function getInitials(name: string): string {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

const EMPTY_FILTERS: InvoiceFilters = {
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

export function InvoiceTable() {
  const router = useRouter();

  const [filters, setFilters] = useState<InvoiceFilters>(EMPTY_FILTERS);
  const [departments, setDepartments] = useState<string[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Fetch departments from /api/staff for the filter dropdown
  useEffect(() => {
    async function fetchDepartments() {
      const res = await fetch("/api/staff");
      if (res.ok) {
        const data: StaffMember[] = await res.json();
        const unique = Array.from(
          new Set(data.map((s) => s.department).filter(Boolean))
        ).sort();
        setDepartments(unique);
      }
    }
    fetchDepartments();
  }, []);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);

    const params = new URLSearchParams();
    if (filters.search) params.set("search", filters.search);
    if (filters.status && filters.status !== "all")
      params.set("status", filters.status);
    if (filters.category && filters.category !== "all")
      params.set("category", filters.category);
    if (filters.department && filters.department !== "all")
      params.set("department", filters.department);
    if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
    if (filters.dateTo) params.set("dateTo", filters.dateTo);
    if (filters.amountMin) params.set("amountMin", filters.amountMin);
    if (filters.amountMax) params.set("amountMax", filters.amountMax);
    params.set("page", String(page));
    params.set("pageSize", String(PAGE_SIZE));
    params.set("sortBy", sortBy);
    params.set("sortDir", sortDir);

    const res = await fetch(`/api/invoices?${params.toString()}`);
    if (res.ok) {
      const data: InvoicesResponse = await res.json();
      setInvoices(data.invoices);
      setTotal(data.total);
    } else {
      toast.error("Failed to load invoices");
    }
    setLoading(false);
  }, [filters, page, sortBy, sortDir]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  // Reset to page 1 when filters or sort changes
  function handleFiltersChange(next: InvoiceFilters) {
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

  function formatAmount(amount: string | number) {
    return `$${Number(amount).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  }

  function handleExportCsv() {
    const params = new URLSearchParams();
    if (filters.search) params.set("search", filters.search);
    if (filters.status && filters.status !== "all")
      params.set("status", filters.status);
    if (filters.category && filters.category !== "all")
      params.set("category", filters.category);
    if (filters.department && filters.department !== "all")
      params.set("department", filters.department);
    if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
    if (filters.dateTo) params.set("dateTo", filters.dateTo);
    if (filters.amountMin) params.set("amountMin", filters.amountMin);
    if (filters.amountMax) params.set("amountMax", filters.amountMax);
    window.open(`/api/invoices/export?${params.toString()}`, "_blank");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div className="flex-1">
          <InvoiceFiltersBar
            filters={filters}
            departments={departments}
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
                            {invoice.invoiceNumber} · {invoice.staff.name}
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
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <p className="text-[13px] font-bold tabular-nums">
                      {formatAmount(invoice.totalAmount)}
                    </p>
                    <Badge
                      variant={
                        invoice.status === "FINAL"
                          ? "success"
                          : invoice.status === "PENDING_CHARGE"
                            ? "info"
                            : "warning"
                      }
                      className="mt-0.5"
                    >
                      {invoice.status === "FINAL"
                        ? "Final"
                        : invoice.status === "PENDING_CHARGE"
                          ? "Pending Charge"
                          : "Draft"}
                    </Badge>
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
