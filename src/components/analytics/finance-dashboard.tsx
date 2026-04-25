"use client";

import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { FinanceAnalytics } from "@/domains/analytics/types";

const CategoryChart = dynamic(() => import("./category-chart").then((m) => m.CategoryChart), { ssr: false });
const MonthlyTotalsChart = dynamic(() => import("./monthly-totals-chart").then((m) => m.MonthlyTotalsChart), { ssr: false });
const DepartmentSpendChart = dynamic(() => import("./department-spend-chart").then((m) => m.DepartmentSpendChart), { ssr: false });
const InvoiceTrendChart = dynamic(() => import("./invoice-trend-chart").then((m) => m.InvoiceTrendChart), { ssr: false });
const UserChart = dynamic(() => import("./user-chart").then((m) => m.UserChart), { ssr: false });

export function FinanceDashboard({ data }: { data: FinanceAnalytics }) {
  return (
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
  );
}
