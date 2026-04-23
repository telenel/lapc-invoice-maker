"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { BulkEditFieldPreview } from "@/domains/bulk-edit/types";

interface CommitConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preview: BulkEditFieldPreview | null;
  onConfirm: () => void;
  submitting: boolean;
}

export function CommitConfirmDialog({ open, onOpenChange, preview, onConfirm, submitting }: CommitConfirmDialogProps) {
  if (!preview) return null;
  const { rowCount } = preview.totals;
  const fieldSummary = formatFieldLabelList(preview.changedFieldLabels);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Apply {rowCount} change{rowCount === 1 ? "" : "s"}?</DialogTitle>
          <DialogDescription>Review before committing. Changes are not undoable.</DialogDescription>
        </DialogHeader>
        <ul className="space-y-2 text-sm">
          <li>
            Apply {fieldSummary} to {rowCount.toLocaleString()} item{rowCount === 1 ? "" : "s"}.
          </li>
        </ul>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button onClick={onConfirm} disabled={submitting}>
            {submitting ? "Applying..." : "Apply Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function formatFieldLabelList(labels: string[]): string {
  if (labels.length === 0) return "selected fields";
  if (labels.length === 1) return labels[0] ?? "selected fields";
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]}`;
}
