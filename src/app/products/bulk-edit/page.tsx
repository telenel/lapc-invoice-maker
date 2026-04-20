"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { BulkEditSidebar } from "@/components/bulk-edit/bulk-edit-sidebar";
import { SelectionPanel } from "@/components/bulk-edit/selection-panel";
import { TransformPanel } from "@/components/bulk-edit/transform-panel";
import { AuditLogList } from "@/components/bulk-edit/audit-log-list";
import { SaveSearchDialog } from "@/components/bulk-edit/save-search-dialog";
import { SyncDatabaseButton } from "@/components/products/sync-database-button";
import { productApi } from "@/domains/product/api-client";
import type {
  BulkEditFieldEditRequest,
  BulkEditFieldPreview,
  BulkEditSelection,
  ProductFilters,
} from "@/domains/bulk-edit/types";

const EMPTY_SELECTION: BulkEditSelection = { scope: "pierce" };
const EMPTY_TRANSFORM: BulkEditFieldEditRequest["transform"] = {
  fieldIds: [],
  inventoryScope: null,
  values: {},
};

export default function BulkEditPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selection, setSelection] = useState<BulkEditSelection>(EMPTY_SELECTION);
  const [transform, setTransform] = useState<BulkEditFieldEditRequest["transform"]>(EMPTY_TRANSFORM);
  const [preview, setPreview] = useState<BulkEditFieldPreview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [sidebarKey, setSidebarKey] = useState(0);
  const [matchingCount, setMatchingCount] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Honor ?preloadSkus=1,2,3 (from the products-page "Bulk Edit" selection shortcut)
  useEffect(() => {
    const raw = searchParams.get("preloadSkus");
    if (raw) {
      const skus = raw.split(",").map((s) => Number(s.trim())).filter((n) => Number.isInteger(n) && n > 0);
      if (skus.length > 0) setSelection({ scope: "pierce", skus });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runPreview = useCallback(async () => {
    setPreviewing(true);
    setError(null);
    try {
      const result = await productApi.bulkEditFieldDryRun({ selection, transform });
      if ("errors" in result) {
        setError((result.errors as Array<{ message: string }>).map((e) => e.message).join("; "));
        setPreview(null);
      } else {
        setPreview(result);
        setMatchingCount(result.totals.rowCount);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPreview(null);
    } finally {
      setPreviewing(false);
    }
  }, [selection, transform]);

  async function actuallyCommit() {
    setCommitting(true);
    setError(null);
    try {
      const result = await productApi.bulkEditFieldCommit({ selection, transform });
      if ("errors" in result) {
        setError((result.errors as Array<{ message: string }>).map((e) => e.message).join("; "));
        return;
      }
      setToast(`Committed ${result.successCount} change${result.successCount === 1 ? "" : "s"}. Run ${result.runId.slice(0, 8)}.`);
      setSelection(EMPTY_SELECTION);
      setTransform(EMPTY_TRANSFORM);
      setPreview(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCommitting(false);
    }
  }

  function handleLoadFilter(f: ProductFilters) {
    setSelection({ scope: selection.scope, filter: f });
    setPreview(null);
  }

  function handleSelectionChange(next: BulkEditSelection) {
    setSelection(next);
    setPreview(null);
  }

  function handleTransformChange(next: BulkEditFieldEditRequest["transform"]) {
    setTransform(next);
    setPreview(null);
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Bulk Edit Workspace</h1>
          <p className="text-sm text-muted-foreground">Select, transform, preview, commit. Changes are not undoable; the preview is your safety net.</p>
        </div>
        <div className="flex items-center gap-3">
          <SyncDatabaseButton />
          <Button variant="outline" render={<Link href="/products" />}>
            &larr; Products
          </Button>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <BulkEditSidebar onLoadFilter={handleLoadFilter} refreshKey={sidebarKey} />

        <div className="space-y-6">
          <SelectionPanel
            selection={selection}
            onChange={handleSelectionChange}
            matchingCount={matchingCount}
            onSaveSearch={() => setSaveOpen(true)}
          />

          <TransformPanel
            transform={transform}
            onChange={handleTransformChange}
            onPreview={runPreview}
            previewing={previewing}
            disabled={committing}
          />

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
                      Showing 8 of {preview.rows.length} preview rows. Task 5 will expand the result surface.
                    </p>
                  ) : null}
                </div>

                <div className="flex justify-end">
                  <Button onClick={actuallyCommit} disabled={committing || preview.totals.rowCount === 0}>
                    {committing ? "Applying..." : `Commit ${preview.totals.rowCount} Change${preview.totals.rowCount === 1 ? "" : "s"}`}
                  </Button>
                </div>
              </>
            )}
          </section>

          {error ? (
            <p role="alert" aria-live="polite" className="rounded border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}
          {toast ? (
            <p role="status" aria-live="polite" className="rounded border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">
              {toast}
            </p>
          ) : null}

          <AuditLogList />
        </div>
      </div>

      <SaveSearchDialog
        open={saveOpen}
        onOpenChange={setSaveOpen}
        currentFilter={(selection.filter ?? {}) as Record<string, unknown>}
        onSaved={() => setSidebarKey((k) => k + 1)}
      />
    </div>
  );
}
