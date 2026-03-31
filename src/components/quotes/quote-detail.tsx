"use client";

import { useCallback, useEffect, useState } from "react";
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
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LinkIcon, MoreHorizontalIcon, PrinterIcon } from "lucide-react";
import { formatAmount, formatDateLong as formatDate } from "@/lib/formatters";
import { useSSE } from "@/lib/use-sse";
import { ShareLinkDialog } from "@/components/quotes/share-link-dialog";
import { QuoteActivity } from "@/components/quotes/quote-activity";
import type { CateringDetails } from "@/domains/quote/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface QuoteItem {
  id: string;
  description: string;
  quantity: string | number;
  unitPrice: string | number;
  extendedPrice: string | number;
  isTaxable: boolean;
  sortOrder: number;
  costPrice: string | number | null;
  marginOverride: number | null;
}

interface Quote {
  id: string;
  quoteNumber: string | null;
  quoteStatus: "DRAFT" | "SENT" | "SUBMITTED_EMAIL" | "SUBMITTED_MANUAL" | "ACCEPTED" | "DECLINED" | "REVISED" | "EXPIRED";
  category: string;
  date: string;
  createdAt: string;
  department: string;
  accountCode: string;
  accountNumber: string;
  totalAmount: string | number;
  notes: string | null;
  expirationDate: string | null;
  recipientName: string | null;
  recipientEmail: string | null;
  recipientOrg: string | null;
  shareToken: string | null;
  staff: {
    id: string;
    name: string;
    title: string;
    department: string;
    extension: string | null;
    email: string | null;
  } | null;
  contact: {
    id: string;
    name: string;
    title: string;
    org: string;
    department: string;
    email: string;
    phone: string;
  } | null;
  creatorName: string;
  items: QuoteItem[];
  isCateringEvent: boolean;
  cateringDetails: unknown;
  marginEnabled: boolean;
  marginPercent: number | null;
  taxEnabled: boolean;
  taxRate: number;
  paymentMethod: string | null;
  paymentAccountNumber: string | null;
  paymentDetailsResolved: boolean;
  convertedToInvoice: {
    id: string;
    invoiceNumber: string | null;
  } | null;
  revisedFromQuote?: { id: string; quoteNumber: string | null } | null;
  revisedToQuote?: { id: string; quoteNumber: string | null } | null;
}

type QuoteStatus = Quote["quoteStatus"];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function expirationText(dateStr: string): string {
  const exp = new Date(dateStr);
  const now = new Date();
  const diffMs = exp.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays > 0) return `Expires in ${diffDays} day${diffDays !== 1 ? "s" : ""}`;
  if (diffDays === 0) return "Expires today";
  return `Expired ${Math.abs(diffDays)} day${Math.abs(diffDays) !== 1 ? "s" : ""} ago`;
}

const statusBadgeVariant: Record<
  QuoteStatus,
  "outline" | "secondary" | "default" | "destructive"
> = {
  DRAFT: "outline",
  SENT: "secondary",
  SUBMITTED_EMAIL: "secondary",
  SUBMITTED_MANUAL: "secondary",
  ACCEPTED: "default",
  DECLINED: "destructive",
  REVISED: "outline",
  EXPIRED: "outline",
};

const statusLabel: Record<QuoteStatus, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  SUBMITTED_EMAIL: "Sent (Email)",
  SUBMITTED_MANUAL: "Sent (Manual)",
  ACCEPTED: "Accepted",
  DECLINED: "Declined",
  REVISED: "Revised",
  EXPIRED: "Expired",
};

function formatCateringDateTime(catering: CateringDetails): string | null {
  if (!catering.eventDate) return null;

  const date = new Date(catering.eventDate + "T00:00:00");
  const dateStr = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  if (!catering.startTime || !catering.endTime) return dateStr;

  function formatTime(t: string): string {
    const [h, m] = t.split(":");
    const hour = Number(h);
    const ampm = hour >= 12 ? "PM" : "AM";
    const display = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${display}:${m} ${ampm}`;
  }

  return `${dateStr}, ${formatTime(catering.startTime)} \u2013 ${formatTime(catering.endTime)}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function QuoteDetailView({ id }: { id: string }) {
  const router = useRouter();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionState, setActionState] = useState({
    deleting: false,
    declining: false,
    sending: false,
    converting: false,
    revising: false,
    markingSubmitted: false,
    duplicating: false,
    approving: false,
  });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [declineDialogOpen, setDeclineDialogOpen] = useState(false);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  const fetchQuote = useCallback(async () => {
    try {
      const res = await fetch(`/api/quotes/${id}`);
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Failed to load quote");
        return;
      }
      const data: Quote = await res.json();
      setQuote(data);
    } catch {
      toast.error("Failed to load quote");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchQuote();
  }, [fetchQuote]);

  useSSE("quote-changed", fetchQuote);
  const pdfUrl = `/api/quotes/${id}/pdf`;

  const handleDelete = useCallback(async () => {
    if (!quote) return;
    setActionState((prev) => ({ ...prev, deleting: true }));
    try {
      const res = await fetch(`/api/quotes/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Failed to delete quote");
      } else {
        toast.success("Quote deleted");
        router.push("/quotes");
      }
    } catch {
      toast.error("Failed to delete quote");
    } finally {
      setActionState((prev) => ({ ...prev, deleting: false }));
      setDeleteDialogOpen(false);
    }
  }, [quote, id, router]);

  const handleMarkAsSent = useCallback(async () => {
    if (!quote) return;
    setActionState((prev) => ({ ...prev, sending: true }));
    try {
      const res = await fetch(`/api/quotes/${id}/send`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Failed to mark quote as sent");
      } else {
        const data = await res.json();
        toast.success("Quote marked as sent");
        setShareUrl(data.shareUrl);
        setShareDialogOpen(true);
        // Refresh quote data
        const refreshRes = await fetch(`/api/quotes/${id}`);
        if (refreshRes.ok) {
          const refreshData: Quote = await refreshRes.json();
          setQuote(refreshData);
        }
      }
    } catch {
      toast.error("Failed to mark quote as sent");
    } finally {
      setActionState((prev) => ({ ...prev, sending: false }));
    }
  }, [quote, id]);

  const handleShareLink = useCallback(() => {
    if (!quote) return;
    if (quote.shareToken) {
      setShareUrl(`${window.location.origin}/quotes/review/${quote.shareToken}`);
      setShareDialogOpen(true);
    }
  }, [quote]);

  const handleConvertToInvoice = useCallback(async () => {
    if (!quote) return;
    setActionState((prev) => ({ ...prev, converting: true }));
    try {
      const res = await fetch(`/api/quotes/${id}/convert`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Failed to convert quote to invoice");
      } else {
        const data = await res.json();
        toast.success("Quote converted to invoice");
        router.push(data.redirectTo);
      }
    } catch {
      toast.error("Failed to convert quote to invoice");
    } finally {
      setActionState((prev) => ({ ...prev, converting: false }));
    }
  }, [quote, id, router]);

  const handleDecline = useCallback(async () => {
    if (!quote) return;
    setActionState((prev) => ({ ...prev, declining: true }));
    try {
      const res = await fetch(`/api/quotes/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quoteStatus: "DECLINED" }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Failed to decline quote");
      } else {
        toast.success("Quote declined");
        const refreshRes = await fetch(`/api/quotes/${id}`);
        if (refreshRes.ok) {
          const data: Quote = await refreshRes.json();
          setQuote(data);
        }
      }
    } catch {
      toast.error("Failed to decline quote");
    } finally {
      setActionState((prev) => ({ ...prev, declining: false }));
      setDeclineDialogOpen(false);
    }
  }, [quote, id]);

  const handleRevise = useCallback(async () => {
    if (!quote) return;
    setActionState((prev) => ({ ...prev, revising: true }));
    try {
      const res = await fetch(`/api/quotes/${id}/revise`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Failed to create revision");
        return;
      }
      const data = await res.json();
      toast.success("Revision created — redirecting to edit page");
      router.push(data.redirectTo);
    } catch {
      toast.error("Failed to create revision");
    } finally {
      setActionState((prev) => ({ ...prev, revising: false }));
    }
  }, [quote, id, router]);

  const handleMarkSubmitted = useCallback(async (method: "email" | "manual") => {
    setActionState((prev) => ({ ...prev, markingSubmitted: true }));
    try {
      const res = await fetch(`/api/quotes/${id}/mark-submitted`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Failed to update status");
        return;
      }
      toast.success(method === "email" ? "Marked as sent via email" : "Marked as sent manually");
      fetchQuote();
    } catch {
      toast.error("Failed to update status");
    } finally {
      setActionState((prev) => ({ ...prev, markingSubmitted: false }));
    }
  }, [id, fetchQuote]);

  const handleDuplicate = useCallback(async () => {
    setActionState((prev) => ({ ...prev, duplicating: true }));
    try {
      const res = await fetch(`/api/quotes/${id}/duplicate`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Failed to duplicate");
        return;
      }
      const data = await res.json();
      toast.success(`Draft created from ${quote?.quoteNumber ?? "quote"}`);
      router.push(data.redirectTo);
    } catch {
      toast.error("Failed to duplicate");
    } finally {
      setActionState((prev) => ({ ...prev, duplicating: false }));
    }
  }, [id, quote, router]);

  const handleApproveManually = useCallback(async () => {
    if (!quote) return;
    setActionState((prev) => ({ ...prev, approving: true }));
    try {
      const res = await fetch(`/api/quotes/${id}/approve`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Failed to approve quote");
      } else {
        toast.success("Quote approved manually");
        fetchQuote();
      }
    } catch {
      toast.error("Failed to approve quote");
    } finally {
      setActionState((prev) => ({ ...prev, approving: false }));
      setApproveDialogOpen(false);
    }
  }, [quote, id, fetchQuote]);

  const handleOpenPdf = useCallback(() => {
    const link = document.createElement("a");
    link.href = pdfUrl;
    link.target = "_blank";
    link.rel = "noreferrer";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }, [pdfUrl]);

  if (loading) {
    return <p className="text-muted-foreground text-sm">Loading...</p>;
  }

  if (!quote) {
    return <p className="text-muted-foreground text-sm">Quote not found.</p>;
  }

  const status = quote.quoteStatus;
  const canEdit =
    status === "DRAFT" ||
    status === "SENT" ||
    status === "SUBMITTED_EMAIL" ||
    status === "SUBMITTED_MANUAL" ||
    (status === "ACCEPTED" && !quote.convertedToInvoice);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-balance">
            {quote.quoteNumber ?? "Untitled Quote"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Created {formatDate(quote.createdAt)} by {quote.creatorName}
          </p>
          {quote.expirationDate && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {expirationText(quote.expirationDate)}
            </p>
          )}
          {quote.revisedFromQuote && (
            <Link href={`/quotes/${quote.revisedFromQuote.id}`} className="text-xs text-muted-foreground hover:text-foreground">
              Revised from {quote.revisedFromQuote.quoteNumber}
            </Link>
          )}
          {quote.revisedToQuote && (
            <Link href={`/quotes/${quote.revisedToQuote.id}`} className="text-xs text-blue-600 hover:underline">
              → Revised as {quote.revisedToQuote.quoteNumber}
            </Link>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:justify-end" data-print-hide>
          <Badge variant={statusBadgeVariant[status]}>
            {statusLabel[status]}
          </Badge>

          <Button variant="outline" size="sm" onClick={handleOpenPdf}>
            <PrinterIcon className="size-3.5 mr-1.5" />
            Download / Regenerate PDF
          </Button>

          {/* ── Primary actions ─────────────────────────────────────── */}

          {/* DRAFT: Mark as Sent + Edit */}
          {status === "DRAFT" && (
            <>
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={handleMarkAsSent}
                disabled={actionState.sending}
              >
                {actionState.sending ? "Sending..." : "Mark as Sent"}
              </Button>
              <Link
                href={`/quotes/${id}/edit`}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Edit
              </Link>
            </>
          )}

          {status === "ACCEPTED" && !quote.convertedToInvoice && (
            <>
              <Link
                href={`/quotes/${id}/edit`}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Edit
              </Link>
              <Button
                size="sm"
                onClick={handleConvertToInvoice}
                disabled={actionState.converting}
              >
                {actionState.converting ? "Converting..." : "Convert to Invoice"}
              </Button>
            </>
          )}

          {/* SENT / SUBMITTED: Approve Manually + Convert to Invoice */}
          {(status === "SENT" || status === "SUBMITTED_EMAIL" || status === "SUBMITTED_MANUAL") && (
            <>
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={() => setApproveDialogOpen(true)}
                disabled={actionState.approving}
              >
                {actionState.approving ? "Approving..." : "Approve Manually"}
              </Button>
              <Button
                size="sm"
                onClick={handleConvertToInvoice}
                disabled={actionState.converting}
              >
                {actionState.converting ? "Converting..." : "Convert to Invoice"}
              </Button>
            </>
          )}

          {/* ACCEPTED: link to converted invoice */}
          {status === "ACCEPTED" && quote.convertedToInvoice && (
            <Link
              href={`/invoices/${quote.convertedToInvoice.id}`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              View Invoice {quote.convertedToInvoice.invoiceNumber ?? ""}
            </Link>
          )}

          {/* DECLINED: Revise & Resubmit */}
          {status === "DECLINED" && (
            <Button
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white"
              onClick={handleRevise}
              disabled={actionState.revising}
            >
              {actionState.revising ? "Creating revision..." : "Revise & Resubmit"}
            </Button>
          )}

          {/* ── Secondary actions ──────────────────────────────────── */}

          {/* Share Link: visible for SENT/SUBMITTED statuses */}
          {(status === "SENT" || status === "SUBMITTED_EMAIL" || status === "SUBMITTED_MANUAL") && quote.shareToken && (
            <Button variant="outline" size="sm" onClick={handleShareLink}>
              <LinkIcon className="size-3.5 mr-1.5" />
              Share Link
            </Button>
          )}

          {/* ── More dropdown ──────────────────────────────────────── */}

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="outline" size="sm">
                  <MoreHorizontalIcon className="size-4 mr-1.5" />
                  More
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              {/* Edit (when not shown as primary) */}
              {(canEdit && status !== "DRAFT" && !(status === "ACCEPTED" && !quote.convertedToInvoice)) && (
                <DropdownMenuItem onClick={() => router.push(`/quotes/${id}/edit`)}>
                  Edit
                </DropdownMenuItem>
              )}

              {/* Download PDF: all statuses */}
              <DropdownMenuItem onClick={handleOpenPdf}>
                Download PDF
              </DropdownMenuItem>

              {/* Duplicate: all statuses */}
              <DropdownMenuItem onClick={handleDuplicate} disabled={actionState.duplicating}>
                {actionState.duplicating ? "Duplicating..." : "Duplicate"}
              </DropdownMenuItem>

              {/* Share Link: in dropdown for ACCEPTED, DECLINED, REVISED, EXPIRED */}
              {status !== "DRAFT" && status !== "SENT" && status !== "SUBMITTED_EMAIL" && status !== "SUBMITTED_MANUAL" && quote.shareToken && (
                <DropdownMenuItem onClick={handleShareLink}>
                  Share Link
                </DropdownMenuItem>
              )}

              {/* Mark as Delivered: SENT only */}
              {status === "SENT" && (
                <DropdownMenuItem onClick={() => handleMarkSubmitted("manual")} disabled={actionState.markingSubmitted}>
                  {actionState.markingSubmitted ? "Updating..." : "Mark as Delivered"}
                </DropdownMenuItem>
              )}

              {/* Destructive actions separator */}
              {(status === "SENT" || status === "SUBMITTED_EMAIL" || status === "SUBMITTED_MANUAL" ||
                status === "DRAFT" || status === "DECLINED" || status === "EXPIRED") && (
                <DropdownMenuSeparator />
              )}

              {/* Decline: SENT, SUBMITTED_EMAIL, SUBMITTED_MANUAL */}
              {(status === "SENT" || status === "SUBMITTED_EMAIL" || status === "SUBMITTED_MANUAL") && (
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => setDeclineDialogOpen(true)}
                >
                  Decline
                </DropdownMenuItem>
              )}

              {/* Delete: DRAFT, SENT, DECLINED, EXPIRED */}
              {(status === "DRAFT" || status === "SENT" || status === "DECLINED" || status === "EXPIRED") && (
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => setDeleteDialogOpen(true)}
                >
                  Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* ── Confirmation dialogs (rendered outside dropdown tree) ── */}

        {/* Approve manually dialog */}
        <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Approve Quote Manually</DialogTitle>
              <DialogDescription>
                This will mark the quote as approved without client confirmation.
                Use this when the client has approved verbally or by other means
                outside the system.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setApproveDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={handleApproveManually}
                disabled={actionState.approving}
              >
                {actionState.approving ? "Approving..." : "Approve Quote"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Decline dialog */}
        <Dialog open={declineDialogOpen} onOpenChange={setDeclineDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Decline Quote</DialogTitle>
              <DialogDescription>
                Are you sure you want to decline this quote? This will mark it
                as declined.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeclineDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDecline}
                disabled={actionState.declining}
              >
                {actionState.declining ? "Declining..." : "Decline Quote"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Quote</DialogTitle>
              <DialogDescription>
                This will permanently delete the quote. This action cannot be
                undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={actionState.deleting}
              >
                {actionState.deleting ? "Deleting..." : "Delete Quote"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Two-column grid: Quote Information + Staff Member / Recipient */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Quote Information */}
        <Card>
          <CardHeader>
            <CardTitle>Quote Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Date</span>
              <span>{formatDate(quote.date)}</span>
            </div>
            {quote.expirationDate && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Expiration Date</span>
                <span>{formatDate(quote.expirationDate)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Department</span>
              <Badge variant="secondary">{quote.department}</Badge>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Category</span>
              <Badge variant="outline">
                {quote.category
                  ? quote.category.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())
                  : "\u2014"}
              </Badge>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Account Number</span>
              <span>{quote.accountNumber || "\u2014"}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Account Code</span>
              <span>{quote.accountCode || "\u2014"}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total Amount</span>
              <span className="font-bold">{formatAmount(quote.totalAmount)}</span>
            </div>

            {(quote.marginEnabled || quote.taxEnabled) && (
              <div className="flex flex-wrap gap-2 pt-1">
                {quote.marginEnabled && quote.marginPercent != null && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 text-xs font-medium text-blue-600 dark:text-blue-400">
                    Margin: {Number(quote.marginPercent)}%
                  </span>
                )}
                {quote.taxEnabled && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                    Tax: {(Number(quote.taxRate) * 100).toFixed(2)}%
                  </span>
                )}
              </div>
            )}

            {quote.notes && (
              <>
                <Separator />
                <div className="text-sm">
                  <p className="text-muted-foreground mb-1">Notes</p>
                  <p className="whitespace-pre-wrap">{quote.notes}</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          {/* Staff Member */}
          {quote.staff ? (
            <Card>
              <CardHeader>
                <CardTitle>Staff Member</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Name</span>
                  <span className="font-bold">{quote.staff.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Title</span>
                  <span>{quote.staff.title}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Department</span>
                  <span>{quote.staff.department}</span>
                </div>
                {quote.staff.extension && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Extension</span>
                    <span>{quote.staff.extension}</span>
                  </div>
                )}
                {quote.staff.email && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Email</span>
                    <span>{quote.staff.email}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : quote.contact ? (
            <Card>
              <CardHeader>
                <CardTitle>Contact</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Name</span>
                  <span className="font-bold">{quote.contact.name}</span>
                </div>
                {quote.contact.title && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Title</span>
                    <span>{quote.contact.title}</span>
                  </div>
                )}
                {quote.contact.org && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Organization</span>
                    <span>{quote.contact.org}</span>
                  </div>
                )}
                {quote.contact.email && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Email</span>
                    <span>{quote.contact.email}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : null}

          {/* Recipient */}
          {(quote.recipientName || quote.recipientEmail || quote.recipientOrg) && (
            <Card>
              <CardHeader>
                <CardTitle>Recipient</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {quote.recipientName && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Name</span>
                    <span className="font-bold">{quote.recipientName}</span>
                  </div>
                )}
                {quote.recipientEmail && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Email</span>
                    <span>{quote.recipientEmail}</span>
                  </div>
                )}
                {quote.recipientOrg && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Organization</span>
                    <span>{quote.recipientOrg}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Payment status banner */}
      {quote.quoteStatus === "ACCEPTED" && !quote.paymentDetailsResolved && (
        <Card className="border-amber-500/30 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="py-4">
            <div className="flex items-center gap-2">
              <span className="text-amber-600 text-sm font-medium">
                Payment details incomplete
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {quote.quoteStatus === "ACCEPTED" && quote.paymentDetailsResolved && (
        <Card className="border-green-500/30 bg-green-50 dark:bg-green-950/20">
          <CardContent className="py-4">
            <div className="flex items-center gap-2 text-sm">
              {quote.paymentMethod ? (
                <>
                  <span className="text-green-600 font-medium">Payment method:</span>
                  <span>{quote.paymentMethod.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}</span>
                  {quote.paymentAccountNumber && (
                    <span className="text-muted-foreground">• Account: {quote.paymentAccountNumber}</span>
                  )}
                </>
              ) : (
                <span className="text-green-600 font-medium">
                  Payment details are already on file for this quote.
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Line Items */}
      {(() => {
        const colCount = quote.marginEnabled ? 6 : 4;

        // Cost subtotal (before margin)
        const costSubtotal = quote.items.reduce((sum, item) => {
          const cost = item.costPrice != null ? Number(item.costPrice) : Number(item.unitPrice);
          return sum + cost * Number(item.quantity);
        }, 0);

        // Margin amount — mirror the backend percentage-based calculation
        // with per-item marginOverride support
        const globalMargin = Number(quote.marginPercent ?? 0);
        const marginAmt = quote.marginEnabled
          ? quote.items.reduce((sum, item) => {
              const cost = item.costPrice != null ? Number(item.costPrice) : Number(item.unitPrice);
              const qty = Number(item.quantity);
              const effectiveMargin = item.marginOverride != null
                ? Number(item.marginOverride)
                : globalMargin;
              return sum + cost * qty * (effectiveMargin / 100);
            }, 0)
          : 0;

        // Tax
        const taxableTotal = quote.items
          .filter((item) => item.isTaxable !== false)
          .reduce((sum, item) => sum + Number(item.extendedPrice), 0);
        const taxRate = Number(quote.taxRate ?? 0.0975);
        const taxAmt = quote.taxEnabled
          ? Math.round(taxableTotal * taxRate * 100) / 100
          : 0;

        return (
          <Card>
            <CardHeader className="flex flex-row items-center gap-3">
              <CardTitle>Line Items</CardTitle>
              {quote.marginEnabled && (
                <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                  Internal Only
                </span>
              )}
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-center">Qty</TableHead>
                    {quote.marginEnabled ? (
                      <>
                        <TableHead className="text-right">Cost</TableHead>
                        <TableHead className="text-right">Margin</TableHead>
                        <TableHead className="text-right">Charged</TableHead>
                      </>
                    ) : (
                      <TableHead className="text-right">Unit Price</TableHead>
                    )}
                    <TableHead className="text-right">Extended</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quote.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="uppercase">{item.description}</TableCell>
                      <TableCell className="text-center tabular-nums">
                        {Number(item.quantity)}
                      </TableCell>
                      {quote.marginEnabled ? (
                        (() => {
                          const cost = item.costPrice != null ? Number(item.costPrice) : Number(item.unitPrice);
                          const effectiveMargin = item.marginOverride != null
                            ? Number(item.marginOverride)
                            : globalMargin;
                          const marginDollars = cost * Number(item.quantity) * (effectiveMargin / 100);
                          return (
                            <>
                              <TableCell className="text-right tabular-nums">
                                {formatAmount(cost)}
                              </TableCell>
                              <TableCell className="text-right tabular-nums text-amber-700">
                                {effectiveMargin}% ({formatAmount(marginDollars)})
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {formatAmount(item.unitPrice)}
                              </TableCell>
                            </>
                          );
                        })()
                      ) : (
                        <TableCell className="text-right tabular-nums">
                          {formatAmount(item.unitPrice)}
                        </TableCell>
                      )}
                      <TableCell className="text-right tabular-nums">
                        {formatAmount(item.extendedPrice)}
                      </TableCell>
                    </TableRow>
                  ))}

                  {/* Breakdown rows */}
                  {quote.marginEnabled && (
                    <TableRow>
                      <TableCell
                        colSpan={colCount - 1}
                        className="text-right text-sm text-muted-foreground"
                      >
                        Subtotal (Cost)
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground tabular-nums">
                        {formatAmount(costSubtotal)}
                      </TableCell>
                    </TableRow>
                  )}
                  {quote.marginEnabled && (
                    <TableRow>
                      <TableCell
                        colSpan={colCount - 1}
                        className="text-right text-sm text-muted-foreground"
                      >
                        Margin ({Number(quote.marginPercent ?? 0)}%)
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground tabular-nums">
                        +{formatAmount(marginAmt)}
                      </TableCell>
                    </TableRow>
                  )}
                  {quote.taxEnabled && (
                    <TableRow>
                      <TableCell
                        colSpan={colCount - 1}
                        className="text-right text-sm text-muted-foreground"
                      >
                        Tax ({(taxRate * 100).toFixed(2)}%)
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground tabular-nums">
                        +{formatAmount(taxAmt)}
                      </TableCell>
                    </TableRow>
                  )}

                  {/* Total row */}
                  <TableRow>
                    <TableCell colSpan={colCount - 1} className="text-right font-bold">
                      Total
                    </TableCell>
                    <TableCell className="text-right font-bold tabular-nums">
                      {formatAmount(quote.totalAmount)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );
      })()}

      {/* Catering Guide */}
      {quote.isCateringEvent && (() => {
        const catering = quote.cateringDetails as CateringDetails | null;
        if (!catering) return null;

        // Calculate subtotal / tax for the printable guide
        const itemSubtotal = quote.items.reduce(
          (sum, item) => sum + Number(item.extendedPrice),
          0
        );
        const taxRate = quote.taxRate ?? 0;
        const taxableSubtotal = quote.taxEnabled
          ? quote.items.filter((item) => item.isTaxable).reduce((sum, item) => sum + Number(item.extendedPrice), 0)
          : 0;
        const taxAmount = quote.taxEnabled ? Math.round(taxableSubtotal * taxRate * 100) / 100 : 0;
        const grandTotal = itemSubtotal + taxAmount;

        return (
          <div className="catering-guide">
            <Card className="border-orange-500/20 bg-orange-500/5">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-orange-600 dark:text-orange-400">
                  🍽 Catering Guide
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  data-print-hide
                  onClick={() => window.print()}
                >
                  <PrinterIcon className="size-3.5 mr-1.5" />
                  Print Catering Guide
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Quote header */}
                <div className="flex justify-between text-sm">
                  <div>
                    <h3 className="font-semibold text-base">
                      {quote.quoteNumber ?? "Quote"}
                    </h3>
                    <p className="text-muted-foreground">
                      {formatDate(quote.date)} &middot; {quote.staff?.name ?? quote.contact?.name ?? "Unknown"}
                    </p>
                  </div>
                  {quote.recipientName && (
                    <div className="text-right">
                      <p className="font-medium">{quote.recipientName}</p>
                      {quote.recipientOrg && (
                        <p className="text-muted-foreground">{quote.recipientOrg}</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Event name and date/time */}
                <div>
                  <p className="text-lg font-semibold">
                    {(() => {
                      const dateTime = formatCateringDateTime(catering);
                      if (catering.eventName && dateTime) return `${catering.eventName} — ${dateTime}`;
                      if (catering.eventName) return catering.eventName;
                      if (dateTime) return dateTime;
                      return "Catering Event";
                    })()}
                  </p>
                </div>

                {/* Location */}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Location</span>
                  <span className="font-medium">{catering.location}</span>
                </div>

                {/* Contact */}
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Contact</p>
                  <div className="text-sm space-y-0.5 pl-2">
                    <p className="font-medium">{catering.contactName}</p>
                    {catering.contactPhone && <p>{catering.contactPhone}</p>}
                    {catering.contactEmail && <p>{catering.contactEmail}</p>}
                  </div>
                </div>

                {/* Headcount */}
                {catering.headcount != null && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Headcount</span>
                    <span className="font-medium">{catering.headcount} attendees</span>
                  </div>
                )}

                <Separator />

                {/* Line Items table */}
                <div>
                  <h3 className="text-sm font-semibold mb-2">Line Items</h3>
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
                      {quote.items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="uppercase">{item.description}</TableCell>
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
                    </TableBody>
                  </Table>

                  {/* Totals */}
                  <div className="mt-2 space-y-1 text-sm tabular-nums">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span>{formatAmount(itemSubtotal)}</span>
                    </div>
                    {quote.taxEnabled && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Tax ({(taxRate * 100).toFixed(2)}%)
                        </span>
                        <span>{formatAmount(taxAmount)}</span>
                      </div>
                    )}
                    <Separator />
                    <div className="flex justify-between font-bold">
                      <span>Total</span>
                      <span>{formatAmount(grandTotal)}</span>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Setup */}
                {catering.setupRequired && (
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Setup</p>
                    <div className="text-sm space-y-0.5 pl-2">
                      {catering.setupTime && (
                        <p>
                          <span className="text-muted-foreground">Time:</span> {catering.setupTime}
                        </p>
                      )}
                      {catering.setupInstructions && (
                        <p className="whitespace-pre-wrap">{catering.setupInstructions}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Takedown */}
                {catering.takedownRequired && (
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Takedown</p>
                    <div className="text-sm space-y-0.5 pl-2">
                      {catering.takedownTime && (
                        <p>
                          <span className="text-muted-foreground">Time:</span> {catering.takedownTime}
                        </p>
                      )}
                      {catering.takedownInstructions && (
                        <p className="whitespace-pre-wrap">{catering.takedownInstructions}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Special Instructions */}
                {catering.specialInstructions && (
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Special Instructions</p>
                    <p className="text-sm whitespace-pre-wrap pl-2">
                      {catering.specialInstructions}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        );
      })()}

      {/* Activity tracking */}
      {(status === "SENT" || status === "SUBMITTED_EMAIL" || status === "SUBMITTED_MANUAL" || status === "ACCEPTED" || status === "DECLINED") && (
        <QuoteActivity quoteId={id} />
      )}

      {/* Share Link Dialog */}
      {shareUrl && (
        <ShareLinkDialog
          open={shareDialogOpen}
          onOpenChange={setShareDialogOpen}
          shareUrl={shareUrl}
          quoteNumber={quote.quoteNumber}
          recipientEmail={quote.recipientEmail}
          recipientName={quote.recipientName}
          quoteId={id}
        />
      )}
    </div>
  );
}
