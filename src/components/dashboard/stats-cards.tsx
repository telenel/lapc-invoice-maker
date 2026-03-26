"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface StatsData {
  invoicesThisMonth: number;
  totalThisMonth: number;
  pendingDrafts: number;
}

export function StatsCards() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const now = new Date();
        const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const dateFrom = firstOfMonth.toISOString().split("T")[0];
        const dateTo = now.toISOString().split("T")[0];

        const [monthRes, draftsRes] = await Promise.all([
          fetch(
            `/api/invoices?dateFrom=${dateFrom}&dateTo=${dateTo}&pageSize=1000`
          ),
          fetch(`/api/invoices?status=DRAFT&pageSize=1000`),
        ]);

        const monthData = await monthRes.json();
        const draftsData = await draftsRes.json();

        const totalThisMonth = (monthData.invoices as { totalAmount: string | number }[]).reduce(
          (sum: number, inv: { totalAmount: string | number }) => sum + Number(inv.totalAmount),
          0
        );

        setStats({
          invoicesThisMonth: monthData.total,
          totalThisMonth,
          pendingDrafts: draftsData.total,
        });
      } catch (err) {
        console.error("Failed to fetch stats:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, []);

  const cards = [
    {
      title: "Invoices This Month",
      value: loading ? "—" : String(stats?.invoicesThisMonth ?? 0),
    },
    {
      title: "Total This Month",
      value: loading
        ? "—"
        : `$${Number(stats?.totalThisMonth ?? 0).toFixed(2)}`,
    },
    {
      title: "Pending Drafts",
      value: loading ? "—" : String(stats?.pendingDrafts ?? 0),
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader>
            <CardTitle>{card.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{card.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
