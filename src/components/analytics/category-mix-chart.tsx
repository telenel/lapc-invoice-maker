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

export function CategoryMixChart({
  data,
}: {
  data: OperationsAnalytics["productPerformance"]["categoryMix"];
}) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} layout="vertical" margin={{ top: 8, right: 12, left: 12, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis type="number" tickFormatter={formatCurrency} tick={{ fontSize: 11 }} />
        <YAxis type="category" dataKey="category" tick={{ fontSize: 11 }} width={100} />
        <Tooltip
          formatter={(value, name) => {
            if (name === "revenue") {
              return [formatCurrency(Number(value)), "Revenue"];
            }

            return [Number(value).toLocaleString("en-US"), "Units"];
          }}
        />
        <Bar dataKey="revenue" fill="#15803d" radius={[0, 6, 6, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
