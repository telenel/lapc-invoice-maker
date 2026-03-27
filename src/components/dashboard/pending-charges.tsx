"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface PendingInvoice {
  id: string;
  department: string;
  totalAmount: string | number;
  date: string;
  creator: { id: string; name: string; username: string };
}

interface PendingResponse {
  invoices: PendingInvoice[];
  total: number;
}

function formatAmount(amount: string | number): string {
  return `$${Number(amount).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function PendingCharges() {
  const [invoices, setInvoices] = useState<PendingInvoice[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPending() {
      try {
        const res = await fetch(
          "/api/invoices?status=PENDING_CHARGE&pageSize=10&sortBy=createdAt&sortDir=asc"
        );
        if (res.ok) {
          const data: PendingResponse = await res.json();
          setInvoices(data.invoices);
          setTotal(data.total);
        }
      } catch {
        // Silently fail — dashboard card is non-critical
      } finally {
        setLoading(false);
      }
    }
    fetchPending();
  }, []);

  if (loading || total === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2 border-b border-border/50">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">
            Pending POS Charges
          </CardTitle>
          <Badge variant="warning" className="tabular-nums">
            {total}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {invoices.map((inv) => (
            <Link
              key={inv.id}
              href={`/invoices/${inv.id}/edit`}
              className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-accent transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="font-medium">{inv.creator.name}</span>
                <span className="text-muted-foreground">{inv.department}</span>
              </div>
              <div className="flex items-center gap-3 text-muted-foreground">
                <span>{formatDate(inv.date)}</span>
                <span className="font-medium text-foreground tabular-nums">
                  {formatAmount(inv.totalAmount)}
                </span>
              </div>
            </Link>
          ))}
        </div>
        {total > 10 && (
          <Link
            href="/invoices?status=PENDING_CHARGE"
            className="block text-center text-xs text-muted-foreground hover:text-foreground mt-3 pt-2 border-t border-border"
          >
            View all {total} pending charges
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
