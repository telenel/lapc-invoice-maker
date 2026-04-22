"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ItemRefSelects } from "./item-ref-selects";
import { productApi } from "@/domains/product/api-client";
import type { GmItemPatch, TextbookPatch, ItemSnapshot, SelectedProduct } from "@/domains/product/types";
import { useProductRefDirectory } from "@/domains/product/vendor-directory";

export type SavedScopedItemsOptions = {
  retainUntilMatch?: boolean;
};

export interface EditItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Rows to edit. Pass as ItemSnapshot[] — one per selected SKU. */
  items: Array<ItemSnapshot & {
    description?: string;
    vendorId?: number;
    dccId?: number;
    itemTaxTypeId?: number;
    isTextbook?: boolean;
    comment?: string;
    catalogNumber?: string;
    packageType?: string;
    unitsPerPack?: number;
    author?: string | null;
    title?: string | null;
    isbn?: string | null;
    edition?: string | null;
    itemType?: string;
  }>;
  onSaved?: (skus: number[]) => void;
  onSavedScopedItems?: (items: SelectedProduct[], options?: SavedScopedItemsOptions) => void;
  knownScopedItemsByKey?: ReadonlyMap<string, SelectedProduct>;
}

type FormState = Partial<{
  description: string;
  vendorId: string;
  dccId: string;
  itemTaxTypeId: string;
  barcode: string;
  catalogNumber: string;
  comment: string;
  retail: string;
  cost: string;
  packageType: string;
  unitsPerPack: string;
  fDiscontinue: string;
}>;

/** Diff a baseline state against a current state; return only the changed fields as a patch. */
export function buildPatch(baseline: Record<string, unknown>, current: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(current)) {
    const b = baseline[key];
    const c = current[key];
    if (b === c) continue;
    if (key === "barcode" && typeof c === "string" && c.length === 0) {
      out.barcode = null;
      continue;
    }
    out[key] = c;
  }
  return out;
}

export function EditItemDialogLegacy({ open, onOpenChange, items, onSaved }: EditItemDialogProps) {
  const isBulk = items.length > 1;
  const hasTextbook = items.some((i) => i.isTextbook);
  const narrow = hasTextbook; // mixed or all-textbook → narrow mode
  const { refs, loading: refsLoading, available: refsAvailable } = useProductRefDirectory();
  const [form, setForm] = useState<FormState>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refsUnavailable = !refsLoading && !refsAvailable;
  const refsControlsDisabled = refsLoading || refsUnavailable;

  // Reset form when items change
  useEffect(() => {
    if (!open) return;
    if (isBulk) {
      setForm({});
      return;
    }
    const it = items[0];
    setForm({
      description: it.description ?? "",
      vendorId: it.vendorId ? String(it.vendorId) : "",
      dccId: it.dccId ? String(it.dccId) : "",
      itemTaxTypeId: it.itemTaxTypeId ? String(it.itemTaxTypeId) : "",
      barcode: it.barcode ?? "",
      catalogNumber: it.catalogNumber ?? "",
      comment: it.comment ?? "",
      retail: it.retail != null ? String(it.retail) : "",
      cost: it.cost != null ? String(it.cost) : "",
      packageType: it.packageType ?? "",
      unitsPerPack: it.unitsPerPack ? String(it.unitsPerPack) : "",
      fDiscontinue: String(it.fDiscontinue),
    });
  }, [open, items, isBulk]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);

    const baseline = isBulk ? {} : (() => {
      const it = items[0];
      return {
        description: it.description ?? "",
        vendorId: it.vendorId ? String(it.vendorId) : "",
        dccId: it.dccId ? String(it.dccId) : "",
        itemTaxTypeId: it.itemTaxTypeId ? String(it.itemTaxTypeId) : "",
        barcode: it.barcode ?? "",
        catalogNumber: it.catalogNumber ?? "",
        comment: it.comment ?? "",
        retail: it.retail != null ? String(it.retail) : "",
        cost: it.cost != null ? String(it.cost) : "",
        packageType: it.packageType ?? "",
        unitsPerPack: it.unitsPerPack ? String(it.unitsPerPack) : "",
        fDiscontinue: String(it.fDiscontinue),
      };
    })();

    const rawPatch = buildPatch(baseline, form as Record<string, unknown>);
    // Convert string fields to correct types; drop empty strings for bulk mode fields the user didn't touch
    const patch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rawPatch)) {
      if (v === "" && isBulk) continue; // skip untouched bulk fields
      if (k === "retail" || k === "cost" || k === "weight") patch[k] = Number(v);
      else if (k === "vendorId" || k === "dccId" || k === "itemTaxTypeId" || k === "unitsPerPack") patch[k] = v ? Number(v) : undefined;
      else if (k === "fDiscontinue") patch[k] = Number(v) === 1 ? 1 : 0;
      else patch[k] = v;
    }
    // Remove undefined entries from the patch
    for (const k of Object.keys(patch)) if (patch[k] === undefined) delete patch[k];

    try {
      if (items.length === 1) {
        const it = items[0];
        await productApi.update(it.sku, {
          patch: patch as GmItemPatch | TextbookPatch,
          isTextbook: !!it.isTextbook,
          baseline: { sku: it.sku, barcode: it.barcode, retail: it.retail, cost: it.cost, fDiscontinue: it.fDiscontinue, primaryLocationId: it.primaryLocationId },
        });
      } else {
        const result = await productApi.batch({
          action: "update",
          rows: items.map((i) => ({ sku: i.sku, patch: patch as GmItemPatch | TextbookPatch, isTextbook: !!i.isTextbook, baseline: { sku: i.sku, barcode: i.barcode, retail: i.retail, cost: i.cost, fDiscontinue: i.fDiscontinue, primaryLocationId: i.primaryLocationId } })),
        });
        if ("errors" in result && result.errors.length > 0) {
          setError(result.errors.map((e) => `Row ${e.rowIndex + 1}: ${e.message}`).join("; "));
          return;
        }
      }
      onSaved?.(items.map((i) => i.sku));
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  // Detect unsaved changes so we can warn on close
  function hasUnsavedChanges(): boolean {
    if (!isBulk) {
      const it = items[0];
      if (!it) return false;
      return (
        (form.description ?? "") !== (it.description ?? "") ||
        (form.barcode ?? "") !== (it.barcode ?? "") ||
        form.retail !== String(it.retail) ||
        form.cost !== String(it.cost) ||
        (form.catalogNumber ?? "") !== (it.catalogNumber ?? "") ||
        (form.comment ?? "") !== (it.comment ?? "") ||
        (form.vendorId ?? "") !== (it.vendorId ? String(it.vendorId) : "") ||
        (form.dccId ?? "") !== (it.dccId ? String(it.dccId) : "") ||
        (form.itemTaxTypeId ?? "") !== (it.itemTaxTypeId ? String(it.itemTaxTypeId) : "")
      );
    }
    // bulk mode: any non-empty field is a change
    return Object.values(form).some((v) => v !== "" && v !== undefined);
  }

  function handleClose(nextOpen: boolean) {
    if (!nextOpen && hasUnsavedChanges()) {
      const ok = window.confirm("Discard unsaved changes?");
      if (!ok) return;
    }
    onOpenChange(nextOpen);
  }

  const uid = items[0]?.sku ?? "bulk";
  const idFor = (field: string) => `edit-${uid}-${field}`;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isBulk ? `Edit ${items.length} items` : `Edit SKU ${items[0]?.sku}`}</DialogTitle>
          <DialogDescription>
            {isBulk ? "Fields left blank won\u2019t be changed. Fields you fill will be applied to all selected items." : "Only changed fields will be written."}
            {hasTextbook ? " (textbook-safe fields only)" : null}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          {!narrow && (
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor={idFor("description")}>Description</Label>
              <Input
                id={idFor("description")}
                name="description"
                autoComplete="off"
                placeholder={isBulk ? "Leave unchanged (per-row)…" : ""}
                value={form.description ?? ""}
                disabled={isBulk}
                onChange={(e) => update("description", e.target.value)}
                autoFocus={!isBulk}
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor={idFor("barcode")}>Barcode</Label>
            <Input
              id={idFor("barcode")}
              name="barcode"
              autoComplete="off"
              spellCheck={false}
              placeholder={isBulk ? "Leave unchanged (per-row)…" : ""}
              value={form.barcode ?? ""}
              disabled={isBulk}
              onChange={(e) => update("barcode", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={idFor("retail")}>Retail</Label>
            <Input
              id={idFor("retail")}
              name="retail"
              autoComplete="off"
              inputMode="decimal"
              type="number"
              step="0.01"
              min="0"
              placeholder={isBulk ? "Leave unchanged…" : ""}
              value={form.retail ?? ""}
              onChange={(e) => update("retail", e.target.value)}
              className="tabular-nums"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={idFor("cost")}>Cost</Label>
            <Input
              id={idFor("cost")}
              name="cost"
              autoComplete="off"
              inputMode="decimal"
              type="number"
              step="0.01"
              min="0"
              placeholder={isBulk ? "Leave unchanged…" : ""}
              value={form.cost ?? ""}
              onChange={(e) => update("cost", e.target.value)}
              className="tabular-nums"
            />
          </div>

          {!narrow && (
            <div className="space-y-2 sm:col-span-2">
              {refsLoading ? (
                <div role="status" aria-live="polite" className="rounded border border-amber-300/70 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800/70 dark:bg-amber-950/30 dark:text-amber-200">
                  Loading reference data...
                </div>
              ) : null}
              {refsUnavailable ? (
                <div role="alert" aria-live="polite" className="rounded border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                  Reference data is unavailable right now. Vendor, department/class, and tax type lookups are disabled until Prism recovers.
                </div>
              ) : null}
              <ItemRefSelects
                refs={refs}
                vendorId={form.vendorId ?? ""}
                dccId={form.dccId ?? ""}
                itemTaxTypeId={form.itemTaxTypeId ?? ""}
                onChange={(field, value) => update(field, value)}
                bulkMode={isBulk}
                disabled={refsControlsDisabled}
              />
            </div>
          )}

          {!narrow && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor={idFor("catalogNumber")}>Catalog #</Label>
                <Input
                  id={idFor("catalogNumber")}
                  name="catalogNumber"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder={isBulk ? "Leave unchanged…" : ""}
                  value={form.catalogNumber ?? ""}
                  onChange={(e) => update("catalogNumber", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={idFor("comment")}>Comment</Label>
                <Input
                  id={idFor("comment")}
                  name="comment"
                  autoComplete="off"
                  placeholder={isBulk ? "Leave unchanged…" : ""}
                  value={form.comment ?? ""}
                  onChange={(e) => update("comment", e.target.value)}
                />
              </div>
            </>
          )}
        </div>

        {error ? (
          <div role="alert" aria-live="polite" className="rounded border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : isBulk ? `Apply to ${items.length}` : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
