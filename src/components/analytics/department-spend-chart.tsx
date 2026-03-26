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

interface DepartmentData {
  department: string;
  count: number;
  total: number;
}

interface DepartmentSpendChartProps {
  data: DepartmentData[];
}

function formatCurrency(value: number) {
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function DepartmentSpendChart({ data }: DepartmentSpendChartProps) {
  const chartData = [...data]
    .sort((a, b) => a.total - b.total)
    .map((d) => ({
      department: d.department.length > 20 ? d.department.slice(0, 18) + "…" : d.department,
      total: d.total,
    }));

  const barHeight = 32;
  const chartHeight = Math.max(200, chartData.length * barHeight + 40);

  return (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
      >
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
        <XAxis type="number" tickFormatter={formatCurrency} tick={{ fontSize: 11 }} />
        <YAxis type="category" dataKey="department" tick={{ fontSize: 11 }} width={120} />
        <Tooltip formatter={(value: number) => [formatCurrency(value), "Total"]} />
        <Bar dataKey="total" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
