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
import type { PreviewResult } from "@/domains/bulk-edit/types";

interface CommitConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preview: PreviewResult | null;
  onConfirm: () => void;
  submitting: boolean;
}

export function CommitConfirmDialog({ open, onOpenChange, preview, onConfirm, submitting }: CommitConfirmDialogProps) {
  if (!preview) return null;
  const { rowCount, pricingDeltaCents, districtChangeCount } = preview.totals;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Apply {rowCount} change{rowCount === 1 ? "" : "s"}?</DialogTitle>
          <DialogDescription>Review before committing. Changes are not undoable.</DialogDescription>
        </DialogHeader>
        <ul className="space-y-2 text-sm">
          <li>
            <span className="font-medium">{rowCount.toLocaleString()}</span> item{rowCount === 1 ? "" : "s"} will be updated
          </li>
          {pricingDeltaCents !== 0 ? (
            <li>
              Pierce retail delta:{" "}
              <span className={`tabular-nums font-medium ${pricingDeltaCents >= 0 ? "text-foreground" : "text-destructive"}`}>
                {pricingDeltaCents >= 0 ? "+" : ""}
                ${(pricingDeltaCents / 100).toFixed(2)}
              </span>{" "}
              total
            </li>
          ) : null}
          {districtChangeCount > 0 ? (
            <li className="flex items-start gap-2 rounded border border-destructive/30 bg-destructive/5 px-3 py-2">
              <span>WARNING:</span>
              <span>
                <strong>{districtChangeCount}</strong> of these rows have Department/Class or Tax changes.
                Those fields live on the shared Item record and affect all 17 LACCD locations, not just Pierce.
              </span>
            </li>
          ) : null}
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
