"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Badge } from "@/components/ui/badge";
import { FollowUpBadge } from "@/components/follow-up/follow-up-badge";
import { followUpApi } from "@/domains/follow-up/api-client";
import { useSSE } from "@/lib/use-sse";

type PendingItem = {
  invoiceId: string;
  invoiceNumber: string | null;
  quoteNumber: string | null;
  type: string;
  staffName: string;
  creatorName: string;
  creatorId: string;
  currentAttempt: number;
  maxAttempts: number;
  seriesStatus: string;
};

export function PendingAccountsWidget() {
  const router = useRouter();
  const { data: session } = useSession();
  const [items, setItems] = useState<PendingItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const data = await followUpApi.getPendingAccounts();
      setItems(data.items);
    } catch {
      // Non-critical widget — silently ignore fetch failures
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useSSE("invoice-changed", fetchData);
  useSSE("quote-changed", fetchData);

  if (loading || items.length === 0) return null;

  const userId = (session?.user as { id?: string } | undefined)?.id;

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Pending Account Numbers</h3>
        <Badge variant="outline">{items.length}</Badge>
      </div>

      <div className="mt-3 space-y-2">
        {items.map((item) => {
          const docNum = item.type === "QUOTE" ? item.quoteNumber : item.invoiceNumber;
          const href = item.type === "QUOTE" ? `/quotes/${item.invoiceId}` : `/invoices/${item.invoiceId}`;
          const isOwn = item.creatorId === userId;

          return (
            <div
              key={item.invoiceId}
              className={`flex cursor-pointer items-center justify-between rounded-md p-2 text-sm transition-colors hover:bg-muted ${isOwn ? "bg-amber-50 dark:bg-amber-950/20" : ""}`}
              role="button"
              tabIndex={0}
              onClick={() => router.push(href)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") router.push(href); }}
            >
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {item.type === "QUOTE" ? "QTE" : "INV"}
                </span>
                <span className="font-medium">{docNum}</span>
                <span className="text-muted-foreground">— {item.staffName}</span>
              </div>
              <FollowUpBadge
                state={{
                  seriesStatus: item.seriesStatus as "ACTIVE" | "EXHAUSTED",
                  currentAttempt: item.currentAttempt,
                  maxAttempts: item.maxAttempts,
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
