"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatAmount, getInitials } from "@/lib/formatters";
import { invoiceApi } from "@/domains/invoice/api-client";
import type { CreatorStatEntry } from "@/domains/invoice/types";
import { useSSE } from "@/lib/use-sse";

export function PendingCharges() {
  const [users, setUsers] = useState<CreatorStatEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPending = useCallback(() => {
    invoiceApi.getCreatorStats("PENDING_CHARGE")
      .then((data) => setUsers(data.users))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  useSSE("invoice-changed", fetchPending);

  const totalCount = users.reduce((sum, u) => sum + u.invoiceCount, 0);

  if (loading || users.length === 0) return null;

  return (
    <Card className="card-hover">
      <CardHeader className="pb-2 border-b border-border/50">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-bold">Pending POS Charges</CardTitle>
          <Badge variant="warning" className="tabular-nums">{totalCount}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-1 pt-2">
          {users.map((user) => (
            <Link
              key={user.id}
              href={`/invoices?status=PENDING_CHARGE&creatorId=${encodeURIComponent(user.id)}`}
              className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-muted/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="flex items-center justify-center w-[28px] h-[28px] rounded-lg bg-muted text-[9px] font-bold text-muted-foreground shrink-0">
                {getInitials(user.name)}
              </div>
              <span className="text-sm font-medium flex-1">{user.name}</span>
              <div className="text-right">
                <span className="text-sm font-bold tabular-nums">{formatAmount(user.totalAmount)}</span>
                <p className="text-[10px] text-muted-foreground">{user.invoiceCount} pending</p>
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
