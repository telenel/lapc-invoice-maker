"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
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
import { Loader2Icon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  productApi,
  type PrismRefs,
  type CreatedItem,
} from "@/domains/product/api-client";
import { ItemRefSelects } from "./item-ref-selects";
import { computeMargin } from "./batch-add-grid";

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
  itemTaxTypeId: "6",
  barcode: "",
  catalogNumber: "",
  comment: "",
  retail: "",
  cost: "",
};

const MARGIN_TONE_CLASS = {
  good: "text-emerald-600 dark:text-emerald-400",
  warn: "text-amber-600 dark:text-amber-400",
  bad: "text-destructive",
  idle: "text-muted-foreground",
} as const;

export function NewItemDialog({ open, onOpenChange, onCreated }: NewItemDialogProps) {
  const [refs, setRefs] = useState<PrismRefs | null>(null);
  const [refsLoading, setRefsLoading] = useState(false);
  const [refsError, setRefsError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const descriptionRef = useRef<HTMLInputElement | null>(null);

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

  useEffect(() => {
    if (!open) {
      setForm(EMPTY_FORM);
      setError(null);
    }
  }, [open]);

  const update = useCallback(<K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const formValid =
    form.description.trim().length > 0 &&
    form.vendorId !== "" &&
    form.dccId !== "" &&
    form.retail !== "" &&
    form.cost !== "" &&
    Number(form.retail) >= 0 &&
    Number(form.cost) >= 0;

  async function submit(keepOpen: boolean) {
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
      toast.success(`Created SKU ${created.sku}`);
      if (keepOpen) {
        setForm((prev) => ({
          ...EMPTY_FORM,
          vendorId: prev.vendorId,
          dccId: prev.dccId,
          itemTaxTypeId: prev.itemTaxTypeId,
        }));
        requestAnimationFrame(() => descriptionRef.current?.focus());
      } else {
        onOpenChange(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create item");
    } finally {
      setSaving(false);
    }
  }

  const margin = computeMargin(form.cost, form.retail);

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
          <div
            role="status"
            aria-live="polite"
            className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground"
          >
            <Loader2Icon className="size-4 animate-spin" aria-hidden />
            Loading vendors and categories…
          </div>
        ) : refsError ? (
          <div
            role="alert"
            aria-live="polite"
            className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-3 text-sm text-destructive"
          >
            {refsError}
          </div>
        ) : refs ? (
          <div className="space-y-5">
            {/* Identity */}
            <section aria-labelledby="new-item-identity" className="space-y-3">
              <SectionHeading id="new-item-identity">Identity</SectionHeading>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2 space-y-1.5">
                  <Label htmlFor="description">
                    Description <Required />
                  </Label>
                  <Input
                    id="description"
                    name="description"
                    autoComplete="off"
                    value={form.description}
                    onChange={(e) => update("description", e.target.value)}
                    maxLength={128}
                    placeholder="PIERCE LOGO MUG 12OZ"
                    autoFocus
                    ref={descriptionRef}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="barcode">Barcode</Label>
                  <Input
                    id="barcode"
                    name="barcode"
                    autoComplete="off"
                    spellCheck={false}
                    value={form.barcode}
                    onChange={(e) => update("barcode", e.target.value)}
                    maxLength={20}
                    placeholder="Optional UPC / EAN"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="catalogNumber">Catalog #</Label>
                  <Input
                    id="catalogNumber"
                    name="catalogNumber"
                    autoComplete="off"
                    spellCheck={false}
                    value={form.catalogNumber}
                    onChange={(e) => update("catalogNumber", e.target.value)}
                    maxLength={30}
                    placeholder="Optional vendor part #"
                  />
                </div>
              </div>
            </section>

            {/* Classification */}
            <section aria-labelledby="new-item-classification" className="space-y-3">
              <SectionHeading
                id="new-item-classification"
                hint="Tax defaults to 9.75% CA standard"
              >
                Classification
              </SectionHeading>
              <div className="grid gap-4 sm:grid-cols-2">
                <ItemRefSelects
                  refs={refs}
                  vendorId={form.vendorId}
                  dccId={form.dccId}
                  itemTaxTypeId={form.itemTaxTypeId}
                  onChange={(field, value) => setForm((f) => ({ ...f, [field]: value }))}
                />
              </div>
            </section>

            {/* Pricing */}
            <section aria-labelledby="new-item-pricing" className="space-y-3">
              <SectionHeading id="new-item-pricing">Pricing</SectionHeading>
              <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto]">
                <MoneyField
                  id="cost"
                  label="Cost"
                  required
                  value={form.cost}
                  onChange={(v) => update("cost", v)}
                />
                <MoneyField
                  id="retail"
                  label="Retail"
                  required
                  value={form.retail}
                  onChange={(v) => update("retail", v)}
                />
                <div className="flex flex-col justify-end">
                  <Label className="text-muted-foreground">Margin</Label>
                  <div
                    className={cn(
                      "mt-1.5 inline-flex h-9 items-center justify-center rounded-md border border-dashed border-border/60 bg-muted/20 px-3 text-sm font-medium tabular-nums",
                      MARGIN_TONE_CLASS[margin.tone],
                    )}
                    aria-live="polite"
                  >
                    {margin.pct === null ? "—" : `${margin.pct.toFixed(1)}%`}
                  </div>
                </div>
              </div>
            </section>

            {/* Comment */}
            <section aria-labelledby="new-item-comment" className="space-y-1.5">
              <Label htmlFor="comment">
                Comment{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  (internal note, max 25 chars)
                </span>
              </Label>
              <Input
                id="comment"
                name="comment"
                autoComplete="off"
                value={form.comment}
                onChange={(e) => update("comment", e.target.value)}
                maxLength={25}
                placeholder="Optional"
              />
            </section>

            {error ? (
              <div
                role="alert"
                aria-live="polite"
                className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
              >
                {error}
              </div>
            ) : null}
          </div>
        ) : null}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => submit(true)}
              disabled={!formValid || saving || !refs}
              title="Create this item and clear the form for another"
            >
              {saving ? (
                <Loader2Icon className="mr-1 size-3.5 animate-spin" aria-hidden />
              ) : null}
              Create & add another
            </Button>
            <Button onClick={() => submit(false)} disabled={!formValid || saving || !refs}>
              {saving ? (
                <Loader2Icon className="mr-1 size-3.5 animate-spin" aria-hidden />
              ) : null}
              {saving ? "Creating…" : "Create Item"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SectionHeading({
  id,
  children,
  hint,
}: {
  id: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border/50 pb-1">
      <h3
        id={id}
        className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
      >
        {children}
      </h3>
      {hint ? <span className="text-xs text-muted-foreground/70">{hint}</span> : null}
    </div>
  );
}

function Required() {
  return (
    <span className="text-destructive" aria-label="required">
      *
    </span>
  );
}

interface MoneyFieldProps {
  id: string;
  label: string;
  required?: boolean;
  value: string;
  onChange: (value: string) => void;
}

function MoneyField({ id, label, required, value, onChange }: MoneyFieldProps) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {label}
        {required ? (
          <>
            {" "}
            <Required />
          </>
        ) : null}
      </Label>
      <div className="relative">
        <span
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground"
          aria-hidden
        >
          $
        </span>
        <Input
          id={id}
          name={id}
          autoComplete="off"
          inputMode="decimal"
          type="number"
          step="0.01"
          min="0"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0.00"
          className="pl-6 text-right tabular-nums"
        />
      </div>
    </div>
  );
}
