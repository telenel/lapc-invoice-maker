"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { FollowUpBadge } from "@/components/follow-up/follow-up-badge";
import { RequestAccountDialog } from "@/components/follow-up/request-account-dialog";
import { useFollowUpBadge } from "@/domains/follow-up/hooks";
import { formatAmount, formatDateLong as formatDate } from "@/lib/formatters";
import type { InvoiceResponse } from "@/domains/invoice/types";

interface InvoiceDetailInfoProps {
  invoice: InvoiceResponse;
}

export function InvoiceDetailInfo({ invoice }: InvoiceDetailInfoProps) {
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const { badge: followUpBadge, refresh: refreshBadge } = useFollowUpBadge(invoice.id);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invoice Information</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Date</span>
          <span>{formatDate(invoice.date)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Department</span>
          <Badge variant="secondary">{invoice.department}</Badge>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Category</span>
          <Badge variant="outline">
            {invoice.category
              ? invoice.category.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())
              : "—"}
          </Badge>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Account Number</span>
          <div className="flex items-center gap-2">
            <span>{invoice.accountNumber || "—"}</span>
            <FollowUpBadge state={followUpBadge} />
          </div>
        </div>
        {!invoice.accountNumber && (!followUpBadge || followUpBadge.seriesStatus === "EXHAUSTED") && invoice.staff && (
          <Button
            variant="outline"
            size="sm"
            className="mt-1 w-full text-xs"
            onClick={() => setRequestDialogOpen(true)}
          >
            Request Account Number
          </Button>
        )}
        <div className="flex justify-between text-sm">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Account Code</span>
          <span>{invoice.accountCode || "—"}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total Amount</span>
          <span className="font-bold">{formatAmount(invoice.totalAmount)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">PrismCore</span>
          {invoice.prismcorePath ? (
            <Badge variant="secondary">Attached</Badge>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </div>
        {invoice.isRecurring && (
          <>
            <div className="flex justify-between text-sm">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Recurring</span>
              <Badge variant="secondary">
                {invoice.recurringInterval
                  ? invoice.recurringInterval.charAt(0).toUpperCase() + invoice.recurringInterval.slice(1)
                  : "Yes"}
              </Badge>
            </div>
            {invoice.recurringEmail && (
              <div className="flex justify-between text-sm">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Recurring Email</span>
                <span>{invoice.recurringEmail}</span>
              </div>
            )}
          </>
        )}

        {invoice.notes && (
          <>
            <Separator />
            <div className="text-sm">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Notes</p>
              <p className="whitespace-pre-wrap">{invoice.notes}</p>
            </div>
          </>
        )}
      </CardContent>

      {requestDialogOpen && invoice.staff && (
        <RequestAccountDialog
          open={requestDialogOpen}
          onOpenChange={setRequestDialogOpen}
          invoiceId={invoice.id}
          recipientName={invoice.staff.name}
          recipientEmail={invoice.staff.email ?? ""}
          onSuccess={refreshBadge}
        />
      )}
    </Card>
  );
}
