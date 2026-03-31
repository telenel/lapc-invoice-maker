"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { ChevronRight, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { invoiceApi } from "@/domains/invoice/api-client";
import { quoteApi } from "@/domains/quote/api-client";
import type { InvoiceResponse } from "@/domains/invoice/types";
import type { QuoteResponse } from "@/domains/quote/types";
import { useSSE } from "@/lib/use-sse";

const EXPIRY_WINDOW_DAYS = 7;
const STALE_DRAFT_DAYS = 3;
const MAX_ITEMS = 5;

interface ActionItem {
  id: string;
  priority: number;
  label: string;
  context: string;
  href: string;
  dotColor: string;
}

function daysUntil(dateStr: string): number {
  const now = new Date();
  const target = new Date(dateStr);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function daysSince(dateStr: string): number {
  const now = new Date();
  const created = new Date(dateStr);
  return Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
}

function buildExpiringQuoteItems(quotes: QuoteResponse[]): ActionItem[] {
  return quotes
    .filter((q) => q.expirationDate && daysUntil(q.expirationDate) <= EXPIRY_WINDOW_DAYS && daysUntil(q.expirationDate) >= 0)
    .sort((a, b) => daysUntil(a.expirationDate!) - daysUntil(b.expirationDate!))
    .map((q) => {
      const days = daysUntil(q.expirationDate!);
      const dayText = days === 0 ? "today" : days === 1 ? "in 1 day" : `in ${days} days`;
      return {
        id: `expiring-${q.id}`,
        priority: 1,
        label: `${q.quoteNumber ?? "Quote"} expires ${dayText}`,
        context: q.recipientName,
        href: `/quotes/${q.id}`,
        dotColor: days <= 2 ? "bg-red-500" : "bg-amber-500",
      };
    });
}

function buildStaleDraftItems(invoices: InvoiceResponse[]): ActionItem[] {
  return invoices
    .filter((inv) => !inv.isRunning && daysSince(inv.createdAt) >= STALE_DRAFT_DAYS)
    .sort((a, b) => daysSince(b.createdAt) - daysSince(a.createdAt))
    .map((inv) => {
      const days = daysSince(inv.createdAt);
      return {
        id: `stale-${inv.id}`,
        priority: 2,
        label: `${inv.invoiceNumber ?? "Draft"} draft for ${days} days`,
        context: inv.department,
        href: `/invoices/${inv.id}/edit`,
        dotColor: "bg-amber-500",
      };
    });
}

function buildAwaitingResponseItems(quotes: QuoteResponse[]): ActionItem[] {
  return quotes.map((q) => ({
    id: `awaiting-${q.id}`,
    priority: 3,
    label: `${q.quoteNumber ?? "Quote"} awaiting response`,
    context: q.recipientName,
    href: `/quotes/${q.id}`,
    dotColor: "bg-violet-500",
  }));
}

function buildRunningItems(invoices: InvoiceResponse[]): ActionItem[] {
  return invoices.map((inv) => ({
    id: `running-${inv.id}`,
    priority: 4,
    label: `Running: ${inv.runningTitle || "Untitled"} (${inv.items.length} item${inv.items.length !== 1 ? "s" : ""})`,
    context: inv.department,
    href: `/invoices/${inv.id}/edit`,
    dotColor: "bg-blue-500",
  }));
}

function buildPendingChargeItems(invoices: InvoiceResponse[]): ActionItem[] {
  return invoices.map((inv) => ({
    id: `pending-${inv.id}`,
    priority: 5,
    label: `${inv.invoiceNumber ?? "Invoice"} pending POS charge`,
    context: inv.department,
    href: `/invoices/${inv.id}`,
    dotColor: "bg-orange-500",
  }));
}

export function YourFocus() {
  const { data: session } = useSession();
  const [items, setItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);

  const userId = (session?.user as { id?: string } | undefined)?.id;

  const fetchNextSteps = useCallback(async () => {
    if (!userId) return;

    try {
      const [sentQuotes, drafts, running, pendingCharge] = await Promise.all([
        quoteApi.list({ quoteStatus: "SENT", pageSize: 10 }),
        invoiceApi.list({ status: "DRAFT", creatorId: userId, pageSize: 10 }),
        invoiceApi.list({ status: "DRAFT", isRunning: true, creatorId: userId, pageSize: 5 }),
        invoiceApi.list({ status: "PENDING_CHARGE", creatorId: userId, pageSize: 5 }),
      ]);

      const allItems: ActionItem[] = [
        ...buildExpiringQuoteItems(sentQuotes.quotes),
        ...buildStaleDraftItems(drafts.invoices ?? []),
        ...buildAwaitingResponseItems(sentQuotes.quotes),
        ...buildRunningItems(running.invoices ?? []),
        ...buildPendingChargeItems(pendingCharge.invoices ?? []),
      ];

      // Deduplicate: expiring quotes already appear in awaiting, so remove duplicates
      const seen = new Set<string>();
      const deduped = allItems.filter((item) => {
        // Extract the entity ID from the composite key
        const entityId = item.id.split("-").slice(1).join("-");
        const key = entityId;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      // Sort by priority, then take top N
      const sorted = deduped
        .sort((a, b) => a.priority - b.priority)
        .slice(0, MAX_ITEMS);

      setItems(sorted);
    } catch (err) {
      console.error("Failed to fetch next steps:", err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchNextSteps();
  }, [fetchNextSteps]);

  useSSE("invoice-changed", fetchNextSteps);
  useSSE("quote-changed", fetchNextSteps);

  if (loading) {
    return (
      <Card className="card-hover">
        <CardContent className="py-3 px-4">
          <div className="skeleton h-3 w-20 mb-3" />
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton h-10 w-full rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const hasWork = items.length > 0;

  return (
    <Card className={cn(
      "overflow-hidden card-hover",
      hasWork && "ring-1 ring-primary/10"
    )}>
      <CardContent className="py-3 px-4">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Next Steps
            </span>
            {hasWork && (
              <>
                <Badge variant="secondary" className="h-4 min-w-[18px] px-1 text-[10px] font-bold">
                  {items.length}
                </Badge>
                <span className="flex h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
              </>
            )}
          </div>
        </div>

        {hasWork ? (
          <div className="flex flex-col gap-1">
            {items.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className="group flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className={cn("h-2 w-2 rounded-full shrink-0", item.dotColor)} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.label}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{item.context}</p>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 group-hover:text-foreground transition-colors shrink-0" />
              </Link>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            <span>All clear — you&apos;re caught up!</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
