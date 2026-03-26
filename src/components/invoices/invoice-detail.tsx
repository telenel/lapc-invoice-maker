"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
  status: "DRAFT" | "FINAL";
  date: string;
  createdAt: string;
  department: string;
  accountCode: string;
  totalAmount: string | number;
  notes: string | null;
  prismcorePath: string | null;
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
// Helpers
// ---------------------------------------------------------------------------

function formatAmount(amount: string | number): string {
  return `$${Number(amount).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function InvoiceDetailView({ id }: { id: string }) {
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);

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

  if (loading) {
    return <p className="text-muted-foreground text-sm">Loading…</p>;
  }

  if (!invoice) {
    return <p className="text-muted-foreground text-sm">Invoice not found.</p>;
  }

  const isDraft = invoice.status === "DRAFT";
  const isFinal = invoice.status === "FINAL";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{invoice.invoiceNumber}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Created {formatDate(invoice.createdAt)} by {invoice.creator.name}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-end">
          <Badge variant={isFinal ? "default" : "outline"}>
            {isFinal ? "Final" : "Draft"}
          </Badge>

          {isDraft && (
            <Link
              href={`/invoices/${id}/edit`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Edit
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
              <span className="text-muted-foreground">Date</span>
              <span>{formatDate(invoice.date)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Department</span>
              <Badge variant="secondary">{invoice.department}</Badge>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Account Code</span>
              <span>{invoice.accountCode}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total Amount</span>
              <span className="font-bold">{formatAmount(invoice.totalAmount)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">PrismCore</span>
              {invoice.prismcorePath ? (
                <Badge variant="secondary">Attached</Badge>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </div>

            {invoice.notes && (
              <>
                <Separator />
                <div className="text-sm">
                  <p className="text-muted-foreground mb-1">Notes</p>
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
              <span className="text-muted-foreground">Name</span>
              <span className="font-bold">{invoice.staff.name}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Title</span>
              <span>{invoice.staff.title}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Department</span>
              <span>{invoice.staff.department}</span>
            </div>
            {invoice.staff.extension && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Extension</span>
                <span>{invoice.staff.extension}</span>
              </div>
            )}
            {invoice.staff.email && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Email</span>
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
                  <TableCell className="text-center">
                    {Number(item.quantity)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatAmount(item.unitPrice)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatAmount(item.extendedPrice)}
                  </TableCell>
                </TableRow>
              ))}
              {/* Total row */}
              <TableRow>
                <TableCell colSpan={3} className="text-right font-bold">
                  Total
                </TableCell>
                <TableCell className="text-right font-bold">
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
