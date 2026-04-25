"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatAmount, formatDate } from "@/lib/formatters";
import { adminApi } from "@/domains/admin/api-client";
import { quoteApi } from "@/domains/quote/api-client";
import type { QuoteListItemResponse, QuoteStatus } from "@/domains/quote/types";
import type { UserResponse } from "@/domains/admin/types";
import { BatchActionBar } from "./batch-action-bar";

const QUOTE_STATUSES: { value: QuoteStatus; label: string }[] = [
  { value: "DRAFT", label: "Draft" },
  { value: "SENT", label: "Sent" },
  { value: "SUBMITTED_EMAIL", label: "Submitted (Email)" },
  { value: "SUBMITTED_MANUAL", label: "Submitted (Manual)" },
  { value: "ACCEPTED", label: "Accepted" },
  { value: "DECLINED", label: "Declined" },
  { value: "REVISED", label: "Revised" },
  { value: "EXPIRED", label: "Expired" },
];

function statusBadgeVariant(status: string) {
  switch (status) {
    case "ACCEPTED": return "success" as const;
    case "DRAFT": return "warning" as const;
    case "SENT": case "SUBMITTED_EMAIL": case "SUBMITTED_MANUAL": return "info" as const;
    case "DECLINED": return "destructive" as const;
    default: return "secondary" as const;
  }
}

const PAGE_SIZE = 20;

export function QuoteManager() {
  const [quotes, setQuotes] = useState<QuoteListItemResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [users, setUsers] = useState<UserResponse[]>([]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Debounce search input → committed search value
  useEffect(() => {
    const timeout = setTimeout(() => {
      setPage(1);
      setSearch(searchInput);
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  const fetchQuotes = useCallback(async () => {
    setLoading(true);
    try {
      const result = await quoteApi.list({
        page, pageSize: PAGE_SIZE,
        search: search || undefined,
        quoteStatus: statusFilter !== "all" ? (statusFilter as QuoteStatus) : undefined,
      });
      // Clamp page if batch action shrunk result set
      const newTotalPages = Math.max(1, Math.ceil(result.total / PAGE_SIZE));
      if (page > newTotalPages) {
        setPage(newTotalPages);
        return;
      }
      setQuotes(result.quotes);
      setTotal(result.total);
    } catch { toast.error("Failed to load quotes"); }
    finally { setLoading(false); }
  }, [page, search, statusFilter]);

  useEffect(() => { fetchQuotes(); }, [fetchQuotes]);
  useEffect(() => { adminApi.listUsers().then(setUsers).catch(() => {}); }, []);
  useEffect(() => { setSelectedIds(new Set()); }, [page, statusFilter, search]);

  const allOnPageSelected = quotes.length > 0 && quotes.every((q) => selectedIds.has(q.id));
  function toggleSelectAll() { setSelectedIds(allOnPageSelected ? new Set() : new Set(quotes.map((q) => q.id))); }
  function toggleSelect(id: string) { setSelectedIds((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; }); }

  async function handleBatchAction(action: "status" | "reassign" | "delete", value?: string) {
    try {
      const result = await adminApi.batchQuotes({ ids: Array.from(selectedIds), action, value });
      const count = result.deleted ?? result.updated ?? 0;
      toast.success(`${action === "delete" ? "Deleted" : "Updated"} ${count} quote${count === 1 ? "" : "s"}`);
      setSelectedIds(new Set());
      fetchQuotes();
    } catch { toast.error("Batch action failed"); }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold">Quote Manager</h2>
        <div className="flex items-center gap-2">
          <Input className="h-8 w-56 text-sm" placeholder="Search quotes..." value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v ?? "all"); setPage(1); }}>
            <SelectTrigger className="h-8 w-48 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {QUOTE_STATUSES.map((s) => (<SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <BatchActionBar selectedCount={selectedIds.size} entityName="quote" statuses={QUOTE_STATUSES} users={users} onBatchAction={handleBatchAction} onClearSelection={() => setSelectedIds(new Set())} />
      {loading ? (<p className="text-center py-10 text-sm text-muted-foreground">Loading quotes...</p>) : (
        <Table>
          <TableHeader><TableRow>
            <TableHead className="w-10"><Checkbox checked={allOnPageSelected} onCheckedChange={toggleSelectAll} aria-label="Select all" /></TableHead>
            <TableHead>Quote #</TableHead><TableHead>Date</TableHead><TableHead>Recipient</TableHead><TableHead>Status</TableHead><TableHead>Amount</TableHead><TableHead>Category</TableHead><TableHead>Created</TableHead><TableHead>By</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {quotes.length === 0 ? (<TableRow><TableCell colSpan={9} className="text-center py-10 text-muted-foreground">No quotes found.</TableCell></TableRow>) : (
              quotes.map((q) => (
                <TableRow key={q.id} className={selectedIds.has(q.id) ? "bg-primary/5" : ""}>
                  <TableCell><Checkbox checked={selectedIds.has(q.id)} onCheckedChange={() => toggleSelect(q.id)} aria-label={`Select ${q.quoteNumber ?? q.id}`} /></TableCell>
                  <TableCell><span className="font-mono text-xs">{q.quoteNumber ?? "\u2014"}</span></TableCell>
                  <TableCell className="text-xs">{formatDate(q.date)}</TableCell>
                  <TableCell className="text-sm">{q.recipientName}</TableCell>
                  <TableCell><Badge variant={statusBadgeVariant(q.quoteStatus)}>{QUOTE_STATUSES.find((s) => s.value === q.quoteStatus)?.label ?? q.quoteStatus}</Badge></TableCell>
                  <TableCell className="tabular-nums text-xs">{formatAmount(q.totalAmount)}</TableCell>
                  <TableCell className="text-xs">{q.category}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDate(q.createdAt)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{q.creatorName}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      )}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{total === 0 ? "No quotes" : `${total.toLocaleString()} quote${total === 1 ? "" : "s"}`}</span>
        {totalPages > 1 && (<div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-7" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>Previous</Button>
          <span className="tabular-nums">{page} / {totalPages}</span>
          <Button variant="outline" size="sm" className="h-7" disabled={page >= totalPages || loading} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>)}
      </div>
    </div>
  );
}
