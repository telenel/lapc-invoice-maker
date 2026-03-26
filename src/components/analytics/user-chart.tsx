"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface UserData {
  user: string;
  count: number;
  total: number;
}

interface UserChartProps {
  data: UserData[];
}

function formatCurrency(value: number) {
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function UserChart({ data }: UserChartProps) {
  const chartData = [...data]
    .sort((a, b) => b.total - a.total)
    .map((d) => ({
      user: d.user.length > 20 ? d.user.slice(0, 18) + "…" : d.user,
      count: d.count,
      total: d.total,
    }));

  const barHeight = 36;
  const chartHeight = Math.max(200, chartData.length * barHeight + 60);

  return (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
      >
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
        <XAxis type="number" tickFormatter={formatCurrency} tick={{ fontSize: 11 }} />
        <YAxis type="category" dataKey="user" tick={{ fontSize: 11 }} width={120} />
        <Tooltip
          formatter={(value, name) =>
            name === "total"
              ? [formatCurrency(Number(value)), "Total Spend"]
              : [value, "Invoices"]
          }
        />
        <Legend />
        <Bar dataKey="total" name="Total Spend" fill="#3b82f6" radius={[0, 4, 4, 0]} />
        <Bar dataKey="count" name="Invoices" fill="#10b981" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
