"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";

interface MonthlyData {
  month: string;
  count: number;
  total: number;
  finalizedTotal: number;
  expectedTotal: number;
}

interface MonthlyTotalsChartProps {
  data: MonthlyData[];
}

function formatCurrency(value: number) {
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatMonth(month: string) {
  const [year, m] = month.split("-");
  const date = new Date(Number(year), Number(m) - 1, 1);
  return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

export function MonthlyTotalsChart({ data }: MonthlyTotalsChartProps) {
  const chartData = data.map((d) => ({
    month: formatMonth(d.month),
    finalizedTotal: d.finalizedTotal,
    expectedTotal: d.expectedTotal,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis dataKey="month" tick={{ fontSize: 12 }} />
        <YAxis tickFormatter={formatCurrency} tick={{ fontSize: 11 }} width={70} />
        <Tooltip
          formatter={(value, name) => [
            formatCurrency(Number(value)),
            name === "expectedTotal" ? "Expected" : "Finalized",
          ]}
        />
        <Bar dataKey="finalizedTotal" name="Finalized" fill="#2563eb" radius={[4, 4, 0, 0]} />
        <Bar dataKey="expectedTotal" name="Expected" fill="#f59e0b" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
