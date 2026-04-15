import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatAmount } from "@/lib/formatters";
import type { InvoiceItemResponse } from "@/domains/invoice/types";

interface InvoiceDetailItemsProps {
  items: InvoiceItemResponse[];
  totalAmount: number;
  marginEnabled: boolean;
  marginPercent: number | null;
  taxEnabled: boolean;
  taxRate: number;
}

export function InvoiceDetailItems({
  items,
  totalAmount,
  marginEnabled,
  marginPercent,
  taxEnabled,
  taxRate,
}: InvoiceDetailItemsProps) {
  const colCount = marginEnabled ? 5 : 4;

  // Cost subtotal (before margin)
  const costSubtotal = items.reduce((sum, item) => {
    const cost = item.costPrice != null ? Number(item.costPrice) : Number(item.unitPrice);
    return sum + cost * Number(item.quantity);
  }, 0);

  // Charged subtotal (with margin) = sum of extendedPrice
  const chargedSubtotal = items.reduce(
    (sum, item) => sum + Number(item.extendedPrice),
    0
  );

  // Margin amount
  const marginAmt = marginEnabled ? chargedSubtotal - costSubtotal : 0;

  // Tax
  const taxableTotal = items
    .filter((item) => item.isTaxable !== false)
    .reduce((sum, item) => sum + Number(item.extendedPrice), 0);
  const effectiveTaxRate = Number(taxRate ?? 0.0975);
  const taxAmt = taxEnabled
    ? Math.round(taxableTotal * effectiveTaxRate * 100) / 100
    : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Line Items</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Description</TableHead>
              <TableHead className="text-center">Qty</TableHead>
              {marginEnabled ? (
                <>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead className="text-right">Charged</TableHead>
                </>
              ) : (
                <TableHead className="text-right">Unit Price</TableHead>
              )}
              <TableHead className="text-right">Extended</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="uppercase">{item.description}</TableCell>
                <TableCell className="text-center tabular-nums">
                  {Number(item.quantity)}
                </TableCell>
                {marginEnabled ? (
                  <>
                    <TableCell className="text-right tabular-nums">
                      {formatAmount(item.costPrice != null ? Number(item.costPrice) : Number(item.unitPrice))}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatAmount(item.unitPrice)}
                    </TableCell>
                  </>
                ) : (
                  <TableCell className="text-right tabular-nums">
                    {formatAmount(item.unitPrice)}
                  </TableCell>
                )}
                <TableCell className="text-right tabular-nums">
                  {formatAmount(item.extendedPrice)}
                </TableCell>
              </TableRow>
            ))}

          </TableBody>
        </Table>
      </CardContent>

      {/* Totals summary */}
      <div className="mx-5 mb-5 rounded-xl border border-border bg-muted/30 p-4 tabular-nums">
        <div className="space-y-1.5 text-sm">
          {marginEnabled && (
            <>
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal (Cost)</span>
                <span>{formatAmount(costSubtotal)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Margin ({Number(marginPercent ?? 0)}%)</span>
                <span>+{formatAmount(marginAmt)}</span>
              </div>
            </>
          )}
          {taxEnabled && (
            <div className="flex justify-between text-muted-foreground">
              <span>Tax ({(effectiveTaxRate * 100).toFixed(2)}%)</span>
              <span>+{formatAmount(taxAmt)}</span>
            </div>
          )}
          {(marginEnabled || taxEnabled) && <div className="border-t border-border my-2" />}
          <div className="flex justify-between text-xl font-bold pt-1">
            <span>Total</span>
            <span>{formatAmount(totalAmount)}</span>
          </div>
        </div>
      </div>
    </Card>
  );
}
