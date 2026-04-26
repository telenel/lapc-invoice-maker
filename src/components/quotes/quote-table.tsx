"use client";

import React, { useDeferredValue, useEffect, useMemo, useRef, useState, useCallback } from "react";
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
import { isDateOnlyBeforeTodayInTimeZone } from "@/lib/date-utils";
import { cn } from "@/lib/utils";
import { ClipboardListIcon, SendIcon } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/empty-state";
import { FollowUpBadge } from "@/components/follow-up/follow-up-badge";
import { BulkRequestDialog } from "@/components/follow-up/bulk-request-dialog";
import { useSSE } from "@/lib/use-sse";
import { quoteApi, type QuoteListResponse } from "@/domains/quote/api-client";
import { followUpApi } from "@/domains/follow-up/api-client";
import type { FollowUpBadgeState } from "@/domains/follow-up/types";
import type { QuoteFilters as QuoteRequestFilters, QuoteListItemResponse, QuoteStatus } from "@/domains/quote/types";

const EMPTY_FILTERS: QuoteFilters = {
  search: "",
  quoteStatus: "",
  category: "",
  department: "",
  dateFrom: "",
  dateTo: "",
  amountMin: "",
  amountMax: "",
  needsAccountNumber: false,
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
  initialData?: QuoteListResponse;
  initialRequest?: QuoteRequestFilters & { sortBy?: string; sortOrder?: "asc" | "desc" };
  initialBadgeStates?: Record<string, FollowUpBadgeState>;
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
    needsAccountNumber: searchParams.get("needsAccountNumber") === "true",
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
  quote: QuoteListItemResponse;
  onClick: (id: string) => void;
  badgeState: FollowUpBadgeState | null;
  selected: boolean;
  selectable: boolean;
  onSelect: (id: string, checked: boolean) => void;
}

function isExpired(dateStr: string | null): boolean {
  if (!dateStr) return false;
  return isDateOnlyBeforeTodayInTimeZone(dateStr);
}

const QuoteRow = React.memo(function QuoteRow({ quote, onClick, badgeState, selected, selectable, onSelect }: QuoteRowProps) {
  return (
    <TableRow
      key={quote.id}
      className={cn("cursor-pointer group hover:bg-muted/30 transition-colors", quote.quoteStatus === "REVISED" && "opacity-60")}
      onClick={() => onClick(quote.id)}
      role="link"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter") onClick(quote.id); }}
    >
      <TableCell className="w-[40px]" onClick={(e) => e.stopPropagation()}>
        <Checkbox
          checked={selected}
          disabled={!selectable}
          onCheckedChange={(checked) => onSelect(quote.id, !!checked)}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Select ${quote.quoteNumber ?? "quote"}`}
          className="shrink-0"
        />
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-[34px] h-[34px] rounded-lg bg-muted text-xs font-bold text-muted-foreground shrink-0">
            {getInitials(quote.recipientName || quote.recipientOrg || "??")}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">
              {quote.quoteNumber} · {quote.recipientName || quote.recipientOrg || "—"}
            </p>
            <p className="text-xs text-muted-foreground">
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
        <p className="text-sm font-bold tabular-nums">
          {formatAmount(quote.totalAmount)}
        </p>
        <div className="flex items-center gap-1 justify-end mt-0.5">
          <Badge variant={STATUS_BADGE_VARIANT[quote.quoteStatus]}>
            {STATUS_LABEL[quote.quoteStatus]}
          </Badge>
          <FollowUpBadge state={quote.paymentFollowUpBadge ?? null} />
          <FollowUpBadge state={badgeState} />
        </div>
      </TableCell>
    </TableRow>
  );
});

export function QuoteTable({
  departments,
  categories,
  initialData,
  initialRequest,
  initialBadgeStates,
}: QuoteTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasInitialBadgeStates = initialBadgeStates !== undefined;

  const handleRowClick = useCallback((id: string) => {
    router.push(`/quotes/${id}`);
  }, [router]);

  const [filters, setFilters] = useState<QuoteFilters>(() => parseInitialFilters(searchParams));
  const [quotes, setQuotes] = useState<QuoteListItemResponse[]>(initialData?.quotes ?? []);
  const [total, setTotal] = useState(initialData?.total ?? 0);
  const [page, setPage] = useState(() => parsePage(searchParams));
  const [loading, setLoading] = useState(() => initialData === undefined);
  const [sortBy, setSortBy] = useState<SortField>(() => parseSortField(searchParams));
  const [sortDir, setSortDir] = useState<SortDir>(() => parseSortDir(searchParams));
  const [creatorId, setCreatorId] = useState<string | undefined>(() => searchParams.get("creatorId") ?? undefined);
  const deferredSearch = useDeferredValue(filters.search);
  const [badgeStates, setBadgeStates] = useState<Record<string, FollowUpBadgeState>>(initialBadgeStates ?? {});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const skippedInitialFetchRef = useRef(initialData !== undefined);
  const skippedInitialBadgeFetchRef = useRef(initialData !== undefined && hasInitialBadgeStates);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentRequestKey = JSON.stringify({
    search: deferredSearch || undefined,
    quoteStatus: filters.quoteStatus && filters.quoteStatus !== "all"
      ? filters.quoteStatus as QuoteRequestFilters["quoteStatus"]
      : undefined,
    category: filters.category && filters.category !== "all" ? filters.category : undefined,
    department: filters.department && filters.department !== "all" ? filters.department : undefined,
    creatorId,
    dateFrom: filters.dateFrom || undefined,
    dateTo: filters.dateTo || undefined,
    amountMin: filters.amountMin ? Number(filters.amountMin) : undefined,
    amountMax: filters.amountMax ? Number(filters.amountMax) : undefined,
    needsAccountNumber: filters.needsAccountNumber || undefined,
    page,
    pageSize: PAGE_SIZE,
    sortBy,
    sortOrder: sortDir,
  });
  const initialRequestKey = initialRequest ? JSON.stringify(initialRequest) : null;

  const fetchQuotes = useCallback(async () => {
    setLoading(true);
    try {
      const data = await quoteApi.list({
        search: deferredSearch || undefined,
        quoteStatus: filters.quoteStatus && filters.quoteStatus !== "all"
          ? filters.quoteStatus as QuoteRequestFilters["quoteStatus"]
          : undefined,
        category: filters.category && filters.category !== "all" ? filters.category : undefined,
        department: filters.department && filters.department !== "all" ? filters.department : undefined,
        creatorId,
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined,
        amountMin: filters.amountMin ? Number(filters.amountMin) : undefined,
        amountMax: filters.amountMax ? Number(filters.amountMax) : undefined,
        needsAccountNumber: filters.needsAccountNumber || undefined,
        page,
        pageSize: PAGE_SIZE,
        sortBy,
        sortOrder: sortDir,
      });
      setQuotes(data.quotes);
      setTotal(data.total);
      setSelectedIds(new Set());
    } catch {
      toast.error("Failed to load quotes");
    }
    setLoading(false);
  }, [
    creatorId,
    deferredSearch,
    filters.amountMax,
    filters.amountMin,
    filters.category,
    filters.dateFrom,
    filters.dateTo,
    filters.department,
    filters.needsAccountNumber,
    filters.quoteStatus,
    page,
    sortBy,
    sortDir,
  ]);

  useEffect(() => {
    if (skippedInitialFetchRef.current && initialRequestKey === currentRequestKey) {
      skippedInitialFetchRef.current = false;
      return;
    }

    void fetchQuotes();
  }, [currentRequestKey, fetchQuotes, initialRequestKey]);

  useSSE("quote-changed", fetchQuotes);

  useEffect(() => {
    const ids = quotes.map((quote) => quote.id);
    if (ids.length === 0) {
      setBadgeStates({});
      return;
    }
    if (
      skippedInitialBadgeFetchRef.current
      && initialData
      && ids.join(",") === initialData.quotes.map((quote) => quote.id).join(",")
    ) {
      skippedInitialBadgeFetchRef.current = false;
      return;
    }

    followUpApi.getBadgeStatesForInvoices(ids).then(setBadgeStates).catch(() => {
      setBadgeStates({});
    });
  }, [initialData, quotes]);

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

  const selectableIds = useMemo(
    () => quotes.filter((q) => {
      if (q.accountNumber) return false;
      const badge = badgeStates[q.id];
      if (badge && badge.seriesStatus === "ACTIVE") return false;
      return true;
    }).map((q) => q.id),
    [quotes, badgeStates],
  );

  function handleSelect(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function handleSelectAll(checked: boolean) {
    setSelectedIds(checked ? new Set(selectableIds) : new Set());
  }

  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selectedIds.has(id));

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

      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-muted/30 px-3 py-2">
          <span className="text-sm font-medium">
            {selectedIds.size} selected
          </span>
          <Button size="sm" className="gap-1.5" onClick={() => setBulkOpen(true)}>
            <SendIcon className="size-3.5" />
            Request Account Numbers
          </Button>
        </div>
      )}

      <BulkRequestDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        invoiceIds={Array.from(selectedIds).filter((id) => selectableIds.includes(id))}
        onSuccess={fetchQuotes}
      />

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl border border-border/40 bg-card p-4">
              <div className="skeleton h-[34px] w-[34px] rounded-lg shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="skeleton h-3.5 w-40" />
                <div className="skeleton h-2.5 w-56" />
              </div>
              <div className="skeleton h-3.5 w-16 shrink-0" />
            </div>
          ))}
        </div>
      ) : quotes.length === 0 ? (
        <EmptyState
          icon={<ClipboardListIcon className="size-7" />}
          illustration={Object.values(filters).some((v) => v !== "" && v !== false) ? "/illustrations/empty-no-results.png" : "/illustrations/empty-quotes.png"}
          title="No quotes found"
          description={
            Object.values(filters).some((v) => v !== "" && v !== false)
              ? "Try adjusting your filters to find what you're looking for."
              : "Create your first quote to get started."
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
                  <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-bold text-muted-foreground">
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
                      <FollowUpBadge state={quote.paymentFollowUpBadge ?? null} />
                      <FollowUpBadge state={badgeStates[quote.id] ?? null} />
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
                <TableHead className="w-[40px]">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={(checked) => handleSelectAll(!!checked)}
                    aria-label="Select all quotes"
                    className="shrink-0"
                  />
                </TableHead>
                <TableHead>
                  <div className="flex items-center gap-4">
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
                  badgeState={badgeStates[quote.id] ?? null}
                  selected={selectedIds.has(quote.id)}
                  selectable={selectableIds.includes(quote.id)}
                  onSelect={handleSelect}
                />
              ))}
            </TableBody>
          </Table>

          {/* Pagination */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-border/40 bg-muted/20 px-4 py-2.5">
            <p className="text-sm text-muted-foreground tabular-nums">
              Page <span className="font-medium text-foreground">{page}</span> of <span className="font-medium text-foreground">{totalPages}</span> ({total} quote{total !== 1 ? "s" : ""})
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
