"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatAmount } from "@/lib/formatters";
import { invoiceApi } from "@/domains/invoice/api-client";

interface FocusData {
  myDrafts: number;
  myRunning: number;
  myFinalThisMonth: number;
  myTotalThisMonth: number;
  myFinalLastMonth: number;
}

function getNudge(data: FocusData): string | null {
  const { myDrafts, myRunning, myFinalThisMonth, myFinalLastMonth } = data;

  // Actionable nudges first
  if (myDrafts > 0 && myRunning > 0) {
    return `${myDrafts} draft${myDrafts !== 1 ? "s" : ""} and ${myRunning} running invoice${myRunning !== 1 ? "s" : ""} waiting for you`;
  }
  if (myDrafts > 0) {
    return `${myDrafts} draft${myDrafts !== 1 ? "s" : ""} to finalize`;
  }
  if (myRunning > 0) {
    return `${myRunning} running invoice${myRunning !== 1 ? "s" : ""} in progress`;
  }

  // Motivational nudges
  if (myFinalLastMonth > 0 && myFinalThisMonth > myFinalLastMonth) {
    return `You're ${myFinalThisMonth - myFinalLastMonth} ahead of last month — nice pace`;
  }
  if (myFinalThisMonth > 0) {
    return `${myFinalThisMonth} finalized this month — keep it up`;
  }

  return "All clear — ready for a new invoice?";
}

export function YourFocus() {
  const { data: session } = useSession();
  const [data, setData] = useState<FocusData | null>(null);
  const [loading, setLoading] = useState(true);

  const userId = (session?.user as { id?: string } | undefined)?.id;

  useEffect(() => {
    if (!userId) return;

    async function fetchFocus() {
      try {
        const now = new Date();
        const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const firstOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
        const dateFrom = firstOfMonth.toISOString().split("T")[0];
        const dateTo = now.toISOString().split("T")[0];
        const lastMonthFrom = firstOfLastMonth.toISOString().split("T")[0];
        const lastMonthTo = lastOfLastMonth.toISOString().split("T")[0];

        const [drafts, running, monthStats, lastMonthStats] = await Promise.all([
          invoiceApi.getStats({ status: "DRAFT", creatorId: userId }),
          invoiceApi.list({ status: "DRAFT", isRunning: true, creatorId: userId, pageSize: 1 }),
          invoiceApi.getStats({ status: "FINAL", creatorId: userId, dateFrom, dateTo }),
          invoiceApi.getStats({ status: "FINAL", creatorId: userId, dateFrom: lastMonthFrom, dateTo: lastMonthTo }),
        ]);

        setData({
          myDrafts: drafts.total,
          myRunning: running.total,
          myFinalThisMonth: monthStats.total,
          myTotalThisMonth: monthStats.sumTotalAmount,
          myFinalLastMonth: lastMonthStats.total,
        });
      } catch (err) {
        console.error("Failed to fetch focus data:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchFocus();
  }, [userId]);

  if (loading) {
    return (
      <Card className="card-hover">
        <CardContent className="py-3 px-4">
          <div className="skeleton h-3 w-20 mb-3" />
          <div className="grid grid-cols-3 gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-lg bg-muted/50 px-3 py-2.5">
                <div className="skeleton h-2.5 w-16 mb-2" />
                <div className="skeleton h-5 w-8" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const hasWork = data.myDrafts > 0 || data.myRunning > 0;
  const nudge = getNudge(data);

  const items = [
    {
      label: "Your Drafts",
      value: data.myDrafts,
      href: "/invoices?status=DRAFT",
      color: data.myDrafts > 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground",
      bgColor: data.myDrafts > 0 ? "bg-amber-500/10" : "bg-muted/50",
      dotColor: data.myDrafts > 0 ? "bg-amber-500" : "bg-muted-foreground/30",
    },
    {
      label: "Running",
      value: data.myRunning,
      href: "/invoices?status=DRAFT",
      color: data.myRunning > 0 ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground",
      bgColor: data.myRunning > 0 ? "bg-blue-500/10" : "bg-muted/50",
      dotColor: data.myRunning > 0 ? "bg-blue-500" : "bg-muted-foreground/30",
    },
    {
      label: "Finalized This Month",
      value: data.myFinalThisMonth,
      href: "/invoices?status=FINAL",
      color: "text-emerald-600 dark:text-emerald-400",
      bgColor: data.myFinalThisMonth > 0 ? "bg-emerald-500/10" : "bg-muted/50",
      dotColor: "bg-emerald-500",
      suffix: data.myTotalThisMonth > 0 ? ` · ${formatAmount(data.myTotalThisMonth)}` : "",
    },
  ];

  return (
    <Card className={cn(
      "overflow-hidden card-hover",
      hasWork && "ring-1 ring-primary/10"
    )}>
      <CardContent className="py-3 px-4">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Your Focus
            </span>
            {hasWork && (
              <span className="flex h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
            )}
          </div>
          {nudge && (
            <span className="text-[11px] text-muted-foreground italic">
              {nudge}
            </span>
          )}
        </div>
        <div className="grid grid-cols-3 gap-3">
          {items.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                "group flex flex-col gap-1.5 rounded-lg px-3 py-2.5 transition-colors",
                item.bgColor,
                "hover:bg-accent"
              )}
            >
              <div className="flex items-center gap-1.5">
                <span className={cn("h-1.5 w-1.5 rounded-full", item.dotColor)} />
                <span className="text-[11px] font-medium text-muted-foreground">
                  {item.label}
                </span>
              </div>
              <div className="flex flex-col">
                {"suffix" in item && item.suffix ? (
                  <>
                    <span className={cn("text-[22px] font-extrabold tracking-tight tabular-nums", item.color)}>
                      {formatAmount(data.myTotalThisMonth)}
                    </span>
                    <span className="text-[11px] font-medium text-muted-foreground">
                      {item.value} invoice{item.value !== 1 ? "s" : ""}
                    </span>
                  </>
                ) : (
                  <span className={cn("text-2xl font-extrabold tabular-nums", item.color)}>
                    {item.value}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
