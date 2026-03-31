"use client";

import React, { useDeferredValue, useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
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
import { useUrlFilters } from "@/lib/use-url-filters";
import { getNextQuoteFilterState } from "./url-filter-utils";

type QuoteStatus =
  | "DRAFT"
  | "SENT"
  | "SUBMITTED_EMAIL"
  | "SUBMITTED_MANUAL"
  | "ACCEPTED"
  | "DECLINED"
  | "REVISED"
  | "EXPIRED";

interface Quote {
  id: string;
  quoteNumber: string;
  date: string;
  recipientName: string | null;
  recipientOrg: string | null;
  department: string;
  category: string;
  totalAmount: string | number;
  expirationDate: string | null;
  quoteStatus: QuoteStatus;
}

interface QuotesResponse {
  quotes: Quote[];
  total: number;
  page: number;
  pageSize: number;
}

const URL_FILTER_DEFAULTS: Record<string, string> = {
  search: "",
  quoteStatus: "",
  category: "",
  department: "",
  creatorId: "",
  dateFrom: "",
  dateTo: "",
  amountMin: "",
  amountMax: "",
  page: "1",
  sortBy: "createdAt",
  sortOrder: "desc",
};

const SAVED_VIEWS = [
  { label: "Awaiting Response", params: { quoteStatus: "SENT" } },
  { label: "My Drafts", params: { quoteStatus: "DRAFT" } },
  { label: "Accepted", params: { quoteStatus: "ACCEPTED" } },
] as const;

type SortField =
  | "quoteNumber"
  | "date"
  | "createdAt"
  | "totalAmount"
  | "expirationDate";
type SortDir = "asc" | "desc";

const PAGE_SIZE = 20;

const STATUS_BADGE_VARIANT: Record<
  QuoteStatus,
  "success" | "info" | "warning" | "destructive" | "outline"
> = {
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

const QuoteRow = React.memo(function QuoteRow({
  quote,
  onClick,
}: QuoteRowProps) {
  return (
    <TableRow
      key={quote.id}
      className={cn(
        "cursor-pointer group",
        quote.quoteStatus === "REVISED" && "opacity-60",
      )}
      onClick={() => onClick(quote.id)}
      role="link"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter") onClick(quote.id);
      }}
    >
      <TableCell>
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-[34px] h-[34px] rounded-lg bg-muted text-[11px] font-bold text-muted-foreground shrink-0">
            {getInitials(quote.recipientName || quote.recipientOrg || "??")}
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold truncate">
              {quote.quoteNumber} ·{" "}
              {quote.recipientName || quote.recipientOrg || "\u2014"}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {quote.department} · {formatDate(quote.date)}
              {quote.expirationDate && (
                <span
                  className={
                    isExpired(quote.expirationDate) ? " text-destructive" : ""
                  }
                >
                  {" "}
                  · Exp {formatDate(quote.expirationDate)}
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
        <Badge
          variant={STATUS_BADGE_VARIANT[quote.quoteStatus]}
          className="mt-0.5"
        >
          {STATUS_LABEL[quote.quoteStatus]}
        </Badge>
      </TableCell>
    </TableRow>
  );
});

export function QuoteTable({ departments, categories }: QuoteTableProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const { filters, setFilter, setFilters, replaceFilters, resetFilters } =
    useUrlFilters(URL_FILTER_DEFAULTS);
  const userId = (session?.user as { id?: string } | undefined)?.id ?? "";

  const handleRowClick = useCallback(
    (id: string) => {
      router.push(`/quotes/${id}`);
    },
    [router],
  );

  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const page = Number(filters.page) || 1;
  const sortBy = (filters.sortBy || "createdAt") as SortField;
  const sortDir = (filters.sortOrder || "desc") as SortDir;
  const deferredSearch = useDeferredValue(filters.search);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  /* Bridge: build QuoteFilters object from URL filters */
  const filterBarFilters: QuoteFilters = useMemo(
    () => ({
      search: filters.search,
      quoteStatus: filters.quoteStatus,
      category: filters.category,
      department: filters.department,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      amountMin: filters.amountMin,
      amountMax: filters.amountMax,
    }),
    [filters],
  );

  const fetchQuotes = useCallback(async () => {
    setLoading(true);

    const params = new URLSearchParams();
    if (deferredSearch) params.set("search", deferredSearch);
    if (filters.quoteStatus && filters.quoteStatus !== "all")
      params.set("quoteStatus", filters.quoteStatus);
    if (filters.category && filters.category !== "all")
      params.set("category", filters.category);
    if (filters.department && filters.department !== "all")
      params.set("department", filters.department);
    if (filters.creatorId) params.set("creatorId", filters.creatorId);
    if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
    if (filters.dateTo) params.set("dateTo", filters.dateTo);
    if (filters.amountMin) params.set("amountMin", filters.amountMin);
    if (filters.amountMax) params.set("amountMax", filters.amountMax);
    params.set("page", String(page));
    params.set("pageSize", String(PAGE_SIZE));
    params.set("sortBy", sortBy);
    params.set("sortDir", sortDir);

    const res = await fetch(`/api/quotes?${params.toString()}`);
    if (res.ok) {
      const data: QuotesResponse = await res.json();
      setQuotes(data.quotes);
      setTotal(data.total);
    } else {
      toast.error("Failed to load quotes");
    }
    setLoading(false);
  }, [
    deferredSearch,
    filters.quoteStatus,
    filters.category,
    filters.department,
    filters.creatorId,
    filters.dateFrom,
    filters.dateTo,
    filters.amountMin,
    filters.amountMax,
    page,
    sortBy,
    sortDir,
  ]);

  useEffect(() => {
    fetchQuotes();
  }, [fetchQuotes]);

  useSSE("quote-changed", fetchQuotes);

  function handleFiltersChange(next: QuoteFilters) {
    replaceFilters(
      getNextQuoteFilterState(
        {
          creatorId: filters.creatorId,
          sortBy: filters.sortBy,
          sortOrder: filters.sortOrder,
        },
        next,
      ),
    );
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

  /** Build a URL string for a saved view */
  function savedViewHref(params: Record<string, string>) {
    const sp = new URLSearchParams({
      ...params,
      ...(params.quoteStatus === "DRAFT" && userId ? { creatorId: userId } : {}),
    });
    return `/quotes?${sp.toString()}`;
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

      <div className="flex-1">
        <QuoteFiltersBar
          filters={filterBarFilters}
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
            Object.values(filterBarFilters).some((v) => v !== "")
              ? "Try adjusting your filters to find what you're looking for."
              : "Create your first quote to get started."
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
            {quotes.map((quote) => (
              <button
                key={quote.id}
                type="button"
                className={cn(
                  "w-full rounded-xl border border-border/60 bg-card p-4 text-left shadow-sm transition-colors hover:bg-muted/20",
                  quote.quoteStatus === "REVISED" && "opacity-60",
                )}
                onClick={() => handleRowClick(quote.id)}
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg bg-muted text-[11px] font-bold text-muted-foreground">
                    {getInitials(
                      quote.recipientName || quote.recipientOrg || "??",
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="min-w-0 flex-1 text-sm font-semibold leading-tight">
                        {quote.quoteNumber}
                      </p>
                      <Badge
                        variant={STATUS_BADGE_VARIANT[quote.quoteStatus]}
                      >
                        {STATUS_LABEL[quote.quoteStatus]}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {quote.recipientName ||
                        quote.recipientOrg ||
                        "\u2014"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {quote.department} · {formatDate(quote.date)}
                      {quote.expirationDate && (
                        <span
                          className={
                            isExpired(quote.expirationDate)
                              ? " text-destructive"
                              : ""
                          }
                        >
                          {" "}
                          · Exp {formatDate(quote.expirationDate)}
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
                <QuoteRow
                  key={quote.id}
                  quote={quote}
                  onClick={handleRowClick}
                />
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
