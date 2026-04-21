"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { OperationsAnalytics } from "@/domains/analytics/types";

function formatCurrency(value: number) {
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatMonth(month: string) {
  const [year, value] = month.split("-");
  return new Date(Number(year), Number(value) - 1, 1).toLocaleDateString("en-US", {
    month: "short",
    year: "2-digit",
  });
}

export function MonthlySalesPatternsChart({
  data,
}: {
  data: OperationsAnalytics["salesPatterns"]["monthly"];
}) {
  const chartData = data.map((point) => ({
    ...point,
    monthLabel: formatMonth(point.month),
  }));

  return (
    <ResponsiveContainer width="100%" height={320}>
      <ComposedChart data={chartData} margin={{ top: 8, right: 12, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis dataKey="monthLabel" tick={{ fontSize: 12 }} />
        <YAxis yAxisId="revenue" tickFormatter={formatCurrency} tick={{ fontSize: 11 }} width={70} />
        <YAxis yAxisId="units" orientation="right" tick={{ fontSize: 11 }} width={40} />
        <Tooltip
          formatter={(value, name, item) => {
            if (name === "revenue") {
              return [formatCurrency(Number(value)), "Revenue"];
            }
            if (name === "units") {
              return [Number(value).toLocaleString("en-US"), "Units"];
            }

            return [value, item?.name ?? name];
          }}
        />
        <Bar yAxisId="revenue" dataKey="revenue" fill="#0f766e" radius={[6, 6, 0, 0]} />
        <Line yAxisId="units" dataKey="units" stroke="#1d4ed8" strokeWidth={2} dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
