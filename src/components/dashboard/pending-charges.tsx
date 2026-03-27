"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatAmount, getInitials } from "@/lib/formatters";

interface PendingUser {
  id: string;
  name: string;
  invoiceCount: number;
  totalAmount: number;
}

export function PendingCharges() {
  const [users, setUsers] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/invoices?statsOnly=true&groupBy=creator&status=PENDING_CHARGE")
      .then((r) => r.ok ? r.json() : { users: [] })
      .then((data) => setUsers(data.users || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const totalCount = users.reduce((sum, u) => sum + u.invoiceCount, 0);

  if (loading || users.length === 0) return null;

  return (
    <Card>
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
              href={`/invoices?status=PENDING_CHARGE&search=${encodeURIComponent(user.name)}`}
              className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-muted/50 transition-colors"
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
