"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatAmount, formatDate, getInitials } from "@/lib/formatters";
import { invoiceApi } from "@/domains/invoice/api-client";
import type { InvoiceResponse } from "@/domains/invoice/types";

export function RecentInvoices() {
  const [invoices, setInvoices] = useState<InvoiceResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function fetchInvoices() {
      try {
        const data = await invoiceApi.list({ pageSize: 10, sortBy: "createdAt", sortOrder: "desc" });
        setInvoices(data.data);
      } catch (err) {
        console.error("Failed to fetch recent invoices:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchInvoices();
  }, []);

  return (
    <Card>
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
          <p className="text-sm text-muted-foreground p-4">Loading...</p>
        ) : invoices.length === 0 ? (
          <p className="text-sm text-muted-foreground p-4">No invoices yet</p>
        ) : (
          <div>
            {invoices.map((invoice, i) => (
              <div
                key={invoice.id}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-muted/50",
                  i < invoices.length - 1 && "border-b border-border/30"
                )}
                onClick={() => router.push(`/invoices/${invoice.id}`)}
                role="link"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter") router.push(`/invoices/${invoice.id}`); }}
              >
                <div className="flex items-center justify-center w-[34px] h-[34px] rounded-lg bg-muted text-[11px] font-bold text-muted-foreground shrink-0">
                  {getInitials(invoice.staff.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold truncate">
                    {invoice.invoiceNumber ?? "—"} · {invoice.staff.name}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {invoice.department} · {formatDate(invoice.date)} · by {invoice.creatorName}
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
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
