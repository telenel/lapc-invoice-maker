"use client";

import { Button } from "@/components/ui/button";
import type { PreviewResult } from "@/domains/bulk-edit/types";

interface PreviewPanelProps {
  preview: PreviewResult | null;
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
        <p className="text-sm text-muted-foreground">Run a preview from the transform panel to see projected changes.</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-6 rounded bg-muted/40 px-4 py-3 text-sm">
            <div>
              <div className="text-muted-foreground">Rows</div>
              <div className="tabular-nums font-medium">{preview.totals.rowCount.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Pierce retail delta</div>
              <div className={`tabular-nums font-medium ${preview.totals.pricingDeltaCents < 0 ? "text-destructive" : ""}`}>
                {preview.totals.pricingDeltaCents >= 0 ? "+" : ""}
                ${(preview.totals.pricingDeltaCents / 100).toFixed(2)}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">District changes</div>
              <div className="tabular-nums font-medium">{preview.totals.districtChangeCount}</div>
            </div>
          </div>

          {preview.warnings.length > 0 ? (
            <div role="alert" aria-live="polite" className="rounded border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              <div className="font-medium">{preview.warnings.length} batch-level warning{preview.warnings.length === 1 ? "" : "s"}</div>
              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                {preview.warnings.map((w, i) => <li key={i}>{w.message}</li>)}
              </ul>
            </div>
          ) : null}

          <div className="max-h-96 overflow-auto rounded border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted">
                <tr>
                  <th className="px-2 py-2 text-left font-medium">SKU</th>
                  <th className="px-2 py-2 text-left font-medium">Description</th>
                  <th className="px-2 py-2 text-right font-medium">Retail</th>
                  <th className="px-2 py-2 text-right font-medium">Cost</th>
                  <th className="px-2 py-2 text-left font-medium">Changes</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((r) => (
                  <tr key={r.sku} className="border-t">
                    <td className="px-2 py-1 font-mono tabular-nums">{r.sku}</td>
                    <td className="px-2 py-1">{r.description}</td>
                    <td className="px-2 py-1 text-right tabular-nums">
                      {r.changedFields.includes("retail") ? (
                        <>
                          <span className="text-muted-foreground line-through">${r.before.retail.toFixed(2)}</span>{" "}
                          <span className="font-medium">${r.after.retail.toFixed(2)}</span>
                        </>
                      ) : (
                        `$${r.after.retail.toFixed(2)}`
                      )}
                    </td>
                    <td className="px-2 py-1 text-right tabular-nums">
                      {r.changedFields.includes("cost") ? (
                        <>
                          <span className="text-muted-foreground line-through">${r.before.cost.toFixed(2)}</span>{" "}
                          <span className="font-medium">${r.after.cost.toFixed(2)}</span>
                        </>
                      ) : (
                        `$${r.after.cost.toFixed(2)}`
                      )}
                    </td>
                    <td className="px-2 py-1 text-xs text-muted-foreground">
                      {r.changedFields.join(", ") || "-"}
                      {r.warnings.length > 0 ? (
                        <div className="mt-0.5 text-destructive">
                          {r.warnings.map((w) => w.message).join("; ")}
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
