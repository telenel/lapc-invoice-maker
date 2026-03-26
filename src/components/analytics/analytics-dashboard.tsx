"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CategoryChart } from "./category-chart";
import { MonthlyTotalsChart } from "./monthly-totals-chart";
import { DepartmentSpendChart } from "./department-spend-chart";
import { InvoiceTrendChart } from "./invoice-trend-chart";
import { UserChart } from "./user-chart";

interface AnalyticsData {
  byCategory: { category: string; count: number; total: number }[];
  byMonth: { month: string; count: number; total: number }[];
  byDepartment: { department: string; count: number; total: number }[];
  trend: { month: string; count: number }[];
  byUser: { user: string; count: number; total: number }[];
}

function getDefaultDateRange() {
  const to = new Date();
  const from = new Date();
  from.setFullYear(from.getFullYear() - 1);
  return {
    dateFrom: from.toISOString().split("T")[0],
    dateTo: to.toISOString().split("T")[0],
  };
}

export function AnalyticsDashboard() {
  const defaults = getDefaultDateRange();
  const [dateFrom, setDateFrom] = useState(defaults.dateFrom);
  const [dateTo, setDateTo] = useState(defaults.dateTo);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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
  }, [dateFrom, dateTo]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <h1 className="text-3xl font-bold">Analytics</h1>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground font-medium" htmlFor="dateFrom">
              From
            </label>
            <input
              id="dateFrom"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground font-medium" htmlFor="dateTo">
              To
            </label>
            <input
              id="dateTo"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
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
                <div className="h-5 w-40 animate-pulse rounded bg-muted" />
              </CardHeader>
              <CardContent>
                <div className="h-[300px] animate-pulse rounded bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : data ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Invoices by Category</CardTitle>
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
              <CardTitle>Top Departments by Spend</CardTitle>
            </CardHeader>
            <CardContent>
              <DepartmentSpendChart data={data.byDepartment} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Invoice Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <InvoiceTrendChart data={data.trend} />
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Invoices by User</CardTitle>
            </CardHeader>
            <CardContent>
              <UserChart data={data.byUser} />
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
