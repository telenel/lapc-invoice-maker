"use client";

import Link from "next/link";
import { startTransition, useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { FollowUpBadge } from "@/components/follow-up/follow-up-badge";
import { useDashboardBootstrapData } from "./dashboard-bootstrap-provider";
import type { DashboardPendingAccountItem } from "@/domains/dashboard/types";
import { useDeferredDashboardRealtime } from "./use-deferred-dashboard-realtime";

type IdleCapableWindow = Window & {
  requestIdleCallback?: (
    callback: IdleRequestCallback,
    options?: IdleRequestOptions,
  ) => number;
  cancelIdleCallback?: (handle: number) => void;
};

export function PendingAccountsWidget({
  currentUserId,
}: {
  currentUserId: string | null;
}) {
  const dashboardBootstrap = useDashboardBootstrapData();
  const initialItems = dashboardBootstrap?.pendingAccounts ?? null;
  const [items, setItems] = useState<DashboardPendingAccountItem[]>(
    initialItems ?? [],
  );
  const [loading, setLoading] = useState(() => initialItems === null);
  const [detailsReady, setDetailsReady] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const { followUpApi } = await import("@/domains/follow-up/api-client");
      const data = await followUpApi.getPendingAccounts();
      startTransition(() => {
        setItems(data.items);
      });
    } catch {
      // Non-critical widget — silently ignore fetch failures
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialItems !== null) {
      return;
    }

    void fetchData();
  }, [fetchData, initialItems]);

  const refreshPendingAccounts = useCallback(() => {
    void fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (detailsReady) {
      return;
    }

    const win = window as IdleCapableWindow;
    let idleHandle: number | null = null;

    function markReady() {
      startTransition(() => {
        setDetailsReady(true);
      });
    }

    const fallbackTimer = window.setTimeout(markReady, 1500);

    if (win.requestIdleCallback) {
      idleHandle = win.requestIdleCallback(markReady, { timeout: 2000 });
    } else {
      idleHandle = window.setTimeout(markReady, 700);
    }

    window.addEventListener("pointerdown", markReady, { once: true, passive: true });
    window.addEventListener("keydown", markReady, { once: true });
    window.addEventListener("focusin", markReady, { once: true });

    return () => {
      window.clearTimeout(fallbackTimer);
      if (idleHandle !== null) {
        if (win.cancelIdleCallback) {
          win.cancelIdleCallback(idleHandle);
        } else {
          window.clearTimeout(idleHandle);
        }
      }
      window.removeEventListener("pointerdown", markReady);
      window.removeEventListener("keydown", markReady);
      window.removeEventListener("focusin", markReady);
    };
  }, [detailsReady]);

  useDeferredDashboardRealtime(
    ["invoice-changed", "quote-changed"],
    refreshPendingAccounts,
    { enabled: detailsReady },
  );

  if (loading || items.length === 0) return null;

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
          const isOwn = item.creatorId === currentUserId;

          return (
            <Link
              key={item.invoiceId}
              href={href}
              className={`flex cursor-pointer items-center justify-between rounded-md p-2 text-sm transition-colors hover:bg-muted ${isOwn ? "bg-amber-50 dark:bg-amber-950/20" : ""}`}
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
            </Link>
          );
        })}
      </div>
    </div>
  );
}
