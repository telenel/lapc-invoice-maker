import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatAmount, formatDateLong as formatDate } from "@/lib/formatters";
import type { InvoiceResponse } from "@/domains/invoice/types";

interface InvoiceDetailInfoProps {
  invoice: InvoiceResponse;
}

export function InvoiceDetailInfo({ invoice }: InvoiceDetailInfoProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Invoice Information</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-[11px] font-medium text-muted-foreground">Date</span>
          <span>{formatDate(invoice.date)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-[11px] font-medium text-muted-foreground">Department</span>
          <Badge variant="secondary">{invoice.department}</Badge>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-[11px] font-medium text-muted-foreground">Category</span>
          <Badge variant="outline">
            {invoice.category
              ? invoice.category.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())
              : "—"}
          </Badge>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-[11px] font-medium text-muted-foreground">Account Number</span>
          <span>{invoice.accountNumber || "—"}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-[11px] font-medium text-muted-foreground">Account Code</span>
          <span>{invoice.accountCode || "—"}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-[11px] font-medium text-muted-foreground">Total Amount</span>
          <span className="font-bold">{formatAmount(invoice.totalAmount)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-[11px] font-medium text-muted-foreground">PrismCore</span>
          {invoice.prismcorePath ? (
            <Badge variant="secondary">Attached</Badge>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </div>
        {invoice.isRecurring && (
          <>
            <div className="flex justify-between text-sm">
              <span className="text-[11px] font-medium text-muted-foreground">Recurring</span>
              <Badge variant="secondary">
                {invoice.recurringInterval
                  ? invoice.recurringInterval.charAt(0).toUpperCase() + invoice.recurringInterval.slice(1)
                  : "Yes"}
              </Badge>
            </div>
            {invoice.recurringEmail && (
              <div className="flex justify-between text-sm">
                <span className="text-[11px] font-medium text-muted-foreground">Recurring Email</span>
                <span>{invoice.recurringEmail}</span>
              </div>
            )}
          </>
        )}

        {invoice.notes && (
          <>
            <Separator />
            <div className="text-sm">
              <p className="text-[11px] font-medium text-muted-foreground mb-1">Notes</p>
              <p className="whitespace-pre-wrap">{invoice.notes}</p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
