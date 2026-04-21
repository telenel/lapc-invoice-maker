"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { OperationsAnalytics } from "@/domains/analytics/types";

function formatCurrency(value: number) {
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function WeekdaySalesChart({
  data,
}: {
  data: OperationsAnalytics["salesPatterns"]["weekdays"];
}) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 12, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis dataKey="day" tick={{ fontSize: 12 }} />
        <YAxis tickFormatter={formatCurrency} tick={{ fontSize: 11 }} width={70} />
        <Tooltip
          formatter={(value, name) => {
            if (name === "revenue") {
              return [formatCurrency(Number(value)), "Revenue"];
            }

            return [Number(value).toLocaleString("en-US"), "Receipts"];
          }}
        />
        <Bar dataKey="revenue" fill="#b45309" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
