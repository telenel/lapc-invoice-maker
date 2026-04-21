"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { BulkEditSidebar } from "@/components/bulk-edit/bulk-edit-sidebar";
import { CommitConfirmDialog } from "@/components/bulk-edit/commit-confirm-dialog";
import { SelectionPanel } from "@/components/bulk-edit/selection-panel";
import type { BulkEditSelectionSummaryItem } from "@/components/bulk-edit/selection-panel";
import { TransformPanel } from "@/components/bulk-edit/transform-panel";
import { PreviewPanel } from "@/components/bulk-edit/preview-panel";
import { AuditLogList } from "@/components/bulk-edit/audit-log-list";
import { SaveSearchDialog } from "@/components/bulk-edit/save-search-dialog";
import { SyncDatabaseButton } from "@/components/products/sync-database-button";
import { productApi } from "@/domains/product/api-client";
import {
  formatProductLocationList,
  getPrimaryProductLocationId,
  parseProductLocationIdsParam,
  PRODUCT_LOCATION_ABBREV_BY_ID,
} from "@/domains/product/location-filters";
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
  const locationIds = parseProductLocationIdsParam(searchParams.get("loc"));
  const primaryLocationId = getPrimaryProductLocationId(locationIds);
  const [selection, setSelection] = useState<BulkEditSelection>(EMPTY_SELECTION);
  const [transform, setTransform] = useState<BulkEditFieldEditRequest["transform"]>(EMPTY_TRANSFORM);
  const [preview, setPreview] = useState<BulkEditFieldPreview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [sidebarKey, setSidebarKey] = useState(0);
  const [matchingCount, setMatchingCount] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<BulkEditSelectionSummaryItem[]>([]);
  const [selectedItemsLoading, setSelectedItemsLoading] = useState(false);
  const [selectedItemsError, setSelectedItemsError] = useState<string | null>(null);

  useEffect(() => {
    const raw = searchParams.get("preloadSkus");
    if (raw) {
      const skus = raw.split(",").map((s) => Number(s.trim())).filter((n) => Number.isInteger(n) && n > 0);
      if (skus.length > 0) setSelection({ scope: "pierce", skus });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const skus = selection.skus ?? [];
    if (skus.length === 0) {
      setSelectedItems([]);
      setSelectedItemsLoading(false);
      setSelectedItemsError(null);
      return;
    }

    let cancelled = false;
    setSelectedItemsLoading(true);
    setSelectedItemsError(null);

    productApi
      .editContext(skus)
      .then((result) => {
        if (cancelled) return;
        const items = (result.items ?? [])
          .map((item) => item.summary)
          .filter((summary): summary is NonNullable<typeof summary> => summary != null && typeof summary.sku === "number")
          .map((summary) => ({
            sku: summary.sku,
            displayName: summary.displayName?.trim() || `SKU ${summary.sku}`,
            barcode: summary.barcode ?? null,
            vendorLabel: summary.vendorLabel ?? null,
            dccLabel: summary.dccLabel ?? null,
            typeLabel: summary.typeLabel ?? "Item",
          }));
        setSelectedItems(items);
      })
      .catch((err) => {
        if (cancelled) return;
        setSelectedItems([]);
        setSelectedItemsError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) {
          setSelectedItemsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selection.skus]);

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
    const fieldSummary = formatFieldLabelList(preview?.changedFieldLabels ?? []);

    try {
      const result = await productApi.bulkEditFieldCommit({ selection, transform });
      if ("errors" in result) {
        setError((result.errors as Array<{ message: string }>).map((e) => e.message).join("; "));
        return;
      }

      const successMessage = `Applied ${fieldSummary} to ${result.successCount} item${result.successCount === 1 ? "" : "s"}.`;
      toast.success(successMessage);
      setToastMessage(successMessage);
      setConfirmOpen(false);
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
          <div className="rounded-lg border border-border/70 bg-muted/25 px-4 py-3 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">
              Primary location: {PRODUCT_LOCATION_ABBREV_BY_ID[primaryLocationId]}
            </span>{" "}
            <span>
              · Current scope: {formatProductLocationList(locationIds)} · Inventory field edits apply only to the selected inventory scope for these locations.
            </span>
          </div>

          <SelectionPanel
            selection={selection}
            onChange={handleSelectionChange}
            matchingCount={matchingCount}
            onSaveSearch={() => setSaveOpen(true)}
            selectedItems={selectedItems}
            selectedItemsLoading={selectedItemsLoading}
            selectedItemsError={selectedItemsError}
          />

          <TransformPanel
            transform={transform}
            onChange={handleTransformChange}
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
          {toastMessage ? (
            <p role="status" aria-live="polite" className="rounded border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">
              {toastMessage}
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

function formatFieldLabelList(labels: string[]): string {
  if (labels.length === 0) return "selected fields";
  if (labels.length === 1) return labels[0] ?? "selected fields";
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]}`;
}
