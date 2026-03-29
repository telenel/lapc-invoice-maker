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
import { LinkIcon, PrinterIcon } from "lucide-react";
import { formatAmount, formatDateLong as formatDate } from "@/lib/formatters";
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
}

interface Quote {
  id: string;
  quoteNumber: string | null;
  quoteStatus: "DRAFT" | "SENT" | "ACCEPTED" | "DECLINED" | "EXPIRED";
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
  };
  creatorName: string;
  items: QuoteItem[];
  isCateringEvent: boolean;
  cateringDetails: unknown;
  marginEnabled: boolean;
  marginPercent: number | null;
  taxEnabled: boolean;
  taxRate: number;
  convertedToInvoice: {
    id: string;
    invoiceNumber: string | null;
  } | null;
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
  ACCEPTED: "default",
  DECLINED: "destructive",
  EXPIRED: "outline",
};

const statusLabel: Record<QuoteStatus, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  ACCEPTED: "Accepted",
  DECLINED: "Declined",
  EXPIRED: "Expired",
};

function formatCateringDateTime(catering: CateringDetails): string {
  const date = new Date(catering.eventDate + "T00:00:00");
  const dateStr = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

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
  const [deleting, setDeleting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [declineDialogOpen, setDeclineDialogOpen] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [sending, setSending] = useState(false);
  const [converting, setConverting] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  useEffect(() => {
    async function fetchQuote() {
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
    }
    fetchQuote();
  }, [id]);

  async function handleDelete() {
    if (!quote) return;
    setDeleting(true);
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
      setDeleting(false);
      setDeleteDialogOpen(false);
    }
  }

  async function handleMarkAsSent() {
    if (!quote) return;
    setSending(true);
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
      setSending(false);
    }
  }

  async function handleShareLink() {
    if (!quote) return;
    if (quote.shareToken) {
      setShareUrl(`${window.location.origin}/quotes/review/${quote.shareToken}`);
      setShareDialogOpen(true);
    }
  }

  async function handleConvertToInvoice() {
    if (!quote) return;
    setConverting(true);
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
      setConverting(false);
    }
  }

  async function handleDecline() {
    if (!quote) return;
    setDeclining(true);
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
      setDeclining(false);
      setDeclineDialogOpen(false);
    }
  }

  if (loading) {
    return <p className="text-muted-foreground text-sm">Loading...</p>;
  }

  if (!quote) {
    return <p className="text-muted-foreground text-sm">Quote not found.</p>;
  }

  const status = quote.quoteStatus;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
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
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-end" data-print-hide>
          <Badge variant={statusBadgeVariant[status]}>
            {statusLabel[status]}
          </Badge>

          {/* ACCEPTED: link to converted invoice */}
          {status === "ACCEPTED" && quote.convertedToInvoice && (
            <Link
              href={`/invoices/${quote.convertedToInvoice.id}`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Converted to Invoice {quote.convertedToInvoice.invoiceNumber ?? ""}
            </Link>
          )}

          {/* Edit button: DRAFT and SENT only */}
          {(status === "DRAFT" || status === "SENT") && (
            <Link
              href={`/quotes/${id}/edit`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Edit
            </Link>
          )}

          {/* Download PDF: all statuses */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(`/api/quotes/${id}/pdf`, "_blank")}
          >
            Download PDF
          </Button>

          {/* Share Link: SENT, ACCEPTED, DECLINED (has shareToken) */}
          {status !== "DRAFT" && quote.shareToken && (
            <Button variant="outline" size="sm" onClick={handleShareLink}>
              <LinkIcon className="size-3.5 mr-1.5" />
              Share Link
            </Button>
          )}

          {/* Mark as Sent: DRAFT only */}
          {status === "DRAFT" && (
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={handleMarkAsSent}
              disabled={sending}
            >
              {sending ? "Sending..." : "Mark as Sent"}
            </Button>
          )}

          {/* Convert to Invoice: SENT only */}
          {status === "SENT" && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleConvertToInvoice}
              disabled={converting}
            >
              {converting ? "Converting..." : "Convert to Invoice"}
            </Button>
          )}

          {/* Decline: SENT only, with confirmation dialog */}
          {status === "SENT" && (
            <Dialog open={declineDialogOpen} onOpenChange={setDeclineDialogOpen}>
              <DialogTrigger
                render={
                  <Button variant="destructive" size="sm" disabled={declining}>
                    {declining ? "Declining..." : "Decline"}
                  </Button>
                }
              />
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Decline Quote</DialogTitle>
                  <DialogDescription>
                    Are you sure you want to decline this quote? This will mark it
                    as declined.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setDeclineDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleDecline}
                    disabled={declining}
                  >
                    {declining ? "Declining..." : "Decline Quote"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}

          {/* Delete: DRAFT, SENT, DECLINED, EXPIRED */}
          {(status === "DRAFT" ||
            status === "SENT" ||
            status === "DECLINED" ||
            status === "EXPIRED") && (
            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
              <DialogTrigger
                render={
                  <Button variant="destructive" size="sm" disabled={deleting}>
                    {deleting ? "Deleting..." : "Delete"}
                  </Button>
                }
              />
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Delete Quote</DialogTitle>
                  <DialogDescription>
                    This will permanently delete the quote. This action cannot be
                    undone.
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
                    {deleting ? "Deleting..." : "Delete Quote"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
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
              {quote.items.map((item) => (
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
                  {formatAmount(quote.totalAmount)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

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
        const taxAmount = quote.taxEnabled ? taxableSubtotal * taxRate : 0;
        const grandTotal = Number(quote.totalAmount);

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
                      {formatDate(quote.date)} &middot; {quote.staff.name}
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
                    {catering.eventName
                      ? `${catering.eventName} — ${formatCateringDateTime(catering)}`
                      : formatCateringDateTime(catering)}
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
      {(status === "SENT" || status === "ACCEPTED" || status === "DECLINED") && (
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
        />
      )}
    </div>
  );
}
