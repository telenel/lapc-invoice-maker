"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatAmount } from "@/lib/formatters";

interface InvoiceItem {
  id?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  extendedPrice: number;
  sortOrder: number;
}

interface InvoiceStaff {
  id: string;
  name: string;
  title: string;
  department: string;
}

interface Invoice {
  id: string;
  invoiceNumber: string | null;
  status: string;
  totalAmount: string | number;
  department: string;
  staff: InvoiceStaff;
  items: InvoiceItem[];
}

type StatusVariant = "success" | "warning" | "info" | "outline";

function statusVariant(status: string): StatusVariant {
  if (status === "FINAL") return "success";
  if (status === "DRAFT") return "warning";
  if (status === "PENDING_CHARGE") return "info";
  return "outline";
}

function statusLabel(status: string): string {
  if (status === "PENDING_CHARGE") return "Pending Charge";
  return status.charAt(0) + status.slice(1).toLowerCase();
}

export function LineItemManager() {
  const [searchQuery, setSearchQuery] = useState("");
  const [fetching, setFetching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const handleSearch = useCallback(async () => {
    const q = searchQuery.trim();
    if (!q) return;

    setFetching(true);
    setFetchError(null);
    setInvoice(null);
    setItems([]);

    try {
      // First try treating q as an invoice ID directly
      let res = await fetch(`/api/invoices/${encodeURIComponent(q)}`);

      // If that fails, search by invoice number via the list endpoint
      if (!res.ok) {
        const listRes = await fetch(
          `/api/invoices?search=${encodeURIComponent(q)}&pageSize=5`
        );
        if (listRes.ok) {
          const listData = await listRes.json();
          const match = listData.invoices?.find(
            (inv: { invoiceNumber?: string | null }) =>
              inv.invoiceNumber?.toLowerCase() === q.toLowerCase()
          ) ?? listData.invoices?.[0];

          if (!match) {
            setFetchError("No invoice found matching that number or ID.");
            return;
          }

          res = await fetch(`/api/invoices/${match.id}`);
        } else {
          setFetchError("Failed to search invoices.");
          return;
        }
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setFetchError(data.error ?? "Invoice not found.");
        return;
      }

      const data: Invoice = await res.json();
      setInvoice(data);
      setItems(
        data.items.map((item, i) => ({
          ...item,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
          extendedPrice: Number(item.extendedPrice),
          sortOrder: item.sortOrder ?? i,
        }))
      );
    } catch {
      setFetchError("An unexpected error occurred.");
    } finally {
      setFetching(false);
    }
  }, [searchQuery]);

  function updateItem(index: number, field: keyof InvoiceItem, value: string | number) {
    setItems((prev) => {
      const next = [...prev];
      const item = { ...next[index] };

      if (field === "description") {
        item.description = value as string;
      } else if (field === "quantity") {
        item.quantity = Number(value);
        item.extendedPrice = item.quantity * item.unitPrice;
      } else if (field === "unitPrice") {
        item.unitPrice = Number(value);
        item.extendedPrice = item.quantity * item.unitPrice;
      }

      next[index] = item;
      return next;
    });
  }

  function addRow() {
    setItems((prev) => [
      ...prev,
      {
        description: "",
        quantity: 1,
        unitPrice: 0,
        extendedPrice: 0,
        sortOrder: prev.length,
      },
    ]);
  }

  function deleteRow(index: number) {
    setItems((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.map((item, i) => ({ ...item, sortOrder: i }));
    });
  }

  function moveRow(index: number, direction: "up" | "down") {
    setItems((prev) => {
      const next = [...prev];
      const target = direction === "up" ? index - 1 : index + 1;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next.map((item, i) => ({ ...item, sortOrder: i }));
    });
  }

  const currentTotal = items.reduce((sum, item) => sum + item.extendedPrice, 0);

  async function handleSave() {
    if (!invoice) return;

    const invalid = items.some((item) => !item.description.trim());
    if (invalid) {
      toast.error("All line items must have a description.");
      return;
    }
    if (items.length === 0) {
      toast.error("Invoice must have at least one line item.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/invoices/${invoice.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((item, i) => ({
            description: item.description.trim(),
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            extendedPrice: item.extendedPrice,
            sortOrder: i,
          })),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const msg =
          typeof data.error === "string"
            ? data.error
            : "Failed to save line items.";
        toast.error(msg);
        return;
      }

      const updated: Invoice = await res.json();
      setInvoice(updated);
      setItems(
        updated.items.map((item, i) => ({
          ...item,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
          extendedPrice: Number(item.extendedPrice),
          sortOrder: item.sortOrder ?? i,
        }))
      );
      toast.success("Line items saved.");
    } catch {
      toast.error("An unexpected error occurred.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Search bar */}
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Line Item Manager</h2>
        <p className="text-sm text-muted-foreground">
          Search by invoice number or ID to edit its line items.
        </p>
        <div className="flex gap-2 max-w-md">
          <Input
            placeholder="Invoice number or ID…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSearch();
            }}
            disabled={fetching}
          />
          <Button onClick={handleSearch} disabled={fetching || !searchQuery.trim()}>
            {fetching ? "Loading…" : "Fetch"}
          </Button>
        </div>
        {fetchError && (
          <p className="text-sm text-destructive">{fetchError}</p>
        )}
      </div>

      {/* Invoice header */}
      {invoice && (
        <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-mono font-semibold text-base">
                  {invoice.invoiceNumber ?? invoice.id}
                </span>
                <Badge variant={statusVariant(invoice.status)}>
                  {statusLabel(invoice.status)}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {invoice.staff.name} &mdash; {invoice.department}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                Current Total
              </p>
              <p className="font-semibold tabular-nums">
                {formatAmount(Number(invoice.totalAmount))}
              </p>
              {currentTotal !== Number(invoice.totalAmount) && (
                <p className="text-xs text-amber-600 dark:text-amber-400 tabular-nums">
                  Pending: {formatAmount(currentTotal)}
                </p>
              )}
            </div>
          </div>

          {invoice.status === "FINAL" && (
            <p className="text-xs text-destructive font-medium">
              This invoice is finalized — the API will reject edits.
            </p>
          )}
        </div>
      )}

      {/* Line items table */}
      {invoice && (
        <div className="space-y-3">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40%]">Description</TableHead>
                <TableHead className="w-[10%] text-right">Qty</TableHead>
                <TableHead className="w-[15%] text-right">Unit Price</TableHead>
                <TableHead className="w-[15%] text-right">Extended</TableHead>
                <TableHead className="w-[20%] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, i) => (
                <TableRow key={i}>
                  <TableCell className="py-1.5">
                    <Input
                      value={item.description}
                      onChange={(e) => updateItem(i, "description", e.target.value)}
                      placeholder="Description"
                      className="h-7 text-sm"
                    />
                  </TableCell>
                  <TableCell className="py-1.5 text-right">
                    <Input
                      type="number"
                      min="0"
                      step="any"
                      value={item.quantity}
                      onChange={(e) => updateItem(i, "quantity", e.target.value)}
                      className="h-7 text-sm text-right w-20 ml-auto"
                    />
                  </TableCell>
                  <TableCell className="py-1.5 text-right">
                    <Input
                      type="number"
                      min="0"
                      step="any"
                      value={item.unitPrice}
                      onChange={(e) => updateItem(i, "unitPrice", e.target.value)}
                      className="h-7 text-sm text-right w-28 ml-auto"
                    />
                  </TableCell>
                  <TableCell className="py-1.5 text-right tabular-nums text-sm">
                    {formatAmount(item.extendedPrice)}
                  </TableCell>
                  <TableCell className="py-1.5 text-right">
                    <div className="inline-flex gap-1 justify-end">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => moveRow(i, "up")}
                        disabled={i === 0}
                        title="Move up"
                      >
                        ↑
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => moveRow(i, "down")}
                        disabled={i === items.length - 1}
                        title="Move down"
                      >
                        ↓
                      </Button>
                      <Button
                        variant="destructive"
                        size="icon-sm"
                        onClick={() => deleteRow(i)}
                        title="Delete row"
                      >
                        ×
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}

              {items.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center text-muted-foreground py-6 text-sm"
                  >
                    No line items. Add one below.
                  </TableCell>
                </TableRow>
              )}

              {/* Totals row */}
              {items.length > 0 && (
                <TableRow className="border-t-2 font-semibold">
                  <TableCell colSpan={3} className="text-right text-sm py-2">
                    Total
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-sm py-2">
                    {formatAmount(currentTotal)}
                  </TableCell>
                  <TableCell />
                </TableRow>
              )}
            </TableBody>
          </Table>

          {/* Footer actions */}
          <div className="flex items-center justify-between pt-1">
            <Button variant="outline" size="sm" onClick={addRow}>
              + Add Row
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving || items.length === 0}
            >
              {saving ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
