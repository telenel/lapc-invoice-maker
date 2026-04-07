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
  const isPendingCharge = invoice.status === "PENDING_CHARGE";
  const hasPdf = Boolean(invoice.pdfPath);

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold text-balance">
          {invoice.isRunning && invoice.runningTitle
            ? invoice.runningTitle
            : !invoice.invoiceNumber
              ? "Pending POS Charge"
              : invoice.invoiceNumber}
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
            isFinal ? "success" : isPendingCharge ? "info" : "warning"
          }
        >
          {isFinal
            ? "Final"
            : isPendingCharge
              ? "Pending Charge"
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

        {(isDraft || isPendingCharge) && (
          <Link
            href={`/invoices/${invoice.id}/edit`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            {isPendingCharge ? "Complete POS Charge" : "Edit"}
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

        <Button variant="outline" size="sm" onClick={onDuplicate} disabled={duplicating}>
          <CopyIcon className="size-3.5 mr-1.5" />
          {duplicating ? "Duplicating…" : "Duplicate"}
        </Button>

        {isFinal && (
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

        {(isDraft || isPendingCharge) ? (
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
        )}
      </div>
    </div>
  );
}
