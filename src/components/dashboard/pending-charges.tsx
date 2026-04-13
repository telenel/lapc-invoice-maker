"use client";

import { startTransition, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatAmount, getInitials } from "@/lib/formatters";
import { useDashboardBootstrapData } from "./dashboard-bootstrap-provider";
import type { CreatorStatEntry } from "@/domains/invoice/types";
import { useDeferredDashboardRealtime } from "./use-deferred-dashboard-realtime";

type IdleCapableWindow = Window & {
  requestIdleCallback?: (
    callback: IdleRequestCallback,
    options?: IdleRequestOptions,
  ) => number;
  cancelIdleCallback?: (handle: number) => void;
};

export function PendingCharges() {
  const dashboardBootstrap = useDashboardBootstrapData();
  const initialUsers = dashboardBootstrap?.pendingCharges ?? null;
  const [users, setUsers] = useState<CreatorStatEntry[]>(initialUsers ?? []);
  const [loading, setLoading] = useState(() => initialUsers === null);
  const [detailsReady, setDetailsReady] = useState(false);

  const fetchPending = useCallback(() => {
    void import("@/domains/invoice/api-client")
      .then(({ invoiceApi }) => invoiceApi.getCreatorStats("PENDING_CHARGE"))
      .then((data) => {
        startTransition(() => {
          setUsers(data.users);
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (initialUsers !== null) {
      return;
    }

    fetchPending();
  }, [fetchPending, initialUsers]);

  const refreshPending = useCallback(() => {
    fetchPending();
  }, [fetchPending]);

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
    ["invoice-changed"],
    refreshPending,
    { enabled: detailsReady },
  );

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
