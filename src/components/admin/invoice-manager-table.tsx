"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
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
import type { Invoice, InvoiceStatus } from "./hooks/use-invoice-manager";
import type { EditingCell, EditableField, InlineEditState } from "./hooks/use-inline-edit";
import { getFieldValue } from "./hooks/use-inline-edit";

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

interface EditableCellProps {
  invoice: Invoice;
  field: EditableField;
  display: React.ReactNode;
  className?: string;
  editingCell: EditingCell;
  editValue: string;
  inputRef: React.RefObject<HTMLInputElement>;
  onSetEditValue: (value: string) => void;
  onStartEdit: (rowId: string, field: EditableField, currentValue: string) => void;
  onCommitEdit: () => Promise<void>;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

function EditableCell({
  invoice,
  field,
  display,
  className,
  editingCell,
  editValue,
  inputRef,
  onSetEditValue,
  onStartEdit,
  onCommitEdit,
  onKeyDown,
}: EditableCellProps) {
  const isEditing =
    editingCell?.rowId === invoice.id && editingCell?.field === field;

  if (isEditing) {
    return (
      <TableCell className={className}>
        <Input
          ref={inputRef}
          className="h-7 min-w-[80px] max-w-[200px] px-2 py-0 text-sm"
          value={editValue}
          onChange={(e) => onSetEditValue(e.target.value)}
          onBlur={onCommitEdit}
          onKeyDown={onKeyDown}
        />
      </TableCell>
    );
  }

  return (
    <TableCell
      className={`cursor-pointer hover:bg-muted/70 group ${className ?? ""}`}
      onClick={() => onStartEdit(invoice.id, field, getFieldValue(invoice, field))}
      title="Click to edit"
    >
      <span className="group-hover:underline decoration-dashed underline-offset-2">
        {display}
      </span>
    </TableCell>
  );
}

interface InvoiceManagerTableProps {
  invoices: Invoice[];
  loading: boolean;
  total: number;
  page: number;
  totalPages: number;
  edit: InlineEditState;
  onPageChange: (page: number | ((p: number) => number)) => void;
}

export function InvoiceManagerTable({
  invoices,
  loading,
  total,
  page,
  totalPages,
  edit,
  onPageChange,
}: InvoiceManagerTableProps) {
  const editableCellProps = {
    editingCell: edit.editingCell,
    editValue: edit.editValue,
    inputRef: edit.inputRef,
    onSetEditValue: edit.setEditValue,
    onStartEdit: edit.startEdit,
    onCommitEdit: edit.commitEdit,
    onKeyDown: edit.handleKeyDown,
  };

  return (
    <>
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
                    {...editableCellProps}
                  />
                  <EditableCell
                    invoice={invoice}
                    field="date"
                    display={
                      <span className="text-xs">{formatDate(invoice.date)}</span>
                    }
                    {...editableCellProps}
                  />
                  {/* Staff — read-only */}
                  <TableCell className="text-sm">{invoice.staff.name}</TableCell>
                  <EditableCell
                    invoice={invoice}
                    field="department"
                    display={
                      <span className="text-xs">{invoice.department}</span>
                    }
                    {...editableCellProps}
                  />
                  <EditableCell
                    invoice={invoice}
                    field="category"
                    display={
                      <span className="text-xs">{invoice.category}</span>
                    }
                    {...editableCellProps}
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
                    {...editableCellProps}
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
                    {...editableCellProps}
                  />
                  <EditableCell
                    invoice={invoice}
                    field="totalAmount"
                    display={
                      <span className="tabular-nums text-xs">
                        {formatAmount(invoice.totalAmount)}
                      </span>
                    }
                    {...editableCellProps}
                  />
                  {/* Status — Select dropdown */}
                  <TableCell>
                    <Select
                      value={invoice.status}
                      onValueChange={(v) =>
                        edit.handleStatusChange(invoice.id, v as InvoiceStatus)
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
                    {...editableCellProps}
                  />
                  {/* Created date — read-only */}
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDate(invoice.createdAt)}
                  </TableCell>
                  {/* Creator — read-only */}
                  <TableCell className="text-xs text-muted-foreground">
                    {invoice.creatorName}
                  </TableCell>
                  {/* Delete */}
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                      onClick={() =>
                        edit.handleDelete(invoice.id, invoice.invoiceNumber)
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
              onClick={() => onPageChange((p) => p - 1)}
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
              onClick={() => onPageChange((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
