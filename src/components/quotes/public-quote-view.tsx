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
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { formatAmount, formatDateLong as formatDate } from "@/lib/formatters";
import type { CateringDetails } from "@/domains/quote/types";
import { QUOTE_PAYMENT_METHODS } from "@/domains/quote/payment";

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
  quoteStatus: "DRAFT" | "SENT" | "SUBMITTED_EMAIL" | "SUBMITTED_MANUAL" | "ACCEPTED" | "DECLINED" | "REVISED" | "EXPIRED";
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
  } | null;
  contact: {
    name: string;
    title: string;
    org: string;
    department: string;
    email: string;
    phone: string;
  } | null;
  items: QuoteItem[];
  isCateringEvent: boolean;
  cateringDetails: CateringDetails | null;
  paymentDetailsResolved: boolean;
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

// ── Catering form state (public-facing subset) ────────────────────────────

interface PublicCateringForm {
  contactName: string;
  contactPhone: string;
  location: string;
  headcount: string;
  setupRequired: boolean;
  setupTime: string;
  takedownRequired: boolean;
  takedownTime: string;
  specialInstructions: string;
}

function makeCateringForm(existing: CateringDetails | null): PublicCateringForm {
  return {
    contactName: existing?.contactName ?? "",
    contactPhone: existing?.contactPhone ?? "",
    location: existing?.location ?? "",
    headcount: existing?.headcount != null ? String(existing.headcount) : "",
    setupRequired: existing?.setupRequired ?? false,
    setupTime: existing?.setupTime ?? "",
    takedownRequired: existing?.takedownRequired ?? false,
    takedownTime: existing?.takedownTime ?? "",
    specialInstructions: existing?.specialInstructions ?? "",
  };
}

const labelClass = "text-xs font-semibold uppercase tracking-wider text-muted-foreground";

export function PublicQuoteView({ token }: { token: string }) {
  const [quote, setQuote] = useState<PublicQuote | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [responding, setResponding] = useState(false);
  const [responded, setResponded] = useState(false);
  const [cateringForm, setCateringForm] = useState<PublicCateringForm>(makeCateringForm(null));
  const [paymentMethod, setPaymentMethod] = useState("");
  const [sapAccountNumber, setSapAccountNumber] = useState("");
  const [contactInfo, setContactInfo] = useState<Record<string, { name?: string; phone?: string; email?: string; note?: string }>>({});
  const viewIdRef = useRef<string | null>(null);
  const loadTimeRef = useRef<number>(Date.now());
  const accountNumberRequired = paymentMethod === "ACCOUNT_NUMBER";
  const normalizedSapAccountNumber = sapAccountNumber.trim();
  const paymentDetailsResolved = quote?.paymentDetailsResolved ?? false;

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
        if (quoteData.isCateringEvent) {
          setCateringForm(makeCateringForm(quoteData.cateringDetails));
        }

        // Fetch contact info settings
        try {
          const settingsRes = await fetch("/api/quotes/public/settings");
          if (settingsRes.ok) setContactInfo(await settingsRes.json());
        } catch { /* non-critical */ }

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
      if (response === "ACCEPTED" && accountNumberRequired && !normalizedSapAccountNumber) {
        toast.error("Please enter your SAP account number");
        return;
      }

      // Build catering details from form when approving a catering event
      const cateringDetails =
        quote?.isCateringEvent && response === "ACCEPTED"
          ? {
              eventDate: quote.cateringDetails?.eventDate ?? "",
              startTime: quote.cateringDetails?.startTime ?? "",
              endTime: quote.cateringDetails?.endTime ?? "",
              eventName: quote.cateringDetails?.eventName ?? "",
              contactName: cateringForm.contactName,
              contactPhone: cateringForm.contactPhone,
              contactEmail: quote.cateringDetails?.contactEmail ?? "",
              location: cateringForm.location,
              headcount: cateringForm.headcount ? Number(cateringForm.headcount) : undefined,
              setupRequired: cateringForm.setupRequired,
              setupTime: cateringForm.setupRequired ? cateringForm.setupTime : undefined,
              takedownRequired: cateringForm.takedownRequired,
              takedownTime: cateringForm.takedownRequired ? cateringForm.takedownTime : undefined,
              specialInstructions: cateringForm.specialInstructions || undefined,
            }
          : undefined;

      const res = await fetch(`/api/quotes/public/${token}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          response,
          viewId: viewIdRef.current,
          cateringDetails,
          paymentMethod: response === "ACCEPTED" && paymentMethod ? paymentMethod : undefined,
          accountNumber: response === "ACCEPTED" && accountNumberRequired ? normalizedSapAccountNumber : undefined,
        }),
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
  const alreadyResponded = quote.quoteStatus === "ACCEPTED" || quote.quoteStatus === "DECLINED" || quote.quoteStatus === "REVISED";
  const canRespond = (quote.quoteStatus === "SENT" || quote.quoteStatus === "SUBMITTED_EMAIL" || quote.quoteStatus === "SUBMITTED_MANUAL") && !responded;
  const isCatering = quote.isCateringEvent;
  const cateringRequiredMissing =
    isCatering &&
    (!cateringForm.contactName.trim() ||
      !cateringForm.contactPhone.trim() ||
      !cateringForm.location.trim());

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <span className="font-bold text-lg"><span className="text-red-600">LA</span>Portal</span>
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
          {quote.quoteStatus === "REVISED" && <Badge variant="outline">Revised</Badge>}
        </div>

        {/* Info grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Staff/Contact info */}
          {quote.staff ? (
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
          ) : quote.contact ? (
            <Card>
              <CardHeader>
                <CardTitle>From</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Name</span>
                  <span className="font-medium">{quote.contact.name}</span>
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

        {/* Catering event details */}
        {isCatering && canRespond && (
          <Card className="border-orange-500/20">
            <CardHeader className="bg-orange-500/5">
              <div>
                <CardTitle className="text-orange-500">Event Details Required</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Please fill out before approving
                </p>
              </div>
            </CardHeader>

            <CardContent className="space-y-5">
              {/* Contact Name, Contact Number, Location (required) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="pub-contact-name" className={labelClass}>
                    Contact Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="pub-contact-name"
                    type="text"
                    placeholder="Your full name"
                    value={cateringForm.contactName}
                    onChange={(e) =>
                      setCateringForm((prev) => ({ ...prev, contactName: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pub-contact-number" className={labelClass}>
                    Contact Number <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="pub-contact-number"
                    type="text"
                    placeholder="(555) 123-4567"
                    value={cateringForm.contactPhone}
                    onChange={(e) =>
                      setCateringForm((prev) => ({ ...prev, contactPhone: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pub-location" className={labelClass}>
                    Event Location <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="pub-location"
                    type="text"
                    placeholder="Building, Room, Area"
                    value={cateringForm.location}
                    onChange={(e) =>
                      setCateringForm((prev) => ({ ...prev, location: e.target.value }))
                    }
                  />
                </div>
              </div>

              {/* Headcount (optional) */}
              <div className="w-[180px] space-y-1.5">
                <Label htmlFor="pub-headcount" className={labelClass}>
                  Expected Headcount
                </Label>
                <Input
                  id="pub-headcount"
                  type="number"
                  min={0}
                  placeholder="e.g. 50"
                  value={cateringForm.headcount}
                  onChange={(e) =>
                    setCateringForm((prev) => ({ ...prev, headcount: e.target.value }))
                  }
                />
              </div>

              {/* Setup & Takedown */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Setup */}
                <div className="space-y-3 rounded-lg border border-orange-500/10 p-4">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="pub-setup-needed"
                      checked={cateringForm.setupRequired}
                      onCheckedChange={(checked) =>
                        setCateringForm((prev) => ({
                          ...prev,
                          setupRequired: checked === true,
                        }))
                      }
                    />
                    <Label htmlFor="pub-setup-needed" className="text-sm font-medium">
                      Setup Needed
                    </Label>
                  </div>
                  {cateringForm.setupRequired && (
                    <div className="space-y-1.5 pl-6">
                      <Label htmlFor="pub-setup-time" className={labelClass}>
                        When should we arrive?
                      </Label>
                      <Input
                        id="pub-setup-time"
                        type="time"
                        value={cateringForm.setupTime}
                        onChange={(e) =>
                          setCateringForm((prev) => ({ ...prev, setupTime: e.target.value }))
                        }
                      />
                    </div>
                  )}
                </div>

                {/* Takedown */}
                <div className="space-y-3 rounded-lg border border-orange-500/10 p-4">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="pub-takedown-needed"
                      checked={cateringForm.takedownRequired}
                      onCheckedChange={(checked) =>
                        setCateringForm((prev) => ({
                          ...prev,
                          takedownRequired: checked === true,
                        }))
                      }
                    />
                    <Label htmlFor="pub-takedown-needed" className="text-sm font-medium">
                      Takedown Needed
                    </Label>
                  </div>
                  {cateringForm.takedownRequired && (
                    <div className="space-y-1.5 pl-6">
                      <Label htmlFor="pub-takedown-time" className={labelClass}>
                        When should we return?
                      </Label>
                      <Input
                        id="pub-takedown-time"
                        type="time"
                        value={cateringForm.takedownTime}
                        onChange={(e) =>
                          setCateringForm((prev) => ({ ...prev, takedownTime: e.target.value }))
                        }
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Special instructions */}
              <div className="space-y-1.5">
                <Label htmlFor="pub-special-instructions" className={labelClass}>
                  Anything else we should know?
                </Label>
                <Textarea
                  id="pub-special-instructions"
                  placeholder="Dietary needs, equipment requests, access instructions, etc."
                  value={cateringForm.specialInstructions}
                  onChange={(e) =>
                    setCateringForm((prev) => ({
                      ...prev,
                      specialInstructions: e.target.value,
                    }))
                  }
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Payment details */}
        {canRespond && !paymentDetailsResolved && (
          <Card>
            <CardHeader>
              <CardTitle>Payment Details</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                How would you like to pay for this order? These details help us process your order faster.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className={labelClass}>Payment Method</Label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {QUOTE_PAYMENT_METHODS.map((value) => {
                    const label = value === "ACCOUNT_NUMBER"
                      ? "Account Number"
                      : value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());

                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => {
                          setPaymentMethod(value);
                          if (value !== "ACCOUNT_NUMBER") setSapAccountNumber("");
                        }}
                        className={`rounded-md border px-3 py-2 text-sm transition-colors ${
                          paymentMethod === value
                            ? "border-primary bg-primary/10 font-medium text-primary"
                            : "border-border hover:border-primary/50"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {paymentMethod === "ACCOUNT_NUMBER" && (
                <div className="space-y-1.5">
                  <Label htmlFor="pub-sap-account" className={labelClass}>
                    SAP Account Number
                  </Label>
                  <Input
                    id="pub-sap-account"
                    type="text"
                    placeholder="Enter your SAP account number"
                    value={sapAccountNumber}
                    onChange={(e) => setSapAccountNumber(e.target.value)}
                  />
                </div>
              )}

              {!paymentMethod && (
                <p className="text-xs text-amber-600">
                  If you don&apos;t have payment details right now, you can still approve the quote.
                  We&apos;ll follow up with you to collect this information.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {canRespond && paymentDetailsResolved && (
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">
                Payment details are already on file for this quote. You can approve it without entering new payment information.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Contact information */}
        {canRespond && (() => {
          const key = quote.isCateringEvent ? "quote_contact_catering" : "quote_contact_default";
          const info = contactInfo[key] as { name?: string; phone?: string; email?: string; note?: string } | undefined;
          if (!info) return null;
          return (
            <Card>
              <CardHeader>
                <CardTitle>Questions?</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                {info.name && <p className="font-medium">{info.name}</p>}
                {info.phone && <p className="text-muted-foreground">{info.phone}</p>}
                {info.email && (
                  <p>
                    <a href={`mailto:${info.email}`} className="text-primary underline">{info.email}</a>
                  </p>
                )}
                {info.note && <p className="text-muted-foreground mt-2">{info.note}</p>}
              </CardContent>
            </Card>
          );
        })()}

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
                  disabled={responding || cateringRequiredMissing}
                  className="bg-green-600 text-white hover:bg-green-700 min-w-[140px]"
                  title={cateringRequiredMissing ? "Fill in required event details above" : undefined}
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
                  : quote.quoteStatus === "REVISED"
                  ? "This quote has been revised. A new version has been issued."
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
