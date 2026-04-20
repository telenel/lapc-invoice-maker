"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { BulkEditSidebar } from "@/components/bulk-edit/bulk-edit-sidebar";
import { SelectionPanel } from "@/components/bulk-edit/selection-panel";
import { TransformPanel } from "@/components/bulk-edit/transform-panel";
import { PreviewPanel } from "@/components/bulk-edit/preview-panel";
import { AuditLogList } from "@/components/bulk-edit/audit-log-list";
import { SaveSearchDialog } from "@/components/bulk-edit/save-search-dialog";
import { CommitConfirmDialog } from "@/components/bulk-edit/commit-confirm-dialog";
import { SyncDatabaseButton } from "@/components/products/sync-database-button";
import { PrismWriteWarningBanner } from "@/components/products/prism-write-warning-banner";
import { productApi } from "@/domains/product/api-client";
import type {
  BulkEditSelection,
  BulkEditTransform,
  PreviewResult,
  ProductFilters,
} from "@/domains/bulk-edit/types";

const EMPTY_SELECTION: BulkEditSelection = { scope: "pierce" };
const EMPTY_TRANSFORM: BulkEditTransform = { pricing: { mode: "none" }, catalog: {} };

export default function BulkEditPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selection, setSelection] = useState<BulkEditSelection>(EMPTY_SELECTION);
  const [transform, setTransform] = useState<BulkEditTransform>(EMPTY_TRANSFORM);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
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
      const result = await productApi.bulkEditDryRun({ selection, transform });
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
      const result = await productApi.bulkEditCommit({ selection, transform });
      if ("errors" in result) {
        setError((result.errors as Array<{ message: string }>).map((e) => e.message).join("; "));
        return;
      }
      setToast(`Committed ${result.successCount} change${result.successCount === 1 ? "" : "s"}. Run ${result.runId.slice(0, 8)}.`);
      setSelection(EMPTY_SELECTION);
      setTransform(EMPTY_TRANSFORM);
      setPreview(null);
      setConfirmOpen(false);
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

      <PrismWriteWarningBanner
        messages={[
          "Bulk edit commits write directly to Prism and the POS database.",
          "You must pass the preview and explicit confirmation gate before anything is saved.",
          "Shared Item-level fields can affect more than one location, so review the preview carefully.",
        ]}
      />

      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <BulkEditSidebar onLoadFilter={handleLoadFilter} refreshKey={sidebarKey} />

        <div className="space-y-6">
          <SelectionPanel
            selection={selection}
            onChange={setSelection}
            matchingCount={matchingCount}
            onSaveSearch={() => setSaveOpen(true)}
          />

          <TransformPanel
            transform={transform}
            onChange={setTransform}
            onPreview={runPreview}
            previewing={previewing}
            disabled={committing}
          />

          <PreviewPanel
            preview={preview}
            previewing={previewing}
            onCommit={() => setConfirmOpen(true)}
            committing={committing}
          />

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
      <CommitConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        preview={preview}
        onConfirm={actuallyCommit}
        submitting={committing}
      />
    </div>
  );
}
