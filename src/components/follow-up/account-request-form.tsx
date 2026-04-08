"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PublicFollowUpSummary } from "@/domains/follow-up/types";

interface AccountRequestFormProps {
  token: string;
}

export function AccountRequestForm({ token }: AccountRequestFormProps) {
  const [summary, setSummary] = useState<PublicFollowUpSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accountNumber, setAccountNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [alreadyResolved, setAlreadyResolved] = useState(false);

  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetch(`/api/follow-ups/public/${token}`);
      if (!res.ok) {
        setError("This link is invalid or has expired.");
        return;
      }
      const data = await res.json();
      if (data.seriesStatus === "COMPLETED" || data.seriesStatus === "EXHAUSTED") {
        setAlreadyResolved(true);
      }
      setSummary(data);
    } catch {
      setError("Failed to load. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!accountNumber.trim()) return;
    setSubmitting(true);

    try {
      const res = await fetch(`/api/follow-ups/public/${token}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountNumber: accountNumber.trim() }),
      });
      const data = await res.json().catch(() => ({}));

      if (data.alreadyResolved) {
        setAlreadyResolved(true);
        return;
      }
      if (!res.ok) {
        setError(data.error || "Submission failed");
        return;
      }
      setSubmitted(true);
    } catch {
      setError("Submission failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (error && !summary) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="w-full max-w-md rounded-lg border bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-semibold text-red-600">Link Unavailable</h1>
          <p className="mt-2 text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="w-full max-w-md rounded-lg border bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-semibold text-green-600">Thank You!</h1>
          <p className="mt-2 text-muted-foreground">
            The account number has been submitted successfully. You can close this page.
          </p>
        </div>
      </div>
    );
  }

  if (alreadyResolved) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="w-full max-w-md rounded-lg border bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-semibold">Already Resolved</h1>
          <p className="mt-2 text-muted-foreground">
            The account number for this request has already been provided. No further action is needed.
          </p>
        </div>
      </div>
    );
  }

  const docLabel = summary!.type === "QUOTE" ? "Quote" : "Invoice";
  const docNumber = summary!.type === "QUOTE" ? summary!.quoteNumber : summary!.invoiceNumber;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md rounded-lg border bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold">Account Number Needed</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Reminder {summary!.currentAttempt} of {summary!.maxAttempts}
        </p>

        <div className="mt-6 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{docLabel}</span>
            <span className="font-medium">{docNumber}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Description</span>
            <span>{summary!.description}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Amount</span>
            <span className="font-medium">${summary!.totalAmount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Contact</span>
            <span>{summary!.creatorName}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <Label htmlFor="accountNumber">Account Number</Label>
            <Input
              id="accountNumber"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              placeholder="Enter your account number"
              required
              maxLength={100}
              autoFocus
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full" disabled={submitting || !accountNumber.trim()}>
            {submitting ? "Submitting..." : "Submit Account Number"}
          </Button>
        </form>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Los Angeles Pierce College Bookstore
        </p>
      </div>
    </div>
  );
}
