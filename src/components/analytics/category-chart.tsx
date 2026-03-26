"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface CategoryData {
  category: string;
  count: number;
  total: number;
}

interface CategoryChartProps {
  data: CategoryData[];
}

const CATEGORY_COLORS: Record<string, string> = {
  COPY_TECH: "#3b82f6",
  CATERING: "#f59e0b",
  SUPPLIES: "#10b981",
  DEPARTMENT_PURCHASE: "#8b5cf6",
};

const CATEGORY_LABELS: Record<string, string> = {
  COPY_TECH: "CopyTech",
  CATERING: "Catering",
  SUPPLIES: "Supplies",
  DEPARTMENT_PURCHASE: "Dept Purchase",
};

export function CategoryChart({ data }: CategoryChartProps) {
  const chartData = data.map((d) => ({
    name: CATEGORY_LABELS[d.category] ?? d.category,
    value: d.count,
    category: d.category,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={3}
          dataKey="value"
          nameKey="name"
        >
          {chartData.map((entry) => (
            <Cell
              key={entry.category}
              fill={CATEGORY_COLORS[entry.category] ?? "#6b7280"}
            />
          ))}
        </Pie>
        <Tooltip formatter={(value: number) => [value, "Invoices"]} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
