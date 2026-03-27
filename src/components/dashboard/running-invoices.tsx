"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatAmount } from "@/lib/formatters";

interface RunningInvoice {
  id: string;
  runningTitle: string | null;
  department: string;
  totalAmount: string | number;
  staff: { name: string };
  items: { id: string }[];
}

export function RunningInvoices() {
  const [invoices, setInvoices] = useState<RunningInvoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/invoices?status=DRAFT&isRunning=true&pageSize=50")
      .then((r) => r.ok ? r.json() : { invoices: [] })
      .then((data) => setInvoices(data.invoices || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading || invoices.length === 0) return null;

  return (
    <Card>
      <CardHeader className="border-b border-border/50">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-bold">Running Invoices</CardTitle>
          <Badge variant="info" className="tabular-nums">{invoices.length}</Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div>
          {invoices.map((inv, i) => (
            <Link
              key={inv.id}
              href={`/invoices/${inv.id}/edit`}
              className={`flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors ${i < invoices.length - 1 ? "border-b border-border/30" : ""}`}
            >
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold truncate">
                  {inv.runningTitle || "Untitled Running Invoice"}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {inv.staff.name} · {inv.department} · {inv.items.length} item{inv.items.length !== 1 ? "s" : ""}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[13px] font-bold tabular-nums">{formatAmount(inv.totalAmount)}</p>
                <p className="text-[10px] text-primary font-medium">Add Items →</p>
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
