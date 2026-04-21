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

export function formatHourLabel(hour: number) {
  const normalized = hour % 24;
  const period = normalized >= 12 ? "PM" : "AM";
  const displayHour = normalized % 12 === 0 ? 12 : normalized % 12;
  return `${displayHour} ${period}`;
}

export function HourlySalesChart({
  data,
}: {
  data: OperationsAnalytics["salesPatterns"]["hourly"];
}) {
  const chartData = data.map((point) => ({
    ...point,
    hourLabel: formatHourLabel(point.hour),
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={chartData} margin={{ top: 8, right: 12, left: 8, bottom: 24 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis dataKey="hourLabel" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" interval={1} height={54} />
        <YAxis tick={{ fontSize: 11 }} width={40} />
        <Tooltip
          formatter={(value) => [Number(value).toLocaleString("en-US"), "Receipts"]}
        />
        <Bar dataKey="receipts" fill="#2563eb" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
