"use client";

import { useEffect, useState, useCallback } from "react";
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
  status: QuoteStatus;
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

const STATUS_BADGE_VARIANT: Record<QuoteStatus, "default" | "secondary" | "outline" | "destructive"> = {
  DRAFT: "outline",
  SENT: "secondary",
  ACCEPTED: "default",
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

export function QuoteTable() {
  const router = useRouter();

  const [filters, setFilters] = useState<QuoteFilters>(EMPTY_FILTERS);
  const [departments, setDepartments] = useState<string[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
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
        const data: { id: string; name: string; department: string }[] = await res.json();
        const unique = Array.from(
          new Set(data.map((s) => s.department).filter(Boolean))
        ).sort();
        setDepartments(unique);
      }
    }
    fetchDepartments();
  }, []);

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

  function isExpired(dateStr: string | null): boolean {
    if (!dateStr) return false;
    return new Date(dateStr) < new Date();
  }

  return (
    <div className="space-y-4">
      <div className="flex-1">
        <QuoteFiltersBar
          filters={filters}
          departments={departments}
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
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => handleSort("quoteNumber")}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleSort("quoteNumber"); } }}
                >
                  Quote #{sortIndicator("quoteNumber")}
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => handleSort("date")}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleSort("date"); } }}
                >
                  Date{sortIndicator("date")}
                </TableHead>
                <TableHead>Recipient</TableHead>
                <TableHead>Department</TableHead>
                <TableHead
                  className="cursor-pointer select-none text-right"
                  onClick={() => handleSort("totalAmount")}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleSort("totalAmount"); } }}
                >
                  Amount{sortIndicator("totalAmount")}
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => handleSort("expirationDate")}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleSort("expirationDate"); } }}
                >
                  Expires{sortIndicator("expirationDate")}
                </TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quotes.map((quote) => (
                <TableRow
                  key={quote.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/quotes/${quote.id}`)}
                  role="link"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === "Enter") router.push(`/quotes/${quote.id}`); }}
                >
                  <TableCell className="font-bold">
                    {quote.quoteNumber}
                  </TableCell>
                  <TableCell>{formatDate(quote.date)}</TableCell>
                  <TableCell>
                    {quote.recipientName || quote.recipientOrg || "\u2014"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{quote.department}</Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatAmount(quote.totalAmount)}
                  </TableCell>
                  <TableCell>
                    {quote.expirationDate ? (
                      <span className={isExpired(quote.expirationDate) ? "text-destructive" : ""}>
                        {formatDate(quote.expirationDate)}
                      </span>
                    ) : (
                      "\u2014"
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_BADGE_VARIANT[quote.status]}>
                      {STATUS_LABEL[quote.status]}
                    </Badge>
                  </TableCell>
                </TableRow>
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
