"use client";

import { startTransition, useCallback, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatAmount, getInitials } from "@/lib/formatters";
import { invoiceApi } from "@/domains/invoice/api-client";
import type { CreatorStatEntry } from "@/domains/invoice/types";
import { useDeferredDashboardRealtime } from "./use-deferred-dashboard-realtime";

interface StatsData {
  invoicesThisMonth: number;
  totalThisMonth: number;
  invoicesLastMonth: number;
  totalLastMonth: number;
}

type IdleCapableWindow = Window & {
  requestIdleCallback?: (
    callback: IdleRequestCallback,
    options?: IdleRequestOptions,
  ) => number;
  cancelIdleCallback?: (handle: number) => void;
};

type NumberFlowComponentType = typeof import("@number-flow/react")["default"];

function formatCount(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

export function StatsCards({
  currentUserId,
}: {
  currentUserId: string | null;
}) {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [teamUsers, setTeamUsers] = useState<CreatorStatEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [teamLoading, setTeamLoading] = useState(true);
  const [detailsReady, setDetailsReady] = useState(false);
  const [NumberFlowComponent, setNumberFlowComponent] = useState<NumberFlowComponentType | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const now = new Date();
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const firstOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

      const pad = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const dateFrom = pad(firstOfMonth);
      const dateTo = pad(now);
      const lastMonthFrom = pad(firstOfLastMonth);
      const lastMonthTo = pad(lastOfLastMonth);

      const [monthData, lastMonthData] = await Promise.all([
        invoiceApi.getStats({ status: "FINAL", dateFrom, dateTo }),
        invoiceApi.getStats({ status: "FINAL", dateFrom: lastMonthFrom, dateTo: lastMonthTo }),
      ]);

      startTransition(() => {
        setStats({
          invoicesThisMonth: monthData.total,
          totalThisMonth: monthData.sumTotalAmount,
          invoicesLastMonth: lastMonthData.total,
          totalLastMonth: lastMonthData.sumTotalAmount,
        });
      });
    } catch (err) {
      console.error("Failed to fetch stats:", err);
      void import("sonner")
        .then(({ toast }) => {
          toast.error("Failed to load stats");
        })
        .catch(() => {});
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTeamUsers = useCallback(async () => {
    try {
      const creatorStats = await invoiceApi.getCreatorStats();
      startTransition(() => {
        setTeamUsers(creatorStats.users);
      });
    } catch (err) {
      console.error("Failed to fetch team activity:", err);
    } finally {
      setTeamLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchStats();
  }, [fetchStats]);

  const refreshStats = useCallback(() => {
    void fetchStats();
    void fetchTeamUsers();
  }, [fetchStats, fetchTeamUsers]);

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

    void import("@number-flow/react")
      .then((module) => {
        setNumberFlowComponent(() => module.default);
      })
      .catch(() => {});
  }, [detailsReady]);

  useEffect(() => {
    if (!detailsReady) {
      return;
    }

    void fetchTeamUsers();
  }, [detailsReady, fetchTeamUsers]);

  useDeferredDashboardRealtime(
    ["invoice-changed", "quote-changed"],
    refreshStats,
    { enabled: detailsReady },
  );

  const invoiceDelta = (stats?.invoicesThisMonth ?? 0) - (stats?.invoicesLastMonth ?? 0);
  const totalPctChange = stats?.totalLastMonth
    ? Math.round(((stats.totalThisMonth - stats.totalLastMonth) / stats.totalLastMonth) * 100)
    : null;

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Card key={i} className="card-hover">
            <CardContent className="pt-4">
              <div className="skeleton h-3 w-24 mb-3" />
              <div className="skeleton h-8 w-16 mb-3" />
              <div className="skeleton h-1.5 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {/* Invoices This Month */}
      <div className="dashboard-enter dashboard-enter-1">
      <Card className="card-hover">
        <CardContent className="pt-4">
          <div className="flex items-start justify-between">
            <p className="text-[11px] font-medium text-muted-foreground">Invoices This Month</p>
            {invoiceDelta !== 0 && (
              <span className={cn(
                "text-[10px] font-semibold px-1.5 py-0.5 rounded",
                invoiceDelta > 0
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400"
                  : "bg-red-50 text-red-700 dark:bg-red-500/20 dark:text-red-400"
              )}>
                {invoiceDelta > 0 ? "+" : ""}{invoiceDelta}
              </span>
            )}
          </div>
          <p className="text-[26px] font-extrabold tracking-tight tabular-nums mt-1">
            {NumberFlowComponent ? (
              <NumberFlowComponent
                value={stats?.invoicesThisMonth ?? 0}
                transformTiming={{ duration: 750, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }}
              />
            ) : (
              formatCount(stats?.invoicesThisMonth ?? 0)
            )}
          </p>
          <div className="flex items-end gap-[3px] mt-3 h-6">
            {[30, 55, 40, 70, 50, 100].map((h, i, arr) => (
              <div
                key={i}
                className={cn(
                  "flex-1 rounded-sm bar-grow",
                  i === arr.length - 1 ? "bg-primary" : "bg-primary/15"
                )}
                style={{ height: `${h}%`, animationDelay: `${i * 80}ms` }}
              />
            ))}
          </div>
        </CardContent>
      </Card>
      </div>

      {/* Total This Month */}
      <div className="dashboard-enter dashboard-enter-2">
      <Card className="card-hover">
        <CardContent className="pt-4">
          <div className="flex items-start justify-between">
            <p className="text-[11px] font-medium text-muted-foreground">Total This Month</p>
            {totalPctChange !== null && totalPctChange !== 0 && (
              <span className={cn(
                "text-[10px] font-semibold px-1.5 py-0.5 rounded",
                totalPctChange > 0
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400"
                  : "bg-red-50 text-red-700 dark:bg-red-500/20 dark:text-red-400"
              )}>
                {totalPctChange > 0 ? "+" : ""}{totalPctChange}%
              </span>
            )}
          </div>
          <p className="text-[26px] font-extrabold tracking-tight tabular-nums mt-1">
            {NumberFlowComponent ? (
              <NumberFlowComponent
                value={Number(stats?.totalThisMonth ?? 0)}
                format={{ style: "currency", currency: "USD", minimumFractionDigits: 2 }}
                transformTiming={{ duration: 750, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }}
              />
            ) : (
              formatAmount(stats?.totalThisMonth ?? 0)
            )}
          </p>
          <div className="mt-3.5 h-1 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full progress-fill"
              style={{ width: `${Math.min(100, Math.max(5, ((stats?.totalThisMonth ?? 0) / Math.max(stats?.totalLastMonth ?? 1, 1)) * 50))}%` }}
            />
          </div>
        </CardContent>
      </Card>
      </div>

      {/* Team Activity (compact) */}
      <div className="dashboard-enter dashboard-enter-3">
      <Card className="card-hover">
        <CardContent className="pt-4">
          <div className="flex items-start justify-between mb-2">
            <p className="text-[11px] font-medium text-muted-foreground">Team Activity</p>
            <span className="text-[10px] text-muted-foreground">This month</span>
          </div>
          {teamLoading ? (
            <div className="space-y-1.5">
              {[0, 1, 2].map((index) => (
                <div key={index} className="flex items-center gap-2">
                  <div className="skeleton h-[22px] w-[22px] rounded-md shrink-0" />
                  <div className="skeleton h-3 w-20 flex-1" />
                  <div className="skeleton h-3 w-16 shrink-0" />
                </div>
              ))}
            </div>
          ) : teamUsers.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">No activity yet</p>
          ) : (
            <div className="space-y-1.5 max-h-[88px] overflow-y-auto">
              {teamUsers.map((user) => {
                const isMine = user.id === currentUserId;
                return (
                  <div key={user.id} className="flex items-center gap-2">
                    <div className={cn(
                      "flex items-center justify-center w-[22px] h-[22px] rounded-md text-[8px] font-bold shrink-0",
                      isMine ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                    )}>
                      {getInitials(user.name)}
                    </div>
                    <span className={cn(
                      "text-[11px] font-medium truncate flex-1",
                      isMine && "text-primary"
                    )}>
                      {isMine ? "You" : user.name.split(" ")[0]}
                    </span>
                    <span className="text-[11px] font-bold tabular-nums shrink-0">
                      {formatAmount(user.totalAmount)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
