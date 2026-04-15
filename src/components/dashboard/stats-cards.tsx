"use client";

import { startTransition, useCallback, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatAmount, getInitials } from "@/lib/formatters";
import type { CreatorStatEntry } from "@/domains/invoice/types";
import { useDashboardBootstrapData } from "./dashboard-bootstrap-provider";
import type { DashboardStatsData, DashboardStatsSummary } from "@/domains/dashboard/types";
import { useDeferredDashboardRealtime } from "./use-deferred-dashboard-realtime";

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
  const dashboardBootstrap = useDashboardBootstrapData();
  const initialStats = dashboardBootstrap?.stats ?? null;
  const [stats, setStats] = useState<DashboardStatsSummary | null>(
    initialStats?.summary ?? null,
  );
  const [teamUsers, setTeamUsers] = useState<CreatorStatEntry[]>(
    initialStats?.teamUsers ?? [],
  );
  const [loading, setLoading] = useState(() => initialStats === null);
  const [teamLoading, setTeamLoading] = useState(() => initialStats === null);
  const [detailsReady, setDetailsReady] = useState(false);
  const [NumberFlowComponent, setNumberFlowComponent] = useState<NumberFlowComponentType | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch("/api/dashboard/stats", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Failed to load dashboard stats");
      }
      const data = (await response.json()) as DashboardStatsData;

      startTransition(() => {
        setStats(data.summary);
        setTeamUsers(data.teamUsers);
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
      setTeamLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialStats !== null) {
      return;
    }

    void fetchStats();
  }, [fetchStats, initialStats]);

  const refreshStats = useCallback(() => {
    void fetchStats();
  }, [fetchStats]);

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
    if (!detailsReady || initialStats !== null) {
      return;
    }

    void fetchStats();
  }, [detailsReady, fetchStats, initialStats]);

  useDeferredDashboardRealtime(
    ["invoice-changed", "quote-changed"],
    refreshStats,
    { enabled: detailsReady },
  );

  const invoiceDelta = (stats?.invoicesThisMonth ?? 0) - (stats?.invoicesLastMonth ?? 0);

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
      {/* Finalized This Month */}
      <div className="dashboard-enter dashboard-enter-1">
      <Card className="card-hover">
        <CardContent className="pt-4">
          <div className="flex items-start justify-between">
            <p className="text-[11px] font-medium text-muted-foreground">Finalized This Month</p>
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
                value={Number(stats?.totalThisMonth ?? 0)}
                format={{ style: "currency", currency: "USD", minimumFractionDigits: 2 }}
                transformTiming={{ duration: 750, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }}
              />
            ) : (
              formatAmount(stats?.totalThisMonth ?? 0)
            )}
          </p>
          <p className="mt-2 text-[11px] text-muted-foreground">
            {formatCount(stats?.invoicesThisMonth ?? 0)} finalized invoice{(stats?.invoicesThisMonth ?? 0) !== 1 ? "s" : ""}
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

      {/* Expected Pipeline */}
      <div className="dashboard-enter dashboard-enter-2">
      <Card className="card-hover">
        <CardContent className="pt-4">
          <div className="flex items-start justify-between">
            <p className="text-[11px] font-medium text-muted-foreground">Expected Pipeline</p>
            {(stats?.expectedCount ?? 0) > 0 && (
              <span className={cn(
                "text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400"
              )}>
                {stats?.expectedCount ?? 0} open
              </span>
            )}
          </div>
          <p className="text-[26px] font-extrabold tracking-tight tabular-nums mt-1">
            {NumberFlowComponent ? (
              <NumberFlowComponent
                value={Number(stats?.expectedTotal ?? 0)}
                format={{ style: "currency", currency: "USD", minimumFractionDigits: 2 }}
                transformTiming={{ duration: 750, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }}
              />
            ) : (
              formatAmount(stats?.expectedTotal ?? 0)
            )}
          </p>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Draft and running invoices plus active quotes
          </p>
          <div className="mt-3.5 h-1 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-400"
              style={{ width: `${Math.min(100, Math.max(5, (stats?.expectedCount ?? 0) * 10))}%` }}
            />
          </div>
        </CardContent>
      </Card>
      </div>

      {/* Team Activity (compact) */}
      <div className="dashboard-enter dashboard-enter-3">
      <Card className="card-hover">
        <CardContent className="pt-4">
          <div className="mb-2">
            <p className="text-[11px] font-medium text-muted-foreground">Team Activity</p>
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
              {teamUsers.map((user, index) => {
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
                      {user.name}
                      {isMine && <span className="ml-1 text-[10px] font-semibold">(You)</span>}
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
