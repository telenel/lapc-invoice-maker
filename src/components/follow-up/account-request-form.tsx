"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PublicFollowUpSummary } from "@/domains/follow-up/types";

interface AccountRequestFormProps {
  token: string;
}

const ACCOUNT_REQUEST_ILLUSTRATION = "/illustrations/account-request-documents.png";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function AccountRequestShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[radial-gradient(circle_at_top_left,color-mix(in_oklch,var(--primary)_10%,transparent),transparent_32%),linear-gradient(135deg,#faf8f4_0%,#f3eee7_52%,#eee4d6_100%)] px-4 py-8 text-foreground sm:px-6">
      <section className="grid w-full max-w-5xl overflow-hidden rounded-[24px] border border-border/70 bg-card shadow-[0_24px_70px_rgba(43,40,37,0.14)] lg:grid-cols-[minmax(0,0.95fr)_minmax(360px,1.05fr)]">
        <div className="order-2 px-6 py-7 sm:px-8 sm:py-9 lg:order-1 lg:px-10 lg:py-10">
          {children}
        </div>

        <aside className="order-1 flex items-center justify-center border-b border-border/60 bg-[#fbfaf7] p-6 lg:order-2 lg:border-b-0 lg:border-l lg:p-10">
          <div className="w-full max-w-[460px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={ACCOUNT_REQUEST_ILLUSTRATION}
              alt=""
              aria-hidden="true"
              width={900}
              height={600}
              className="h-auto w-full rounded-[18px] object-contain"
            />
          </div>
        </aside>
      </section>
    </main>
  );
}

function StatusMessage({
  title,
  description,
  tone = "default",
}: {
  title: string;
  description: string;
  tone?: "default" | "error" | "success";
}) {
  const toneClass =
    tone === "error"
      ? "text-destructive"
      : tone === "success"
        ? "text-emerald-700"
        : "text-foreground";

  return (
    <AccountRequestShell>
      <div className="flex min-h-[330px] flex-col justify-center">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Los Angeles Pierce College Bookstore
        </p>
        <h1 className={`mt-4 text-3xl font-bold tracking-tight ${toneClass}`}>
          {title}
        </h1>
        <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      </div>
    </AccountRequestShell>
  );
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
      if (process.env.NODE_ENV !== "production" && token === "demo-token") {
        setSummary({
          invoiceNumber: "INV-2026-0412",
          quoteNumber: null,
          type: "INVOICE",
          description: "CopyTech chargeback for department print services",
          totalAmount: 486.35,
          creatorName: "LAPC Bookstore",
          currentAttempt: 2,
          maxAttempts: 5,
          seriesStatus: "ACTIVE",
        });
        return;
      }

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

    if (process.env.NODE_ENV !== "production" && token === "demo-token") {
      setSubmitted(true);
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch(`/api/follow-ups/public/${token}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountNumber: accountNumber.trim() }),
      });
      const data = await res.json().catch(() => ({}));

      const dataObj = (data && typeof data === "object" && !Array.isArray(data)) ? data : {};

      if (dataObj.alreadyResolved) {
        setAlreadyResolved(true);
        return;
      }
      if (!res.ok) {
        setError(dataObj.error || "Submission failed");
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
      <StatusMessage
        title="Loading Request"
        description="Checking this request link before showing the account number form."
      />
    );
  }

  if (error && !summary) {
    return (
      <StatusMessage
        title="Link Unavailable"
        description={error}
        tone="error"
      />
    );
  }

  if (submitted) {
    return (
      <StatusMessage
        title="Thank You"
        description="The account number has been submitted successfully. You can close this page."
        tone="success"
      />
    );
  }

  if (alreadyResolved) {
    return (
      <StatusMessage
        title="Already Resolved"
        description="The account number for this request has already been provided. No further action is needed."
      />
    );
  }

  const docLabel = summary!.type === "QUOTE" ? "Quote" : "Invoice";
  const docNumber = summary!.type === "QUOTE" ? summary!.quoteNumber : summary!.invoiceNumber;

  return (
    <AccountRequestShell>
      <div className="flex min-h-[430px] flex-col justify-center">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Los Angeles Pierce College Bookstore
        </p>
        <h1 className="mt-4 text-3xl font-bold tracking-tight">
          Account Number Needed
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Reminder {summary!.currentAttempt} of {summary!.maxAttempts}
        </p>

        <dl className="mt-7 divide-y divide-border/70 rounded-2xl border border-border/70 bg-muted/25 px-3 text-sm sm:px-4">
          <div className="grid grid-cols-[84px_minmax(0,1fr)] gap-3 py-3 sm:grid-cols-[112px_minmax(0,1fr)] sm:gap-4">
            <dt className="text-muted-foreground">{docLabel}</dt>
            <dd className="min-w-0 whitespace-nowrap text-right font-semibold">{docNumber}</dd>
          </div>
          <div className="grid grid-cols-1 gap-1 py-3 sm:grid-cols-[112px_minmax(0,1fr)] sm:gap-4">
            <dt className="text-muted-foreground">Description</dt>
            <dd className="min-w-0 leading-5 sm:text-right">
              {summary!.description || "No description provided"}
            </dd>
          </div>
          <div className="grid grid-cols-[84px_minmax(0,1fr)] gap-3 py-3 sm:grid-cols-[112px_minmax(0,1fr)] sm:gap-4">
            <dt className="text-muted-foreground">Amount</dt>
            <dd className="text-right font-semibold tabular-nums">
              {formatCurrency(summary!.totalAmount)}
            </dd>
          </div>
          <div className="grid grid-cols-[84px_minmax(0,1fr)] gap-3 py-3 sm:grid-cols-[112px_minmax(0,1fr)] sm:gap-4">
            <dt className="text-muted-foreground">Contact</dt>
            <dd className="min-w-0 text-right font-medium">{summary!.creatorName}</dd>
          </div>
        </dl>

        <form onSubmit={handleSubmit} className="mt-7 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="accountNumber">Account Number</Label>
            <Input
              id="accountNumber"
              name="accountNumber"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              placeholder="Enter account number..."
              required
              maxLength={100}
              autoComplete="off"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button
            type="submit"
            className="h-11 w-full font-semibold"
            disabled={submitting || !accountNumber.trim()}
          >
            {submitting ? "Submitting..." : "Submit Account Number"}
          </Button>
        </form>
      </div>
    </AccountRequestShell>
  );
}
