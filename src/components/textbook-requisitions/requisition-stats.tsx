"use client";

import { cn } from "@/lib/utils";
import { useRequisitionStats } from "@/domains/textbook-requisition/hooks";
import type { RequisitionStats as RequisitionStatsData } from "@/domains/textbook-requisition/types";

export function RequisitionStats({
  initialData = null,
}: {
  initialData?: RequisitionStatsData | null;
}) {
  const { data } = useRequisitionStats(initialData);

  if (!data) return null;

  const cards = [
    { label: "Total", value: data.total, color: "text-foreground" },
    { label: "Pending", value: data.pending, color: "text-amber-600 dark:text-amber-400" },
    { label: "Ordered", value: data.ordered, color: "text-blue-600 dark:text-blue-400" },
    { label: "On Shelf", value: data.onShelf, color: "text-green-600 dark:text-green-400" },
  ];

  if (data.needsAttention > 0) {
    cards.push({
      label: "Needs Attention",
      value: data.needsAttention,
      color: "text-red-600 dark:text-red-400",
    });
  }

  return (
    <div className={cn("grid gap-3", cards.length <= 4 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2 sm:grid-cols-5")}>
      {cards.map((card) => (
        <div key={card.label} className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">{card.label}</p>
          <p className={cn("text-2xl font-bold tabular-nums", card.color)}>
            {card.value}
          </p>
        </div>
      ))}
    </div>
  );
}
