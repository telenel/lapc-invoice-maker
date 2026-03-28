"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatAmount, getInitials } from "@/lib/formatters";
import { invoiceApi } from "@/domains/invoice/api-client";
import type { InvoiceResponse } from "@/domains/invoice/types";

export function RunningInvoices() {
  const { data: session } = useSession();
  const [invoices, setInvoices] = useState<InvoiceResponse[]>([]);
  const [loading, setLoading] = useState(true);

  const currentUserId = (session?.user as { id?: string } | undefined)?.id;

  useEffect(() => {
    invoiceApi.list({ status: "DRAFT", isRunning: true, pageSize: 50 })
      .then((data) => setInvoices(data.invoices ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading || invoices.length === 0) return null;

  // Sort: current user's running invoices first
  const sorted = [...invoices].sort((a, b) => {
    const aIsMine = a.creatorId === currentUserId ? 0 : 1;
    const bIsMine = b.creatorId === currentUserId ? 0 : 1;
    return aIsMine - bIsMine;
  });

  return (
    <Card className="card-hover">
      <CardHeader className="border-b border-border/50">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-bold">Running Invoices</CardTitle>
          <Badge variant="info" className="tabular-nums">{invoices.length}</Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div>
          {sorted.map((inv, i) => {
            const isMine = inv.creatorId === currentUserId;
            return (
              <Link
                key={inv.id}
                href={`/invoices/${inv.id}/edit`}
                className={`flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors ${i < sorted.length - 1 ? "border-b border-border/30" : ""} ${isMine ? "bg-primary/[0.03]" : ""}`}
              >
                <div className="flex items-center justify-center w-[34px] h-[34px] rounded-lg bg-muted text-[11px] font-bold text-muted-foreground shrink-0">
                  {getInitials(inv.creatorName)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold truncate">
                    {inv.runningTitle || "Untitled Running Invoice"}
                    {isMine && <span className="text-[10px] text-primary font-medium ml-2">Yours</span>}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {inv.creatorName} · {inv.department} · {inv.items.length} item{inv.items.length !== 1 ? "s" : ""}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[13px] font-bold tabular-nums">{formatAmount(inv.totalAmount)}</p>
                  <p className="text-[10px] text-primary font-medium">Add Items →</p>
                </div>
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
