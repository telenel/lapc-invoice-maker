"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

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
      borderClass: "border-l-4 border-l-primary",
    },
    {
      title: "Total This Month",
      value: loading
        ? "—"
        : `$${Number(stats?.totalThisMonth ?? 0).toFixed(2)}`,
      borderClass: "border-l-4 border-l-emerald-500",
    },
    {
      title: "Pending Drafts",
      value: loading ? "—" : String(stats?.pendingDrafts ?? 0),
      borderClass: "border-l-4 border-l-amber-500",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {cards.map((card) => (
        <Card key={card.title} className={cn(card.borderClass)}>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {card.title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tracking-tight tabular-nums">{card.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
