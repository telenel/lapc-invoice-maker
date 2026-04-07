"use client";

import React, { useDeferredValue, useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
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
  QuoteFiltersBar,
  type QuoteFilters,
} from "./quote-filters";
import { formatAmount, formatDate, getInitials } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { ClipboardListIcon } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { useSSE } from "@/lib/use-sse";
import { quoteApi } from "@/domains/quote/api-client";

type QuoteStatus = "DRAFT" | "SENT" | "SUBMITTED_EMAIL" | "SUBMITTED_MANUAL" | "ACCEPTED" | "DECLINED" | "REVISED" | "EXPIRED";

interface Quote {
  id: string;
  quoteNumber: string | null;
  date: string;
  recipientName: string | null;
  recipientOrg: string | null;
  department: string;
  category: string;
  totalAmount: string | number;
  expirationDate: string | null;
  quoteStatus: QuoteStatus;
}

const EMPTY_FILTERS: QuoteFilters = {
  search: "",
  quoteStatus: "",
  category: "",
  department: "",
  dateFrom: "",
  dateTo: "",
  amountMin: "",
  amountMax: "",
};

type SortField = "quoteNumber" | "date" | "createdAt" | "totalAmount" | "expirationDate";
type SortDir = "asc" | "desc";

const PAGE_SIZE = 20;

const STATUS_BADGE_VARIANT: Record<QuoteStatus, "success" | "info" | "warning" | "destructive" | "outline"> = {
  DRAFT: "warning",
  SENT: "info",
  SUBMITTED_EMAIL: "info",
  SUBMITTED_MANUAL: "info",
  ACCEPTED: "success",
  DECLINED: "destructive",
  REVISED: "outline",
  EXPIRED: "outline",
};

const STATUS_LABEL: Record<QuoteStatus, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  SUBMITTED_EMAIL: "Sent (Email)",
  SUBMITTED_MANUAL: "Sent (Manual)",
  ACCEPTED: "Accepted",
  DECLINED: "Declined",
  REVISED: "Revised",
  EXPIRED: "Expired",
};

interface QuoteTableProps {
  departments: string[];
  categories: { name: string; label: string }[];
}

function parseInitialFilters(searchParams: ReturnType<typeof useSearchParams>): QuoteFilters {
  return {
    search: searchParams.get("search") ?? "",
    quoteStatus: searchParams.get("quoteStatus") ?? "",
    category: searchParams.get("category") ?? "",
    department: searchParams.get("department") ?? "",
    dateFrom: searchParams.get("dateFrom") ?? "",
    dateTo: searchParams.get("dateTo") ?? "",
    amountMin: searchParams.get("amountMin") ?? "",
    amountMax: searchParams.get("amountMax") ?? "",
  };
}

function parsePage(searchParams: ReturnType<typeof useSearchParams>): number {
  const parsed = Number(searchParams.get("page") ?? "1");
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function parseSortField(searchParams: ReturnType<typeof useSearchParams>): SortField {
  const raw = searchParams.get("sortBy");
  return raw === "quoteNumber" || raw === "date" || raw === "createdAt" || raw === "totalAmount" || raw === "expirationDate"
    ? raw
    : "createdAt";
}

function parseSortDir(searchParams: ReturnType<typeof useSearchParams>): SortDir {
  const raw = searchParams.get("sortOrder") ?? searchParams.get("sortDir");
  return raw === "asc" ? "asc" : "desc";
}

interface QuoteRowProps {
  quote: Quote;
  onClick: (id: string) => void;
}

function isExpired(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const expiry = new Date(dateStr);
  expiry.setUTCHours(0, 0, 0, 0);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return expiry < today;
}

const QuoteRow = React.memo(function QuoteRow({ quote, onClick }: QuoteRowProps) {
  return (
    <TableRow
      key={quote.id}
      className={cn("cursor-pointer group", quote.quoteStatus === "REVISED" && "opacity-60")}
      onClick={() => onClick(quote.id)}
      role="link"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter") onClick(quote.id); }}
    >
      <TableCell>
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-[34px] h-[34px] rounded-lg bg-muted text-[11px] font-bold text-muted-foreground shrink-0">
            {getInitials(quote.recipientName || quote.recipientOrg || "??")}
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold truncate">
              {quote.quoteNumber} · {quote.recipientName || quote.recipientOrg || "—"}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {quote.department} · {formatDate(quote.date)}
              {quote.expirationDate && (
                <span className={isExpired(quote.expirationDate) ? " text-destructive" : ""}>
                  {" "}· Exp {formatDate(quote.expirationDate)}
                </span>
              )}
            </p>
          </div>
        </div>
      </TableCell>
      <TableCell className="text-right">
        <p className="text-[13px] font-bold tabular-nums">
          {formatAmount(quote.totalAmount)}
        </p>
        <Badge variant={STATUS_BADGE_VARIANT[quote.quoteStatus]} className="mt-0.5">
          {STATUS_LABEL[quote.quoteStatus]}
        </Badge>
      </TableCell>
    </TableRow>
  );
});

export function QuoteTable({ departments, categories }: QuoteTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleRowClick = useCallback((id: string) => {
    router.push(`/quotes/${id}`);
  }, [router]);

  const [filters, setFilters] = useState<QuoteFilters>(() => parseInitialFilters(searchParams));
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(() => parsePage(searchParams));
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortField>(() => parseSortField(searchParams));
  const [sortDir, setSortDir] = useState<SortDir>(() => parseSortDir(searchParams));
  const [creatorId, setCreatorId] = useState<string | undefined>(() => searchParams.get("creatorId") ?? undefined);
  const deferredSearch = useDeferredValue(filters.search);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const fetchQuotes = useCallback(async () => {
    setLoading(true);
    try {
      const data = await quoteApi.list({
        search: deferredSearch || undefined,
        quoteStatus: filters.quoteStatus && filters.quoteStatus !== "all"
          ? filters.quoteStatus as import("@/domains/quote/types").QuoteFilters["quoteStatus"]
          : undefined,
        category: filters.category && filters.category !== "all" ? filters.category : undefined,
        department: filters.department && filters.department !== "all" ? filters.department : undefined,
        creatorId,
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined,
        amountMin: filters.amountMin ? Number(filters.amountMin) : undefined,
        amountMax: filters.amountMax ? Number(filters.amountMax) : undefined,
        page,
        pageSize: PAGE_SIZE,
        sortBy,
        sortOrder: sortDir,
      });
      setQuotes(data.quotes);
      setTotal(data.total);
    } catch {
      toast.error("Failed to load quotes");
    }
    setLoading(false);
  }, [creatorId, deferredSearch, filters.quoteStatus, filters.category, filters.department, filters.dateFrom, filters.dateTo, filters.amountMin, filters.amountMax, page, sortBy, sortDir]);

  useEffect(() => {
    fetchQuotes();
  }, [fetchQuotes]);

  useSSE("quote-changed", fetchQuotes);

  useEffect(() => {
    setFilters(parseInitialFilters(searchParams));
    setPage(parsePage(searchParams));
    setSortBy(parseSortField(searchParams));
    setSortDir(parseSortDir(searchParams));
    setCreatorId(searchParams.get("creatorId") ?? undefined);
  }, [searchParams]);

  // Reset to page 1 when filters or sort changes
  function handleFiltersChange(next: QuoteFilters) {
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
    return sortDir === "asc" ? " \u2191" : " \u2193";
  }

  return (
    <div className="space-y-4">
      <div className="flex-1">
        <QuoteFiltersBar
          filters={filters}
          departments={departments}
          categories={categories}
          onChange={handleFiltersChange}
          onClear={handleClear}
        />
      </div>

      {loading ? (
        <p className="text-muted-foreground text-sm">Loading...</p>
      ) : quotes.length === 0 ? (
        <EmptyState
          icon={<ClipboardListIcon className="size-7" />}
          title="No quotes found"
          description={
            Object.values(filters).some((v) => v !== "")
              ? "Try adjusting your filters to find what you're looking for."
              : "Create your first quote to get started."
          }
          action={
            Object.values(filters).some((v) => v !== "")
              ? { label: "Clear Filters", onClick: handleClear, variant: "outline" as const }
              : undefined
          }
        />
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {quotes.map((quote) => (
              <button
                key={quote.id}
                type="button"
                className={cn(
                  "w-full rounded-xl border border-border/60 bg-card p-4 text-left shadow-sm transition-colors hover:bg-muted/20",
                  quote.quoteStatus === "REVISED" && "opacity-60"
                )}
                onClick={() => handleRowClick(quote.id)}
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg bg-muted text-[11px] font-bold text-muted-foreground">
                    {getInitials(quote.recipientName || quote.recipientOrg || "??")}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="min-w-0 flex-1 text-sm font-semibold leading-tight">
                        {quote.quoteNumber}
                      </p>
                      <Badge variant={STATUS_BADGE_VARIANT[quote.quoteStatus]}>
                        {STATUS_LABEL[quote.quoteStatus]}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {quote.recipientName || quote.recipientOrg || "—"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {quote.department} · {formatDate(quote.date)}
                      {quote.expirationDate && (
                        <span className={isExpired(quote.expirationDate) ? " text-destructive" : ""}>
                          {" "}· Exp {formatDate(quote.expirationDate)}
                        </span>
                      )}
                    </p>
                    <p className="mt-3 text-sm font-bold tabular-nums">
                      {formatAmount(quote.totalAmount)}
                    </p>
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
                      className="cursor-pointer select-none text-xs font-medium hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                      onClick={() => handleSort("quoteNumber")}
                    >
                      Quote #{sortIndicator("quoteNumber")}
                    </button>
                    <button
                      className="cursor-pointer select-none text-xs font-medium hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                      onClick={() => handleSort("date")}
                    >
                      Date{sortIndicator("date")}
                    </button>
                    <button
                      className="cursor-pointer select-none text-xs font-medium hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                      onClick={() => handleSort("expirationDate")}
                    >
                      Expires{sortIndicator("expirationDate")}
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
              {quotes.map((quote) => (
                <QuoteRow key={quote.id} quote={quote} onClick={handleRowClick} />
              ))}
            </TableBody>
          </Table>

          {/* Pagination */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Page {page} of {totalPages} ({total} quote
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
