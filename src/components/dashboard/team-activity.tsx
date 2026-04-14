"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSession } from "next-auth/react";
import { formatAmount } from "@/lib/formatters";
import { getInitials } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { invoiceApi } from "@/domains/invoice/api-client";
import type { CreatorStatEntry } from "@/domains/invoice/types";

export function TeamActivity() {
  const { data: session } = useSession();
  const [users, setUsers] = useState<CreatorStatEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const currentUserId = (session?.user as { id?: string } | undefined)?.id;

  useEffect(() => {
    invoiceApi.getCreatorStats()
      .then((data) => setUsers(data.users))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading || users.length === 0) return null;

  return (
    <Card className="card-hover">
      <CardHeader className="border-b border-border/50">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-bold">Team Activity</CardTitle>
          <span className="text-[11px] text-muted-foreground">Funding leaderboard</span>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="max-h-[300px] overflow-y-auto">
          {users.map((user, i) => {
            const isMine = user.id === currentUserId;
            return (
            <div
              key={user.id}
              className={cn(
                "flex items-center gap-3 px-4 py-3",
                i < users.length - 1 && "border-b border-border/30",
                isMine && "bg-primary/[0.03]"
              )}
            >
              <div className={cn(
                "flex items-center justify-center w-[32px] h-[32px] rounded-lg text-[10px] font-bold shrink-0",
                isMine
                  ? "bg-primary/10 text-primary"
                  : "bg-muted text-muted-foreground"
              )}>
                {getInitials(user.name)}
              </div>
              <div className="w-7 shrink-0 text-[11px] font-semibold text-muted-foreground">
                #{i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold truncate">
                  {user.name}
                  {isMine && <span className="text-[10px] text-primary font-medium ml-1.5">(You)</span>}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[13px] font-bold tabular-nums">{formatAmount(user.totalAmount)}</p>
                <p className="text-[10px] text-muted-foreground">{user.invoiceCount} invoice{user.invoiceCount !== 1 ? "s" : ""}</p>
              </div>
            </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
