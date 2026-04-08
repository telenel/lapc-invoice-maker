"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import { formatAmount, formatDate, getInitials } from "@/lib/formatters";
import { invoiceApi } from "@/domains/invoice/api-client";
import { quoteApi } from "@/domains/quote/api-client";
import { followUpApi } from "@/domains/follow-up/api-client";
import type { InvoiceResponse } from "@/domains/invoice/types";
import type { FollowUpBadgeState } from "@/domains/follow-up/types";
import { FollowUpBadge } from "@/components/follow-up/follow-up-badge";
import { useSSE } from "@/lib/use-sse";

type QuoteStatus = "DRAFT" | "SENT" | "SUBMITTED_EMAIL" | "SUBMITTED_MANUAL" | "ACCEPTED" | "DECLINED" | "REVISED" | "EXPIRED";

const QUOTE_BADGE_VARIANT: Record<QuoteStatus, "success" | "info" | "warning" | "destructive" | "outline"> = {
  DRAFT: "warning",
  SENT: "info",
  SUBMITTED_EMAIL: "info",
  SUBMITTED_MANUAL: "info",
  ACCEPTED: "success",
  DECLINED: "destructive",
  REVISED: "outline",
  EXPIRED: "outline",
};

const QUOTE_STATUS_LABEL: Record<QuoteStatus, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  SUBMITTED_EMAIL: "Sent (Email)",
  SUBMITTED_MANUAL: "Sent (Manual)",
  ACCEPTED: "Accepted",
  DECLINED: "Declined",
  REVISED: "Revised",
  EXPIRED: "Expired",
};

type ActivityItem = {
  type: "invoice" | "quote";
  id: string;
  number: string | null;
  name: string;
  department: string;
  date: string;
  amount: number;
  status: string;
  creatorId: string;
  creatorName: string;
  createdAt: string;
};

function invoiceBadge(status: string) {
  const variant = status === "FINAL" ? "success" : status === "PENDING_CHARGE" ? "info" : "warning";
  const label = status === "FINAL" ? "Final" : status === "PENDING_CHARGE" ? "Pending" : "Draft";
  return { variant, label } as const;
}

export function RecentActivity() {
  const { data: session } = useSession();
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [badgeStates, setBadgeStates] = useState<Record<string, FollowUpBadgeState>>({});
  const [loading, setLoading] = useState(true);
  const currentUserId = (session?.user as { id?: string } | undefined)?.id;

  const fetchActivity = useCallback(async () => {
    try {
      const [invoiceData, quoteData] = await Promise.all([
        invoiceApi.list({ pageSize: 10, sortBy: "createdAt", sortOrder: "desc" }),
        quoteApi.list({ pageSize: 10, sortBy: "createdAt", sortOrder: "desc" }),
      ]);

      const invoiceItems: ActivityItem[] = invoiceData.invoices.map((inv: InvoiceResponse) => ({
        type: "invoice" as const,
        id: inv.id,
        number: inv.invoiceNumber ?? null,
        name: inv.staff?.name ?? inv.contact?.name ?? "Unknown",
        department: inv.department,
        date: inv.date,
        amount: Number(inv.totalAmount),
        status: inv.status,
        creatorId: inv.creatorId,
        creatorName: inv.creatorName,
        createdAt: inv.createdAt,
      }));

      const quoteItems: ActivityItem[] = quoteData.quotes.map((q) => ({
        type: "quote" as const,
        id: q.id,
        number: q.quoteNumber ?? null,
        name: q.staff?.name ?? q.contact?.name ?? q.recipientName ?? "Unknown",
        department: q.department,
        date: q.date,
        amount: Number(q.totalAmount),
        status: q.quoteStatus,
        creatorId: q.creatorId,
        creatorName: q.creatorName,
        createdAt: q.createdAt,
      }));

      const merged = [...invoiceItems, ...quoteItems]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 10);

      setItems(merged);

      const invoiceIds = merged
        .filter((item) => item.type === "invoice")
        .map((item) => item.id);
      if (invoiceIds.length > 0) {
        followUpApi
          .getBadgeStatesForInvoices(invoiceIds)
          .then(setBadgeStates)
          .catch(() => {});
      }
    } catch (err) {
      console.error("Failed to fetch recent activity:", err);
      toast.error("Failed to load recent activity");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActivity();
  }, [fetchActivity]);

  useSSE("invoice-changed", fetchActivity);
  useSSE("quote-changed", fetchActivity);

  return (
    <Card className="card-hover">
      <CardHeader className="border-b border-border/50">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-bold">Recent Activity</CardTitle>
          <div className="flex items-center gap-3">
            <Link
              href="/invoices"
              className="text-[11px] font-semibold text-primary hover:text-primary/80 transition-colors"
            >
              Invoices →
            </Link>
            <Link
              href="/quotes"
              className="text-[11px] font-semibold text-primary hover:text-primary/80 transition-colors"
            >
              Quotes →
            </Link>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div>
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className={cn("flex items-center gap-3 px-4 py-3", i < 4 && "border-b border-border/30")}>
                <div className="skeleton w-[34px] h-[34px] rounded-lg shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-3.5 w-48" />
                  <div className="skeleton h-2.5 w-32" />
                </div>
                <div className="space-y-2 text-right">
                  <div className="skeleton h-3.5 w-16 ml-auto" />
                  <div className="skeleton h-4 w-12 ml-auto rounded-full" />
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground p-4">No activity yet</p>
        ) : (
          <div>
            {items.map((item, i) => {
              const isMine = item.creatorId === currentUserId;
              const href = item.type === "invoice" ? `/invoices/${item.id}` : `/quotes/${item.id}`;
              return (
                <Link
                  key={`${item.type}-${item.id}`}
                  href={href}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    i < items.length - 1 && "border-b border-border/30",
                    isMine && "bg-primary/[0.03]"
                  )}
                >
                  <div className={cn(
                    "flex items-center justify-center w-[34px] h-[34px] rounded-lg text-[11px] font-bold shrink-0",
                    isMine
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground"
                  )}>
                    {getInitials(item.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold truncate">
                      {item.number ?? "—"} · {item.name}
                      {isMine && <span className="text-[10px] text-primary font-medium ml-1.5">You</span>}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {item.type === "quote" ? "Quote" : "Invoice"} · {item.department} · {formatDate(item.date)}{!isMine ? ` · by ${item.creatorName}` : ""}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[13px] font-bold tabular-nums">
                      {formatAmount(item.amount)}
                    </p>
                    {item.type === "invoice" ? (
                      <Badge
                        variant={invoiceBadge(item.status).variant}
                        className="mt-0.5"
                      >
                        {invoiceBadge(item.status).label}
                      </Badge>
                    ) : (
                      <Badge
                        variant={QUOTE_BADGE_VARIANT[item.status as QuoteStatus] ?? "outline"}
                        className="mt-0.5"
                      >
                        {QUOTE_STATUS_LABEL[item.status as QuoteStatus] ?? item.status}
                      </Badge>
                    )}
                    {item.type === "invoice" && (
                      <FollowUpBadge state={badgeStates[item.id] ?? null} />
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
