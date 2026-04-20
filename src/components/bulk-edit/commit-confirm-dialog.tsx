"use client";

import type { PreviewResult } from "@/domains/bulk-edit/types";
import { PrismWriteConfirmationDialog } from "@/components/products/prism-write-confirmation-dialog";

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

  const warnings = [
    `${rowCount.toLocaleString()} item${rowCount === 1 ? "" : "s"} will be updated in Prism and mirrored to the POS database.`,
    "This is a live database write, not a local draft save.",
    "The change cannot be undone from this UI.",
  ];

  return (
    <PrismWriteConfirmationDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Apply ${rowCount} change${rowCount === 1 ? "" : "s"}?`}
      description="Review the preview carefully before committing."
      warnings={warnings}
      confirmPhrase="APPLY PRISM BULK WRITE"
      confirmLabel={submitting ? "Applying..." : "Apply Changes"}
      confirming={submitting}
      onConfirm={onConfirm}
    >
      <ul className="space-y-2 text-sm">
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
    </PrismWriteConfirmationDialog>
  );
}
