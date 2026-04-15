"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  PaymentMethodGuidanceCallout,
  PaymentMethodGuidanceDialog,
} from "@/components/quotes/payment-method-guidance";
import { quoteApi } from "@/domains/quote/api-client";
import {
  coerceQuotePaymentMethod,
  getQuotePaymentMethodLabel,
  getQuotePaymentMethodGuidance,
  QUOTE_PAYMENT_METHODS,
  type QuotePaymentMethod,
} from "@/domains/quote/payment";
import type { QuoteStatus } from "@/domains/quote/types";

type PaymentQuoteState = {
  quoteStatus: QuoteStatus;
  paymentDetailsResolved: boolean;
  paymentLinkAvailable?: boolean;
  quoteNumber: string | null;
  paymentMethod?: string | null;
};

export function PaymentDetailsForm({
  token,
  initialQuote,
}: {
  token: string;
  initialQuote: PaymentQuoteState | null;
}) {
  const initialPaymentMethod = coerceQuotePaymentMethod(initialQuote?.paymentMethod) ?? "";
  const [paymentMethod, setPaymentMethod] = useState<QuotePaymentMethod | "">(initialPaymentMethod);
  const [accountNumber, setAccountNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedMethod, setSubmittedMethod] = useState<QuotePaymentMethod | null>(null);
  const [guidanceOpen, setGuidanceOpen] = useState(false);
  const accountNumberRequired = paymentMethod === "ACCOUNT_NUMBER";
  const normalizedAccountNumber = accountNumber.trim();
  const selectedGuidance = getQuotePaymentMethodGuidance(paymentMethod);
  const submittedGuidance = getQuotePaymentMethodGuidance(submittedMethod);
  const quote = initialQuote;
  const existingGuidance = getQuotePaymentMethodGuidance(quote?.paymentMethod);
  const isAccepted = quote?.quoteStatus === "ACCEPTED";
  const isExpired = quote?.quoteStatus === "EXPIRED";
  const isResolved = Boolean(quote && quote.paymentDetailsResolved);
  const isPaymentLinkClosed = Boolean(quote && quote.paymentLinkAvailable === false);

  function handlePaymentMethodSelect(nextMethod: QuotePaymentMethod) {
    setPaymentMethod(nextMethod);
    if (nextMethod !== "ACCOUNT_NUMBER") {
      setAccountNumber("");
    }
    setGuidanceOpen(Boolean(getQuotePaymentMethodGuidance(nextMethod)));
  }

  async function handleSubmit() {
    if (!paymentMethod) {
      toast.error("Please select a payment method");
      return;
    }
    if (accountNumberRequired && !normalizedAccountNumber) {
      toast.error("Please enter your SAP account number");
      return;
    }
    setSubmitting(true);
    try {
      await quoteApi.submitPublicPaymentDetails(token, {
        paymentMethod,
        accountNumber: accountNumberRequired ? normalizedAccountNumber : undefined,
      });
      setSubmittedMethod(paymentMethod);
      setSubmitted(true);
      toast.success(
        selectedGuidance
          ? "Payment method recorded — please follow the instructions provided."
          : "Payment details submitted — thank you!",
      );
    } catch (err) {
      if (typeof err === "string") {
        toast.error(err);
      } else if (err && typeof err === "object" && typeof (err as { message?: unknown }).message === "string") {
        toast.error((err as { message: string }).message);
      } else {
        try {
          const stringified = JSON.stringify(err);
          toast.error(typeof stringified === "string" ? stringified : "Something went wrong");
        } catch {
          toast.error("Something went wrong");
        }
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (!quote) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-2">
            <h2 className="text-lg font-semibold">Quote Not Found</h2>
            <p className="text-sm text-muted-foreground">
              This payment link is invalid or has expired.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isExpired) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-2">
            <h2 className="text-lg font-semibold">Quote Expired</h2>
            <p className="text-sm text-muted-foreground">
              This quote is no longer active, so payment details cannot be submitted here.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isAccepted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-2">
            <h2 className="text-lg font-semibold">Payment Link Not Ready</h2>
            <p className="text-sm text-muted-foreground">
              Payment details can only be submitted after the quote is approved.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isPaymentLinkClosed) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-2">
            <h2 className="text-lg font-semibold">Payment Link Closed</h2>
            <p className="text-sm text-muted-foreground">
              Payment details can no longer be submitted through this quote link.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isResolved) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-2">
            <h2 className="text-lg font-semibold">Payment Details Already On File</h2>
            {existingGuidance ? (
              <>
                <p className="text-sm text-muted-foreground">
                  We already recorded your selected payment method for {quote.quoteNumber ?? "this quote"}.
                </p>
                <PaymentMethodGuidanceCallout method={quote.paymentMethod ?? null} className="mt-4 text-left" />
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                We already have payment details for {quote.quoteNumber ?? "this quote"}.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-2">
            <h2 className="text-lg font-semibold">Thank You!</h2>
            {submittedGuidance ? (
              <>
                <p className="text-sm text-muted-foreground">
                  We recorded your selected payment method for {quote.quoteNumber ?? "this quote"}.
                </p>
                <PaymentMethodGuidanceCallout method={submittedMethod} className="mt-4 text-left" />
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Your payment details have been received. No further action is needed.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="max-w-lg mx-auto px-4 py-4">
          <span className="font-bold text-lg"><span className="text-red-600">LA</span>Portal</span>
          <p className="text-sm text-muted-foreground">Payment Details</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Provide Payment Details</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Please select how you&apos;d like to pay for {quote.quoteNumber ?? "your approved quote"}.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Payment Method
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {QUOTE_PAYMENT_METHODS.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      handlePaymentMethodSelect(value);
                    }}
                    className={`rounded-md border px-3 py-2 text-sm transition-colors ${
                      paymentMethod === value
                        ? "border-primary bg-primary/10 font-medium text-primary"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    {getQuotePaymentMethodLabel(value)}
                  </button>
                ))}
              </div>
            </div>

            {paymentMethod === "ACCOUNT_NUMBER" && (
              <div className="space-y-1.5">
                <Label>SAP Account Number</Label>
                <Input
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder="Enter your SAP account number"
                />
              </div>
            )}

            {selectedGuidance && (
              <PaymentMethodGuidanceCallout method={paymentMethod} />
            )}

            <Button
              onClick={handleSubmit}
              disabled={!paymentMethod || submitting || (accountNumberRequired && !normalizedAccountNumber)}
              className="w-full"
            >
              {submitting ? "Submitting..." : "Submit Payment Details"}
            </Button>
          </CardContent>
        </Card>
      </div>
      <PaymentMethodGuidanceDialog
        method={paymentMethod}
        open={guidanceOpen}
        onOpenChange={setGuidanceOpen}
      />
    </div>
  );
}
