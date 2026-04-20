"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { productApi } from "@/domains/product/api-client";
import type { ProductEditDetails, ProductEditPatchV2 } from "@/domains/product/types";
import { useProductRefDirectory } from "@/domains/product/vendor-directory";
import type { EditItemDialogProps } from "./edit-item-dialog-legacy";
import { buildPatch } from "./edit-item-dialog-legacy";
import { ItemRefSelectField } from "./item-ref-selects";

export interface EditItemDialogV2Props extends EditItemDialogProps {
  detail?: ProductEditDetails | null;
  detailLoading?: boolean;
}

type FormState = {
  description: string;
  barcode: string;
  vendorId: string;
  dccId: string;
  itemTaxTypeId: string;
  retail: string;
  cost: string;
  catalogNumber: string;
  comment: string;
  fDiscontinue: boolean;
  packageType: string;
  unitsPerPack: string;
  imageUrl: string;
  weight: string;
  altVendorId: string;
  mfgId: string;
  size: string;
  colorId: string;
  styleId: string;
  itemSeasonCodeId: string;
  orderIncrement: string;
  fListPriceFlag: boolean;
  fPerishable: boolean;
  fIdRequired: boolean;
  minOrderQtyItem: string;
  usedDccId: string;
};

const EMPTY_FORM: FormState = {
  description: "",
  barcode: "",
  vendorId: "",
  dccId: "",
  itemTaxTypeId: "",
  retail: "",
  cost: "",
  catalogNumber: "",
  comment: "",
  fDiscontinue: false,
  packageType: "",
  unitsPerPack: "",
  imageUrl: "",
  weight: "",
  altVendorId: "",
  mfgId: "",
  size: "",
  colorId: "",
  styleId: "",
  itemSeasonCodeId: "",
  orderIncrement: "",
  fListPriceFlag: false,
  fPerishable: false,
  fIdRequired: false,
  minOrderQtyItem: "",
  usedDccId: "",
};

function toFormState(item: EditItemDialogProps["items"][number] | undefined, detail?: ProductEditDetails | null): FormState {
  return {
    description: detail?.description ?? item?.description ?? "",
    barcode: detail?.barcode ?? item?.barcode ?? "",
    vendorId: detail?.vendorId ? String(detail.vendorId) : item?.vendorId ? String(item.vendorId) : "",
    dccId: detail?.dccId ? String(detail.dccId) : item?.dccId ? String(item.dccId) : "",
    itemTaxTypeId: detail?.itemTaxTypeId ? String(detail.itemTaxTypeId) : item?.itemTaxTypeId ? String(item.itemTaxTypeId) : "",
    retail: detail?.retail != null ? String(detail.retail) : item?.retail != null ? String(item.retail) : "",
    cost: detail?.cost != null ? String(detail.cost) : item?.cost != null ? String(item.cost) : "",
    catalogNumber: detail?.catalogNumber ?? item?.catalogNumber ?? "",
    comment: detail?.comment ?? item?.comment ?? "",
    fDiscontinue: (detail?.fDiscontinue ?? item?.fDiscontinue ?? 0) === 1,
    packageType: detail?.packageType ?? item?.packageType ?? "",
    unitsPerPack: detail?.unitsPerPack != null ? String(detail.unitsPerPack) : item?.unitsPerPack != null ? String(item.unitsPerPack) : "",
    imageUrl: detail?.imageUrl ?? "",
    weight: detail?.weight != null ? String(detail.weight) : "",
    altVendorId: detail?.altVendorId ? String(detail.altVendorId) : "",
    mfgId: detail?.mfgId ? String(detail.mfgId) : "",
    size: detail?.size ?? "",
    colorId: detail?.colorId ? String(detail.colorId) : "",
    styleId: detail?.styleId ? String(detail.styleId) : "",
    itemSeasonCodeId: detail?.itemSeasonCodeId ? String(detail.itemSeasonCodeId) : "",
    orderIncrement: detail?.orderIncrement != null ? String(detail.orderIncrement) : "",
    fListPriceFlag: detail?.fListPriceFlag ?? false,
    fPerishable: detail?.fPerishable ?? false,
    fIdRequired: detail?.fIdRequired ?? false,
    minOrderQtyItem: detail?.minOrderQtyItem != null ? String(detail.minOrderQtyItem) : "",
    usedDccId: detail?.usedDccId ? String(detail.usedDccId) : "",
  };
}

function optionalString(value: string, isBulk: boolean): string | null | undefined {
  if (value !== "") return value;
  return isBulk ? undefined : null;
}

function hasPatchFields<T extends object>(value: T): boolean {
  return Object.values(value).some((entry) => entry !== undefined);
}

function buildLegacyCompatiblePatch(form: FormState, baseline: FormState, isBulk: boolean) {
  const rawPatch = buildPatch(baseline as Record<string, unknown>, form as Record<string, unknown>);
  const patch: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(rawPatch)) {
    if (isBulk && value === "") continue;

    switch (key) {
      case "description":
        patch.description = value;
        break;
      case "barcode":
        patch.barcode = value;
        break;
      case "vendorId":
      case "dccId":
      case "itemTaxTypeId":
      case "unitsPerPack":
        patch[key] = value === "" ? undefined : Number(value);
        break;
      case "retail":
      case "cost":
      case "weight":
        patch[key] = Number(value);
        break;
      case "catalogNumber":
      case "comment":
      case "imageUrl":
      case "packageType":
        patch[key] = optionalString(String(value), isBulk);
        break;
      case "fDiscontinue":
        patch.fDiscontinue = value ? 1 : 0;
        break;
      default:
        break;
    }
  }

  for (const key of Object.keys(patch)) {
    if (patch[key] === undefined) delete patch[key];
  }

  return patch;
}

function buildV2Patch(form: FormState, baseline: FormState, isBulk: boolean): ProductEditPatchV2 {
  const rawPatch = buildPatch(baseline as Record<string, unknown>, form as Record<string, unknown>);
  const item: NonNullable<ProductEditPatchV2["item"]> = {};
  const gm: NonNullable<ProductEditPatchV2["gm"]> = {};
  const primaryInventory: NonNullable<ProductEditPatchV2["primaryInventory"]> = {};

  for (const [key, value] of Object.entries(rawPatch)) {
    if (isBulk && value === "") continue;

    switch (key) {
      case "description":
        gm.description = String(value);
        break;
      case "barcode":
        item.barcode = value === "" ? null : String(value);
        break;
      case "vendorId":
        item.vendorId = value === "" ? undefined : Number(value);
        break;
      case "dccId":
        item.dccId = value === "" ? undefined : Number(value);
        break;
      case "itemTaxTypeId":
        item.itemTaxTypeId = value === "" ? undefined : Number(value);
        break;
      case "unitsPerPack":
        gm.unitsPerPack = value === "" ? undefined : Number(value);
        break;
      case "retail":
        primaryInventory.retail = Number(value);
        break;
      case "cost":
        primaryInventory.cost = Number(value);
        break;
      case "weight":
        item.weight = Number(value);
        break;
      case "catalogNumber":
        gm.catalogNumber = optionalString(String(value), isBulk);
        break;
      case "comment":
        item.comment = optionalString(String(value), isBulk);
        break;
      case "imageUrl":
        gm.imageUrl = optionalString(String(value), isBulk);
        break;
      case "packageType":
        gm.packageType = optionalString(String(value), isBulk);
        break;
      case "fDiscontinue":
        item.fDiscontinue = value ? 1 : 0;
        break;
      default:
        break;
    }
  }

  return {
    item: hasPatchFields(item) ? item : undefined,
    gm: hasPatchFields(gm) ? gm : undefined,
    primaryInventory: hasPatchFields(primaryInventory) ? primaryInventory : undefined,
  };
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-xl border border-border/60 bg-card/60 p-4">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function Field({
  id,
  label,
  children,
}: {
  id?: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

function ReadOnlyCheckbox({
  checked,
  label,
  disabled,
  onCheckedChange,
}: {
  checked: boolean;
  label: string;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 rounded-lg border border-border/60 bg-background/70 px-3 py-2.5 text-sm">
      <Checkbox checked={checked} onCheckedChange={(next) => onCheckedChange(next === true)} disabled={disabled} aria-label={label} />
      <span className="leading-5">{label}</span>
    </label>
  );
}

function ReadOnlyValueField({
  id,
  label,
  value,
}: {
  id: string;
  label: string;
  value: string;
}) {
  return (
    <Field id={id} label={label}>
      <Input id={id} value={value} disabled readOnly />
    </Field>
  );
}

function BooleanSelectField({
  id,
  label,
  value,
  onChange,
  disabled = false,
}: {
  id: string;
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <Field id={id} label={label}>
      <Select value={value ? "1" : "0"} onValueChange={(next) => onChange(next === "1")} disabled={disabled}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="min-w-[var(--anchor-width)]">
          <SelectItem value="1">Enabled</SelectItem>
          <SelectItem value="0">Disabled</SelectItem>
        </SelectContent>
      </Select>
    </Field>
  );
}

export function EditItemDialogV2({
  open,
  onOpenChange,
  items,
  onSaved,
  detail = null,
  detailLoading = false,
}: EditItemDialogV2Props) {
  const isBulk = items.length > 1;
  const { refs, loading: refsLoading, available: refsAvailable } = useProductRefDirectory();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirtyFieldsRef = useRef<Set<keyof FormState>>(new Set());
  const hydratedSelectionRef = useRef<string | null>(null);

  const refsUnavailable = !refsLoading && !refsAvailable;
  const refsControlsDisabled = refsLoading || refsUnavailable;
  const baselineForm = useMemo(() => (isBulk ? EMPTY_FORM : toFormState(items[0], detail)), [detail, isBulk, items]);
  const selectionKey = isBulk
    ? `bulk:${items.map((item) => item.sku).join(",")}`
    : `single:${items[0]?.sku ?? "none"}`;

  useEffect(() => {
    if (!open) {
      hydratedSelectionRef.current = null;
      dirtyFieldsRef.current.clear();
      return;
    }

    const nextForm = isBulk ? EMPTY_FORM : toFormState(items[0], detail);

    if (hydratedSelectionRef.current !== selectionKey) {
      hydratedSelectionRef.current = selectionKey;
      dirtyFieldsRef.current.clear();
      setForm(nextForm);
      setError(null);
      return;
    }

    if (isBulk) return;

    setForm((current) => {
      let changed = false;
      const merged = { ...current };

      for (const key of Object.keys(EMPTY_FORM) as Array<keyof FormState>) {
        if (dirtyFieldsRef.current.has(key)) continue;
        if (merged[key] !== nextForm[key]) {
          merged[key] = nextForm[key];
          changed = true;
        }
      }

      return changed ? merged : current;
    });
  }, [detail, isBulk, items, open, selectionKey]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    dirtyFieldsRef.current.add(key);
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSave() {
    const v2Patch = buildV2Patch(form, baselineForm, isBulk);
    const hasV2Changes =
      hasPatchFields(v2Patch.item ?? {}) ||
      hasPatchFields(v2Patch.gm ?? {}) ||
      hasPatchFields(v2Patch.primaryInventory ?? {});

    if (!hasV2Changes) {
      onOpenChange(false);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      if (items.length === 1) {
        const item = items[0];
        await productApi.update(item.sku, {
          mode: "v2",
          patch: v2Patch,
          baseline: {
            sku: item.sku,
            barcode: item.barcode,
            retail: item.retail,
            cost: item.cost,
            fDiscontinue: item.fDiscontinue,
          },
        });
      } else {
        const legacyPatch = buildLegacyCompatiblePatch(form, baselineForm, true);
        const result = await productApi.batch({
          action: "update",
          rows: items.map((item) => ({
            sku: item.sku,
            patch: legacyPatch,
            isTextbook: !!item.isTextbook,
          })),
        });
        if ("errors" in result && result.errors.length > 0) {
          setError(result.errors.map((entry) => `Row ${entry.rowIndex + 1}: ${entry.message}`).join("; "));
          return;
        }
      }

      onSaved?.(items.map((item) => item.sku));
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  const dialogTitle = isBulk ? `Edit ${items.length} items` : `Edit SKU ${items[0]?.sku}`;
  const uid = items[0]?.sku ?? "bulk";
  const idFor = (field: string) => `edit-v2-${uid}-${field}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[58rem]">
        <DialogHeader className="border-b bg-muted/30 px-6 py-5">
          <DialogTitle className="text-[1.2rem] font-semibold tracking-tight">{dialogTitle}</DialogTitle>
          <DialogDescription>
            {isBulk
              ? "Fields left blank won't be changed. Fill only the shared values you want to apply across the selected items."
              : "Phase 4 surfaces the GM and shared item fields in one tabbed editor."}
          </DialogDescription>
        </DialogHeader>

        {detailLoading && !isBulk ? (
          <div role="status" aria-live="polite" className="mx-6 mt-6 rounded-lg border border-amber-300/70 bg-amber-50 px-3 py-3 text-sm text-amber-900 dark:border-amber-800/70 dark:bg-amber-950/30 dark:text-amber-200">
            Loading item details…
          </div>
        ) : null}

        {refsUnavailable ? (
          <div role="alert" aria-live="polite" className="mx-6 mt-6 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-3 text-sm text-destructive">
            Reference data is unavailable right now. Vendor, department / class, tax type, package type, and color lookups are disabled until Prism recovers.
          </div>
        ) : null}

        {error ? (
          <div role="alert" aria-live="polite" className="mx-6 mt-6 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <div className="max-h-[calc(92vh-12rem)] overflow-y-auto px-6 py-5">
          <Tabs defaultValue="primary" className="gap-4">
            <TabsList variant="line" className="w-full justify-start border-b border-border/70 px-0">
              <TabsTrigger value="primary">Primary</TabsTrigger>
              <TabsTrigger value="more">More</TabsTrigger>
              <TabsTrigger value="advanced">Advanced</TabsTrigger>
            </TabsList>

            <TabsContent value="primary" className="space-y-4 pt-1">
              <Section title="Core item fields" description="Merchandise-safe fields that already write through the current edit path.">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field id={idFor("description")} label="Description">
                    <Input
                      id={idFor("description")}
                      value={form.description}
                      onChange={(event) => update("description", event.target.value)}
                      disabled={isBulk}
                      placeholder={isBulk ? "Leave unchanged (per-item)…" : ""}
                    />
                  </Field>
                  <Field id={idFor("barcode")} label="Barcode">
                    <Input
                      id={idFor("barcode")}
                      value={form.barcode}
                      onChange={(event) => update("barcode", event.target.value)}
                      disabled={isBulk}
                      placeholder={isBulk ? "Leave unchanged (per-item)…" : ""}
                    />
                  </Field>

                  <ItemRefSelectField
                    id={idFor("vendor")}
                    refs={refs}
                    kind="vendor"
                    label="Vendor"
                    value={form.vendorId}
                    onChange={(value) => update("vendorId", value)}
                    disabled={refsControlsDisabled}
                    bulkMode={isBulk}
                  />
                  <ItemRefSelectField
                    id={idFor("dcc")}
                    refs={refs}
                    kind="dcc"
                    label="Department / Class"
                    value={form.dccId}
                    onChange={(value) => update("dccId", value)}
                    disabled={refsControlsDisabled}
                    bulkMode={isBulk}
                  />
                  <ItemRefSelectField
                    id={idFor("taxType")}
                    refs={refs}
                    kind="taxType"
                    label="Tax Type"
                    value={form.itemTaxTypeId}
                    onChange={(value) => update("itemTaxTypeId", value)}
                    disabled={refsControlsDisabled}
                    bulkMode={isBulk}
                  />

                  <Field id={idFor("retail")} label="Retail">
                    <Input
                      id={idFor("retail")}
                      type="number"
                      step="0.01"
                      min="0"
                      inputMode="decimal"
                      value={form.retail}
                      onChange={(event) => update("retail", event.target.value)}
                      placeholder={isBulk ? "Leave unchanged…" : ""}
                    />
                  </Field>
                  <Field id={idFor("cost")} label="Cost">
                    <Input
                      id={idFor("cost")}
                      type="number"
                      step="0.01"
                      min="0"
                      inputMode="decimal"
                      value={form.cost}
                      onChange={(event) => update("cost", event.target.value)}
                      placeholder={isBulk ? "Leave unchanged…" : ""}
                    />
                  </Field>
                  <Field id={idFor("catalogNumber")} label="Catalog #">
                    <Input
                      id={idFor("catalogNumber")}
                      value={form.catalogNumber}
                      onChange={(event) => update("catalogNumber", event.target.value)}
                      placeholder={isBulk ? "Leave unchanged…" : ""}
                    />
                  </Field>
                  <Field id={idFor("comment")} label="Comment">
                    <Textarea
                      id={idFor("comment")}
                      value={form.comment}
                      onChange={(event) => update("comment", event.target.value)}
                      placeholder={isBulk ? "Leave unchanged…" : ""}
                      className="min-h-24"
                    />
                  </Field>
                </div>

                <ReadOnlyCheckbox
                  checked={form.fDiscontinue}
                  label="Discontinue item"
                  onCheckedChange={(checked) => update("fDiscontinue", checked)}
                />
              </Section>
            </TabsContent>

            <TabsContent value="more" className="space-y-4 pt-1">
              <Section title="Packaging and merchandising" description="Writeable fields stay active. Phase 4 parity-only fields are surfaced read-only until their patch wiring lands.">
                <div className="grid gap-4 sm:grid-cols-2">
                  <ItemRefSelectField
                    id={idFor("packageType")}
                    refs={refs}
                    kind="packageType"
                    label="Package Type"
                    value={form.packageType}
                    onChange={(value) => update("packageType", value)}
                    disabled={refsControlsDisabled}
                    bulkMode={isBulk}
                  />
                  <Field id={idFor("unitsPerPack")} label="Units per Pack">
                    <Input
                      id={idFor("unitsPerPack")}
                      type="number"
                      min="1"
                      step="1"
                      value={form.unitsPerPack}
                      onChange={(event) => update("unitsPerPack", event.target.value)}
                      placeholder={isBulk ? "Leave unchanged…" : ""}
                    />
                  </Field>
                  <Field id={idFor("imageUrl")} label="Image URL">
                    <Input
                      id={idFor("imageUrl")}
                      value={form.imageUrl}
                      onChange={(event) => update("imageUrl", event.target.value)}
                      placeholder={isBulk ? "Leave unchanged…" : ""}
                    />
                  </Field>
                  <Field id={idFor("weight")} label="Weight">
                    <Input
                      id={idFor("weight")}
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      value={form.weight}
                      onChange={(event) => update("weight", event.target.value)}
                      placeholder={isBulk ? "Leave unchanged…" : ""}
                    />
                  </Field>

                  <ItemRefSelectField
                    id={idFor("altVendor")}
                    refs={refs}
                    kind="vendor"
                    label="Alt Vendor"
                    value={form.altVendorId}
                    onChange={(value) => update("altVendorId", value)}
                    disabled
                  />
                  <ReadOnlyValueField id={idFor("manufacturer")} label="Manufacturer" value={form.mfgId} />
                  <ReadOnlyValueField id={idFor("size")} label="Size" value={form.size} />
                  <ItemRefSelectField
                    id={idFor("color")}
                    refs={refs}
                    kind="color"
                    label="Color"
                    value={form.colorId}
                    onChange={(value) => update("colorId", value)}
                    disabled
                  />
                  <ReadOnlyValueField id={idFor("style")} label="Style" value={form.styleId} />
                  <ReadOnlyValueField id={idFor("season")} label="Season" value={form.itemSeasonCodeId} />
                  <ReadOnlyValueField id={idFor("orderIncrement")} label="Order Increment" value={form.orderIncrement} />
                </div>
              </Section>
            </TabsContent>

            <TabsContent value="advanced" className="space-y-4 pt-1">
              <Section title="Advanced flags" description="These rare item-level fields are visible now and remain read-only until the Phase 5 wiring pass.">
                <div className="grid gap-4 sm:grid-cols-2">
                  <BooleanSelectField
                    id={idFor("listFlag")}
                    label="List Price Flag"
                    value={form.fListPriceFlag}
                    onChange={(value) => update("fListPriceFlag", value)}
                    disabled
                  />
                  <BooleanSelectField
                    id={idFor("perishable")}
                    label="Perishable"
                    value={form.fPerishable}
                    onChange={(value) => update("fPerishable", value)}
                    disabled
                  />
                  <BooleanSelectField
                    id={idFor("idRequired")}
                    label="ID Required"
                    value={form.fIdRequired}
                    onChange={(value) => update("fIdRequired", value)}
                    disabled
                  />
                  <ReadOnlyValueField id={idFor("minOrderQty")} label="Min Order Qty" value={form.minOrderQtyItem} />
                  <ItemRefSelectField
                    id={idFor("usedDcc")}
                    refs={refs}
                    kind="dcc"
                    label="Used DCC"
                    value={form.usedDccId}
                    onChange={(value) => update("usedDccId", value)}
                    disabled
                  />
                </div>
              </Section>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter className="border-t bg-muted/20 px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void handleSave()} disabled={saving || detailLoading}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
