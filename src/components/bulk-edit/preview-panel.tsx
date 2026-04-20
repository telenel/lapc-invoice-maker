"use client";

import { Button } from "@/components/ui/button";
import type { BulkEditFieldPreview } from "@/domains/bulk-edit/types";

interface PreviewPanelProps {
  preview: BulkEditFieldPreview | null;
  previewing: boolean;
  onCommit: () => void;
  committing: boolean;
}

export function PreviewPanel({ preview, previewing, onCommit, committing }: PreviewPanelProps) {
  return (
    <section aria-labelledby="preview-heading" className="space-y-3 rounded border p-4">
      <h2 id="preview-heading" className="text-base font-semibold">3. Preview & Commit</h2>

      {previewing ? (
        <div role="status" aria-live="polite" className="py-8 text-center text-sm text-muted-foreground">
          Building preview...
        </div>
      ) : !preview ? (
        <p className="text-sm text-muted-foreground">
          Pick fields and values, then run a preview to inspect the Phase 8 patch summary before committing.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-6 rounded bg-muted/40 px-4 py-3 text-sm">
            <div>
              <div className="text-muted-foreground">Rows</div>
              <div className="tabular-nums font-medium">
                {preview.totals.rowCount.toLocaleString()} matching row{preview.totals.rowCount === 1 ? "" : "s"}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">Field changes</div>
              <div className="tabular-nums font-medium">
                {preview.totals.changedFieldCount.toLocaleString()} field change{preview.totals.changedFieldCount === 1 ? "" : "s"}
              </div>
            </div>
          </div>

          {preview.changedFieldLabels.length > 0 ? (
            <p className="text-sm text-muted-foreground">
              Applying {formatFieldLabelList(preview.changedFieldLabels)}.
            </p>
          ) : null}

          {preview.warnings.length > 0 ? (
            <div role="alert" aria-live="polite" className="rounded border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              <div className="font-medium">{preview.warnings.length} warning{preview.warnings.length === 1 ? "" : "s"}</div>
              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                {preview.warnings.map((warning, index) => <li key={index}>{warning.message}</li>)}
              </ul>
            </div>
          ) : null}

          <div className="space-y-3 rounded border p-3">
            {preview.rows.slice(0, 8).map((row) => (
              <div key={row.sku} className="rounded border border-muted/70 px-3 py-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <span className="font-mono text-xs text-muted-foreground">SKU {row.sku}</span>
                    <div className="font-medium">{row.description}</div>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {row.changedFields.length} field change{row.changedFields.length === 1 ? "" : "s"}
                  </span>
                </div>
                <ul className="mt-2 space-y-1 text-sm">
                  {row.cells.map((cell) => (
                    <li key={cell.fieldId} className="flex flex-wrap items-baseline gap-2">
                      <span className="font-medium">{cell.label}</span>
                      <span className="text-muted-foreground">{cell.beforeLabel}</span>
                      <span aria-hidden="true">→</span>
                      <span className={cell.changed ? "font-medium" : "text-muted-foreground"}>{cell.afterLabel}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {preview.rows.length > 8 ? (
              <p className="text-xs text-muted-foreground">
                Showing 8 of {preview.rows.length} preview rows.
              </p>
            ) : null}
          </div>

          <div className="flex justify-end">
            <Button onClick={onCommit} disabled={committing || preview.totals.rowCount === 0}>
              {committing ? "Applying..." : `Commit ${preview.totals.rowCount} Change${preview.totals.rowCount === 1 ? "" : "s"}`}
            </Button>
          </div>
        </>
      )}
    </section>
  );
}

function formatFieldLabelList(labels: string[]): string {
  if (labels.length === 0) return "selected fields";
  if (labels.length === 1) return labels[0] ?? "selected fields";
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]}`;
}
