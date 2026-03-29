"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
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

type QuoteStatus = "DRAFT" | "SENT" | "ACCEPTED" | "DECLINED" | "EXPIRED";

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

type SortField = "quoteNumber" | "date" | "totalAmount" | "expirationDate";
type SortDir = "asc" | "desc";

const PAGE_SIZE = 20;

const STATUS_BADGE_VARIANT: Record<QuoteStatus, "success" | "info" | "warning" | "destructive" | "outline"> = {
  DRAFT: "warning",
  SENT: "info",
  ACCEPTED: "success",
  DECLINED: "destructive",
  EXPIRED: "outline",
};

const STATUS_LABEL: Record<QuoteStatus, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  ACCEPTED: "Accepted",
  DECLINED: "Declined",
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

const QuoteRow = React.memo(function QuoteRow({ quote, onClick }: QuoteRowProps) {
  function isExpired(dateStr: string | null): boolean {
    if (!dateStr) return false;
    return new Date(dateStr) < new Date();
  }

  return (
    <TableRow
      key={quote.id}
      className="cursor-pointer group"
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

  const handleRowClick = useCallback((id: string) => {
    router.push(`/quotes/${id}`);
  }, [router]);

  const [filters, setFilters] = useState<QuoteFilters>(EMPTY_FILTERS);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const fetchQuotes = useCallback(async () => {
    setLoading(true);

    const params = new URLSearchParams();
    if (filters.search) params.set("search", filters.search);
    if (filters.quoteStatus && filters.quoteStatus !== "all")
      params.set("quoteStatus", filters.quoteStatus);
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

    const res = await fetch(`/api/quotes?${params.toString()}`);
    if (res.ok) {
      const data: QuotesResponse = await res.json();
      setQuotes(data.quotes);
      setTotal(data.total);
    } else {
      toast.error("Failed to load quotes");
    }
    setLoading(false);
  }, [filters, page, sortBy, sortDir]);

  useEffect(() => {
    fetchQuotes();
  }, [fetchQuotes]);

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
        <p className="text-muted-foreground text-sm">No quotes found.</p>
      ) : (
        <>
          <Table>
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
          <div className="flex items-center justify-between">
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
