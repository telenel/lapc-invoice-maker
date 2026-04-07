"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  FileTextIcon,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RequisitionFilters } from "./requisition-filters";
import { RequisitionStatusBadge } from "./requisition-status-badge";
import { useRequisitions } from "@/domains/textbook-requisition/hooks";
import { requisitionApi } from "@/domains/textbook-requisition/api-client";
import { formatDate } from "@/lib/formatters";
import type { RequisitionFilters as Filters } from "@/domains/textbook-requisition/types";

const PAGE_SIZE = 20;

type SortField = "submittedAt" | "instructorName" | "department" | "course" | "status" | "source";

interface SortableHeaderProps {
  label: string;
  field: SortField;
  currentSort: string | undefined;
  currentOrder: "asc" | "desc" | undefined;
  onSort: (field: SortField) => void;
}

function SortableHeader({ label, field, currentSort, currentOrder, onSort }: SortableHeaderProps) {
  const isActive = currentSort === field;
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 cursor-pointer select-none text-xs font-medium hover:text-foreground transition-colors"
      onClick={() => onSort(field)}
    >
      {label}
      {isActive ? (
        <span className="text-foreground">{currentOrder === "asc" ? " \u2191" : " \u2193"}</span>
      ) : (
        <ArrowUpDown className="size-3 text-muted-foreground" />
      )}
    </button>
  );
}

export function RequisitionTable() {
  const router = useRouter();
  const { data, loading, filters, setFilters } = useRequisitions({
    page: 1,
    pageSize: PAGE_SIZE,
    sortBy: "submittedAt",
    sortOrder: "desc",
  });

  const requisitions = data?.requisitions ?? [];
  const total = data?.total ?? 0;
  const page = filters.page ?? 1;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function handleFilterChange(next: Filters) {
    setFilters(next);
  }

  function handleSort(field: SortField) {
    if (filters.sortBy === field) {
      setFilters({
        ...filters,
        sortOrder: filters.sortOrder === "asc" ? "desc" : "asc",
        page: 1,
      });
    } else {
      setFilters({ ...filters, sortBy: field, sortOrder: "asc", page: 1 });
    }
  }

  function handleExportCsv() {
    const { page: _p, pageSize: _ps, ...exportFilters } = filters; // eslint-disable-line @typescript-eslint/no-unused-vars
    requisitionApi
      .exportCsv(exportFilters)
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `requisitions-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 10_000);
      })
      .catch(() => toast.error("Failed to export CSV"));
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <RequisitionFilters filters={filters} onFilterChange={handleFilterChange} />
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={handleExportCsv}>
            <Download className="size-3.5" data-icon="inline-start" />
            Export CSV
          </Button>
          <Button size="sm" render={<Link href="/textbook-requisitions/new" />}>
            <Plus className="size-3.5" data-icon="inline-start" />
            New Requisition
          </Button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <p className="text-muted-foreground text-sm">Loading...</p>
      ) : requisitions.length === 0 ? (
        <EmptyState
          icon={<FileTextIcon className="size-7" />}
          title="No requisitions found"
          description={
            filters.search || filters.status || filters.term || filters.year
              ? "Try adjusting your filters to find what you're looking for."
              : "Create your first requisition to get started."
          }
          action={
            filters.search || filters.status || filters.term || filters.year
              ? {
                  label: "Clear Filters",
                  onClick: () => setFilters({ page: 1, pageSize: PAGE_SIZE }),
                  variant: "outline" as const,
                }
              : undefined
          }
        />
      ) : (
        <>
          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {requisitions.map((req) => (
              <button
                key={req.id}
                type="button"
                className="w-full rounded-xl border border-border/60 bg-card p-4 text-left shadow-sm transition-colors hover:bg-muted/20"
                onClick={() => router.push(`/textbook-requisitions/${req.id}`)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">{req.instructorName}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {req.department} &middot; {req.course}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {req.term} {req.reqYear} &middot; {formatDate(req.submittedAt)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <RequisitionStatusBadge status={req.status} />
                    <span className="text-xs text-muted-foreground">
                      {req.books.length} book{req.books.length !== 1 ? "s" : ""}
                    </span>
                    {req.attentionFlags.length > 0 && (
                      <span className="text-xs text-amber-600 dark:text-amber-400">
                        {req.attentionFlags.length} flag{req.attentionFlags.length !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Desktop table */}
          <Table className="hidden md:table">
            <TableHeader>
              <TableRow>
                <TableHead>
                  <SortableHeader
                    label="Submitted"
                    field="submittedAt"
                    currentSort={filters.sortBy}
                    currentOrder={filters.sortOrder}
                    onSort={handleSort}
                  />
                </TableHead>
                <TableHead>
                  <SortableHeader
                    label="Instructor"
                    field="instructorName"
                    currentSort={filters.sortBy}
                    currentOrder={filters.sortOrder}
                    onSort={handleSort}
                  />
                </TableHead>
                <TableHead>
                  <SortableHeader
                    label="Department"
                    field="department"
                    currentSort={filters.sortBy}
                    currentOrder={filters.sortOrder}
                    onSort={handleSort}
                  />
                </TableHead>
                <TableHead>
                  <SortableHeader
                    label="Course"
                    field="course"
                    currentSort={filters.sortBy}
                    currentOrder={filters.sortOrder}
                    onSort={handleSort}
                  />
                </TableHead>
                <TableHead>
                  <SortableHeader
                    label="Status"
                    field="status"
                    currentSort={filters.sortBy}
                    currentOrder={filters.sortOrder}
                    onSort={handleSort}
                  />
                </TableHead>
                <TableHead>
                  <SortableHeader
                    label="Source"
                    field="source"
                    currentSort={filters.sortBy}
                    currentOrder={filters.sortOrder}
                    onSort={handleSort}
                  />
                </TableHead>
                <TableHead className="text-center">Books</TableHead>
                <TableHead className="text-center">Flags</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requisitions.map((req) => (
                <TableRow
                  key={req.id}
                  className="cursor-pointer group"
                  onClick={() => router.push(`/textbook-requisitions/${req.id}`)}
                  role="link"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") router.push(`/textbook-requisitions/${req.id}`);
                  }}
                >
                  <TableCell className="text-[13px]">{formatDate(req.submittedAt)}</TableCell>
                  <TableCell className="text-[13px] font-medium">{req.instructorName}</TableCell>
                  <TableCell className="text-[13px]">{req.department}</TableCell>
                  <TableCell>
                    <p className="text-[13px]">{req.course}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {req.term} {req.reqYear}
                    </p>
                  </TableCell>
                  <TableCell>
                    <RequisitionStatusBadge status={req.status} />
                  </TableCell>
                  <TableCell className="text-[13px] capitalize">
                    {req.source.toLowerCase().replace("_", " ")}
                  </TableCell>
                  <TableCell className="text-center text-[13px]">{req.books.length}</TableCell>
                  <TableCell className="text-center">
                    {req.attentionFlags.length > 0 ? (
                      <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                        {req.attentionFlags.length}
                      </span>
                    ) : (
                      <span className="text-[13px] text-muted-foreground">&mdash;</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/textbook-requisitions/${req.id}`);
                      }}
                      aria-label="View requisition"
                    >
                      <Eye className="size-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Pagination */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Page {page} of {totalPages} ({total} requisition
              {total !== 1 ? "s" : ""})
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setFilters({ ...filters, page: Math.max(1, page - 1) })}
                className="flex-1 sm:flex-none"
              >
                <ChevronLeft className="size-3.5" data-icon="inline-start" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setFilters({ ...filters, page: Math.min(totalPages, page + 1) })}
                className="flex-1 sm:flex-none"
              >
                Next
                <ChevronRight className="size-3.5" data-icon="inline-end" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
