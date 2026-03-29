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
}

export function InvoiceDetailItems({ items, totalAmount }: InvoiceDetailItemsProps) {
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
              <TableHead className="text-right">Unit Price</TableHead>
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
                <TableCell className="text-right tabular-nums">
                  {formatAmount(item.unitPrice)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatAmount(item.extendedPrice)}
                </TableCell>
              </TableRow>
            ))}
            {/* Total row */}
            <TableRow>
              <TableCell colSpan={3} className="text-right font-bold">
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
