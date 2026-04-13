"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CopyIcon, MailIcon } from "lucide-react";
import { formatDateLong as formatDate } from "@/lib/formatters";
import type { InvoiceResponse } from "@/domains/invoice/types";

interface InvoiceDetailHeaderProps {
  invoice: InvoiceResponse;
  canManageActions: boolean;
  regenerating: boolean;
  deleting: boolean;
  duplicating: boolean;
  deleteDialogOpen: boolean;
  onDeleteDialogOpenChange: (open: boolean) => void;
  onDownloadPdf: () => void;
  onRegeneratePdf: () => void;
  onEmail: () => void;
  onDeleteClick: () => void;
  onDeleteConfirm: () => void;
  onDuplicate: () => void;
}

export function InvoiceDetailHeader({
  invoice,
  canManageActions,
  regenerating,
  deleting,
  duplicating,
  deleteDialogOpen,
  onDeleteDialogOpenChange,
  onDownloadPdf,
  onRegeneratePdf,
  onEmail,
  onDeleteClick,
  onDeleteConfirm,
  onDuplicate,
}: InvoiceDetailHeaderProps) {
  const isDraft = invoice.status === "DRAFT";
  const isFinal = invoice.status === "FINAL";
  const hasPdf = Boolean(invoice.pdfPath);
  const title = invoice.isRunning
    ? invoice.runningTitle || "Untitled Running Invoice"
    : invoice.invoiceNumber || "Draft Invoice";

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold text-balance">
          {title}
        </h1>
        {invoice.isRunning && invoice.invoiceNumber && (
          <p className="text-sm font-medium text-muted-foreground">{invoice.invoiceNumber}</p>
        )}
        <p className="text-sm text-muted-foreground mt-1">
          Created {formatDate(invoice.createdAt)} by {invoice.creatorName}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        <Badge
          variant={
            isFinal ? "success" : "warning"
          }
        >
          {isFinal
            ? "Final"
            : "Draft"}
        </Badge>
        {invoice.isRunning && (
          <Badge variant="info">Running Invoice</Badge>
        )}
        {invoice.isRecurring && (
          <Badge variant="secondary">
            Recurring{invoice.recurringInterval ? ` · ${invoice.recurringInterval.charAt(0).toUpperCase() + invoice.recurringInterval.slice(1)}` : ""}
          </Badge>
        )}

        {canManageActions && isDraft && (
          <Link
            href={`/invoices/${invoice.id}/edit`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Edit
          </Link>
        )}

        {hasPdf && (
          <Button
            variant="outline"
            size="sm"
            onClick={onDownloadPdf}
          >
            Download PDF
          </Button>
        )}

        {canManageActions && (
          <Button variant="outline" size="sm" onClick={onDuplicate} disabled={duplicating}>
            <CopyIcon className="size-3.5 mr-1.5" />
            {duplicating ? "Duplicating…" : "Duplicate"}
          </Button>
        )}

        {canManageActions && isFinal && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={onRegeneratePdf}
              disabled={regenerating}
            >
              {regenerating ? "Regenerating…" : "Regenerate PDF"}
            </Button>
            {hasPdf && (
              <Button
                variant="outline"
                size="sm"
                onClick={onEmail}
              >
                <MailIcon className="h-4 w-4 mr-1" aria-hidden="true" />
                Email
              </Button>
            )}
          </>
        )}

        {canManageActions && (isDraft ? (
          <Button
            variant="destructive"
            size="sm"
            onClick={onDeleteClick}
            disabled={deleting}
          >
            {deleting ? "Deleting…" : "Delete"}
          </Button>
        ) : (
          <Dialog open={deleteDialogOpen} onOpenChange={onDeleteDialogOpenChange}>
            <DialogTrigger
              render={
                <Button variant="destructive" size="sm" disabled={deleting}>
                  {deleting ? "Deleting…" : "Delete"}
                </Button>
              }
            />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete Invoice</DialogTitle>
                <DialogDescription>
                  This will permanently delete the invoice and its generated PDF. This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => onDeleteDialogOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={onDeleteConfirm}
                  disabled={deleting}
                >
                  {deleting ? "Deleting…" : "Delete Invoice"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        ))}
      </div>
    </div>
  );
}
