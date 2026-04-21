"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AnalyticsResponse } from "@/domains/analytics/types";
import { getDateKeyInLosAngeles, shiftDateKey } from "@/lib/date-utils";
import { FinanceDashboard } from "./finance-dashboard";
import { OperationsDashboard } from "./operations-dashboard";

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
  const [data, setData] = useState<AnalyticsResponse | null>(initialData);
  const [loading, setLoading] = useState(() => initialData === null);
  const [error, setError] = useState<string | null>(null);
  const skippedInitialFetchRef = useRef(initialData !== null);
  const initialRangeKey = `${initialDateFrom ?? defaults.dateFrom}|${initialDateTo ?? defaults.dateTo}`;
  const currentRangeKey = `${dateFrom}|${dateTo}`;
  const hasOperations = Boolean(data && (data as Partial<AnalyticsResponse>).operations);

  useEffect(() => {
    if (dateFrom && dateTo && dateFrom > dateTo) {
      setData(null);
      setLoading(false);
      setError("dateFrom must be less than or equal to dateTo");
      return;
    }

    if (skippedInitialFetchRef.current && currentRangeKey === initialRangeKey) {
      skippedInitialFetchRef.current = false;
      return;
    }

    async function fetchAnalytics() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (dateFrom) params.set("dateFrom", dateFrom);
        if (dateTo) params.set("dateTo", dateTo);
        const res = await fetch(`/api/analytics?${params.toString()}`);
        if (!res.ok) throw new Error("Failed to fetch analytics");
        const json = await res.json();
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }

    fetchAnalytics();
  }, [currentRangeKey, dateFrom, dateTo, initialRangeKey]);

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
      ) : data ? (
        <Tabs defaultValue={hasOperations ? "operations" : "finance"} className="gap-6">
          <TabsList variant="default" className="w-fit">
            {hasOperations ? <TabsTrigger value="operations">Operations</TabsTrigger> : null}
            <TabsTrigger value="finance">Finance</TabsTrigger>
          </TabsList>

          {hasOperations ? (
            <TabsContent value="operations">
              <OperationsDashboard data={data.operations} />
            </TabsContent>
          ) : null}
          <TabsContent value="finance">
            <FinanceDashboard data={data} />
          </TabsContent>
        </Tabs>
      ) : null}
    </div>
  );
}
