"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatAmount } from "@/lib/formatters";
import { getInitials } from "@/lib/formatters";
import { invoiceApi } from "@/domains/invoice/api-client";
import type { CreatorStatEntry } from "@/domains/invoice/types";

export function TeamActivity() {
  const [users, setUsers] = useState<CreatorStatEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    invoiceApi.getCreatorStats()
      .then((data) => setUsers(data.users))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading || users.length === 0) return null;

  return (
    <Card>
      <CardHeader className="border-b border-border/50">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-bold">Team Activity</CardTitle>
          <span className="text-[11px] text-muted-foreground">This month</span>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="max-h-[300px] overflow-y-auto">
          {users.map((user, i) => (
            <div
              key={user.id}
              className={`flex items-center gap-3 px-4 py-3 ${i < users.length - 1 ? "border-b border-border/30" : ""}`}
            >
              <div className="flex items-center justify-center w-[32px] h-[32px] rounded-lg bg-muted text-[10px] font-bold text-muted-foreground shrink-0">
                {getInitials(user.name)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold truncate">{user.name}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[13px] font-bold tabular-nums">{formatAmount(user.totalAmount)}</p>
                <p className="text-[10px] text-muted-foreground">{user.invoiceCount} invoice{user.invoiceCount !== 1 ? "s" : ""}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
