"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { QUOTE_PAYMENT_METHODS } from "@/domains/quote/payment";
import type { QuoteStatus } from "@/domains/quote/types";

const PAYMENT_OPTIONS = QUOTE_PAYMENT_METHODS.map((value) => ({
  value,
  label: value === "ACCOUNT_NUMBER"
    ? "Account Number"
    : value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()),
}));

type PaymentQuoteState = {
  quoteStatus: QuoteStatus;
  paymentDetailsResolved: boolean;
  quoteNumber: string | null;
};

export function PaymentDetailsForm({
  token,
  initialQuote,
}: {
  token: string;
  initialQuote: PaymentQuoteState | null;
}) {
  const [paymentMethod, setPaymentMethod] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const accountNumberRequired = paymentMethod === "ACCOUNT_NUMBER";
  const normalizedAccountNumber = accountNumber.trim();
  const quote = initialQuote;
  const isAccepted = quote?.quoteStatus === "ACCEPTED";
  const isExpired = quote?.quoteStatus === "EXPIRED";
  const isResolved = Boolean(quote && quote.paymentDetailsResolved);

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
      const res = await fetch(`/api/quotes/public/${token}/payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentMethod,
          accountNumber: accountNumberRequired ? normalizedAccountNumber : undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Failed to submit");
        return;
      }
      setSubmitted(true);
      toast.success("Payment details submitted — thank you!");
    } catch {
      toast.error("Something went wrong");
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

  if (isResolved) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-2">
            <h2 className="text-lg font-semibold">Payment Details Already On File</h2>
            <p className="text-sm text-muted-foreground">
              We already have payment details for {quote.quoteNumber ?? "this quote"}.
            </p>
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
            <p className="text-sm text-muted-foreground">
              Your payment details have been received. No further action is needed.
            </p>
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
                {PAYMENT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      setPaymentMethod(opt.value);
                      if (opt.value !== "ACCOUNT_NUMBER") setAccountNumber("");
                    }}
                    className={`rounded-md border px-3 py-2 text-sm transition-colors ${
                      paymentMethod === opt.value
                        ? "border-primary bg-primary/10 font-medium text-primary"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    {opt.label}
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
    </div>
  );
}
