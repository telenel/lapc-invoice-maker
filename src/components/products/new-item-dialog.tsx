"use client";

import { useState, useEffect, useCallback } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  productApi,
  type PrismRefs,
  type CreatedItem,
} from "@/domains/product/api-client";

interface NewItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (item: CreatedItem) => void;
}

interface FormState {
  description: string;
  vendorId: string;
  dccId: string;
  itemTaxTypeId: string;
  barcode: string;
  catalogNumber: string;
  comment: string;
  retail: string;
  cost: string;
}

const EMPTY_FORM: FormState = {
  description: "",
  vendorId: "",
  dccId: "",
  itemTaxTypeId: "6", // 9.75% CA standard default
  barcode: "",
  catalogNumber: "",
  comment: "",
  retail: "",
  cost: "",
};

export function NewItemDialog({ open, onOpenChange, onCreated }: NewItemDialogProps) {
  const [refs, setRefs] = useState<PrismRefs | null>(null);
  const [refsLoading, setRefsLoading] = useState(false);
  const [refsError, setRefsError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Fetch lookup data when the dialog opens
  useEffect(() => {
    if (!open || refs) return;
    setRefsLoading(true);
    setRefsError(null);
    productApi
      .refs()
      .then(setRefs)
      .catch((err: unknown) => {
        setRefsError(err instanceof Error ? err.message : "Failed to load reference data");
      })
      .finally(() => setRefsLoading(false));
  }, [open, refs]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setForm(EMPTY_FORM);
      setError(null);
    }
  }, [open]);

  const update = useCallback(<K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  async function handleSubmit() {
    setError(null);
    setSaving(true);
    try {
      const created = await productApi.create({
        description: form.description.trim(),
        vendorId: Number(form.vendorId),
        dccId: Number(form.dccId),
        itemTaxTypeId: form.itemTaxTypeId ? Number(form.itemTaxTypeId) : undefined,
        barcode: form.barcode.trim() || null,
        catalogNumber: form.catalogNumber.trim() || null,
        comment: form.comment.trim() || null,
        retail: Number(form.retail),
        cost: Number(form.cost),
      });
      onCreated?.(created);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create item");
    } finally {
      setSaving(false);
    }
  }

  const formValid =
    form.description.trim().length > 0 &&
    form.vendorId !== "" &&
    form.dccId !== "" &&
    form.retail !== "" &&
    form.cost !== "" &&
    Number(form.retail) >= 0 &&
    Number(form.cost) >= 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>New Merchandise Item</DialogTitle>
          <DialogDescription>
            Adds an item to the Pierce bookstore catalog. Writes directly to Prism
            and mirrors back to the laportal catalog.
          </DialogDescription>
        </DialogHeader>

        {refsLoading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Loading vendors and categories…
          </div>
        ) : refsError ? (
          <div className="py-4 rounded border border-destructive/30 bg-destructive/5 px-3 text-sm text-destructive">
            {refsError}
          </div>
        ) : refs ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2 space-y-1.5">
              <Label htmlFor="description">Description *</Label>
              <Input
                id="description"
                value={form.description}
                onChange={(e) => update("description", e.target.value)}
                maxLength={128}
                placeholder="e.g. PIERCE LOGO MUG 12OZ"
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="vendor">Vendor *</Label>
              <Select value={form.vendorId} onValueChange={(v) => update("vendorId", v ?? "")}>
                <SelectTrigger id="vendor">
                  <SelectValue placeholder="Select vendor" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {refs.vendors.map((v) => (
                    <SelectItem key={v.vendorId} value={String(v.vendorId)}>
                      {v.name} ({v.vendorId})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="dcc">Department / Class *</Label>
              <Select value={form.dccId} onValueChange={(v) => update("dccId", v ?? "")}>
                <SelectTrigger id="dcc">
                  <SelectValue placeholder="Select DCC" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {refs.dccs.map((d) => (
                    <SelectItem key={d.dccId} value={String(d.dccId)}>
                      {d.deptName}
                      {d.className ? ` › ${d.className}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cost">Cost *</Label>
              <Input
                id="cost"
                type="number"
                step="0.01"
                min="0"
                value={form.cost}
                onChange={(e) => update("cost", e.target.value)}
                placeholder="0.00"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="retail">Retail Price *</Label>
              <Input
                id="retail"
                type="number"
                step="0.01"
                min="0"
                value={form.retail}
                onChange={(e) => update("retail", e.target.value)}
                placeholder="0.00"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="barcode">Barcode</Label>
              <Input
                id="barcode"
                value={form.barcode}
                onChange={(e) => update("barcode", e.target.value)}
                maxLength={20}
                placeholder="Optional UPC/EAN"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="catalogNumber">Catalog #</Label>
              <Input
                id="catalogNumber"
                value={form.catalogNumber}
                onChange={(e) => update("catalogNumber", e.target.value)}
                maxLength={30}
                placeholder="Optional vendor part #"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="taxType">Tax Type</Label>
              <Select
                value={form.itemTaxTypeId}
                onValueChange={(v) => update("itemTaxTypeId", v ?? "")}
              >
                <SelectTrigger id="taxType">
                  <SelectValue placeholder="Select tax type" />
                </SelectTrigger>
                <SelectContent>
                  {refs.taxTypes.map((t) => (
                    <SelectItem key={t.taxTypeId} value={String(t.taxTypeId)}>
                      {t.description}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="sm:col-span-2 space-y-1.5">
              <Label htmlFor="comment">Comment</Label>
              <Textarea
                id="comment"
                value={form.comment}
                onChange={(e) => update("comment", e.target.value)}
                maxLength={25}
                placeholder="Optional internal note (max 25 chars)"
                rows={2}
              />
            </div>

            {error ? (
              <div className="sm:col-span-2 rounded border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            ) : null}
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!formValid || saving || !refs}>
            {saving ? "Creating…" : "Create Item"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
