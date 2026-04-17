"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
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
import { TimeSelect } from "@/components/ui/time-select";
import {
  PaymentMethodGuidanceCallout,
  PaymentMethodGuidanceDialog,
} from "@/components/quotes/payment-method-guidance";
import { quoteApi } from "@/domains/quote/api-client";
import { getMissingCustomerCateringRequirements, normalizeQuoteTimeInput } from "@/domains/quote/catering";
import {
  coerceQuotePaymentMethod,
  getQuotePaymentMethodGuidance,
  getQuotePaymentMethodLabel,
  QUOTE_PAYMENT_METHODS,
  type QuotePaymentMethod,
} from "@/domains/quote/payment";
import { ApiError } from "@/domains/shared/types";
import { formatAmount, formatDateLong as formatDate } from "@/lib/formatters";
import { differenceInDateKeys, getDateKeyInLosAngeles, getDateOnlyKey } from "@/lib/date-utils";
import { cn } from "@/lib/utils";
import type { CateringDetails, PublicQuoteResponse } from "@/domains/quote/types";

const PUBLIC_QUOTE_TIME_MIN = "07:30";
const PUBLIC_QUOTE_TIME_MAX = "23:00";

function expirationText(dateStr: string): string {
  const expirationDateKey = getDateOnlyKey(dateStr);
  if (!expirationDateKey) return "";

  const diffDays = differenceInDateKeys(getDateKeyInLosAngeles(), expirationDateKey);
  if (diffDays > 0) return `Expires in ${diffDays} day${diffDays !== 1 ? "s" : ""}`;
  if (diffDays === 0) return "Expires today";
  return `Expired ${Math.abs(diffDays)} day${Math.abs(diffDays) !== 1 ? "s" : ""} ago`;
}

// ── Catering form state (public-facing subset) ────────────────────────────

interface PublicCateringForm {
  eventDate: string;
  startTime: string;
  endTime: string;
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
    eventDate: existing?.eventDate ?? "",
    startTime: existing?.startTime ?? "",
    endTime: existing?.endTime ?? "",
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
  const router = useRouter();
  const [quote, setQuote] = useState<PublicQuoteResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [responding, setResponding] = useState(false);
  const [responded, setResponded] = useState(false);
  const [cateringForm, setCateringForm] = useState<PublicCateringForm>(makeCateringForm(null));
  const [paymentMethod, setPaymentMethod] = useState<QuotePaymentMethod | "">("");
  const [sapAccountNumber, setSapAccountNumber] = useState("");
  const [guidanceOpen, setGuidanceOpen] = useState(false);
  const viewIdRef = useRef<string | null>(null);
  const publicViewRegistrationRef = useRef<Promise<string | null> | null>(null);
  const pendingUnloadDurationRef = useRef<number | null>(null);
  const loadTimeRef = useRef<number>(Date.now());
  const accountNumberRequired = paymentMethod === "ACCOUNT_NUMBER";
  const normalizedSapAccountNumber = sapAccountNumber.trim();
  const paymentDetailsResolved = quote?.paymentDetailsResolved ?? false;

  function handlePaymentMethodSelect(nextMethod: QuotePaymentMethod) {
    setPaymentMethod(nextMethod);
    if (nextMethod !== "ACCOUNT_NUMBER") {
      setSapAccountNumber("");
    }
    setGuidanceOpen(Boolean(getQuotePaymentMethodGuidance(nextMethod)));
  }

  // Fetch quote data and register view
  useEffect(() => {
    async function init() {
      try {
        setLoading(true);
        setQuote(null);
        setResponded(false);
        setPaymentMethod("");
        setSapAccountNumber("");
        setGuidanceOpen(false);
        setCateringForm(makeCateringForm(null));
        viewIdRef.current = null;
        publicViewRegistrationRef.current = null;
        pendingUnloadDurationRef.current = null;
        loadTimeRef.current = Date.now();
        setNotFound(false);
        setLoadError(null);
        const quoteData = await quoteApi.getPublicQuote(token);
        setQuote(quoteData);
        setPaymentMethod(coerceQuotePaymentMethod(quoteData.paymentMethod) ?? "");
        if (quoteData.isCateringEvent) {
          setCateringForm(makeCateringForm(quoteData.cateringDetails));
        }
        const registrationPromise = quoteApi
          .registerPublicView(token, `${window.innerWidth}x${window.innerHeight}`)
          .then(({ viewId }) => {
            viewIdRef.current = viewId;
            if (pendingUnloadDurationRef.current != null) {
              quoteApi.recordPublicViewDuration(token, viewId, pendingUnloadDurationRef.current);
              pendingUnloadDurationRef.current = null;
            }
            return viewId;
          })
          .catch((err) => {
            console.warn("Failed to register quote view:", err);
            return null;
          });
        publicViewRegistrationRef.current = registrationPromise;
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          setNotFound(true);
        } else {
          setLoadError("We couldn't load this quote right now. Please try again.");
        }
        return;
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [token]);

  async function getRegisteredViewId(): Promise<string | null> {
    if (viewIdRef.current) return viewIdRef.current;
    return publicViewRegistrationRef.current ? await publicViewRegistrationRef.current : null;
  }

  // Send duration on page unload
  useEffect(() => {
    function handleUnload() {
      const duration = Math.round((Date.now() - loadTimeRef.current) / 1000);
      const viewId = viewIdRef.current;
      if (viewId) {
        quoteApi.recordPublicViewDuration(token, viewId, duration);
        return;
      }
      pendingUnloadDurationRef.current = duration;
    }
    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, [token]);

  async function handleRespond(response: "ACCEPTED" | "DECLINED") {
    if (response === "ACCEPTED" && accountNumberRequired && !normalizedSapAccountNumber) {
      toast.error("Please enter your SAP account number");
      return;
    }

    setResponding(true);
    try {
      const viewId = await getRegisteredViewId();

      // Build catering details from form when approving a catering event
      const normalizedStartTime = normalizeQuoteTimeInput(cateringForm.startTime);
      const normalizedEndTime = normalizeQuoteTimeInput(cateringForm.endTime);
      const normalizedSetupTime = normalizeQuoteTimeInput(cateringForm.setupTime);
      const normalizedTakedownTime = normalizeQuoteTimeInput(cateringForm.takedownTime);
      const cateringDetails =
        quote?.isCateringEvent && response === "ACCEPTED"
          ? {
              eventDate: cateringForm.eventDate.trim(),
              startTime: normalizedStartTime ?? cateringForm.startTime.trim(),
              endTime: normalizedEndTime ?? cateringForm.endTime.trim(),
              contactName: cateringForm.contactName,
              contactPhone: cateringForm.contactPhone,
              location: cateringForm.location,
              headcount: cateringForm.headcount ? Number(cateringForm.headcount) : undefined,
              setupRequired: cateringForm.setupRequired,
              setupTime: cateringForm.setupRequired ? normalizedSetupTime ?? cateringForm.setupTime.trim() : undefined,
              takedownRequired: cateringForm.takedownRequired,
              takedownTime: cateringForm.takedownRequired ? normalizedTakedownTime ?? cateringForm.takedownTime.trim() : undefined,
              specialInstructions: cateringForm.specialInstructions || undefined,
            }
          : undefined;

      const data = await quoteApi.respondToPublicQuote(token, {
        response,
        viewId: viewId ?? undefined,
        cateringDetails,
        paymentMethod: response === "ACCEPTED" && paymentMethod ? paymentMethod : undefined,
        accountNumber: response === "ACCEPTED" && accountNumberRequired ? normalizedSapAccountNumber : undefined,
      });
      setResponded(true);
      setQuote((prev) =>
        prev
          ? {
              ...prev,
              quoteStatus: data.status,
              paymentDetailsResolved:
                response === "ACCEPTED" && Boolean(paymentMethod) ? true : prev.paymentDetailsResolved,
            }
          : prev,
      );
      toast.success(
        response === "ACCEPTED"
          ? selectedPaymentGuidance
            ? "Quote approved — please follow the payment instructions."
            : "Quote approved!"
          : "Quote declined",
      );
    } catch (err) {
      toast.error((err as Error).message ?? "Failed to submit response");
    } finally {
      setResponding(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="border-b border-border bg-background/95">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-5 flex items-center gap-4">
            <div className="skeleton w-12 h-12 rounded-lg shrink-0" />
            <div className="space-y-2">
              <div className="skeleton h-5 w-56" />
              <div className="skeleton h-3 w-24" />
            </div>
          </div>
        </div>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
          <div className="space-y-2">
            <div className="skeleton h-8 w-40" />
            <div className="skeleton h-4 w-32" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[0, 1].map((i) => (
              <div key={i} className="rounded-xl border border-border/40 bg-card p-5 space-y-3">
                <div className="skeleton h-4 w-16" />
                {[0, 1, 2].map((j) => (
                  <div key={j} className="flex justify-between">
                    <div className="skeleton h-3 w-20" />
                    <div className="skeleton h-3 w-28" />
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-border/40 bg-card p-5 space-y-3">
            <div className="skeleton h-4 w-24" />
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex justify-between">
                <div className="skeleton h-3 w-40" />
                <div className="skeleton h-3 w-16" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (notFound || !quote) {
    if (loadError) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <Card className="max-w-md w-full">
            <CardContent className="pt-6 text-center">
              <h2 className="text-lg font-semibold mb-2">Unable to Load Quote</h2>
              <p className="text-muted-foreground">{loadError}</p>
            </CardContent>
          </Card>
        </div>
      );
    }
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
  const paymentLinkAvailable = quote.paymentLinkAvailable !== false;
  const responseLinkAvailable = quote.responseLinkAvailable !== false;
  const canRespond =
    responseLinkAvailable &&
    (quote.quoteStatus === "SENT" || quote.quoteStatus === "SUBMITTED_EMAIL" || quote.quoteStatus === "SUBMITTED_MANUAL") &&
    !responded;
  const publicActionsClosed = !responseLinkAvailable && !alreadyResponded && !isExpired;
  const isCatering = quote.isCateringEvent;
  const missingCateringRequirements = isCatering ? getMissingCustomerCateringRequirements(cateringForm) : [];
  const cateringRequiredMissing = missingCateringRequirements.length > 0;
  const missingCateringRequirementSet = new Set(missingCateringRequirements);
  const hasMissingCateringRequirement = (requirement: string): boolean => missingCateringRequirementSet.has(requirement);
  const selectedPaymentGuidance = getQuotePaymentMethodGuidance(paymentMethod);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-5 flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/lapc-logo.png"
            alt=""
            aria-hidden="true"
            className="h-8 w-auto max-w-[9.5rem] shrink-0 object-contain sm:h-9 sm:max-w-[11rem] md:h-10 md:max-w-[13rem]"
          />
          <div>
            <h1 className="font-bold text-xl tracking-tight">Los Angeles Pierce College Store</h1>
            <p className="text-sm text-muted-foreground">Quote Review</p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Quote header */}
        <div className="flex items-start justify-between gap-4 page-enter page-enter-1">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">{quote.quoteNumber ?? "Quote"}</h2>
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 page-enter page-enter-2">
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
              </TableBody>
            </Table>
          </CardContent>

          {/* Totals summary */}
          <div className="mx-5 mb-5 rounded-xl border border-border bg-muted/30 p-4 tabular-nums">
            <div className="flex justify-between text-xl font-bold">
              <span>Total</span>
              <span>{formatAmount(quote.totalAmount)}</span>
            </div>
          </div>
        </Card>

        {/* Catering event details */}
        {isCatering && canRespond && (
          <Card className="border-primary/20">
            <CardHeader className="bg-primary/5">
              <div>
                <CardTitle className="text-primary">Event Details Required</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Please fill out before approving
                </p>
              </div>
            </CardHeader>

            <CardContent className="space-y-5">
              {cateringRequiredMissing && (
                <div
                  role="alert"
                  className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm"
                >
                  <p className="font-medium text-destructive">
                    Approval is blocked until these required event details are completed.
                  </p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-destructive/90">
                    {missingCateringRequirements.map((requirement) => (
                      <li key={requirement} className="capitalize">
                        {requirement}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Event schedule */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="pub-event-date" className={labelClass}>
                    Event Date <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="pub-event-date"
                    type="date"
                    value={cateringForm.eventDate}
                    aria-invalid={hasMissingCateringRequirement("event date")}
                    className={cn(
                      hasMissingCateringRequirement("event date") && "border-destructive focus-visible:ring-destructive/30",
                    )}
                    onChange={(e) =>
                      setCateringForm((prev) => ({ ...prev, eventDate: e.target.value }))
                    }
                  />
                  {hasMissingCateringRequirement("event date") && (
                    <p className="text-xs text-destructive">Event date is required before approval.</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pub-start-time" className={labelClass}>
                    Start Time <span className="text-red-500">*</span>
                  </Label>
                  <TimeSelect
                    id="pub-start-time"
                    value={cateringForm.startTime}
                    onValueChange={(value) =>
                      setCateringForm((prev) => ({ ...prev, startTime: value }))
                    }
                    placeholder="Select start time"
                    minTime={PUBLIC_QUOTE_TIME_MIN}
                    maxTime={PUBLIC_QUOTE_TIME_MAX}
                    invalid={hasMissingCateringRequirement("start time")}
                    className={cn(
                      hasMissingCateringRequirement("start time") && "border-destructive focus-visible:ring-destructive/30",
                    )}
                  />
                  {hasMissingCateringRequirement("start time") && (
                    <p className="text-xs text-destructive">Start time is required before approval.</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pub-end-time" className={labelClass}>
                    End Time <span className="text-red-500">*</span>
                  </Label>
                  <TimeSelect
                    id="pub-end-time"
                    value={cateringForm.endTime}
                    onValueChange={(value) =>
                      setCateringForm((prev) => ({ ...prev, endTime: value }))
                    }
                    placeholder="Select end time"
                    minTime={PUBLIC_QUOTE_TIME_MIN}
                    maxTime={PUBLIC_QUOTE_TIME_MAX}
                    invalid={hasMissingCateringRequirement("end time")}
                    className={cn(
                      hasMissingCateringRequirement("end time") && "border-destructive focus-visible:ring-destructive/30",
                    )}
                  />
                  {hasMissingCateringRequirement("end time") && (
                    <p className="text-xs text-destructive">End time is required before approval.</p>
                  )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Choose the event times from the dropdowns. Times are shown in standard AM/PM format.
              </p>

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
                    aria-invalid={hasMissingCateringRequirement("contact name")}
                    className={cn(
                      hasMissingCateringRequirement("contact name") && "border-destructive focus-visible:ring-destructive/30",
                    )}
                    onChange={(e) =>
                      setCateringForm((prev) => ({ ...prev, contactName: e.target.value }))
                    }
                  />
                  {hasMissingCateringRequirement("contact name") && (
                    <p className="text-xs text-destructive">Contact name is required before approval.</p>
                  )}
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
                    aria-invalid={hasMissingCateringRequirement("contact number")}
                    className={cn(
                      hasMissingCateringRequirement("contact number") && "border-destructive focus-visible:ring-destructive/30",
                    )}
                    onChange={(e) =>
                      setCateringForm((prev) => ({ ...prev, contactPhone: e.target.value }))
                    }
                  />
                  {hasMissingCateringRequirement("contact number") && (
                    <p className="text-xs text-destructive">Contact number is required before approval.</p>
                  )}
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
                    aria-invalid={hasMissingCateringRequirement("event location")}
                    className={cn(
                      hasMissingCateringRequirement("event location") && "border-destructive focus-visible:ring-destructive/30",
                    )}
                    onChange={(e) =>
                      setCateringForm((prev) => ({ ...prev, location: e.target.value }))
                    }
                  />
                  {hasMissingCateringRequirement("event location") && (
                    <p className="text-xs text-destructive">Event location is required before approval.</p>
                  )}
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
                <div className="space-y-3 rounded-lg border border-primary/10 p-4">
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
                      <TimeSelect
                        id="pub-setup-time"
                        value={cateringForm.setupTime}
                        onValueChange={(value) =>
                          setCateringForm((prev) => ({ ...prev, setupTime: value }))
                        }
                        placeholder="Select setup time"
                        minTime={PUBLIC_QUOTE_TIME_MIN}
                        maxTime={PUBLIC_QUOTE_TIME_MAX}
                        invalid={hasMissingCateringRequirement("setup time")}
                        className={cn(
                          hasMissingCateringRequirement("setup time") && "border-destructive focus-visible:ring-destructive/30",
                        )}
                      />
                      {hasMissingCateringRequirement("setup time") && (
                        <p className="text-xs text-destructive">Setup time is required when setup is needed.</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Takedown */}
                <div className="space-y-3 rounded-lg border border-primary/10 p-4">
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
                      <TimeSelect
                        id="pub-takedown-time"
                        value={cateringForm.takedownTime}
                        onValueChange={(value) =>
                          setCateringForm((prev) => ({ ...prev, takedownTime: value }))
                        }
                        placeholder="Select takedown time"
                        minTime={PUBLIC_QUOTE_TIME_MIN}
                        maxTime={PUBLIC_QUOTE_TIME_MAX}
                        invalid={hasMissingCateringRequirement("takedown time")}
                        className={cn(
                          hasMissingCateringRequirement("takedown time") && "border-destructive focus-visible:ring-destructive/30",
                        )}
                      />
                      {hasMissingCateringRequirement("takedown time") && (
                        <p className="text-xs text-destructive">Takedown time is required when takedown is needed.</p>
                      )}
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
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => {
                          handlePaymentMethodSelect(value);
                        }}
                        className={`rounded-lg border px-4 py-2.5 text-sm font-medium transition-all ${
                          paymentMethod === value
                            ? "border-primary bg-primary/10 text-primary ring-1 ring-primary/20"
                            : "border-border hover:border-primary/40 hover:bg-accent/50"
                        }`}
                      >
                        {getQuotePaymentMethodLabel(value)}
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

              {selectedPaymentGuidance && (
                <PaymentMethodGuidanceCallout method={paymentMethod} />
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

        {publicActionsClosed && (
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-sm text-muted-foreground">
                This quote is no longer open for online approval or payment submission.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Response section */}
        {canRespond && (
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-sm text-muted-foreground mb-4">
                Would you like to approve or decline this quote?
              </p>
              {cateringRequiredMissing && (
                <p className="mb-4 text-center text-sm text-amber-700">
                  Complete the required event details to approve: {missingCateringRequirements.join(", ")}.
                </p>
              )}
              <div className="sticky bottom-0 -mx-5 bg-background/90 backdrop-blur-lg border-t border-border/60 px-5 py-4 sm:relative sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-none">
                <div className="flex flex-col sm:flex-row justify-center gap-3 sm:gap-4">
                  <Button
                    size="lg"
                    onClick={() => handleRespond("ACCEPTED")}
                    disabled={responding || cateringRequiredMissing}
                    className="bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm min-w-[160px] h-12 text-base font-semibold"
                    title={cateringRequiredMissing ? "Fill in required event details above" : undefined}
                  >
                    {responding ? "Submitting..." : "Approve Quote"}
                  </Button>
                  <Button
                    size="lg"
                    variant="destructive"
                    onClick={() => handleRespond("DECLINED")}
                    disabled={responding}
                    className="min-w-[160px] h-12 text-base shadow-sm"
                  >
                    {responding ? "Submitting..." : "Decline Quote"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {alreadyResponded && (
      <Card>
        <CardContent className="pt-6 text-center">
              {quote.quoteStatus === "ACCEPTED" && !paymentDetailsResolved && paymentLinkAvailable ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Your approval was received. Payment details are still needed to finish processing this quote.
                  </p>
                  <Button
                    type="button"
                    onClick={() => router.push(`/quotes/payment/${token}`)}
                    className="min-w-[220px]"
                  >
                    Provide Payment Details
                  </Button>
                </div>
              ) : quote.quoteStatus === "ACCEPTED" && !paymentDetailsResolved ? (
                <p className="text-sm text-muted-foreground">
                  Your approval was received. Payment collection for this quote is now closed.
                </p>
              ) : quote.quoteStatus === "ACCEPTED" && selectedPaymentGuidance ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    This quote has been approved. Please follow the payment instructions below.
                  </p>
                  <PaymentMethodGuidanceCallout method={paymentMethod} className="mx-auto max-w-lg text-left" />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {quote.quoteStatus === "ACCEPTED"
                    ? "This quote has been approved."
                    : quote.quoteStatus === "REVISED"
                    ? "This quote has been revised. A new version has been issued."
                    : "This quote has been declined."}
                </p>
              )}
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
      <PaymentMethodGuidanceDialog
        method={paymentMethod}
        open={guidanceOpen}
        onOpenChange={setGuidanceOpen}
      />
    </div>
  );
}
