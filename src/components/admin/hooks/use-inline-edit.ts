"use client";

import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import type { Invoice, InvoiceStatus } from "./use-invoice-manager";

export type EditableField =
  | "invoiceNumber"
  | "date"
  | "department"
  | "category"
  | "accountNumber"
  | "accountCode"
  | "totalAmount"
  | "notes"
  | "status";

export type EditingCell = { rowId: string; field: string } | null;

export function getFieldValue(invoice: Invoice, field: EditableField): string {
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

export interface InlineEditState {
  editingCell: EditingCell;
  editValue: string;
  saving: boolean;
  inputRef: React.RefObject<HTMLInputElement>;
  setEditValue: (value: string) => void;
  startEdit: (rowId: string, field: EditableField, currentValue: string) => void;
  commitEdit: () => Promise<void>;
  cancelEdit: () => void;
  handleKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  handleStatusChange: (rowId: string, newStatus: InvoiceStatus) => Promise<void>;
  handleDelete: (id: string, invoiceNumber: string | null) => Promise<void>;
}

export function useInlineEdit(
  invoices: Invoice[],
  setInvoices: React.Dispatch<React.SetStateAction<Invoice[]>>,
  setTotal: React.Dispatch<React.SetStateAction<number>>
): InlineEditState {
  const [editingCell, setEditingCell] = useState<EditingCell>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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

  function cancelEdit() {
    setEditingCell(null);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      commitEdit();
    } else if (e.key === "Escape") {
      cancelEdit();
    }
  }

  return {
    editingCell,
    editValue,
    saving,
    inputRef,
    setEditValue,
    startEdit,
    commitEdit,
    cancelEdit,
    handleKeyDown,
    handleStatusChange,
    handleDelete,
  };
}
