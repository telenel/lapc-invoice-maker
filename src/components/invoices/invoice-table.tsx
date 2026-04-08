"use client";

import { useDeferredValue, useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { FileTextIcon, RefreshCwIcon, MailIcon } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { FollowUpBadge } from "@/components/follow-up/follow-up-badge";
import { followUpApi } from "@/domains/follow-up/api-client";
import type { FollowUpBadgeState } from "@/domains/follow-up/types";
import { BulkRequestDialog } from "@/components/follow-up/bulk-request-dialog";

const EMPTY_FILTERS: FilterBarFilters = {
  search: "",
  status: "",
  category: "",
  department: "",
  dateFrom: "",
  dateTo: "",
  amountMin: "",
  amountMax: "",
  needsAccountNumber: false,
};

type SortField = "invoiceNumber" | "date" | "totalAmount";
type SortDir = "asc" | "desc";

const PAGE_SIZE = 20;

interface InvoiceTableProps {
  departments: string[];
  categories: { name: string; label: string }[];
}

function parseInitialFilters(searchParams: ReturnType<typeof useSearchParams>): FilterBarFilters {
  return {
    search: searchParams.get("search") ?? "",
    status: searchParams.get("status") ?? "",
    category: searchParams.get("category") ?? "",
    department: searchParams.get("department") ?? "",
    dateFrom: searchParams.get("dateFrom") ?? "",
    dateTo: searchParams.get("dateTo") ?? "",
    amountMin: searchParams.get("amountMin") ?? "",
    amountMax: searchParams.get("amountMax") ?? "",
    needsAccountNumber: searchParams.get("needsAccountNumber") === "true",
  };
}

function parsePage(searchParams: ReturnType<typeof useSearchParams>): number {
  const parsed = Number(searchParams.get("page") ?? "1");
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function parseSortField(searchParams: ReturnType<typeof useSearchParams>): SortField {
  const raw = searchParams.get("sortBy");
  return raw === "invoiceNumber" || raw === "date" || raw === "totalAmount"
    ? raw
    : "date";
}

function parseSortDir(searchParams: ReturnType<typeof useSearchParams>): SortDir {
  const raw = searchParams.get("sortOrder") ?? searchParams.get("sortDir");
  return raw === "asc" ? "asc" : "desc";
}

export function InvoiceTable({ departments, categories }: InvoiceTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [filters, setFilters] = useState<FilterBarFilters>(() => parseInitialFilters(searchParams));
  const [invoices, setInvoices] = useState<InvoiceResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(() => parsePage(searchParams));
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortField>(() => parseSortField(searchParams));
  const [sortDir, setSortDir] = useState<SortDir>(() => parseSortDir(searchParams));
  const [creatorId, setCreatorId] = useState<string | undefined>(() => searchParams.get("creatorId") ?? undefined);
  const deferredSearch = useDeferredValue(filters.search);
  const [badgeStates, setBadgeStates] = useState<Record<string, FollowUpBadgeState>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const data = await invoiceApi.list({
        search: deferredSearch || undefined,
        status: (filters.status && filters.status !== "all" ? filters.status : undefined) as import("@/domains/invoice/types").InvoiceFilters["status"],
        category: filters.category && filters.category !== "all" ? filters.category : undefined,
        department: filters.department && filters.department !== "all" ? filters.department : undefined,
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined,
        amountMin: filters.amountMin ? Number(filters.amountMin) : undefined,
        amountMax: filters.amountMax ? Number(filters.amountMax) : undefined,
        needsAccountNumber: filters.needsAccountNumber || undefined,
        creatorId,
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
  }, [creatorId, deferredSearch, filters.status, filters.category, filters.department, filters.dateFrom, filters.dateTo, filters.amountMin, filters.amountMax, filters.needsAccountNumber, page, sortBy, sortDir]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  useSSE("invoice-changed", fetchInvoices);

  // Fetch follow-up badge states whenever the invoice list changes
  useEffect(() => {
    const ids = invoices.map((inv) => inv.id);
    if (ids.length === 0) {
      setBadgeStates({});
      return;
    }
    followUpApi.getBadgeStatesForInvoices(ids).then(setBadgeStates).catch(() => setBadgeStates({}));
  }, [invoices]);

  // Clear selection when page or filters change
  useEffect(() => {
    setSelectedIds(new Set());
  }, [page, filters]);

  useEffect(() => {
    setFilters(parseInitialFilters(searchParams));
    setPage(parsePage(searchParams));
    setSortBy(parseSortField(searchParams));
    setSortDir(parseSortDir(searchParams));
    setCreatorId(searchParams.get("creatorId") ?? undefined);
  }, [searchParams]);

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

  function statusLabel(status: InvoiceResponse["status"]) {
    return status === "FINAL"
      ? "Final"
      : status === "PENDING_CHARGE"
        ? "Pending Charge"
        : "Draft";
  }

  function statusVariant(status: InvoiceResponse["status"]): "success" | "info" | "warning" {
    return status === "FINAL"
      ? "success"
      : status === "PENDING_CHARGE"
        ? "info"
        : "warning";
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === invoices.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(invoices.map((inv) => inv.id)));
    }
  }

  // Eligible for bulk request: selected, no account number, and no active follow-up series
  const bulkEligibleIds = Array.from(selectedIds).filter((id) => {
    const inv = invoices.find((i) => i.id === id);
    if (!inv || inv.accountNumber) return false;
    const badge = badgeStates[id];
    if (badge && badge.seriesStatus === "ACTIVE") return false;
    return true;
  });

  function handleBulkSuccess() {
    setSelectedIds(new Set());
    fetchInvoices();
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
      needsAccountNumber: filters.needsAccountNumber || undefined,
      creatorId,
    }).then((blob) => {
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    }).catch(() => toast.error("Failed to export CSV"));
  }

  return (
    <div className="space-y-4">
      <InvoiceFiltersBar
        filters={filters}
        departments={departments}
        categories={categories}
        onChange={handleFiltersChange}
        onClear={handleClear}
        onExportCsv={handleExportCsv}
      />

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-muted/30 px-3 py-2 animate-in fade-in-0 slide-in-from-top-1 duration-200">
          <p className="text-sm text-muted-foreground">
            {selectedIds.size} selected
          </p>
          {bulkEligibleIds.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => setBulkDialogOpen(true)}
            >
              <MailIcon className="size-3.5" />
              Request Account Numbers ({bulkEligibleIds.length})
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSelectedIds(new Set())}
          >
            Clear
          </Button>
        </div>
      )}

      <BulkRequestDialog
        open={bulkDialogOpen}
        onOpenChange={setBulkDialogOpen}
        invoiceIds={bulkEligibleIds}
        onSuccess={handleBulkSuccess}
      />

      {loading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : invoices.length === 0 ? (
        <EmptyState
          icon={<FileTextIcon className="size-7" />}
          title="No invoices found"
          description={
            Object.values(filters).some((v) => v !== "" && v !== false)
              ? "Try adjusting your filters to find what you're looking for."
              : "Create your first invoice to get started."
          }
          action={
            Object.values(filters).some((v) => v !== "" && v !== false)
              ? { label: "Clear Filters", onClick: handleClear, variant: "outline" as const }
              : undefined
          }
        />
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {invoices.map((invoice) => (
              <div key={invoice.id} className="flex items-start gap-2">
                <div className="pt-4">
                  <Checkbox
                    checked={selectedIds.has(invoice.id)}
                    onCheckedChange={() => toggleSelected(invoice.id)}
                    aria-label={`Select invoice ${invoice.invoiceNumber ?? invoice.id}`}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                <button
                  type="button"
                  className="w-full rounded-xl border border-border/60 bg-card p-4 text-left shadow-sm transition-colors hover:bg-muted/20"
                  onClick={() => router.push(`/invoices/${invoice.id}`)}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg bg-muted text-[11px] font-bold text-muted-foreground">
                      {getInitials(invoice.staff?.name ?? invoice.contact?.name ?? "?")}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="min-w-0 flex-1 text-sm font-semibold leading-tight">
                          {invoice.isRunning && invoice.runningTitle
                            ? invoice.runningTitle
                            : (invoice.invoiceNumber ?? "—")}
                        </p>
                        {invoice.isRunning && <Badge variant="info" className="text-[9px]">Running</Badge>}
                        <FollowUpBadge state={badgeStates[invoice.id] ?? null} />
                        <Badge variant={statusVariant(invoice.status)}>{statusLabel(invoice.status)}</Badge>
                      </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {invoice.staff?.name ?? invoice.contact?.name ?? "Unknown"} · {formatDate(invoice.date)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {invoice.department}
                      {invoice.category && (
                        <> · {invoice.category.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}</>
                      )}
                      {" "}· by {invoice.creatorName}
                    </p>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <p className="text-sm font-bold tabular-nums">{formatAmount(invoice.totalAmount)}</p>
                      {invoice.isRecurring && <RefreshCwIcon className="size-3.5 text-muted-foreground" aria-hidden="true" />}
                    </div>
                  </div>
                </div>
              </button>
              </div>
            ))}
          </div>

          <Table className="hidden md:table">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]">
                  <Checkbox
                    checked={invoices.length > 0 && selectedIds.size === invoices.length}
                    onCheckedChange={toggleSelectAll}
                    aria-label="Select all invoices"
                  />
                </TableHead>
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
                  <TableCell className="w-[40px]" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedIds.has(invoice.id)}
                      onCheckedChange={() => toggleSelected(invoice.id)}
                      aria-label={`Select invoice ${invoice.invoiceNumber ?? invoice.id}`}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-[34px] h-[34px] rounded-lg bg-muted text-[11px] font-bold text-muted-foreground shrink-0">
                        {getInitials(invoice.staff?.name ?? invoice.contact?.name ?? "?")}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold truncate">
                          <span className="inline-flex items-center gap-1">
                            {invoice.isRunning && invoice.runningTitle
                              ? invoice.runningTitle
                              : (invoice.invoiceNumber ?? "—")} · {invoice.staff?.name ?? invoice.contact?.name ?? "Unknown"}
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
                      <FollowUpBadge state={badgeStates[invoice.id] ?? null} />
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
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="flex-1 sm:flex-none"
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
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
