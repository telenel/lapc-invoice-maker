"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AnalyticsResponse } from "@/domains/analytics/types";

const CategoryChart = dynamic(() => import("./category-chart").then((m) => m.CategoryChart), { ssr: false });
const MonthlyTotalsChart = dynamic(() => import("./monthly-totals-chart").then((m) => m.MonthlyTotalsChart), { ssr: false });
const DepartmentSpendChart = dynamic(() => import("./department-spend-chart").then((m) => m.DepartmentSpendChart), { ssr: false });
const InvoiceTrendChart = dynamic(() => import("./invoice-trend-chart").then((m) => m.InvoiceTrendChart), { ssr: false });
const UserChart = dynamic(() => import("./user-chart").then((m) => m.UserChart), { ssr: false });

function getDefaultDateRange() {
  const to = new Date();
  const from = new Date();
  from.setFullYear(from.getFullYear() - 1);
  return {
    dateFrom: from.toISOString().split("T")[0],
    dateTo: to.toISOString().split("T")[0],
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
  const [data, setData] = useState<AnalyticsResponse | null>(initialData);
  const [loading, setLoading] = useState(() => initialData === null);
  const [error, setError] = useState<string | null>(null);
  const skippedInitialFetchRef = useRef(initialData !== null);
  const initialRangeKey = `${initialDateFrom ?? defaults.dateFrom}|${initialDateTo ?? defaults.dateTo}`;
  const currentRangeKey = `${dateFrom}|${dateTo}`;

  useEffect(() => {
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <h1 className="text-2xl font-bold text-balance sm:text-3xl">Analytics</h1>
        <div className="grid w-full gap-3 sm:w-auto sm:grid-flow-col sm:auto-cols-max sm:items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground font-medium" htmlFor="dateFrom">
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
            <label className="text-xs text-muted-foreground font-medium" htmlFor="dateTo">
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
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Card key={i}>
              <CardHeader>
                <div className="h-5 w-40 motion-safe:animate-pulse rounded bg-muted" />
              </CardHeader>
              <CardContent>
                <div className="h-[300px] motion-safe:animate-pulse rounded bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : data ? (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardHeader>
                <CardTitle>Finalized Total</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{data.summary.finalizedTotal.toLocaleString("en-US", { style: "currency", currency: "USD" })}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {data.summary.finalizedCount} finalized document{data.summary.finalizedCount !== 1 ? "s" : ""}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Expected Total</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{data.summary.expectedTotal.toLocaleString("en-US", { style: "currency", currency: "USD" })}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {data.summary.expectedCount} open document{data.summary.expectedCount !== 1 ? "s" : ""}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Combined Total</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{data.summary.total.toLocaleString("en-US", { style: "currency", currency: "USD" })}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Finalized plus active pipeline
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Tracked Documents</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{data.summary.count}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Included invoices and active quotes
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Documents by Category</CardTitle>
            </CardHeader>
            <CardContent>
              <CategoryChart data={data.byCategory} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Monthly Totals</CardTitle>
            </CardHeader>
            <CardContent>
              <MonthlyTotalsChart data={data.byMonth} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Department Totals</CardTitle>
            </CardHeader>
            <CardContent>
              <DepartmentSpendChart data={data.byDepartment} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Document Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <InvoiceTrendChart data={data.trend} />
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Totals by User</CardTitle>
            </CardHeader>
            <CardContent>
              <UserChart data={data.byUser} />
            </CardContent>
          </Card>
          </div>
        </div>
      ) : null}
    </div>
  );
}
