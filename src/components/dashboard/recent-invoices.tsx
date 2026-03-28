"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import { formatAmount, formatDate, getInitials } from "@/lib/formatters";
import { invoiceApi } from "@/domains/invoice/api-client";
import type { InvoiceResponse } from "@/domains/invoice/types";

export function RecentInvoices() {
  const { data: session } = useSession();
  const [invoices, setInvoices] = useState<InvoiceResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const currentUserId = (session?.user as { id?: string } | undefined)?.id;

  useEffect(() => {
    async function fetchInvoices() {
      try {
        const data = await invoiceApi.list({ pageSize: 10, sortBy: "createdAt", sortOrder: "desc" });
        setInvoices(data.invoices);
      } catch (err) {
        console.error("Failed to fetch recent invoices:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchInvoices();
  }, []);

  return (
    <Card className="card-hover">
      <CardHeader className="border-b border-border/50">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-bold">Recent Invoices</CardTitle>
          <Link
            href="/invoices"
            className="text-[11px] font-semibold text-primary hover:text-primary/80 transition-colors"
          >
            View all →
          </Link>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div>
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className={cn("flex items-center gap-3 px-4 py-3", i < 4 && "border-b border-border/30")}>
                <div className="skeleton w-[34px] h-[34px] rounded-lg shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-3.5 w-48" />
                  <div className="skeleton h-2.5 w-32" />
                </div>
                <div className="space-y-2 text-right">
                  <div className="skeleton h-3.5 w-16 ml-auto" />
                  <div className="skeleton h-4 w-12 ml-auto rounded-full" />
                </div>
              </div>
            ))}
          </div>
        ) : invoices.length === 0 ? (
          <p className="text-sm text-muted-foreground p-4">No invoices yet</p>
        ) : (
          <div>
            {invoices.map((invoice, i) => {
              const isMine = invoice.creatorId === currentUserId;
              return (
              <div
                key={invoice.id}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-muted/50",
                  i < invoices.length - 1 && "border-b border-border/30",
                  isMine && "bg-primary/[0.03]"
                )}
                onClick={() => router.push(`/invoices/${invoice.id}`)}
                role="link"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter") router.push(`/invoices/${invoice.id}`); }}
              >
                <div className={cn(
                  "flex items-center justify-center w-[34px] h-[34px] rounded-lg text-[11px] font-bold shrink-0",
                  isMine
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground"
                )}>
                  {getInitials(invoice.staff.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold truncate">
                    {invoice.invoiceNumber ?? "—"} · {invoice.staff.name}
                    {isMine && <span className="text-[10px] text-primary font-medium ml-1.5">You</span>}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {invoice.department} · {formatDate(invoice.date)}{!isMine ? ` · by ${invoice.creatorName}` : ""}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[13px] font-bold tabular-nums">
                    {formatAmount(invoice.totalAmount)}
                  </p>
                  <Badge
                    variant={invoice.status === "FINAL" ? "success" : invoice.status === "PENDING_CHARGE" ? "info" : "warning"}
                    className="mt-0.5"
                  >
                    {invoice.status === "FINAL" ? "Final" : invoice.status === "PENDING_CHARGE" ? "Pending" : "Draft"}
                  </Badge>
                </div>
              </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
