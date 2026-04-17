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
import { productApi, type PrismRefs } from "@/domains/product/api-client";
import type { GmItemPatch, TextbookPatch, ItemSnapshot } from "@/domains/product/types";

interface EditItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Rows to edit. Pass as ItemSnapshot[] — one per selected SKU. */
  items: Array<ItemSnapshot & { description?: string; vendorId?: number; dccId?: number; itemTaxTypeId?: number; isTextbook?: boolean; comment?: string; catalogNumber?: string; packageType?: string; unitsPerPack?: number }>;
  onSaved?: (skus: number[]) => void;
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

export function EditItemDialog({ open, onOpenChange, items, onSaved }: EditItemDialogProps) {
  const isBulk = items.length > 1;
  const hasTextbook = items.some((i) => i.isTextbook);
  const narrow = hasTextbook; // mixed or all-textbook → narrow mode
  const [refs, setRefs] = useState<PrismRefs | null>(null);
  const [form, setForm] = useState<FormState>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load refs once
  useEffect(() => {
    if (!open || refs) return;
    productApi.refs().then(setRefs).catch((e) => setError(String(e)));
  }, [open, refs]);

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
      retail: String(it.retail),
      cost: String(it.cost),
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
        retail: String(it.retail),
        cost: String(it.cost),
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
          baseline: { sku: it.sku, barcode: it.barcode, retail: it.retail, cost: it.cost, fDiscontinue: it.fDiscontinue },
        });
      } else {
        const result = await productApi.batch({
          action: "update",
          rows: items.map((i) => ({ sku: i.sku, patch: patch as GmItemPatch | TextbookPatch, isTextbook: !!i.isTextbook })),
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isBulk ? `Edit ${items.length} items` : `Edit SKU ${items[0]?.sku}`}</DialogTitle>
          <DialogDescription>
            {isBulk ? "Fields left blank won't be changed. Fields you fill will be applied to all selected items." : "Only changed fields will be written."}
            {hasTextbook ? " (textbook-safe fields only)" : null}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4">
          {!narrow && (
            <div className="col-span-2 space-y-1.5">
              <Label>Description</Label>
              <Input
                placeholder={isBulk ? "Leave unchanged (per-row)" : ""}
                value={form.description ?? ""}
                disabled={isBulk}
                onChange={(e) => update("description", e.target.value)}
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Barcode</Label>
            <Input
              placeholder={isBulk ? "Leave unchanged (per-row)" : ""}
              value={form.barcode ?? ""}
              disabled={isBulk}
              onChange={(e) => update("barcode", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Retail</Label>
            <Input
              type="number" step="0.01"
              placeholder={isBulk ? "Leave unchanged" : ""}
              value={form.retail ?? ""}
              onChange={(e) => update("retail", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Cost</Label>
            <Input
              type="number" step="0.01"
              placeholder={isBulk ? "Leave unchanged" : ""}
              value={form.cost ?? ""}
              onChange={(e) => update("cost", e.target.value)}
            />
          </div>

          {!narrow && (
            <ItemRefSelects
              refs={refs}
              vendorId={form.vendorId ?? ""}
              dccId={form.dccId ?? ""}
              itemTaxTypeId={form.itemTaxTypeId ?? ""}
              onChange={(field, value) => update(field, value)}
              bulkMode={isBulk}
            />
          )}

          {!narrow && (
            <>
              <div className="space-y-1.5">
                <Label>Catalog #</Label>
                <Input
                  placeholder={isBulk ? "Leave unchanged" : ""}
                  value={form.catalogNumber ?? ""}
                  onChange={(e) => update("catalogNumber", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Comment</Label>
                <Input
                  placeholder={isBulk ? "Leave unchanged" : ""}
                  value={form.comment ?? ""}
                  onChange={(e) => update("comment", e.target.value)}
                />
              </div>
            </>
          )}
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : isBulk ? `Apply to ${items.length}` : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
