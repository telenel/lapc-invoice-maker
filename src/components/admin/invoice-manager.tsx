"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatAmount, formatDate } from "@/lib/formatters";

type InvoiceStatus = "DRAFT" | "FINAL" | "PENDING_CHARGE";

interface Invoice {
  id: string;
  invoiceNumber: string | null;
  date: string;
  department: string;
  category: string;
  totalAmount: string | number;
  status: InvoiceStatus;
  isRecurring: boolean;
  accountNumber?: string | null;
  accountCode?: string | null;
  notes?: string | null;
  createdAt: string;
  staff: { id: string; name: string; title: string; department: string };
  creator: { id: string; name: string; username: string };
}

interface ApiResponse {
  invoices: Invoice[];
  total: number;
  page: number;
  pageSize: number;
}

type EditingCell = { rowId: string; field: string } | null;

const STATUS_OPTIONS: InvoiceStatus[] = ["DRAFT", "FINAL", "PENDING_CHARGE"];

function statusBadgeVariant(status: InvoiceStatus) {
  switch (status) {
    case "FINAL":
      return "success" as const;
    case "DRAFT":
      return "warning" as const;
    case "PENDING_CHARGE":
      return "info" as const;
  }
}

function statusLabel(status: InvoiceStatus) {
  switch (status) {
    case "FINAL":
      return "Final";
    case "DRAFT":
      return "Draft";
    case "PENDING_CHARGE":
      return "Pending Charge";
  }
}

type EditableField =
  | "invoiceNumber"
  | "date"
  | "department"
  | "category"
  | "accountNumber"
  | "accountCode"
  | "totalAmount"
  | "notes"
  | "status";

function getFieldValue(invoice: Invoice, field: EditableField): string {
  switch (field) {
    case "invoiceNumber":
      return invoice.invoiceNumber ?? "";
    case "date":
      return invoice.date.slice(0, 10);
    case "department":
      return invoice.department;
    case "category":
      return invoice.category;
    case "accountNumber":
      return invoice.accountNumber ?? "";
    case "accountCode":
      return invoice.accountCode ?? "";
    case "totalAmount":
      return String(Number(invoice.totalAmount));
    case "notes":
      return invoice.notes ?? "";
    case "status":
      return invoice.status;
  }
}

export function InvoiceManager() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | "ALL">("ALL");
  const [editingCell, setEditingCell] = useState<EditingCell>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const PAGE_SIZE = 20;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });
      if (search.trim()) params.set("search", search.trim());
      if (statusFilter !== "ALL") params.set("status", statusFilter);

      const res = await fetch(`/api/invoices?${params}`);
      if (!res.ok) throw new Error("Failed to fetch invoices");
      const data: ApiResponse = await res.json();
      setInvoices(data.invoices);
      setTotal(data.total);
    } catch {
      toast.error("Failed to load invoices");
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  // Auto-focus the input when editing starts
  useEffect(() => {
    if (editingCell) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editingCell]);

  function startEdit(rowId: string, field: EditableField, currentValue: string) {
    if (saving) return;
    setEditingCell({ rowId, field });
    setEditValue(currentValue);
  }

  async function commitEdit() {
    if (!editingCell || saving) return;
    const { rowId, field } = editingCell;
    const invoice = invoices.find((inv) => inv.id === rowId);
    if (!invoice) {
      setEditingCell(null);
      return;
    }

    const originalValue = getFieldValue(invoice, field as EditableField);
    if (editValue === originalValue) {
      setEditingCell(null);
      return;
    }

    setSaving(true);
    try {
      const body: Record<string, unknown> = {};
      if (field === "totalAmount") {
        const parsed = parseFloat(editValue);
        if (isNaN(parsed)) {
          toast.error("Invalid amount");
          setEditingCell(null);
          setSaving(false);
          return;
        }
        body[field] = parsed;
      } else {
        body[field] = editValue || null;
      }

      const res = await fetch(`/api/invoices/${rowId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Failed to save changes");
      } else {
        const updated: Invoice = await res.json();
        setInvoices((prev) =>
          prev.map((inv) => (inv.id === rowId ? updated : inv))
        );
        toast.success("Saved");
      }
    } catch {
      toast.error("Failed to save changes");
    } finally {
      setSaving(false);
      setEditingCell(null);
    }
  }

  async function handleStatusChange(rowId: string, newStatus: InvoiceStatus) {
    setSaving(true);
    try {
      const res = await fetch(`/api/invoices/${rowId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Failed to update status");
      } else {
        const updated: Invoice = await res.json();
        setInvoices((prev) =>
          prev.map((inv) => (inv.id === rowId ? updated : inv))
        );
        toast.success("Status updated");
      }
    } catch {
      toast.error("Failed to update status");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string, invoiceNumber: string | null) {
    const label = invoiceNumber ? `invoice ${invoiceNumber}` : "this invoice";
    if (!window.confirm(`Delete ${label}? This cannot be undone.`)) return;

    try {
      const res = await fetch(`/api/invoices/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Failed to delete invoice");
      } else {
        setInvoices((prev) => prev.filter((inv) => inv.id !== id));
        setTotal((prev) => prev - 1);
        toast.success("Invoice deleted");
      }
    } catch {
      toast.error("Failed to delete invoice");
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      commitEdit();
    } else if (e.key === "Escape") {
      setEditingCell(null);
    }
  }

  function EditableCell({
    invoice,
    field,
    display,
    className,
  }: {
    invoice: Invoice;
    field: EditableField;
    display: React.ReactNode;
    className?: string;
  }) {
    const isEditing =
      editingCell?.rowId === invoice.id && editingCell?.field === field;

    if (isEditing) {
      return (
        <TableCell className={className}>
          <Input
            ref={inputRef}
            className="h-7 min-w-[80px] max-w-[200px] px-2 py-0 text-sm"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={handleKeyDown}
          />
        </TableCell>
      );
    }

    return (
      <TableCell
        className={`cursor-pointer hover:bg-muted/70 group ${className ?? ""}`}
        onClick={() =>
          startEdit(invoice.id, field, getFieldValue(invoice, field))
        }
        title="Click to edit"
      >
        <span className="group-hover:underline decoration-dashed underline-offset-2">
          {display}
        </span>
      </TableCell>
    );
  }

  // Debounced search — reset to page 1 when search changes
  function handleSearchChange(value: string) {
    setSearch(value);
    setPage(1);
  }

  function handleStatusFilterChange(value: string | null) {
    setStatusFilter((value ?? "ALL") as InvoiceStatus | "ALL");
    setPage(1);
  }

  return (
    <div className="space-y-4">
      {/* Header + filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold">Invoice Manager</h2>
        <div className="flex items-center gap-2">
          <Input
            className="h-8 w-56 text-sm"
            placeholder="Search invoices…"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
          <Select
            value={statusFilter}
            onValueChange={handleStatusFilterChange}
          >
            <SelectTrigger className="h-8 w-40 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All statuses</SelectItem>
              <SelectItem value="DRAFT">Draft</SelectItem>
              <SelectItem value="FINAL">Final</SelectItem>
              <SelectItem value="PENDING_CHARGE">Pending Charge</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <p className="text-center py-10 text-sm text-muted-foreground">
          Loading invoices…
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice #</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Staff</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Account #</TableHead>
              <TableHead>Account Code</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>By</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={13}
                  className="text-center py-10 text-muted-foreground"
                >
                  No invoices found.
                </TableCell>
              </TableRow>
            ) : (
              invoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  <EditableCell
                    invoice={invoice}
                    field="invoiceNumber"
                    display={
                      invoice.invoiceNumber ? (
                        <span className="font-mono text-xs">
                          {invoice.invoiceNumber}
                        </span>
                      ) : (
                        <span className="text-muted-foreground italic text-xs">
                          —
                        </span>
                      )
                    }
                  />
                  <EditableCell
                    invoice={invoice}
                    field="date"
                    display={
                      <span className="text-xs">
                        {formatDate(invoice.date)}
                      </span>
                    }
                  />
                  {/* Staff — read-only */}
                  <TableCell className="text-sm">
                    {invoice.staff.name}
                  </TableCell>
                  <EditableCell
                    invoice={invoice}
                    field="department"
                    display={
                      <span className="text-xs">{invoice.department}</span>
                    }
                  />
                  <EditableCell
                    invoice={invoice}
                    field="category"
                    display={
                      <span className="text-xs">{invoice.category}</span>
                    }
                  />
                  <EditableCell
                    invoice={invoice}
                    field="accountNumber"
                    display={
                      invoice.accountNumber ? (
                        <span className="font-mono text-xs">
                          {invoice.accountNumber}
                        </span>
                      ) : (
                        <span className="text-muted-foreground italic text-xs">
                          —
                        </span>
                      )
                    }
                  />
                  <EditableCell
                    invoice={invoice}
                    field="accountCode"
                    display={
                      invoice.accountCode ? (
                        <span className="font-mono text-xs">
                          {invoice.accountCode}
                        </span>
                      ) : (
                        <span className="text-muted-foreground italic text-xs">
                          —
                        </span>
                      )
                    }
                  />
                  <EditableCell
                    invoice={invoice}
                    field="totalAmount"
                    display={
                      <span className="tabular-nums text-xs">
                        {formatAmount(invoice.totalAmount)}
                      </span>
                    }
                  />
                  {/* Status — Select dropdown */}
                  <TableCell>
                    <Select
                      value={invoice.status}
                      onValueChange={(v) =>
                        handleStatusChange(invoice.id, v as InvoiceStatus)
                      }
                    >
                      <SelectTrigger className="h-7 w-auto border-0 bg-transparent p-0 shadow-none focus-visible:ring-0 text-xs">
                        <Badge variant={statusBadgeVariant(invoice.status)}>
                          {statusLabel(invoice.status)}
                        </Badge>
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((s) => (
                          <SelectItem key={s} value={s}>
                            {statusLabel(s)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <EditableCell
                    invoice={invoice}
                    field="notes"
                    display={
                      invoice.notes ? (
                        <span
                          className="text-xs max-w-[120px] truncate block"
                          title={invoice.notes}
                        >
                          {invoice.notes}
                        </span>
                      ) : (
                        <span className="text-muted-foreground italic text-xs">
                          —
                        </span>
                      )
                    }
                  />
                  {/* Created date — read-only */}
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDate(invoice.createdAt)}
                  </TableCell>
                  {/* Creator — read-only */}
                  <TableCell className="text-xs text-muted-foreground">
                    {invoice.creator.name}
                  </TableCell>
                  {/* Delete */}
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                      onClick={() =>
                        handleDelete(invoice.id, invoice.invoiceNumber)
                      }
                    >
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      )}

      {/* Pagination + count */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {total === 0
            ? "No invoices"
            : `${total.toLocaleString()} invoice${total === 1 ? "" : "s"}`}
        </span>
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-7"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <span className="tabular-nums">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-7"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
