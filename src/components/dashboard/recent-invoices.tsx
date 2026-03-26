"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface Invoice {
  id: string;
  invoiceNumber: string;
  date: string;
  department: string;
  totalAmount: number;
  status: "DRAFT" | "FINAL";
  staff: {
    id: string;
    name: string;
  };
}

export function RecentInvoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function fetchInvoices() {
      try {
        const res = await fetch(
          `/api/invoices?pageSize=10&sortBy=createdAt&sortDir=desc`
        );
        const data = await res.json();
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
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold tracking-tight">Recent Invoices</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : invoices.length === 0 ? (
          <p className="text-sm text-muted-foreground">No invoices yet</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Staff</TableHead>
                <TableHead>Department</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((invoice) => (
                <TableRow
                  key={invoice.id}
                  className="cursor-pointer hover:bg-accent/50"
                  onClick={() => router.push(`/invoices/${invoice.id}`)}
                  role="link"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === "Enter") router.push(`/invoices/${invoice.id}`); }}
                >
                  <TableCell className="font-medium">
                    {invoice.invoiceNumber}
                  </TableCell>
                  <TableCell>
                    {new Date(invoice.date).toLocaleDateString("en-US")}
                  </TableCell>
                  <TableCell>{invoice.staff.name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{invoice.department}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    ${Number(invoice.totalAmount).toFixed(2)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        invoice.status === "DRAFT" ? "outline" : "default"
                      }
                    >
                      {invoice.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
