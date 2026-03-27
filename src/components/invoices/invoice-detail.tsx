"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatAmount, formatDateLong as formatDate } from "@/lib/formatters";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface InvoiceItem {
  id: string;
  description: string;
  quantity: string | number;
  unitPrice: string | number;
  extendedPrice: string | number;
  sortOrder: number;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  status: "DRAFT" | "FINAL" | "PENDING_CHARGE";
  category: string;
  date: string;
  createdAt: string;
  department: string;
  accountCode: string;
  accountNumber: string;
  totalAmount: string | number;
  notes: string | null;
  prismcorePath: string | null;
  isRecurring: boolean;
  recurringInterval: string | null;
  recurringEmail: string | null;
  staff: {
    id: string;
    name: string;
    title: string;
    department: string;
    extension: string | null;
    email: string | null;
  };
  creator: {
    id: string;
    name: string;
    username: string;
  };
  items: InvoiceItem[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function InvoiceDetailView({ id }: { id: string }) {
  const router = useRouter();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  useEffect(() => {
    async function fetchInvoice() {
      try {
        const res = await fetch(`/api/invoices/${id}`);
        if (!res.ok) {
          const data = await res.json();
          toast.error(data.error ?? "Failed to load invoice");
          return;
        }
        const data: Invoice = await res.json();
        setInvoice(data);
      } catch {
        toast.error("Failed to load invoice");
      } finally {
        setLoading(false);
      }
    }
    fetchInvoice();
  }, [id]);

  async function handleRegeneratePdf() {
    if (!invoice) return;
    setRegenerating(true);
    try {
      const res = await fetch(`/api/invoices/${id}/finalize`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Failed to regenerate PDF");
      } else {
        toast.success("PDF regenerated successfully");
      }
    } catch {
      toast.error("Failed to regenerate PDF");
    } finally {
      setRegenerating(false);
    }
  }

  async function handleDelete() {
    if (!invoice) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/invoices/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Failed to delete invoice");
      } else {
        toast.success("Invoice deleted");
        router.push("/invoices");
      }
    } catch {
      toast.error("Failed to delete invoice");
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
    }
  }

  function handleDeleteClick() {
    if (!invoice) return;
    if (invoice.status === "DRAFT" || invoice.status === "PENDING_CHARGE") {
      if (window.confirm("Are you sure you want to delete this draft invoice?")) {
        handleDelete();
      }
    } else {
      setDeleteDialogOpen(true);
    }
  }

  if (loading) {
    return <p className="text-muted-foreground text-sm">Loading…</p>;
  }

  if (!invoice) {
    return <p className="text-muted-foreground text-sm">Invoice not found.</p>;
  }

  const isDraft = invoice.status === "DRAFT";
  const isFinal = invoice.status === "FINAL";
  const isPendingCharge = invoice.status === "PENDING_CHARGE";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-balance">
            {!invoice.invoiceNumber
              ? "Pending POS Charge"
              : invoice.invoiceNumber}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Created {formatDate(invoice.createdAt)} by {invoice.creator.name}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-end">
          <Badge
            variant={
              isFinal ? "success" : isPendingCharge ? "info" : "warning"
            }
          >
            {isFinal
              ? "Final"
              : isPendingCharge
                ? "Pending Charge"
                : "Draft"}
          </Badge>
          {invoice.isRecurring && (
            <Badge variant="secondary">
              Recurring{invoice.recurringInterval ? ` · ${invoice.recurringInterval.charAt(0).toUpperCase() + invoice.recurringInterval.slice(1)}` : ""}
            </Badge>
          )}

          {(isDraft || isPendingCharge) && (
            <Link
              href={`/invoices/${id}/edit`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              {isPendingCharge ? "Complete POS Charge" : "Edit"}
            </Link>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(`/api/invoices/${id}/pdf`, "_blank")}
          >
            Download PDF
          </Button>

          {isFinal && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRegeneratePdf}
              disabled={regenerating}
            >
              {regenerating ? "Regenerating…" : "Regenerate PDF"}
            </Button>
          )}

          {(isDraft || isPendingCharge) ? (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeleteClick}
              disabled={deleting}
            >
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          ) : (
            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
              <DialogTrigger
                render={
                  <Button variant="destructive" size="sm" disabled={deleting}>
                    {deleting ? "Deleting…" : "Delete"}
                  </Button>
                }
              />
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Delete Invoice</DialogTitle>
                  <DialogDescription>
                    This will permanently delete the invoice and its generated PDF. This action cannot be undone.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setDeleteDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleDelete}
                    disabled={deleting}
                  >
                    {deleting ? "Deleting…" : "Delete Invoice"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Two-column grid: Invoice Information + Staff Member */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Invoice Information */}
        <Card>
          <CardHeader>
            <CardTitle>Invoice Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-[11px] font-medium text-muted-foreground">Date</span>
              <span>{formatDate(invoice.date)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[11px] font-medium text-muted-foreground">Department</span>
              <Badge variant="secondary">{invoice.department}</Badge>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[11px] font-medium text-muted-foreground">Category</span>
              <Badge variant="outline">
                {invoice.category
                  ? invoice.category.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())
                  : "—"}
              </Badge>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[11px] font-medium text-muted-foreground">Account Number</span>
              <span>{invoice.accountNumber || "—"}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[11px] font-medium text-muted-foreground">Account Code</span>
              <span>{invoice.accountCode || "—"}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[11px] font-medium text-muted-foreground">Total Amount</span>
              <span className="font-bold">{formatAmount(invoice.totalAmount)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[11px] font-medium text-muted-foreground">PrismCore</span>
              {invoice.prismcorePath ? (
                <Badge variant="secondary">Attached</Badge>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </div>
            {invoice.isRecurring && (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-[11px] font-medium text-muted-foreground">Recurring</span>
                  <Badge variant="secondary">
                    {invoice.recurringInterval
                      ? invoice.recurringInterval.charAt(0).toUpperCase() + invoice.recurringInterval.slice(1)
                      : "Yes"}
                  </Badge>
                </div>
                {invoice.recurringEmail && (
                  <div className="flex justify-between text-sm">
                    <span className="text-[11px] font-medium text-muted-foreground">Recurring Email</span>
                    <span>{invoice.recurringEmail}</span>
                  </div>
                )}
              </>
            )}

            {invoice.notes && (
              <>
                <Separator />
                <div className="text-sm">
                  <p className="text-[11px] font-medium text-muted-foreground mb-1">Notes</p>
                  <p className="whitespace-pre-wrap">{invoice.notes}</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Staff Member */}
        <Card>
          <CardHeader>
            <CardTitle>Staff Member</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-[11px] font-medium text-muted-foreground">Name</span>
              <span className="font-bold">{invoice.staff.name}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[11px] font-medium text-muted-foreground">Title</span>
              <span>{invoice.staff.title}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[11px] font-medium text-muted-foreground">Department</span>
              <span>{invoice.staff.department}</span>
            </div>
            {invoice.staff.extension && (
              <div className="flex justify-between text-sm">
                <span className="text-[11px] font-medium text-muted-foreground">Extension</span>
                <span>{invoice.staff.extension}</span>
              </div>
            )}
            {invoice.staff.email && (
              <div className="flex justify-between text-sm">
                <span className="text-[11px] font-medium text-muted-foreground">Email</span>
                <span>{invoice.staff.email}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Line Items */}
      <Card>
        <CardHeader>
          <CardTitle>Line Items</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Description</TableHead>
                <TableHead className="text-center">Qty</TableHead>
                <TableHead className="text-right">Unit Price</TableHead>
                <TableHead className="text-right">Extended</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoice.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.description}</TableCell>
                  <TableCell className="text-center tabular-nums">
                    {Number(item.quantity)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatAmount(item.unitPrice)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatAmount(item.extendedPrice)}
                  </TableCell>
                </TableRow>
              ))}
              {/* Total row */}
              <TableRow>
                <TableCell colSpan={3} className="text-right font-bold">
                  Total
                </TableCell>
                <TableCell className="text-right font-bold tabular-nums">
                  {formatAmount(invoice.totalAmount)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
