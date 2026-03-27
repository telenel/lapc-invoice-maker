"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatsData {
  invoicesThisMonth: number;
  totalThisMonth: number;
  pendingDrafts: number;
  invoicesLastMonth: number;
  totalLastMonth: number;
}

export function StatsCards() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const now = new Date();
        const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const firstOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

        const dateFrom = firstOfMonth.toISOString().split("T")[0];
        const dateTo = now.toISOString().split("T")[0];
        const lastMonthFrom = firstOfLastMonth.toISOString().split("T")[0];
        const lastMonthTo = lastOfLastMonth.toISOString().split("T")[0];

        const [monthRes, lastMonthRes, draftsRes] = await Promise.all([
          fetch(`/api/invoices?status=FINAL&createdFrom=${dateFrom}&createdTo=${dateTo}&statsOnly=true`),
          fetch(`/api/invoices?status=FINAL&createdFrom=${lastMonthFrom}&createdTo=${lastMonthTo}&statsOnly=true`),
          fetch(`/api/invoices?status=DRAFT&statsOnly=true`),
        ]);

        const monthData = await monthRes.json();
        const lastMonthData = await lastMonthRes.json();
        const draftsData = await draftsRes.json();

        setStats({
          invoicesThisMonth: monthData.total,
          totalThisMonth: monthData.sumTotalAmount,
          pendingDrafts: draftsData.total,
          invoicesLastMonth: lastMonthData.total,
          totalLastMonth: lastMonthData.sumTotalAmount,
        });
      } catch (err) {
        console.error("Failed to fetch stats:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, []);

  const invoiceDelta = (stats?.invoicesThisMonth ?? 0) - (stats?.invoicesLastMonth ?? 0);
  const totalPctChange = stats?.totalLastMonth
    ? Math.round(((stats.totalThisMonth - stats.totalLastMonth) / stats.totalLastMonth) * 100)
    : null;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {/* Invoices This Month */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-start justify-between">
            <p className="text-[11px] font-medium text-muted-foreground">Invoices This Month</p>
            {!loading && invoiceDelta !== 0 && (
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
            {loading ? "—" : stats?.invoicesThisMonth ?? 0}
          </p>
          {!loading && (
            <div className="flex items-end gap-[3px] mt-3 h-6">
              {[30, 55, 40, 70, 50, 100].map((h, i, arr) => (
                <div
                  key={i}
                  className={cn(
                    "flex-1 rounded-sm",
                    i === arr.length - 1 ? "bg-primary" : "bg-primary/15"
                  )}
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Total This Month */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-start justify-between">
            <p className="text-[11px] font-medium text-muted-foreground">Total This Month</p>
            {!loading && totalPctChange !== null && totalPctChange !== 0 && (
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
            {loading ? "—" : `$${Number(stats?.totalThisMonth ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          </p>
          {!loading && (
            <div className="mt-3.5 h-1 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full"
                style={{ width: `${Math.min(100, Math.max(5, ((stats?.totalThisMonth ?? 0) / Math.max(stats?.totalLastMonth ?? 1, 1)) * 50))}%` }}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pending Drafts */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-start justify-between">
            <p className="text-[11px] font-medium text-muted-foreground">Pending Drafts</p>
            {!loading && (stats?.pendingDrafts ?? 0) > 0 && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400">
                Action needed
              </span>
            )}
          </div>
          <p className="text-[26px] font-extrabold tracking-tight tabular-nums mt-1">
            {loading ? "—" : stats?.pendingDrafts ?? 0}
          </p>
          {!loading && (
            <div className="flex gap-1 mt-3">
              {Array.from({ length: 5 }, (_, i) => (
                <div
                  key={i}
                  className={cn(
                    "w-2 h-2 rounded-full",
                    i < (stats?.pendingDrafts ?? 0) ? "bg-amber-500" : "bg-muted"
                  )}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
