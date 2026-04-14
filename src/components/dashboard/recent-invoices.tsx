"use client";

import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatAmount, formatDate, getInitials } from "@/lib/formatters";
import { invoiceApi } from "@/domains/invoice/api-client";
import { quoteApi } from "@/domains/quote/api-client";
import type { InvoiceResponse } from "@/domains/invoice/types";
import type { FollowUpBadgeState } from "@/domains/follow-up/types";
import { useDashboardBootstrapData } from "./dashboard-bootstrap-provider";
import type { DashboardActivityItem } from "@/domains/dashboard/types";
import { useDeferredDashboardRealtime } from "./use-deferred-dashboard-realtime";

type QuoteStatus = "DRAFT" | "SENT" | "SUBMITTED_EMAIL" | "SUBMITTED_MANUAL" | "ACCEPTED" | "DECLINED" | "REVISED" | "EXPIRED";

type IdleCapableWindow = Window & {
  requestIdleCallback?: (
    callback: IdleRequestCallback,
    options?: IdleRequestOptions,
  ) => number;
  cancelIdleCallback?: (handle: number) => void;
};

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

function invoiceBadge(status: string) {
  const variant = status === "FINAL" ? "success" : "warning";
  const label = status === "FINAL" ? "Final" : "Draft";
  return { variant, label } as const;
}

function formatActivityHeading(number: string | null, name: string) {
  const displayNumber = number?.trim();
  return displayNumber ? `${displayNumber} · ${name}` : name;
}

function FollowUpBadgeChip({ state }: { state: FollowUpBadgeState | null }) {
  if (!state) {
    return null;
  }

  if (state.seriesStatus === "EXHAUSTED") {
    return (
      <Badge variant="destructive" className="text-[10px]">
        No Response
      </Badge>
    );
  }

  if (state.seriesStatus === "ACTIVE") {
    return (
      <Badge className="bg-amber-500 text-[10px] text-white hover:bg-amber-600">
        Follow Up {state.currentAttempt}/{state.maxAttempts}
      </Badge>
    );
  }

  return null;
}

export function RecentActivity({
  currentUserId,
}: {
  currentUserId: string | null;
}) {
  const dashboardBootstrap = useDashboardBootstrapData();
  const initialRecentActivity = dashboardBootstrap?.recentActivity ?? null;
  const [items, setItems] = useState<DashboardActivityItem[]>(
    initialRecentActivity?.items ?? [],
  );
  const [badgeStates, setBadgeStates] = useState<Record<string, FollowUpBadgeState>>(
    initialRecentActivity?.badgeStates ?? {},
  );
  const [loading, setLoading] = useState(() => initialRecentActivity === null);
  const [detailsReady, setDetailsReady] = useState(false);
  const skipInitialBadgeRefreshRef = useRef(initialRecentActivity !== null);

  const fetchActivity = useCallback(async () => {
    try {
      const [invoiceData, quoteData] = await Promise.all([
        invoiceApi.list({ pageSize: 10, sortBy: "createdAt", sortOrder: "desc" }),
        quoteApi.list({ pageSize: 10, sortBy: "createdAt", sortOrder: "desc" }),
      ]);

      const invoiceItems: DashboardActivityItem[] = invoiceData.invoices.map((inv: InvoiceResponse) => ({
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

      const quoteItems: DashboardActivityItem[] = quoteData.quotes.map((q) => ({
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
        paymentFollowUpBadge: q.paymentFollowUpBadge ?? null,
      }));

      const merged = [...invoiceItems, ...quoteItems]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 10);

      startTransition(() => {
        setItems(merged);
      });
    } catch (err) {
      console.error("Failed to fetch recent activity:", err);
      void import("sonner")
        .then(({ toast }) => {
          toast.error("Failed to load recent activity");
        })
        .catch(() => {});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialRecentActivity !== null) {
      return;
    }

    void fetchActivity();
  }, [fetchActivity, initialRecentActivity]);

  const refreshActivity = useCallback(() => {
    void fetchActivity();
  }, [fetchActivity]);

  useEffect(() => {
    if (detailsReady) {
      return;
    }

    const win = window as IdleCapableWindow;
    let idleHandle: number | null = null;

    function markReady() {
      startTransition(() => {
        setDetailsReady(true);
      });
    }

    const fallbackTimer = window.setTimeout(markReady, 1500);

    if (win.requestIdleCallback) {
      idleHandle = win.requestIdleCallback(markReady, { timeout: 2000 });
    } else {
      idleHandle = window.setTimeout(markReady, 700);
    }

    window.addEventListener("pointerdown", markReady, { once: true, passive: true });
    window.addEventListener("keydown", markReady, { once: true });
    window.addEventListener("focusin", markReady, { once: true });

    return () => {
      window.clearTimeout(fallbackTimer);
      if (idleHandle !== null) {
        if (win.cancelIdleCallback) {
          win.cancelIdleCallback(idleHandle);
        } else {
          window.clearTimeout(idleHandle);
        }
      }
      window.removeEventListener("pointerdown", markReady);
      window.removeEventListener("keydown", markReady);
      window.removeEventListener("focusin", markReady);
    };
  }, [detailsReady]);

  useEffect(() => {
    if (!detailsReady) {
      return;
    }

    if (skipInitialBadgeRefreshRef.current) {
      skipInitialBadgeRefreshRef.current = false;
      return;
    }

    const invoiceIds = items
      .filter((item) => item.type === "invoice")
      .map((item) => item.id);

    if (invoiceIds.length === 0) {
      setBadgeStates({});
      return;
    }

    let cancelled = false;

    void import("@/domains/follow-up/api-client")
      .then(({ followUpApi }) => followUpApi.getBadgeStatesForInvoices(invoiceIds))
      .then((states) => {
        if (!cancelled) {
          setBadgeStates(states);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setBadgeStates({});
        }
      });

    return () => {
      cancelled = true;
    };
  }, [detailsReady, items]);

  useDeferredDashboardRealtime(
    ["invoice-changed", "quote-changed"],
    refreshActivity,
    { enabled: detailsReady },
  );

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
                      {formatActivityHeading(item.number, item.name)}
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
                      <div className="mt-0.5 flex items-center justify-end gap-1">
                        <Badge
                          variant={QUOTE_BADGE_VARIANT[item.status as QuoteStatus] ?? "outline"}
                        >
                          {QUOTE_STATUS_LABEL[item.status as QuoteStatus] ?? item.status}
                        </Badge>
                        <FollowUpBadgeChip state={item.paymentFollowUpBadge ?? null} />
                      </div>
                    )}
                    {item.type === "invoice" && (
                      <FollowUpBadgeChip state={badgeStates[item.id] ?? null} />
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
