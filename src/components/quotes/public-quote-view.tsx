"use client";

import { useEffect, useState, useRef } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatAmount, formatDateLong as formatDate } from "@/lib/formatters";

interface QuoteItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  extendedPrice: number;
  sortOrder: number;
}

interface PublicQuote {
  id: string;
  quoteNumber: string | null;
  quoteStatus: "DRAFT" | "SENT" | "ACCEPTED" | "DECLINED" | "EXPIRED";
  date: string;
  expirationDate: string | null;
  department: string;
  category: string;
  notes: string;
  totalAmount: number;
  recipientName: string;
  recipientEmail: string;
  recipientOrg: string;
  staff: {
    name: string;
    title: string;
    department: string;
    extension: string | null;
    email: string | null;
  };
  items: QuoteItem[];
}

function expirationText(dateStr: string): string {
  const exp = new Date(dateStr);
  const now = new Date();
  const diffMs = exp.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays > 0) return `Expires in ${diffDays} day${diffDays !== 1 ? "s" : ""}`;
  if (diffDays === 0) return "Expires today";
  return `Expired ${Math.abs(diffDays)} day${Math.abs(diffDays) !== 1 ? "s" : ""} ago`;
}

export function PublicQuoteView({ token }: { token: string }) {
  const [quote, setQuote] = useState<PublicQuote | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [responding, setResponding] = useState(false);
  const [responded, setResponded] = useState(false);
  const viewIdRef = useRef<string | null>(null);
  const loadTimeRef = useRef<number>(Date.now());

  // Fetch quote data and register view
  useEffect(() => {
    async function init() {
      try {
        // Fetch quote data
        const quoteRes = await fetch(`/api/quotes/public/${token}`);
        if (!quoteRes.ok) {
          setNotFound(true);
          return;
        }
        const quoteData: PublicQuote = await quoteRes.json();
        setQuote(quoteData);

        // Register view
        const viewRes = await fetch(`/api/quotes/public/${token}/view`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            viewport: `${window.innerWidth}x${window.innerHeight}`,
          }),
        });
        if (viewRes.ok) {
          const { viewId } = await viewRes.json();
          viewIdRef.current = viewId;
        }
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [token]);

  // Send duration on page unload
  useEffect(() => {
    function handleUnload() {
      if (!viewIdRef.current) return;
      const duration = Math.round((Date.now() - loadTimeRef.current) / 1000);
      const blob = new Blob(
        [JSON.stringify({ durationSeconds: duration })],
        { type: "application/json" }
      );
      navigator.sendBeacon(
        `/api/quotes/public/${token}/view/${viewIdRef.current}`,
        blob
      );
    }
    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, [token]);

  async function handleRespond(response: "ACCEPTED" | "DECLINED") {
    setResponding(true);
    try {
      const res = await fetch(`/api/quotes/public/${token}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response, viewId: viewIdRef.current }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Failed to submit response");
        return;
      }
      const data = await res.json();
      setResponded(true);
      setQuote((prev) => prev ? { ...prev, quoteStatus: data.status } : prev);
      toast.success(response === "ACCEPTED" ? "Quote approved!" : "Quote declined");
    } catch {
      toast.error("Failed to submit response");
    } finally {
      setResponding(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading quote...</p>
      </div>
    );
  }

  if (notFound || !quote) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <h2 className="text-lg font-semibold mb-2">Quote Not Found</h2>
            <p className="text-muted-foreground">
              This quote may have expired or the link is invalid.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isExpired = quote.quoteStatus === "EXPIRED";
  const alreadyResponded = quote.quoteStatus === "ACCEPTED" || quote.quoteStatus === "DECLINED";
  const canRespond = quote.quoteStatus === "SENT" && !responded;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-red-600 to-red-800">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/lapc-logo.png" alt="LAPC" width={22} style={{ height: "22px" }} />
          </div>
          <div>
            <h1 className="font-bold text-lg">Los Angeles Pierce College</h1>
            <p className="text-sm text-muted-foreground">Quote Review</p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Quote header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">{quote.quoteNumber ?? "Quote"}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Date: {formatDate(quote.date)}
            </p>
            {quote.expirationDate && (
              <p className="text-sm text-muted-foreground mt-0.5">
                {expirationText(quote.expirationDate)}
              </p>
            )}
          </div>
          {isExpired && <Badge variant="outline">Expired</Badge>}
          {quote.quoteStatus === "ACCEPTED" && <Badge variant="default">Approved</Badge>}
          {quote.quoteStatus === "DECLINED" && <Badge variant="destructive">Declined</Badge>}
        </div>

        {/* Info grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Staff info */}
          <Card>
            <CardHeader>
              <CardTitle>From</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Name</span>
                <span className="font-medium">{quote.staff.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Title</span>
                <span>{quote.staff.title}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Department</span>
                <span>{quote.staff.department}</span>
              </div>
              {quote.staff.email && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Email</span>
                  <span>{quote.staff.email}</span>
                </div>
              )}
              {quote.staff.extension && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Extension</span>
                  <span>{quote.staff.extension}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recipient info */}
          {(quote.recipientName || quote.recipientOrg) && (
            <Card>
              <CardHeader>
                <CardTitle>To</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {quote.recipientName && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Name</span>
                    <span className="font-medium">{quote.recipientName}</span>
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

        {/* Notes */}
        {quote.notes && (
          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{quote.notes}</p>
            </CardContent>
          </Card>
        )}

        {/* Line items */}
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
                    <TableCell className="text-center tabular-nums">{item.quantity}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatAmount(item.unitPrice)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatAmount(item.extendedPrice)}</TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell colSpan={3} className="text-right font-bold">Total</TableCell>
                  <TableCell className="text-right font-bold tabular-nums">{formatAmount(quote.totalAmount)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Response section */}
        {canRespond && (
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-sm text-muted-foreground mb-4">
                Would you like to approve or decline this quote?
              </p>
              <div className="flex justify-center gap-4">
                <Button
                  size="lg"
                  onClick={() => handleRespond("ACCEPTED")}
                  disabled={responding}
                  className="bg-green-600 text-white hover:bg-green-700 min-w-[140px]"
                >
                  {responding ? "Submitting..." : "Approve Quote"}
                </Button>
                <Button
                  size="lg"
                  variant="destructive"
                  onClick={() => handleRespond("DECLINED")}
                  disabled={responding}
                  className="min-w-[140px]"
                >
                  {responding ? "Submitting..." : "Decline Quote"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {alreadyResponded && (
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-sm text-muted-foreground">
                {quote.quoteStatus === "ACCEPTED"
                  ? "This quote has been approved."
                  : "This quote has been declined."}
              </p>
            </CardContent>
          </Card>
        )}

        {isExpired && (
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-sm text-muted-foreground">
                This quote has expired and can no longer be responded to.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
