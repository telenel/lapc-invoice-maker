"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";

interface TrendData {
  month: string;
  count: number;
  finalizedCount: number;
  expectedCount: number;
}

interface InvoiceTrendChartProps {
  data: TrendData[];
}

function formatMonth(month: string) {
  const [year, m] = month.split("-");
  const date = new Date(Number(year), Number(m) - 1, 1);
  return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

export function InvoiceTrendChart({ data }: InvoiceTrendChartProps) {
  const chartData = data.map((d) => ({
    month: formatMonth(d.month),
    finalizedCount: d.finalizedCount,
    expectedCount: d.expectedCount,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={chartData} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis dataKey="month" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
        <Tooltip
          formatter={(value, name) => [
            value,
            name === "expectedCount" ? "Expected Docs" : "Finalized Docs",
          ]}
        />
        <Line
          type="monotone"
          dataKey="finalizedCount"
          stroke="#10b981"
          strokeWidth={2}
          dot={{ r: 4 }}
          activeDot={{ r: 6 }}
        />
        <Line
          type="monotone"
          dataKey="expectedCount"
          stroke="#f59e0b"
          strokeWidth={2}
          dot={{ r: 4 }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
