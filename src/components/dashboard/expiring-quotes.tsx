"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { quoteApi } from "@/domains/quote/api-client";
import type { QuoteResponse } from "@/domains/quote/types";
import { useSSE } from "@/lib/use-sse";

const EXPIRY_WINDOW_DAYS = 7;

function daysUntil(dateStr: string): number {
  const now = new Date();
  const target = new Date(dateStr);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function getDotColor(days: number): string {
  if (days <= 2) return "bg-red-500";
  if (days <= 5) return "bg-amber-500";
  return "bg-muted-foreground/50";
}

function getDaysLabel(days: number): string {
  if (days <= 0) return "Expires today";
  if (days === 1) return "1 day left";
  return `${days} days left`;
}

export function ExpiringQuotes() {
  const [quotes, setQuotes] = useState<QuoteResponse[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchExpiring = useCallback(() => {
    quoteApi
      .list({ quoteStatus: "SENT", pageSize: 20 })
      .then((data) => {
        const expiring = data.quotes
          .filter((q) => {
            if (!q.expirationDate) return false;
            const days = daysUntil(q.expirationDate);
            return days >= 0 && days <= EXPIRY_WINDOW_DAYS;
          })
          .sort((a, b) => daysUntil(a.expirationDate!) - daysUntil(b.expirationDate!));
        setQuotes(expiring);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchExpiring();
  }, [fetchExpiring]);

  useSSE("quote-changed", fetchExpiring);

  if (loading || quotes.length === 0) return null;

  return (
    <Card className="card-hover">
      <CardHeader className="pb-2 border-b border-border/50">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-bold">Expiring Soon</CardTitle>
          <Badge variant="warning" className="tabular-nums">{quotes.length}</Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div>
          {quotes.map((q, i) => {
            const days = daysUntil(q.expirationDate!);
            return (
              <Link
                key={q.id}
                href={`/quotes/${q.id}`}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  i < quotes.length - 1 && "border-b border-border/30",
                )}
              >
                <span className={cn("h-2 w-2 rounded-full shrink-0", getDotColor(days))} />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold truncate">
                    {q.quoteNumber ?? "Quote"}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {q.recipientName}
                  </p>
                </div>
                <span className={cn(
                  "text-xs font-medium shrink-0",
                  days <= 2 ? "text-red-500" : days <= 5 ? "text-amber-500" : "text-muted-foreground",
                )}>
                  {getDaysLabel(days)}
                </span>
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
