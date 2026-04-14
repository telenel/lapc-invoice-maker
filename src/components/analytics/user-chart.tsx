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
  finalizedTotal: number;
  expectedTotal: number;
}

interface UserChartProps {
  data: UserData[];
}

function formatCurrency(value: number) {
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function UserChart({ data }: UserChartProps) {
  const chartData = [...data]
    .sort((a, b) => (b.finalizedTotal + b.expectedTotal) - (a.finalizedTotal + a.expectedTotal))
    .map((d) => ({
      user: d.user.length > 20 ? d.user.slice(0, 18) + "…" : d.user,
      finalizedTotal: d.finalizedTotal,
      expectedTotal: d.expectedTotal,
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
            name === "expectedTotal"
              ? [formatCurrency(Number(value)), "Expected"]
              : [formatCurrency(Number(value)), "Finalized"]
          }
        />
        <Legend />
        <Bar dataKey="finalizedTotal" name="Finalized" fill="#3b82f6" radius={[0, 4, 4, 0]} />
        <Bar dataKey="expectedTotal" name="Expected" fill="#f59e0b" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
