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

            {/* Breakdown rows */}
            {marginEnabled && (
              <TableRow>
                <TableCell
                  colSpan={colCount - 1}
                  className="text-right text-sm text-muted-foreground"
                >
                  Subtotal (Cost)
                </TableCell>
                <TableCell className="text-right text-sm text-muted-foreground tabular-nums">
                  {formatAmount(costSubtotal)}
                </TableCell>
              </TableRow>
            )}
            {marginEnabled && (
              <TableRow>
                <TableCell
                  colSpan={colCount - 1}
                  className="text-right text-sm text-muted-foreground"
                >
                  Margin ({Number(marginPercent ?? 0)}%)
                </TableCell>
                <TableCell className="text-right text-sm text-muted-foreground tabular-nums">
                  +{formatAmount(marginAmt)}
                </TableCell>
              </TableRow>
            )}
            {taxEnabled && (
              <TableRow>
                <TableCell
                  colSpan={colCount - 1}
                  className="text-right text-sm text-muted-foreground"
                >
                  Tax ({(effectiveTaxRate * 100).toFixed(2)}%)
                </TableCell>
                <TableCell className="text-right text-sm text-muted-foreground tabular-nums">
                  +{formatAmount(taxAmt)}
                </TableCell>
              </TableRow>
            )}

            {/* Total row */}
            <TableRow>
              <TableCell colSpan={colCount - 1} className="text-right font-bold">
                Total
              </TableCell>
              <TableCell className="text-right font-bold tabular-nums">
                {formatAmount(totalAmount)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
