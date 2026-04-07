"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Edit,
  ExternalLink,
  Mail,
  Package,
  Trash2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RequisitionStatusBadge } from "./requisition-status-badge";
import { useRequisition } from "@/domains/textbook-requisition/hooks";
import { requisitionApi } from "@/domains/textbook-requisition/api-client";
import { formatDate } from "@/lib/formatters";
import type { RequisitionBookResponse } from "@/domains/textbook-requisition/types";

// ── Constants ──

const BINDING_LABELS: Record<string, string> = {
  HARDCOVER: "Hardcover",
  PAPERBACK: "Paperback",
  LOOSE_LEAF: "Loose-leaf",
  DIGITAL: "Digital",
};

const TYPE_LABELS: Record<string, string> = {
  PHYSICAL: "Physical Book",
  OER: "OER",
};

// ── Props ──

interface RequisitionDetailProps {
  id: string;
}

// ── Component ──

export function RequisitionDetail({ id }: RequisitionDetailProps) {
  const router = useRouter();
  const { data: requisition, loading, error, refetch } = useRequisition(id);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [notifying, setNotifying] = useState(false);

  if (loading) {
    return <p className="text-muted-foreground text-sm py-8">Loading requisition...</p>;
  }

  if (error || !requisition) {
    return (
      <div className="py-8 text-center">
        <p className="text-destructive text-sm mb-4">
          {error?.message ?? "Requisition not found"}
        </p>
        <Button variant="outline" size="sm" render={<Link href="/textbook-requisitions" />}>
          <ArrowLeft className="size-3.5" data-icon="inline-start" />
          Back to list
        </Button>
      </div>
    );
  }

  // ── Handlers ──

  async function handleNotify(emailType: "ordered" | "on-shelf") {
    setNotifying(true);
    try {
      const result = await requisitionApi.sendNotification(id, emailType);
      if (result.outcome === "sent") {
        toast.success(
          emailType === "ordered"
            ? "Instructor notified: books ordered"
            : "Instructor notified: books on shelf",
        );
      } else if (result.outcome === "already_sent") {
        toast.info("Notification was already sent previously");
      } else if (result.outcome === "partial_failure") {
        toast.warning(result.error ?? "Email sent but some updates failed. Manual correction may be needed.");
      } else if (result.outcome === "in_progress") {
        toast.info("Notification is already being sent by another request");
      } else if (result.outcome === "unknown") {
        toast.warning(result.error ?? "A prior send crashed. Check with the instructor before retrying.");
      } else {
        toast.error(result.error ?? "Notification failed to send");
      }
      void refetch();
    } catch {
      toast.error("Failed to send notification");
    } finally {
      setNotifying(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await requisitionApi.delete(id);
      toast.success("Requisition deleted");
      router.push("/textbook-requisitions");
    } catch {
      toast.error("Failed to delete requisition");
      setDeleting(false);
    }
  }

  // ── Render ──

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="mb-2 -ml-2"
            render={<Link href="/textbook-requisitions" />}
          >
            <ArrowLeft className="size-3.5" data-icon="inline-start" />
            Back
          </Button>
          <h1 className="text-xl font-bold">{requisition.instructorName}</h1>
          <p className="text-sm text-muted-foreground">
            {requisition.department} &middot; {requisition.course} &middot; {requisition.term}{" "}
            {requisition.reqYear}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <RequisitionStatusBadge status={requisition.status} />
          {requisition.status === "PENDING" && (
            <Button size="sm" disabled={notifying} onClick={() => handleNotify("ordered")}>
              <Package className="size-3.5" data-icon="inline-start" />
              {notifying ? "Sending..." : "Mark Ordered & Notify"}
            </Button>
          )}
          {requisition.status === "ORDERED" && (
            <Button size="sm" disabled={notifying} onClick={() => handleNotify("on-shelf")}>
              <CheckCircle2 className="size-3.5" data-icon="inline-start" />
              {notifying ? "Sending..." : "Mark On-Shelf & Notify"}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            render={<Link href={`/textbook-requisitions/${id}/edit`} />}
          >
            <Edit className="size-3.5" data-icon="inline-start" />
            Edit
          </Button>
          <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="size-3.5" data-icon="inline-start" />
            Delete
          </Button>
        </div>
      </div>

      {/* Attention Flags */}
      {requisition.attentionFlags.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
            <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-300">
              Attention Required
            </h3>
          </div>
          <ul className="space-y-1">
            {requisition.attentionFlags.map((flag) => (
              <li key={flag} className="text-sm text-amber-700 dark:text-amber-400">
                &bull; {flag}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Instructor Info */}
      <section>
        <h2 className="text-base font-semibold mb-3">Instructor Information</h2>
        <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
          <InfoField label="Name" value={requisition.instructorName} />
          <InfoField label="Phone" value={requisition.phone} />
          <InfoField label="Email" value={requisition.email} />
          <InfoField label="Department" value={requisition.department} />
          <InfoField label="Course" value={requisition.course} />
          <InfoField label="Sections" value={requisition.sections} />
          <InfoField label="Enrollment" value={String(requisition.enrollment)} />
          <InfoField label="Term" value={requisition.term} />
          <InfoField label="Year" value={String(requisition.reqYear)} />
        </div>
      </section>

      {/* Books */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <BookOpen className="size-4 text-muted-foreground" />
          <h2 className="text-base font-semibold">
            Books ({requisition.books.length})
          </h2>
        </div>
        {requisition.books.length === 0 ? (
          <p className="text-sm text-muted-foreground">No books listed.</p>
        ) : (
          <div className="space-y-3">
            {requisition.books.map((book) => (
              <BookCard key={book.id} book={book} />
            ))}
          </div>
        )}
      </section>

      {/* Additional Info */}
      {requisition.additionalInfo && (
        <section>
          <h2 className="text-base font-semibold mb-2">Additional Information</h2>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
            {requisition.additionalInfo}
          </p>
        </section>
      )}

      {/* Staff Notes */}
      {requisition.staffNotes && (
        <section>
          <h2 className="text-base font-semibold mb-2">Staff Notes</h2>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
            {requisition.staffNotes}
          </p>
        </section>
      )}

      {/* Notification History */}
      {requisition.notifications.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Mail className="size-4 text-muted-foreground" />
            <h2 className="text-base font-semibold">
              Notification History ({requisition.notifications.length})
            </h2>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Recipient</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Sent By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requisition.notifications.map((n) => (
                <TableRow key={n.id}>
                  <TableCell className="text-[13px]">{formatDate(n.sentAt)}</TableCell>
                  <TableCell className="text-[13px] capitalize">
                    {n.type.replace(/_/g, " ").toLowerCase()}
                  </TableCell>
                  <TableCell className="text-[13px]">{n.recipientEmail}</TableCell>
                  <TableCell>
                    {n.success ? (
                      <span className="inline-flex items-center gap-1 text-xs text-green-700 dark:text-green-400">
                        <CheckCircle2 className="size-3" />
                        Sent
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-destructive">
                        <XCircle className="size-3" />
                        Failed
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-[13px]">{n.sentByName ?? "System"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      )}

      {/* Audit Info */}
      <section className="border-t border-border pt-4">
        <h2 className="text-base font-semibold mb-3">Audit</h2>
        <div className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2 text-sm">
          <div>
            <span className="text-muted-foreground">Created by:</span>{" "}
            <span>{requisition.creatorName ?? "Unknown"}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Submitted:</span>{" "}
            <span>{formatDate(requisition.submittedAt)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Source:</span>{" "}
            <span className="capitalize">{requisition.source.toLowerCase().replace("_", " ")}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Last updated:</span>{" "}
            <span>{formatDate(requisition.updatedAt)}</span>
          </div>
          {requisition.lastStatusChangedByName && (
            <div>
              <span className="text-muted-foreground">Status changed by:</span>{" "}
              <span>{requisition.lastStatusChangedByName}</span>
              {requisition.lastStatusChangedAt && (
                <span className="text-muted-foreground">
                  {" "}
                  on {formatDate(requisition.lastStatusChangedAt)}
                </span>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Delete Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Requisition</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this requisition from{" "}
              <strong>{requisition.instructorName}</strong> for {requisition.course}? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Sub-components ──

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}

function BookCard({ book }: { book: RequisitionBookResponse }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">
            {book.bookNumber}. {book.title}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">by {book.author}</p>
        </div>
        <span className="shrink-0 inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {TYPE_LABELS[book.bookType] ?? book.bookType}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-3 sm:grid-cols-3 lg:grid-cols-4">
        <BookField label="ISBN" value={book.isbn} />
        {book.edition && <BookField label="Edition" value={book.edition} />}
        {book.copyrightYear && <BookField label="Copyright" value={book.copyrightYear} />}
        {book.volume && <BookField label="Volume" value={book.volume} />}
        {book.publisher && <BookField label="Publisher" value={book.publisher} />}
        {book.binding && (
          <BookField label="Binding" value={BINDING_LABELS[book.binding] ?? book.binding} />
        )}
      </div>
      {book.oerLink && (
        <div className="mt-3">
          <a
            href={book.oerLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="size-3" />
            OER Resource
          </a>
        </div>
      )}
    </div>
  );
}

function BookField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-xs font-medium">{value}</p>
    </div>
  );
}
