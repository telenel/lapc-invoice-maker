"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatAmount, formatDateLong as formatDate } from "@/lib/formatters";
import type { ArchivedDocumentResponse } from "@/domains/archive/types";

interface ArchiveTableProps {
  documents: ArchivedDocumentResponse[];
  loading: boolean;
  error: string | null;
  restoringId: string | null;
  onRestore: (id: string) => Promise<void>;
}

function statusLabel(document: ArchivedDocumentResponse) {
  return document.type === "QUOTE"
    ? (document.quoteStatus ?? "Unknown")
    : (document.status ?? "Unknown");
}

function detailHref(document: ArchivedDocumentResponse) {
  return document.type === "QUOTE"
    ? `/quotes/${document.id}`
    : `/invoices/${document.id}`;
}

export function ArchiveTable({
  documents,
  loading,
  error,
  restoringId,
  onRestore,
}: ArchiveTableProps) {
  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading deleted documents…</p>;
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-destructive">
          {error}
        </CardContent>
      </Card>
    );
  }

  if (documents.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Document</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Recipient</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Archived</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {documents.map((document) => (
              <TableRow key={document.id}>
                <TableCell>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant={document.type === "QUOTE" ? "secondary" : "outline"}>
                        {document.type === "QUOTE" ? "Quote" : "Invoice"}
                      </Badge>
                      <Link href={detailHref(document)} className="font-medium hover:underline">
                        {document.quoteNumber ?? document.invoiceNumber ?? document.id}
                      </Link>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Created {formatDate(document.createdAt)} by {document.creatorName}
                    </p>
                  </div>
                </TableCell>
                <TableCell>{statusLabel(document)}</TableCell>
                <TableCell>{document.department}</TableCell>
                <TableCell>{document.recipientName ?? document.recipientOrg ?? "—"}</TableCell>
                <TableCell className="text-right font-medium">
                  {formatAmount(document.totalAmount)}
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <p>{formatDate(document.archivedAt)}</p>
                    {document.archivedBy && (
                      <p className="text-xs text-muted-foreground">
                        by {document.archivedBy.name}
                      </p>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void onRestore(document.id)}
                    disabled={restoringId === document.id}
                  >
                    {restoringId === document.id ? "Restoring…" : "Restore"}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
