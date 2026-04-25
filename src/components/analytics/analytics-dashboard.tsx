"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AnalyticsResponse, FinanceAnalytics, OperationsAnalytics } from "@/domains/analytics/types";
import { getDateKeyInLosAngeles, shiftDateKey } from "@/lib/date-utils";

const FinanceDashboard = dynamic(
  () => import("./finance-dashboard").then((m) => m.FinanceDashboard),
  { ssr: false },
);
const OperationsDashboard = dynamic(
  () => import("./operations-dashboard").then((m) => m.OperationsDashboard),
  { ssr: false },
);

type AnalyticsTab = "operations" | "finance";

function getDefaultDateRange() {
  const dateTo = getDateKeyInLosAngeles();
  return {
    dateFrom: shiftDateKey(dateTo, { years: -1 }),
    dateTo,
  };
}

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      {[1, 2, 3, 4].map((index) => (
        <Card key={index}>
          <CardHeader>
            <div className="h-5 w-40 motion-safe:animate-pulse rounded bg-muted" />
            <div className="h-4 w-64 motion-safe:animate-pulse rounded bg-muted" />
          </CardHeader>
          <CardContent>
            <div className="h-[260px] motion-safe:animate-pulse rounded bg-muted" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function toFinanceAnalytics(data: AnalyticsResponse): FinanceAnalytics {
  return {
    summary: data.summary,
    byCategory: data.byCategory,
    byMonth: data.byMonth,
    byDepartment: data.byDepartment,
    trend: data.trend,
    byUser: data.byUser,
  };
}

export function AnalyticsDashboard({
  initialData = null,
  initialDateFrom,
  initialDateTo,
}: {
  initialData?: AnalyticsResponse | null;
  initialDateFrom?: string;
  initialDateTo?: string;
}) {
  const defaults = getDefaultDateRange();
  const [dateFrom, setDateFrom] = useState(initialDateFrom ?? defaults.dateFrom);
  const [dateTo, setDateTo] = useState(initialDateTo ?? defaults.dateTo);
  const [activeTab, setActiveTab] = useState<AnalyticsTab>("operations");
  const [operationsData, setOperationsData] = useState<OperationsAnalytics | null>(
    initialData?.operations ?? null,
  );
  const [financeData, setFinanceData] = useState<FinanceAnalytics | null>(
    initialData ? toFinanceAnalytics(initialData) : null,
  );
  const [operationsRangeKey, setOperationsRangeKey] = useState<string | null>(
    initialData ? `${initialDateFrom ?? defaults.dateFrom}|${initialDateTo ?? defaults.dateTo}` : null,
  );
  const [financeRangeKey, setFinanceRangeKey] = useState<string | null>(
    initialData ? `${initialDateFrom ?? defaults.dateFrom}|${initialDateTo ?? defaults.dateTo}` : null,
  );
  const [loadingTab, setLoadingTab] = useState<AnalyticsTab | null>(() => initialData === null ? "operations" : null);
  const [error, setError] = useState<string | null>(null);
  const currentRangeKey = `${dateFrom}|${dateTo}`;
  const activeDataIsFresh = activeTab === "operations"
    ? operationsData !== null && operationsRangeKey === currentRangeKey
    : financeData !== null && financeRangeKey === currentRangeKey;
  const loading = loadingTab === activeTab && !activeDataIsFresh;

  useEffect(() => {
    if (dateFrom && dateTo && dateFrom > dateTo) {
      setOperationsData(null);
      setFinanceData(null);
      setOperationsRangeKey(null);
      setFinanceRangeKey(null);
      setLoadingTab(null);
      setError("dateFrom must be less than or equal to dateTo");
      return;
    }

    if (activeDataIsFresh) {
      setLoadingTab(null);
      return;
    }

    const controller = new AbortController();

    async function fetchAnalytics() {
      const tab = activeTab;
      setLoadingTab(tab);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (dateFrom) params.set("dateFrom", dateFrom);
        if (dateTo) params.set("dateTo", dateTo);
        const endpoint = tab === "operations" ? "/api/analytics/operations" : "/api/analytics/finance";
        const res = await fetch(`${endpoint}?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error("Failed to fetch analytics");
        const json = await res.json();
        if (tab === "operations") {
          setOperationsData(json as OperationsAnalytics);
          setOperationsRangeKey(currentRangeKey);
        } else {
          setFinanceData(json as FinanceAnalytics);
          setFinanceRangeKey(currentRangeKey);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        if (!controller.signal.aborted) {
          setLoadingTab((current) => (current === activeTab ? null : current));
        }
      }
    }

    fetchAnalytics();
    return () => controller.abort();
  }, [
    activeDataIsFresh,
    activeTab,
    currentRangeKey,
    dateFrom,
    dateTo,
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-balance sm:text-3xl">Analytics</h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Switch between finance tracking and day-to-day operations insights. The new operations view is read-only and grounded in the current Supabase mirror.
          </p>
        </div>

        <div className="grid w-full gap-3 sm:w-auto sm:grid-flow-col sm:auto-cols-max sm:items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="dateFrom">
              From
            </label>
            <input
              id="dateFrom"
              name="dateFrom"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="dateTo">
              To
            </label>
            <input
              id="dateTo"
              name="dateTo"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <LoadingSkeleton />
      ) : (
        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as AnalyticsTab)}
          className="gap-6"
        >
          <TabsList variant="default" className="w-fit">
            <TabsTrigger value="operations">Operations</TabsTrigger>
            <TabsTrigger value="finance">Finance</TabsTrigger>
          </TabsList>

          {activeTab === "operations" ? (
            <TabsContent value="operations">
              {operationsData && operationsRangeKey === currentRangeKey ? (
                <OperationsDashboard data={operationsData} />
              ) : null}
            </TabsContent>
          ) : null}
          {activeTab === "finance" ? (
            <TabsContent value="finance">
              {financeData && financeRangeKey === currentRangeKey ? (
                <FinanceDashboard data={financeData} />
              ) : null}
            </TabsContent>
          ) : null}
        </Tabs>
      )}
    </div>
  );
}
